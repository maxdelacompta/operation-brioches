import type { ReactNode } from 'react'

export type SegmentedTab<T extends string> = {
  value: T
  label: string
  icon?: ReactNode
}

type SegmentedTabsProps<T extends string> = {
  value: T
  tabs: SegmentedTab<T>[]
  onChange: (value: T) => void
}

export default function SegmentedTabs<
  T extends string,
>({
  value,
  tabs,
  onChange,
}: SegmentedTabsProps<T>) {
  return (
    <div className="ob-segmented">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`ob-segmented__button ${
            tab.value === value
              ? 'is-active'
              : ''
          }`}
          onClick={() =>
            onChange(tab.value)
          }
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  )
}
