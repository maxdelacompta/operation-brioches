type TopbarBrandProps = {
  label?: string
  title?: string
}

export default function TopbarBrand({
  label = 'LOGICIEL',
  title = 'Logiciel Brioches',
}: TopbarBrandProps) {
  return (
    <div className="ob-topbar-brand">
      <div
        className="ob-topbar-brand__icon"
        aria-hidden="true"
      >
        <img
          src="/ob/brioche-mark.svg"
          alt=""
        />
      </div>

      <div className="ob-topbar-brand__copy">
        <span className="ob-topbar-brand__label">
          {label}
        </span>

        <strong className="ob-topbar-brand__title">
          {title}
        </strong>
      </div>
    </div>
  )
}
