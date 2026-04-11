const express = require('express');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const User = require('../models/User');
const SmartContract = require('../models/SmartContract');
const { authMiddleware } = require('../middleware/auth');
const { getIO } = require('../utils/socket');
const logger = require('../utils/logger');

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

// @route   GET /api/analytics/me
// @desc    Get role-scoped analytics for current user
// @access  Private
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const role = req.user.role;

    if (role === 'patient') {
      const rows = await Campaign.aggregate([
        { $match: { patientId: userId } },
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            activeCampaigns: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
            amountRaised: { $sum: { $ifNull: ['$raisedAmount', 0] } },
            targetAmount: { $sum: { $ifNull: ['$targetAmount', 0] } },
          },
        },
      ]);

      const stats = rows[0] || {
        totalCampaigns: 0,
        activeCampaigns: 0,
        amountRaised: 0,
        targetAmount: 0,
      };

      const progress = stats.targetAmount > 0 ? (stats.amountRaised / stats.targetAmount) * 100 : 0;

      const campaignList = await Campaign.find({ patientId: userId })
        .select('title raisedAmount targetAmount status')
        .sort({ updatedAt: -1 })
        .limit(12)
        .lean();

      const byCampaign = campaignList.map((c) => ({
        title: c.title,
        raisedAmount: c.raisedAmount || 0,
        targetAmount: c.targetAmount || 0,
        progress: c.targetAmount > 0 ? ((c.raisedAmount || 0) / c.targetAmount) * 100 : 0,
        status: c.status,
      }));

      const campaignIds = campaignList.map((c) => c._id);
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      let monthlyInflow = [];
      if (campaignIds.length) {
        monthlyInflow = await Donation.aggregate([
          {
            $match: {
              campaignId: { $in: campaignIds },
              createdAt: { $gte: sixMonthsAgo },
            },
          },
          {
            $group: {
              _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
              amount: { $sum: { $ifNull: ['$amount', 0] } },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.y': 1, '_id.m': 1 } },
        ]);
      }

      return res.json({
        role,
        stats: { ...stats, progress },
        charts: {
          byCampaign,
          monthlyInflow: monthlyInflow.map((x) => ({
            year: x._id.y,
            month: x._id.m,
            amount: x.amount,
            count: x.count,
          })),
        },
      });
    }

    if (role === 'donor') {
      const oid = new mongoose.Types.ObjectId(userId);
      const rows = await Donation.aggregate([
        { $match: { donorId: oid } },
        {
          $group: {
            _id: null,
            totalDonations: { $sum: 1 },
            amountDonated: { $sum: { $ifNull: ['$amount', 0] } },
          },
        },
      ]);

      const stats = rows[0] || { totalDonations: 0, amountDonated: 0 };

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const monthlyGiving = await Donation.aggregate([
        { $match: { donorId: oid, createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } },
            amount: { $sum: { $ifNull: ['$amount', 0] } },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]);

      const topSupported = await Donation.aggregate([
        { $match: { donorId: oid } },
        {
          $group: {
            _id: '$campaignId',
            totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
            donations: { $sum: 1 },
          },
        },
        { $sort: { totalAmount: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: 'campaigns',
            localField: '_id',
            foreignField: '_id',
            as: 'campaign',
          },
        },
        { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: true } },
      ]);

      return res.json({
        role,
        stats,
        charts: {
          monthlyGiving: monthlyGiving.map((x) => ({
            year: x._id.y,
            month: x._id.m,
            amount: x.amount,
            count: x.count,
          })),
          topSupported: topSupported.map((x) => ({
            title: x.campaign?.title || 'Campaign',
            totalAmount: x.totalAmount,
            donations: x.donations,
          })),
        },
      });
    }

    if (role === 'hospital') {
      const rows = await Campaign.aggregate([
        { $match: { hospitalId: userId } },
        {
          $group: {
            _id: null,
            assignedCampaigns: { $sum: 1 },
            activeCampaigns: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
          },
        },
      ]);

      const stats = rows[0] || { assignedCampaigns: 0, activeCampaigns: 0 };

      const assignedList = await Campaign.find({ hospitalId: userId })
        .select('title raisedAmount targetAmount status')
        .sort({ updatedAt: -1 })
        .limit(10)
        .lean();

      return res.json({
        role,
        stats,
        charts: {
          assignedCampaigns: assignedList.map((c) => ({
            title: c.title,
            raisedAmount: c.raisedAmount || 0,
            targetAmount: c.targetAmount || 0,
            status: c.status,
          })),
        },
      });
    }

    // Admin: high-level platform stats
    const [campaignRows, donationRows] = await Promise.all([
      Campaign.aggregate([
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            activeCampaigns: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] },
            },
            totalRaised: { $sum: { $ifNull: ['$raisedAmount', 0] } },
          },
        },
      ]),
      Donation.aggregate([
        {
          $group: {
            _id: null,
            totalDonations: { $sum: 1 },
            totalDonated: { $sum: { $ifNull: ['$amount', 0] } },
          },
        },
      ]),
    ]);

    const campaignStats = campaignRows[0] || { totalCampaigns: 0, activeCampaigns: 0, totalRaised: 0 };
    const donationStats = donationRows[0] || { totalDonations: 0, totalDonated: 0 };

    return res.json({
      role,
      stats: {
        ...campaignStats,
        ...donationStats,
      },
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch analytics: ${error.message}` });
  }
});

// @route   GET /api/analytics/platform
// @desc    Get comprehensive platform-wide analytics
// @access  Private (Admin only)
router.get('/platform', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Get campaign statistics
    const campaignStats = await Campaign.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRaised: { $sum: { $ifNull: ['$raisedAmount', 0] } },
          totalTarget: { $sum: { $ifNull: ['$targetAmount', 0] } },
        },
      },
    ]);

    // Get donation statistics
    const donationStats = await Donation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
        },
      },
    ]);

    // Get user statistics by role
    const userStats = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 },
        },
      },
    ]);

    // Get total donations over time (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const donationTrend = await Donation.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get top campaigns
    const topCampaigns = await Campaign.find()
      .sort({ raisedAmount: -1 })
      .limit(5)
      .populate('patientId', 'name')
      .select('title raisedAmount targetAmount status');

    // Format statistics
    const formattedCampaignStats = {};
    campaignStats.forEach(stat => {
      formattedCampaignStats[stat._id] = {
        count: stat.count,
        totalRaised: stat.totalRaised,
        totalTarget: stat.totalTarget,
        progressPercent: stat.totalTarget > 0 ? ((stat.totalRaised / stat.totalTarget) * 100).toFixed(2) : 0,
      };
    });

    const formattedDonationStats = {};
    donationStats.forEach(stat => {
      formattedDonationStats[stat._id] = {
        count: stat.count,
        totalAmount: stat.totalAmount,
      };
    });

    const formattedUserStats = {};
    userStats.forEach(stat => {
      formattedUserStats[stat._id] = stat.count;
    });

    res.json({
      campaigns: formattedCampaignStats,
      donations: formattedDonationStats,
      users: formattedUserStats,
      donationTrend,
      topCampaigns,
      summary: {
        totalCampaigns: campaignStats.reduce((sum, s) => sum + s.count, 0),
        totalDonations: donationStats.reduce((sum, s) => sum + s.count, 0),
        totalUsers: userStats.reduce((sum, s) => sum + s.count, 0),
        totalRaised: campaignStats.reduce((sum, s) => sum + s.totalRaised, 0),
      },
    });
  } catch (error) {
    logger.error(`Platform analytics error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch platform analytics: ${error.message}` });
  }
});

// @route   GET /api/analytics/campaign/:id
// @desc    Get detailed analytics for a specific campaign
// @access  Public
router.get('/campaign/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('patientId', 'name')
      .populate('hospitalId', 'hospitalName');

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get donation statistics for this campaign
    const donationStats = await Donation.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: null,
          totalDonations: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgDonation: { $avg: '$amount' },
          maxDonation: { $max: '$amount' },
          minDonation: { $min: '$amount' },
        },
      },
    ]);

    // Get donations by status
    const donationsByStatus = await Donation.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]);

    // Get donation trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const donationTrend = await Donation.aggregate([
      { $match: { campaignId: campaign._id, createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get top donors
    const topDonors = await Donation.aggregate([
      { $match: { campaignId: campaign._id } },
      {
        $group: {
          _id: '$donorId',
          totalDonated: { $sum: '$amount' },
          donationCount: { $sum: 1 },
        },
      },
      { $sort: { totalDonated: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'donor',
        },
      },
      { $unwind: '$donor' },
      { $project: { donorId: '$_id', totalDonated: 1, donationCount: 1, donorName: '$donor.name' } },
    ]);

    res.json({
      campaign: {
        title: campaign.title,
        raisedAmount: campaign.raisedAmount,
        targetAmount: campaign.targetAmount,
        progressPercent: ((campaign.raisedAmount / campaign.targetAmount) * 100).toFixed(2),
        status: campaign.status,
      },
      donationStats: donationStats[0] || { totalDonations: 0, totalAmount: 0, avgDonation: 0, maxDonation: 0, minDonation: 0 },
      donationsByStatus,
      donationTrend,
      topDonors,
    });
  } catch (error) {
    logger.error(`Campaign analytics error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch campaign analytics: ${error.message}` });
  }
});

// @route   GET /api/analytics/donor/:id
// @desc    Get analytics for a specific donor
// @access  Private (Admin or self)
router.get('/donor/:id', authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    const isSelf = req.user.userId === targetId;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this data' });
    }

    // Get donor statistics
    const donationStats = await Donation.aggregate([
      { $match: { donorId: targetId } },
      {
        $group: {
          _id: null,
          totalDonations: { $sum: 1 },
          totalDonated: { $sum: '$amount' },
          avgDonation: { $avg: '$amount' },
        },
      },
    ]);

    // Get donations by campaign
    const donationsByCampaign = await Donation.aggregate([
      { $match: { donorId: targetId } },
      {
        $group: {
          _id: '$campaignId',
          totalDonated: { $sum: '$amount' },
          donationCount: { $sum: 1 },
        },
      },
      { $sort: { totalDonated: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'campaigns',
          localField: '_id',
          foreignField: '_id',
          as: 'campaign',
        },
      },
      { $unwind: '$campaign' },
      { $project: { campaignId: '$_id', totalDonated: 1, donationCount: 1, campaignTitle: '$campaign.title' } },
    ]);

    // Get donation history
    const donationHistory = await Donation.find({ donorId: targetId })
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({
      donorStats: donationStats[0] || { totalDonations: 0, totalDonated: 0, avgDonation: 0 },
      donationsByCampaign,
      donationHistory,
    });
  } catch (error) {
    logger.error(`Donor analytics error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch donor analytics: ${error.message}` });
  }
});

// @route   POST /api/analytics/emit-update
// @desc    Emit analytics update event (for internal use)
// @access  Private (Admin only)
router.post('/emit-update', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const io = getIoInstance();
    if (io) {
      io.emit('analytics:updated', {
        timestamp: new Date(),
        triggeredBy: req.user.userId,
      });
      logger.info('Emitted analytics:updated event');
    }

    res.json({ message: 'Analytics update event emitted' });
  } catch (error) {
    logger.error(`Emit analytics update error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to emit analytics update: ${error.message}` });
  }
});

module.exports = router;

