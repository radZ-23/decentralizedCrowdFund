const express = require('express');
const Campaign = require('../models/Campaign');
const RiskAssessment = require('../models/RiskAssessment');
const Donation = require('../models/Donation');
const AuditLog = require('../models/AuditLog');
const SmartContract = require('../models/SmartContract');
const User = require('../models/User');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const { ethers } = require('ethers');
const axios = require('axios');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  deployEscrowContract,
  getContractInstance,
  confirmMilestoneOnChain,
  releaseMilestoneOnChain,
  getContractBalance,
} = require('../utils/contractUtils');
const { encryptFile } = require('../utils/encryption');
const { sendCampaignApprovalEmail, sendCampaignRejectionEmail } = require('../utils/emailService');
const logger = require('../utils/logger');
const { getIO } = require('../utils/socket');

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

// File upload configuration
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF are allowed.'));
    }
  },
});

// @route   POST /api/campaigns
// @desc    Create a new campaign (Patient only)
// @access  Private (Patient role)
router.post('/', authMiddleware, roleMiddleware(['patient']), upload.array('documents', 5), async (req, res) => {
  try {
    const { title, description, targetAmount, hospitalId, medicalDetails, milestones } = req.body;

    // Validation
    if (!title || !description || !targetAmount) {
      return res.status(400).json({ error: 'Title, description, and target amount are required' });
    }

    if (parseFloat(targetAmount) <= 0) {
      return res.status(400).json({ error: 'Target amount must be greater than 0' });
    }

    // Process uploaded documents
    const documents = [];
    const documentTypes = JSON.parse(req.body.documentTypes || '[]');

    for (let i = 0; i < req.files.length && i < documentTypes.length; i++) {
      const file = req.files[i];
      const fileBuffer = fs.readFileSync(file.path);
      const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      documents.push({
        type: documentTypes[i],
        url: `/uploads/${file.filename}`,
        hash: fileHash,
        uploadedAt: new Date(),
      });
    }

    // Send documents to AI service for verification
    let riskAssessmentId = null;
    let campaignStatus = 'pending_verification';

    let hospitalVerified = false;
    if (hospitalId) {
      const hospitalUser = await User.findById(hospitalId);
      if (hospitalUser && hospitalUser.verified) {
        hospitalVerified = true;
      }
    }

    if (req.files.length > 0) {
      try {
        const FormData = require('form-data');
        const aiForm = new FormData();
        req.files.forEach((file) => {
          aiForm.append('files', fs.createReadStream(file.path));
        });
        aiForm.append('hospital_verified', hospitalVerified ? 'true' : 'false');

        const aiRes = await axios.post('http://localhost:8001/verify', aiForm, {
          headers: aiForm.getHeaders(),
          timeout: 45000, // 45 second timeout per NFR-1
        });

        // AI service returns { risk_scores: { final_risk_score, ... }, verdict, ... }
        const riskScore =
          aiRes.data?.riskScore ??
          aiRes.data?.risk_scores?.final_risk_score ??
          aiRes.data?.risk_scores?.final_risk ??
          aiRes.data?.risk_scores?.final ??
          aiRes.data?.risk_scores?.finalRiskScore;
        const verdict = aiRes.data?.verdict;

        if (typeof riskScore !== 'number') {
          throw new Error('AI verification returned unexpected payload (missing final risk score).');
        }

        // Determine risk category and recommendation
        let riskCategory, recommendation, manualReviewRequired;

        if (riskScore < 40) {
          riskCategory = 'low';
          recommendation = 'approve';
          manualReviewRequired = false;
          campaignStatus = 'active'; // Auto-approve low risk
        } else if (riskScore < 70) {
          riskCategory = 'medium';
          recommendation = 'escalate';
          manualReviewRequired = false;
          campaignStatus = 'active'; // Medium risk shows advisory
        } else {
          riskCategory = 'high';
          recommendation = 'escalate';
          manualReviewRequired = true;
          campaignStatus = 'pending_verification'; // High risk needs admin review
        }

        // Create risk assessment
        const riskAssessment = await RiskAssessment.create({
          campaignId: null, // Will be updated after campaign creation
          riskScore,
          riskCategory,
          recommendation,
          manualReviewRequired,
          aiVerificationDetails: {
            keywordMatch: 100 - (riskScore * 0.4), // Approximate mapping
            fileIntegrityScore: 100 - (riskScore * 0.3),
          },
          documentAnalysis: req.files.map((f, i) => ({
            documentType: documentTypes[i],
            fileHash: documents[i].hash,
            fileSize: f.size,
            processingTime: aiRes.data.details ? aiRes.data.details.length * 0.5 : 5,
          })),
        });

        riskAssessmentId = riskAssessment._id;

        // Create audit log for AI verification
        await AuditLog.create({
          userId: req.user.userId,
          action: 'ai_verification_completed',
          entityType: 'risk_assessment',
          entityId: riskAssessment._id,
          details: { riskScore, riskCategory, verdict },
          status: 'success',
        });

      } catch (aiError) {
        console.error('AI verification error:', aiError.message);
        // Continue with campaign creation but mark for manual review
        campaignStatus = 'pending_verification';
      }
    }

    // Parse milestones if provided
    const parsedMilestones = milestones ? JSON.parse(milestones) : [];

    // Create campaign
    const campaign = await Campaign.create({
      title,
      description,
      patientId: req.user.userId,
      hospitalId: hospitalId || null,
      targetAmount: parseFloat(targetAmount),
      raisedAmount: 0,
      status: campaignStatus,
      documents,
      riskAssessmentId,
      medicalDetails: medicalDetails ? JSON.parse(medicalDetails) : {},
      milestones: parsedMilestones.map((m) => ({
        ...m,
        status: 'pending',
      })),
    });

    // Update risk assessment with campaign ID
    if (riskAssessmentId) {
      await RiskAssessment.findByIdAndUpdate(riskAssessmentId, {
        campaignId: campaign._id,
      });
    }

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'campaign_created',
      entityType: 'campaign',
      entityId: campaign._id,
      details: { title, status: campaignStatus },
      status: 'success',
    });

    // Emit socket event for real-time update
    const io = getIoInstance();
    if (io) {
      io.emit('campaign:created', {
        campaignId: campaign._id,
        title,
        status: campaignStatus,
        patientId: req.user.userId,
        createdAt: new Date(),
      });
      logger.info(`Emitted campaign:created event for campaign ${campaign._id}`);
    }

    // Encrypt uploaded files at rest (HIPAA requirement)
    req.files.forEach((file) => {
      try {
        encryptFile(file.path);
      } catch (encErr) {
        console.error('File encryption error:', encErr.message);
      }
    });

    res.status(201).json({
      message: 'Campaign created successfully',
      campaign,
    });
  } catch (error) {
    console.error('Campaign creation error:', error);

    // Clean up files on error
    if (req.files) {
      req.files.forEach((file) => {
        try { fs.unlinkSync(file.path); } catch (e) {}
      });
    }

    res.status(500).json({ error: `Failed to create campaign: ${error.message}` });
  }
});

// @route   GET /api/campaigns
// @desc    Get all campaigns (with optional filters)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, patientId, limit = 50, sortBy = 'createdAt', order = 'desc' } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (patientId) filter.patientId = patientId;

    const campaigns = await Campaign.find(filter)
      .populate('patientId', 'name email walletAddress')
      .populate('hospitalId', 'name email hospitalName verified')
      .populate('riskAssessmentId')
      .sort({ [sortBy]: order })
      .limit(parseInt(limit));

    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch campaigns: ${error.message}` });
  }
});

// @route   GET /api/campaigns/:id
// @desc    Get single campaign by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('patientId', 'name email walletAddress profile')
      .populate('hospitalId', 'name email hospitalName verified walletAddress')
      .populate('riskAssessmentId');

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ campaign });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch campaign: ${error.message}` });
  }
});

// @route   PUT /api/campaigns/:id
// @desc    Update campaign (Patient or Admin only)
// @access  Private (Patient/Admin)
router.put('/:id', authMiddleware, roleMiddleware(['patient', 'admin']), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check permission - only patient who created it or admin can update
    if (req.user.role !== 'admin' && campaign.patientId.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'Not authorized to update this campaign' });
    }

    const { title, description, targetAmount, medicalDetails, milestones } = req.body;

    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (targetAmount) updateData.targetAmount = parseFloat(targetAmount);
    if (medicalDetails) updateData['medicalDetails'] = JSON.parse(medicalDetails);
    if (milestones) updateData.milestones = JSON.parse(milestones);
    updateData.updatedAt = new Date();

    const updatedCampaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'campaign_updated',
      entityType: 'campaign',
      entityId: campaign._id,
      details: { updates: Object.keys(updateData).join(',') },
      status: 'success',
    });

    res.json({
      message: 'Campaign updated successfully',
      campaign: updatedCampaign,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to update campaign: ${error.message}` });
  }
});

// @route   DELETE /api/campaigns/:id
// @desc    Delete campaign (Admin only or Patient if no donations)
// @access  Private (Admin/Patient)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Check permission
    if (req.user.role !== 'admin') {
      if (campaign.patientId.toString() !== req.user.userId) {
        return res.status(403).json({ error: 'Not authorized to delete this campaign' });
      }

      // Patient can only delete if no donations received
      const donationCount = await Donation.countDocuments({ campaignId: campaign._id });
      if (donationCount > 0) {
        return res.status(400).json({
          error: 'Cannot delete campaign with existing donations. Contact admin.'
        });
      }
    }

    // Delete related risk assessment
    if (campaign.riskAssessmentId) {
      await RiskAssessment.findByIdAndDelete(campaign.riskAssessmentId);
    }

    // Delete related donations
    await Donation.deleteMany({ campaignId: campaign._id });

    // Delete campaign
    await Campaign.findByIdAndDelete(campaign._id);

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'campaign_deleted',
      entityType: 'campaign',
      entityId: campaign._id,
      details: { title: campaign.title, reason: req.user.role === 'admin' ? 'admin_deletion' : 'patient_deletion' },
      status: 'success',
    });

    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: `Failed to delete campaign: ${error.message}` });
  }
});

// @route   POST /api/campaigns/:id/deploy-contract
// @desc    Deploy smart contract for campaign
// @access  Private (Admin only)
router.post('/:id/deploy-contract', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('patientId')
      .populate('hospitalId');

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    if (campaign.smartContractAddress) {
      return res.status(400).json({ error: 'Smart contract already deployed for this campaign' });
    }

    if (!campaign.milestones || campaign.milestones.length === 0) {
      return res.status(400).json({ error: 'Campaign must have milestones to deploy contract' });
    }

    // Get patient wallet address
    const patientWallet = campaign.patientId?.walletAddress;
    if (!patientWallet) {
      return res.status(400).json({ error: 'Patient wallet address not found. Please connect wallet first.' });
    }

    // Get hospital wallet address
    const hospitalWallet = campaign.hospitalId?.walletAddress;
    if (!hospitalWallet) {
      return res.status(400).json({ error: 'Hospital wallet address not found. Please assign a verified hospital.' });
    }

    console.log(`Deploying contract for campaign: ${campaign._id}`);
    console.log(`Patient: ${patientWallet}, Hospital: ${hospitalWallet}`);

    // Deploy the smart contract
    const deploymentResult = await deployEscrowContract(
      patientWallet,
      hospitalWallet,
      campaign.milestones
    );

    // Update campaign with contract details
    campaign.smartContractAddress = deploymentResult.contractAddress;
    campaign.smartContractDeploymentTx = deploymentResult.transactionHash;
    campaign.status = 'active';
    await campaign.save();

    // Create smart contract record
    await SmartContract.create({
      campaignId: campaign._id,
      contractAddress: deploymentResult.contractAddress,
      transactionHash: deploymentResult.transactionHash,
      network: process.env.RPC_URL?.includes('polygon') ? 'polygon' : 'sepolia',
      patientAddress: patientWallet,
      hospitalAddress: hospitalWallet,
      milestones: campaign.milestones.map(m => ({
        description: m.description,
        amount: m.targetAmount,
        confirmed: false,
        releasedAt: null,
      })),
      status: 'active',
      abi: deploymentResult.abi,
    });

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'smart_contract_deployed',
      entityType: 'campaign',
      entityId: campaign._id,
      details: {
        contractAddress: deploymentResult.contractAddress,
        transactionHash: deploymentResult.transactionHash,
        milestoneCount: campaign.milestones.length,
      },
      status: 'success',
    });

    console.log(`✅ Contract deployed at: ${deploymentResult.contractAddress}`);

    res.json({
      message: 'Smart contract deployed successfully',
      contractAddress: deploymentResult.contractAddress,
      transactionHash: deploymentResult.transactionHash,
      network: process.env.RPC_URL || 'http://127.0.0.1:8545',
    });
  } catch (error) {
    console.error('Contract deployment error:', error);

    // Handle specific errors
    if (error.message.includes('artifact not found')) {
      return res.status(500).json({
        error: 'Contract compilation required. Run: cd hardhat && npx hardhat compile',
      });
    }

    if (error.message.includes('PRIVATE_KEY')) {
      return res.status(500).json({
        error: 'Blockchain not configured. Set PRIVATE_KEY in .env file.',
      });
    }

    res.status(500).json({ error: `Failed to deploy smart contract: ${error.message}` });
  }
});

// @route   GET /api/campaigns/:id/donations
// @desc    Get all donations for a campaign
// @access  Public
router.get('/:id/donations', async (req, res) => {
  try {
    const donations = await Donation.find({ campaignId: req.params.id })
      .populate('donorId', 'name email walletAddress')
      .sort({ createdAt: -1 });

    res.json({ donations });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch donations: ${error.message}` });
  }
});

// @route   POST /api/campaigns/:id/admin-review
// @desc    Admin review for high-risk campaigns
// @access  Private (Admin only)
router.post('/:id/admin-review', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  try {
    const { decision, comments } = req.body; // decision: 'approve' or 'reject'

    if (!['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be approve or reject' });
    }

    const campaign = await Campaign.findById(req.params.id).populate('patientId');
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Update campaign status
    if (decision === 'approve') {
      campaign.status = 'active';
    } else {
      campaign.status = 'rejected';
    }
    await campaign.save();

    // Update risk assessment
    if (campaign.riskAssessmentId) {
      await RiskAssessment.findByIdAndUpdate(campaign.riskAssessmentId, {
        manualReviewRequired: false,
        'manualReviewStatus.status': decision === 'approve' ? 'approved' : 'rejected',
        'manualReviewStatus.reviewedBy': req.user.userId,
        'manualReviewStatus.reviewedAt': new Date(),
        'manualReviewStatus.comments': comments,
      });
    }

    // Create audit log
    await AuditLog.create({
      userId: req.user.userId,
      action: 'admin_campaign_review',
      entityType: 'campaign',
      entityId: campaign._id,
      details: { decision, comments },
      status: 'success',
    });

    // Send email notification
    const patientEmail = campaign.patientId?.email;
    if (patientEmail) {
      if (decision === 'approve') {
        await sendCampaignApprovalEmail(patientEmail, campaign.title);
      } else {
        await sendCampaignRejectionEmail(patientEmail, campaign.title, comments);
      }
    }

    // Emit socket event for real-time update
    const io = getIoInstance();
    if (io) {
      io.to(`user:${req.user.userId}`).emit('campaign:reviewed', {
        campaignId: campaign._id,
        decision,
        comments,
        status: campaign.status,
      });
      // Also emit to campaign room for anyone watching
      io.to(`campaign:${campaign._id}`).emit('campaign:statusChanged', {
        campaignId: campaign._id,
        status: campaign.status,
        reviewedBy: req.user.userId,
      });
      logger.info(`Emitted campaign:reviewed event for campaign ${campaign._id}`);
    }

    res.json({
      message: `Campaign ${decision}d successfully`,
      campaign,
    });
  } catch (error) {
    res.status(500).json({ error: `Failed to review campaign: ${error.message}` });
  }
});

module.exports = router;
