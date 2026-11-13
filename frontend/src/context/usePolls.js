import { useContext } from 'react'
import { PollContext } from './PollContext'

export function usePolls() {
  const context = useContext(PollContext)
  if (!context) throw new Error('usePolls must be used within PollProvider')
  return context
}
