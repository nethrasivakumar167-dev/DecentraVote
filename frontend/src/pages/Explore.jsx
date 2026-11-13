import { useMemo, useState } from 'react'
import { ArrowUpRight, Clock3, ListFilter, RefreshCw, Vote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CategoryFilter, EmptyState, LoadingState, PollCard, SearchBar } from '../components/common'
import { usePolls } from '../context/usePolls'
import { useOnChainPolls } from '../hooks/useOnChainPolls'
import { categories } from '../data/demoPolls'
import { isPollActive, shortAddress, totalVotes } from '../utils/formatting'

function OnChainPolls() {
  const { polls, loading, error, refresh, account, chainId, walletStatus } = useOnChainPolls({ readOnly: true })
  const sourceChainId = walletStatus === 'connected' && account ? chainId : 31337
  const sourceNetwork = sourceChainId === 31337
    ? 'Hardhat Local'
    : sourceChainId === 11155111 ? 'Sepolia' : null

  return (
    <section className="section-block on-chain-section" aria-labelledby="on-chain-polls-title">
      <div className="section-heading section-heading-row">
        <div>
          <div className="section-kicker">{sourceNetwork ? `BLOCKCHAIN DATA · ${sourceNetwork.toUpperCase()}` : 'BLOCKCHAIN DATA · UNSUPPORTED NETWORK'}</div>
          <h2 id="on-chain-polls-title">On-chain Polls</h2>
          <p>{sourceNetwork ? `Polls are read directly from the Voting contract on ${sourceNetwork}.` : 'On-chain polls are unavailable for this selected network. Use Hardhat Local (31337) or Sepolia (11155111).'}</p>
        </div>
        <button className="button button-quiet" type="button" onClick={refresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'on-chain-refreshing' : ''} />
          Refresh
        </button>
      </div>

      {loading && <LoadingState label="Loading on-chain polls…" />}
      {!loading && error && (
        <EmptyState
          title="Could not load on-chain polls"
          description={error}
          action={<button className="button button-quiet" type="button" onClick={refresh}>Try again</button>}
        />
      )}
      {!loading && !error && polls.length === 0 && (
        <EmptyState
          title="No on-chain polls yet"
          description={sourceNetwork
            ? `The ${sourceNetwork} Voting contract currently reports zero polls.`
            : 'On-chain polls are unavailable on the selected network. Use Hardhat Local (31337) or Sepolia (11155111).'}
        />
      )}
      {!loading && !error && polls.length > 0 && (
        <div className="poll-grid poll-grid-three on-chain-poll-grid">
          {polls.map((poll) => (
            <article className="poll-card on-chain-poll-card" key={poll.id}>
              <div className="poll-card-meta">
                <span className="category-chip">On-chain · #{poll.id}</span>
                <span className={`status-badge ${poll.status === 'Active' ? 'status-live' : 'status-ended'}`}>
                  <span className="status-dot" />{poll.status}
                </span>
              </div>
              <Link to={`/poll/${poll.id}`} className="poll-title-link"><h3>{poll.question}</h3></Link>
              <ul className="on-chain-options" aria-label="On-chain poll options and vote counts">
                {poll.options.map((option, index) => (
                  <li key={`${poll.id}-${index}`}>
                    <span>{option.text}</span>
                    <strong>{option.votes.toLocaleString()}</strong>
                  </li>
                ))}
              </ul>
              <div className="on-chain-poll-meta">
                <span className="poll-metric"><Vote size={15} /><strong>{poll.totalVotes.toLocaleString()}</strong><span>total votes</span></span>
                <time className="countdown" dateTime={poll.endAt}><Clock3 size={14} />Ends {new Date(poll.endAt).toLocaleString()}</time>
              </div>
              <p className="on-chain-creator">Created by <span title={poll.creator}>{shortAddress(poll.creator)}</span></p>
              <Link className="poll-open-link" to={`/poll/${poll.id}`} aria-label={`View poll: ${poll.question}`}><ArrowUpRight size={17} /></Link>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

export default function Explore() {
  const { polls } = usePolls()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const [status, setStatus] = useState('All polls')
  const [sort, setSort] = useState('newest')

  const filtered = useMemo(() => polls.filter((poll) => {
    const active = isPollActive(poll)
    return poll.question.toLowerCase().includes(query.toLowerCase())
      && (category === 'All categories' || poll.category === category)
      && (status === 'All polls' || (status === 'Active' ? active : !active))
  }).sort((a, b) => sort === 'votes' ? totalVotes(b) - totalVotes(a) : new Date(b.createdAt) - new Date(a.createdAt)), [polls, query, category, status, sort])

  return (
    <>
      <OnChainPolls />
      <section className="section-block page-section demo-polls-section" aria-labelledby="demo-polls-title">
        <div className="section-heading">
          <div>
            <div className="section-kicker">BROWSER-LOCAL SAMPLE DATA</div>
            <h2 id="demo-polls-title">Demo polls</h2>
            <p>These sample polls and votes are separate from blockchain data.</p>
          </div>
        </div>
        <div className="explore-toolbar"><SearchBar value={query} onChange={setQuery} placeholder="Search demo poll questions..." /><label className="select-control"><ListFilter size={16} /><span className="sr-only">Filter demo poll status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All polls</option><option>Active</option><option>Completed</option></select></label><label className="select-control sort-control"><span className="sr-only">Sort demo polls</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="votes">Most votes</option></select></label></div>
        <div className="explore-categories"><CategoryFilter value={category} onChange={setCategory} categories={categories} /></div>
        <div className="result-count"><span>{filtered.length} demo {filtered.length === 1 ? 'poll' : 'polls'}</span><span>•</span><span>Local browser data</span></div>
        {filtered.length ? <div className="poll-grid poll-grid-three">{filtered.map((poll) => <PollCard key={poll.id} poll={poll} />)}</div> : <EmptyState title="Nothing in the demo ballot box yet" description="No demo polls match those filters. Try broadening your search." action={<button className="button button-quiet" onClick={() => { setQuery(''); setCategory('All categories'); setStatus('All polls') }}>Reset filters</button>} />}
      </section>
    </>
  )
}
