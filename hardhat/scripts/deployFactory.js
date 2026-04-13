/**
 * Deploy MedTrustFundFactory to a network.
 *
 * Usage:
 *   npx hardhat run scripts/deployFactory.js --network sepolia
 *   npx hardhat run scripts/deployFactory.js --network amoy
 *   npx hardhat run scripts/deployFactory.js                   (localhost)
 *
 * After deploying, copy the factory address to your backend .env:
 *   FACTORY_CONTRACT_ADDRESS=0x...
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying MedTrustFundFactory with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");

  const Factory = await ethers.getContractFactory("MedTrustFundFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ MedTrustFundFactory deployed at:", factoryAddress);
  console.log("");
  console.log("👉 Add this to your backend .env:");
  console.log(`   FACTORY_CONTRACT_ADDRESS=${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
