const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true,
  },
  targetAmount: {
    type: Number,
    required: true,
  },
  raisedAmount: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['draft', 'pending_verification', 'active', 'completed', 'rejected', 'paused'],
    default: 'draft',
  },
  documents: [
    {
      type: {
        type: String,
        enum: ['identity', 'diagnosis', 'admission_letter', 'cost_estimate'],
        required: true,
      },
      url: String,
      hash: String, // SHA256 hash for integrity
      uploadedAt: { type: Date, default: Date.now },
    },
  ],
  smartContractAddress: String,
  smartContractDeploymentTx: String,
  
  medicalDetails: {
    condition: String,
    severityLevel: {
      type: String,
      enum: ['critical', 'severe', 'moderate', 'mild'],
    },
    estimatedTreatmentDuration: String,
  },
  
  riskAssessmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RiskAssessment',
  },
  
  milestones: [
    {
      description: String,
      targetAmount: Number,
      status: {
        type: String,
        enum: ['pending', 'confirmed', 'released'],
        default: 'pending',
      },
      confirmedAt: Date,
      releasedAt: Date,
    },
  ],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  expiresAt: Date, // Campaign expiration date
});

module.exports = mongoose.model('Campaign', CampaignSchema);
