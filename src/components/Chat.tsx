import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  MessageCircle,
  Search,
  Send,
  X,
} from 'lucide-react'

import { Link } from 'react-router-dom'

import {
  ROLE_LABELS,
  useUsers,
} from '../contexts/UsersContext'

import './Chat.css'

/* =========================================================
   TYPES
   ========================================================= */

type ChatMessage = {
  id: number
  senderId: string
  text: string
  read: boolean
}

type ChatProps = {
  isOpen: boolean
  showFloating: boolean
  onToggle: () => void
  onClose: () => void
  onUnreadChange: (count: number) => void
}

/* =========================================================
   COMPOSANT CHAT
   ========================================================= */

function Chat({
  isOpen,
  showFloating,
  onToggle,
  onClose,
  onUnreadChange,
}: ChatProps) {
  /* =======================================================
     UTILISATEURS PARTAGÉS
     ======================================================= */

  const {
    users,
    currentUserId,
  } = useUsers()

  /* =======================================================
     ÉTATS LOCAUX
     ======================================================= */

  const [activeConversationId, setActiveConversationId] =
    useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')

  // Messages locaux classés par identifiant utilisateur.
  // Les identifiants ne dépendent plus des noms.
  const [messages, setMessages] = useState<
    Record<string, ChatMessage[]>
  >({})

  const nextMessageId = useRef(1)

  /* =======================================================
     LISTE DES PERSONNES DISPONIBLES
     ======================================================= */

  const chatUsers = useMemo(() => {
    return users.filter(
      (user) =>
        user.id !== currentUserId &&
        user.status === 'actif',
    )
  }, [users, currentUserId])

  /* =======================================================
     CONVERSATION ACTIVE
     ======================================================= */

  const activeConversation =
    chatUsers.find(
      (user) => user.id === activeConversationId,
    ) ?? null

  const activeMessages = activeConversation
    ? messages[activeConversation.id] ?? []
    : []

  /* =======================================================
     DERNIER MESSAGE
     ======================================================= */

  function getLastMessage(userId: string) {
    const conversationMessages = messages[userId] ?? []

    if (conversationMessages.length === 0) {
      return 'Aucun message pour le moment'
    }

    return conversationMessages[
      conversationMessages.length - 1
    ].text
  }

  /* =======================================================
     MESSAGES NON LUS
     ======================================================= */

  const totalUnread = useMemo(() => {
    return chatUsers.reduce((total, user) => {
      const conversationMessages =
        messages[user.id] ?? []

      const unread = conversationMessages.filter(
        (item) =>
          item.senderId !== currentUserId &&
          !item.read,
      ).length

      return total + unread
    }, 0)
  }, [
    chatUsers,
    messages,
    currentUserId,
  ])

  // Synchronisation du compteur avec AppLayout et Topbar.
  useEffect(() => {
    onUnreadChange(totalUnread)
  }, [totalUnread, onUnreadChange])

  /* =======================================================
     RECHERCHE
     ======================================================= */

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return chatUsers
    }

    return chatUsers.filter((user) => {
      const searchableText = [
        user.name,
        user.email,
        user.poste,
        ROLE_LABELS[user.role],
        user.perimetre,
        getLastMessage(user.id),
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(query)
    })
  }, [
    chatUsers,
    search,
    messages,
  ])

  /* =======================================================
     COMPTEUR POUR UNE PERSONNE
     ======================================================= */

  function getUnreadCount(userId: string) {
    return (messages[userId] ?? []).filter(
      (item) =>
        item.senderId !== currentUserId &&
        !item.read,
    ).length
  }

  /* =======================================================
     OUVRIR UNE CONVERSATION
     ======================================================= */

  function openConversation(userId: string) {
    setActiveConversationId(userId)
    setMessage('')

    // Marquer les éventuels messages reçus comme lus.
    setMessages((current) => {
      const conversationMessages =
        current[userId] ?? []

      const hasUnread = conversationMessages.some(
        (item) =>
          item.senderId !== currentUserId &&
          !item.read,
      )

      if (!hasUnread) {
        return current
      }

      return {
        ...current,

        [userId]: conversationMessages.map((item) => ({
          ...item,
          read: true,
        })),
      }
    })
  }

  /* =======================================================
     FERMER LES DISCUSSIONS
     ======================================================= */

  function closeChat() {
    setActiveConversationId(null)
    setMessage('')
    onClose()
  }

  /* =======================================================
     FERMER UNE CONVERSATION
     ======================================================= */

  function closeConversation() {
    setActiveConversationId(null)
    setMessage('')
  }

  /* =======================================================
     ENVOYER UN MESSAGE LOCAL
     ======================================================= */

  function sendMessage() {
    const text = message.trim()

    if (!text || !activeConversation) {
      return
    }

    const userId = activeConversation.id

    const newMessage: ChatMessage = {
      id: nextMessageId.current++,
      senderId: currentUserId,
      text,
      read: true,
    }

    setMessages((current) => ({
      ...current,

      [userId]: [
        ...(current[userId] ?? []),
        newMessage,
      ],
    }))

    setMessage('')
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <>

      {/* =================================================
          BOUTON FLOTTANT

          Affiché lorsque la Topbar n'est plus visible.
      ================================================= */}

      {showFloating && (
        <button
          type="button"
          className={`chat-floating-button ${
            totalUnread > 0 ? 'has-unread' : ''
          }`}
          onClick={onToggle}
          aria-label={
            totalUnread > 0
              ? `Discussions, ${totalUnread} messages non lus`
              : 'Discussions'
          }
          aria-expanded={isOpen}
          title="Discussions"
        >

          <MessageCircle size={22} />

          {totalUnread > 0 && (
            <>
              <span className="chat-floating-label">
                Discussions
              </span>

              <span className="chat-badge">
                {totalUnread > 99
                  ? '99+'
                  : totalUnread}
              </span>
            </>
          )}

        </button>
      )}

      {/* =================================================
          PANNEAU DES DISCUSSIONS
      ================================================= */}

      {isOpen && (
        <div
          className={`chat-panel ${
            showFloating
              ? ''
              : 'chat-panel--topbar'
          }`}
        >

          {/* EN-TÊTE */}

          <div className="chat-panel-header">

            <div className="chat-panel-title-row">

              <strong>
                Discussions
              </strong>

              <span className="chat-panel-status">
                {totalUnread > 0
                  ? `${totalUnread} message${
                      totalUnread > 1 ? 's' : ''
                    } non lu${totalUnread > 1 ? 's' : ''}`
                  : 'Tous les messages sont lus'}
              </span>

            </div>

            <button
              type="button"
              aria-label="Fermer les discussions"
              title="Fermer les discussions"
              onClick={closeChat}
            >
              <X size={19} />
            </button>

          </div>

          {/* =================================================
              RECHERCHE
          ================================================= */}

          <div className="chat-search">

            <Search size={19} />

            <input
              type="search"
              value={search}
              placeholder="Rechercher une personne..."
              aria-label="Rechercher une conversation"
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

          </div>

          {/* =================================================
              LISTE DES UTILISATEURS
          ================================================= */}

          <div className="chat-conversations">

            {/* AUCUN AUTRE UTILISATEUR ACTIF */}

            {chatUsers.length === 0 && (
              <div className="chat-empty">

                <p>
                  Aucun autre utilisateur actif.
                </p>

                <Link
                  to="/administration/utilisateurs"
                  onClick={closeChat}
                >
                  Gérer les utilisateurs
                </Link>

              </div>
            )}

            {/* RECHERCHE SANS RÉSULTAT */}

            {chatUsers.length > 0 &&
              filteredUsers.length === 0 && (
                <div className="chat-empty">
                  Aucune conversation trouvée.
                </div>
              )}

            {/* CONVERSATIONS */}

            {filteredUsers.map((user) => {
              const unread = getUnreadCount(user.id)

              const posteOuRole =
                user.poste.trim() ||
                ROLE_LABELS[user.role]

              return (
                <button
                  key={user.id}
                  type="button"
                  className={`chat-conversation ${
                    activeConversationId === user.id
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    openConversation(user.id)
                  }
                >

                  {/* AVATAR */}

                  <div className="chat-avatar">
                    {user.name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  {/* IDENTITÉ ET DERNIER MESSAGE */}

                  <div className="chat-conversation-info">

                    <div className="chat-conversation-identity">

                      <strong>
                        {user.name}
                      </strong>

                      {posteOuRole && (
                        <span className="chat-conversation-poste">
                          · {posteOuRole}
                        </span>
                      )}

                    </div>

                    <span className="chat-conversation-preview">
                      {getLastMessage(user.id)}
                    </span>

                  </div>

                  {/* COMPTEUR */}

                  {unread > 0 && (
                    <span className="chat-unread">
                      {unread}
                    </span>
                  )}

                </button>
              )
            })}

          </div>

        </div>
      )}

      {/* =================================================
          FENÊTRE DE CONVERSATION
      ================================================= */}

      {isOpen && activeConversation && (
        <div
          className={`chat-message-window ${
            showFloating
              ? ''
              : 'chat-message-window--topbar'
          }`}
        >

          {/* =================================================
              EN-TÊTE
          ================================================= */}

          <div className="chat-message-header">

            <div className="chat-message-person">

              <div className="chat-message-identity">

                {/* NOM DEPUIS LE RÉFÉRENTIEL */}

                <strong>
                  {activeConversation.name}
                </strong>

                {/*
                  À ce stade, nous connaissons le statut
                  du compte, mais pas la présence réelle
                  en ligne.

                  On affiche donc "Compte actif" au lieu
                  d'inventer un statut de connexion.
                */}

                <span className="chat-message-presence online">

                  <span
                    className="chat-presence-dot"
                    aria-hidden="true"
                  />

                  Compte actif

                </span>

              </div>

            </div>

            {/* UN SEUL BOUTON : FERMER */}

            <div className="chat-message-actions">

              <button
                type="button"
                aria-label="Fermer la conversation"
                title="Fermer la conversation"
                onClick={closeConversation}
              >
                <X size={19} />
              </button>

            </div>

          </div>

          {/* =================================================
              HISTORIQUE DES MESSAGES
          ================================================= */}

          <div className="chat-message-content">

            {activeMessages.length === 0 ? (

              <div className="chat-empty">
                Aucun message pour le moment.
                <br />
                Commencez la conversation.
              </div>

            ) : (

              activeMessages.map((item) => (

                <div
                  key={item.id}
                  className={`chat-message ${
                    item.senderId === currentUserId
                      ? 'sent'
                      : 'received'
                  }`}
                >
                  {item.text}
                </div>

              ))

            )}

          </div>

          {/* =================================================
              BARRE D'ENVOI
          ================================================= */}

          <form
            className="chat-message-input"
            onSubmit={(event) => {
              event.preventDefault()
              sendMessage()
            }}
          >

            <input
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              placeholder="Écrire un message..."
              aria-label="Écrire un message"
            />

            <button
              type="submit"
              className="chat-send-button"
              disabled={!message.trim()}
              aria-label="Envoyer le message"
              title="Envoyer"
            >
              <Send size={19} />
            </button>

          </form>

        </div>
      )}

    </>
  )
}

export default Chat