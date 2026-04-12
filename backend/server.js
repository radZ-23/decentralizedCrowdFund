require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const http = require("http");
const { Server } = require("socket.io");
const { initializeSocket } = require("./utils/socket");

// Import routes
const authRoutes = require("./routes/auth");
const campaignsRoutes = require("./routes/campaigns");
const donationsRoutes = require("./routes/donations");
const milestonesRoutes = require("./routes/milestones");
const adminRoutes = require("./routes/admin");
const analyticsRoutes = require("./routes/analytics");
const hospitalsRoutes = require("./routes/hospitals");
const kycRoutes = require("./routes/kyc");
const transactionsRoutes = require("./routes/transactions");

// Import middleware
const { auditLogMiddleware } = require("./middleware/auth");

// Import indexer daemon
const { startIndexer } = require("./utils/indexer");

// Import logger
const logger = require("./utils/logger");

// Import models
const Campaign = require("./models/Campaign");
const User = require("./models/User");
const RiskAssessment = require("./models/RiskAssessment");
const Donation = require("./models/Donation");
const SmartContract = require("./models/SmartContract");
const AuditLog = require("./models/AuditLog");

const app = express();
const server = http.createServer(app);

// Socket.IO setup for real-time updates
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Store io instance for access in routes
app.set('io', io);

// Initialize socket utility
initializeSocket(io);

// Middleware
app.use(cors());
app.use(helmet()); // HIPAA/GDPR compliant HTTP security headers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Sanitise user input against XSS
app.use(auditLogMiddleware);

// Rate limiting — default 500 req / 15 min per IP (override with API_RATE_LIMIT_MAX; disabled in Jest)
const skipRateLimit =
  process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;
const apiRateLimitMax = parseInt(process.env.API_RATE_LIMIT_MAX || "500", 10);
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(apiRateLimitMax) && apiRateLimitMax > 0 ? apiRateLimitMax : 500,
  skip: () => skipRateLimit,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// MongoDB Connection
const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medtrust";
const isTestEnv = skipRateLimit;

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("✅ MongoDB connected");
    if (!isTestEnv) {
      startIndexer(30); // Poll every 30 seconds
    }
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
app.use("/api/analytics", analyticsRoutes);
app.use("/api/hospitals", hospitalsRoutes);
app.use("/api/kyc", kycRoutes);
app.use("/api/transactions", transactionsRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "✅ Backend is running",
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
  });
});

// Socket.IO Connection Handling
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Join user-specific room
  socket.on('join_user_room', (userId) => {
    socket.join(`user:${userId}`);
    logger.info(`User ${userId} joined room user:${userId}`);
  });

  // Join campaign-specific room
  socket.on('join_campaign_room', (campaignId) => {
    socket.join(`campaign:${campaignId}`);
    logger.info(`Joined campaign room: campaign:${campaignId}`);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });

  // Error handling
  socket.on('error', (error) => {
    logger.error(`Socket error: ${error.message}`, error);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`Server error: ${err.message}`, err);
  res.status(500).json({ error: `Server error: ${err.message}` });
});

// 404 handling
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const PORT = process.env.PORT || 5000;

module.exports = app;

if (!isTestEnv) {
  server.listen(PORT, () => {
    logger.info(`🚀 Backend server running on port ${PORT}`);
    logger.info(`📍 API URL: http://localhost:${PORT}`);
    logger.info(`🔌 Socket.IO ready for real-time updates`);
    console.log(`🚀 Backend server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO ready for real-time updates`);
  });
}
