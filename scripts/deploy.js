const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const Voting = await ethers.getContractFactory("Voting");
  const voting = await Voting.deploy();

  await voting.waitForDeployment();

  const contractAddress = await voting.getAddress();
  console.log("Voting contract deployed successfully.");
  console.log(`Contract address: ${contractAddress}`);
  console.log(`Deployer address: ${deployer.address}`);
}

main().catch((error) => {
  console.error("Voting deployment failed:", error);
  process.exitCode = 1;
});
