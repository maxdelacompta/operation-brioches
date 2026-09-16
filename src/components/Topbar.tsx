import { useEffect, useRef, useState } from 'react'
import { Bell, MessageCircle, X } from 'lucide-react'

import './Topbar.css'

type TopbarProps = {
  unreadCount: number
  chatOpen: boolean
  onChatClick: () => void
  onVisibilityChange: (visible: boolean) => void
}

function Topbar({
  unreadCount,
  chatOpen,
  onChatClick,
  onVisibilityChange,
}: TopbarProps) {
  const [notificationsOpen, setNotificationsOpen] =
    useState(false)

  const topbarRef = useRef<HTMLElement | null>(null)

  // Détecte si la Topbar est visible à l'écran.
  // Cela fonctionne aussi lorsque le défilement
  // se fait dans un conteneur interne.
  useEffect(() => {
    const element = topbarRef.current

    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        onVisibilityChange(entry.isIntersecting)
      },
      {
        threshold: 0,
      },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [onVisibilityChange])

  return (
    <header ref={topbarRef} className="ob-topbar">

      <div className="ob-topbar-brand">
        <span>Campagne</span>
        <span className="ob-topbar-separator">/</span>
        <strong>Opération Brioches</strong>
      </div>

      <div className="ob-topbar-actions">

        {/* DISCUSSIONS */}

        <button
          type="button"
          className={`ob-notification-button ob-chat-button ${
            chatOpen ? 'active' : ''
          }`}
          aria-label={
            unreadCount > 0
              ? `Discussions, ${unreadCount} messages non lus`
              : 'Discussions'
          }
          aria-expanded={chatOpen}
          title="Discussions"
          onClick={onChatClick}
        >
          <MessageCircle size={21} />

          {unreadCount > 0 && (
            <span className="ob-chat-unread">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* NOTIFICATIONS */}

        <div className="ob-notifications-wrapper">

          <button
            type="button"
            className="ob-notification-button"
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() =>
              setNotificationsOpen((current) => !current)
            }
          >
            <Bell size={21} />
          </button>

          {notificationsOpen && (
            <div className="ob-notifications-panel">

              <div className="ob-notifications-header">
                <strong>Notifications</strong>

                <button
                  type="button"
                  aria-label="Fermer les notifications"
                  onClick={() => setNotificationsOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>

              <p>
                Les notifications seront reliées aux
                données utilisateurs.
              </p>

            </div>
          )}

        </div>

        {/* PROFIL */}

        <div className="ob-user-profile">

          <div className="ob-user-avatar">
            M
          </div>

          <div className="ob-user-info">
            <strong>Maxime Claudel</strong>
            <span>Administrateur</span>
          </div>

        </div>

      </div>

    </header>
  )
}

export default Topbar