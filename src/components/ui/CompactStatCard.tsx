import type { ReactNode } from 'react'

type CompactStatCardProps = {
  icon: ReactNode
  label: string
  value: string
  className: string
}

export default function CompactStatCard({ icon, label, value, className }: CompactStatCardProps) {
  return (
    <article className={className}>
      <div className={`${className}-icon`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  )
}
