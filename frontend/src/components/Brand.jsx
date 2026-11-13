import { Vote } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Brand() {
  return <Link className="brand" to="/" aria-label="DecentraVote home"><span className="brand-mark"><Vote size={20} strokeWidth={2.2} /></span><span className="brand-copy"><strong>DecentraVote</strong><small>Your voice. Your vote. On-chain.</small></span></Link>
}
