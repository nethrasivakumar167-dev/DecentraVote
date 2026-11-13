import { useMemo, useState } from 'react'
import { Activity, ArrowRight, CheckCircle2, CircleDot, Plus, Vote } from 'lucide-react'
import { Link } from 'react-router-dom'
import { usePolls } from '../context/usePolls'
import { categories } from '../data/demoPolls'
import { CategoryFilter, EmptyState, PollCard, SearchBar, StatCard } from '../components/common'

export default function Dashboard() {
  const { polls, stats } = usePolls()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const visiblePolls = useMemo(() => polls.filter((poll) => {
    const matchesText = `${poll.question} ${poll.description}`.toLowerCase().includes(query.toLowerCase())
    return matchesText && (category === 'All categories' || poll.category === category)
  }), [polls, query, category])
  const trending = [...polls].sort((a, b) => b.options.reduce((sum, option) => sum + option.votes, 0) - a.options.reduce((sum, option) => sum + option.votes, 0)).slice(0, 3)

  return (
    <div className="dv-dash">
      <section className="dv-dash-hero" aria-labelledby="dashboard-welcome-title">
        <div className="dv-dash-hero-copy">
          <div className="dv-dash-kicker"><span /> Workspace overview <span /></div>
          <h2 id="dashboard-welcome-title">A voice in every decision.</h2>
          <p>Gather perspectives, weigh the choices, and shape what comes next in your community.</p>
          <div className="dv-dash-actions">
            <Link className="button button-primary" to="/explore">Explore polls</Link>
            <Link className="button button-secondary" to="/create"><Plus size={16} /> Create a poll</Link>
          </div>
        </div>
        <div className="dv-dash-hero-art" aria-hidden="true"><span /><i /><b /></div>
      </section>

      <div className="demo-banner"><span className="demo-banner-icon"><Activity size={16} /></span><span><strong>You're exploring the demo.</strong> Polls and votes shown here are sample data stored only in this browser.</span><Link to="/settings">About demo mode <ArrowRight size={14} /></Link></div>
      <section className="stats-grid" aria-label="Poll statistics">
        <StatCard label="Total polls" value={stats.totalPolls} detail="across the community" icon={CircleDot} tone="violet" />
        <StatCard label="Active polls" value={stats.activePolls} detail="open for voting" icon={Activity} tone="blue" />
        <StatCard label="Completed polls" value={stats.completedPolls} detail="voting has ended" icon={CheckCircle2} tone="green" />
        <StatCard label="Total votes" value={stats.totalVotes.toLocaleString()} detail="local demo votes" icon={Vote} tone="amber" />
      </section>

      <section className="section-block dv-dash-section">
        <div className="section-heading"><div><div className="section-kicker">COMMUNITY PULSE</div><h2>Trending right now <span className="live-indicator"><i /> LIVE</span></h2><p>Popular conversations across the community.</p></div><Link className="text-link" to="/explore">Explore all polls <ArrowRight size={16} /></Link></div>
        <div className="poll-grid poll-grid-three">{trending.map((poll) => <PollCard key={poll.id} poll={poll} />)}</div>
      </section>

      <section className="section-block recent-section dv-dash-section">
        <div className="section-heading section-heading-row"><div><div className="section-kicker">FRESH OFF THE BLOCK</div><h2>Recently created</h2><p>Find a question worth weighing in on.</p></div><Link className="button button-secondary" to="/create"><Plus size={16} /> Create poll</Link></div>
        <div className="list-toolbar"><SearchBar value={query} onChange={setQuery} /><CategoryFilter value={category} onChange={setCategory} categories={categories} /></div>
        {visiblePolls.length ? <div className="poll-grid poll-grid-three">{visiblePolls.slice(0, 6).map((poll) => <PollCard key={poll.id} poll={poll} compact />)}</div> : <EmptyState title="No polls found" description="Try another search or category to find a community conversation." action={<button className="button button-quiet" onClick={() => { setQuery(''); setCategory('All categories') }}>Clear filters</button>} />}
      </section>
    </div>
  )
}
