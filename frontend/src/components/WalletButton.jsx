import { LoaderCircle, Wallet } from 'lucide-react'
import { usePolls } from '../context/usePolls'
import { useWallet } from '../context/useWallet'

export default function WalletButton({ className = 'wallet-button' }) {
  const { notify } = usePolls()
  const { account, connect, disconnect, error, status } = useWallet()
  const connected = status === 'connected'
  const label = connected
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : status === 'connecting'
      ? 'Connecting…'
      : status === 'error'
        ? 'Connection error'
        : 'Connect wallet'
  const title = connected
    ? `Disconnect wallet ${account}`
    : status === 'error'
      ? error
      : label

  const handleClick = async () => {
    if (connected) {
      disconnect()
      notify('Wallet disconnected from this app.', 'info')
      return
    }
    const result = await connect()
    if (!result.ok) notify(result.error, 'error')
  }

  return (
    <button
      type="button"
      className={`${className}${connected ? ' wallet-button-connected' : ''}`}
      onClick={handleClick}
      disabled={status === 'connecting'}
      aria-label={connected ? `Disconnect wallet ${account}` : label}
      title={title}
    >
      {status === 'connecting' ? <LoaderCircle size={16} className="wallet-spinner" /> : <Wallet size={16} />}
      <span>{label}</span>
    </button>
  )
}
