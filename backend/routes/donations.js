const express = require('express');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { ethers } = require('ethers');
const { getContractInstance, refundDonationOnChain } = require('../utils/contractUtils');
const { sendDonationReceivedEmail, sendDonationConfirmationEmail, sendRefundEmail, sendEmail } = require('../utils/emailService');
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

// @route   POST /api/donations
// @desc    Create a donation (Donor only)
// @access  Private (Donor role)
router.post('/', authMiddleware, roleMiddleware(['donor']), async (req, res) => {
  try {
    const { campaignId, amount, transactionHash, donorMessage, anonymous } = req.body;

    // Validation
    if (!campaignId || !amount || !transactionHash) {
      return res.status(400).json({
        error: 'Campaign ID, amount, and transaction hash are required'
      });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    // Verify campaign exists and is active
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'active') {
      return res.status(400).json({
        error: `Cannot donate to campaign with status: ${campaign.status}`
      });
    }

    // Verify transaction on blockchain
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    let gasUsed = null;
    let blockNumber = null;

    try {
      // Wait for transaction to be mined
      const receipt = await provider.getTransactionReceipt(transactionHash);

      if (!receipt) {
        // Transaction might still be pending
        const tx = await provider.getTransaction(transactionHash);
        if (!tx) {
          return res.status(400).json({
            error: 'Transaction not found on blockchain. Please wait for confirmation.'
          });
        }
        // Transaction is pending - wait for it
        await provider.waitForTransaction(transactionHash);
      }

      // Get the final receipt
      const finalReceipt = await provider.getTransactionReceipt(transactionHash);

      if (!finalReceipt || finalReceipt.status === 0) {
        return res.status(400).json({
          error: 'Transaction failed on blockchain'
        });
      }

      // Verify transaction was to the correct contract
      if (campaign.smartContractAddress &&
          finalReceipt.to?.toLowerCase() !== campaign.smartContractAddress.toLowerCase()) {
        return res.status(400).json({
          error: 'Transaction was not sent to the correct campaign contract'
        });
      }

      // Get transaction details for deeper verification
      const txDetails = await provider.getTransaction(transactionHash);
      if (!txDetails) {
        return res.status(400).json({ error: 'Transaction details not found on blockchain' });
      }

      // Verify tx sender matches donor wallet address on record (prevents replay/claiming others tx)
      const donor = await User.findById(req.user.userId).select('walletAddress');
      if (!donor?.walletAddress) {
        return res.status(400).json({ error: 'Please link and verify your wallet before donating.' });
      }

      if ((txDetails.from || '').toLowerCase() !== donor.walletAddress.toLowerCase()) {
        return res.status(400).json({ error: 'Transaction sender does not match your linked wallet address' });
      }

      // Verify calldata is calling donate() on the escrow contract (not an arbitrary tx)
      if (campaign.smartContractAddress) {
        const iface = new ethers.Interface(['function donate() payable']);
        let parsed = null;
        try {
          parsed = iface.parseTransaction({ data: txDetails.data, value: txDetails.value });
        } catch (e) {
          return res.status(400).json({ error: 'Transaction data does not match donate() call' });
        }

        if (!parsed || parsed.name !== 'donate') {
          return res.status(400).json({ error: 'Transaction is not a donate() call' });
        }
      }

      // Verify value equals amount (tolerate minor float conversion by comparing wei)
      const expectedWei = ethers.parseEther(parseFloat(amount).toString());
      if (txDetails.value !== expectedWei) {
        return res.status(400).json({ error: 'Transaction value does not match declared donation amount' });
      }

      // Store additional blockchain info
      gasUsed = finalReceipt.gasUsed.toString();
      blockNumber = finalReceipt.blockNumber;

    } catch (txError) {
      console.error('Transaction verification error:', txError.message);
      return res.status(400).json({
        error: 'Failed to verify transaction: ' + txError.message
      });
    }

    // Create donation record
    const donation = await Donation.create({
      campaignId,
      donorId: req.user.userId,
      amount: parseFloat(amount),
      transactionHash,
      donorMessage: donorMessage || null,
      anonymous: anonymous || false,
      status: 'locked_in_escrow',
      gasUsed,
      blockNumber,
      escrowDetails: {
        contractAddress: campaign.smartContractAddress,
        escrowLockedAt: new Date(),
      },
    });

    // Update campaign raised amount
    campaign.raisedAmount += parseFloat(amount);
    await campaign.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'donation_created',
      entityType: 'donation',
      entityId: donation._id,
      details: {
        campaignId,
        amount: parseFloat(amount),
        transactionHash,
        campaignTitle: campaign.title,
      },
      status: 'success',
    });

    // Send email notifications
    const io = getIoInstance();

    // Send confirmation email to donor
    const donor = await User.findById(req.user.userId);
    if (donor?.email) {
      await sendDonationConfirmationEmail(
        donor.email,
        campaign.title,
        parseFloat(amount),
        transactionHash
      );
    }

    // Send notification email to campaign owner
    const campaignOwner = await User.findById(campaign.patientId);
    if (campaignOwner?.email) {
      await sendDonationReceivedEmail(
        campaignOwner.email,
        campaign.title,
        parseFloat(amount),
        donor.name
      );
    }

    // Emit socket events for real-time updates
    if (io) {
      // Emit to campaign room for anyone watching
      io.to(`campaign:${campaignId}`).emit('donation:received', {
        campaignId,
        donationId: donation._id,
        amount: parseFloat(amount),
        donorName: anonymous ? 'Anonymous' : (donor?.name || 'Anonymous'),
        createdAt: new Date(),
      });

      // Emit to campaign owner's user room
      if (campaign.patientId) {
        io.to(`user:${campaign.patientId.toString()}`).emit('donation:received', {
          campaignId,
          donationId: donation._id,
          amount: parseFloat(amount),
          donorName: anonymous ? 'Anonymous' : (donor?.name || 'Anonymous'),
          createdAt: new Date(),
        });
      }

      logger.info(`Emitted donation:received event for campaign ${campaignId}`);
    }

    res.status(201).json({
      message: 'Donation recorded successfully',
      donation,
    });
  } catch (error) {
    console.error('Donation error:', error);
    res.status(500).json({ error: `Failed to create donation: ${error.message}` });
  }
});

// @route   GET /api/donations
// @desc    Get donations (with optional filters)
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { campaignId, status, limit = 50 } = req.query;

    const filter = {};
    if (campaignId) filter.campaignId = campaignId;
    if (status) filter.status = status;

    // Donors can only see their own donations unless admin
    if (req.user.role !== 'admin') {
      filter.donorId = req.user.userId;
    }

    const donations = await Donation.find(filter)
      .populate('campaignId', 'title status')
      .populate('donorId', 'name email walletAddress')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({ donations });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch donations: ${error.message}` });
  }
});

// @route   GET /api/donations/:id
// @desc    Get single donation by ID
// @access  Private
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('campaignId', 'title status smartContractAddress')
      .populate('donorId', 'name email walletAddress');

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    // Check permission - donor can see their own, admin can see all
    if (req.user.role !== 'admin' && donation.donorId._id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to view this donation' });
    }

    res.json({ donation });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch donation: ${error.message}` });
  }
});

// @route   POST /api/donations/:id/refund
// @desc    Request refund for a donation
// @access  Private (Donor/Admin)
router.post('/:id/refund', authMiddleware, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate('donorId');

    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    // Check permission
    if (req.user.role !== 'admin' && donation.donorId._id.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to refund this donation' });
    }

    if (donation.status === 'released') {
      return res.status(400).json({
        error: 'Cannot refund - funds have already been released'
      });
    }

    if (donation.status === 'refunded') {
      return res.status(400).json({ error: 'Donation already refunded' });
    }

    const campaign = await Campaign.findById(donation.campaignId).populate('patientId');
    let onChainResult = null;

    // Trigger smart contract refund if applicable
    if (campaign && campaign.smartContractAddress && donation.transactionHash) {
      try {
        const donorUser = await User.findById(donation.donorId._id);

        if (!donorUser || !donorUser.walletAddress) {
          return res.status(400).json({ error: 'Donor wallet address not found for on-chain refund.' });
        }

        const amountInWei = ethers.parseEther(donation.amount.toString());

        onChainResult = await refundDonationOnChain(
          campaign.smartContractAddress,
          donorUser.walletAddress,
          amountInWei
        );
      } catch (contractError) {
        console.error('Smart contract refund error:', contractError);
        return res.status(500).json({ error: 'Failed to process on-chain refund: ' + contractError.message });
      }
    }

    // Update status in DB
    donation.status = 'refunded';
    donation.refundTxHash = onChainResult?.transactionHash || null;
    await donation.save();

    // Update campaign raised amount
    if (campaign) {
      campaign.raisedAmount -= donation.amount;
      await campaign.save();
    }

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'donation_refunded',
      entityType: 'donation',
      entityId: donation._id,
      details: { amount: donation.amount, reason: req.body.reason || 'user_requested' },
      status: 'success',
    });

    // Send refund confirmation email to donor
    const donor = await User.findById(donation.donorId._id);
    if (donor?.email) {
      await sendRefundEmail(
        donor.email,
        campaign?.title || 'Campaign',
        donation.amount,
        req.body.reason || null
      );
    }

    // Emit socket events for real-time update
    const io = getIoInstance();
    if (io) {
      io.to(`campaign:${campaign._id}`).emit('donation:refunded', {
        campaignId: campaign._id,
        donationId: donation._id,
        amount: donation.amount,
        refundedAt: new Date(),
      });

      // Emit to campaign owner's user room
      if (campaign.patientId) {
        io.to(`user:${campaign.patientId._id.toString()}`).emit('donation:refunded', {
          campaignId: campaign._id,
          donationId: donation._id,
          amount: donation.amount,
          refundedAt: new Date(),
        });
      }

      logger.info(`Emitted donation:refunded event for donation ${donation._id}`);
    }

    res.json({ message: 'Refund processed successfully', donation, onChainResult });
  } catch (error) {
    res.status(500).json({ error: `Failed to process refund: ${error.message}` });
  }
});

// @route   POST /api/donations/:id/admin-refund
// @desc    Admin-initiated refund for a donation
// @access  Private (Admin only)
router.post('/:id/admin-refund', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Reason for refund is required' });
    }

    const donation = await Donation.findById(req.params.id).populate('donorId');
    if (!donation) {
      return res.status(404).json({ error: 'Donation not found' });
    }

    if (donation.status === 'released') {
      return res.status(400).json({
        error: 'Cannot refund - funds have already been released'
      });
    }

    if (donation.status === 'refunded') {
      return res.status(400).json({ error: 'Donation already refunded' });
    }

    const campaign = await Campaign.findById(donation.campaignId).populate('patientId');
    let onChainResult = null;

    // Trigger smart contract refund if applicable
    if (campaign && campaign.smartContractAddress && donation.transactionHash) {
      try {
        const donorUser = await User.findById(donation.donorId._id);

        if (!donorUser || !donorUser.walletAddress) {
          return res.status(400).json({ error: 'Donor wallet address not found for on-chain refund.' });
        }

        const amountInWei = ethers.parseEther(donation.amount.toString());

        onChainResult = await refundDonationOnChain(
          campaign.smartContractAddress,
          donorUser.walletAddress,
          amountInWei
        );
      } catch (contractError) {
        console.error('Smart contract refund error:', contractError);
        return res.status(500).json({ error: 'Failed to process on-chain refund: ' + contractError.message });
      }
    }

    // Update status in DB
    donation.status = 'refunded';
    donation.refundTxHash = onChainResult?.transactionHash || null;
    donation.refundReason = reason;
    await donation.save();

    // Update campaign raised amount
    if (campaign) {
      campaign.raisedAmount -= donation.amount;
      await campaign.save();
    }

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'admin_donation_refunded',
      entityType: 'donation',
      entityId: donation._id,
      details: { amount: donation.amount, reason, adminId: req.user.userId },
      status: 'success',
    });

    // Send refund notification email to donor
    const donor = await User.findById(donation.donorId._id);
    if (donor?.email) {
      await sendRefundEmail(donor.email, campaign?.title || 'Campaign', donation.amount, reason);
    }

    // Notify campaign owner about admin refund
    if (campaign?.patientId?.email) {
      await sendEmail({
        to: campaign.patientId.email,
        subject: 'Donation Refunded by Admin - MedTrustFund',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Donation Refunded</h2>
            <p>An admin has processed a refund for your campaign <strong>"${campaign.title}"</strong>.</p>
            <div style="background-color: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 0;"><strong>Refund Amount:</strong> ${donation.amount} ETH</p>
              <p style="margin: 8px 0;"><strong>Reason:</strong> ${reason}</p>
            </div>
            <hr style="margin-top: 32px; border: none; border-top: 1px solid #eee;" />
            <p style="color: #666; font-size: 14px;">MedTrustFund</p>
          </div>
        `,
      });
    }

    // Emit socket events for real-time update
    const io = getIoInstance();
    if (io) {
      io.to(`campaign:${campaign._id}`).emit('donation:refunded', {
        campaignId: campaign._id,
        donationId: donation._id,
        amount: donation.amount,
        refundedAt: new Date(),
        isAdminInitiated: true,
      });

      if (campaign.patientId) {
        io.to(`user:${campaign.patientId._id.toString()}`).emit('donation:refunded', {
          campaignId: campaign._id,
          donationId: donation._id,
          amount: donation.amount,
          refundedAt: new Date(),
          isAdminInitiated: true,
        });
      }

      logger.info(`Emitted admin donation:refunded event for donation ${donation._id}`);
    }

    res.json({ message: 'Admin refund processed successfully', donation, onChainResult });
  } catch (error) {
    logger.error(`Admin refund error: ${error.message}`, error);
    res.status(500).json({ error: `Failed to process admin refund: ${error.message}` });
  }
});

// @route   GET /api/donations/campaign/:campaignId
// @desc    Get all donations for a specific campaign (public view)
// @access  Public
router.get('/campaign/:campaignId', async (req, res) => {
  try {
    const donations = await Donation.find({ campaignId: req.params.campaignId, anonymous: false })
      .populate('donorId', 'name')
      .select('-transactionHash -donorId') // Hide sensitive info for public view
      .sort({ createdAt: -1 });

    // Aggregate donor names for display
    const publicDonations = donations.map(d => ({
      id: d._id,
      amount: d.amount,
      donorName: d.donorId?.name || 'Anonymous',
      createdAt: d.createdAt,
      donorMessage: d.donorMessage,
    }));

    res.json({ donations: publicDonations });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch campaign donations: ${error.message}` });
  }
});

// @route   POST /api/donations/:campaignId/donate-direct
// @desc    Donate directly via smart contract (backend handles tx)
// @access  Private (Donor role)
router.post('/:campaignId/donate-direct', authMiddleware, roleMiddleware(['donor']), async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Valid donation amount is required' });
    }

    const campaign = await Campaign.findById(req.params.campaignId);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.status !== 'active') {
      return res.status(400).json({ error: 'Campaign is not active for donations' });
    }

    if (!campaign.smartContractAddress) {
      return res.status(400).json({
        error: 'Smart contract not deployed yet. Please wait for admin to deploy contract.'
      });
    }

    // Get contract instance
    const contract = getContractInstance(campaign.smartContractAddress);

    // Parse amount to wei
    const donationAmount = ethers.parseEther(amount.toString());

    console.log(`Processing donation of ${amount} ETH to campaign ${campaign._id}`);

    // Call donate function on smart contract
    const tx = await contract.donate({
      value: donationAmount,
    });

    console.log('Waiting for donation transaction to confirm...');
    const receipt = await tx.wait();

    console.log(`Donation confirmed in tx: ${receipt.hash}`);

    // Create donation record
    const donation = await Donation.create({
      campaignId: campaign._id,
      donorId: req.user.userId,
      amount: parseFloat(amount),
      transactionHash: receipt.hash,
      status: 'locked_in_escrow',
      gasUsed: receipt.gasUsed.toString(),
      blockNumber: receipt.blockNumber,
      escrowDetails: {
        contractAddress: campaign.smartContractAddress,
        escrowLockedAt: new Date(),
      },
    });

    // Update campaign raised amount
    campaign.raisedAmount += parseFloat(amount);
    await campaign.save();

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'donation_created',
      entityType: 'donation',
      entityId: donation._id,
      details: {
        campaignId: campaign._id,
        amount: parseFloat(amount),
        transactionHash: receipt.hash,
        campaignTitle: campaign.title,
      },
      status: 'success',
    });

    // Send email notifications
    const io = getIoInstance();

    // Send confirmation email to donor
    const donor = await User.findById(req.user.userId);
    if (donor?.email) {
      await sendDonationConfirmationEmail(
        donor.email,
        campaign.title,
        parseFloat(amount),
        receipt.hash
      );
    }

    // Send notification email to campaign owner
    const campaignOwner = await User.findById(campaign.patientId);
    if (campaignOwner?.email) {
      await sendDonationReceivedEmail(
        campaignOwner.email,
        campaign.title,
        parseFloat(amount),
        donor.name
      );
    }

    // Emit socket events for real-time updates
    if (io) {
      // Emit to campaign room for anyone watching
      io.to(`campaign:${campaign._id}`).emit('donation:received', {
        campaignId: campaign._id,
        donationId: donation._id,
        amount: parseFloat(amount),
        donorName: donor?.name || 'Anonymous',
        createdAt: new Date(),
      });

      // Emit to campaign owner's user room
      if (campaign.patientId) {
        io.to(`user:${campaign.patientId.toString()}`).emit('donation:received', {
          campaignId: campaign._id,
          donationId: donation._id,
          amount: parseFloat(amount),
          donorName: donor?.name || 'Anonymous',
          createdAt: new Date(),
        });
      }

      logger.info(`Emitted donation:received event for campaign ${campaign._id}`);
    }

    res.json({
      message: 'Donation successful!',
      donation,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });

  } catch (error) {
    console.error('Direct donation error:', error);

    if (error.message.includes('insufficient funds')) {
      return res.status(400).json({
        error: 'Insufficient funds in wallet for this donation',
      });
    }

    if (error.message.includes('user rejected')) {
      return res.status(400).json({
        error: 'Transaction was rejected by user',
      });
    }

    res.status(500).json({ error: `Failed to process donation: ${error.message}` });
  }
});

module.exports = router;
