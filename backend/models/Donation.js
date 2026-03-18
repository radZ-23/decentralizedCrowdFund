const mongoose = require('mongoose');

const DonationSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
  },
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: 'ETH',
  },
  status: {
    type: String,
    enum: ['pending', 'locked_in_escrow', 'released', 'refunded'],
    default: 'pending',
  },
  transactionHash: String,
  gasUsed: Number,
  blockNumber: Number,
  
  escrowDetails: {
    contractAddress: String,
    escrowLockedAt: Date,
    releaseTimestamp: Date,
  },
  
  donorMessage: String,
  anonymous: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Donation', DonationSchema);
