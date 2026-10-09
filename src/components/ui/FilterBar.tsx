import type { ReactNode } from 'react'

export default function FilterBar({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="ob-filter-bar">
      {children}
    </div>
  )
}
