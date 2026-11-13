require("dotenv").config();
require("@nomicfoundation/hardhat-toolbox");

const networkArgumentIndex = process.argv.indexOf("--network");
const sepoliaSelected = process.argv.includes("--network=sepolia")
  || (networkArgumentIndex !== -1 && process.argv[networkArgumentIndex + 1] === "sepolia");
const missingSepoliaVariables = ["SEPOLIA_RPC_URL", "PRIVATE_KEY"]
  .filter((name) => !process.env[name]);

if (sepoliaSelected && missingSepoliaVariables.length > 0) {
  throw new Error(
    `Sepolia configuration is incomplete. Set the required environment variable(s): ${missingSepoliaVariables.join(", ")}.`,
  );
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ...(process.env.SEPOLIA_RPC_URL && process.env.PRIVATE_KEY
      ? {
          sepolia: {
            url: process.env.SEPOLIA_RPC_URL,
            chainId: 11155111,
            accounts: [process.env.PRIVATE_KEY],
          },
        }
      : {}),
  },
};
