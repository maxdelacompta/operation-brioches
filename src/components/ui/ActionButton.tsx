import type {
  ButtonHTMLAttributes,
  ReactNode,
} from 'react'

type Variant =
  | 'primary'
  | 'secondary'
  | 'ghost'

type ActionButtonProps =
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon?: ReactNode
    variant?: Variant
  }

export default function ActionButton({
  icon,
  variant = 'secondary',
  className = '',
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      className={`ob-button ob-button--${variant} ${className}`.trim()}
    >
      {icon}
      {children}
    </button>
  )
}
