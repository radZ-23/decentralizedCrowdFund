# MedTrustFund - Complete Project Guide

> **AI-Verified Blockchain Medical Crowdfunding Platform**  
> **Version 2.0** | IIT Jodhpur | Team DCF-Alpha-01  
> **Team:** Dungar Soni (B23CS1105), Prakhar Goyal (B23CS1106), Raditya Saraf (B23CS1107)

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Problem Statement](#problem-statement)
3. [Solution Architecture](#solution-architecture)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Key Features](#key-features)
7. [How It Works - Complete Flow](#how-it-works---complete-flow)
8. [Smart Contract Details](#smart-contract-details)
9. [AI Verification System](#ai-verification-system)
10. [API Endpoints](#api-endpoints)
11. [Database Schema](#database-schema)
12. [Setup & Installation](#setup--installation)
13. [Security Features](#security-features)
14. [Performance Metrics](#performance-metrics)
15. [Risk Assessment](#risk-assessment)
16. [Team Contributions](#team-contributions)

---

## 🎯 Project Overview

**MedTrustFund** is a decentralized medical crowdfunding platform that solves trust issues in traditional crowdfunding by combining:

1. **AI-Powered Document Verification** - Automated fraud detection using OCR, metadata analysis, and weighted risk scoring
2. **Blockchain Escrow System** - Donations locked in smart contracts, released only upon hospital milestone confirmation
3. **5-Year Audit Logging** - Immutable audit trail for compliance and transparency

### Core Value Proposition

| Problem in Existing Platforms | MedTrustFund Solution |
|-------------------------------|----------------------|
| No standardized fraud scoring | Quantitative risk score (0-100 scale) |
| Manual, inconsistent verification | AI-automated OCR + metadata pipeline |
| No enforcement of fund usage | Smart contract escrow with milestone-gated release |
| Minimal audit trails | 5-year append-only encrypted audit logs |
| Donor skepticism | Transparent risk badges visible to donors |

---

## ⚠️ Problem Statement

### Core Problems Addressed

1. **Fraudulent Campaigns** - Forged medical documents submitted with little/no automated screening
2. **No Structured Risk Assessment** - Platforms rely on manual, subjective review that doesn't scale
3. **No Fund Utilization Enforcement** - Once donated, funds can be misused with no accountability

### Impact

- Genuine patients lose access to funds diverted by fraudulent campaigns
- Donor confidence erodes, reducing platform sustainability
- Platform administrators face rising operational burden without automation

### Research Gap

> No existing unified architecture integrates **probabilistic fraud scoring** with **milestone-driven smart contract enforcement** specifically for medical crowdfunding.

---

## 🏗️ Solution Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER DEVICES                             │
│         Browser (Patient / Donor / Hospital / Admin)           │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼────────────────────────────────────────┐
│                     BACKEND SERVER (Port 5000)                  │
│         API Entry Port → RBAC Authorization Layer              │
│         Campaign Service | Auth Service | Audit Logger         │
└───────┬────────────────────────────────────────┬───────────────┘
        │                                        │
┌───────▼──────────────────┐     ┌───────────────▼──────────────┐
│   AI SERVICE (Port 8001) │     │    BLOCKCHAIN NETWORK        │
│                          │     │                              │
│  Document Classifier     │     │  Smart Contract (Escrow)     │
│  OCR Engine (Tesseract)  │     │  Wallet Interface (MetaMask) │
│  Forgery Analyzer        │     │  Milestone Verification      │
│  Metadata Consistency    │     │  Transaction Logger          │
│  Risk Intelligence Layer │     │                              │
└──────────────────────────┘     └──────────────────────────────┘
        │                                        │
┌───────▼────────────────────────────────────────▼──────────────┐
│                    MONGODB DATABASE                            │
│         Campaigns | Users | Donations | Audit Logs            │
│                   (5-Year Retention Policy)                    │
└────────────────────────────────────────────────────────────────┘
```

### Campaign Processing Core (Internal Flow)

```
API Entry Port
      ↓
RBAC Authorization Layer
      ↓
Document Processing Pipeline
  ├── Document Classifier
  ├── OCR Engine (10-15 seconds)
  ├── Forgery Analyzer
  └── Metadata Consistency Engine (5-8 seconds)
      ↓
Risk Intelligence Layer
  ├── AI Probability Model (~5 seconds)
  ├── Weighted Risk Aggregator
  └── Threshold Decision Gate (Score ≥ 70 → Escalate)
      ↓
Escrow Control Layer
  ├── Smart Contract Interface
  └── Milestone Verification Adapter
      ↓
Audit & Compliance Layer (5-Year Retention)
```

---

## 🛠️ Technology Stack

| Layer | Technology | Justification |
|-------|------------|---------------|
| **Frontend** | React 19, TypeScript, Vite, Chakra UI | Modular UI components, type safety, fast builds |
| **Backend** | Node.js 18+, Express, MongoDB, JWT | Lightweight async handling, flexible schema |
| **AI Service** | Python 3.9+, FastAPI, PyTesseract, PyMuPDF | Rich OCR/ML ecosystem, rapid experimentation |
| **Blockchain** | Solidity 0.8.24, Hardhat, ethers.js v6 | Smart contract support, local testing network |
| **Web3** | MetaMask, ethers.js | Wallet integration, transaction signing |
| **Database** | MongoDB | Flexible schema for evolving document metadata |
| **Security** | Helmet, bcrypt, express-rate-limit, xss-clean | HIPAA/GDPR compliant security headers |

---

## 📁 Project Structure

```
decentralizedCrowdFund/
├── backend/                    # Node.js Express API Server
│   ├── server.js              # Main entry point
│   ├── models/                # MongoDB schemas
│   │   ├── User.js           # User schema with roles
│   │   ├── Campaign.js       # Campaign entity
│   │   ├── Donation.js       # Donation records
│   │   ├── RiskAssessment.js # AI verification results
│   │   ├── SmartContract.js  # Contract deployment info
│   │   └── AuditLog.js       # 5-year audit trail
│   ├── routes/                # API route handlers
│   │   ├── auth.js           # Authentication endpoints
│   │   ├── campaigns.js      # Campaign CRUD + contract deploy
│   │   ├── donations.js      # Donation processing
│   │   ├── milestones.js     # Milestone confirmation
│   │   └── admin.js          # Admin review endpoints
│   ├── middleware/            # Express middleware
│   │   └── auth.js           # JWT auth + RBAC + audit logging
│   ├── services/              # Business logic
│   │   └── WalletService.js  # Wallet management
│   └── utils/                 # Utility functions
│       ├── contractUtils.js  # Blockchain operations
│       ├── encryption.js     # File encryption at rest
│       ├── jwtUtils.js       # JWT token management
│       └── indexer.js        # Blockchain state sync daemon
│
├── frontend/                   # React + TypeScript UI
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   └── ui/           # Base UI components
│   │   │       └── WalletConnectButton.tsx
│   │   ├── pages/            # Route pages
│   │   │   ├── Campaigns.tsx
│   │   │   ├── CampaignDetail.tsx
│   │   │   ├── MyCampaigns.tsx
│   │   │   ├── MyDonations.tsx
│   │   │   ├── Milestones.tsx
│   │   │   └── AdminDashboard.tsx
│   │   ├── utils/            # Utility functions
│   │   │   └── web3.ts      # Web3/MetaMask integration
│   │   └── services/         # API client
│   │       └── api.ts       # Backend API calls
│   ├── vite.config.ts        # Vite bundler config
│   └── tailwind.config.js    # Tailwind CSS config
│
├── ai-service/                # Python FastAPI AI Verification
│   ├── main.py               # Main verification endpoint
│   └── requirements.txt      # Python dependencies
│
├── hardhat/                   # Smart Contracts
│   ├── contracts/
│   │   └── MedTrustFundEscrow.sol  # Main escrow contract
│   ├── scripts/
│   │   └── deploy.js         # Deployment script
│   ├── hardhat.config.js     # Hardhat configuration
│   └── artifacts/            # Compiled contract ABI (generated)
│
├── uploads/                   # Uploaded documents (encrypted at rest)
├── .env                       # Environment variables
├── .env.example              # Environment template
└── SETUP.md                  # Setup instructions
```

---

## ✨ Key Features

### 1. AI-Powered Document Verification

**Documents Verified:**
- Government-issued ID (Aadhaar/Passport)
- Medical diagnosis reports
- Hospital admission letters
- Treatment cost estimates

**Verification Pipeline:**
1. **OCR Processing** (10-15 seconds) - Extract text using Tesseract
2. **Metadata Validation** (5-8 seconds) - Cross-document consistency checks
3. **AI Forgery Analysis** (~5 seconds) - GAN/diffusion artifact detection
4. **Risk Score Computation** - Weighted formula (0-100 scale)

**Risk Score Formula (SRS v2.0):**
```
RiskScore = 0.35 × TamperingScore + 0.35 × AIProbability + 0.30 × MetadataMismatch
```

| Score Range | Category | Action |
|-------------|----------|--------|
| 0-39 | Low Risk | Auto-approved |
| 40-69 | Medium Risk | Advisory note to donors |
| 70-100 | High Risk | Admin review required |

### 2. Blockchain Escrow System

**Smart Contract Features:**
- `donate()` - Accept ETH contributions
- `confirmMilestone(index)` - Hospital confirms milestone
- `releaseMilestone(index)` - Release funds after confirmation
- `refund(donor, amount)` - Refund donation (admin only)
- `getMilestones()` - View milestone status

**Fund Flow:**
```
Donor Donates → Funds Locked in Escrow → Hospital Confirms Milestone → Funds Released to Patient
```

### 3. Role-Based Access Control (RBAC)

| Role | Permissions |
|------|-------------|
| **Patient** | Create campaigns, upload documents, track funds, release milestones |
| **Donor** | Browse campaigns, view risk scores, donate via MetaMask |
| **Hospital** | Confirm treatment milestones (requires verified credentials) |
| **Admin** | Review escalated campaigns, override AI, deploy contracts, view audit logs |

### 4. 5-Year Audit Logging

**Events Logged:**
- Document upload
- AI verification output
- Risk score generation
- Campaign approved/rejected
- Donation transaction
- Fund lock/release
- Admin override

**Retention Policy:**
- Minimum 5 years (TTL index on MongoDB)
- Append-only encrypted storage
- Financial logs never deleted

---

## 🔄 How It Works - Complete Flow

### Patient Flow

```
1. Register/Login → Connect MetaMask Wallet
       ↓
2. Create Campaign → Enter Details + Upload Documents (4 types)
       ↓
3. AI Verification Runs Automatically (~28 seconds avg)
       ↓
4a. Risk Score < 40 → Auto-Approved → Published
4b. Risk Score 40-69 → Published with Advisory Note
4c. Risk Score ≥ 70 → Escalated to Admin Review
       ↓
5. Admin Approves → Campaign Published
       ↓
6. Donations Start Coming In → Funds Locked in Smart Contract
       ↓
7. Hospital Confirms Milestones → Patient Releases Funds
```

### Donor Flow

```
1. Browse Published Campaigns
       ↓
2. View Campaign Details + Risk Score Badge (Low/Medium/High)
       ↓
3. Connect MetaMask Wallet
       ↓
4. Enter Donation Amount → Confirm Transaction
       ↓
5. Smart Contract Locks Funds (85-110 seconds confirmation)
       ↓
6. Donation Recorded with Transaction Hash
```

### Hospital Flow

```
1. Login with Verified Credentials + Wallet Address
       ↓
2. View Assigned Campaigns
       ↓
3. Confirm Treatment Milestone
       ↓
4. Smart Contract Validates → Enables Fund Release
```

### Admin Flow

```
1. Login → View Dashboard
       ↓
2. Review Escalated Campaigns (Risk Score ≥ 70)
       ↓
3. Approve/Reject with Documented Justification
       ↓
4. Deploy Smart Contract for Approved Campaigns
       ↓
5. Monitor Audit Logs
```

---

## 📜 Smart Contract Details

### MedTrustFundEscrow.sol

**Key Functions:**

```solidity
// Constructor - Deploy with patient, hospital, and milestones
constructor(address _patient, address _hospital, 
            string[] _descriptions, uint256[] _amounts)

// Accept donations
function donate() external payable

// Hospital confirms milestone
function confirmMilestone(uint256 index) external

// Release funds to patient wallet
function releaseMilestone(uint256 index) external

// Refund donation (admin only)
function refund(address payable donor, uint256 amount) external

// View all milestones
function getMilestones() external view returns (Milestone[] memory)
```

**Contract State Machine:**

| State | Description |
|-------|-------------|
| `INITIALIZED` | Contract deployed for campaign |
| `LOCKED` | Donation received, funds locked |
| `MILESTONE_PENDING` | Awaiting hospital confirmation |
| `RELEASED` | Funds transferred to patient |
| `FAILED` | Transaction failed, funds returned |

**Deployment Flow (backend/utils/contractUtils.js):**
```javascript
1. Load compiled ABI from Hardhat artifacts
2. Get provider + signer from PRIVATE_KEY
3. Create ContractFactory with ABI + bytecode
4. Deploy with patient/hospital addresses + milestone data
5. Wait for deployment transaction
6. Store contract address + ABI in MongoDB
```

---

## 🤖 AI Verification System

### Verification Pipeline (ai-service/main.py)

**Stage 1: OCR Processing (10-15 seconds)**
- PDF text extraction using PyMuPDF
- Image text extraction using Tesseract
- Document type classification based on keywords

**Stage 2: Metadata Validation (5-8 seconds)**
- Cross-document date consistency
- Patient name matching across documents
- Hospital registry verification
- Creator/producer consistency checks

**Stage 3: AI Forgery Analysis (~5 seconds)**
- Image tampering detection:
  - File size anomalies (<10KB suspicious)
  - Missing EXIF metadata
  - Unusual resolution (>4000px)
  - Compression artifacts
- AI-generated content detection:
  - Generic template language patterns
  - Repetitive word patterns
  - Low medical terminology coverage
  - Suspiciously short documents

**Stage 4: Risk Score Computation**
```python
WEIGHTS = {
    "tampering": 0.35,      # Image tampering indicators
    "ai_probability": 0.35, # AI-generated content probability
    "metadata_mismatch": 0.30 # Cross-document inconsistencies
}

final_risk_score = (
    0.35 × avg_tampering +
    0.35 × avg_ai_probability +
    0.30 × metadata_mismatch
)

# Hospital verification bonus
if hospital_verified:
    final_risk_score = max(0, final_risk_score × 0.8)
```

### Performance Results

| Metric | Version 1.0 | Version 2.0 |
|--------|-------------|-------------|
| False Positive Rate | 12% | **6%** |
| False Negative Rate | 9% | **5%** |
| Risk Score Variance | High | **Stable** |

**Throughput:** ~120 campaigns/hour under current configuration

---

## 🌐 API Endpoints

### Authentication
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/api/auth/signup` | Register new user | Public |
| POST | `/api/auth/login` | User login | Public |
| GET | `/api/auth/profile` | Get user profile | Private |
| PUT | `/api/auth/profile` | Update profile | Private |
| POST | `/api/auth/verify-wallet` | Link wallet address | Private |

### Campaigns
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/api/campaigns` | Create campaign + AI verification | Patient |
| GET | `/api/campaigns` | List all campaigns (with filters) | Public |
| GET | `/api/campaigns/:id` | Get campaign details | Public |
| PUT | `/api/campaigns/:id` | Update campaign | Patient/Admin |
| DELETE | `/api/campaigns/:id` | Delete campaign | Admin/Patient* |
| POST | `/api/campaigns/:id/deploy-contract` | Deploy smart contract | Admin |
| POST | `/api/campaigns/:id/admin-review` | Admin review decision | Admin |

*Patient can only delete if no donations received

### Donations
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/api/donations` | Record donation | Donor |
| GET | `/api/donations` | Get user donations | Private |
| POST | `/api/donations/:campaignId/donate-direct` | Direct contract donation | Donor |
| POST | `/api/donations/:id/refund` | Request refund | Admin |

### Milestones
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| POST | `/api/milestones/:campaignId/confirm` | Confirm milestone on-chain | Hospital |
| POST | `/api/milestones/:campaignId/release` | Release funds to patient | Patient/Admin |
| GET | `/api/milestones/:campaignId` | Get campaign milestones | Private |

### Admin
| Method | Endpoint | Description | Role |
|--------|----------|-------------|------|
| GET | `/api/admin/dashboard` | Admin statistics | Admin |
| GET | `/api/admin/campaigns/pending-review` | Campaigns needing review | Admin |
| GET | `/api/admin/users` | List all users | Admin |
| GET | `/api/admin/audit-logs` | View audit logs | Admin |
| GET | `/api/admin/audit-logs/export` | Export logs (5-year retention) | Admin |

---

## 💾 Database Schema

### Core Collections

**users**
```javascript
{
  _id: ObjectId,
  email: String (unique),
  passwordHash: String,
  role: String [patient|donor|hospital|admin],
  walletAddress: String,
  verified: Boolean,
  createdAt: Date
}
```

**campaigns**
```javascript
{
  _id: ObjectId,
  title: String,
  description: String,
  patientId: ObjectId (ref: User),
  hospitalId: ObjectId (ref: User),
  targetAmount: Number,
  raisedAmount: Number (default: 0),
  status: String [draft|pending_verification|active|completed|rejected|paused],
  documents: [{
    type: String [identity|diagnosis|admission_letter|cost_estimate],
    url: String,
    hash: String (SHA256),
    uploadedAt: Date
  }],
  smartContractAddress: String,
  smartContractDeploymentTx: String,
  riskAssessmentId: ObjectId (ref: RiskAssessment),
  milestones: [{
    description: String,
    targetAmount: Number,
    status: String [pending|confirmed|released],
    confirmedAt: Date,
    releasedAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**risk_assessments**
```javascript
{
  _id: ObjectId,
  campaignId: ObjectId (ref: Campaign),
  riskScore: Number (0-100),
  riskCategory: String [low|medium|high],
  recommendation: String [approve|escalate],
  manualReviewRequired: Boolean,
  tamperingScore: Number,
  aiProbabilityScore: Number,
  metadataMismatchScore: Number,
  aiVerificationDetails: Object,
  documentAnalysis: Array,
  createdAt: Date
}
```

**donations**
```javascript
{
  _id: ObjectId,
  campaignId: ObjectId (ref: Campaign),
  donorId: ObjectId (ref: User),
  amount: Number,
  transactionHash: String,
  blockNumber: Number,
  gasUsed: String,
  status: String [pending|confirmed|failed|refunded],
  createdAt: Date
}
```

**smart_contracts**
```javascript
{
  _id: ObjectId,
  campaignId: ObjectId (ref: Campaign),
  contractAddress: String,
  transactionHash: String,
  network: String [polygon|sepolia|local],
  patientAddress: String,
  hospitalAddress: String,
  abi: Array,
  totalFunds: Number,
  releasedFunds: Number,
  status: String [active|completed|failed],
  createdAt: Date
}
```

**audit_logs** (5-year TTL index)
```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  action: String,
  entityType: String,
  entityId: ObjectId,
  details: Object,
  status: String [success|failure],
  timestamp: Date (TTL: 5 years)
}
```

---

## 🚀 Setup & Installation

### Prerequisites

- **Node.js** v18+ and npm
- **Python** 3.9+
- **MongoDB** (local or Atlas)
- **MetaMask** browser extension

### Step-by-Step Installation

```bash
# 1. Clone repository
git clone <repo-url>
cd decentralizedCrowdFund

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install

# 4. Install AI service dependencies
cd ../ai-service
pip install -r requirements.txt

# 5. Install Hardhat dependencies
cd ../hardhat
npm install

# 6. Configure environment
cd ..
cp .env.example .env
# Edit .env with your values:
# - MONGODB_URI
# - JWT_SECRET (strong random string)
# - PRIVATE_KEY (Hardhat default or testnet key)
# - RPC_URL (http://127.0.0.1:8545 for local)
```

### Running the Application

```bash
# Terminal 1: Start MongoDB
mongod --dbpath /data/db

# Terminal 2: Start Hardhat Local Blockchain
cd hardhat
npx hardhat node

# Terminal 3: Compile Smart Contracts
cd hardhat
npx hardhat compile

# Terminal 4: Start AI Service
cd ai-service
python main.py
# Runs on http://localhost:8001

# Terminal 5: Start Backend
cd backend
npm start
# Runs on http://localhost:5000

# Terminal 6: Start Frontend
cd frontend
npm run dev
# Runs on http://localhost:5173
```

### Testing the Application

1. **Create Users** - Register with different roles (Patient, Donor, Hospital, Admin)
2. **Create Campaign** - Patient uploads 4 document types
3. **AI Verification** - Automatic risk score computation
4. **Admin Review** - Approve campaign + deploy smart contract
5. **Donate** - Connect MetaMask, send test ETH
6. **Confirm Milestone** - Hospital confirms, patient releases funds

---

## 🔒 Security Features

### Implemented Security Measures

| Feature | Implementation |
|---------|----------------|
| **Authentication** | JWT tokens with bcrypt password hashing |
| **Authorization** | RBAC middleware on all sensitive endpoints |
| **Input Validation** | express-mongo-sanitize (NoSQL injection), xss-clean (XSS) |
| **HTTP Security** | Helmet.js for HIPAA/GDPR compliant headers |
| **Rate Limiting** | 100 requests per 15 minutes per IP |
| **File Security** | SHA256 hash storage, encryption at rest |
| **Document Integrity** | Cryptographic hash verification |
| **Wallet Security** | Private keys never stored on server |
| **Smart Contract** | Function-level permission enforcement |
| **Audit Trail** | 5-year immutable append-only logs |

### Production Security Checklist

- [ ] Use environment-specific secrets manager
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure production rate limiting
- [ ] Add input sanitization (validator.js)
- [ ] Set up monitoring (Winston + Sentry)
- [ ] Third-party smart contract audit
- [ ] Hardware wallet for contract deployment
- [ ] Multi-sig for admin actions

---

## 📊 Performance Metrics

### Target Performance (SRS v2.0)

| Operation | Target | Achieved |
|-----------|--------|----------|
| OCR Processing | 10-15 seconds | ✅ 10-15s |
| Metadata Validation | 5-8 seconds | ✅ 5-8s |
| AI Fraud Analysis | ~5 seconds | ✅ ~5s |
| **Total AI Verification** | **≤ 40 seconds** | ✅ ~28s avg |
| Blockchain Confirmation | 85-110 seconds | ✅ 85-110s |
| Smart Contract Deployment | ~110 seconds | ✅ ~110s |
| Milestone Fund Release | ~95 seconds | ✅ ~95s |

### System Throughput

- **AI Verification Module:** ~120 campaigns/hour
- **Blockchain Layer:** Primary scalability bottleneck
- **Recommendation:** Migrate to Polygon (Layer-2) for production

### Document Resolution Impact

| Resolution | Processing Time |
|------------|-----------------|
| Low (300 dpi) | 35.2 seconds |
| Medium (600 dpi) | 27.8 seconds |
| High (900 dpi) | 24.3 seconds |

---

## ⚠️ Risk Assessment

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OCR accuracy issues with low-quality scans | Medium | High | Minimum resolution requirements, manual override |
| Blockchain gas fee volatility | High | Medium | Layer-2 migration (Polygon), gas estimation |
| Smart contract vulnerabilities | Low | Critical | Thorough testing, third-party audit |
| Hospital identity spoofing | Medium | High | Multi-factor verification, registry checks |
| AI false positives (genuine patients flagged) | Medium | Medium | Admin review escalation, human oversight |
| Database breach (medical data exposure) | Low | Critical | Encryption at rest, RBAC, audit logging |

### Risk Mitigation Integration in Sprint Plan

**Sprint 1:** Core authentication + RBAC (addresses unauthorized access risk)
**Sprint 2:** AI verification engine with manual override (addresses false positive risk)
**Sprint 3:** Smart contract testing + local blockchain (addresses contract vulnerability risk)
**Sprint 4:** Hospital verification workflow (addresses identity spoofing risk)
**Sprint 5:** Audit logging + encryption (addresses data breach risk)

---

## 👥 Team Contributions

| Team Member | Role | Key Contributions |
|-------------|------|-------------------|
| **Dungar Soni** (B23CS1105) | Architecture & Blockchain Lead | System architecture, UML diagrams, smart contract design, audit logging, SRS v2.0 consolidation |
| **Prakhar Goyal** (B23CS1106) | AI Verification & Backend Lead | AI fraud detection workflow, risk scoring formula, document verification pipeline, backend API |
| **Raditya Saraf** (B23CS1107) | Frontend & UX Lead | User interaction flows, Use Case diagrams, stakeholder analysis (ESSENCE Kernel), frontend UI |

---

## 📚 Additional Documentation

- **SETUP.md** - Detailed setup and troubleshooting guide
- **IMPLEMENTATION_SUMMARY.md** - Implementation progress and file changes
- **MedTrustFund_Documentation.md** - Complete SRS v2.0 specification
- **lab_Assignment.md** - Software metrics and risk analysis assignment

---

## 🔗 Quick Links

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/api/health
- **AI Service:** http://localhost:8001
- **Hardhat Network:** http://127.0.0.1:8545

---

## 📝 License

MIT License - IIT Jodhpur, Team DCF-Alpha-01

---

**Last Updated:** April 2026  
**Version:** 2.0
