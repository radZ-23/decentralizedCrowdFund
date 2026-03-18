const mongoose = require('mongoose');
const bcryptjs = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['patient', 'donor', 'hospital', 'admin'],
    required: true,
  },
  walletAddress: {
    type: String,
    unique: true,
    sparse: true,
  },
  kyc: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    submittedAt: Date,
    verifiedAt: Date,
  },
  profile: {
    phone: String,
    profilePicture: String,
    bio: String,
    location: String,
    verified: { type: Boolean, default: false },
  },
  // Hospital-specific fields
  hospitalName: String,
  hospitalLicense: String,
  hospitalVerificationToken: String,
  
  // Patient-specific fields
  medicalCondition: String,
  targetAmount: Number,
  
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (inputPassword) {
  return await bcryptjs.compare(inputPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
