import { useEffect, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Moon, RotateCcw, Sun, Vote } from 'lucide-react'
import { ConfirmationModal } from '../components/common'
import { usePolls } from '../context/usePolls'
import { useWallet } from '../context/useWallet'

const THEME_KEY = 'decentravote.theme'

export default function Settings() {
  const { clearDemoData } = usePolls()
  const { account, chainId, isSupportedNetwork, networkName, status } = useWallet()
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')
  const [confirming, setConfirming] = useState(false)
  const walletStatus = status === 'connected' && account
    ? isSupportedNetwork ? `Connected to ${networkName}` : 'Connected · unsupported network'
    : status === 'connecting' ? 'Connecting'
      : status === 'error' ? 'Connection error'
        : 'Not connected'
  const detectedNetwork = chainId === null ? 'Not detected' : `${networkName} · ${chainId}`

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const reset = () => {
    if (clearDemoData()) setConfirming(false)
  }

  return (
    <>
      <section className="settings-layout">
        <div className="settings-main">
          <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><Moon size={18} /></span><div><h2>Appearance</h2><p>Choose the look that works for you.</p></div></div><div className="theme-choices" role="group" aria-label="Theme preference"><button className={`theme-choice ${theme === 'dark' ? 'theme-choice-selected' : ''}`} onClick={() => setTheme('dark')}><span className="theme-preview theme-preview-dark"><Moon size={17} /></span><span><strong>Dark</strong><small>Easy on the eyes</small></span>{theme === 'dark' && <Check size={16} />}</button><button className={`theme-choice ${theme === 'light' ? 'theme-choice-selected' : ''}`} onClick={() => setTheme('light')}><span className="theme-preview theme-preview-light"><Sun size={17} /></span><span><strong>Light</strong><small>Bright and clear</small></span>{theme === 'light' && <Check size={16} />}</button></div></section>
          <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><ExternalLink size={18} /></span><div><h2>Network</h2><p>On-chain reads and transactions support Hardhat Local and Sepolia.</p></div><span className="settings-status">{walletStatus}</span></div><div className="settings-detail-row"><span>Supported networks</span><strong>Hardhat Local · 31337; Sepolia · 11155111</strong></div><div className="settings-detail-row"><span>Contract configuration</span><strong>Configured for both supported networks</strong></div><div className="settings-detail-row"><span>Detected wallet network</span><strong>{detectedNetwork}</strong></div><div className="settings-detail-row"><span>Wallet provider</span><strong className="muted">{walletStatus}</strong></div><p className="settings-callout"><AlertTriangle size={15} />Demo polls and votes are stored in this browser. On-chain reads use the supported network selected in your wallet, or the Local read configuration when no wallet is connected. Transactions require a connected wallet on a supported network. RPC and contract availability depend on that network's configuration.</p></section>
          <section className="settings-card"><div className="settings-card-heading"><span className="settings-icon"><Vote size={18} /></span><div><h2>About DecentraVote</h2><p>Community decisions, made transparent.</p></div></div><div className="settings-detail-row"><span>Application</span><strong>DecentraVote</strong></div><div className="settings-detail-row"><span>Tagline</span><strong>Your voice. Your vote. On-chain.</strong></div><div className="settings-detail-row"><span>Environment</span><strong><span className="settings-green-dot" />Local demo</strong></div><div className="settings-detail-row"><span>Version</span><strong>0.1.0</strong></div></section>
        </div>
        <aside className="settings-card danger-zone"><span className="danger-icon"><RotateCcw size={18} /></span><h2>Reset demo data</h2><p>Remove your locally created polls and demo votes, then restore the original sample polls. This won't affect any blockchain data.</p><button className="button button-danger" onClick={() => setConfirming(true)}><RotateCcw size={15} /> Reset local demo</button></aside>
      </section>
      {confirming && <ConfirmationModal title="Reset all demo data?" danger confirmLabel="Reset demo data" onCancel={() => setConfirming(false)} onConfirm={reset}><p>This clears your local polls and votes from this browser and restores the sample data. <strong>This cannot be undone.</strong></p></ConfirmationModal>}
    </>
  )
}
