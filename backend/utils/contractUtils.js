const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

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
 * Deploy MedTrustFundEscrow contract
 */
async function deployEscrowContract(patientAddress, hospitalAddress, milestones) {
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

/**
 * Confirm milestone on-chain
 */
async function confirmMilestoneOnChain(contractAddress, milestoneIndex, hospitalWallet) {
  const { signer } = getProviderAndSigner();

  // Hospital needs to sign this transaction
  const hospitalSigner = new ethers.Wallet(hospitalWallet.privateKey, signer.provider);
  const contract = getContractInstance(contractAddress, hospitalSigner);

  console.log(`Confirming milestone ${milestoneIndex}...`);
  const tx = await contract.confirmMilestone(milestoneIndex);
  const receipt = await tx.wait();

  console.log(`Milestone confirmed in tx: ${receipt.hash}`);

  return {
    transactionHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed.toString(),
  };
}

/**
 * Release milestone funds on-chain
 */
async function releaseMilestoneOnChain(contractAddress, milestoneIndex) {
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
 * Refund a donation on-chain
 */
async function refundDonationOnChain(contractAddress, donorAddress, amountInWei) {
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
}

/**
 * Get all milestones from contract
 */
async function getContractMilestones(contractAddress) {
  const contract = getContractInstance(contractAddress);
  const milestones = await contract.getMilestones();

  return milestones.map(m => ({
    description: m.description,
    amount: ethers.formatEther(m.amount),
    confirmed: m.confirmed,
    releasedAt: m.releasedAt.toString(),
  }));
}

module.exports = {
  loadContractArtifact,
  getProviderAndSigner,
  deployEscrowContract,
  getContractInstance,
  confirmMilestoneOnChain,
  releaseMilestoneOnChain,
  refundDonationOnChain,
  getContractBalance,
  getContractMilestones,
};
