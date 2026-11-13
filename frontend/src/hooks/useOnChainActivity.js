import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useWallet } from '../context/useWallet'
import {
  getReadProvider,
  ON_CHAIN_ACTIVITY_UPDATED,
  readOnChainActivity,
} from '../services/onChainPolls'

function getUnsupportedNetworkError(chainId) {
  return `Unsupported network (chain ID ${String(chainId)}). Wallet activity is available on Hardhat Local (31337) and Sepolia (11155111).`
}

export function getOnChainActivityStatus({ connected, chainId, activityMatchesWallet, activityStatus }) {
  if (!connected) return 'disconnected'
  if (chainId === null) return 'loading'
  if (chainId !== 31337 && chainId !== 11155111) return 'wrong-network'
  if (!activityMatchesWallet) return 'loading'
  return activityStatus
}

export function useOnChainActivity() {
  const { account, chainId, isSupportedNetwork, status: walletStatus } = useWallet()
  const [activity, setActivity] = useState({
    account: null,
    chainId: null,
    createdPolls: [],
    votingHistory: [],
    status: 'disconnected',
    error: null,
  })
  const requestId = useRef(0)
  const connected = walletStatus === 'connected' && Boolean(account)
  const currentWallet = useRef({ account, chainId, connected })

  useLayoutEffect(() => {
    currentWallet.current = { account, chainId, connected }
  }, [account, chainId, connected])

  const refresh = useCallback(async () => {
    const currentRequestId = ++requestId.current
    const requestWallet = { account, chainId, connected }
    const isCurrentRequest = () => {
      const current = currentWallet.current
      return requestId.current === currentRequestId
        && current.account?.toLowerCase() === requestWallet.account?.toLowerCase()
        && current.chainId === requestWallet.chainId
        && current.connected === requestWallet.connected
    }

    if (!connected) {
      setActivity({
        account: null,
        chainId: null,
        createdPolls: [],
        votingHistory: [],
        status: 'disconnected',
        error: null,
      })
      return null
    }

    if (!isSupportedNetwork) {
      const error = getUnsupportedNetworkError(chainId)
      setActivity({
        account,
        chainId,
        createdPolls: [],
        votingHistory: [],
        status: 'wrong-network',
        error,
      })
      return null
    }

    setActivity({
      account,
      chainId,
      createdPolls: [],
      votingHistory: [],
      status: 'loading',
      error: null,
    })
    try {
      const result = await readOnChainActivity(account, getReadProvider(chainId))
      if (isCurrentRequest()) {
        setActivity({
          account,
          chainId,
          ...result,
          status: 'ready',
          error: null,
        })
      }
      return result
    } catch (readError) {
      if (!isCurrentRequest()) return null
      console.error('Unable to retrieve on-chain wallet activity:', readError)
      const error = readError?.shortMessage || readError?.message || 'Unknown RPC error.'
      setActivity({
        account,
        chainId,
        createdPolls: [],
        votingHistory: [],
        status: 'error',
        error,
      })
      return null
    }
  }, [account, chainId, connected, isSupportedNetwork])

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    const handleActivityUpdated = () => { void refresh() }
    const handleWindowFocus = () => { void refresh() }
    window.addEventListener(ON_CHAIN_ACTIVITY_UPDATED, handleActivityUpdated)
    window.addEventListener('focus', handleWindowFocus)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener(ON_CHAIN_ACTIVITY_UPDATED, handleActivityUpdated)
      window.removeEventListener('focus', handleWindowFocus)
      requestId.current += 1
    }
  }, [refresh])

  const activityMatchesWallet = connected
    && activity.account?.toLowerCase() === account.toLowerCase()
    && activity.chainId === chainId
  const status = getOnChainActivityStatus({
    connected,
    chainId,
    activityMatchesWallet,
    activityStatus: activity.status,
  })

  return {
    createdPolls: status === 'ready' ? activity.createdPolls : [],
    votingHistory: status === 'ready' ? activity.votingHistory : [],
    status,
    error: status === 'wrong-network'
      ? activity.error || getUnsupportedNetworkError(chainId)
      : status === 'error' ? activity.error : null,
    refresh,
  }
}
