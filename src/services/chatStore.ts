export type ChatMessage = {
  id: string
  senderId: string
  recipientId: string
  text: string
  createdAt: number
  read: boolean
}

type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'>
export const CHAT_STORAGE_PREFIX = 'ob-chat-message-v1:'
const EMPTY: readonly ChatMessage[] = []

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ChatMessage>
  return typeof item.id === 'string' && Boolean(item.id) &&
    typeof item.senderId === 'string' && Boolean(item.senderId) &&
    typeof item.recipientId === 'string' && Boolean(item.recipientId) &&
    item.senderId !== item.recipientId && typeof item.text === 'string' && Boolean(item.text.trim()) &&
    typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) && typeof item.read === 'boolean'
}

/** Each message has its own key: separate sends never overwrite a conversation. */
export function createChatStore(getStorage: () => StorageLike) {
  let snapshot: readonly ChatMessage[] = EMPTY
  let initialized = false
  const listeners = new Set<() => void>()

  function readStored() {
    const storage = getStorage()
    const result: ChatMessage[] = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith(CHAT_STORAGE_PREFIX)) continue
      try {
        const item: unknown = JSON.parse(storage.getItem(key) ?? 'null')
        if (isMessage(item) && key === CHAT_STORAGE_PREFIX + item.id) result.push(item)
      } catch { /* Ignore only malformed message entries. */ }
    }
    return result.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  }

  function refresh() {
    try {
      const next = readStored()
      initialized = true
      if (JSON.stringify(next) !== JSON.stringify(snapshot)) {
        snapshot = next
        listeners.forEach(listener => listener())
      }
    } catch { /* Retain the last snapshot if storage becomes unavailable. */ }
  }

  return {
    getSnapshot: () => {
      if (!initialized) {
        try { snapshot = readStored() } catch { snapshot = EMPTY }
        initialized = true
      }
      return snapshot
    },
    getServerSnapshot: () => EMPTY,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    refresh,
    send: (senderId: string, recipientId: string, text: string) => {
      if (!senderId || !recipientId || senderId === recipientId || !text.trim()) return false
      const stored = readStored()
      const message: ChatMessage = {
        id: crypto.randomUUID(), senderId, recipientId, text: text.trim(), read: false,
        createdAt: Math.max(Date.now(), (stored.at(-1)?.createdAt ?? 0) + 1),
      }
      getStorage().setItem(CHAT_STORAGE_PREFIX + message.id, JSON.stringify(message))
      refresh()
      return true
    },
    markRead: (recipientId: string, senderId: string) => {
      try {
        for (const message of readStored()) {
          if (message.recipientId === recipientId && message.senderId === senderId && !message.read) {
            getStorage().setItem(CHAT_STORAGE_PREFIX + message.id, JSON.stringify({ ...message, read: true }))
          }
        }
      } finally { refresh() }
    },
  }
}

export function conversationsForUser(messages: readonly ChatMessage[], userId: string) {
  const conversations: Record<string, ChatMessage[]> = Object.create(null)
  for (const message of messages) {
    if (message.senderId !== userId && message.recipientId !== userId) continue
    const otherId = message.senderId === userId ? message.recipientId : message.senderId
    ;(conversations[otherId] ??= []).push(message)
  }
  return conversations
}

export const chatStore = createChatStore(() => window.localStorage)
