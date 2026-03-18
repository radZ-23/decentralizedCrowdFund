const mongoose = require('mongoose');

const SmartContractSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
  },
  contractAddress: {
    type: String,
    required: true,
    unique: true,
  },
  transactionHash: String,
  blockNumber: Number,
  
  network: {
    type: String,
    enum: ['ethereum', 'polygon', 'sepolia', 'mumbai'],
    required: true,
  },
  
  patientAddress: String,
  hospitalAddress: String,
  
  totalValue: Number,
  gasUsed: Number,
  
  milestones: [
    {
      description: String,
      amount: Number,
      confirmed: Boolean,
      releasedAt: Date,
    },
  ],
  
  status: {
    type: String,
    enum: ['deploying', 'active', 'completed', 'cancelled'],
    default: 'deploying',
  },
  
  deployedAt: { type: Date, default: Date.now },
  completedAt: Date,
  
  abi: mongoose.Schema.Types.Mixed, // Contract ABI for interaction
});

module.exports = mongoose.model('SmartContract', SmartContractSchema);
