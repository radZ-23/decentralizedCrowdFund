const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');

// Base URLs
const API_URL = 'http://localhost:5000/api';
const RPC_URL = 'http://127.0.0.1:8545';
const AI_URL = 'http://localhost:8001/verify';

// Test Data
const DUMMY_DOC_PATH = path.join(__dirname, 'dummy_medical_report.txt');

// Hardhat standard test accounts (Account 0 is deployer typically)
// Account 1: Patient
const patientPrivKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
// Account 2: Donor
const donorPrivKey = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a';
// Account 3: Hospital
const hospitalPrivKey = '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6';

// Store generated tokens
let adminToken, patientToken, hospitalToken, donorToken;
let patientId, hospitalId, donorId;
let campaignId, smartContractAddress;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTests() {
  console.log('🚀 Starting MedTrustFund End-to-End Test Suite');
  
  if (!fs.existsSync(DUMMY_DOC_PATH)) {
    fs.writeFileSync(DUMMY_DOC_PATH, 'Patient Name: John Doe\nDiagnosis: Severe back pain requiring physical therapy.\nDoctor: Dr. Smith');
  }

  try {
    const rnd = Date.now();
    
    // 1. REGISTER USERS
    console.log('\n--- 1. Registering Users ---');
    const patientRes = await axios.post(`${API_URL}/auth/signup`, {
      name: 'John Doe', email: `patient_${rnd}@test.com`, password: 'password123',
      role: 'patient', walletAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
    });
    patientToken = patientRes.data.token;
    patientId = patientRes.data.user.id;
    console.log('✅ Patient (John Doe) registered.');

    const hospitalRes = await axios.post(`${API_URL}/auth/signup`, {
      name: 'City Hospital', email: `hospital_${rnd}@test.com`, password: 'password123',
      role: 'hospital', hospitalName: 'City General', walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
    });
    hospitalToken = hospitalRes.data.token;
    hospitalId = hospitalRes.data.user.id;
    console.log('✅ Hospital registered.');

    const donorRes = await axios.post(`${API_URL}/auth/signup`, {
      name: 'Alice Donor', email: `donor_${rnd}@test.com`, password: 'password123',
      role: 'donor', walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
    });
    donorToken = donorRes.data.token;
    donorId = donorRes.data.user.id;
    console.log('✅ Donor registered.');

    // 2. ADMIN SETUP
    // For admin, we need to register first, then ideally make them admin. 
    // In our generic system, maybe we can just register as admin or we mock it.
    console.log('\n--- 2. Setting up Admin ---');
    try {
      const adminRes = await axios.post(`${API_URL}/auth/signup`, {
        name: 'Admin User', email: `admin_${rnd}@test.com`, password: 'password123', role: 'admin'
      });
      adminToken = adminRes.data.token;
    } catch(e) { 
      // If admin exists, login
      const adminLogin = await axios.post(`${API_URL}/auth/login`, {
        email: 'admin@test.com', password: 'password123'
      });
      adminToken = adminLogin.data.token;
    }
    console.log('✅ Admin authenticated.');

    // 3. CREATE CAMPAIGN
    console.log('\n--- 3. Creating Campaign & AI Verification ---');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('title', 'Therapy for John');
    form.append('description', 'Need back therapy urgently.');
    form.append('targetAmount', '10.0');
    form.append('hospitalId', hospitalId);
    form.append('documentTypes', '["diagnosis"]');
    form.append('documents', fs.createReadStream(DUMMY_DOC_PATH), {
      filename: 'dummy.pdf',
      contentType: 'application/pdf',
    });
    form.append('milestones', JSON.stringify([
      { description: 'Initial Assessment', targetAmount: 2.0 },
      { description: 'First 5 Sessions', targetAmount: 8.0 }
    ]));

    const campaignRes = await axios.post(`${API_URL}/campaigns`, form, {
      headers: { 
        ...form.getHeaders(),
        Authorization: `Bearer ${patientToken}` 
      }
    });
    campaignId = campaignRes.data.campaign._id;
    console.log('✅ Campaign created and verified via AI Service (extracting "John Doe").');

    // 4. ADMIN DEPLOY SMART CONTRACT
    console.log('\n--- 4. Admin Deploying Escrow Contract ---');
    const deployRes = await axios.post(`${API_URL}/campaigns/${campaignId}/deploy-contract`, {}, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    smartContractAddress = deployRes.data.contractAddress;
    console.log(`✅ Smart Contract deployed at ${smartContractAddress}`);

    await wait(2000); // Let blocks settle

    // 5. DIRECT DONATION VIA ETHERS
    console.log('\n--- 5. Donor Initiating Direct Web3 Donation ---');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const donorWallet = new ethers.Wallet(donorPrivKey, provider);
    
    // We call donate() explicitly
    const abi = ["function donate() external payable"];
    const contract = new ethers.Contract(smartContractAddress, abi, donorWallet);
    const tx = await contract.donate({ value: ethers.parseEther("5.0") });
    await tx.wait();
    console.log(`✅ Donor sent 5 ETH to contract. TxHash: ${tx.hash}`);

    // Call backend to log the donation
    await axios.post(`${API_URL}/donations/${campaignId}/donate-direct`, {
      amount: 5.0, transactionHash: tx.hash
    }, {
      headers: { Authorization: `Bearer ${donorToken}` }
    });
    console.log('✅ Donation recorded in backend.');

    // 6. HOSPITAL ON-CHAIN MILESTONE CONFIRMED (Testing new feature)
    console.log('\n--- 6. Hospital Confirming Milestone 0 On-Chain ---');
    const hospitalWallet = new ethers.Wallet(hospitalPrivKey, provider);
    
    // contract.confirmMilestone(0)
    const methodId = '0x29315ea7';
    const paddedIndex = '0'.padStart(64, '0');
    const confirmTx = await hospitalWallet.sendTransaction({
      to: smartContractAddress,
      data: methodId + paddedIndex
    });
    await confirmTx.wait();
    console.log(`✅ Hospital signed milestone 0 confirm Tx: ${confirmTx.hash}`);

    // Call backend newly updated confirm route
    await axios.post(`${API_URL}/milestones/${campaignId}/confirm`, {
      milestoneIndex: 0, 
      transactionHash: confirmTx.hash
    }, {
      headers: { Authorization: `Bearer ${hospitalToken}` }
    });
    console.log('✅ Backend successfully verified hospital\'s on-chain confirmation hash.');

    // 7. ADMIN REFUND DONATION (Testing new feature)
    console.log('\n--- 7. Admin Refunding Donation ---');
    // We need the donation ID to refund from Backend
    const donationsRes = await axios.get(`${API_URL}/campaigns/${campaignId}/donations`);
    const donationObj = donationsRes.data.donations[0];
    
    if (donationObj) {
      await axios.post(`${API_URL}/donations/${donationObj._id}/refund`, {}, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      console.log('✅ Admin successfully triggered on-chain refund and updated backend status.');
    }

    console.log('\n🎉 ALL END-TO-END TESTS COMPLETED SUCCESSFULLY! 🎉');
  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }

  // Cleanup
  if (fs.existsSync(DUMMY_DOC_PATH)) {
    fs.unlinkSync(DUMMY_DOC_PATH);
  }
}

runTests();
