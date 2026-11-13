import { createContext } from 'react'

export function getWalletNetwork(chainId) {
  if (chainId === 31337) {
    return {
      isLocalNetwork: true,
      isSepoliaNetwork: false,
      isSupportedNetwork: true,
      networkName: 'Hardhat Local',
    }
  }

  if (chainId === 11155111) {
    return {
      isLocalNetwork: false,
      isSepoliaNetwork: true,
      isSupportedNetwork: true,
      networkName: 'Sepolia',
    }
  }

  return {
    isLocalNetwork: chainId === null ? null : false,
    isSepoliaNetwork: false,
    isSupportedNetwork: false,
    networkName: 'Unsupported Network',
  }
}

export const WalletContext = createContext(null)
