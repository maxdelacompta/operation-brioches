import type { ReactNode } from 'react'

type Tone =
  | 'green'
  | 'blue'
  | 'orange'
  | 'pink'
  | 'purple'

type StatCardProps = {
  label: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  tone?: Tone
  trend?: string
}

export default function StatCard({
  label,
  value,
  subtitle,
  icon,
  tone = 'blue',
  trend,
}: StatCardProps) {
  return (
    <article className="ob-stat-card">
      <span
        className={`ob-stat-card__icon ob-stat-card__icon--${tone}`}
      >
        {icon}
      </span>

      <div>
        <span className="ob-stat-card__label">
          {label}
        </span>

        <strong className="ob-stat-card__value">
          {value}
        </strong>

        {subtitle && (
          <span className="ob-stat-card__subtitle">
            {subtitle}
          </span>
        )}
      </div>

      {trend && (
        <span className="ob-stat-card__trend">
          {trend}
        </span>
      )}
    </article>
  )
}
