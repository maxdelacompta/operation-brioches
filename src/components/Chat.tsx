import { useEffect, useMemo, useRef, useState } from 'react'
import {
  MessageCircle,
  Search,
  Send,
  X,
} from 'lucide-react'

import './Chat.css'

/* =========================================================
   TYPES
   ========================================================= */

type Conversation = {
  id: number
  name: string
  poste?: string
  online: boolean
  unread: number
  lastMessage: string
}

type ChatMessage = {
  id: number
  author: 'me' | 'them'
  text: string
}

type ChatProps = {
  isOpen: boolean
  showFloating: boolean
  onToggle: () => void
  onClose: () => void
  onUnreadChange: (count: number) => void
}

/* =========================================================
   DONNÉES DE DÉMONSTRATION
   ========================================================= */

const initialConversations: Conversation[] = [
  {
    id: 1,
    name: 'Chloé Martin',
    online: true,
    unread: 2,
    lastMessage: 'Tu peux regarder ça ?',
  },
  {
    id: 2,
    name: 'Service Comptabilité',
    online: true,
    unread: 1,
    lastMessage: 'Facture reçue ✓',
  },
  {
    id: 3,
    name: 'Rémi Dupont',
    online: false,
    unread: 0,
    lastMessage: "D'accord merci",
  },
]

const initialMessages: Record<number, ChatMessage[]> = {
  1: [
    {
      id: 1,
      author: 'them',
      text: 'Tu peux regarder ça ?',
    },
  ],
  2: [
    {
      id: 2,
      author: 'them',
      text: 'Facture reçue ✓',
    },
  ],
  3: [
    {
      id: 3,
      author: 'them',
      text: "D'accord merci",
    },
  ],
}

/* =========================================================
   COMPOSANT PRINCIPAL
   ========================================================= */

function Chat({
  isOpen,
  showFloating,
  onToggle,
  onClose,
  onUnreadChange,
}: ChatProps) {
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations)

  const [messages, setMessages] =
    useState<Record<number, ChatMessage[]>>(initialMessages)

  const [activeConversationId, setActiveConversationId] =
    useState<number | null>(null)

  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')

  const nextMessageId = useRef(4)

  /* =======================================================
     CONVERSATION ACTIVE
     ======================================================= */

  const activeConversation = conversations.find(
    (conversation) =>
      conversation.id === activeConversationId,
  )

  const activeMessages =
    activeConversationId === null
      ? []
      : messages[activeConversationId] || []

  /* =======================================================
     COMPTEUR DE MESSAGES NON LUS
     ======================================================= */

  const totalUnread = useMemo(() => {
    return conversations.reduce(
      (total, conversation) =>
        total + conversation.unread,
      0,
    )
  }, [conversations])

  // Synchronisation du compteur avec la Topbar.
  useEffect(() => {
    onUnreadChange(totalUnread)
  }, [totalUnread, onUnreadChange])

  /* =======================================================
     RECHERCHE
     ======================================================= */

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return conversations
    }

    return conversations.filter((conversation) => {
      const searchableText = [
        conversation.name,
        conversation.poste,
        conversation.lastMessage,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchableText.includes(query)
    })
  }, [conversations, search])

  /* =======================================================
     OUVERTURE D'UNE CONVERSATION
     ======================================================= */

  function openConversation(conversationId: number) {
    setActiveConversationId(conversationId)
    setMessage('')

    // Les messages de cette conversation passent à "lus".
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              unread: 0,
            }
          : conversation,
      ),
    )
  }

  /* =======================================================
     FERMETURE DU CHAT
     ======================================================= */

  function closeChat() {
    setActiveConversationId(null)
    setMessage('')
    onClose()
  }

  function closeConversation() {
    setActiveConversationId(null)
    setMessage('')
  }

  /* =======================================================
     ENVOI D'UN MESSAGE
     ======================================================= */

  function sendMessage() {
    const text = message.trim()

    if (!text || activeConversationId === null) {
      return
    }

    const conversationId = activeConversationId

    const newMessage: ChatMessage = {
      id: nextMessageId.current++,
      author: 'me',
      text,
    }

    // Ajout du message dans l'historique local.
    setMessages((current) => ({
      ...current,
      [conversationId]: [
        ...(current[conversationId] || []),
        newMessage,
      ],
    }))

    // Actualisation du dernier message dans la liste.
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              lastMessage: text,
            }
          : conversation,
      ),
    )

    setMessage('')
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <>
      {/* =================================================
          BOUTON FLOTTANT

          Visible uniquement lorsque la Topbar
          n'est plus visible à l'écran.
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
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            </>
          )}
        </button>
      )}

      {/* =================================================
          PANNEAU : LISTE DES DISCUSSIONS
      ================================================= */}

      {isOpen && (
        <div
          className={`chat-panel ${
            showFloating ? '' : 'chat-panel--topbar'
          }`}
        >
          {/* EN-TÊTE COMPACT */}

          <div className="chat-panel-header">
            <div className="chat-panel-title-row">
              <strong>Discussions</strong>

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

          {/* RECHERCHE */}

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

          {/* LISTE DES CONVERSATIONS */}

          <div className="chat-conversations">
            {filteredConversations.length === 0 ? (
              <div className="chat-empty">
                Aucune conversation trouvée.
              </div>
            ) : (
              filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  className={`chat-conversation ${
                    activeConversationId === conversation.id
                      ? 'active'
                      : ''
                  }`}
                  onClick={() =>
                    openConversation(conversation.id)
                  }
                >
                  {/* AVATAR */}

                  <div className="chat-avatar">
                    {conversation.name.charAt(0).toUpperCase()}

                    <span
                      className={`chat-status ${
                        conversation.online
                          ? 'online'
                          : 'offline'
                      }`}
                      aria-hidden="true"
                    />
                  </div>

                  {/* NOM + POSTE ÉVENTUEL + DERNIER MESSAGE */}

                  <div className="chat-conversation-info">
                    <div className="chat-conversation-identity">
                      <strong>
                        {conversation.name}
                      </strong>

                      {conversation.poste?.trim() && (
                        <span className="chat-conversation-poste">
                          · {conversation.poste}
                        </span>
                      )}
                    </div>

                    <span className="chat-conversation-preview">
                      {conversation.lastMessage}
                    </span>
                  </div>

                  {/* COMPTEUR NON LU */}

                  {conversation.unread > 0 && (
                    <span className="chat-unread">
                      {conversation.unread}
                    </span>
                  )}
                </button>
              ))
            )}
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
          {/* EN-TÊTE COMPACT */}

          <div className="chat-message-header">
            <div className="chat-message-person">
              <div className="chat-message-identity">
                {/* NOM PLUS GRAND */}

                <strong>
                  {activeConversation.name}
                </strong>

                {/* STATUT À CÔTÉ DU NOM */}

                <span
                  className={`chat-message-presence ${
                    activeConversation.online
                      ? 'online'
                      : 'offline'
                  }`}
                >
                  <span
                    className="chat-presence-dot"
                    aria-hidden="true"
                  />

                  {activeConversation.online
                    ? 'En ligne'
                    : 'Hors ligne'}
                </span>
              </div>
            </div>

            {/* UNIQUEMENT LE BOUTON FERMER */}

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

          {/* HISTORIQUE DES MESSAGES */}

          <div className="chat-message-content">
            {activeMessages.map((item) => (
              <div
                key={item.id}
                className={`chat-message ${
                  item.author === 'me'
                    ? 'sent'
                    : 'received'
                }`}
              >
                {item.text}
              </div>
            ))}
          </div>

          {/* BARRE D'ENVOI */}

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