const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  action: {
    type: String,
    required: true,
    enum: [
      'user_signup',
      'user_login',
      'campaign_created',
      'campaign_updated',
      'docs_uploaded',
      'verification_started',
      'verification_completed',
      'risk_score_assigned',
      'donation_made',
      'escrow_locked',
      'milestone_confirmed',
      'funds_released',
      'campaign_rejected',
      'admin_override',
    ],
  },
  entityType: {
    type: String,
    enum: ['user', 'campaign', 'donation', 'smart_contract', 'risk_assessment'],
  },
  entityId: mongoose.Schema.Types.ObjectId,
  
  details: {
    type: Map,
    of: String,
  },
  
  ipAddress: String,
  userAgent: String,
  
  status: {
    type: String,
    enum: ['success', 'failure'],
    default: 'success',
  },
  
  errorMessage: String,
  
  timestamp: { type: Date, default: Date.now, index: true },
  
  // TTL index for 5-year retention (5 years = 157,680,000 seconds)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
    index: true,
  },
});

// Create TTL index for automatic deletion after 5 years
AuditLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
