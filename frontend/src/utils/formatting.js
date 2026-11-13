export function isPollActive(poll, now = Date.now()) {
  return new Date(poll.endAt).getTime() > now
}

export function totalVotes(poll) {
  return poll.options.reduce((total, option) => total + Number(option.votes || 0), 0)
}

export function shortAddress(address) {
  return address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'Not connected'
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}

export function timeRemaining(date) {
  const difference = new Date(date).getTime() - Date.now()
  if (difference <= 0) return 'Ended'
  const days = Math.floor(difference / 86400000)
  const hours = Math.floor((difference % 86400000) / 3600000)
  const minutes = Math.floor((difference % 3600000) / 60000)
  if (days) return `${days}d ${hours}h left`
  if (hours) return `${hours}h ${minutes}m left`
  return `${Math.max(1, minutes)}m left`
}

export function getWinningOption(poll) {
  return poll.options.reduce((winner, option) => option.votes > winner.votes ? option : winner, poll.options[0])
}
