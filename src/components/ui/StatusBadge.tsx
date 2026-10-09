import type { ReactNode } from 'react'

type Tone =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

type StatusBadgeProps = {
  children: ReactNode
  tone?: Tone
}

export default function StatusBadge({
  children,
  tone = 'neutral',
}: StatusBadgeProps) {
  return (
    <span
      className={`ob-badge ob-badge--${tone}`}
    >
      {children}
    </span>
  )
}
