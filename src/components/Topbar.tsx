import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'

import {
  Bell,
  MessageCircle,
  Search,
  X,
} from 'lucide-react'

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import {
  ROLE_LABELS,
  useUsers,
} from '../contexts/UsersContext'

import {
  useGeneralSettings,
} from '../contexts/GeneralSettingsContext'

import { useObData } from '../contexts/ObDataContext'

import './Topbar.css'

/* =========================================================
   PROPRIÉTÉS

   On conserve la signature utilisée par AppLayout.
   ========================================================= */

type TopbarProps = {
  unreadCount: number
  chatOpen: boolean
  onChatClick: () => void
  onVisibilityChange: (visible: boolean) => void
}

/* =========================================================
   INITIALES
   ========================================================= */

function getInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) {
    return '?'
  }

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}

/* =========================================================
   TOPBAR
   ========================================================= */

function Topbar({
  unreadCount,
  chatOpen,
  onChatClick,
  onVisibilityChange,
}: TopbarProps) {
  /* =======================================================
     CONTEXTES
     ======================================================= */

  const {
    currentUser,
  } = useUsers()

  const navigate = useNavigate()
  const location = useLocation()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [headerQuery, setHeaderQuery] = useState('')

  // Synchronise la barre lorsque la recherche est modifiée sur sa page.
  useEffect(() => {
    if (location.pathname === '/recherche') {
      setHeaderQuery(new URLSearchParams(location.search).get('q') ?? '')
    }
  }, [location.pathname, location.search])

  function submitHeaderSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const term = headerQuery.trim()
    navigate(term ? `/recherche?q=${encodeURIComponent(term)}` : '/recherche')
  }

  const {
    settings,
  } = useGeneralSettings()

  const { activeCampagne } = useObData()

  /* =======================================================
     RÉFÉRENCES
     ======================================================= */

  const topbarRef =
    useRef<HTMLElement | null>(null)

  const notificationsRef =
    useRef<HTMLDivElement | null>(null)

  /* =======================================================
     ÉTATS
     ======================================================= */

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] = useState(false)

  /* =======================================================
     INFORMATIONS UTILISATEUR
     ======================================================= */

  const userName =
    currentUser?.name || 'Utilisateur'

  const userRole = currentUser
    ? ROLE_LABELS[currentUser.role]
    : 'Profil non disponible'

  const userInitials =
    getInitials(userName)

  /* =======================================================
     NOM DE L'APPLICATION

     Relié aux Paramètres généraux.
     ======================================================= */

  const applicationName =
    activeCampagne?.nom?.trim() ||
    settings.applicationName.trim() ||
    'Opération Brioches'

  /* =======================================================
     NOMBRE DE MESSAGES NON LUS
     ======================================================= */

  const unreadMessages =
    Math.max(0, unreadCount)

  const unreadLabel =
    unreadMessages > 99
      ? '99+'
      : String(unreadMessages)

  /* =======================================================
     DÉTECTION DE VISIBILITÉ

     Permet à AppLayout / Chat de savoir si la
     Topbar est encore visible à l'écran.
     ======================================================= */

  useEffect(() => {
    const element = topbarRef.current

    if (!element) {
      return
    }

    if (
      typeof IntersectionObserver === 'undefined'
    ) {
      onVisibilityChange(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        onVisibilityChange(
          entry.isIntersecting,
        )
      },
      {
        threshold: 0.01,
      },
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [onVisibilityChange])

  /* =======================================================
     FERMETURE DES NOTIFICATIONS

     Clic à l'extérieur ou touche Échap.
     ======================================================= */

  useEffect(() => {
    if (!notificationsOpen) {
      return
    }

    function handleOutsideClick(
      event: MouseEvent,
    ) {
      const target = event.target

      if (!(target instanceof Node)) {
        return
      }

      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(target)
      ) {
        setNotificationsOpen(false)
      }
    }

    function handleEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === 'Escape') {
        setNotificationsOpen(false)
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick,
    )

    document.addEventListener(
      'keydown',
      handleEscape,
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick,
      )

      document.removeEventListener(
        'keydown',
        handleEscape,
      )
    }
  }, [notificationsOpen])

  // Raccourci de recherche globale (Ctrl+K / Cmd+K).
  useEffect(() => {
    function onSearchKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (window.matchMedia('(max-width: 750px)').matches) {
          navigate('/recherche')
        } else {
          searchInputRef.current?.focus()
          searchInputRef.current?.select()
        }
      }
    }
    window.addEventListener('keydown', onSearchKey)
    return () => window.removeEventListener('keydown', onSearchKey)
  }, [navigate])

  /* =======================================================
     OUVERTURE DU CHAT
     ======================================================= */

  function handleChatClick() {
    setNotificationsOpen(false)
    onChatClick()
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <header
      ref={topbarRef}
      className="ob-topbar"
    >

      {/* ===================================================
          IDENTITÉ DE L'APPLICATION
      =================================================== */}

      <Link
        to="/"
        className="ob-topbar-brand"
        aria-label={`Accueil - ${applicationName}`}
      >

        <div className="ob-topbar-logo">
          OB
        </div>

        <div className="ob-topbar-brand-text">

          <span className="ob-topbar-eyebrow">
            CAMPAGNE
          </span>

          <strong>
            {applicationName}
          </strong>

        </div>

      </Link>

      <form className="ob-topbar-global-search" role="search" onSubmit={submitHeaderSearch}>
        <input
          ref={searchInputRef}
          type="search"
          value={headerQuery}
          onChange={(event) => setHeaderQuery(event.target.value)}
          placeholder="Rechercher dans OB2026..."
          aria-label="Rechercher dans OB2026"
        />
        <kbd aria-hidden="true">Ctrl K</kbd>
        <button type="submit" className="ob-topbar-global-search-submit" aria-label="Lancer la recherche" title="Lancer la recherche">
          <Search size={19} aria-hidden="true" />
        </button>
      </form>

      {/* ===================================================
          PARTIE DROITE
      =================================================== */}

      <div className="ob-topbar-actions">

        {/* ================================================
            NOTIFICATIONS
        ================================================ */}

        <div
          ref={notificationsRef}
          className="ob-topbar-notifications"
        >

          <button
            type="button"
            className={`ob-topbar-icon-button ${
              notificationsOpen ? 'active' : ''
            }`}
            onClick={() =>
              setNotificationsOpen(
                (current) => !current,
              )
            }
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            aria-controls="ob-notifications-panel"
            title="Notifications"
          >

            <Bell size={20} />

          </button>

          {notificationsOpen && (

            <div
              id="ob-notifications-panel"
              className="ob-topbar-notification-panel"
            >

              <div className="ob-topbar-panel-header">

                <div>

                  <strong>
                    Notifications
                  </strong>

                  <span>
                    Centre de notifications
                  </span>

                </div>

                <button
                  type="button"
                  className="ob-topbar-panel-close"
                  onClick={() =>
                    setNotificationsOpen(false)
                  }
                  aria-label="Fermer les notifications"
                >

                  <X size={17} />

                </button>

              </div>

              <div className="ob-topbar-notification-empty">

                <div className="ob-topbar-empty-icon">

                  <Bell size={23} />

                </div>

                <strong>
                  Aucune notification
                </strong>

                <p>
                  Les alertes des différents
                  modules apparaîtront ici
                  lorsqu'elles seront connectées.
                </p>

              </div>

            </div>

          )}

        </div>

        {/* ================================================
            CHAT

            Relié au Chat existant.
        ================================================ */}

        <button
          type="button"
          className={`ob-topbar-icon-button ob-topbar-chat-button ${
            chatOpen ? 'active' : ''
          }`}
          onClick={handleChatClick}
          aria-label={
            unreadMessages > 0
              ? `Discussions : ${unreadMessages} message(s) non lu(s)`
              : 'Ouvrir les discussions'
          }
          aria-pressed={chatOpen}
          title="Discussions"
        >

          <MessageCircle size={21} />

          {unreadMessages > 0 && (

            <span className="ob-topbar-chat-badge">

              {unreadLabel}

            </span>

          )}

        </button>

        {/* ================================================
            SÉPARATEUR
        ================================================ */}

        <div
          className="ob-topbar-divider"
          aria-hidden="true"
        />

        {/* ================================================
            UTILISATEUR CONNECTÉ

            Relié à UsersContext.
        ================================================ */}

        <div className="ob-topbar-user">

          <div className="ob-topbar-avatar">

            {userInitials}

          </div>

          <div className="ob-topbar-user-info">

            <strong>
              {userName}
            </strong>

            <span>
              {userRole}
            </span>

          </div>

        </div>

      </div>

    </header>
  )
}

export default Topbar