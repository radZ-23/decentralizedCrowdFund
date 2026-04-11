const express = require('express');
const mongoose = require('mongoose');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');
const SmartContract = require('../models/SmartContract');
const AuditLog = require('../models/AuditLog');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

function donationFilterForRole(userId, userRole) {
  if (userRole === 'donor') {
    return Promise.resolve({ donationFilter: { donorId: userId }, campaignIds: null });
  }
  if (userRole === 'patient') {
    return Campaign.find({ patientId: userId })
      .select('_id')
      .then((rows) => ({
        donationFilter: { campaignId: { $in: rows.map((c) => c._id) } },
        campaignIds: rows.map((c) => c._id),
      }));
  }
  if (userRole === 'hospital') {
    return Campaign.find({ hospitalId: userId })
      .select('_id')
      .then((rows) => ({
        donationFilter: { campaignId: { $in: rows.map((c) => c._id) } },
        campaignIds: rows.map((c) => c._id),
      }));
  }
  if (userRole === 'admin') {
    return Promise.resolve({ donationFilter: {}, campaignIds: null });
  }
  return Promise.resolve({ donationFilter: { donorId: userId }, campaignIds: null });
}

function mapDonationStatusToUi(status) {
  if (status === 'pending') return 'pending';
  if (status === 'refunded') return 'confirmed';
  return 'confirmed';
}

function mapDonationToTransaction(d) {
  const isRefund = d.status === 'refunded';
  return {
    _id: d._id,
    type: isRefund ? 'refund' : 'donation',
    amount: d.amount,
    currency: d.currency || 'ETH',
    status: mapDonationStatusToUi(d.status),
    txHash: isRefund ? d.refundTxHash || d.transactionHash : d.transactionHash,
    refundTxHash: d.refundTxHash,
    campaignId: d.campaignId,
    donorId: d.donorId,
    donorName: d.anonymous ? 'Anonymous' : d.donorId?.name || 'Anonymous',
    createdAt: d.createdAt,
    confirmedAt: d.confirmedAt || d.createdAt,
    description: isRefund
      ? `Refund for ${d.campaignId?.title || 'campaign'}`
      : `Donation to ${d.campaignId?.title || 'campaign'}`,
    donorMessage: d.donorMessage,
    escrowDetails: d.escrowDetails,
  };
}

// @route   GET /api/transactions
// @desc    Get unified transactions (donations, refunds, milestone releases)
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, status, limit = 50, campaignId } = req.query;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const { donationFilter, campaignIds } = await donationFilterForRole(userId, userRole);

    let dFilter = { ...donationFilter };
    if (campaignId) {
      dFilter.campaignId = campaignId;
    }

    const donations = await Donation.find(dFilter)
      .populate('campaignId', 'title status smartContractAddress patientId')
      .populate('donorId', 'name email walletAddress')
      .sort({ createdAt: -1 })
      .limit(500);

    let unified = donations.map(mapDonationToTransaction);

    let releaseCampaignIds = campaignIds;
    if (userRole === 'donor') {
      const ids = [...new Set(donations.map((d) => d.campaignId?._id?.toString()).filter(Boolean))];
      releaseCampaignIds = ids.map((id) => new mongoose.Types.ObjectId(id));
    }

    let logs = [];
    if (userRole === 'admin') {
      logs = await AuditLog.find({ action: 'funds_released' })
        .sort({ createdAt: -1 })
        .limit(200);
    } else if (releaseCampaignIds && releaseCampaignIds.length > 0) {
      logs = await AuditLog.find({
        action: 'funds_released',
        entityId: { $in: releaseCampaignIds },
      })
        .sort({ createdAt: -1 })
        .limit(200);
    }

    if (logs.length > 0) {

      const campaignsById = {};
      for (const d of donations) {
        if (d.campaignId?._id) campaignsById[d.campaignId._id.toString()] = d.campaignId;
      }
      const extraIds = [...new Set(logs.map((l) => l.entityId?.toString()).filter(Boolean))];
      const missing = extraIds.filter((id) => !campaignsById[id]);
      if (missing.length) {
        const camps = await Campaign.find({ _id: { $in: missing } }).select('title status smartContractAddress patientId');
        camps.forEach((c) => {
          campaignsById[c._id.toString()] = c;
        });
      }

      for (const log of logs) {
        const cid = log.entityId?.toString();
        const camp = campaignsById[cid];
        unified.push({
          _id: `milestone_${log._id}`,
          type: 'milestone_release',
          amount: log.details?.amount ?? 0,
          currency: 'ETH',
          status: 'confirmed',
          txHash: log.details?.transactionHash,
          campaignId: camp || { _id: log.entityId, title: 'Campaign' },
          donorId: undefined,
          donorName: undefined,
          createdAt: log.createdAt,
          confirmedAt: log.createdAt,
          description: log.details?.milestoneDescription
            ? `Milestone release: ${log.details.milestoneDescription}`
            : 'Milestone funds released',
        });
      }
    }

    unified.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (type && type !== 'all') {
      unified = unified.filter((t) => t.type === type);
    }
    if (status && status !== 'all') {
      unified = unified.filter((t) => t.status === status);
    }

    const totalFiltered = unified.length;
    const totalAmount = unified
      .filter((t) => t.type === 'donation' || t.type === 'milestone_release')
      .reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const lim = parseInt(limit, 10);
    const page = unified.slice(0, lim);

    res.json({
      transactions: page,
      pagination: {
        total: totalFiltered,
        limit: lim,
        showing: page.length,
      },
      summary: {
        totalTransactions: totalFiltered,
        totalAmount,
      },
    });
  } catch (error) {
    logger.error(`Transactions fetch error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch transactions: ${error.message}` });
  }
});

// @route   GET /api/transactions/export/csv
// @desc    Export transactions as CSV
// @access  Private
router.get('/export/csv', authMiddleware, async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    const userId = req.user.userId;
    const userRole = req.user.role;

    const { donationFilter } = await donationFilterForRole(userId, userRole);
    let filter = { ...donationFilter };

    if (userRole === 'admin') {
      if (startDate) {
        filter.createdAt = { $gte: new Date(startDate) };
      }
      if (endDate) {
        filter.createdAt = filter.createdAt || {};
        filter.createdAt.$lte = new Date(endDate);
      }
    }

    if (status) {
      filter.status = status;
    }

    const donations = await Donation.find(filter)
      .populate('campaignId', 'title')
      .populate('donorId', 'name')
      .sort({ createdAt: -1 })
      .limit(1000);

    const csvRows = [];
    csvRows.push('Date,Type,Amount,Currency,Status,Transaction Hash,Donor,Campaign,Refund Tx Hash');

    donations.forEach((d) => {
      const row = [
        d.createdAt.toISOString().split('T')[0],
        d.status === 'refunded' ? 'refund' : 'donation',
        d.amount,
        d.currency || 'ETH',
        d.status,
        d.transactionHash || '',
        d.anonymous ? 'Anonymous' : d.donorId?.name || 'Unknown',
        d.campaignId?.title || 'Unknown',
        d.refundTxHash || '',
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="transactions_${new Date().toISOString().split('T')[0]}.csv"`,
    );
    res.send(csvContent);
  } catch (error) {
    logger.error(`CSV export error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to export transactions: ${error.message}` });
  }
});

// @route   GET /api/transactions/summary
// @desc    Get transaction summary statistics
// @access  Private
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    const { donationFilter } = await donationFilterForRole(userId, userRole);

    const summary = await Donation.aggregate([
      { $match: donationFilter },
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
          avgAmount: { $avg: '$amount' },
          maxAmount: { $max: '$amount' },
          minAmount: { $min: '$amount' },
        },
      },
    ]);

    const byStatus = await Donation.aggregate([
      { $match: donationFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
        },
      },
    ]);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyTrend = await Donation.aggregate([
      { $match: { createdAt: { $gte: sixMonthsAgo }, ...donationFilter } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
          },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.json({
      summary: summary[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        avgAmount: 0,
        maxAmount: 0,
        minAmount: 0,
      },
      byStatus: byStatus.reduce((acc, s) => {
        acc[s._id] = { count: s.count, totalAmount: s.totalAmount };
        return acc;
      }, {}),
      monthlyTrend: monthlyTrend.map((m) => ({
        month: m._id.month,
        year: m._id.year,
        count: m.count,
        amount: m.amount,
      })),
    });
  } catch (error) {
    logger.error(`Transaction summary error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch transaction summary: ${error.message}` });
  }
});

// @route   GET /api/transactions/:id
// @desc    Get single transaction details
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('campaignId', 'title status smartContractAddress patientId')
      .populate('donorId', 'name email walletAddress');

    if (!donation) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const userRole = req.user.role;
    const isDonor = donation.donorId?._id.toString() === req.user.userId;
    const isCampaignOwner = donation.campaignId?.patientId?.toString() === req.user.userId;
    const isAdmin = userRole === 'admin';

    if (!isDonor && !isCampaignOwner && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this transaction' });
    }

    let smartContract = null;
    if (donation.campaignId?.smartContractAddress) {
      smartContract = await SmartContract.findOne({
        contractAddress: donation.campaignId.smartContractAddress,
      });
    }

    const isRefund = donation.status === 'refunded';
    const transaction = {
      _id: donation._id,
      type: isRefund ? 'refund' : 'donation',
      amount: donation.amount,
      currency: donation.currency || 'ETH',
      status: mapDonationStatusToUi(donation.status),
      txHash: isRefund ? donation.refundTxHash || donation.transactionHash : donation.transactionHash,
      refundTxHash: donation.refundTxHash,
      refundReason: donation.refundReason,
      refundedAt: donation.refundedAt,
      campaignId: donation.campaignId,
      donorId: donation.donorId,
      donorName: donation.anonymous ? 'Anonymous' : donation.donorId?.name || 'Anonymous',
      createdAt: donation.createdAt,
      blockNumber: donation.blockNumber,
      gasUsed: donation.gasUsed,
      description: isRefund
        ? `Refund for ${donation.campaignId?.title || 'campaign'}`
        : `Donation to ${donation.campaignId?.title || 'campaign'}`,
      donorMessage: donation.donorMessage,
      escrowDetails: donation.escrowDetails,
      smartContract,
    };

    res.json({ transaction });
  } catch (error) {
    logger.error(`Transaction details fetch error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch transaction details: ${error.message}` });
  }
});

module.exports = router;
