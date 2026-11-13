import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Award, BarChart3, RefreshCw, Vote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState, PollStatusBadge } from '../components/common'
import ResultsChart from '../components/ResultsChart'
import { usePolls } from '../context/usePolls'
import { useOnChainPolls } from '../hooks/useOnChainPolls'
import { formatDate, getWinningOption, isPollActive, shortAddress, totalVotes } from '../utils/formatting'
import { getPollResultOutcome } from '../utils/pollResults'

function ResultCard({ poll, onChain = false, now }) {
  const total = onChain ? poll.totalVotes : totalVotes(poll)
  const outcome = getPollResultOutcome(poll, total, now)
  const demoWinner = !onChain && total ? getWinningOption(poll) : null
  const outcomePercentage = demoWinner ? `${Math.round(demoWinner.votes / total * 100)}%` : outcome.percentage

  return (
    <article className="result-card">
      <div className="result-card-heading">
        <div>
          <span className="category-chip">{onChain ? `On-chain · #${poll.id}` : poll.category}</span>
          <PollStatusBadge poll={poll} />
        </div>
        <Link to={`/poll/${poll.id}`} className="result-open" aria-label="Open poll results"><ArrowRight size={17} /></Link>
      </div>
      <h3>{poll.question}</h3>
      {onChain && (
        <div className="on-chain-result-meta">
          <span>Creator <strong title={poll.creator}>{shortAddress(poll.creator)}</strong></span>
          <span>Expires <strong>{formatDate(poll.endAt)}</strong></span>
        </div>
      )}
      <div className="result-winner">
        <span className="winner-icon"><Award size={16} /></span>
        <span><small>{outcome.label}</small><strong title={outcome.text}>{outcome.text}</strong></span>
        <b>{outcomePercentage}</b>
      </div>
      <ResultsChart poll={poll} type={onChain ? 'bar' : 'pie'} />
      {onChain && (
        <ul className="result-percentages" aria-label="Vote percentages by option">
          {poll.options.map((option, index) => (
            <li key={`${poll.id}-${index}`}>
              <span>{option.text}</span>
              <strong>{total ? Math.round(option.votes / total * 100) : 0}%</strong>
              <small>{option.votes.toLocaleString()} votes</small>
            </li>
          ))}
        </ul>
      )}
      <div className="result-card-footer">
        <span><Vote size={14} />{total.toLocaleString()} total votes</span>
        <Link to={`/poll/${poll.id}`}>Open details <ArrowRight size={14} /></Link>
      </div>
    </article>
  )
}

function OnChainResults({ now }) {
  const { polls, loading, error, refresh, account, chainId, walletStatus } = useOnChainPolls({ readOnly: true })
  const sourceChainId = walletStatus === 'connected' && account ? chainId : 31337
  const sourceNetwork = sourceChainId === 31337
    ? 'Hardhat Local'
    : sourceChainId === 11155111 ? 'Sepolia' : null
  const { active, completed, allVotes } = useMemo(() => ({
    active: polls.filter((poll) => isPollActive(poll, now)),
    completed: polls.filter((poll) => !isPollActive(poll, now)),
    allVotes: polls.reduce((sum, poll) => sum + poll.totalVotes, 0),
  }), [polls, now])

  return (
    <section className="section-block" aria-labelledby="on-chain-results-title">
      <div className="section-heading section-heading-row">
        <div>
          <div className="section-kicker">{sourceNetwork ? `BLOCKCHAIN DATA · ${sourceNetwork.toUpperCase()}` : 'BLOCKCHAIN DATA · UNSUPPORTED NETWORK'}</div>
          <h2 id="on-chain-results-title">On-chain results</h2>
          <p>{sourceNetwork ? `Public results are read directly from the ${sourceNetwork} Voting contract; MetaMask is not required when using the Local read configuration.` : 'On-chain results are unavailable for this selected network. Use Hardhat Local (31337) or Sepolia (11155111).'}</p>
        </div>
        <button className="button button-quiet" type="button" onClick={refresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'on-chain-refreshing' : ''} />
          Refresh
        </button>
      </div>

      {loading && <div className="loading-state" role="status"><span className="spinner" />Reading results from {sourceNetwork || 'the selected network'}…</div>}
      {!loading && error && (
        <EmptyState
          title="On-chain results unavailable"
          description={error}
          action={<button className="button button-quiet" type="button" onClick={refresh}>Try again</button>}
        />
      )}
      {!loading && !error && polls.length === 0 && (
        <EmptyState
          title="No on-chain polls yet"
          description={sourceNetwork
            ? `The ${sourceNetwork} Voting contract currently reports zero polls.`
            : 'On-chain results are unavailable on the selected network. Use Hardhat Local (31337) or Sepolia (11155111).'}
        />
      )}
      {!loading && !error && polls.length > 0 && (
        <>
          <div className="results-summary">
            <div className="results-summary-icon"><BarChart3 size={20} /></div>
            <div><span className="section-kicker">CONTRACT TOTALS</span><p><strong>{polls.length} polls</strong> and <strong>{allVotes.toLocaleString()} on-chain votes</strong>.</p></div>
            <span className="demo-label"><i /> {sourceNetwork || 'On-chain results'}</span>
          </div>
          <div className="section-heading section-heading-row result-section-head"><div><div className="section-kicker">STILL OPEN</div><h2>Active polls <span className="count-chip">{active.length}</span></h2><p>Leaders are provisional until each poll expires.</p></div></div>
          {active.length ? <div className="results-grid">{active.map((poll) => <ResultCard key={poll.id} poll={poll} onChain now={now} />)}</div> : <EmptyState title="No active polls" description="There are no on-chain polls currently accepting votes." />}
          <div className="section-heading section-heading-row result-section-head"><div><div className="section-kicker">FINAL TALLY</div><h2>Expired polls <span className="count-chip">{completed.length}</span></h2><p>Expired polls show the final winner or tie.</p></div></div>
          {completed.length ? <div className="results-grid">{completed.map((poll) => <ResultCard key={poll.id} poll={poll} onChain now={now} />)}</div> : <EmptyState title="No expired polls" description="Final on-chain results will appear here after polls expire." />}
        </>
      )}
    </section>
  )
}

export default function Results() {
  const { polls } = usePolls()
  const [now, setNow] = useState(Date.now)
  const { active, completed, allVotes } = useMemo(() => ({
    active: polls.filter((poll) => isPollActive(poll, now)),
    completed: polls.filter((poll) => !isPollActive(poll, now)),
    allVotes: polls.reduce((sum, poll) => sum + totalVotes(poll), 0),
  }), [polls, now])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <section className="section-block page-section">
      <OnChainResults now={now} />
      <section className="section-block" aria-labelledby="demo-results-title">
        <div className="results-summary">
          <div className="results-summary-icon"><BarChart3 size={20} /></div>
          <div><span className="section-kicker">BROWSER-LOCAL SAMPLE DATA</span><p>Results across <strong>{polls.length} demo polls</strong> and <strong>{allVotes.toLocaleString()} demo votes</strong>.</p></div>
          <span className="demo-label"><i /> Local simulation</span>
        </div>
        <div className="section-heading section-heading-row result-section-head"><div><div className="section-kicker">DEMO RESULTS</div><h2 id="demo-results-title">Active demo polls <span className="count-chip">{active.length}</span></h2><p>Local demo results are separate from blockchain data.</p></div></div>
        {polls.length === 0 ? <EmptyState title="No demo results yet" description="Create a demo poll or explore on-chain results above." action={<Link to="/explore" className="button button-secondary">Explore polls</Link>} /> : active.length ? <div className="results-grid">{active.map((poll) => <ResultCard key={poll.id} poll={poll} now={now} />)}</div> : <EmptyState title="No active demo polls" description="There are no demo polls currently accepting votes." />}
        <div className="section-heading section-heading-row result-section-head"><div><div className="section-kicker">FINAL DEMO TALLY</div><h2>Completed demo polls <span className="count-chip">{completed.length}</span></h2></div></div>
        {completed.length ? <div className="results-grid">{completed.map((poll) => <ResultCard key={poll.id} poll={poll} now={now} />)}</div> : <EmptyState title="No completed demo polls" description="Completed demo poll results will appear here." />}
      </section>
    </section>
  )
}
