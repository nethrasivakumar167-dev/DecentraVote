import { useCallback, useEffect, useMemo, useState } from 'react'
import { getSeedPolls } from '../data/demoPolls'
import { totalVotes } from '../utils/formatting'
import { PollContext } from './PollContext'
const POLLS_KEY = 'decentravote.demo-polls.v1'
const IDENTITY_KEY = 'decentravote.demo-identity.v1'

function readPolls() {
  try {
    const stored = localStorage.getItem(POLLS_KEY)
    if (!stored) return getSeedPolls()
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) throw new Error('Stored poll data is not a list.')
    return parsed
  } catch (error) {
    console.error('Unable to load saved demo polls:', error)
    return getSeedPolls()
  }
}

function getIdentity() {
  let identity = localStorage.getItem(IDENTITY_KEY)
  if (!identity) {
    identity = globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(IDENTITY_KEY, identity)
  }
  return identity
}

export function PollProvider({ children }) {
  const [polls, setPolls] = useState(readPolls)
  const [identity, setIdentity] = useState(getIdentity)
  const [toasts, setToasts] = useState([])
  const [now, setNow] = useState(0)

  const notify = useCallback((message, type = 'success') => {
    const id = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
    setToasts((current) => [...current, { id, message, type }])
    return id
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(POLLS_KEY, JSON.stringify(polls))
    } catch (error) {
      console.error('Unable to save demo polls:', error)
    }
  }, [polls])

  useEffect(() => {
    let timer
    const update = () => {
      setNow(Date.now())
      timer = window.setTimeout(update, 60000)
    }
    timer = window.setTimeout(update, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const createPoll = useCallback((details) => {
    const poll = {
      ...details,
      id: globalThis.crypto?.randomUUID?.() || `poll-${Date.now()}`,
      createdAt: new Date().toISOString(),
      endAt: new Date(Date.now() + Number(details.duration) * 1000).toISOString(),
      options: details.options.map((text) => ({ text, votes: 0 })),
      creator: null,
      creatorLabel: 'Your demo profile',
      createdBy: identity,
      demo: true,
      voterVotes: [],
    }
    delete poll.duration
    setPolls((current) => [poll, ...current])
    notify('Demo poll created and saved in this browser.')
    return poll
  }, [identity, notify])

  const castVote = useCallback((pollId, optionIndex) => {
    const poll = polls.find((item) => item.id === pollId)
    if (!poll) return { ok: false, error: 'This poll could not be found.' }
    if (new Date(poll.endAt).getTime() <= Date.now()) return { ok: false, error: 'This poll has ended.' }
    if (poll.voterVotes?.some((vote) => vote.identity === identity)) return { ok: false, error: 'Your demo profile has already voted in this poll.' }
    if (!Number.isInteger(optionIndex) || !poll.options[optionIndex]) return { ok: false, error: 'Choose a valid option.' }
    setPolls((current) => current.map((item) => item.id === pollId ? {
      ...item,
      options: item.options.map((option, index) => index === optionIndex ? { ...option, votes: option.votes + 1 } : option),
      voterVotes: [...(item.voterVotes || []), { identity, optionIndex }],
    } : item))
    notify('Your demo vote has been recorded locally.')
    return { ok: true }
  }, [identity, notify, polls])

  const clearDemoData = useCallback(() => {
    const nextIdentity = globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`
    try {
      localStorage.setItem(IDENTITY_KEY, nextIdentity)
      localStorage.setItem(POLLS_KEY, JSON.stringify(getSeedPolls()))
    } catch (error) {
      console.error('Unable to clear demo data:', error)
      notify('Could not clear demo data. Check your browser storage settings.', 'error')
      return false
    }
    setIdentity(nextIdentity)
    setPolls(getSeedPolls())
    notify('Demo data has been reset.')
    return true
  }, [notify])

  const stats = useMemo(() => {
    const active = polls.filter((poll) => new Date(poll.endAt).getTime() > now)
    return {
      totalPolls: polls.length,
      activePolls: active.length,
      completedPolls: polls.length - active.length,
      totalVotes: polls.reduce((sum, poll) => sum + totalVotes(poll), 0),
    }
  }, [polls, now])

  const value = useMemo(() => ({
    polls, identity, toasts, stats, createPoll, castVote, clearDemoData, notify, dismissToast,
  }), [polls, identity, toasts, stats, createPoll, castVote, clearDemoData, notify, dismissToast])
  return <PollContext.Provider value={value}>{children}</PollContext.Provider>
}
