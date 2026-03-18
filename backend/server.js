require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const axios = require("axios");
const { ethers } = require("ethers");
const path = require("path");

// Import routes
const authRoutes = require("./routes/auth");

// Import middleware
const { auditLogMiddleware } = require("./middleware/auth");

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

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medtrust";
mongoose
  .connect(mongoUri)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// File upload configuration
const uploadsDir = path.join(__dirname, "../uploads");
const upload = multer({ 
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Routes
app.use("/api/auth", authRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "✅ Backend is running", timestamp: new Date() });
});

// AI Verification Route
app.post("/api/verify", upload.array("documents"), async (req, res) => {
  try {
    const form = new FormData();
    req.files.forEach((f) =>
      form.append("files", require("fs").createReadStream(f.path)),
    );

    const aiRes = await axios.post("http://localhost:8001/verify", form, {
      headers: form.getHeaders(),
    });

    res.json(aiRes.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
app.post("/api/campaigns", async (req, res) => {
  const { title, patient, hospital, riskScore } = req.body;

  // Deploy contract (in production use a relayer or factory)
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545"); // Hardhat local
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // ... (call deploy script logic here or use ethers to deploy)

  const campaign = await Campaign.create({
    title,
    patient,
    hospital,
    riskScore,
    contractAddress: "0xDeployedAddressHere", // replace with actual
    documentsHash: "0xSHA256HERE",
  });

  res.json(campaign);
});

app.listen(5000, () => console.log("Backend running on http://localhost:5000"));
