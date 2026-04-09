const express = require('express');
const Campaign = require('../models/Campaign');
const Donation = require('../models/Donation');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

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
      return res.json({ role, stats: { ...stats, progress } });
    }

    if (role === 'donor') {
      const rows = await Donation.aggregate([
        { $match: { donorId: userId } },
        {
          $group: {
            _id: null,
            totalDonations: { $sum: 1 },
            amountDonated: { $sum: { $ifNull: ['$amount', 0] } },
          },
        },
      ]);

      const stats = rows[0] || { totalDonations: 0, amountDonated: 0 };
      return res.json({ role, stats });
    }

    if (role === 'hospital') {
      const rows = await Campaign.aggregate([
        { $match: { hospitalId: userId } },
        {
          $group: {
            _id: null,
            assignedCampaigns: { $sum: 1 },
            activeCampaigns: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            }
          }
        }
      ]);

      const stats = rows[0] || { assignedCampaigns: 0, activeCampaigns: 0 };
      return res.json({ role, stats });
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

module.exports = router;

