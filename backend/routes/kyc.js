const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const KYCDocument = require('../models/KYCDocument');
const User = require('../models/User');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

// Aliases for compatibility
const authenticate = authMiddleware;
const authorize = roleMiddleware;
const logger = require('../utils/logger');
const { sendKYCStatusEmail } = require('../utils/emailService');
const { encryptFile, decryptFile } = require('../utils/encryption');

const router = express.Router();

// Configure multer for KYC document uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const kycDir = path.join(__dirname, '../../uploads/kyc');
    if (!fs.existsSync(kycDir)) {
      fs.mkdirSync(kycDir, { recursive: true });
    }
    cb(null, kycDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `kyc-${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, PNG) and PDF files are allowed'));
    }
  }
});

/**
 * POST /api/kyc/submit
 * Submit KYC documents for verification
 */
router.post('/submit', authenticate, upload.array('documents', 5), async (req, res) => {
  try {
    const userId = req.user.userId;
    const { documentType, documentNumber, fullName, dateOfBirth } = req.body;

    // Validate required fields
    if (!documentType || !documentNumber || !fullName || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: documentType, documentNumber, fullName, dateOfBirth'
      });
    }

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if user already has pending or approved KYC
    const existingKYC = await KYCDocument.findOne({
      user: userId,
      status: { $in: ['pending', 'approved'] }
    });

    if (existingKYC) {
      return res.status(400).json({
        success: false,
        message: `KYC already ${existingKYC.status}. Cannot submit new documents.`
      });
    }

    // Process uploaded files
    const documents = req.files.map(file => ({
      url: `/uploads/kyc/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    }));

    if (documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one document is required'
      });
    }

    // Create KYC document record
    const kycDocument = await KYCDocument.create({
      user: userId,
      documentType,
      documentNumber,
      fullName,
      dateOfBirth: new Date(dateOfBirth),
      documents,
      status: 'pending',
      submittedAt: new Date()
    });

    // Update user KYC status
    user.kyc = {
      status: 'pending',
      kycDocumentId: kycDocument._id,
      submittedAt: new Date()
    };
    await user.save();

    if (req.files && req.files.length) {
      req.files.forEach((file) => {
        try {
          encryptFile(file.path);
        } catch (encErr) {
          logger.error(`KYC file encryption error: ${encErr.message}`);
        }
      });
    }

    logger.info(`KYC submitted by user ${userId} (${user.email})`);

    res.status(201).json({
      success: true,
      message: 'KYC documents submitted successfully',
      data: {
        kycId: kycDocument._id,
        status: 'pending',
        submittedAt: kycDocument.submittedAt
      }
    });

  } catch (error) {
    logger.error(`KYC submission error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit KYC documents',
      error: error.message
    });
  }
});

/**
 * GET /api/kyc/status
 * Get current KYC status for authenticated user
 */
router.get('/status', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const kycDocument = await KYCDocument.findOne({ user: userId })
      .sort({ submittedAt: -1 });

    if (!kycDocument) {
      return res.json({
        success: true,
        data: {
          status: 'not_submitted',
          message: 'No KYC documents submitted'
        }
      });
    }

    res.json({
      success: true,
      data: {
        status: kycDocument.status,
        documentType: kycDocument.documentType,
        documentNumber: kycDocument.documentNumber,
        submittedAt: kycDocument.submittedAt,
        reviewedAt: kycDocument.reviewedAt,
        rejectionReason: kycDocument.rejectionReason,
        reviewedBy: kycDocument.reviewedBy
      }
    });

  } catch (error) {
    logger.error(`KYC status check error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KYC status',
      error: error.message
    });
  }
});

/**
 * GET /api/kyc/pending
 * Get all pending KYC submissions (Admin only)
 */
router.get('/pending', authenticate, authorize('admin'), async (req, res) => {
  try {
    const pendingKYCs = await KYCDocument.find({ status: 'pending' })
      .populate('user', 'email name role')
      .sort({ submittedAt: -1 });

    res.json({
      success: true,
      count: pendingKYCs.length,
      data: pendingKYCs
    });

  } catch (error) {
    logger.error(`Fetch pending KYC error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending KYC submissions',
      error: error.message
    });
  }
});

/**
 * GET /api/kyc/:id/documents/:docIndex
 * Stream decrypted KYC file (admin only)
 */
router.get('/:id/documents/:docIndex', authenticate, authorize('admin'), async (req, res) => {
  try {
    const docIndex = parseInt(req.params.docIndex, 10);
    const kycDocument = await KYCDocument.findById(req.params.id);
    if (!kycDocument || !kycDocument.documents || docIndex < 0 || docIndex >= kycDocument.documents.length) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    const doc = kycDocument.documents[docIndex];
    const filePath = path.join(__dirname, '../../', doc.url.replace(/^\//, ''));
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'File missing on disk' });
    }
    const buf = decryptFile(filePath);
    res.setHeader('Content-Type', doc.mimetype || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.originalName || 'document'}"`);
    res.send(buf);
  } catch (error) {
    logger.error(`KYC document decrypt error: ${error.message}`, error);
    res.status(500).json({ success: false, message: 'Failed to read document' });
  }
});

/**
 * GET /api/kyc/:id
 * Get specific KYC document details (Admin only)
 */
router.get('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const kycDocument = await KYCDocument.findById(req.params.id)
      .populate('user', 'email name role phone');

    if (!kycDocument) {
      return res.status(404).json({
        success: false,
        message: 'KYC document not found'
      });
    }

    res.json({
      success: true,
      data: kycDocument
    });

  } catch (error) {
    logger.error(`Fetch KYC document error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch KYC document',
      error: error.message
    });
  }
});

/**
 * POST /api/kyc/:id/approve
 * Approve KYC submission (Admin only)
 */
router.post('/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;
    const adminId = req.user.userId;

    const kycDocument = await KYCDocument.findById(id);
    if (!kycDocument) {
      return res.status(404).json({
        success: false,
        message: 'KYC document not found'
      });
    }

    if (kycDocument.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot approve KYC with status: ${kycDocument.status}`
      });
    }

    kycDocument.status = 'approved';
    kycDocument.reviewedBy = adminId;
    kycDocument.reviewedAt = new Date();
    kycDocument.notes = notes || kycDocument.notes;
    await kycDocument.save();

    // Update user KYC status
    const user = await User.findById(kycDocument.user);
    if (user) {
      user.kyc = {
        status: 'approved',
        kycDocumentId: kycDocument._id,
        approvedAt: new Date()
      };
      user.role = user.role === 'user' ? 'user' : user.role; // Keep existing role
      await user.save();
    }

    logger.info(`KYC approved: ${id} by admin ${adminId}`);

    // Send email notification
    if (user?.email) {
      await sendKYCStatusEmail(user.email, 'approved', null);
    }

    // Emit socket event if socket.io is available
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`user:${kycDocument.user.toString()}`).emit('kyc:statusChanged', {
        kycId: kycDocument._id,
        status: 'approved',
        reviewedAt: kycDocument.reviewedAt
      });
    }

    res.json({
      success: true,
      message: 'KYC approved successfully',
      data: {
        kycId: kycDocument._id,
        status: 'approved',
        reviewedAt: kycDocument.reviewedAt
      }
    });

  } catch (error) {
    logger.error(`KYC approval error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve KYC',
      error: error.message
    });
  }
});

/**
 * POST /api/kyc/:id/reject
 * Reject KYC submission (Admin only)
 */
router.post('/:id/reject', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = req.user.userId;

    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required'
      });
    }

    const kycDocument = await KYCDocument.findById(id);
    if (!kycDocument) {
      return res.status(404).json({
        success: false,
        message: 'KYC document not found'
      });
    }

    if (kycDocument.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Cannot reject KYC with status: ${kycDocument.status}`
      });
    }

    kycDocument.status = 'rejected';
    kycDocument.reviewedBy = adminId;
    kycDocument.reviewedAt = new Date();
    kycDocument.rejectionReason = reason;
    await kycDocument.save();

    // Update user KYC status
    const user = await User.findById(kycDocument.user);
    if (user) {
      user.kyc = {
        status: 'rejected',
        kycDocumentId: kycDocument._id,
        rejectedAt: new Date()
      };
      await user.save();
    }

    logger.info(`KYC rejected: ${id} by admin ${adminId}, reason: ${reason}`);

    // Send email notification
    if (user?.email) {
      await sendKYCStatusEmail(user.email, 'rejected', reason);
    }

    // Emit socket event
    if (req.app.get('io')) {
      const io = req.app.get('io');
      io.to(`user:${kycDocument.user.toString()}`).emit('kyc:statusChanged', {
        kycId: kycDocument._id,
        status: 'rejected',
        reason,
        reviewedAt: kycDocument.reviewedAt
      });
    }

    res.json({
      success: true,
      message: 'KYC rejected',
      data: {
        kycId: kycDocument._id,
        status: 'rejected',
        reason,
        reviewedAt: kycDocument.reviewedAt
      }
    });

  } catch (error) {
    logger.error(`KYC rejection error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject KYC',
      error: error.message
    });
  }
});

/**
 * DELETE /api/kyc/:id
 * Delete KYC submission and associated files (Admin only)
 */
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const kycDocument = await KYCDocument.findById(req.params.id);

    if (!kycDocument) {
      return res.status(404).json({
        success: false,
        message: 'KYC document not found'
      });
    }

    // Delete associated files
    for (const doc of kycDocument.documents) {
      const filePath = path.join(__dirname, '../../', doc.url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await KYCDocument.findByIdAndDelete(req.params.id);

    // Reset user KYC status
    const user = await User.findById(kycDocument.user);
    if (user) {
      user.kyc = { status: 'not_submitted' };
      await user.save();
    }

    logger.info(`KYC deleted: ${req.params.id}`);

    res.json({
      success: true,
      message: 'KYC document deleted successfully'
    });

  } catch (error) {
    logger.error(`KYC deletion error: ${error.message}`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete KYC document',
      error: error.message
    });
  }
});

module.exports = router;
