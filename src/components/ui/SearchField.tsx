import { Search } from 'lucide-react'

type SearchFieldProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export default function SearchField({
  value,
  onChange,
  placeholder = 'Rechercher...',
}: SearchFieldProps) {
  return (
    <label className="ob-search">
      <Search size={17} />

      <input
        type="search"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
      />
    </label>
  )
}
