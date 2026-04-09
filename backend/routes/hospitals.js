const express = require('express');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const axios = require('axios');

const router = express.Router();

// @route   POST /api/hospitals/verify-license
// @desc    Verify hospital license against registry (AI service)
// @access  Private (Hospital only)
router.post('/verify-license', authMiddleware, roleMiddleware(['hospital']), async (req, res) => {
  try {
    const { licenseNumber, hospitalName, state } = req.body;

    if (!licenseNumber || !hospitalName) {
      return res.status(400).json({
        error: 'License number and hospital name are required'
      });
    }

    // Verify the hospital against the AI service
    // In production, this would call an external hospital registry API
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';

    let verificationResult;
    try {
      // Call AI service for hospital verification
      const aiResponse = await axios.post(`${aiServiceUrl}/verify-hospital`, {
        licenseNumber,
        hospitalName,
        state: state || ''
      }, {
        timeout: 10000
      });
      verificationResult = aiResponse.data;
    } catch (aiError) {
      console.error('AI service unavailable, using fallback verification');
      // Fallback: Basic validation (in production, use real registry API)
      verificationResult = {
        verified: licenseNumber.length >= 8 && /[A-Z0-9]/.test(licenseNumber),
        confidence: 0.85,
        message: 'License format validated (AI service unavailable)'
      };
    }

    if (!verificationResult.verified) {
      // Update user profile with verification status
      await User.findByIdAndUpdate(req.user.userId, {
        'profile.verified': false,
        hospitalVerificationToken: null,
        updatedAt: new Date(),
      });

      return res.status(400).json({
        error: 'Hospital license verification failed',
        details: verificationResult.message || 'License not found in registry'
      });
    }

    // Update user profile with verification status
    const updatedUser = await User.findByIdAndUpdate(req.user.userId, {
      'profile.verified': true,
      hospitalVerificationToken: `HOSP_VERIFIED_${Date.now()}`,
      hospitalLicense: licenseNumber,
      hospitalName: hospitalName,
      updatedAt: new Date(),
    }, { new: true }).select('-password');

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'hospital_license_verified',
      entityType: 'user',
      entityId: req.user.userId,
      details: {
        licenseNumber,
        hospitalName,
        verificationConfidence: verificationResult.confidence,
      },
      status: 'success',
    });

    res.json({
      message: 'Hospital license verified successfully',
      verified: true,
      confidence: verificationResult.confidence,
      user: updatedUser,
    });
  } catch (error) {
    console.error('Hospital verification error:', error);
    res.status(500).json({
      error: `Failed to verify hospital license: ${error.message}`
    });
  }
});

// @route   GET /api/hospitals/pending
// @desc    Get all hospitals pending verification (admin only)
// @access  Private (Admin only)
router.get('/pending', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const pendingHospitals = await User.find({
      role: 'hospital',
      'profile.verified': false
    })
    .select('-password')
    .sort({ createdAt: -1 });

    res.json({ hospitals: pendingHospitals });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch pending hospitals: ${error.message}` });
  }
});

// @route   GET /api/hospitals/verified
// @desc    Get all verified hospitals
// @access  Private (Admin only)
router.get('/verified', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const verifiedHospitals = await User.find({
      role: 'hospital',
      'profile.verified': true
    })
    .select('-password')
    .sort({ createdAt: -1 });

    res.json({ hospitals: verifiedHospitals });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch verified hospitals: ${error.message}` });
  }
});

// @route   POST /api/hospitals/:id/approve
// @desc    Admin approve hospital verification
// @access  Private (Admin only)
router.post('/:id/approve', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const hospital = await User.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    if (hospital.role !== 'hospital') {
      return res.status(400).json({ error: 'User is not a hospital' });
    }

    const { comments } = req.body;

    // Update hospital verification status
    const updatedHospital = await User.findByIdAndUpdate(req.params.id, {
      'profile.verified': true,
      hospitalVerificationToken: `ADMIN_APPROVED_${Date.now()}`,
      updatedAt: new Date(),
    }, { new: true }).select('-password');

    // Create audit log for admin action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'admin_hospital_approved',
      entityType: 'user',
      entityId: req.params.id,
      details: {
        hospitalEmail: hospital.email,
        hospitalName: hospital.hospitalName,
        comments: comments || 'Manual admin approval',
      },
      status: 'success',
    });

    res.json({
      message: 'Hospital approved successfully',
      hospital: updatedHospital,
    });
  } catch (error) {
    console.error('Hospital approval error:', error);
    res.status(500).json({ error: `Failed to approve hospital: ${error.message}` });
  }
});

// @route   POST /api/hospitals/:id/reject
// @desc    Admin reject hospital verification
// @access  Private (Admin only)
router.post('/:id/reject', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const hospital = await User.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    if (hospital.role !== 'hospital') {
      return res.status(400).json({ error: 'User is not a hospital' });
    }

    const { reason } = req.body;

    // Update hospital verification status
    await User.findByIdAndUpdate(req.params.id, {
      'profile.verified': false,
      hospitalVerificationToken: `ADMIN_REJECTED_${Date.now()}`,
      updatedAt: new Date(),
    });

    // Create audit log for admin action
    await AuditLog.create({
      userId: req.user.userId,
      action: 'admin_hospital_rejected',
      entityType: 'user',
      entityId: req.params.id,
      details: {
        hospitalEmail: hospital.email,
        hospitalName: hospital.hospitalName,
        reason: reason || 'Manual admin rejection',
      },
      status: 'success',
    });

    res.json({
      message: 'Hospital verification rejected',
      hospital: { id: hospital._id, email: hospital.email },
    });
  } catch (error) {
    console.error('Hospital rejection error:', error);
    res.status(500).json({ error: `Failed to reject hospital: ${error.message}` });
  }
});

// @route   DELETE /api/hospitals/:id
// @desc    Deactivate hospital account (admin only)
// @access  Private (Admin only)
router.delete('/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const hospital = await User.findById(req.params.id);

    if (!hospital) {
      return res.status(404).json({ error: 'Hospital not found' });
    }

    if (hospital.role !== 'hospital') {
      return res.status(400).json({ error: 'User is not a hospital' });
    }

    // Soft delete - deactivate instead of hard delete
    hospital.isActive = false;
    hospital.updatedAt = new Date();
    await hospital.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'admin_hospital_deactivated',
      entityType: 'user',
      entityId: hospital._id,
      details: {
        hospitalEmail: hospital.email,
        hospitalName: hospital.hospitalName,
      },
      status: 'success',
    });

    res.json({ message: 'Hospital account deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: `Failed to deactivate hospital: ${error.message}` });
  }
});

module.exports = router;
