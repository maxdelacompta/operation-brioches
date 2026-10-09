import { useLocation } from 'react-router-dom'

export default function GlobalHeaderArt() {
  const location = useLocation()

  return (
    <div
      key={location.pathname}
      className="ob-global-header-art"
      aria-hidden="true"
    >
      <img
        src="/ob/ob-header-community.png"
        alt=""
      />
    </div>
  )
}
