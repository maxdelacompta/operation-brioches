import type { ChatAttachment } from './chatAttachments'
import { containsInappropriateLanguage, shouldBlockChatContent } from './chatModeration'

/** Mise en forme sûre : segments texte + attributs autorisés (jamais du HTML). */
export type ChatTextRun = {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  blue?: boolean
  highlight?: boolean
  /** Couleur du texte en hexadécimal, sans HTML arbitraire. */
  color?: string
  /** Couleur du surlignage en hexadécimal. */
  highlightColor?: string
}

/** Contenus métiers de messagerie, compatibles avec les anciens messages texte. */
export type ChatMeeting = { title: string; startsAt: string; durationMinutes: number; location?: string }
export type ChatPoll = { question: string; options: string[]; votes: Record<string, number> }
export type ChatGif = { id: string; url: string; title: string; pageUrl: string }
export type ChatReply = { messageId: string; author: string; excerpt: string }
export type ChatContent = { meeting?: ChatMeeting; poll?: ChatPoll; gif?: ChatGif; richText?: ChatTextRun[]; replyTo?: ChatReply; mentions?: string[] }

/** Legacy direct messages stay valid; group messages use groupId + readBy. */
export type ChatMessage = {
  id: string
  senderId: string
  recipientId: string
  text: string
  createdAt: number
  read: boolean
  attachments?: ChatAttachment[]
  groupId?: string
  /** Destinataires au moment de l'envoi (ne change pas quand des membres arrivent ou partent). */
  groupRecipientIds?: string[]
  readBy?: string[]
  /** Accusé de réception individuel : le destinataire a accédé au stockage partagé. */
  deliveredAt?: number
  /** Accusés de réception des membres d’un groupe (hors expéditeur). */
  deliveredBy?: string[]
  meeting?: ChatMeeting
  poll?: ChatPoll
  gif?: ChatGif
  richText?: ChatTextRun[]
  replyTo?: ChatReply
  mentions?: string[]
  editedAt?: number
  deletedAt?: number
  /** Événement d'historique, affiché au centre du fil. */
  systemEvent?: 'member-left' | 'member-joined'
}

export type ChatGroup = {
  id: string
  name: string
  memberIds: string[]
  createdBy: string
  createdAt: number
}

type StorageLike = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem'>
export const CHAT_STORAGE_PREFIX = 'ob-chat-message-v1:'
export const CHAT_GROUP_STORAGE_PREFIX = 'ob-chat-group-v1:'
export const CHAT_REPORT_STORAGE_PREFIX = 'ob-chat-report-v1:'
export type ChatReport = { id: string; reporterId: string; messageId: string; reason: string; createdAt: number; status: 'en_attente' }
const EMPTY_MESSAGES: readonly ChatMessage[] = []
const EMPTY_GROUPS: readonly ChatGroup[] = []

function isMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ChatMessage>
  return typeof item.id === 'string' && Boolean(item.id) &&
    typeof item.senderId === 'string' && Boolean(item.senderId) &&
    typeof item.recipientId === 'string' && Boolean(item.recipientId) &&
    item.senderId !== item.recipientId && typeof item.text === 'string' &&
    (Boolean(item.text.trim()) || (Array.isArray(item.attachments) && item.attachments.length > 0)) &&
    (item.attachments === undefined || (Array.isArray(item.attachments) && item.attachments.every(file =>
      file && typeof file.id === 'string' && typeof file.name === 'string' && typeof file.size === 'number' && typeof file.mimeType === 'string'))) &&
    (item.groupId === undefined || (typeof item.groupId === 'string' && item.groupId.length > 0 && item.recipientId === item.groupId)) &&
    (item.groupRecipientIds === undefined || (Array.isArray(item.groupRecipientIds) && item.groupRecipientIds.every(id => typeof id === 'string'))) &&
    (item.readBy === undefined || (Array.isArray(item.readBy) && item.readBy.every(id => typeof id === 'string'))) &&
    (item.deliveredBy === undefined || (Array.isArray(item.deliveredBy) && item.deliveredBy.every(id => typeof id === 'string'))) &&
    (item.deliveredAt === undefined || (typeof item.deliveredAt === 'number' && Number.isFinite(item.deliveredAt))) &&
    (item.meeting === undefined || (typeof item.meeting.title === 'string' && typeof item.meeting.startsAt === 'string' && typeof item.meeting.durationMinutes === 'number')) &&
    (item.poll === undefined || (typeof item.poll.question === 'string' && Array.isArray(item.poll.options) &&
      item.poll.options.length >= 2 && item.poll.options.every(v => typeof v === 'string') &&
      item.poll.votes !== null && typeof item.poll.votes === 'object')) &&
    (item.gif === undefined || (typeof item.gif.id === 'string' && typeof item.gif.url === 'string' && typeof item.gif.pageUrl === 'string')) &&
    (item.mentions === undefined || (Array.isArray(item.mentions) && item.mentions.every(id => typeof id === 'string'))) &&
    (item.editedAt === undefined || (typeof item.editedAt === 'number' && Number.isFinite(item.editedAt))) &&
    (item.deletedAt === undefined || (typeof item.deletedAt === 'number' && Number.isFinite(item.deletedAt))) &&
    (item.replyTo === undefined || (typeof item.replyTo.messageId === 'string' && typeof item.replyTo.author === 'string' && typeof item.replyTo.excerpt === 'string' && item.replyTo.excerpt.length <= 500)) &&
    (item.systemEvent === undefined || ((item.systemEvent === 'member-left' || item.systemEvent === 'member-joined') && Boolean(item.groupId))) &&
    (item.richText === undefined || (Array.isArray(item.richText) && item.richText.length <= 10000 &&
      item.richText.every(run => typeof run.text === 'string' &&
        ['bold', 'italic', 'underline', 'blue', 'highlight'].every(flag =>
          (run as unknown as Record<string, unknown>)[flag] === undefined || typeof (run as unknown as Record<string, unknown>)[flag] === 'boolean') &&
        ['color', 'highlightColor'].every(field => {
          const value = (run as unknown as Record<string, unknown>)[field]
          return value === undefined || (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value))
        })) &&
      item.richText.map(run => run.text).join('') === item.text)) &&
    typeof item.createdAt === 'number' && Number.isFinite(item.createdAt) && typeof item.read === 'boolean'
}

function isGroup(value: unknown): value is ChatGroup {
  if (!value || typeof value !== 'object') return false
  const group = value as Partial<ChatGroup>
  return typeof group.id === 'string' && Boolean(group.id) &&
    typeof group.name === 'string' && Boolean(group.name.trim()) &&
    typeof group.createdBy === 'string' && Boolean(group.createdBy) &&
    typeof group.createdAt === 'number' && Number.isFinite(group.createdAt) &&
    Array.isArray(group.memberIds) && group.memberIds.length >= 1 &&
    group.memberIds.every(id => typeof id === 'string' && Boolean(id)) &&
    new Set(group.memberIds).size === group.memberIds.length &&
    group.memberIds.includes(group.createdBy)
}

/** Local-browser prototype. A shared backend is required for delivery between coworkers' devices. */
export function createChatStore(getStorage: () => StorageLike) {
  let snapshot: readonly ChatMessage[] = EMPTY_MESSAGES
  let groupsSnapshot: readonly ChatGroup[] = EMPTY_GROUPS
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
      } catch { /* Ignore malformed entries. */ }
    }
    return result.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  }

  function readGroups() {
    const storage = getStorage()
    const result: ChatGroup[] = []
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index)
      if (!key?.startsWith(CHAT_GROUP_STORAGE_PREFIX)) continue
      try {
        const item: unknown = JSON.parse(storage.getItem(key) ?? 'null')
        if (isGroup(item) && key === CHAT_GROUP_STORAGE_PREFIX + item.id) result.push(item)
      } catch { /* Ignore malformed entries. */ }
    }
    return result.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
  }

  function initialize() {
    if (initialized) return
    try {
      snapshot = readStored()
      groupsSnapshot = readGroups()
    } catch {
      snapshot = EMPTY_MESSAGES
      groupsSnapshot = EMPTY_GROUPS
    }
    initialized = true
  }

  function refresh() {
    try {
      const next = readStored()
      const nextGroups = readGroups()
      initialized = true
      if (JSON.stringify(next) !== JSON.stringify(snapshot) || JSON.stringify(nextGroups) !== JSON.stringify(groupsSnapshot)) {
        snapshot = next
        groupsSnapshot = nextGroups
        listeners.forEach(listener => listener())
      }
    } catch { /* Retain last snapshots if storage is inaccessible. */ }
  }

  return {
    getSnapshot: () => { initialize(); return snapshot },
    getGroupsSnapshot: () => { initialize(); return groupsSnapshot },
    getServerSnapshot: () => EMPTY_MESSAGES,
    getServerGroupsSnapshot: () => EMPTY_GROUPS,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    refresh,
    send: (senderId: string, recipientId: string, text: string, attachments: ChatAttachment[] = [], content: ChatContent = {}) => {
      if (!senderId || !recipientId || senderId === recipientId || (!text.trim() && !attachments.length)) return false
      if (shouldBlockChatContent(text, content)) return false
      const stored = readStored()
      const message: ChatMessage = {
        id: crypto.randomUUID(), senderId, recipientId, text: text.trim(), read: false,
        createdAt: Math.max(Date.now(), (stored.at(-1)?.createdAt ?? 0) + 1), attachments, ...content,
      }
      getStorage().setItem(CHAT_STORAGE_PREFIX + message.id, JSON.stringify(message))
      refresh()
      return true
    },
    createGroup: (creatorId: string, selectedMemberIds: string[], name: string): ChatGroup | null => {
      const memberIds = [...new Set([creatorId, ...selectedMemberIds])].filter(Boolean)
      if (!creatorId || memberIds.length < 3 || containsInappropriateLanguage(name)) return null
      const group: ChatGroup = {
        id: crypto.randomUUID(), name: name.trim().slice(0, 80) || 'Discussion de groupe',
        memberIds, createdBy: creatorId, createdAt: Date.now(),
      }
      getStorage().setItem(CHAT_GROUP_STORAGE_PREFIX + group.id, JSON.stringify(group))
      refresh()
      return group
    },
    sendGroup: (senderId: string, groupId: string, text: string, attachments: ChatAttachment[] = [], content: ChatContent = {}) => {
      if (!senderId || (!text.trim() && !attachments.length)) return false
      if (shouldBlockChatContent(text, content)) return false
      const group = readGroups().find(item => item.id === groupId && item.memberIds.includes(senderId))
      if (!group) return false
      const stored = readStored()
      const message: ChatMessage = {
        id: crypto.randomUUID(), senderId, recipientId: groupId, groupId,
        text: text.trim(), read: false, readBy: [senderId], groupRecipientIds: group.memberIds.filter(id => id !== senderId),
        createdAt: Math.max(Date.now(), (stored.at(-1)?.createdAt ?? 0) + 1), attachments, ...content,
      }
      getStorage().setItem(CHAT_STORAGE_PREFIX + message.id, JSON.stringify(message))
      refresh()
      return true
    },
    /** Prototype navigateur : seules les modifications de son propre texte sont autorisées. */
    editMessage: (userId: string, messageId: string, nextText: string, nextRichText: ChatTextRun[] = [], mentions: string[] = []) => {
      const item = readStored().find(value => value.id === messageId)
      const text = nextText.trim()
      if (!item || item.senderId !== userId || item.systemEvent || item.deletedAt || item.meeting || item.poll || item.gif || !text || shouldBlockChatContent(text)) return false
      if (item.groupId && !readGroups().some(group => group.id === item.groupId && group.memberIds.includes(userId))) return false
      const validRichText = nextRichText.length && nextRichText.map(run => run.text).join('') === text ? nextRichText : undefined
      const edited = { ...item, text, richText: validRichText, mentions, editedAt: Date.now() }
      getStorage().setItem(CHAT_STORAGE_PREFIX + item.id, JSON.stringify(edited))
      refresh()
      return true
    },
    /** Suppression logique : les copies déjà téléchargées restent hors de contrôle du navigateur. */
    deleteMessage: (userId: string, messageId: string) => {
      const item = readStored().find(value => value.id === messageId)
      if (!item || item.senderId !== userId || item.systemEvent || item.deletedAt) return false
      if (item.groupId && !readGroups().some(group => group.id === item.groupId && group.memberIds.includes(userId))) return false
      const removed: ChatMessage = {
        ...item, text: 'Message supprimé', deletedAt: Date.now(),
        richText: undefined, attachments: [], meeting: undefined, poll: undefined, gif: undefined, mentions: [],
      }
      getStorage().setItem(CHAT_STORAGE_PREFIX + item.id, JSON.stringify(removed))
      refresh()
      return true
    },
    /** Un signalement est sauvegardé localement, pas transmis à une équipe de modération. */
    reportMessage: (reporterId: string, messageId: string, reason: string) => {
      const item = readStored().find(value => value.id === messageId)
      if (!item || item.systemEvent || item.deletedAt || item.senderId === reporterId) return false
      const canView = item.groupId
        ? readGroups().some(group => group.id === item.groupId && group.memberIds.includes(reporterId)) && (!item.groupRecipientIds || item.groupRecipientIds.includes(reporterId))
        : item.recipientId === reporterId
      if (!canView || !reason.trim()) return false
      const storage = getStorage()
      const reports: ChatReport[] = []
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index)
        if (!key?.startsWith(CHAT_REPORT_STORAGE_PREFIX)) continue
        try {
          const parsed = JSON.parse(storage.getItem(key) ?? 'null') as ChatReport
          if (parsed && typeof parsed.reporterId === 'string' && typeof parsed.messageId === 'string') reports.push(parsed)
        } catch { /* rapport illisible */ }
      }
      if (reports.some(report => report.reporterId === reporterId && report.messageId === messageId)) return false
      const report: ChatReport = { id: crypto.randomUUID(), reporterId, messageId, reason: reason.trim().slice(0, 180), createdAt: Date.now(), status: 'en_attente' }
      storage.setItem(CHAT_REPORT_STORAGE_PREFIX + report.id, JSON.stringify(report))
      return true
    },
    getReportsForUser: (userId: string) => {
      const storage = getStorage()
      const reports: ChatReport[] = []
      for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index)
        if (!key?.startsWith(CHAT_REPORT_STORAGE_PREFIX)) continue
        try {
          const parsed = JSON.parse(storage.getItem(key) ?? 'null') as ChatReport
          if (parsed?.reporterId === userId && typeof parsed.messageId === 'string') reports.push(parsed)
        } catch { /* ignore */ }
      }
      return reports
    },
    votePoll: (userId: string, messageId: string, optionIndex: number) => {
      const item = readStored().find(msg => msg.id === messageId)
      if (!userId || !item?.poll || optionIndex < 0 || optionIndex >= item.poll.options.length || !Number.isInteger(optionIndex)) return false
      const authorized = item.groupId
        ? readGroups().some(group => group.id === item.groupId && group.memberIds.includes(userId))
        : item.senderId === userId || item.recipientId === userId
      if (!authorized) return false
      const poll = { ...item.poll, votes: { ...item.poll.votes, [userId]: optionIndex } }
      getStorage().setItem(CHAT_STORAGE_PREFIX + item.id, JSON.stringify({ ...item, poll }))
      refresh()
      return true
    },
    /** Marque « reçu » uniquement quand le compte destinataire charge les données.
     *  Ne suppose jamais qu'un autre appareil a reçu un message : nécessite un backend commun. */
    markDelivered: (userId: string) => {
      if (!userId) return
      let hasChanged = false
      const groupsById = new Map(readGroups().map(group => [group.id, group]))
      for (const message of readStored()) {
        if (message.senderId === userId) continue
        if (message.groupId) {
          const group = groupsById.get(message.groupId)
          if (!group?.memberIds.includes(userId)) continue
          if (message.groupRecipientIds && !message.groupRecipientIds.includes(userId)) continue
          if ((message.deliveredBy ?? []).includes(userId)) continue
          const deliveredBy = [...new Set([...(message.deliveredBy ?? []), userId])]
          getStorage().setItem(CHAT_STORAGE_PREFIX + message.id, JSON.stringify({ ...message, deliveredBy }))
          hasChanged = true
        } else if (message.recipientId === userId && message.deliveredAt === undefined) {
          getStorage().setItem(CHAT_STORAGE_PREFIX + message.id, JSON.stringify({ ...message, deliveredAt: Date.now() }))
          hasChanged = true
        }
      }
      if (hasChanged) refresh()
    },
    markRead: (recipientId: string, senderId: string) => {
      try {
        for (const message of readStored()) {
          if (!message.groupId && message.recipientId === recipientId && message.senderId === senderId && !message.read) {
            getStorage().setItem(CHAT_STORAGE_PREFIX + message.id, JSON.stringify({ ...message, read: true, deliveredAt: message.deliveredAt ?? Date.now() }))
          }
        }
      } finally { refresh() }
    },
    addMembersToGroup: (requesterId: string, groupId: string, memberIdsToAdd: string[], memberNames: Record<string, string> = {}) => {
      const group = readGroups().find(item => item.id === groupId && item.memberIds.includes(requesterId))
      if (!group) return false
      const additions = [...new Set(memberIdsToAdd.filter(Boolean))].filter(id => !group.memberIds.includes(id))
      if (!additions.length) return false
      const storage = getStorage()
      const key = CHAT_GROUP_STORAGE_PREFIX + group.id
      const backup = storage.getItem(key)
      const stored = readStored()
      const createdKeys: string[] = []
      const patchedLegacy: { key: string; value: string | null }[] = []
      try {
        // Fixer les destinataires des messages antérieurs avant d'ajouter quelqu'un.
        for (const message of stored) {
          if (message.groupId !== group.id || message.systemEvent || message.groupRecipientIds) continue
          const messageKey = CHAT_STORAGE_PREFIX + message.id
          patchedLegacy.push({ key: messageKey, value: storage.getItem(messageKey) })
          storage.setItem(messageKey, JSON.stringify({
            ...message,
            groupRecipientIds: group.memberIds.filter(id => id !== message.senderId),
          }))
        }
        let lastTime = stored.at(-1)?.createdAt ?? 0
        for (const memberId of additions) {
          const displayName = (memberNames[memberId] ?? 'Un membre').trim().slice(0, 120) || 'Un membre'
          const event: ChatMessage = {
            id: crypto.randomUUID(), senderId: requesterId, recipientId: group.id, groupId: group.id,
            text: `${displayName} a rejoint la conversation.`,
            systemEvent: 'member-joined', read: false,
            createdAt: lastTime = Math.max(Date.now(), lastTime + 1),
          }
          const eventKey = CHAT_STORAGE_PREFIX + event.id
          storage.setItem(eventKey, JSON.stringify(event))
          createdKeys.push(eventKey)
        }
        storage.setItem(key, JSON.stringify({ ...group, memberIds: [...group.memberIds, ...additions] }))
      } catch (error) {
        for (const eventKey of createdKeys) storage.removeItem(eventKey)
        for (const previous of patchedLegacy) {
          if (previous.value === null) storage.removeItem(previous.key)
          else storage.setItem(previous.key, previous.value)
        }
        if (backup !== null) storage.setItem(key, backup)
        throw error
      }
      refresh()
      return true
    },
    leaveGroup: (userId: string, groupId: string, name: string) => {
      const group = readGroups().find(item => item.id === groupId && item.memberIds.includes(userId))
      if (!group) return false
      const memberIds = group.memberIds.filter(id => id !== userId)
      const storage = getStorage()
      const key = CHAT_GROUP_STORAGE_PREFIX + group.id
      const priorGroup = storage.getItem(key)
      const stored = readStored()
      // On conserve l'historique même si le groupe n'a plus qu'un membre.
      if (memberIds.length) {
        const event: ChatMessage = {
          id: crypto.randomUUID(), senderId: userId, recipientId: group.id, groupId: group.id,
          text: `${name.trim().slice(0, 120) || 'Un membre'} a quitté la conversation.`,
          systemEvent: 'member-left', read: false, readBy: [userId],
          createdAt: Math.max(Date.now(), (stored.at(-1)?.createdAt ?? 0) + 1),
        }
        const eventKey = CHAT_STORAGE_PREFIX + event.id
        storage.setItem(eventKey, JSON.stringify(event))
        try {
          storage.setItem(key, JSON.stringify({ ...group, memberIds, createdBy: memberIds.includes(group.createdBy) ? group.createdBy : memberIds[0] }))
        } catch (error) {
          // Éviter un événement « a quitté » si la sortie n'a pas été enregistrée.
          storage.removeItem(eventKey)
          if (priorGroup !== null) storage.setItem(key, priorGroup)
          throw error
        }
      } else storage.removeItem(key)
      refresh()
      return true
    },
    markGroupRead: (userId: string, groupId: string) => {
      try {
        if (!readGroups().some(group => group.id === groupId && group.memberIds.includes(userId))) return
        for (const message of readStored()) {
          if (message.groupId === groupId && !message.systemEvent && message.senderId !== userId && (!message.groupRecipientIds || message.groupRecipientIds.includes(userId)) && !(message.readBy ?? []).includes(userId)) {
            getStorage().setItem(CHAT_STORAGE_PREFIX + message.id, JSON.stringify({ ...message, readBy: [...new Set([...(message.readBy ?? []), userId])], deliveredBy: [...new Set([...(message.deliveredBy ?? []), userId])] }))
          }
        }
      } finally { refresh() }
    },
  }
}

/** Statut affiché uniquement sur les messages envoyés : une coche, deux grises, deux bleues. */
export type MessageReceiptStatus = 'sent' | 'delivered' | 'read'

export function getMessageReceiptStatus(message: ChatMessage, group?: ChatGroup | null): MessageReceiptStatus {
  if (!message.groupId) {
    if (message.read) return 'read'
    return message.deliveredAt !== undefined ? 'delivered' : 'sent'
  }
  if (!group || group.id !== message.groupId) return 'sent'
  const recipients = message.groupRecipientIds ?? group.memberIds.filter(id => id !== message.senderId)
  if (!recipients.length) return 'sent'
  if (recipients.every(id => (message.readBy ?? []).includes(id))) return 'read'
  if (recipients.every(id => (message.deliveredBy ?? []).includes(id) || (message.readBy ?? []).includes(id))) return 'delivered'
  return 'sent'
}

export function conversationsForUser(messages: readonly ChatMessage[], userId: string) {
  const conversations: Record<string, ChatMessage[]> = Object.create(null)
  for (const message of messages) {
    if (message.groupId || (message.senderId !== userId && message.recipientId !== userId)) continue
    const otherId = message.senderId === userId ? message.recipientId : message.senderId
    ;(conversations[otherId] ??= []).push(message)
  }
  return conversations
}

export function unreadGroupMessages(messages: readonly ChatMessage[], groups: readonly ChatGroup[], userId: string): number {
  const groupIds = new Set(groups.filter(group => group.memberIds.includes(userId)).map(group => group.id))
  return messages.filter(message => message.groupId && !message.systemEvent && groupIds.has(message.groupId) && message.senderId !== userId && (!message.groupRecipientIds || message.groupRecipientIds.includes(userId)) && !(message.readBy ?? []).includes(userId)).length
}

export const chatStore = createChatStore(() => window.localStorage)
