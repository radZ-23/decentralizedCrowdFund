# MedTrustFund - Missing Features Implementation Guide

**Last Updated:** April 11, 2026  
**Status:** Core features implemented, pending enhancements

---

## Executive Summary

The MedTrustFund platform has **core functionality implemented** including:
- User authentication with JWT and RBAC
- Campaign creation with AI document verification
- Smart contract deployment and milestone management
- Admin dashboard and campaign review
- KYC submission flow
- Real-time notifications (Socket.IO)
- Transaction history

This document outlines **remaining features to implement** for a production-ready system.

---

## Priority Matrix

| Priority | Feature | Complexity | Impact |
|----------|---------|------------|--------|
| **P0 - Critical** | Backend transactions API | Medium | High |
| **P0 - Critical** | WebSocket event emission (complete) | Low | High |
| **P1 - High** | Refund mechanism | High | High |
| **P1 - High** | Email notifications | Medium | Medium |
| **P2 - Medium** | Analytics dashboard backend | Medium | Medium |
| **P2 - Medium** | Hospital campaign management | Low | Medium |
| **P3 - Low** | Advanced search/filters | Low | Low |

---

## P0 - Critical Missing Features

### 1. Backend Transactions API

**Status:** Frontend page exists (`/transactions`), **backend route missing**

**What's needed:**
- Create `backend/routes/transactions.js`
- Implement `GET /api/transactions` endpoint
- Aggregate transactions from:
  - Donations collection
  - Milestone releases
  - Refunds
- Return unified transaction history

**Implementation steps:**

```javascript
// backend/routes/transactions.js

const express = require('express');
const Donation = require('../models/Donation');
const Campaign = require('../models/Campaign');
const SmartContract = require('../models/SmartContract');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/transactions - Get all transactions for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, status, limit = 50 } = req.query;
    const userId = req.user.userId;

    // Fetch donations by user
    const donations = await Donation.find({ donorId: userId })
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Map to unified transaction format
    const transactions = donations.map(d => ({
      _id: d._id,
      type: 'donation',
      amount: d.amount,
      currency: 'ETH',
      status: d.status,
      txHash: d.transactionHash,
      campaignId: d.campaignId,
      createdAt: d.createdAt,
      confirmedAt: d.confirmedAt,
      description: `Donation to ${d.campaignId?.title || 'campaign'}`,
    }));

    // TODO: Add milestone releases and refunds

    res.json({ transactions });
  } catch (error) {
    res.status(500).json({ error: `Failed to fetch transactions: ${error.message}` });
  }
});

module.exports = router;
```

**Then register in server.js:**
```javascript
const transactionsRoutes = require('./routes/transactions');
app.use('/api/transactions', transactionsRoutes);
```

---

### 2. Complete WebSocket Event Emission

**Status:** Socket.IO configured, but **events not emitted** from most routes

**What's needed:**
- Emit events from donations, milestones, KYC routes
- Frontend already listens for these events

**Events to implement:**

| Event | Trigger | Route |
|-------|---------|-------|
| `donation:received` | New donation | `POST /api/donations` |
| `donation:refunded` | Refund processed | `POST /api/donations/:id/refund` |
| `milestone:confirmed` | Hospital confirms | `POST /api/milestones/:id/confirm` |
| `milestone:released` | Funds released | `POST /api/milestones/:id/release` |
| `kyc:statusChanged` | KYC status update | `PUT /api/kyc/:id/status` |

**Example implementation:**
```javascript
// In donations.js
const { getIO } = require('../utils/socket');

router.post('/', authMiddleware, async (req, res) => {
  // ... existing donation logic ...
  
  const io = getIO();
  if (io) {
    io.to(`campaign:${donation.campaignId}`).emit('donation:received', {
      donationId: donation._id,
      campaignId: donation.campaignId,
      amount: donation.amount,
      donorId: req.user.userId,
    });
  }
});
```

---

## P1 - High Priority Missing Features

### 3. Refund Mechanism

**Status:** Smart contract has `refund()` function, **backend flow incomplete**

**What's needed:**
- Backend endpoint to initiate refund
- Call smart contract `refund()` function
- Update donation status
- Emit WebSocket event

**Implementation:**
```javascript
// POST /api/donations/:id/refund
router.post('/:id/refund', authMiddleware, async (req, res) => {
  const donation = await Donation.findById(req.params.id).populate('campaignId');
  
  // Verify donor is requesting refund
  if (donation.donorId.toString() !== req.user.userId) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  // Call smart contract refund
  const contractInstance = await getContractInstance(donation.campaignId.smartContractAddress);
  const tx = await releaseMilestoneOnChain(/* params */);
  
  // Update donation
  donation.status = 'refunded';
  donation.refundTxHash = tx.hash;
  await donation.save();
  
  // Emit event
  const io = getIO();
  io.to(`user:${req.user.userId}`).emit('donation:refunded', {
    donationId: donation._id,
    amount: donation.amount,
  });
  
  res.json({ message: 'Refund processed', transaction: tx });
});
```

---

### 4. Email Notifications

**Status:** Email service exists (`backend/utils/emailService.js`), **not fully integrated**

**What's needed:**
- Integrate email sending in:
  - Campaign approval/rejection (partially done)
  - Milestone confirmation
  - Funds released
  - KYC status changes
  - Donation received (for campaign owner)

**Implementation:**
```javascript
// In milestones.js
const { sendMilestoneConfirmedEmail, sendFundsReleasedEmail } = require('../utils/emailService');

router.post('/:campaignId/confirm', authMiddleware, async (req, res) => {
  // ... existing confirmation logic ...
  
  // Notify patient
  const patient = await User.findById(campaign.patientId);
  await sendFundsReleasedEmail(patient.email, campaign.title, milestone.amount);
});
```

---

## P2 - Medium Priority Missing Features

### 5. Analytics Dashboard Backend

**Status:** Frontend exists (`/analytics`), **backend needs enhancement**

**What's needed:**
- Create `backend/routes/analytics.js` (file exists, check implementation)
- Implement endpoints for:
  - Platform-wide statistics
  - User-specific analytics
  - Campaign performance metrics

**Endpoints to implement:**
```javascript
GET /api/analytics/platform      // Admin: total raised, active campaigns, etc.
GET /api/analytics/user          // Current user: donations made, campaigns created
GET /api/analytics/campaign/:id  // Campaign-specific: donation trend, visitor count
```

---

### 6. Hospital Campaign Management

**Status:** Hospital routes exist, **needs campaign listing**

**What's needed:**
- `GET /api/hospitals/my-campaigns` - List campaigns linked to hospital
- Hospital dashboard statistics

---

## P3 - Low Priority Enhancements

### 7. Advanced Search and Filters

**Status:** Basic filters exist, **needs enhancement**

**What's needed:**
- Full-text search across campaigns
- Date range filters
- Multi-criteria filtering
- Sort options

---

## Testing Checklist

Before marking features complete:

- [ ] Unit tests for new endpoints
- [ ] Integration tests for flows (donation → milestone → release)
- [ ] WebSocket event tests (verify frontend receives events)
- [ ] Error handling tests (network failures, contract reverts)
- [ ] Security tests (RBAC, input validation)

---

## Implementation Order Recommendation

1. **Week 1:** Transactions API + WebSocket events
2. **Week 2:** Refund mechanism + Email notifications
3. **Week 3:** Analytics enhancements + Hospital features
4. **Week 4:** Testing + bug fixes

---

## Files Requiring Changes

| File | Action | Priority |
|------|--------|----------|
| `backend/routes/transactions.js` | Create new | P0 |
| `backend/server.js` | Register route | P0 |
| `backend/routes/donations.js` | Add WebSocket emits | P0 |
| `backend/routes/milestones.js` | Add WebSocket emits | P0 |
| `backend/routes/kyc.js` | Add WebSocket emits | P0 |
| `backend/utils/emailService.js` | Add templates | P1 |
| `backend/routes/refunds.js` | Create new | P1 |

---

## Notes

- All new endpoints must include audit logging
- WebSocket events should use the `getIO()` utility from `utils/socket.js`
- Email templates should support HTML and plain text
- Smart contract interactions should include proper error handling

---

**Contact:** Dungar Soni (B23CS1105) - Architecture & Blockchain Lead
