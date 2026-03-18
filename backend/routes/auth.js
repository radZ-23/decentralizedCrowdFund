const express = require('express');
const User = require('../models/User');
const { generateToken } = require('../utils/jwtUtils');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', async (req, res) => {
  try {
    const { email, password, name, role, walletAddress } = req.body;

    // Validation
    if (!email || !password || !name || !role) {
      return res
        .status(400)
        .json({ error: 'Email, password, name, and role are required' });
    }

    if (!['patient', 'donor', 'hospital', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Check if wallet already registered
    if (walletAddress) {
      const existingWallet = await User.findOne({ walletAddress });
      if (existingWallet) {
        return res.status(400).json({ error: 'Wallet already registered' });
      }
    }

    // Create new user
    const newUser = new User({
      email,
      password,
      name,
      role,
      walletAddress,
    });

    await newUser.save();

    // Create audit log
    await AuditLog.create({
      userId: newUser._id,
      action: 'user_signup',
      entityType: 'user',
      entityId: newUser._id,
      details: { email, role },
      status: 'success',
    });

    // Generate token
    const token = generateToken(newUser._id, newUser.email, newUser.role);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        walletAddress: newUser.walletAddress,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: `Signup failed: ${error.message}` });
  }
});

// @route   POST /api/auth/login
// @desc    User login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: 'Email and password are required' });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is disabled' });
    }

    // Create audit log
    await AuditLog.create({
      userId: user._id,
      action: 'user_login',
      entityType: 'user',
      entityId: user._id,
      details: { email },
      ipAddress: req.ip,
      status: 'success',
    });

    // Generate token
    const token = generateToken(user._id, user.email, user.role);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        verified: user.profile.verified,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: `Login failed: ${error.message}` });
  }
});

// @route   GET /api/auth/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch profile: ${error.message}` });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, bio, location, profilePicture } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        name: name || undefined,
        'profile.phone': phone || undefined,
        'profile.bio': bio || undefined,
        'profile.location': location || undefined,
        'profile.profilePicture': profilePicture || undefined,
        updatedAt: Date.now(),
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to update profile: ${error.message}` });
  }
});

// @route   POST /api/auth/verify-wallet
// @desc    Link wallet address to account
// @access  Private
router.post('/verify-wallet', authMiddleware, async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;

    if (!walletAddress || !signature) {
      return res.status(400).json({ 
        error: 'Wallet address and signature required' 
      });
    }

    // TODO: Verify signature with ethers.js
    // For now, simple validation
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { 
        walletAddress,
        'profile.verified': true,
        updatedAt: Date.now(),
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Wallet verified successfully',
      user,
    });
  } catch (error) {
    res.status(500).json({ 
      error: `Failed to verify wallet: ${error.message}` 
    });
  }
});

// @route   GET /api/auth/users/:id
// @desc    Get user by ID (admin access)
// @access  Private/Admin
router.get('/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch user: ${error.message}` });
  }
});

module.exports = router;
