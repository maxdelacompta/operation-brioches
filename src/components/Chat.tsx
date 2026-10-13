import { chatStore, conversationsForUser, CHAT_STORAGE_PREFIX } from '../services/chatStore'
import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  useState,
} from 'react'

import {
  MessageCircle,
  Plus,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
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
  const [isComposing, setIsComposing] = useState(false)
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false)
  const [message, setMessage] = useState('')

  const storedMessages = useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot, chatStore.getServerSnapshot)
  const messages = useMemo(() => conversationsForUser(storedMessages, currentUserId), [storedMessages, currentUserId])
  const [chatError, setChatError] = useState('')

  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(CHAT_STORAGE_PREFIX)) chatStore.refresh()
    }
    window.addEventListener('storage', synchronize)
    chatStore.refresh()
    return () => window.removeEventListener('storage', synchronize)
  }, [])

  // Incoming messages are read only when this conversation is visibly open.
  useEffect(() => {
    if (!isOpen || !activeConversationId || !users.some(user => user.id === activeConversationId && user.status === 'actif')) return
    const markRead = () => {
      if (document.visibilityState !== 'visible') return
      try { chatStore.markRead(currentUserId, activeConversationId) }
      catch { setChatError('Impossible d’enregistrer la lecture du message dans ce navigateur.') }
    }
    markRead()
    document.addEventListener('visibilitychange', markRead)
    return () => document.removeEventListener('visibilitychange', markRead)
  }, [isOpen, activeConversationId, currentUserId, storedMessages, users])

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

  const existingChatUsers = useMemo(() => chatUsers
    .filter(user => (messages[user.id]?.length ?? 0) > 0)
    .sort((a, b) => (messages[b.id]?.at(-1)?.createdAt ?? 0) - (messages[a.id]?.at(-1)?.createdAt ?? 0)), [chatUsers, messages])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return isComposing ? chatUsers : existingChatUsers
    }

    return (isComposing ? chatUsers : existingChatUsers).filter((user) => {
      const searchableText = [
        user.name,
        user.email,
        user.poste,
        ROLE_LABELS[user.role],
        user.perimetre,
        messages[user.id]?.at(-1)?.text ?? 'Aucun message pour le moment',
      ]
        .join(' ')
        .toLowerCase()

      return searchableText.includes(query)
    })
  }, [
    chatUsers,
    existingChatUsers,
    isComposing,
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
    setIsComposing(false)
    setRecipientId(null)
    setRecipientDropdownOpen(false)
    setSearch('')
    setMessage('')

    setChatError('')
  }

  /* =======================================================
     FERMER LES DISCUSSIONS
     ======================================================= */

  function closeChat() {
    setActiveConversationId(null)
    setIsComposing(false)
    setRecipientId(null)
    setRecipientDropdownOpen(false)
    setSearch('')
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

    try {
      if (!chatStore.send(currentUserId, activeConversation.id, text)) return
      setChatError('')
    } catch {
      setChatError('Message non envoyé : le stockage du navigateur est indisponible ou plein. Ton texte est conservé.')
      return
    }

    setMessage('')
  }

  function sendNewMessage() {
    const text = message.trim()
    if (!text || !recipientId || !chatUsers.some(user => user.id === recipientId)) return
    try {
      if (!chatStore.send(currentUserId, recipientId, text)) return
      setChatError('')
    } catch {
      setChatError('Message non envoyé : le stockage du navigateur est indisponible ou plein. Ton texte est conservé.')
      return
    }
    setMessage('')
    setSearch('')
    setIsComposing(false)
    setActiveConversationId(recipientId)
    setRecipientId(null)
    setRecipientDropdownOpen(false)
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <>
      {chatError && <div className="chat-storage-error" role="alert">{chatError}<button type="button" onClick={() => setChatError('')} aria-label="Fermer le message d’erreur">×</button></div>}

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
                {isComposing ? 'Nouveau message' : 'Discussions'}
              </strong>

              {!isComposing && <span className="chat-panel-status">
                {totalUnread > 0
                  ? `${totalUnread} message${
                      totalUnread > 1 ? 's' : ''
                    } non lu${totalUnread > 1 ? 's' : ''}`
                  : 'Tous les messages sont lus'}
              </span>}

            </div>

            <div className="chat-header-actions">
              <button type="button" className="chat-new-message" aria-label={isComposing ? 'Revenir aux discussions' : 'Nouveau message'} title={isComposing ? 'Revenir aux discussions' : 'Nouveau message'} onClick={() => { setIsComposing(value => !value); setRecipientId(null); setRecipientDropdownOpen(false); setActiveConversationId(null); setSearch(''); setMessage('') }}>
                {isComposing ? <ArrowLeft size={20} /> : <Plus size={22} />}
              </button>
            <button
              type="button"
              aria-label="Fermer les discussions"
              title="Fermer les discussions"
              onClick={closeChat}
            >
              <X size={19} />
            </button>
            </div>

          </div>

          {isComposing ? (
            <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); sendNewMessage() }}>
              <label className="chat-compose-label" htmlFor="chat-recipient-search">À :</label>
              <div className="chat-compose-search">
                <Search size={18} />
                <input
                  id="chat-recipient-search"
                  type="search"
                  value={search}
                  placeholder="Rechercher une personne..."
                  onFocus={() => { if (!recipientId) setRecipientDropdownOpen(true) }}
                  onChange={event => { setSearch(event.target.value); setRecipientId(null); setRecipientDropdownOpen(true) }}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={recipientDropdownOpen}
                  aria-controls="chat-recipient-options"
                  aria-autocomplete="list"
                />
                <button
                  type="button"
                  className="chat-compose-dropdown-toggle"
                  onClick={() => setRecipientDropdownOpen(open => !open)}
                  aria-label={recipientDropdownOpen ? 'Fermer la liste des destinataires' : 'Afficher les destinataires'}
                  aria-expanded={recipientDropdownOpen}
                >
                  {recipientDropdownOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </button>
              </div>
              {recipientDropdownOpen && (
                <div id="chat-recipient-options" className="chat-compose-recipients" role="listbox" aria-label="Choisir un destinataire">
                  {filteredUsers.length === 0 ? (
                    <p className="chat-compose-empty">Aucun utilisateur trouvé.</p>
                  ) : filteredUsers.map(user => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={recipientId === user.id}
                      key={user.id}
                      className={`chat-compose-recipient ${recipientId === user.id ? 'selected' : ''}`}
                      onClick={() => { setRecipientId(user.id); setSearch(user.name); setRecipientDropdownOpen(false) }}
                    >
                      <span className="chat-avatar">{user.name.charAt(0).toUpperCase()}</span>
                      <span><strong>{user.name}</strong><small>{user.poste.trim() || ROLE_LABELS[user.role]}</small></span>
                      {recipientId === user.id && <span className="chat-compose-selected">✓</span>}
                    </button>
                  ))}
                </div>
              )}
              <label className="chat-compose-label" htmlFor="chat-new-message-text">Message :</label>
              <textarea
                id="chat-new-message-text"
                className="chat-compose-textarea"
                value={message}
                onChange={event => setMessage(event.target.value)}
                placeholder="Écrire votre message..."
                rows={5}
              />
              <button type="submit" className="chat-compose-send" disabled={!recipientId || !message.trim()}>
                <Send size={17} /> Envoyer le message
              </button>
            </form>
          ) : (
            <>
          {/* =================================================
              RECHERCHE
          ================================================= */}

          <div className="chat-search">

            <Search size={19} />

            <input
              type="search"
              value={search}
              placeholder={isComposing ? "Rechercher une personne..." : "Rechercher une conversation..."}
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
                  {isComposing ? 'Aucun utilisateur trouvé.' : search ? 'Aucune conversation trouvée.' : 'Aucune discussion pour le moment. Cliquez sur + pour écrire un message.'}
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
                      {isComposing && !(messages[user.id]?.length) ? 'Commencer une conversation' : getLastMessage(user.id)}
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
            </>
          )}

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