const express = require('express');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const RiskAssessment = require('../models/RiskAssessment');
const Donation = require('../models/Donation');
const AuditLog = require('../models/AuditLog');
const SmartContract = require('../models/SmartContract');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { decryptFile } = require('../utils/encryption');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// All routes require admin authentication
router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

// @route   GET /api/admin/dashboard
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard', async (req, res) => {
  try {
    const [
      totalUsers,
      totalCampaigns,
      totalDonations,
      pendingReviewCampaigns,
      activeCampaigns,
      totalRaised,
      recentAuditLogs
    ] = await Promise.all([
      User.countDocuments(),
      Campaign.countDocuments(),
      Donation.countDocuments(),
      Campaign.countDocuments({ status: 'pending_verification' }),
      Campaign.countDocuments({ status: 'active' }),
      Campaign.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: null, total: { $sum: '$raisedAmount' } } }
      ]),
      AuditLog.find().sort({ createdAt: -1 }).limit(10)
    ]);

    // Get risk score distribution
    const riskDistribution = await RiskAssessment.aggregate([
      {
        $group: {
          _id: '$riskCategory',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get recent campaigns pending review
    const campaignsPendingReview = await Campaign.find({ status: 'pending_verification' })
      .populate('patientId', 'name email')
      .populate('riskAssessmentId')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({
      statistics: {
        totalUsers,
        totalCampaigns,
        totalDonations,
        pendingReviewCampaigns,
        activeCampaigns,
        totalRaised: totalRaised[0]?.total || 0,
      },
      riskDistribution: riskDistribution.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {}),
      recentAuditLogs,
      campaignsPendingReview,
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: `Failed to fetch dashboard data: ${error.message}` });
  }
});

// @route   GET /api/admin/campaigns/pending-review
// @desc    Get all campaigns pending admin review (high risk)
// @access  Private (Admin only)
router.get('/campaigns/pending-review', async (req, res) => {
  try {
    const campaigns = await Campaign.find({ status: 'pending_verification' })
      .populate('patientId', 'name email walletAddress')
      .populate('hospitalId', 'name hospitalName verified')
      .populate({
        path: 'riskAssessmentId',
        populate: { path: 'manualReviewStatus.reviewedBy', select: 'name email' }
      })
      .sort({ createdAt: -1 });

    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch pending campaigns: ${error.message}` });
  }
});

// @route   GET /api/admin/campaigns/:id/review-details
// @desc    Get detailed review information for a campaign
// @access  Private (Admin only)
router.get('/campaigns/:id/review-details', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('patientId')
      .populate('hospitalId')
      .populate({
        path: 'riskAssessmentId',
        populate: { path: 'manualReviewStatus.reviewedBy', select: 'name email' }
      });

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get all audit logs for this campaign
    const auditLogs = await AuditLog.find({
      $or: [
        { entityType: 'campaign', entityId: campaign._id },
        { entityType: 'risk_assessment', entityId: campaign.riskAssessmentId }
      ]
    }).sort({ createdAt: -1 });

    // Get donation history if any
    const donations = await Donation.find({ campaignId: campaign._id })
      .populate('donorId', 'name email');

    res.json({
      campaign,
      auditLogs,
      donations,
      canReview: campaign.status === 'pending_verification',
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch review details: ${error.message}` });
  }
});

// @route   POST /api/admin/campaigns/:id/decision
// @desc    Make admin decision on campaign (approve/reject)
// @access  Private (Admin only)
router.post('/campaigns/:id/decision', async (req, res) => {
  try {
    const { decision, comments, overrideRiskScore } = req.body;

    if (!['approve', 'reject', 'request_more_info'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision' });
    }

    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    let newStatus = campaign.status;

    switch (decision) {
      case 'approve':
        newStatus = 'active';
        if (campaign.riskAssessmentId && overrideRiskScore) {
          // Admin overrides AI risk score
          await RiskAssessment.findByIdAndUpdate(campaign.riskAssessmentId, {
            manualReviewRequired: false,
            'manualReviewStatus.status': 'approved',
            'manualReviewStatus.reviewedBy': req.user.userId,
            'manualReviewStatus.reviewedAt': new Date(),
            'manualReviewStatus.comments': comments,
            recommendation: 'approve',
          });
        }
        break;
      case 'reject':
        newStatus = 'rejected';
        if (campaign.riskAssessmentId) {
          await RiskAssessment.findByIdAndUpdate(campaign.riskAssessmentId, {
            manualReviewRequired: false,
            'manualReviewStatus.status': 'rejected',
            'manualReviewStatus.reviewedBy': req.user.userId,
            'manualReviewStatus.reviewedAt': new Date(),
            'manualReviewStatus.comments': comments,
            recommendation: 'reject',
          });
        }
        break;
      case 'request_more_info':
        newStatus = 'pending_verification';
        // Just add comment, keep status same
        if (campaign.riskAssessmentId) {
          await RiskAssessment.findByIdAndUpdate(campaign.riskAssessmentId, {
            'manualReviewStatus.comments': comments,
          });
        }
        break;
    }

    campaign.status = newStatus;
    await campaign.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'admin_campaign_decision',
      entityType: 'campaign',
      entityId: campaign._id,
      details: {
        decision,
        comments,
        overrideRiskScore: overrideRiskScore || false,
        previousStatus: campaign.status,
        newStatus,
      },
      status: 'success',
    });

    res.json({
      message: `Campaign ${decision}d successfully`,
      campaign,
    });
  } catch (error) {
    console.error('Admin decision error:', error);
    res.status(500).json({ error: `Failed to make decision: ${error.message}` });
  }
});

// @route   GET /api/admin/users
// @desc    Get all users with optional filters
// @access  Private (Admin only)
router.get('/users', async (req, res) => {
  try {
    const { role, status, limit = 100 } = req.query;

    const filter = {};
    if (role) filter.role = role;
    if (status) filter.isActive = status === 'active';

    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch users: ${error.message}` });
  }
});

// @route   PUT /api/admin/users/:id
// @desc    Update user (admin actions like disable, role change)
// @access  Private (Admin only)
router.put('/users/:id', async (req, res) => {
  try {
    const { isActive, role, kycStatus } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;
    if (role && ['patient', 'donor', 'hospital', 'admin'].includes(role)) {
      updateData.role = role;
    }
    if (kycStatus && ['pending', 'approved', 'rejected'].includes(kycStatus)) {
      updateData['kyc.status'] = kycStatus;
      if (kycStatus === 'approved') {
        updateData['kyc.verifiedAt'] = new Date();
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-password');

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'admin_user_update',
      entityType: 'user',
      entityId: user._id,
      details: {
        targetUserEmail: user.email,
        updates: updateData,
      },
      status: 'success',
    });

    res.json({ message: 'User updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ error: `Failed to update user: ${error.message}` });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user (admin only)
// @access  Private (Admin only)
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting last admin
    if (user.role === 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin', isActive: true });
      if (adminCount <= 1 && user._id.toString() !== req.user.userId) {
        return res.status(400).json({
          error: 'Cannot delete the last active admin account'
        });
      }
    }

    // Soft delete - deactivate instead of hard delete
    user.isActive = false;
    user.updatedAt = new Date();
    await user.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'admin_user_deactivated',
      entityType: 'user',
      entityId: user._id,
      details: { targetUserEmail: user.email },
      status: 'success',
    });

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete user: ${error.message}` });
  }
});

// @route   GET /api/admin/audit-logs
// @desc    Get audit logs with filters
// @access  Private (Admin only)
router.get('/audit-logs', async (req, res) => {
  try {
    const {
      entityType,
      entityId,
      action,
      userId,
      startDate,
      endDate,
      limit = 100,
      page = 1,
    } = req.query;

    const filter = {};
    if (entityType) filter.entityType = entityType;
    if (entityId) filter.entityId = entityId;
    if (action) filter.action = action;
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const safeLimit = Math.min(500, Math.max(1, parseInt(limit)));
    const safePage = Math.max(1, parseInt(page));
    const skip = (safePage - 1) * safeLimit;

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .populate('userId', 'name email role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit),
    ]);

    res.json({
      auditLogs: logs,
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch audit logs: ${error.message}` });
  }
});

// @route   GET /api/admin/audit-logs/export
// @desc    Export audit logs for compliance (5-year retention)
// @access  Private (Admin only)
router.get('/audit-logs/export', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Default to last 5 years if no dates specified
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getFullYear() - 5, end.getMonth(), end.getDate());

    const logs = await AuditLog.find({
      createdAt: { $gte: start, $lte: end }
    }).sort({ createdAt: 1 });

    // Format for export
    const exportData = logs.map(log => ({
      timestamp: log.createdAt,
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      status: log.status,
      ipAddress: log.ipAddress,
      details: JSON.stringify(log.details),
    }));

    res.json({
      exportInfo: {
        startDate: start,
        endDate: end,
        totalRecords: exportData.length,
        exportedAt: new Date(),
      },
      data: exportData,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to export audit logs: ${error.message}` });
  }
});

// @route   GET /api/admin/contracts
// @desc    Get all deployed smart contracts
// @access  Private (Admin only)
router.get('/contracts', async (req, res) => {
  try {
    const contracts = await SmartContract.find()
      .populate({
        path: 'campaignId',
        select: 'title status patientId hospitalId'
      })
      .sort({ deployedAt: -1, _id: -1 });

    res.json({ contracts });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch contracts: ${error.message}` });
  }
});

// @route   GET /api/admin/campaigns/:id/documents/:docIndex
// @desc    View decrypted campaign documents (admin only)
// @access  Private (Admin only)
router.get('/campaigns/:id/documents/:docIndex', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const docIndex = parseInt(req.params.docIndex);
    if (!campaign.documents || docIndex >= campaign.documents.length) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = campaign.documents[docIndex];
    const filePath = path.join(__dirname, '../../', doc.url);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Document file not found' });
    }

    // Decrypt and serve the file
    const decryptedBuffer = decryptFile(filePath);
    const fileName = path.basename(doc.url);
    const contentType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(decryptedBuffer);
  } catch (error) {
    console.error('Document decryption error:', error);
    res.status(500).json({ error: `Failed to decrypt document: ${error.message}` });
  }
});

module.exports = router;
