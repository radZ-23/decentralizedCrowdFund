const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1 second
const MAX_DELAY_MS = 10000; // 10 seconds

/**
 * Sleep for a specified duration
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoffDelay(attempt) {
  const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 0.2 * exponentialDelay; // 20% jitter
  return Math.min(exponentialDelay + jitter, MAX_DELAY_MS);
}

/**
 * Execute a function with retry logic and exponential backoff
 * @param {Function} fn - Async function to execute
 * @param {string} operationName - Name of the operation for logging
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<any>} - Result of the function
 */
async function executeWithRetry(fn, operationName, maxRetries = MAX_RETRIES) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        const delay = calculateBackoffDelay(attempt - 1);
        console.log(`[${operationName}] Retry attempt ${attempt}/${maxRetries}, waiting ${Math.round(delay)}ms...`);
        await sleep(delay);
      }

      const result = await fn();
      if (attempt > 0) {
        console.log(`[${operationName}] Succeeded after ${attempt} retries`);
      }
      return result;

    } catch (error) {
      lastError = error;
      console.warn(`[${operationName}] Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`);

      // Don't retry on certain errors
      if (error.code === 'INSUFFICIENT_FUNDS' || error.code === 'UNPREDICTABLE_GAS_LIMIT') {
        throw error;
      }
    }
  }

  throw new Error(`[${operationName}] Failed after ${maxRetries + 1} attempts. Last error: ${lastError.message}`);
}

/**
 * Load compiled contract artifact from Hardhat
 */
function loadContractArtifact(contractName = 'MedTrustFundEscrow') {
  const artifactPath = path.join(__dirname, '../../hardhat/artifacts/contracts', `${contractName}.sol`, `${contractName}.json`);

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Contract artifact not found at ${artifactPath}. Run 'npx hardhat compile' first.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  return {
    abi: artifact.abi,
    bytecode: artifact.bytecode,
  };
}

/**
 * Get provider and signer from environment
 */
function getProviderAndSigner() {
  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545';
  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('PRIVATE_KEY not set in environment');
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(privateKey, provider);

  return { provider, signer };
}

/**
 * Deploy MedTrustFundEscrow contract with retry logic
 */
async function deployEscrowContract(patientAddress, hospitalAddress, milestones) {
  // If a factory contract is configured, use it for cheaper deploys
  if (process.env.FACTORY_CONTRACT_ADDRESS) {
    return deployEscrowViaFactory(patientAddress, hospitalAddress, milestones);
  }

  return executeWithRetry(async () => {
    const { signer } = getProviderAndSigner();
    const { abi, bytecode } = loadContractArtifact();

    // Extract milestone data
    const descriptions = milestones.map(m => m.description);
    const amounts = milestones.map(m => ethers.parseEther(m.targetAmount.toString()));

    console.log(`Deploying contract for patient: ${patientAddress}, hospital: ${hospitalAddress}`);
    console.log(`Milestones: ${descriptions.length} milestones, total: ${amounts.reduce((a, b) => a + b, 0n)} wei`);

    // Create contract factory
    const factory = new ethers.ContractFactory(abi, bytecode, signer);

    // Deploy contract
    const contract = await factory.deploy(
      patientAddress,
      hospitalAddress,
      descriptions,
      amounts
    );

    console.log('Waiting for contract deployment...');
    const deploymentReceipt = await contract.waitForDeployment();
    const contractAddress = await deploymentReceipt.getAddress();
    const deploymentTx = deploymentReceipt.deploymentTransaction();

    console.log(`Contract deployed at: ${contractAddress}`);
    console.log(`Transaction hash: ${deploymentTx.hash}`);

    return {
      contractAddress,
      transactionHash: deploymentTx.hash,
      abi,
      contract: deploymentReceipt,
    };
  }, 'DeployEscrowContract');
}

/**
 * Deploy escrow via the MedTrustFundFactory contract (cheaper, ~60% gas savings)
 * Requires FACTORY_CONTRACT_ADDRESS env var to be set.
 */
async function deployEscrowViaFactory(patientAddress, hospitalAddress, milestones) {
  return executeWithRetry(async () => {
    const { signer } = getProviderAndSigner();
    const factoryAddress = process.env.FACTORY_CONTRACT_ADDRESS;

    if (!factoryAddress) {
      throw new Error('FACTORY_CONTRACT_ADDRESS not set — cannot use factory deploy');
    }

    // Load factory ABI
    const factoryArtifactPath = path.join(
      __dirname,
      '../../hardhat/artifacts/contracts/MedTrustFundFactory.sol/MedTrustFundFactory.json'
    );
    if (!fs.existsSync(factoryArtifactPath)) {
      throw new Error(`Factory artifact not found at ${factoryArtifactPath}. Run 'npx hardhat compile' first.`);
    }
    const factoryArtifact = JSON.parse(fs.readFileSync(factoryArtifactPath, 'utf8'));

    const factoryContract = new ethers.Contract(factoryAddress, factoryArtifact.abi, signer);

    const descriptions = milestones.map(m => m.description);
    const amounts = milestones.map(m => ethers.parseEther(m.targetAmount.toString()));

    console.log(`[Factory] Deploying escrow via factory at ${factoryAddress}`);
    console.log(`Patient: ${patientAddress}, Hospital: ${hospitalAddress}`);
    console.log(`Milestones: ${descriptions.length}`);

    const tx = await factoryContract.deployCampaign(
      patientAddress,
      hospitalAddress,
      descriptions,
      amounts
    );

    const receipt = await tx.wait();

    // Parse the CampaignDeployed event to get the escrow address
    const deployEvent = receipt.logs.find(log => {
      try {
        const parsed = factoryContract.interface.parseLog(log);
        return parsed && parsed.name === 'CampaignDeployed';
      } catch { return false; }
    });

    let escrowAddress;
    if (deployEvent) {
      const parsed = factoryContract.interface.parseLog(deployEvent);
      escrowAddress = parsed.args.escrowAddress;
    } else {
      // Fallback: read latest campaign from factory
      const count = await factoryContract.campaignCount();
      const campaign = await factoryContract.campaigns(count - 1n);
      escrowAddress = campaign.escrowAddress;
    }

    const { abi } = loadContractArtifact();

    console.log(`[Factory] Escrow deployed at: ${escrowAddress}`);
    console.log(`[Factory] Transaction hash: ${receipt.hash}`);

    return {
      contractAddress: escrowAddress,
      transactionHash: receipt.hash,
      abi,
      factoryAddress,
    };
  }, 'DeployEscrowViaFactory');
}

/**
 * Get contract instance for interaction
 */
function getContractInstance(contractAddress, customSigner = null) {
  const { abi } = loadContractArtifact();
  const { signer } = getProviderAndSigner();

  const contract = new ethers.Contract(contractAddress, abi, customSigner || signer);
  return contract;
}

async function confirmMilestoneOnChain(contractAddress, milestoneIndex, hospitalAddressOrWallet) {
  return executeWithRetry(async () => {
    const { signer, provider } = getProviderAndSigner();
    let hospitalSigner;

    if (typeof hospitalAddressOrWallet === 'string') {
      try {
        console.log(`Impersonating hospital address ${hospitalAddressOrWallet} for testing bypass...`);
        await provider.send("hardhat_impersonateAccount", [hospitalAddressOrWallet]);
        hospitalSigner = await provider.getSigner(hospitalAddressOrWallet);
        
        // Give the impersonated account some ETH for gas just in case
        await provider.send("hardhat_setBalance", [
          hospitalAddressOrWallet,
          "0xde0b6b3a7640000" // 1 ETH
        ]);
      } catch (err) {
        console.error("Impersonation failed! Are you running on localhost/hardhat node?", err);
        throw new Error("Failed to impersonate hospital address: " + err.message);
      }
    } else if (hospitalAddressOrWallet && hospitalAddressOrWallet.privateKey) {
      // Real wallet scenario
      hospitalSigner = new ethers.Wallet(hospitalAddressOrWallet.privateKey, provider);
    } else {
      throw new Error("Missing hospital wallet or address to confirm milestone on-chain");
    }

    const contract = getContractInstance(contractAddress, hospitalSigner);

    console.log(`Confirming milestone ${milestoneIndex}...`);
    const tx = await contract.confirmMilestone(milestoneIndex);
    const receipt = await tx.wait();

    console.log(`Milestone confirmed in tx: ${receipt.hash}`);

    // Stop impersonating
    if (typeof hospitalAddressOrWallet === 'string') {
      await provider.send("hardhat_stopImpersonatingAccount", [hospitalAddressOrWallet]).catch(() => {});
    }

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  }, `ConfirmMilestone_${milestoneIndex}`);
}

/**
 * Release milestone funds on-chain with retry logic
 */
async function releaseMilestoneOnChain(contractAddress, milestoneIndex) {
  return executeWithRetry(async () => {
    const { signer } = getProviderAndSigner();
    const contract = getContractInstance(contractAddress, signer);

    console.log(`Releasing funds for milestone ${milestoneIndex}...`);
    const tx = await contract.releaseMilestone(milestoneIndex);
    const receipt = await tx.wait();

    console.log(`Funds released in tx: ${receipt.hash}`);

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  }, `ReleaseMilestone_${milestoneIndex}`);
}

/**
 * Get contract balance
 */
async function getContractBalance(contractAddress) {
  const { provider } = getProviderAndSigner();
  const balance = await provider.getBalance(contractAddress);
  return ethers.formatEther(balance);
}

/**
 * Refund a donation on-chain with retry logic
 */
async function refundDonationOnChain(contractAddress, donorAddress, amountInWei) {
  return executeWithRetry(async () => {
    const { signer } = getProviderAndSigner();
    const contract = getContractInstance(contractAddress, signer);

    console.log(`Refunding on contract ${contractAddress} to ${donorAddress}...`);
    const tx = await contract.refund(donorAddress, amountInWei);
    const receipt = await tx.wait();

    console.log(`Refund complete in tx: ${receipt.hash}`);

    return {
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
    };
  }, `RefundDonation_${donorAddress}`);
}

/**
 * Get all milestones from contract with retry logic
 */
async function getContractMilestones(contractAddress) {
  return executeWithRetry(async () => {
    const contract = getContractInstance(contractAddress);
    const milestones = await contract.getMilestones();

    return milestones.map(m => ({
      description: m.description,
      amount: ethers.formatEther(m.amount),
      confirmed: m.confirmed,
      releasedAt: m.releasedAt.toString(),
    }));
  }, 'GetContractMilestones');
}

module.exports = {
  loadContractArtifact,
  getProviderAndSigner,
  deployEscrowContract,
  deployEscrowViaFactory,
  getContractInstance,
  confirmMilestoneOnChain,
  releaseMilestoneOnChain,
  refundDonationOnChain,
  getContractBalance,
  getContractMilestones,
  executeWithRetry, // Export for external use
  calculateBackoffDelay, // Export for testing
};

