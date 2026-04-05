require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

// Import routes
const authRoutes = require("./routes/auth");
const campaignsRoutes = require("./routes/campaigns");
const donationsRoutes = require("./routes/donations");
const milestonesRoutes = require("./routes/milestones");
const adminRoutes = require("./routes/admin");

// Import middleware
const { auditLogMiddleware } = require("./middleware/auth");

// Import indexer daemon
const { startIndexer } = require("./utils/indexer");

// Import models
const Campaign = require("./models/Campaign");
const User = require("./models/User");
const RiskAssessment = require("./models/RiskAssessment");
const Donation = require("./models/Donation");
const SmartContract = require("./models/SmartContract");
const AuditLog = require("./models/AuditLog");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(auditLogMiddleware);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medtrust";
mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("✅ MongoDB connected");
    startIndexer(30); // Poll every 30 seconds
  })
  .catch((err) => {
    console.warn("⚠️  MongoDB connection pending:", err.message);
    console.log("📝 Server will start anyway - some features may not work until MongoDB is available");
  });

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/campaigns", campaignsRoutes);
app.use("/api/donations", donationsRoutes);
app.use("/api/milestones", milestonesRoutes);
app.use("/api/admin", adminRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "✅ Backend is running",
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: `Server error: ${err.message}` });
});

// 404 handling
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📍 API URL: http://localhost:${PORT}`);
});
