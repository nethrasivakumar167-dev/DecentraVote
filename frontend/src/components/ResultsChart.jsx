import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { totalVotes } from '../utils/formatting'

const chartColors = Array.from({ length: 10 }, (_, index) => `var(--chart-color-${index + 1})`)

export default function ResultsChart({ poll, type = 'bar' }) {
  const data = poll.options.map((option) => ({ name: option.text, votes: option.votes }))
  const total = poll.totalVotes ?? totalVotes(poll)
  if (type === 'pie') {
    return (
      <div className="chart-wrap chart-pie">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart><Pie data={data} dataKey="votes" nameKey="name" innerRadius={66} outerRadius={94} paddingAngle={4} stroke="none">{data.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value, name) => [`${value} votes`, name]} contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-strong)', borderRadius: 12, color: 'var(--text)' }} /></PieChart>
        </ResponsiveContainer>
        <div className="chart-center"><strong>{total.toLocaleString()}</strong><span>total votes</span></div>
        <div className="chart-legend">{data.map((entry, index) => <span key={entry.name}><i style={{ background: chartColors[index % chartColors.length] }} />{entry.name}<b>{total ? Math.round(entry.votes / total * 100) : 0}%</b></span>)}</div>
      </div>
    )
  }
  return (
    <div className="chart-wrap chart-bars">
      <ResponsiveContainer width="100%" height={Math.max(240, data.length * 52)}>
        <BarChart data={data} layout="vertical" margin={{ left: 12, right: 24, top: 4, bottom: 4 }} barCategoryGap={16}>
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={142} tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--chart-cursor)' }} formatter={(value) => [`${value} votes`, 'Votes']} contentStyle={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-strong)', borderRadius: 12, color: 'var(--text)' }} />
          <Bar dataKey="votes" radius={[0, 7, 7, 0]}>{data.map((entry, index) => <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />)}</Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
