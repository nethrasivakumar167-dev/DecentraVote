import { getNetworkConfig } from '../contracts/contractAddress'

function parseChainId(chainId) {
  try {
    if (typeof chainId === 'string' && chainId.trim() === '') return null
    return BigInt(chainId)
  } catch {
    return null
  }
}

export async function sendOnLiveTransactionNetwork({ expectedChainId, ethereum, provider, signer, contract, send }) {
  const expectedNetwork = getNetworkConfig(expectedChainId)
  if (!expectedNetwork) {
    throw new Error(`Unsupported network (chain ID ${String(expectedChainId)}). Switch MetaMask to Hardhat Local (chain ID 31337) or Sepolia (chain ID 11155111).`)
  }

  if (!ethereum?.request || window.ethereum !== ethereum) {
    throw new Error('MetaMask is no longer available. Reconnect your wallet and try again.')
  }
  if (signer?.provider !== provider || contract?.runner !== signer || contract.runner?.provider !== provider) {
    throw new Error('The signer, provider, and contract are not connected to the same wallet. Reconnect your wallet and try again.')
  }
  if (
    typeof contract.target !== 'string'
    || contract.target.toLowerCase() !== expectedNetwork.contractAddress.toLowerCase()
  ) {
    throw new Error('The Voting contract does not match the selected network.')
  }

  const providerNetwork = await provider.getNetwork()
  const signerNetwork = await signer.provider.getNetwork()
  const contractNetwork = await contract.runner.provider.getNetwork()

  const liveChainId = parseChainId(await ethereum.request({ method: 'eth_chainId' }))
  if (window.ethereum !== ethereum) {
    throw new Error('The active MetaMask provider changed. Reconnect your wallet and try again.')
  }
  if (liveChainId === null) {
    throw new Error('Unable to determine MetaMask’s current network. Check MetaMask and try again.')
  }

  const liveNetwork = getNetworkConfig(liveChainId)
  if (!liveNetwork) {
    throw new Error(`Unsupported network (chain ID ${liveChainId}). Switch MetaMask to Hardhat Local (chain ID 31337) or Sepolia (chain ID 11155111).`)
  }

  const expectedId = BigInt(expectedNetwork.chainId)
  if (
    liveChainId !== expectedId
    || BigInt(providerNetwork.chainId) !== expectedId
    || BigInt(signerNetwork.chainId) !== expectedId
    || BigInt(contractNetwork.chainId) !== expectedId
  ) {
    throw new Error(`MetaMask, the signer, provider, and Voting contract must all be on ${expectedNetwork.chainId === 31337 ? 'Hardhat Local' : 'Sepolia'} (chain ID ${expectedId}). Reconnect your wallet and try again.`)
  }

  return send()
}
