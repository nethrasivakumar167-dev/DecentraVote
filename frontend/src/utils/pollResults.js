import { isPollActive } from './formatting.js'

export function getPollResultOutcome(poll, total, now = Date.now()) {
  if (!total) return { label: 'NO VOTES YET', text: 'Awaiting the first vote', percentage: '—' }

  const highestCount = Math.max(...poll.options.map((option) => option.votes))
  const leaders = poll.options.filter((option) => option.votes === highestCount)
  const percentage = `${Math.round(highestCount / total * 100)}%`

  if (leaders.length > 1) {
    return {
      label: isPollActive(poll, now) ? 'PROVISIONAL TIE' : 'FINAL TIE',
      text: leaders.map((option) => option.text).join(' · '),
      percentage: `${percentage} each`,
    }
  }

  return {
    label: isPollActive(poll, now) ? 'PROVISIONAL LEADER' : 'FINAL WINNER',
    text: leaders[0].text,
    percentage,
  }
}
