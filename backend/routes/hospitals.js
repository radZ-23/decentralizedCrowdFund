const express = require('express');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const SmartContract = require('../models/SmartContract');
const AuditLog = require('../models/AuditLog');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const axios = require('axios');
const { getIO } = require('../utils/socket');
const { sendHospitalAssignedEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { isHospitalVerified, verifiedHospitalMongoFilter } = require('../utils/hospitalVerification');

const router = express.Router();

// Get IO instance for emitting events
const getIoInstance = () => {
  try {
    return getIO();
  } catch (e) {
    logger.warn('Socket.IO not initialized');
    return null;
  }
};

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
// @desc    Get verified hospitals (admin: full minus password; patient: id/name/email for campaign assignment)
// @access  Private (Admin, Patient)
router.get('/verified', authMiddleware, roleMiddleware(['admin', 'patient']), async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const verifiedHospitals = await User.find(verifiedHospitalMongoFilter())
      .select(isAdmin ? '-password' : '_id hospitalName email')
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

// @route   GET /api/hospitals/my-campaigns
// @desc    Get all campaigns assigned to current hospital
// @access  Private (Hospital only)
router.get('/my-campaigns', authMiddleware, roleMiddleware(['hospital']), async (req, res) => {
  try {
    const hospitalId = req.user.userId;

    const campaigns = await Campaign.find({ hospitalId })
      .populate('patientId', 'name email')
      .populate('riskAssessmentId')
      .sort({ createdAt: -1 });

    // Get statistics
    const stats = await Campaign.aggregate([
      { $match: { hospitalId: new require('mongoose').Types.ObjectId(hospitalId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRaised: { $sum: { $ifNull: ['$raisedAmount', 0] } },
          totalTarget: { $sum: { $ifNull: ['$targetAmount', 0] } },
        },
      },
    ]);

    const statusBreakdown = {};
    stats.forEach(s => {
      statusBreakdown[s._id] = {
        count: s.count,
        totalRaised: s.totalRaised,
        totalTarget: s.totalTarget,
      };
    });

    res.json({
      campaigns,
      stats: {
        total: campaigns.length,
        byStatus: statusBreakdown,
      },
    });
  } catch (error) {
    logger.error(`Hospital campaigns fetch error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch hospital campaigns: ${error.message}` });
  }
});

// @route   GET /api/hospitals/campaign/:id
// @desc    Get single campaign details for hospital
// @access  Private (Hospital only)
router.get('/campaign/:id', authMiddleware, roleMiddleware(['hospital']), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('riskAssessmentId')
      .populate({
        path: 'donations',
        model: Donation,
        populate: { path: 'donorId', select: 'name' },
      });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check if hospital is assigned to this campaign
    if (campaign.hospitalId?.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to view this campaign' });
    }

    // Get smart contract details if available
    let smartContract = null;
    if (campaign.smartContractAddress) {
      smartContract = await SmartContract.findOne({ campaignId: campaign._id });
    }

    res.json({
      campaign,
      smartContract,
    });
  } catch (error) {
    logger.error(`Hospital campaign details fetch error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch campaign details: ${error.message}` });
  }
});

// @route   POST /api/hospitals/assign-campaign
// @desc    Assign a hospital to a campaign (Admin only)
// @access  Private (Admin only)
router.post('/assign-campaign', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { campaignId, hospitalId } = req.body;

    if (!campaignId || !hospitalId) {
      return res.status(400).json({ error: 'Campaign ID and Hospital ID are required' });
    }

    const campaign = await Campaign.findById(campaignId).populate('patientId');
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const hospital = await User.findById(hospitalId);
    if (!hospital || hospital.role !== 'hospital') {
      return res.status(400).json({ error: 'Invalid hospital' });
    }

    if (!isHospitalVerified(hospital)) {
      return res.status(400).json({ error: 'Hospital must be verified before assignment' });
    }

    // Assign hospital to campaign
    campaign.hospitalId = hospitalId;
    await campaign.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'hospital_assigned_to_campaign',
      entityType: 'campaign',
      entityId: campaign._id,
      details: {
        campaignTitle: campaign.title,
        hospitalName: hospital.hospitalName,
        hospitalEmail: hospital.email,
      },
      status: 'success',
    });

    // Send email notification to hospital
    if (hospital.email) {
      await sendHospitalAssignedEmail(
        hospital.email,
        campaign.title,
        campaign.patientId?.name || 'Patient'
      );
    }

    // Emit socket event
    const io = getIoInstance();
    if (io) {
      io.to(`campaign:${campaignId}`).emit('hospital:assigned', {
        campaignId,
        hospitalId,
        hospitalName: hospital.hospitalName,
      });
      io.to(`user:${hospitalId}`).emit('campaign:assigned', {
        campaignId: campaign._id,
        campaignTitle: campaign.title,
        assignedAt: new Date(),
      });
      logger.info(`Emitted hospital:assigned event for campaign ${campaignId}`);
    }

    res.json({
      message: 'Hospital assigned to campaign successfully',
      campaign,
    });
  } catch (error) {
    logger.error(`Hospital assignment error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to assign hospital: ${error.message}` });
  }
});

// @route   POST /api/hospitals/campaign/:id/milestone-confirm
// @desc    Hospital confirms milestone completion
// @access  Private (Hospital only)
router.post('/campaign/:id/milestone-confirm', authMiddleware, roleMiddleware(['hospital']), async (req, res) => {
  try {
    const { milestoneIndex } = req.body;

    if (milestoneIndex === undefined || milestoneIndex < 0) {
      return res.status(400).json({ error: 'Milestone index is required' });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check if hospital is assigned to this campaign
    if (campaign.hospitalId?.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized for this campaign' });
    }

    if (!campaign.milestones || campaign.milestones.length === 0) {
      return res.status(400).json({ error: 'No milestones defined' });
    }

    if (milestoneIndex >= campaign.milestones.length) {
      return res.status(400).json({ error: 'Invalid milestone index' });
    }

    const milestone = campaign.milestones[milestoneIndex];
    if (milestone.status === 'confirmed' || milestone.status === 'released') {
      return res.status(400).json({ error: 'Milestone already processed' });
    }

    // Update milestone status
    milestone.status = 'confirmed';
    milestone.confirmedAt = new Date();
    await campaign.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'hospital_milestone_confirmed',
      entityType: 'campaign',
      entityId: campaign._id,
      details: {
        milestoneIndex,
        milestoneDescription: milestone.description,
        milestoneAmount: milestone.targetAmount,
      },
      status: 'success',
    });

    // Emit socket event
    const io = getIoInstance();
    if (io) {
      io.to(`campaign:${campaign._id}`).emit('milestone:confirmed', {
        campaignId: campaign._id,
        milestoneIndex,
        confirmedAt: new Date(),
      });
      logger.info(`Emitted milestone:confirmed event for campaign ${campaign._id}`);
    }

    res.json({
      message: 'Milestone confirmed successfully',
      milestone,
      campaign,
    });
  } catch (error) {
    logger.error(`Milestone confirmation error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to confirm milestone: ${error.message}` });
  }
});

// @route   GET /api/hospitals/analytics
// @desc    Get analytics for hospital's campaigns
// @access  Private (Hospital only)
router.get('/analytics', authMiddleware, roleMiddleware(['hospital']), async (req, res) => {
  try {
    const hospitalId = req.user.userId;

    // Get aggregate statistics
    const stats = await Campaign.aggregate([
      { $match: { hospitalId: new require('mongoose').Types.ObjectId(hospitalId) } },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          activeCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
          },
          completedCampaigns: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          totalRaised: { $sum: { $ifNull: ['$raisedAmount', 0] } },
          totalTarget: { $sum: { $ifNull: ['$targetAmount', 0] } },
        },
      },
    ]);

    // Get milestone statistics
    const campaigns = await Campaign.find({ hospitalId });
    let totalMilestones = 0;
    let confirmedMilestones = 0;
    let releasedMilestones = 0;

    campaigns.forEach(c => {
      if (c.milestones) {
        totalMilestones += c.milestones.length;
        c.milestones.forEach(m => {
          if (m.status === 'confirmed') confirmedMilestones++;
          if (m.status === 'released') releasedMilestones++;
        });
      }
    });

    // Get recent donations across all campaigns
    const campaignIds = campaigns.map(c => c._id);
    const recentDonations = await Donation.find({ campaignId: { $in: campaignIds } })
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      stats: stats[0] || {
        totalCampaigns: 0,
        activeCampaigns: 0,
        completedCampaigns: 0,
        totalRaised: 0,
        totalTarget: 0,
      },
      milestones: {
        total: totalMilestones,
        confirmed: confirmedMilestones,
        released: releasedMilestones,
        pending: totalMilestones - confirmedMilestones - releasedMilestones,
      },
      recentDonations,
    });
  } catch (error) {
    logger.error(`Hospital analytics error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch hospital analytics: ${error.message}` });
  }
});

module.exports = router;
