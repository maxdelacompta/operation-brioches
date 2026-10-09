import type { ReactNode } from 'react'

type PageHeaderProps = {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode

  /*
    true   = illustration OB HD
    false  = aucune illustration
    string = URL personnalisée
  */
  illustration?:
    | boolean
    | string
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  illustration = false,
}: PageHeaderProps) {
  const illustrationSrc =
    illustration === true
      ? '/ob/ob-header-community.png'
      : typeof illustration === 'string'
        ? illustration
        : null

  return (
    <header
      className={`ob-page-header ${
        illustrationSrc
          ? 'ob-page-header--illustrated'
          : ''
      }`}
    >
      <div className="ob-page-header__copy">
        {eyebrow && (
          <span className="ob-page-header__eyebrow">
            {eyebrow}
          </span>
        )}

        <h1>{title}</h1>

        {description && (
          <p>{description}</p>
        )}
      </div>

      {illustrationSrc && (
        <div
          className="ob-page-header__illustration"
          aria-hidden="true"
        >
          <img
            src={illustrationSrc}
            alt=""
          />
        </div>
      )}

      {actions && (
        <div className="ob-page-header__actions">
          {actions}
        </div>
      )}
    </header>
  )
}
