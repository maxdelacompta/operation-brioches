import {
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  Bell,
  MessageCircle,
  LogOut,
  Search,
  X,
} from 'lucide-react'

import {
  Link,
  useNavigate,
} from 'react-router-dom'

import {
  ROLE_LABELS,
  getUserDisplayName,
  useUsers,
} from '../contexts/UsersContext'

import {
  useGeneralSettings,
} from '../contexts/GeneralSettingsContext'

import { useAuth } from '../contexts/AuthContext'
import { useObData } from '../contexts/ObDataContext'

import { ALERTS_EVENT, readUserAlerts, type UserAlert } from '../services/userAlerts'
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
  const { signOut } = useAuth()
  const {
    campagnes,
    activeCampagne,
    selectedCampagne,
    selectedCampagneId,
    setSelectedCampagneId,
  } = useObData()

  const {
    settings,
  } = useGeneralSettings()

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

  const [myAlerts, setMyAlerts] = useState<UserAlert[]>(readUserAlerts)
  useEffect(() => {
    const refresh = () => setMyAlerts(readUserAlerts())
    window.addEventListener(ALERTS_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(ALERTS_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  const pendingAlerts = myAlerts.filter(alert =>
    alert.assigneeId === currentUser?.id && alert.status !== 'terminee')

  /* =======================================================
     INFORMATIONS UTILISATEUR
     ======================================================= */

  const userName =
    getUserDisplayName(currentUser)

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
        navigate('/recherche')
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
            CAMPAGNE · {selectedCampagne?.annee ?? selectedCampagne?.id ?? 'Aucune'}
          </span>

          <strong>
            {applicationName}
          </strong>

        </div>

      </Link>

      {/* Choix de la campagne consultée : ne change pas son statut administratif. */}
      <div className="ob-topbar-campaign-picker">
        <label htmlFor="ob-campagne-travail">Campagne de travail</label>
        <select
          id="ob-campagne-travail"
          aria-label="Choisir la campagne de travail"
          title="Changer de campagne de travail"
          value={campagnes.some(c => c.id === selectedCampagneId) ? selectedCampagneId : ''}
          onChange={event => setSelectedCampagneId(event.target.value)}
        >
          <option value="">
            {activeCampagne
              ? `Active · ${activeCampagne.annee ?? activeCampagne.id}`
              : 'Aucune campagne active'}
          </option>
          {campagnes.map(campagne => (
            <option key={campagne.id} value={campagne.id}>
              {`${campagne.statut === 'ACTIVE' ? 'Active' : campagne.statut === 'PREPARATION' ? 'Prépa' : campagne.statut === 'TERMINEE' ? 'Terminée' : 'À configurer'} · ${campagne.annee ?? campagne.id}`}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        className="ob-topbar-global-search"
        onClick={() => navigate('/recherche')}
        aria-label="Ouvrir la recherche globale"
        title="Rechercher dans Opération Brioche (Ctrl + K)"
      >
        <Search size={19} aria-hidden="true" />
        <span>Rechercher dans Opération Brioche...</span>
        <kbd>Ctrl K</kbd>
      </button>

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
            {pendingAlerts.length > 0 && (
              <span className="ob-topbar-alert-count">{pendingAlerts.length > 9 ? '9+' : pendingAlerts.length}</span>
            )}

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

              {pendingAlerts.length > 0 ? (
                <div className="ob-topbar-alert-preview">
                  {pendingAlerts.slice(0, 4).map(alert => (
                    <div key={alert.id} className="ob-topbar-alert-preview-item">
                      <strong>{alert.title}</strong>
                      <span>{alert.module}{alert.dueDate ? ` · ${alert.dueDate}` : ''}</span>
                    </div>
                  ))}
                  {pendingAlerts.length > 4 && <p>+ {pendingAlerts.length - 4} autre(s) alerte(s)</p>}
                </div>
              ) : (
                <div className="ob-topbar-notification-empty">
                  <div className="ob-topbar-empty-icon"><Bell size={23} /></div>
                  <strong>Aucune alerte en attente</strong>
                  <p>Les alertes qui te sont attribuées apparaîtront ici.</p>
                </div>
              )}
              <Link to="/mes-alertes" className="ob-topbar-alert-manage" onClick={() => setNotificationsOpen(false)}>
                Je crée mes alertes
              </Link>

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

        <div className="ob-topbar-user ob-topbar-account-menu">
          <Link
            to="/mon-compte"
            className="ob-topbar-account-trigger"
            aria-label={`Gestion de mon compte — ${userName}`}
            title="Gestion de mon compte"
          >
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
          </Link>
          <div className="ob-topbar-account-popover">
            <Link to="/mon-compte" className="ob-topbar-account-option">
              Gestion de mon compte
            </Link>
          </div>
        </div>

        <button
          type="button"
          className="ob-topbar-logout"
          onClick={() => { signOut(); navigate('/connexion', { replace: true }) }}
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <LogOut size={18} />
          <span>Déconnexion</span>
        </button>

      </div>

    </header>
  )
}

export default Topbar