# MedTrustFund - Technical Gaps Analysis

> **Generated:** April 7, 2026  
> **Purpose:** Identify gaps between documented features (SRS v2.0) and actual implementation

---

## 🔴 CRITICAL GAPS (Must Implement Before Interview)

### 1. No Unit Tests for Smart Contract
**Status:** ❌ NOT IMPLEMENTED  
**Location:** `hardhat/test/` - Directory doesn't exist  
**Impact:** HIGH - Cannot prove contract works correctly

**What's Missing:**
- No test file for `MedTrustFundEscrow.sol`
- Cannot demonstrate contract behavior in interview
- No verification of milestone confirmation/release logic

**Implementation Required:**
```javascript
// hardhat/test/MedTrustFundEscrow.test.js
describe("MedTrustFundEscrow", function () {
  it("Should deploy with correct patient/hospital addresses")
  it("Should accept donations and lock in escrow")
  it("Should allow hospital to confirm milestone")
  it("Should release funds only after confirmation")
  it("Should prevent double-release")
  it("Should allow refund by admin")
})
```

---

### 2. No Backend Unit Tests
**Status:** ❌ NOT IMPLEMENTED  
**Location:** `backend/tests/` - Directory doesn't exist  
**Impact:** HIGH - Cannot demonstrate API reliability

**What's Missing:**
- No tests for auth routes (signup, login, wallet verification)
- No tests for campaign creation flow
- No tests for donation processing
- No tests for milestone confirmation/release

**Implementation Required:**
```javascript
// backend/tests/auth.test.js - Login/signup tests
// backend/tests/campaigns.test.js - Campaign CRUD tests
// backend/tests/donations.test.js - Donation flow tests
// backend/tests/milestones.test.js - Milestone tests
```

---

### 3. No Frontend Unit Tests
**Status:** ❌ NOT IMPLEMENTED  
**Location:** `frontend/src/__tests__/` - Doesn't exist  
**Impact:** MEDIUM - Cannot demonstrate UI reliability

**What's Missing:**
- No React component tests
- No tests for wallet connection flow
- No tests for campaign creation form validation

---

### 4. File Upload Encryption NOT Implemented
**Status:** ❌ EXISTS BUT NOT INTEGRATED  
**Location:** `backend/utils/encryption.js` - File exists but never called  
**Impact:** HIGH - Security vulnerability (documents stored unencrypted)

**What's Missing:**
- `encryptFile()` is defined but never called in campaign routes
- Documents stored in plain format in `uploads/` directory
- No decryption when serving documents to admin

**Fix Required:**
```javascript
// In campaigns.js - After file upload:
const { encryptFile } = require('../utils/encryption');
await encryptFile(filePath); // ENCRYPT IMMEDIATELY

// When serving to admin:
const { decryptFile } = require('../utils/encryption');
const decrypted = decryptFile(filePath);
```

---

### 5. Blockchain Indexer NOT Started
**Status:** ⚠️ EXISTS BUT NOT RUNNING  
**Location:** `backend/utils/indexer.js`  
**Impact:** MEDIUM - Contract state can become out of sync

**What's Missing:**
- `startIndexer()` is never called in `server.js`
- If someone interacts with contract directly, MongoDB won't update

**Fix Required:**
```javascript
// In server.js after MongoDB connection:
const { startIndexer } = require('./utils/indexer');
startIndexer(30); // Poll every 30 seconds
```

---

## 🟡 MODERATE GAPS (Should Implement)

### 6. Hospital Verification NOT Fully Implemented
**Status:** ⚠️ PARTIAL  
**Location:** `backend/models/User.js` has fields, but no verification flow  
**Impact:** MEDIUM - Anyone can register as hospital

**What's Missing:**
- No hospital license verification
- No hospital credentials validation
- `hospitalVerificationToken` field exists but never used
- AI service `hospital_verified` flag used but no actual hospital registry check

**Implementation Required:**
```javascript
// backend/routes/hospitals.js - NEW FILE
// POST /api/hospitals/verify-license - Verify hospital license against registry
// GET /api/hospitals/pending - Admin view of pending hospital verifications
// POST /api/hospitals/:id/approve - Admin approve hospital
```

---

### 7. Risk Assessment NOT Saved for All Campaigns
**Status:** ⚠️ PARTIAL  
**Location:** `backend/routes/campaigns.js`  
**Impact:** MEDIUM - Risk score may not be persisted properly

**What's Found:**
- Campaign model has `riskAssessmentId` reference
- But AI verification happens in frontend by calling AI service directly
- Backend doesn't always create `RiskAssessment` document

**Fix Required:**
- Ensure every campaign creation saves `RiskAssessment` document
- Link campaign to risk assessment properly

---

### 8. No Rate Limiting on AI Service
**Status:** ❌ NOT IMPLEMENTED  
**Location:** `ai-service/main.py`  
**Impact:** MEDIUM - AI service can be abused

**What's Missing:**
- No rate limiting on `/verify` endpoint
- No file size validation before processing
- No cleanup of uploaded files after processing

**Fix Required:**
```python
from fastapi import Request
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@app.post("/verify")
@limiter.limit("10/minute")  # Limit to 10 requests per minute
async def verify_documents(...)
```

---

### 9. No Input Validation Library
**Status:** ⚠️ PARTIAL  
**Location:** Backend routes have manual validation  
**Impact:** LOW-MEDIUM - Potential for invalid data

**What's Found:**
- Manual validation like `if (!email || !password)` 
- No library like `joi` or `zod` for schema validation
- Frontend uses TypeScript but no runtime validation

**Recommendation:**
- Add `joi` or `zod` for backend validation
- Define schemas for all API inputs

---

### 10. KYC Flow NOT Implemented
**Status:** ❌ NOT IMPLEMENTED  
**Location:** `backend/models/User.js` has `kyc` field  
**Impact:** MEDIUM - Cannot verify user identity

**What's Missing:**
- KYC status exists in schema but no endpoints
- No document upload for KYC
- No verification workflow

---

## 🟢 MINOR GAPS (Nice to Have)

### 11. No WebSocket for Real-time Updates
**Status:** ❌ NOT IMPLEMENTED  
**Impact:** LOW - Users must refresh to see updates

**What's Missing:**
- No real-time donation notifications
- No real-time milestone confirmation updates
- Frontend polls for updates instead

---

### 12. No Email Notifications
**Status:** ❌ NOT IMPLEMENTED  
**Impact:** LOW - Users not notified of important events

**What's Missing:**
- No email on campaign approval/rejection
- No email on donation received
- No email on milestone confirmed

---

### 13. No Transaction Retry Logic
**Status:** ❌ NOT IMPLEMENT  
**Location:** `backend/utils/contractUtils.js`  
**Impact:** LOW - Failed transactions not retried

**What's Missing:**
- If blockchain transaction fails, no retry
- No exponential backoff for failed calls

---

### 14. No Logging to File
**Status:** ⚠️ PARTIAL  
**Location:** Backend uses `console.log`  
**Impact:** LOW - Logs not persisted

**What's Missing:**
- No Winston or Pino logger
- Logs not written to file
- No log rotation

---

### 15. No CI/CD Pipeline
**Status:** ❌ NOT IMPLEMENTED  
**Impact:** LOW - Manual deployment

**What's Missing:**
- No GitHub Actions workflow
- No automated testing on push
- No automated deployment

---

### 16. Frontend Environment Not Configured
**Status:** ⚠️ CHECK NEEDED  
**Location:** `frontend/.env`  
**Impact:** LOW - May not connect to backend

**What to Verify:**
- `VITE_API_URL` properly set
- Frontend can reach backend

---

## 📊 Implementation Priority Order

### Phase 1: MUST HAVE (Before Interview)
1. ✅ Smart Contract Tests
2. ✅ Backend Unit Tests (at least auth + campaigns)
3. ✅ Integrate file encryption
4. ✅ Start blockchain indexer

### Phase 2: SHOULD HAVE
5. Hospital verification flow
6. Rate limiting on AI service
7. Ensure risk assessment saved for all campaigns

### Phase 3: NICE TO HAVE
8. WebSocket real-time updates
9. Email notifications
10. CI/CD pipeline

---

## 🔧 Quick Fixes (Can Do Now)

### 1. Start Blockchain Indexer
```javascript
// Add to server.js after mongoose connection:
const { startIndexer } = require('./utils/indexer');
startIndexer(30);
```

### 2. Encrypt Uploaded Files
```javascript
// In campaigns.js, after multer upload:
const { encryptFile } = require('../utils/encryption');
for (const file of req.files) {
  await encryptFile(file.path);
}
```

### 3. Add Smart Contract Tests
```bash
mkdir -p hardhat/test
touch hardhat/test/MedTrustFundEscrow.test.js
```

---

## 📁 Files to Create

```
decentralizedCrowdFund/
├── hardhat/
│   └── test/
│       └── MedTrustFundEscrow.test.js    # NEW - Contract tests
├── backend/
│   ├── tests/                             # NEW DIRECTORY
│   │   ├── auth.test.js                   # NEW
│   │   ├── campaigns.test.js              # NEW
│   │   └── donations.test.js              # NEW
│   └── routes/
│       └── hospitals.js                    # NEW - Hospital verification
└── .github/
    └── workflows/
        └── test.yml                       # NEW - CI/CD
```

---

## 🧪 Test Coverage Goals

| Component | Current | Target |
|-----------|---------|--------|
| Smart Contract | 0% | **80%+** |
| Backend API | 0% | **70%+** |
| Frontend | 0% | **50%+** |
| AI Service | 0% | **60%+** |

---

## 📝 Interview Preparation Checklist

### Can Demonstrate:
- [x] User registration and login
- [x] Wallet connection (MetaMask)
- [x] Campaign creation
- [x] AI document verification (running locally)
- [x] Admin dashboard
- [x] Smart contract deployment
- [x] Donation flow (via contract)
- [x] Milestone confirmation

### Cannot Demonstrate (Gaps):
- [ ] Automated tests proving code works
- [ ] Encrypted file storage
- [ ] Hospital verification process
- [ ] Real-time blockchain state sync

---

## Next Steps

1. **Run:** `cd hardhat && npx hardhat test` - Will fail (no tests)
2. **Create:** Smart contract test file
3. **Create:** Backend test files with Jest/Mocha
4. **Fix:** Integrate encryption in campaign upload
5. **Fix:** Start indexer in server.js
6. **Document:** All fixes in IMPLEMENTATION_SUMMARY.md

---

**Total Gaps Found:** 16  
**Critical:** 5  
**Moderate:** 5  
**Minor:** 6

**Estimated Time to Fix Critical Gaps:** 4-6 hours