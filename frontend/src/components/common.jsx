import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Clock3, Search, Sparkles, Vote } from 'lucide-react'
import { isPollActive, timeRemaining, totalVotes } from '../utils/formatting'

export function StatCard({ label, value, detail, icon: Icon, tone = 'violet' }) {
  return (
    <article className={`stat-card tone-${tone}`}>
      <div className="stat-top"><span className="stat-icon"><Icon size={18} /></span><span className="stat-detail">{detail}</span></div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </article>
  )
}

export function PollStatusBadge({ poll }) {
  const active = isPollActive(poll)
  return <span className={`status-badge ${active ? 'status-live' : 'status-ended'}`}><span className="status-dot" />{active ? 'Active' : 'Completed'}</span>
}

export function CountdownTimer({ endAt }) {
  const [now, setNow] = useState(0)
  useEffect(() => {
    let timer
    const update = () => {
      setNow(Date.now())
      timer = window.setTimeout(update, 60000)
    }
    timer = window.setTimeout(update, 0)
    return () => window.clearTimeout(timer)
  }, [])
  const ended = now > 0 && new Date(endAt).getTime() <= now
  return <span className={`countdown ${ended ? 'countdown-ended' : ''}`}><Clock3 size={14} />{timeRemaining(endAt)}</span>
}

export function PollCard({ poll, compact = false }) {
  const votes = totalVotes(poll)
  return (
    <article className={`poll-card ${compact ? 'poll-card-compact' : ''}`}>
      <div className="poll-card-meta"><span className="category-chip">{poll.category}</span><PollStatusBadge poll={poll} /></div>
      <Link to={`/poll/${poll.id}`} className="poll-title-link"><h3>{poll.question}</h3></Link>
      <p className="poll-description">{poll.description || 'A community poll, created in demo mode.'}</p>
      <div className="poll-card-footer">
        <div className="poll-metric"><Vote size={15} /><strong>{votes.toLocaleString()}</strong><span>votes</span></div>
        <CountdownTimer endAt={poll.endAt} />
      </div>
      <Link className="poll-open-link" to={`/poll/${poll.id}`} aria-label={`View poll: ${poll.question}`}><ArrowUpRight size={17} /></Link>
    </article>
  )
}

export function SearchBar({ value, onChange, placeholder = 'Search polls...' }) {
  return <label className="search-field"><Search size={17} /><span className="sr-only">Search polls</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>
}

export function CategoryFilter({ value, onChange, categories }) {
  return (
    <div className="category-filter" role="group" aria-label="Filter by category">
      {categories.map((category) => <button key={category} type="button" className={`filter-pill ${value === category ? 'selected' : ''}`} onClick={() => onChange(category)}>{category}</button>)}
    </div>
  )
}

export function EmptyState({ icon: Icon = Sparkles, title, description, action }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22} /></span><h3>{title}</h3><p>{description}</p>{action}</div>
}

export function LoadingState({ label = 'Loading polls…' }) {
  return <div className="loading-state" role="status"><span className="spinner" />{label}</div>
}

export function ConfirmationModal({ title, children, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, danger = false }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <span className="modal-mark"><Check size={18} /></span>
        <h2 id="modal-title">{title}</h2><div className="modal-copy">{children}</div>
        <div className="modal-actions"><button className="button button-quiet" onClick={onCancel}>{cancelLabel}</button><button className={`button ${danger ? 'button-danger' : 'button-primary'}`} onClick={onConfirm}>{confirmLabel}</button></div>
      </section>
    </div>
  )
}

export function ToastNotification({ toasts, onDismiss }) {
  useEffect(() => {
    const timers = toasts.map((toast) => window.setTimeout(() => onDismiss(toast.id), 4500))
    return () => timers.forEach(window.clearTimeout)
  }, [toasts, onDismiss])
  return <div className="toast-stack" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`toast toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}><span>{toast.type === 'error' ? '!' : <Check size={15} />}</span>{toast.message}<button aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>×</button></div>)}</div>
}

export function VoteOption({ option, total, selected, onSelect, disabled, showResults = false }) {
  const percentage = total ? Math.round((option.votes / total) * 100) : 0
  return (
    <button type="button" className={`vote-option ${selected ? 'vote-option-selected' : ''} ${disabled ? 'vote-option-disabled' : ''}`} onClick={onSelect} disabled={disabled && !showResults} aria-pressed={selected}>
      <span className="vote-option-top"><span className="vote-option-label">{option.text}</span>{showResults && <span className="vote-option-result">{percentage}% <small>({option.votes})</small></span>}</span>
      {showResults && <span className="vote-track"><span style={{ width: `${percentage}%` }} /></span>}
      {!showResults && <span className="vote-radio">{selected && <span />}</span>}
    </button>
  )
}
