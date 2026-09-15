import { useState } from 'react'
import {
  MessageCircle,
  Search,
  Send,
  X,
  Minus,
  Paperclip,
} from 'lucide-react'

import './Chat.css'

type Conversation = {
  id: number
  name: string
  online: boolean
  unread: number
  lastMessage: string
}

const conversations: Conversation[] = [
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

function Chat() {
  const [isOpen, setIsOpen] = useState(false)
  const [activeConversation, setActiveConversation] =
    useState<Conversation | null>(null)

  const [message, setMessage] = useState('')

  const totalUnread = conversations.reduce(
    (total, conversation) => total + conversation.unread,
    0,
  )

  const sendMessage = () => {
    if (!message.trim()) return

    console.log('Message envoyé :', message)

    setMessage('')
  }

  return (
    <>
      {/* BOUTON PRINCIPAL */}
      <button
        className="chat-floating-button"
        onClick={() => setIsOpen((value) => !value)}
      >
        <MessageCircle size={22} />

        <span>Discussion</span>

        {totalUnread > 0 && (
          <span className="chat-badge">{totalUnread}</span>
        )}
      </button>

      {/* LISTE DES CONVERSATIONS */}
      {isOpen && (
        <div className="chat-panel">
          <div className="chat-panel-header">
            <strong>Discussions</strong>

            <button onClick={() => setIsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="chat-search">
            <Search size={17} />

            <input
              type="text"
              placeholder="Rechercher une personne..."
            />
          </div>

          <div className="chat-conversations">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className="chat-conversation"
                onClick={() => setActiveConversation(conversation)}
              >
                <div className="chat-avatar">
                  {conversation.name.charAt(0)}

                  <span
                    className={`chat-status ${
                      conversation.online ? 'online' : 'offline'
                    }`}
                  />
                </div>

                <div className="chat-conversation-info">
                  <strong>{conversation.name}</strong>
                  <span>{conversation.lastMessage}</span>
                </div>

                {conversation.unread > 0 && (
                  <span className="chat-unread">
                    {conversation.unread}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FENÊTRE DE CONVERSATION */}
      {activeConversation && (
        <div className="chat-message-window">
          <div className="chat-message-header">
            <div>
              <strong>{activeConversation.name}</strong>

              <span>
                {activeConversation.online
                  ? 'En ligne'
                  : 'Hors ligne'}
              </span>
            </div>

            <div className="chat-message-actions">
              <button>
                <Minus size={17} />
              </button>

              <button
                onClick={() => setActiveConversation(null)}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="chat-message-content">
            <div className="chat-message received">
              Tu peux regarder ça ?
            </div>

            <div className="chat-message sent">
              Oui, je regarde 👍
            </div>

            <div className="chat-message received">
              Merci !
            </div>
          </div>

          <div className="chat-message-input">
            <button>
              <Paperclip size={18} />
            </button>

            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  sendMessage()
                }
              }}
              placeholder="Écrire un message..."
            />

            <button
              className="chat-send-button"
              onClick={sendMessage}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default Chat