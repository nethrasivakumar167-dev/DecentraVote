import { useMemo } from 'react'
import { Check, Clock3, Copy, ExternalLink, Plus, RefreshCw, Vote, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, PollCard } from '../components/common'
import WalletButton from '../components/WalletButton'
import { usePolls } from '../context/usePolls'
import { useWallet } from '../context/useWallet'
import { useOnChainActivity } from '../hooks/useOnChainActivity'

export default function Profile() {
  const { polls, identity, notify } = usePolls()
  const { account, chainId, error, isSupportedNetwork, networkName, status } = useWallet()
  const activity = useOnChainActivity()
  const created = useMemo(() => polls.filter((poll) => poll.createdBy === identity), [polls, identity])
  const votes = useMemo(() => polls.flatMap((poll) => (poll.voterVotes || []).filter((vote) => vote.identity === identity).map((vote) => ({ poll, option: poll.options[vote.optionIndex]?.text }))), [polls, identity])
  const walletStatus = status === 'connected'
    ? isSupportedNetwork ? `Connected to ${networkName}` : 'Unsupported network'
    : status === 'connecting' ? 'Connecting'
      : status === 'error' ? 'Connection error'
        : 'Disconnected'
  const networkLabel = account
    ? isSupportedNetwork ? `${networkName} · ${chainId}` : `Unsupported Network · ${chainId}`
    : chainId === null ? 'No network detected' : `${networkName} · ${chainId} (not connected)`
  const shortenedAccount = account ? `${account.slice(0, 6)}…${account.slice(-4)}` : 'Not connected'
  const copyIdentity = async () => {
    try {
      await navigator.clipboard.writeText(identity)
      notify('Demo identity copied to clipboard.')
    } catch (error) {
      console.error('Unable to copy demo identity:', error)
      notify('Clipboard access is unavailable in this browser.', 'error')
    }
  }
  return (
    <section className="section-block page-section">
      <div className="profile-hero"><div className="profile-avatar"><Wallet size={23} /></div><div className="profile-info"><span className="section-kicker">YOUR PARTICIPATION</span><h2>Community member</h2><p>Demo identity · {account ? shortenedAccount : 'no wallet connected'}</p></div><span className="disconnected-pill"><i /> {walletStatus}</span></div>
      <div className="profile-layout">
        <div className="profile-content">
          <section className="profile-card"><div className="section-heading section-heading-row"><div><h3>Wallet & network</h3><p>Connect MetaMask on Hardhat Local (31337) or Sepolia (11155111) to use on-chain features.</p></div><span className={`network-pill ${account ? isSupportedNetwork ? 'network-pill-connected' : 'network-pill-warning' : ''}`}><i /> {networkLabel}</span></div><div className="wallet-address-row"><div><span className="meta-label">WALLET ADDRESS</span><strong>{shortenedAccount}</strong></div><WalletButton className="button button-quiet" /></div>{status === 'error' && <p className="profile-wallet-error">{error}</p>}<p className="profile-disclaimer"><ExternalLink size={14} /> A locally stored demo identity is used only to prevent repeat demo votes. It is not a wallet address.</p></section>
          <section className="section-block profile-activity">
            <div className="section-heading section-heading-row">
              <div><div className="section-kicker">ON-CHAIN HISTORY</div><h2>Wallet activity</h2><p>Activity read from the currently connected supported network.</p></div>
              <button className="button button-secondary" type="button" onClick={() => { void activity.refresh() }} disabled={activity.status === 'loading'}><RefreshCw size={15} /> Refresh</button>
            </div>
            {activity.status === 'loading' && <div className="chain-activity-state" role="status">Loading wallet activity from the connected network…</div>}
            {activity.status === 'disconnected' && <div className="chain-activity-state" role="status"><span>Connect MetaMask to see on-chain activity for your wallet.</span><WalletButton className="button button-secondary" /></div>}
            {activity.status === 'wrong-network' && <div className="chain-activity-state" role="alert">{activity.error}</div>}
            {activity.status === 'error' && <div className="chain-activity-state chain-activity-error" role="alert"><span>Could not load on-chain activity: {activity.error}</span><button className="button button-quiet" type="button" onClick={() => { void activity.refresh() }}>Try again</button></div>}
            {activity.status === 'ready' && (
              <div className="profile-chain-activity">
                <section>
                  <div className="section-heading"><div><div className="section-kicker">CREATED ON-CHAIN</div><h3>On-chain Created Polls</h3></div></div>
                  {activity.createdPolls.length ? (
                    <div className="activity-list">
                      {activity.createdPolls.map((poll) => (
                        <Link className="activity-item" key={`${poll.transactionHash}-${poll.pollId}`} to={`/poll/${poll.pollId}`}>
                          <span className="activity-icon"><Plus size={16} /></span>
                          <span className="activity-copy">
                            <strong>{poll.question}</strong>
                            <small>Poll #{poll.pollId} · Creator {poll.creator.slice(0, 6)}…{poll.creator.slice(-4)}</small>
                            <small><Clock3 size={12} /> {new Date(poll.timestamp).toLocaleString()} · Block {poll.blockNumber}</small>
                            <small>Options: {poll.options.join(' · ')}</small>
                            <small>Transaction <code className="activity-transaction" title={poll.transactionHash}>{poll.transactionHash}</code></small>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : <EmptyState title="No on-chain polls created" description="Polls created by this wallet on the connected network will appear here." />}
                </section>
                <section>
                  <div className="section-heading"><div><div className="section-kicker">VOTES ON-CHAIN</div><h3>On-chain Voting History</h3></div></div>
                  {activity.votingHistory.length ? (
                    <div className="activity-list">
                      {activity.votingHistory.map((vote) => (
                        <Link className="activity-item" key={`${vote.transactionHash}-${vote.pollId}`} to={`/poll/${vote.pollId}`}>
                          <span className="activity-icon"><Vote size={16} /></span>
                          <span className="activity-copy">
                            <strong>{vote.question}</strong>
                            <small>Voted for <b>{vote.optionText}</b> (option {vote.optionIndex}) · Poll #{vote.pollId}</small>
                            <small>Voter {vote.voter.slice(0, 6)}…{vote.voter.slice(-4)}</small>
                            <small><Clock3 size={12} /> {new Date(vote.timestamp).toLocaleString()} · Block {vote.blockNumber}</small>
                            <small>Transaction <code className="activity-transaction" title={vote.transactionHash}>{vote.transactionHash}</code></small>
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : <EmptyState title="No on-chain votes found" description="Votes cast by this wallet on the connected network will appear here." />}
                </section>
              </div>
            )}
          </section>
          <section className="section-block profile-activity"><div className="section-heading section-heading-row"><div><div className="section-kicker">DEMO ACTIVITY · LOCAL TO THIS BROWSER</div><h2>Demo polls created by you</h2></div><Link className="button button-secondary" to="/create"><Plus size={15} /> Create poll</Link></div>{created.length ? <div className="poll-grid poll-grid-two">{created.map((poll) => <PollCard key={poll.id} poll={poll} compact />)}</div> : <EmptyState title="No demo polls created yet" description="Create a demo poll to invite your community into a decision." action={<Link className="button button-primary" to="/create">Create a poll</Link>} />}</section>
          <section className="section-block profile-activity"><div className="section-heading"><div><div className="section-kicker">DEMO ACTIVITY · LOCAL TO THIS BROWSER</div><h2>Demo voting activity</h2></div></div>{votes.length ? <div className="activity-list">{votes.map(({ poll, option }) => <Link className="activity-item" key={poll.id} to={`/poll/${poll.id}`}><span className="activity-icon"><Vote size={16} /></span><span className="activity-copy"><strong>{poll.question}</strong><small>Demo vote for <b>{option}</b></small></span><span className="activity-check"><Check size={15} /></span></Link>)}</div> : <EmptyState title="No demo votes cast yet" description="Explore demo polls and make your voice heard." action={<Link className="button button-secondary" to="/explore">Explore polls</Link>} />}</section>
        </div>
        <aside className="profile-side"><div className="profile-card profile-stat-card"><div className="side-info-heading"><span className="side-info-icon"><Plus size={17} /></span><h3>Your demo stats</h3></div><div className="profile-number">{created.length}</div><span>polls created</span><div className="profile-stat-divider" /><div className="profile-number">{votes.length}</div><span>demo votes cast</span></div><div className="profile-card identity-card"><span className="section-kicker">LOCAL DEMO IDENTITY</span><p>This browser uses a private, random ID for your demo activity.</p><div className="identity-row"><code>{identity.slice(0, 8)}…</code><button className="icon-button" aria-label="Copy demo identity" onClick={copyIdentity}><Copy size={15} /></button></div></div></aside>
      </div>
    </section>
  )
}
