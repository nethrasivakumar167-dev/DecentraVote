import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getWalletNetwork, WalletContext } from './WalletContext'

const INITIAL_WALLET = {
  status: 'disconnected',
  account: null,
  chainId: null,
  provider: null,
  error: null,
}

function getErrorMessage(error) {
  const code = error?.code ?? error?.info?.error?.code ?? error?.error?.code
  if (code === 4001) return 'Connection request was rejected in MetaMask.'
  return error?.shortMessage || error?.message || 'An unexpected error occurred while connecting.'
}

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(INITIAL_WALLET)
  const providerRef = useRef(null)

  useEffect(() => {
    const ethereum = window.ethereum
    if (!ethereum?.request) return undefined

    let active = true
    let cleanupListeners = () => {}

    import('ethers')
      .then(({ BrowserProvider }) => {
        if (!active) return

        let accountsChanged = false
        let chainChanged = false
        const provider = providerRef.current || new BrowserProvider(window.ethereum, "any")
        providerRef.current = provider

        const handleAccountsChanged = (accounts) => {
          accountsChanged = true
          if (!active) return
          const account = accounts[0] || null
          setWallet((current) => ({
            ...current,
            status: account ? 'connected' : 'disconnected',
            account,
            provider: account ? provider : null,
            error: null,
          }))
        }

        const handleChainChanged = (chainId) => {
          chainChanged = true
          if (!active) return
          const parsedChainId = Number.parseInt(chainId, 16)
          if (!Number.isSafeInteger(parsedChainId)) {
            const error = new Error(`MetaMask reported an invalid chain ID: ${chainId}`)
            console.error('Unable to read the MetaMask network:', error)
            setWallet((current) => ({ ...current, status: 'error', error: 'MetaMask reported an invalid network.' }))
            return
          }
          setWallet((current) => ({ ...current, chainId: parsedChainId }))
        }

        ethereum.on?.('accountsChanged', handleAccountsChanged)
        ethereum.on?.('chainChanged', handleChainChanged)
        cleanupListeners = () => {
          ethereum.removeListener?.('accountsChanged', handleAccountsChanged)
          ethereum.removeListener?.('chainChanged', handleChainChanged)
          if (providerRef.current === provider) providerRef.current = null
        }

        return Promise.all([provider.send('eth_accounts', []), provider.getNetwork()])
          .then(([accounts, network]) => {
            if (!active) return
            setWallet((current) => {
              const account = accountsChanged ? current.account : accounts[0] || null
              return {
                ...current,
                status: accountsChanged ? current.status : account ? 'connected' : 'disconnected',
                account,
                chainId: chainChanged ? current.chainId : Number(network.chainId),
                provider: account ? provider : null,
                error: null,
              }
            })
          })
          .catch((error) => {
            if (!active) return
            console.error('Unable to initialize the MetaMask connection:', error)
            setWallet((current) => ({ ...current, status: 'error', error: getErrorMessage(error) }))
          })
      })
      .catch((error) => {
        if (!active) return
        console.error('Unable to initialize the MetaMask connection:', error)
        setWallet((current) => ({ ...current, status: 'error', error: getErrorMessage(error) }))
      })

    return () => {
      active = false
      cleanupListeners()
    }
  }, [])

  const connect = useCallback(async () => {
    const ethereum = window.ethereum
    if (!ethereum?.request) {
      const error = 'MetaMask was not detected. Install or enable MetaMask to connect.'
      setWallet({ ...INITIAL_WALLET, status: 'error', error })
      return { ok: false, error }
    }

    setWallet((current) => ({ ...current, status: 'connecting', error: null }))
    try {
      const { BrowserProvider } = await import('ethers')
      const provider = providerRef.current || new BrowserProvider(window.ethereum, "any")
      providerRef.current = provider
      const accounts = await provider.send('eth_requestAccounts', [])
      if (!accounts[0]) {
        const error = 'MetaMask did not provide an account. Unlock the wallet and try again.'
        setWallet((current) => ({ ...current, status: 'error', account: null, provider: null, error }))
        return { ok: false, error }
      }
      const network = await provider.getNetwork()
      setWallet({
        status: 'connected',
        account: accounts[0],
        chainId: Number(network.chainId),
        provider,
        error: null,
      })
      return { ok: true }
    } catch (error) {
      const message = getErrorMessage(error)
      const code = error?.code ?? error?.info?.error?.code ?? error?.error?.code
      if (code !== 4001) console.error('Unable to connect to MetaMask:', error)
      setWallet((current) => ({ ...current, status: 'error', account: null, provider: null, error: message }))
      return { ok: false, error: message }
    }
  }, [])

  const disconnect = useCallback(() => {
    setWallet(INITIAL_WALLET)
  }, [])

  const value = useMemo(() => ({
    ...wallet,
    ...getWalletNetwork(wallet.chainId),
    connect,
    disconnect,
  }), [wallet, connect, disconnect])

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}
