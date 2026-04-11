const express = require('express');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');
const SmartContract = require('../models/SmartContract');
const { authMiddleware } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// @route   GET /api/transactions
// @desc    Get all transactions for current user
// @access  Private (Authenticated users)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, status, limit = 50, sortBy = 'createdAt', order = 'desc' } = req.query;
    const userId = req.user.userId;

    // Build filter based on user role
    const filter = {};

    // Admins can see all transactions, others only their own
    if (req.user.role !== 'admin') {
      filter.donorId = userId;
    }

    // Apply type filter
    if (type && type !== 'all') {
      filter.type = type;
    }

    // Apply status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // Fetch donations
    const donations = await Donation.find(filter)
      .populate('campaignId', 'title')
      .populate('donorId', 'name email')
      .sort({ [sortBy]: order })
      .limit(parseInt(limit));

    // Map donations to transaction format
    const transactions = donations.map(d => ({
      _id: d._id,
      type: 'donation',
      amount: d.amount.toString(),
      currency: 'ETH',
      status: d.status,
      txHash: d.transactionHash,
      fromAddress: d.donorId?.walletAddress,
      campaignId: d.campaignId,
      createdAt: d.createdAt,
      confirmedAt: d.confirmedAt,
      blockNumber: d.blockNumber,
      gasUsed: d.gasUsed,
      description: `Donation to ${d.campaignId?.title || 'campaign'}`,
    }));

    // Fetch milestone releases (from SmartContract model)
    if (req.user.role === 'admin' || req.user.role === 'patient') {
      const patientFilter = req.user.role === 'patient'
        ? { patientAddress: req.user.walletAddress }
        : {};

      const contracts = await SmartContract.find(patientFilter)
        .populate({
          path: 'campaignId',
          select: 'title patientId'
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

      contracts.forEach(contract => {
        if (contract.milestones) {
          contract.milestones.forEach((milestone, idx) => {
            if (milestone.confirmed && milestone.releasedAt) {
              transactions.push({
                _id: `${contract._id}-milestone-${idx}`,
                type: 'milestone_release',
                amount: milestone.amount.toString(),
                currency: 'ETH',
                status: 'confirmed',
                txHash: contract.transactionHash,
                toAddress: contract.patientAddress,
                campaignId: contract.campaignId,
                createdAt: milestone.releasedAt,
                confirmedAt: milestone.releasedAt,
                blockNumber: contract.blockNumber,
                description: `Milestone release: ${milestone.description}`,
              });
            }
          });
        }
      });
    }

    // Fetch refunds (donations with refunded status)
    const refunds = await Donation.find({
      ...filter,
      status: 'refunded',
      donorId: req.user.role === 'admin' ? undefined : userId
    })
      .populate('campaignId', 'title')
      .populate('donorId', 'name email')
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit));

    refunds.forEach(r => {
      // Avoid duplicates if already in transactions
      const exists = transactions.find(t => t._id === r._id.toString());
      if (!exists) {
        transactions.push({
          _id: r._id,
          type: 'refund',
          amount: r.amount.toString(),
          currency: 'ETH',
          status: 'refunded',
          txHash: r.refundTxHash || r.transactionHash,
          fromAddress: r.campaignId?.smartContractAddress,
          toAddress: r.donorId?.walletAddress,
          campaignId: r.campaignId,
          createdAt: r.updatedAt,
          confirmedAt: r.updatedAt,
          description: `Refund for: ${r.campaignId?.title || 'campaign'}`,
        });
      }
    });

    // Sort all transactions by date
    transactions.sort((a, b) => {
      const dateA = new Date(a.createdAt);
      const dateB = new Date(b.createdAt);
      return order === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Apply limit after merging
    const limitedTransactions = transactions.slice(0, parseInt(limit));

    res.json({
      transactions: limitedTransactions,
      total: transactions.length,
    });
  } catch (error) {
    logger.error(`Transactions fetch error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch transactions: ${error.message}` });
  }
});

// @route   GET /api/transactions/:id
// @desc    Get single transaction details
// @access  Private (Authenticated users)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const transaction = await Donation.findById(req.params.id)
      .populate('campaignId', 'title smartContractAddress')
      .populate('donorId', 'name email walletAddress');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Check permission
    if (req.user.role !== 'admin' && transaction.donorId._id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to view this transaction' });
    }

    const txData = {
      _id: transaction._id,
      type: 'donation',
      amount: transaction.amount.toString(),
      currency: 'ETH',
      status: transaction.status,
      txHash: transaction.transactionHash,
      fromAddress: transaction.donorId?.walletAddress,
      toAddress: transaction.campaignId?.smartContractAddress,
      campaignId: transaction.campaignId,
      createdAt: transaction.createdAt,
      confirmedAt: transaction.confirmedAt,
      blockNumber: transaction.blockNumber,
      gasUsed: transaction.gasUsed,
      description: `Donation to ${transaction.campaignId?.title || 'campaign'}`,
    };

    res.json({ transaction: txData });
  } catch (error) {
    logger.error(`Transaction details fetch error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to fetch transaction: ${error.message}` });
  }
});

// @route   GET /api/transactions/export
// @desc    Export transactions as CSV
// @access  Private (Authenticated users)
router.get('/export/csv', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const filter = req.user.role !== 'admin' ? { donorId: userId } : {};

    const donations = await Donation.find(filter)
      .populate('campaignId', 'title')
      .populate('donorId', 'name email')
      .sort({ createdAt: -1 });

    // CSV header
    const headers = ['Date', 'Type', 'Amount', 'Currency', 'Status', 'TX Hash', 'Description', 'Campaign'];

    // CSV rows
    const rows = donations.map(d => [
      new Date(d.createdAt).toLocaleDateString(),
      'donation',
      d.amount,
      'ETH',
      d.status,
      d.transactionHash || 'N/A',
      `Donation to ${d.campaignId?.title || 'campaign'}`,
      d.campaignId?.title || 'N/A',
    ]);

    // Build CSV content
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=transactions-${new Date().toISOString().split('T')[0]}.csv`);

    res.send(csvContent);
  } catch (error) {
    logger.error(`CSV export error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to export transactions: ${error.message}` });
  }
});

module.exports = router;
