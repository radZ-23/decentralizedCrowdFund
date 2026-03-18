const mongoose = require('mongoose');

const RiskAssessmentSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 100,
    required: true,
  },
  riskCategory: {
    type: String,
    enum: ['low', 'medium', 'high'],
    required: true,
  },
  aiVerificationDetails: {
    ocrConfidence: Number, // 0-100
    metadataConsistency: Number, // 0-100
    keywordMatch: Number, // 0-100
    fileIntegrityScore: Number, // 0-100
  },
  documentAnalysis: [
    {
      documentType: String,
      fileHash: String,
      fileSize: Number,
      resolution: String, // low, medium, high
      processingTime: Number, // in seconds
      ocrAccuracy: Number,
      anomalyFlags: [String],
    },
  ],
  fraudIndicators: [
    {
      indicator: String,
      severity: String, // low, medium, high
      details: String,
    },
  ],
  manualReviewRequired: {
    type: Boolean,
    default: false,
  },
  manualReviewStatus: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    comments: String,
  },
  recommendation: {
    type: String,
    enum: ['approve', 'escalate', 'reject'],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RiskAssessment', RiskAssessmentSchema);
