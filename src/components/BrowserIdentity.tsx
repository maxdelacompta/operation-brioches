import { useEffect } from 'react'

const APP_TITLE =
  'Logiciel Brioches'

const FAVICON_HREF =
  '/ob/brioche-favicon.svg'

export default function BrowserIdentity() {
  useEffect(() => {
    document.title = APP_TITLE

    let favicon =
      document.querySelector<HTMLLinkElement>(
        'link[rel="icon"]',
      )

    if (!favicon) {
      favicon =
        document.createElement('link')

      favicon.rel = 'icon'
      document.head.appendChild(
        favicon,
      )
    }

    favicon.type = 'image/svg+xml'
    favicon.href = FAVICON_HREF
  }, [])

  return null
}
