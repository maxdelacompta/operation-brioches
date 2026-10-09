import type { ReactNode } from 'react'

type SectionCardProps = {
  title?: string
  action?: ReactNode
  children: ReactNode
  padded?: boolean
  className?: string
}

export default function SectionCard({
  title,
  action,
  children,
  padded = false,
  className = '',
}: SectionCardProps) {
  return (
    <section
      className={`ob-card ${className}`.trim()}
    >
      {(title || action) && (
        <header className="ob-card__header">
          {title ? <h2>{title}</h2> : <span />}
          {action}
        </header>
      )}

      <div
        className={
          padded
            ? 'ob-card__body'
            : undefined
        }
      >
        {children}
      </div>
    </section>
  )
}
