const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const { generateToken } = require('../utils/jwtUtils');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');
const { ethers } = require('ethers');
const { sendPasswordResetEmail, sendWelcomeEmail } = require('../utils/emailService');

const router = express.Router();

const hashResetToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @route   POST /api/auth/forgot-password
// @desc    Request password reset email
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetTokenHash = hashResetToken(rawToken);
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      await sendPasswordResetEmail(user.email, rawToken).catch(() => {});
    }

    res.json({
      message: 'If an account exists for that email, we sent password reset instructions.',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to process request' });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Set new password using reset token from email
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || String(password).length < 8) {
      return res.status(400).json({
        error: 'Valid token and password (min 8 characters) are required',
      });
    }

    const tokenHash = hashResetToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpires');

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset link' });
    }

    user.password = password;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.walletAuthNonce = undefined;
    user.walletAuthNonceExpires = undefined;
    await user.save();

    res.json({ message: 'Password updated. You can sign in now.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password' });
  }
});

// @route   POST /api/auth/wallet-challenge
// @desc    Get a one-time message to sign for wallet login
// @access  Public
router.post('/wallet-challenge', async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Valid wallet address required' });
    }

    const user = await User.findOne({
      walletAddress: new RegExp(`^${escapeRegex(walletAddress)}$`, 'i'),
    });

    if (!user || !user.isActive) {
      return res.status(404).json({
        error: 'No account linked to this wallet. Sign up and verify your wallet in profile first.',
      });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    user.walletAuthNonce = nonce;
    user.walletAuthNonceExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const message = `MedTrustFund wallet login\nWallet: ${walletAddress}\nNonce: ${nonce}`;
    res.json({ message });
  } catch (error) {
    console.error('Wallet challenge error:', error);
    res.status(500).json({ error: 'Unable to start wallet login' });
  }
});

// @route   POST /api/auth/wallet-login
// @desc    Complete wallet login with signature
// @access  Public
router.post('/wallet-login', async (req, res) => {
  try {
    const { walletAddress, signature } = req.body;
    if (!walletAddress || !signature) {
      return res.status(400).json({ error: 'Wallet address and signature required' });
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const user = await User.findOne({
      walletAddress: new RegExp(`^${escapeRegex(walletAddress)}$`, 'i'),
    }).select('+walletAuthNonce +walletAuthNonceExpires');

    if (!user || !user.walletAuthNonce || !user.walletAuthNonceExpires) {
      return res.status(400).json({ error: 'Start wallet login again (challenge expired or missing)' });
    }

    if (user.walletAuthNonceExpires.getTime() < Date.now()) {
      user.walletAuthNonce = undefined;
      user.walletAuthNonceExpires = undefined;
      await user.save();
      return res.status(400).json({ error: 'Challenge expired. Request a new one.' });
    }

    const message = `MedTrustFund wallet login\nWallet: ${walletAddress}\nNonce: ${user.walletAuthNonce}`;
    let recovered;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    if (!recovered || recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Signature does not match wallet' });
    }

    user.walletAuthNonce = undefined;
    user.walletAuthNonceExpires = undefined;
    await user.save();

    await AuditLog.create({
      userId: user._id,
      action: 'user_login',
      entityType: 'user',
      entityId: user._id,
      details: { method: 'wallet' },
      ipAddress: req.ip,
      status: 'success',
    }).catch(() => {});

    const token = generateToken(user._id, user.email, user.role);

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${user._id.toString()}`).emit('session:started', {
        method: 'wallet',
        at: new Date().toISOString(),
      });
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        verified: user.profile?.verified,
      },
    });
  } catch (error) {
    console.error('Wallet login error:', error);
    res.status(500).json({ error: 'Wallet login failed' });
  }
});

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

    sendWelcomeEmail(newUser.email, newUser.name).catch(() => {});

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

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${user._id.toString()}`).emit('session:started', {
        method: 'password',
        at: new Date().toISOString(),
      });
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        walletAddress: user.walletAddress,
        verified: user.profile?.verified,
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

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    // Verify signature proves wallet ownership.
    // The frontend must sign the same message string.
    const message = `MedTrustFund wallet verification for user ${req.user.userId}`;
    let recovered = null;
    try {
      recovered = ethers.verifyMessage(message, signature);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid signature format' });
    }

    if (!recovered || recovered.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(400).json({ error: 'Signature does not match wallet address' });
    }

    // Prevent wallet reuse across accounts
    const existingWallet = await User.findOne({
      walletAddress: walletAddress,
      _id: { $ne: req.user.userId },
    }).select('_id');
    if (existingWallet) {
      return res.status(400).json({ error: 'Wallet already linked to another account' });
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

    await AuditLog.create({
      userId: req.user.userId,
      action: 'api_call',
      entityType: 'user',
      entityId: req.user.userId,
      details: { walletAddress, signatureVerified: true },
      status: 'success',
    }).catch(() => {});

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

// @route   PUT /api/auth/preferences
// @desc    Update user email/notification preferences
// @access  Private
router.put('/preferences', authMiddleware, async (req, res) => {
  try {
    const { emailPreferences } = req.body;

    if (!emailPreferences || typeof emailPreferences !== 'object') {
      return res.status(400).json({ error: 'Invalid preferences format' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        'preferences.emailNotifications': emailPreferences,
        updatedAt: Date.now(),
      },
      { new: true }
    ).select('-password');

    res.json({
      message: 'Preferences updated successfully',
      preferences: user.preferences?.emailNotifications,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to update preferences: ${error.message}` });
  }
});

// @route   GET /api/auth/preferences
// @desc    Get user email/notification preferences
// @access  Private
router.get('/preferences', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');

    res.json({
      preferences: user.preferences?.emailNotifications || {
        campaignUpdates: true,
        donationNotifications: true,
        milestoneAlerts: true,
        kycStatus: true,
        marketingEmails: false,
      },
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch preferences: ${error.message}` });
  }
});

module.exports = router;
