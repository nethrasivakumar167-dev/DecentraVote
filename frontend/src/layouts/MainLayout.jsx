import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  BarChart3, ChevronRight, Compass, LayoutDashboard, Menu, Plus, Settings2, UserRound, Vote, X,
} from 'lucide-react'
import Brand from '../components/Brand'
import WalletButton from '../components/WalletButton'
import { ToastNotification } from '../components/common'
import { usePolls } from '../context/usePolls'
import { useWallet } from '../context/useWallet'

const navigation = [
  { label: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Explore polls', path: '/explore', icon: Compass },
  { label: 'Create a poll', path: '/create', icon: Plus },
  { label: 'Results', path: '/results', icon: BarChart3 },
]

const secondaryNavigation = [
  { label: 'My profile', path: '/profile', icon: UserRound },
  { label: 'Settings', path: '/settings', icon: Settings2 },
]

function Sidebar({ open, onClose }) {
  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand"><Brand /><button className="mobile-close" onClick={onClose} aria-label="Close menu"><X size={19} /></button></div>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navigation.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`} onClick={onClose}><Icon size={18} /><span>{label}</span>{path === '/create' && <span className="nav-shortcut">+</span>}</NavLink>)}
        </nav>
        <div className="sidebar-label sidebar-label-account">ACCOUNT</div>
        <nav className="side-nav" aria-label="Account navigation">
          {secondaryNavigation.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : ''}`} onClick={onClose}><Icon size={18} /><span>{label}</span></NavLink>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-demo-card"><span className="demo-orbit"><Vote size={16} /></span><strong>Demo environment</strong><p>Votes are simulated locally in your browser.</p><span className="demo-label"><i /> Local simulation</span></div>
          <div className="sidebar-footer">Built for open communities <span>✦</span></div>
        </div>
      </aside>
    </>
  )
}

function PageTitle({ pathname }) {
  const knownTitles = {
    '/': ['Good things happen when everyone has a say.', 'Shape the decisions that move your community forward.'],
    '/explore': ['Explore polls', 'Discover what communities are deciding right now.'],
    '/create': ['Create a poll', 'Bring your community into the conversation.'],
    '/results': ['Poll results', 'A transparent view of every community decision.'],
    '/profile': ['My profile', 'Your activity across the DecentraVote demo.'],
    '/settings': ['Settings', 'Manage your preferences and demo data.'],
  }
  const [title, subtitle] = knownTitles[pathname] || ['Poll details', 'Review the question and cast your vote.']
  return <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> DECENTRAVOTE COMMUNITY</div><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-art" aria-hidden="true"><span /><i /><b /></div></div>
}

export default function MainLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { pathname } = useLocation()
  const { toasts, dismissToast } = usePolls()
  const { account, chainId, isLocalNetwork, isSepoliaNetwork, isSupportedNetwork, networkName } = useWallet()
  const dashboardShell = pathname === '/' ? 'dv-shell-dashboard' : ''
  const networkLabel = account
    ? isLocalNetwork ? 'Hardhat Local' : isSepoliaNetwork ? 'Sepolia' : isSupportedNetwork ? networkName : 'Unsupported Network'
    : 'Connect Wallet'
  const networkDetail = account ? String(chainId) : 'network required'
  const networkTitle = account
    ? `${networkLabel} (chain ID ${chainId}).`
    : 'Connect MetaMask to view the connected network.'
  return (
    <div className={`app-shell flex min-h-screen ${dashboardShell}`}>
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{pathname.startsWith('/poll/') ? 'Poll details' : pathname === '/' ? 'Overview' : navigation.concat(secondaryNavigation).find((item) => item.path === pathname)?.label || pathname.slice(1)}</strong></div>
          <div className="topbar-actions"><span className={`network-pill ${account ? isSupportedNetwork ? 'network-pill-connected' : 'network-pill-warning' : ''}`} title={networkTitle}><i /> {networkLabel} <span className="network-demo">{networkDetail}</span></span><WalletButton /></div>
        </header>
        <main className="page-content">
          <PageTitle pathname={pathname} />
          <Outlet />
          <footer className="page-footer"><span>© 2026 DecentraVote</span><span>Your voice. Your vote. On-chain.</span><span className="footer-demo"><i /> Demo mode</span></footer>
        </main>
      </div>
      <ToastNotification toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
