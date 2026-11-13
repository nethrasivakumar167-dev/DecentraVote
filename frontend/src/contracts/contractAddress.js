export const networkConfigs = {
  31337: {
    chainId: 31337,
    contractAddress: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    deploymentBlock: 0,
    readRpcUrl: "http://127.0.0.1:8545",
  },
  11155111: {
    chainId: 11155111,
    contractAddress: "0x7F9AE0FdD8FC171e34d18E2CAf2F1Fe38d2CBC43",
    deploymentBlock: 12113677,
    readRpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",
  },
};

export function getNetworkConfig(chainId) {
  if (!["number", "bigint", "string"].includes(typeof chainId)) return null;

  const numericChainId = Number(chainId);
  if (!Number.isSafeInteger(numericChainId)) return null;

  return networkConfigs[numericChainId] || null;
}

export const contractAddress = networkConfigs[31337].contractAddress;
