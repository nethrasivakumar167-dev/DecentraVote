import { useCallback, useEffect, useRef, useState } from 'react'
import { useWallet } from '../context/useWallet'
import { getReadProvider, readOnChainPolls } from '../services/onChainPolls'

const SUPPORTED_CHAIN_IDS = [31337, 11155111]

export function useOnChainPolls({ readOnly = false } = {}) {
  const { account, chainId, status: walletStatus, isLocalNetwork, error: walletError } = useWallet()
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(readOnly)
  const [error, setError] = useState(null)
  const activeRequest = useRef(null)
  const isWalletConnected = walletStatus === 'connected' && Boolean(account)
  const selectedChainId = isWalletConnected ? chainId : readOnly ? 31337 : null
  const isSupportedNetwork = SUPPORTED_CHAIN_IDS.includes(Number(selectedChainId))
  const networkError = isWalletConnected && !isSupportedNetwork
    ? `Unsupported wallet network (chain ID ${chainId ?? 'unknown'}). Switch MetaMask to Hardhat Local (31337) or Sepolia (11155111).`
    : null
  const activeProvider = selectedChainId !== null && isSupportedNetwork
    ? getReadProvider(Number(selectedChainId))
    : null
  const requestContext = `${walletStatus}:${account ?? ''}:${chainId ?? ''}`

  const refresh = useCallback(async () => {
    const request = { context: requestContext }
    activeRequest.current = request

    if (networkError) {
      setPolls([])
      setLoading(false)
      setError(networkError)
      return null
    }

    if (!activeProvider) {
      setPolls([])
      setLoading(false)
      setError(null)
      return null
    }

    setPolls([])
    setLoading(true)
    setError(null)
    try {
      const onChainPolls = await readOnChainPolls(activeProvider)
      if (activeRequest.current !== request) return null
      setPolls(onChainPolls)
      return onChainPolls
    } catch (readError) {
      if (activeRequest.current !== request) return null
      console.error('Unable to retrieve polls from the Voting contract:', readError)
      const details = readError?.shortMessage || readError?.message || 'Unknown RPC error.'
      if (readOnly && selectedChainId === 31337) {
        setError(`Unable to connect to the Hardhat Local RPC at http://127.0.0.1:8545 or read the Voting contract. Start the local node and check the contract deployment. ${details}`)
      } else if (readOnly) {
        setError(`Unable to read the Voting contract on Sepolia (chain ID ${selectedChainId}). ${details}`)
      } else {
        setError(details)
      }
      return null
    } finally {
      if (activeRequest.current === request) {
        setLoading(false)
      }
    }
  }, [activeProvider, networkError, readOnly, requestContext, selectedChainId])

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0)
    return () => {
      window.clearTimeout(timer)
      activeRequest.current = null
    }
  }, [refresh])

  return { polls, loading, error, refresh, account, chainId, walletStatus, walletError, isLocalNetwork, readOnly }
}
