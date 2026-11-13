import { useEffect, useMemo, useState } from 'react'
import { BrowserProvider, Contract } from 'ethers'
import { Award, ArrowLeft, ArrowUpRight, Check, Clock3, Share2, ShieldCheck, Vote } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { ConfirmationModal, EmptyState, PollStatusBadge, VoteOption } from '../components/common'
import ResultsChart from '../components/ResultsChart'
import WalletButton from '../components/WalletButton'
import { usePolls } from '../context/usePolls'
import { useWallet } from '../context/useWallet'
import { useOnChainPolls } from '../hooks/useOnChainPolls'
import { getReadProvider, notifyOnChainActivityUpdated } from '../services/onChainPolls'
import VotingAbi from '../contracts/Voting.json'
import { getNetworkConfig } from '../contracts/contractAddress'
import { formatDate, isPollActive, shortAddress, totalVotes } from '../utils/formatting'
import { getPollResultOutcome } from '../utils/pollResults'
import { sendOnLiveTransactionNetwork } from '../utils/transactionNetwork'

export default function PollDetails() {
  const { id } = useParams()
  return /^\d+$/.test(id || '') ? <OnChainPollDetails id={id} /> : <DemoPollDetails id={id} />
}

function OnChainPollDetails({ id }) {
  const { polls, loading, error, refresh } = useOnChainPolls({ readOnly: true })
  const { account, provider, chainId, status: walletStatus, walletError, networkName } = useWallet()
  const poll = polls.find((item) => String(item.id) === id)
  const networkConfig = getNetworkConfig(chainId)
  const [selected, setSelected] = useState(null)
  const [voteCheck, setVoteCheck] = useState(null)
  const [transactionStatus, setTransactionStatus] = useState('idle')
  const [transactionMessage, setTransactionMessage] = useState('')
  const [now, setNow] = useState(0)

  useEffect(() => {
    let timer
    const update = () => {
      setNow(Date.now())
      timer = window.setTimeout(update, 1000)
    }
    timer = window.setTimeout(update, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    let active = true
    if (!poll || !account || !networkConfig) {
      return () => { active = false }
    }

    const readProvider = getReadProvider(chainId)
    const contract = new Contract(networkConfig.contractAddress, VotingAbi, readProvider)
    contract.hasVoted(BigInt(id), account)
      .then((hasVoted) => {
        if (active) setVoteCheck({ poll, account, chainId, status: hasVoted ? 'voted' : 'eligible' })
      })
      .catch((checkError) => {
        if (!active) return
        console.error('Unable to check whether this wallet has voted:', checkError)
        setVoteCheck({
          poll,
          account,
          chainId,
          status: 'error',
          error: checkError?.shortMessage || checkError?.message || 'Unable to check this wallet’s vote status.',
        })
      })

    return () => { active = false }
  }, [account, chainId, id, networkConfig, poll])

  const currentVoteCheck = voteCheck?.poll === poll && voteCheck?.account === account && voteCheck?.chainId === chainId
    ? voteCheck
    : { status: 'checking' }
  const active = poll ? new Date(poll.endAt).getTime() > now : false
  const outcome = poll ? getPollResultOutcome(poll, poll.totalVotes, now) : null
  const busy = transactionStatus === 'confirming' || transactionStatus === 'pending'
  const canVote = Boolean(poll && active && walletStatus === 'connected' && networkConfig && account && provider && currentVoteCheck.status === 'eligible' && !busy)

  const handleVote = async () => {
    if (!poll || selected === null || !canVote) return
    setTransactionStatus('confirming')
    setTransactionMessage('Confirm this vote in MetaMask.')

    try {
      if (Date.now() >= new Date(poll.endAt).getTime()) {
        setTransactionStatus('error')
        setTransactionMessage('This poll has expired. Voting is closed.')
        return
      }

      const selectedNetwork = getNetworkConfig(chainId)
      if (!selectedNetwork) {
        setTransactionStatus('error')
        setTransactionMessage(`Unsupported network${chainId === null ? '' : ` (chain ID ${chainId})`}. Switch MetaMask to Hardhat Local (chain ID 31337) or Sepolia (chain ID 11155111) before voting.`)
        return
      }

      if (!window.ethereum?.request) {
        setTransactionStatus('error')
        setTransactionMessage('MetaMask is no longer available. Reconnect your wallet and try again.')
        return
      }
      const ethereum = window.ethereum
      const transactionProvider = new BrowserProvider(ethereum, 'any')
      const network = await transactionProvider.getNetwork()
      if (network.chainId !== BigInt(chainId)) {
        setTransactionStatus('error')
        let actualNetworkName = `Unsupported Network (chain ID ${network.chainId})`
        if (network.chainId === 31337n) actualNetworkName = 'Hardhat Local'
        if (network.chainId === 11155111n) actualNetworkName = 'Sepolia'
        setTransactionMessage(`MetaMask is on ${actualNetworkName}, but the connected wallet network is ${networkName} (chain ID ${chainId}). Refresh the page and reconnect before voting.`)
        return
      }

      const signer = await transactionProvider.getSigner()
      const signerAddress = await signer.getAddress()
      if (signerAddress.toLowerCase() !== account.toLowerCase()) {
        setTransactionStatus('error')
        setTransactionMessage('The active MetaMask account changed. Refresh the page and try again.')
        return
      }

      const contract = new Contract(selectedNetwork.contractAddress, VotingAbi, signer)
      if (await contract.hasVoted(BigInt(id), signerAddress)) {
        setVoteCheck({ poll, account, provider, chainId, status: 'voted' })
        setTransactionStatus('error')
        setTransactionMessage('This wallet has already voted in this poll.')
        return
      }

      const transaction = await sendOnLiveTransactionNetwork({
        expectedChainId: selectedNetwork.chainId,
        ethereum,
        provider: transactionProvider,
        signer,
        contract,
        send: () => contract.vote(BigInt(id), BigInt(selected)),
      })
      setTransactionStatus('pending')
      setTransactionMessage('Transaction submitted. Waiting for the vote to be confirmed on-chain…')
      const receipt = await transaction.wait()
      if (!receipt || receipt.status !== 1) {
        throw new Error('The vote transaction was not successful. Check the transaction in MetaMask and try again.')
      }

      notifyOnChainActivityUpdated()
      const refreshedPolls = await refresh()
      setVoteCheck({ poll, account, provider, chainId, status: 'voted' })
      setTransactionStatus('success')
      setTransactionMessage(refreshedPolls
        ? 'Your vote was confirmed on-chain.'
        : 'Your vote was confirmed on-chain, but the poll data could not be refreshed. Use Refresh to try again.')
      setSelected(null)
    } catch (voteError) {
      const code = voteError?.code ?? voteError?.info?.error?.code ?? voteError?.error?.code
      if (code === 4001) {
        setTransactionStatus('rejected')
        setTransactionMessage('You rejected the vote in MetaMask. No vote was submitted.')
        return
      }
      console.error('Unable to submit or confirm on-chain vote:', voteError)
      setTransactionStatus('error')
      setTransactionMessage(voteError?.shortMessage || voteError?.message || 'The vote transaction failed. Please try again.')
    }
  }

  return (
    <>
      <div className="detail-back-row"><Link to="/explore" className="back-link"><ArrowLeft size={16} /> Back to explore</Link></div>
      {loading && <EmptyState title="Loading on-chain poll" description="Reading poll details from the Voting contract." />}
      {!loading && error && (
        <EmptyState title="Could not load this poll" description={error} action={<button className="button button-quiet" type="button" onClick={refresh}>Try again</button>} />
      )}
      {!loading && !error && !poll && (
        <EmptyState title="Poll not found" description="The Voting contract does not contain this poll." action={<Link className="button button-primary" to="/explore">Explore polls</Link>} />
      )}
      {poll && !loading && !error && (
        <div className="detail-layout">
          <div className="detail-main">
            <section className="detail-question-card">
              <div className="poll-card-meta"><span className="category-chip">On-chain · #{poll.id}</span><PollStatusBadge poll={poll} /></div>
              <h2>{poll.question}</h2>
              <p className="detail-description">This poll is stored on the Voting contract.</p>
              <div className="detail-meta"><span><span className="meta-label">Created by</span><strong title={poll.creator}>{shortAddress(poll.creator)}</strong></span><span><span className="meta-label">Expires</span><strong>{formatDate(poll.endAt)}</strong></span></div>
            </section>
            <section className="detail-vote-panel">
              <div className="section-heading section-heading-row"><div><div className="section-kicker">{active ? 'ON-CHAIN VOTING' : 'COMMUNITY RESULTS'}</div><h2>{active ? 'Choose your answer' : 'Poll results'}</h2><p>{active ? 'Select one option and confirm the transaction in MetaMask.' : 'Voting has ended. These results are read from the blockchain.'}</p></div><span className="vote-total"><Vote size={15} />{poll.totalVotes.toLocaleString()} votes</span></div>
              <div className="result-winner" aria-live="polite">
                <span className="winner-icon"><Award size={16} /></span>
                <span><small>{outcome.label}</small><strong title={outcome.text}>{outcome.text}</strong></span>
                <b>{outcome.percentage}</b>
              </div>
              <div className="vote-options-list">
                {poll.options.map((option, index) => {
                  const percentage = poll.totalVotes ? (option.votes / poll.totalVotes * 100).toFixed(1) : '0.0'
                  return (
                    <button
                      key={`${poll.id}-${index}`}
                      type="button"
                      className={`vote-option ${selected === index ? 'vote-option-selected' : ''} ${!canVote ? 'vote-option-disabled' : ''}`}
                      onClick={() => setSelected(index)}
                      disabled={!canVote}
                      aria-pressed={selected === index}
                    >
                      <span className="vote-option-top"><span className="vote-option-label">{option.text}</span><span className="vote-option-result">{percentage}% <small>({option.votes.toLocaleString()})</small></span></span>
                      <span className="vote-track"><span style={{ width: `${percentage}%` }} /></span>
                      {active && <span className="vote-radio">{selected === index && <span />}</span>}
                    </button>
                  )
                })}
              </div>
              {active && <button className="button button-primary submit-vote" type="button" disabled={!canVote || selected === null} onClick={handleVote}>{transactionStatus === 'confirming' ? 'Confirm in MetaMask…' : transactionStatus === 'pending' ? 'Transaction pending…' : 'Submit on-chain vote'} <ArrowUpRight size={16} /></button>}
              {active && walletStatus === 'connecting' && <div className="ended-notice" role="status">Connecting to MetaMask. Poll details remain publicly readable.</div>}
              {active && (walletStatus === 'disconnected' || walletStatus === 'error') && (
                <div className="ended-notice" role="status">
                  {walletStatus === 'error' ? walletError || 'Connect MetaMask on Hardhat Local (chain ID 31337) or Sepolia (chain ID 11155111) to cast a vote.' : 'Connect MetaMask on Hardhat Local (chain ID 31337) or Sepolia (chain ID 11155111) to cast a vote. Poll details are public.'}
                  <WalletButton className="button button-secondary" />
                </div>
              )}
              {walletStatus === 'connected' && !networkConfig && <div className="ended-notice" role="alert">Unsupported network (chain ID {chainId}). Switch MetaMask to Hardhat Local (chain ID 31337) or Sepolia (chain ID 11155111) for on-chain voting. Poll details are publicly readable.</div>}
              {account && networkConfig && currentVoteCheck.status === 'checking' && <div className="ended-notice" role="status">Checking whether this wallet has already voted…</div>}
              {currentVoteCheck.status === 'voted' && <div className="voted-notice"><ShieldCheck size={16} />This wallet has already voted in this poll.</div>}
              {currentVoteCheck.status === 'error' && <div className="ended-notice" role="alert">{currentVoteCheck.error}</div>}
              {!active && <div className="ended-notice"><Clock3 size={15} />Voting has ended. Results remain available for everyone.</div>}
              {transactionMessage && <div className={transactionStatus === 'success' ? 'voted-notice' : 'ended-notice'} role={transactionStatus === 'error' || transactionStatus === 'rejected' ? 'alert' : 'status'}>{transactionMessage}</div>}
            </section>
            <section className="detail-chart-panel"><div className="section-heading section-heading-row"><div><div className="section-kicker">VISUAL BREAKDOWN</div><h2>Votes by option</h2></div><span className="chart-type-label">VOTE SHARE</span></div><ResultsChart poll={poll} /></section>
          </div>
          <aside className="detail-sidebar">
            <section className="side-info-card"><div className="side-info-heading"><span className="side-info-icon"><Vote size={17} /></span><h3>Poll snapshot</h3></div><div className="side-info-row"><span>Status</span><PollStatusBadge poll={poll} /></div><div className="side-info-row"><span>Votes cast</span><strong>{poll.totalVotes.toLocaleString()}</strong></div><div className="side-info-row"><span>Options</span><strong>{poll.options.length}</strong></div><div className="side-info-row"><span>Expires</span><strong>{formatDate(poll.endAt)}</strong></div></section>
            <section className="side-info-card side-demo-note"><div className="side-info-heading"><span className="side-info-icon"><ShieldCheck size={17} /></span><h3>On-chain vote</h3></div><p>Your vote is sent to the Voting contract. The contract enforces one vote per wallet and rejects votes after expiry.</p></section>
            <Link className="side-explore-link" to="/explore">Explore polls <ArrowUpRight size={15} /></Link>
          </aside>
        </div>
      )}
    </>
  )
}

function DemoPollDetails({ id }) {
  const { polls, identity, castVote, notify } = usePolls()
  const poll = polls.find((item) => item.id === id)
  const existingVote = useMemo(() => poll?.voterVotes?.find((vote) => vote.identity === identity), [poll, identity])
  const [selected, setSelected] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [voted, setVoted] = useState(false)
  const [sharing, setSharing] = useState(false)
  const active = poll ? isPollActive(poll) : false
  const hasVoted = Boolean(existingVote || voted)
  const showResults = !active || hasVoted

  if (!poll) return <EmptyState title="Poll not found" description="This poll may have been cleared from local demo data." action={<Link className="button button-primary" to="/explore">Explore polls</Link>} />

  const handleVote = () => {
    if (selected === null) return
    const result = castVote(poll.id, selected)
    if (result.ok) {
      setVoted(true)
      setConfirming(false)
      setSelected(null)
    } else {
      setConfirming(false)
      notify(result.error, 'error')
    }
  }

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      notify('Poll link copied to clipboard.')
      setSharing(true)
      window.setTimeout(() => setSharing(false), 1800)
    } catch (error) {
      console.error('Unable to copy poll link:', error)
      notify('Clipboard access is unavailable in this browser.', 'error')
    }
  }

  return (
    <>
      <div className="detail-back-row"><Link to="/explore" className="back-link"><ArrowLeft size={16} /> Back to explore</Link><button className="button button-secondary share-button" onClick={handleShare}><Share2 size={15} />{sharing ? 'Copied' : 'Share poll'}{sharing && <Check size={14} />}</button></div>
      <div className="detail-layout">
        <div className="detail-main">
          <section className="detail-question-card">
            <div className="poll-card-meta"><span className="category-chip">{poll.category}</span><PollStatusBadge poll={poll} /></div>
            <h2>{poll.question}</h2><p className="detail-description">{poll.description || 'No description was added to this poll.'}</p>
            <div className="detail-meta"><span><span className="meta-label">Created by</span><strong>{poll.creatorLabel || 'Demo poll'}</strong></span><span><span className="meta-label">Created</span><strong>{formatDate(poll.createdAt)}</strong></span></div>
          </section>
          <section className="detail-vote-panel">
            <div className="section-heading section-heading-row"><div><div className="section-kicker">{showResults ? 'COMMUNITY RESULTS' : 'HAVE YOUR SAY'}</div><h2>{showResults ? 'Poll results' : 'Choose your answer'}</h2><p>{showResults ? 'Votes shown are local demo results.' : 'Select one option. Your demo identity can vote once.'}</p></div><span className="vote-total"><Vote size={15} />{totalVotes(poll).toLocaleString()} votes</span></div>
            <div className="vote-options-list">{poll.options.map((option, index) => <VoteOption key={option.text} option={option} total={totalVotes(poll)} selected={selected === index || existingVote?.optionIndex === index} onSelect={() => setSelected(index)} disabled={showResults} showResults={showResults} />)}</div>
            {!showResults && <button className="button button-primary submit-vote" disabled={selected === null} onClick={() => setConfirming(true)}>Submit demo vote <ArrowUpRight size={16} /></button>}
            {hasVoted && <div className="voted-notice"><ShieldCheck size={16} />Your demo vote has been recorded in this browser.</div>}
            {!active && <div className="ended-notice">Voting has ended. Results remain available for everyone.</div>}
          </section>
          <section className="detail-chart-panel"><div className="section-heading section-heading-row"><div><div className="section-kicker">VISUAL BREAKDOWN</div><h2>Votes by option</h2></div><span className="chart-type-label">VOTE SHARE</span></div><ResultsChart poll={poll} /></section>
        </div>
        <aside className="detail-sidebar">
          <section className="side-info-card"><div className="side-info-heading"><span className="side-info-icon"><Vote size={17} /></span><h3>Poll snapshot</h3></div><div className="side-info-row"><span>Status</span><PollStatusBadge poll={poll} /></div><div className="side-info-row"><span>Votes cast</span><strong>{totalVotes(poll).toLocaleString()}</strong></div><div className="side-info-row"><span>Options</span><strong>{poll.options.length}</strong></div><div className="side-info-row"><span>Closes</span><strong>{formatDate(poll.endAt)}</strong></div></section>
          <section className="side-info-card side-demo-note"><div className="side-info-heading"><span className="side-info-icon"><ShieldCheck size={17} /></span><h3>Local demo</h3></div><p>This is a UI simulation. Votes and results are stored in this browser only—no wallet, contract, or blockchain transaction is involved.</p></section>
          <Link className="side-explore-link" to="/results">View all results <ArrowUpRight size={15} /></Link>
        </aside>
      </div>
      {confirming && <ConfirmationModal title="Confirm your demo vote" onCancel={() => setConfirming(false)} onConfirm={handleVote} confirmLabel="Cast demo vote"><p>Your selection is <strong>{poll.options[selected]?.text}</strong>.</p><p>This vote is a local simulation and will not be sent on-chain.</p></ConfirmationModal>}
    </>
  )
}
