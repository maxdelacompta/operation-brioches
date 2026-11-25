import { chatStore, conversationsForUser, unreadGroupMessages, getMessageReceiptStatus, CHAT_STORAGE_PREFIX, CHAT_GROUP_STORAGE_PREFIX, type ChatContent, type ChatMessage, type ChatGif, type ChatTextRun, type ChatReply } from '../services/chatStore'
import { attachmentInfo, downloadChatFile, formatChatFileSize, MAX_CHAT_FILES, removeChatFiles, saveChatFiles, validateChatFiles } from '../services/chatAttachments'
import {
  useEffect,
  useMemo,
  useSyncExternalStore,
  useState,
  useRef,
  type ChangeEvent,
} from 'react'

import {
  MessageCircle,
  UsersRound,
  Paperclip,
  FileDown,
  FileText,
  Plus,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Search,
  Send,
  Check,
  CheckCheck,
  CalendarDays,
  BarChart3,
  Smile,
  Image as ImageIcon,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Palette,
  X,
  Pin,
  Info,
  UserPlus,
  Minus,
  Pencil,
  Trash2,
  Flag,
  BellOff,
  Bell,
  AtSign,
} from 'lucide-react'

import { Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { CHAT_GROUP_NAME_ERROR, CHAT_MODERATION_ERROR, containsInappropriateLanguage, shouldBlockChatContent } from '../services/chatModeration'
import ChatRichText from './ChatRichText'
import ChatRichEditor, { type ChatRichEditorHandle, type ChatFormatCommand, type ChatColorKind } from './ChatRichEditor'

import {
  ROLE_LABELS,
  useUsers,
} from '../contexts/UsersContext'

import './Chat.css'

/* =========================================================
   TYPES
   ========================================================= */

type ToolPanel = 'none' | 'meeting' | 'poll' | 'emoji' | 'gif'
const CHAT_SWATCHES: { label: string; hex: string }[] = [
  { label: 'Noir', hex: '#111827' }, { label: 'Gris', hex: '#64748B' }, { label: 'Blanc', hex: '#FFFFFF' },
  { label: 'Bleu nuit', hex: '#1C3550' }, { label: 'Bleu', hex: '#2563EB' }, { label: 'Cyan', hex: '#06B6D4' },
  { label: 'Vert', hex: '#16A34A' }, { label: 'Vert foncé', hex: '#166534' }, { label: 'Turquoise', hex: '#0D9488' },
  { label: 'Jaune', hex: '#FACC15' }, { label: 'Orange', hex: '#F97316' }, { label: 'Rouge', hex: '#DC2626' },
  { label: 'Rose', hex: '#EC4899' }, { label: 'Violet', hex: '#7C3AED' }, { label: 'Marron', hex: '#92400E' },
  { label: 'Crème', hex: '#FFF1C2' }, { label: 'Jaune pâle', hex: '#FEF08A' }, { label: 'Vert pâle', hex: '#BBF7D0' },
  { label: 'Bleu pâle', hex: '#BFDBFE' }, { label: 'Rose pâle', hex: '#FBCFE8' },
]
const QUICK_EMOJIS = ['😀', '😄', '😂', '😊', '👍', '👏', '❤️', '🎉', '🍞', '✅', '🙏', '😮', '📅', '🎈', '💡', '🚀']
const GIPHY_KEY = (import.meta.env.VITE_GIPHY_API_KEY as string | undefined) ?? ''

function parseGiphyLink(raw: string): ChatGif | null {
  try {
    const url = new URL(raw.trim())
    if (url.protocol !== 'https:') return null
    let id = ''
    if (url.hostname === 'giphy.com' || url.hostname === 'www.giphy.com') {
      if (!url.pathname.startsWith('/gifs/')) return null
      id = url.pathname.split('/').filter(Boolean).at(-1)?.split('-').at(-1) ?? ''
    } else if (/^(?:media[0-9]*|i)\.giphy\.com$/.test(url.hostname)) {
      const parts = url.pathname.split('/').filter(Boolean)
      const mediaIndex = parts.indexOf('media')
      id = mediaIndex >= 0 ? (parts[mediaIndex + 1] ?? '') : (parts[0] ?? '')
    } else return null
    if (!/^[a-zA-Z0-9]{5,45}$/.test(id)) return null
    return { id, url: `https://media.giphy.com/media/${id}/giphy.gif`, title: 'GIF GIPHY', pageUrl: `https://giphy.com/gifs/${id}` }
  } catch { return null }
}

function downloadMeetingIcs(item: ChatMessage) {
  if (!item.meeting) return
  const start = new Date(item.meeting.startsAt)
  if (!Number.isFinite(start.getTime())) return
  const end = new Date(start.getTime() + item.meeting.durationMinutes * 60000)
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const clean = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
  const body = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Operation Brioche//Chat//FR', 'BEGIN:VEVENT',
    `UID:${item.id}@operation-brioche`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${clean(item.meeting.title)}`,
    ...(item.meeting.location ? [`LOCATION:${clean(item.meeting.location)}`] : []),
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n')
  const blob = new Blob([body], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'reunion-operation-brioche.ics'
  document.body.appendChild(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}


function messageMenuPreview(item: ChatMessage): string {
  if (item.poll) return `Sondage : ${item.poll.question}`
  if (item.meeting) return `Réunion : ${item.meeting.title}`
  if (item.gif) return item.gif.pageUrl || item.gif.url
  if (item.text?.trim()) return item.text.trim()
  if (item.attachments?.length) return `Pièce(s) jointe(s) : ${item.attachments.map(file => file.name).join(', ')}`
  return 'Message'
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

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null)
  const [composeMode, setComposeMode] = useState<'direct' | 'group'>('direct')
  const [groupName, setGroupName] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [isComposing, setIsComposing] = useState(false)
  const [recipientId, setRecipientId] = useState<string | null>(null)
  const [recipientDropdownOpen, setRecipientDropdownOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [richRuns, setRichRuns] = useState<ChatTextRun[]>([])
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [sending, setSending] = useState(false)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const groupCreationInProgress = useRef(false)
  const editorRef = useRef<ChatRichEditorHandle>(null)
  const [plusOpen, setPlusOpen] = useState(false)
  const [activeTool, setActiveTool] = useState<ToolPanel>('none')
  const [colorPalette, setColorPalette] = useState<ChatColorKind | null>(null)
  const [customColor, setCustomColor] = useState('#2563EB')
  const [meetingTitle, setMeetingTitle] = useState('')
  const [meetingStart, setMeetingStart] = useState('')
  const [meetingMinutes, setMeetingMinutes] = useState('30')
  const [meetingLocation, setMeetingLocation] = useState('')
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [gifQuery, setGifQuery] = useState('')
  const [gifLink, setGifLink] = useState('')
  const [gifResults, setGifResults] = useState<ChatGif[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const [gifError, setGifError] = useState('')

  const storedMessages = useSyncExternalStore(chatStore.subscribe, chatStore.getSnapshot, chatStore.getServerSnapshot)
  const storedGroups = useSyncExternalStore(chatStore.subscribe, chatStore.getGroupsSnapshot, chatStore.getServerGroupsSnapshot)
  const myGroups = useMemo(() => storedGroups.filter(group => group.memberIds.includes(currentUserId)), [storedGroups, currentUserId])
  const messages = useMemo(() => conversationsForUser(storedMessages, currentUserId), [storedMessages, currentUserId])
  const [chatError, setChatError] = useState('')
  const [menuReadingId, setMenuReadingId] = useState<string | null>(null)
  const [messageMenuId, setMessageMenuId] = useState<string | null>(null)
  const [pinnedMessageIds, setPinnedMessageIds] = useState<string[]>([])
  const [showGroupMembers, setShowGroupMembers] = useState(false)
  const [showAddMembers, setShowAddMembers] = useState(false)
  const [membersToAdd, setMembersToAdd] = useState<string[]>([])
  const [replyTarget, setReplyTarget] = useState<ChatReply | null>(null)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('Propos insultants ou offensants')
  const [reportedIds, setReportedIds] = useState<string[]>([])
  const [showMessageSearch, setShowMessageSearch] = useState(false)
  const [messageSearch, setMessageSearch] = useState('')
  const [showMuteOptions, setShowMuteOptions] = useState(false)
  const [muteSettings, setMuteSettings] = useState<Record<string, number>>({})
  const [forwardingMessageId, setForwardingMessageId] = useState<string | null>(null)
  const [forwardRecipient, setForwardRecipient] = useState('')

  const [messageMenuPosition, setMessageMenuPosition] = useState({ left: 0, top: 0 })
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const synchronize = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(CHAT_STORAGE_PREFIX) || event.key.startsWith(CHAT_GROUP_STORAGE_PREFIX)) chatStore.refresh()
    }
    window.addEventListener('storage', synchronize)
    chatStore.refresh()
    return () => window.removeEventListener('storage', synchronize)
  }, [])

  // Accusé de réception : le compte a réellement accès aux données de ce navigateur.
  // La synchronisation entre appareils distincts sera assurée par le futur serveur.
  useEffect(() => {
    if (!currentUserId) return
    try { chatStore.markDelivered(currentUserId) }
    catch { setChatError('Impossible d’enregistrer les accusés de réception dans ce navigateur.') }
  }, [currentUserId, storedMessages])

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

  // Mark group messages read only while the window is open and visible.
  useEffect(() => {
    if (!isOpen || !activeGroupId || !myGroups.some(group => group.id === activeGroupId)) return
    const markRead = () => {
      if (document.visibilityState !== 'visible') return
      try { chatStore.markGroupRead(currentUserId, activeGroupId) }
      catch { setChatError('Impossible d’enregistrer la lecture du groupe dans ce navigateur.') }
    }
    markRead()
    document.addEventListener('visibilitychange', markRead)
    return () => document.removeEventListener('visibilitychange', markRead)
  }, [isOpen, activeGroupId, currentUserId, storedMessages, myGroups])


  useEffect(() => {
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (menuRef.current && target && !menuRef.current.contains(target) && !(target instanceof Element && target.closest('.chat-message'))) setMessageMenuId(null)
    }
    document.addEventListener('mousedown', handlePointer)
    return () => document.removeEventListener('mousedown', handlePointer)
  }, [])

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

  const activeGroup = myGroups.find(group => group.id === activeGroupId) ?? null
  const activeMessages = activeGroup
    ? storedMessages.filter(item => item.groupId === activeGroup.id)
    : activeConversation ? messages[activeConversation.id] ?? [] : []
  const activeGroupMembers = activeGroup
    ? users.filter(user => activeGroup.memberIds.includes(user.id))
    : []
  const availableMembersToInvite = activeGroup
    ? chatUsers.filter(user => !activeGroup.memberIds.includes(user.id))
    : []
  const muteKey = `ob-chat-mutes-v1:${currentUserId}`
  const activeChannelKey = activeGroup ? `group:${activeGroup.id}` : activeConversation ? `direct:${activeConversation.id}` : ''
  const mutedUntil = activeChannelKey ? muteSettings[activeChannelKey] ?? 0 : 0
  const isMuted = mutedUntil === -1 || mutedUntil > Date.now()
  const filterText = messageSearch.trim().toLocaleLowerCase('fr')
  const visibleMessages = filterText
    ? activeMessages.filter(item => item.text.toLocaleLowerCase('fr').includes(filterText) ||
        item.attachments?.some(file => file.name.toLocaleLowerCase('fr').includes(filterText)) ||
        item.meeting?.title.toLocaleLowerCase('fr').includes(filterText) ||
        item.poll?.question.toLocaleLowerCase('fr').includes(filterText))
    : activeMessages
  const mentionMatch = activeGroup && !editingMessageId ? /(?:^|\s)@([\p{L}\p{N}._-]*)$/u.exec(message) : null
  const mentionCandidates = mentionMatch && activeGroup
    ? activeGroupMembers.filter(user => user.id !== currentUserId &&
        user.name.toLocaleLowerCase('fr').split(/\s+/).some(part => part.startsWith(mentionMatch[1].toLocaleLowerCase('fr')))).slice(0, 7)
    : []
  const groupMentionCount = (groupId: string) => storedMessages.filter(item =>
    item.groupId === groupId && !item.systemEvent && !item.deletedAt &&
    item.senderId !== currentUserId && (item.mentions ?? []).includes(currentUserId) &&
    !(item.readBy ?? []).includes(currentUserId)).length

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(muteKey) || '{}') as Record<string, number>
      setMuteSettings(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {})
      setReportedIds(chatStore.getReportsForUser(currentUserId).map(report => report.messageId))
    } catch { setMuteSettings({}); setReportedIds([]) }
  }, [currentUserId, muteKey])

  function updateMute(until: number) {
    if (!activeChannelKey) return
    const next = { ...muteSettings, [activeChannelKey]: until }
    try { window.localStorage.setItem(muteKey, JSON.stringify(next)); setMuteSettings(next); setShowMuteOptions(false) }
    catch { setChatError('Impossible de sauvegarder la mise en sourdine sur ce navigateur.') }
  }

  function detectMentions(text: string, groupId: string): string[] {
    const group = storedGroups.find(item => item.id === groupId)
    if (!group) return []
    const normalized = text.toLocaleLowerCase('fr')
    return group.memberIds.filter(id => id !== currentUserId).filter(id => {
      const name = users.find(user => user.id === id)?.name
      return name ? normalized.includes(`@${name.toLocaleLowerCase('fr')}`) : false
    })
  }

  const pinStorageKey = useMemo(() => {
    if (activeGroup) return `ob-chat-pins:${currentUserId}:group:${activeGroup.id}`
    if (activeConversation) return `ob-chat-pins:${currentUserId}:direct:${activeConversation.id}`
    return ''
  }, [activeConversation, activeGroup, currentUserId])

  useEffect(() => {
    if (!pinStorageKey) { setPinnedMessageIds([]); return }
    try {
      const raw = window.localStorage.getItem(pinStorageKey)
      const parsed = raw ? JSON.parse(raw) : []
      setPinnedMessageIds(Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [])
    } catch {
      setPinnedMessageIds([])
    }
  }, [pinStorageKey])

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
    ].text || `📎 ${conversationMessages[conversationMessages.length - 1].attachments?.length ?? 0} pièce(s) jointe(s)`
  }

  /* =======================================================
     MESSAGES NON LUS
     ======================================================= */

  const totalUnread = useMemo(() => {
    const directUnread = chatUsers.reduce((total, user) => {
      const conversationMessages =
        messages[user.id] ?? []

      const mute = muteSettings[`direct:${user.id}`] ?? 0
      const unread = (mute === -1 || mute > Date.now()) ? 0 : conversationMessages.filter(
        (item) => item.senderId !== currentUserId && !item.read,
      ).length

      return total + unread
    }, 0)
    const eligibleGroups = myGroups.filter(group => {
      const mute = muteSettings[`group:${group.id}`] ?? 0
      return mute !== -1 && mute <= Date.now()
    })
    return directUnread + unreadGroupMessages(storedMessages, eligibleGroups, currentUserId)
  }, [
    chatUsers,
    messages,
    storedMessages,
    myGroups,
    currentUserId,
    muteSettings,
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

  const filteredGroups = useMemo(() => {
    if (isComposing) return []
    const query = search.trim().toLocaleLowerCase('fr')
    const filtered = myGroups.filter(group => {
      const names = group.memberIds.map(id => users.find(user => user.id === id)?.name ?? '').join(' ')
      return `${group.name} ${names}`.toLocaleLowerCase('fr').includes(query)
    })
    return filtered.sort((a, b) => {
      const recent = (id: string) => storedMessages.filter(msg => msg.groupId === id).at(-1)?.createdAt ?? 0
      return recent(b.id) - recent(a.id) || b.createdAt - a.createdAt
    })
  }, [isComposing, search, myGroups, storedMessages, users])

  function groupUnreadCount(groupId: string) {
    return storedMessages.filter(item => item.groupId === groupId && !item.systemEvent && item.senderId !== currentUserId && (!item.groupRecipientIds || item.groupRecipientIds.includes(currentUserId)) && !(item.readBy ?? []).includes(currentUserId)).length
  }

  function getGroupLastMessage(groupId: string) {
    const last = storedMessages.filter(item => item.groupId === groupId).at(-1)
    if (!last) return 'Groupe créé · Aucun message'
    if (last.systemEvent) return last.text
    const author = users.find(user => user.id === last.senderId)?.name ?? 'Utilisateur'
    return `${author} : ${last.text || `📎 ${last.attachments?.length ?? 0} pièce(s) jointe(s)`}`
  }

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
    setShowGroupMembers(false)
    setShowAddMembers(false)
    setMembersToAdd([])
    setActiveGroupId(null)
    setMenuReadingId(null)
    setActiveConversationId(userId)
    setIsComposing(false)
    setRecipientId(null)
    setRecipientDropdownOpen(false)
    setSearch('')
    setMessage(''); setRichRuns([])
    setReplyTarget(null)
    setMessageMenuId(null)
    setShowMessageSearch(false); setMessageSearch('')
    setShowMuteOptions(false)
    setEditingMessageId(null); setForwardingMessageId(null); setReportingMessageId(null)
    setPendingFiles([])

    setChatError('')
    setPlusOpen(false); setActiveTool('none')
  }

  function openGroup(groupId: string) {
    setShowGroupMembers(false)
    setShowAddMembers(false)
    setMembersToAdd([])
    if (!myGroups.some(group => group.id === groupId)) return
    setActiveGroupId(groupId)
    setMenuReadingId(null)
    setActiveConversationId(null)
    setIsComposing(false)
    setRecipientId(null)
    setSearch('')
    setMessage(''); setRichRuns([])
    setReplyTarget(null)
    setMessageMenuId(null)
    setShowMessageSearch(false); setMessageSearch('')
    setShowMuteOptions(false)
    setEditingMessageId(null); setForwardingMessageId(null); setReportingMessageId(null)
    setPendingFiles([])
    setChatError('')
    setPlusOpen(false); setActiveTool('none')
  }

  /* =======================================================
     FERMER LES DISCUSSIONS
     ======================================================= */

  function closeChat() {
    setShowGroupMembers(false)
    setShowAddMembers(false)
    setMembersToAdd([])
    setActiveConversationId(null)
    setActiveGroupId(null)
    setIsComposing(false)
    setRecipientId(null)
    setRecipientDropdownOpen(false)
    setSearch('')
    setMessage(''); setRichRuns([])
    setReplyTarget(null)
    setMessageMenuId(null)
    setShowMessageSearch(false); setMessageSearch('')
    setShowMuteOptions(false)
    setEditingMessageId(null); setForwardingMessageId(null); setReportingMessageId(null)
    setPendingFiles([])
    setPlusOpen(false); setActiveTool('none')
    onClose()
  }

  /* =======================================================
     FERMER UNE CONVERSATION
     ======================================================= */

  function closeConversation() {
    setMenuReadingId(null)
    setMessageMenuId(null)
    setShowGroupMembers(false)
    setShowAddMembers(false)
    setMembersToAdd([])
    setActiveConversationId(null)
    setActiveGroupId(null)
    setMessage(''); setRichRuns([])
    setReplyTarget(null)
    setPendingFiles([])
  }

  /* =======================================================
     ENVOYER UN MESSAGE LOCAL
     ======================================================= */

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    const next = [...pendingFiles, ...selected]
    const error = validateChatFiles(next)
    if (error) { setChatError(error); return }
    setPendingFiles(next)
    setChatError('')
  }

  /** Le stockage retire les espaces aux extrémités ; aligner les segments riches
   *  pour ne jamais invalider un message à la relecture. */
  function trimmedRichText(text: string): ChatTextRun[] {
    const joined = richRuns.map(run => run.text).join('')
    if (!text || joined.trim() !== text) return []
    const start = joined.length - joined.trimStart().length
    const end = start + text.length
    const result: ChatTextRun[] = []
    let offset = 0
    for (const run of richRuns) {
      const a = Math.max(0, start - offset)
      const b = Math.min(run.text.length, end - offset)
      if (a < b) result.push({ ...run, text: run.text.slice(a, b) })
      offset += run.text.length
    }
    return result
  }

  async function sendTo(recipient: string, toGroup = false, structured?: { text: string; content: ChatContent }) {
    const text = structured?.text ?? message.trim()
    if (sending || (!text && !pendingFiles.length)) return false
    if (shouldBlockChatContent(text, structured?.content)) {
      setChatError(CHAT_MODERATION_ERROR)
      return false
    }
    const files = structured ? [] : [...pendingFiles]
    const attachmentItems = files.map(file => ({ meta: attachmentInfo(file), file }))
    setSending(true)
    try {
      await saveChatFiles(attachmentItems)
      const content: ChatContent = { ...(structured?.content ?? { richText: trimmedRichText(text) }), ...(replyTarget ? { replyTo: replyTarget } : {}) }
      const sent = toGroup
        ? chatStore.sendGroup(currentUserId, recipient, text, attachmentItems.map(item => item.meta), content)
        : chatStore.send(currentUserId, recipient, text, attachmentItems.map(item => item.meta), content)
      if (!sent) {
        await removeChatFiles(attachmentItems.map(item => item.meta.id))
        return false
      }
      if (!structured) { setMessage(''); setRichRuns([]); setPendingFiles([]) }
      setReplyTarget(null)
      setChatError('')
      return true
    } catch {
      try { await removeChatFiles(attachmentItems.map(item => item.meta.id)) } catch { /* conserve l’erreur originale */ }
      setChatError('Envoi impossible : vérifie l’espace disponible dans le navigateur. Ton message et les pièces jointes sont conservés.')
      return false
    } finally {
      setSending(false)
    }
  }

  async function sendMessage() {
    if (activeGroup) await sendTo(activeGroup.id, true)
    else if (activeConversation) await sendTo(activeConversation.id)
  }

  async function sendNewMessage() {
    if (!recipientId || !chatUsers.some(user => user.id === recipientId)) return
    const recipient = recipientId
    if (!(await sendTo(recipient))) return
    setSearch('')
    setIsComposing(false)
    setActiveConversationId(recipient)
    setRecipientId(null)
    setRecipientDropdownOpen(false)
  }

  async function createNewGroup() {
    const members = groupMemberIds.filter(id => chatUsers.some(user => user.id === id))
    if (sending || groupCreationInProgress.current || members.length < 2) return
    if (containsInappropriateLanguage(groupName)) { setChatError(CHAT_GROUP_NAME_ERROR); return }
    if (shouldBlockChatContent(message.trim())) { setChatError(CHAT_MODERATION_ERROR); return }
    groupCreationInProgress.current = true
    try {
      const group = chatStore.createGroup(currentUserId, members, groupName.trim() ||
        `Groupe · ${members.map(id => users.find(user => user.id === id)?.name ?? 'Membre').join(', ')}`)
      if (!group) { setChatError('Sélectionne au moins deux autres personnes.'); return }
      const hasFirstMessage = Boolean(message.trim() || pendingFiles.length)
      const sent = hasFirstMessage ? await sendTo(group.id, true) : true
      setIsComposing(false)
      setActiveConversationId(null)
      setActiveGroupId(group.id)
      setRecipientId(null)
      setRecipientDropdownOpen(false)
      setGroupMemberIds([])
      setGroupName('')
      setSearch('')
      if (sent) setChatError('')
    } catch { setChatError('Impossible de créer ce groupe dans le navigateur.') }
    finally { groupCreationInProgress.current = false }
  }

  /** Un sondage ou une invitation est un message structuré, non un faux document. */
  async function sendStructured(text: string, content: ChatContent) {
    if (sending || !text.trim()) return
    if (shouldBlockChatContent(text, content)) { setChatError(CHAT_MODERATION_ERROR); return }
    if (isComposing && composeMode === 'group' && containsInappropriateLanguage(groupName)) {
      setChatError(CHAT_GROUP_NAME_ERROR)
      return
    }
    if (isComposing && composeMode === 'group') {
      const memberIds = groupMemberIds.filter(id => chatUsers.some(user => user.id === id))
      if (memberIds.length < 2 || groupCreationInProgress.current) { setChatError('Choisis au moins deux collègues pour le groupe.'); return }
      groupCreationInProgress.current = true
      try {
        const group = chatStore.createGroup(currentUserId, memberIds, groupName.trim() || 'Discussion de groupe')
        if (!group || !(await sendTo(group.id, true, { text, content }))) return
        setActiveGroupId(group.id); setActiveConversationId(null); setIsComposing(false)
        setGroupMemberIds([]); setGroupName(''); setMessage(''); setRichRuns([]); setPendingFiles([])
      } finally { groupCreationInProgress.current = false }
    } else {
      const dest = activeGroup?.id ?? activeConversation?.id ?? (isComposing ? recipientId : null)
      if (!dest) { setChatError('Choisis un destinataire avant de créer cet élément.'); return }
      if (!(await sendTo(dest, Boolean(activeGroup), { text, content }))) return
      if (isComposing) { setActiveConversationId(dest); setActiveGroupId(null); setIsComposing(false); setRecipientId(null) }
    }
    if (content.poll) { setPollQuestion(''); setPollOptions(['', '']) }
    if (content.meeting) { setMeetingTitle(''); setMeetingStart(''); setMeetingLocation('') }
    if (content.gif) { setGifLink(''); setGifQuery(''); setGifResults([]) }
    setActiveTool('none'); setPlusOpen(false); setChatError('')
  }

  function insertFormatting(command: ChatFormatCommand) {
    editorRef.current?.format(command)
  }


  function persistPinned(next: string[]) {
    setPinnedMessageIds(next)
    if (!pinStorageKey) return
    try { window.localStorage.setItem(pinStorageKey, JSON.stringify(next)) }
    catch { setChatError('Impossible de conserver les messages épinglés dans ce navigateur.') }
  }

  function togglePinnedMessage(messageId: string) {
    const next = pinnedMessageIds.includes(messageId)
      ? pinnedMessageIds.filter(id => id !== messageId)
      : [...pinnedMessageIds, messageId]
    persistPinned(next)
    setMessageMenuId(null)
  }

  function focusComposer() {
    window.setTimeout(() => editorRef.current?.focus(), 0)
  }

  function openMessageMenu(itemId: string, bubble: HTMLDivElement) {
    setMenuReadingId(null)
    if (messageMenuId === itemId) { setMessageMenuId(null); setMenuReadingId(null); return }
    const rect = bubble.getBoundingClientRect()
    const chatRect = bubble.closest('.chat-message-window')?.getBoundingClientRect()
    const leftLimit = (chatRect?.left ?? 0) + 8
    const rightLimit = (chatRect?.right ?? window.innerWidth) - 198
    const left = Math.max(leftLimit, Math.min(rect.left - 198, rightLimit))
    const topLimit = (chatRect?.top ?? 0) + 55
    const bottomLimit = (chatRect?.bottom ?? window.innerHeight) - 228
    const top = Math.max(topLimit, Math.min(rect.top, bottomLimit))
    setMessageMenuPosition({ left, top })
    setMessageMenuId(itemId)
  }

  function replyToMessage(item: ChatMessage) {
    setReplyTarget({ messageId: item.id, author: users.find(user => user.id === item.senderId)?.name ?? 'Utilisateur', excerpt: messageMenuPreview(item).slice(0, 160) })
    setMessageMenuId(null)
    focusComposer()
  }

  function replyPrivately(item: ChatMessage) {
    setMessageMenuId(null)
    if (!activeGroup || item.senderId === currentUserId) {
      replyToMessage(item)
      return
    }
    setReplyTarget({ messageId: item.id, author: users.find(user => user.id === item.senderId)?.name ?? 'Utilisateur', excerpt: messageMenuPreview(item).slice(0, 160) })
    setActiveGroupId(null)
    setActiveConversationId(item.senderId)
    setIsComposing(false)
    setRecipientId(null)
    setRecipientDropdownOpen(false)
    focusComposer()
  }

  function forwardMessage(item: ChatMessage) {
    chooseForward(item)
  }

  async function copyMessage(item: ChatMessage) {
    try {
      await navigator.clipboard.writeText(messageMenuPreview(item))
      setChatError('')
    } catch {
      setChatError('Impossible de copier le message dans le presse-papiers.')
    }
    setMessageMenuId(null)
  }


  function beginEdit(item: ChatMessage) {
    if (item.senderId !== currentUserId || item.deletedAt || item.systemEvent || item.poll || item.meeting || item.gif) return
    setEditingMessageId(item.id)
    setEditText(item.text)
    setMessageMenuId(null)
  }

  function saveEditedMessage(item: ChatMessage) {
    const text = editText.trim()
    if (!text) { setChatError('Un message modifié ne peut pas être vide.'); return }
    if (containsInappropriateLanguage(text)) { setChatError(CHAT_MODERATION_ERROR); return }
    const mentions = item.groupId ? detectMentions(text, item.groupId) : []
    if (!chatStore.editMessage(currentUserId, item.id, text, [], mentions)) {
      setChatError('Impossible de modifier ce message.')
      return
    }
    setEditingMessageId(null); setEditText(''); setChatError('')
  }

  async function deleteOwnMessage(item: ChatMessage) {
    if (item.senderId !== currentUserId || item.deletedAt) return
    if (!window.confirm('Supprimer ce message pour tous les participants de cette copie du chat ?')) return
    const ok = chatStore.deleteMessage(currentUserId, item.id)
    if (!ok) { setChatError('Impossible de supprimer ce message.'); return }
    try { await removeChatFiles((item.attachments ?? []).map(file => file.id)) }
    catch { setChatError('Message supprimé, mais certaines pièces jointes locales peuvent subsister.') }
    setMessageMenuId(null)
  }

  function saveReport() {
    if (!reportingMessageId) return
    try {
      const ok = chatStore.reportMessage(currentUserId, reportingMessageId, reportReason)
      if (!ok) { setChatError('Signalement déjà enregistré ou message non autorisé.'); return }
      setReportedIds(current => [...current, reportingMessageId])
      setChatError('Signalement enregistré localement. Il sera à transmettre au service habilité après raccordement au serveur.')
      setReportingMessageId(null)
    } catch { setChatError('Enregistrement du signalement impossible dans ce navigateur.') }
  }

  function chooseForward(item: ChatMessage) {
    setForwardingMessageId(item.id)
    setForwardRecipient('')
    setMessageMenuId(null)
  }

  function confirmForward() {
    if (!forwardRecipient || !forwardingMessageId) return
    const item = storedMessages.find(m => m.id === forwardingMessageId)
    if (!item || item.deletedAt || item.systemEvent) return
    const text = `Transféré : ${messageMenuPreview(item)}`
    const groupId = forwardRecipient.startsWith('group:') ? forwardRecipient.slice(6) : null
    const userId = forwardRecipient.startsWith('direct:') ? forwardRecipient.slice(7) : null
    const ok = groupId
      ? chatStore.sendGroup(currentUserId, groupId, text)
      : userId ? chatStore.send(currentUserId, userId, text) : false
    if (!ok) { setChatError('Impossible de transférer ce message.'); return }
    setForwardingMessageId(null); setForwardRecipient(''); setChatError('Message transféré.')
  }

  function toggleMemberToAdd(userId: string) {
    setMembersToAdd(current => current.includes(userId) ? current.filter(id => id !== userId) : [...current, userId])
  }

  function addSelectedMembers() {
    if (!activeGroup || !membersToAdd.length) return
    try {
      const names: Record<string, string> = Object.fromEntries(users.filter(user => membersToAdd.includes(user.id)).map(user => [user.id, user.name]))
      const ok = chatStore.addMembersToGroup(currentUserId, activeGroup.id, membersToAdd, names)
      if (ok) {
        setMembersToAdd([])
        setShowAddMembers(false)
        setChatError('')
      }
    } catch {
      setChatError('Impossible d’ajouter des membres à ce groupe.')
    }
  }

  function leaveCurrentGroup() {
    if (!activeGroup) return
    const confirmed = window.confirm(`Quitter le groupe « ${activeGroup.name} » ?`)
    if (!confirmed) return
    try {
      const myName = users.find(user => user.id === currentUserId)?.name ?? 'Un membre'
      if (!chatStore.leaveGroup(currentUserId, activeGroup.id, myName)) throw new Error('Impossible de quitter ce groupe.')
      closeConversation()
      setChatError('')
    } catch {
      setChatError('Impossible de quitter ce groupe dans le navigateur.')
    }
  }

  function insertEmoji(emoji: string) {
    editorRef.current?.insertEmoji(emoji)
    setActiveTool('none')
  }

  function chooseChatColor(kind: ChatColorKind, color: string) {
    editorRef.current?.applyColor(kind, color)
    setCustomColor(color)
    setColorPalette(null)
  }

  function onEditorChange(plainText: string, runs: ChatTextRun[]) {
    setMessage(plainText)
    setRichRuns(runs)
    setChatError(current => current === CHAT_MODERATION_ERROR ? '' : current)
  }

  async function searchGifs() {
    if (!gifQuery.trim()) return
    if (!GIPHY_KEY) { setGifError('Ajoute VITE_GIPHY_API_KEY dans le fichier .env du projet pour activer la recherche GIPHY. Tu peux aussi coller un lien GIPHY ci-dessous.'); return }
    setGifLoading(true); setGifError('')
    try {
      const params = new URLSearchParams({ api_key: GIPHY_KEY, q: gifQuery.trim(), limit: '12', rating: 'g', lang: 'fr' })
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?${params.toString()}`)
      if (!response.ok) throw new Error('Recherche indisponible')
      const json: {data?: Array<{id:string;title:string;url:string;images?:{fixed_width?:{url?:string}}}>} = await response.json()
      setGifResults((json.data ?? []).flatMap(item => {
        const url = item.images?.fixed_width?.url
        if (!url || !/^https:\/\/media[0-9]*\.giphy\.com\//.test(url) || !/^[a-zA-Z0-9]{5,45}$/.test(item.id)) return []
        return [{ id: item.id, url, pageUrl: item.url, title: item.title || 'GIF GIPHY' }]
      }))
    } catch { setGifError('La recherche GIPHY ne répond pas. Réessaie ou colle le lien d’un GIF.') }
    finally { setGifLoading(false) }
  }

  function openTool(tool: ToolPanel) { setPlusOpen(false); setActiveTool(current => current === tool ? 'none' : tool) }

  function toolLauncher() {
    return (
      <div className="chat-plus-wrap">
        <input ref={attachmentInputRef} type="file" multiple hidden
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.zip"
          onChange={chooseFiles} aria-label="Choisir des pièces jointes" />
        <button type="button" className="chat-plus-button" title="Ajouter" aria-label="Ouvrir les outils de discussion"
          aria-expanded={plusOpen} onClick={() => { setPlusOpen(v => !v); setActiveTool('none') }}><Plus size={22}/></button>
        {plusOpen && <div className="chat-plus-menu" role="menu">
          <button type="button" role="menuitem" disabled={sending || pendingFiles.length >= MAX_CHAT_FILES}
            onClick={() => { setPlusOpen(false); attachmentInputRef.current?.click() }}><Paperclip size={17}/> Joindre un PDF ou fichier</button>
          <button type="button" role="menuitem" onClick={() => openTool('meeting')}><CalendarDays size={17}/> Proposer une réunion</button>
          <button type="button" role="menuitem" onClick={() => openTool('poll')}><BarChart3 size={17}/> Créer un sondage</button>
        </div>}
      </div>
    )
  }

  function editorToolbar() {
    if (!message.trim()) return null
    return <div className="chat-rich-toolbar" role="toolbar" aria-label="Mettre en forme le message"
      onMouseDown={event => {
        // Garder le texte sélectionné pour les boutons de mise en forme et les couleurs.
        if ((event.target as HTMLElement).closest('button[data-chat-format]')) event.preventDefault()
      }}>
      <button type="button" data-chat-format title="Gras" aria-label="Gras" onClick={() => insertFormatting('bold')}><Bold size={16}/></button>
      <button type="button" data-chat-format title="Italique" aria-label="Italique" onClick={() => insertFormatting('italic')}><Italic size={16}/></button>
      <button type="button" data-chat-format title="Souligné" aria-label="Souligné" onClick={() => insertFormatting('underline')}><Underline size={16}/></button>
      <span className="chat-toolbar-divider"/>
      {(['text', 'highlight'] as const).map(kind => <div key={kind} className="chat-palette-anchor">
        <button type="button" data-chat-format aria-label={kind === 'text' ? 'Choisir la couleur du texte' : 'Choisir la couleur du surlignage'}
          aria-haspopup="dialog" aria-expanded={colorPalette === kind}
          title={kind === 'text' ? 'Couleur du texte' : 'Couleur du surlignage'}
          className={colorPalette === kind ? 'chat-palette-trigger is-open' : 'chat-palette-trigger'}
          onClick={() => setColorPalette(previous => previous === kind ? null : kind)}>
          {kind === 'text' ? <Palette size={17}/> : <Highlighter size={17}/>}
          <ChevronDown size={11}/>
        </button>
        {colorPalette === kind && <div className="chat-color-picker" role="dialog" aria-label={kind === 'text' ? 'Nuancier de couleur du texte' : 'Nuancier de surlignage'}
          onMouseDown={event => event.stopPropagation()}>
          <div className="chat-color-picker-heading">
            <strong>{kind === 'text' ? 'Couleur du texte' : 'Surlignage'}</strong>
            <button type="button" data-chat-format aria-label="Fermer le nuancier" title="Fermer" onClick={() => setColorPalette(null)}><X size={14}/></button>
          </div>
          <div className="chat-color-swatches">
            {CHAT_SWATCHES.map(color => <button type="button" data-chat-format key={color.hex} className="chat-color-swatch"
              title={color.label} aria-label={`${color.label} (${color.hex})`}
              onClick={() => chooseChatColor(kind, color.hex)}>
              <span style={{backgroundColor:color.hex}}/>
            </button>)}
          </div>
          <div className="chat-custom-color">
            <label htmlFor={`chat-custom-${kind}`}>Autre couleur</label>
            <input id={`chat-custom-${kind}`} type="color" value={customColor} onChange={event => setCustomColor(event.target.value)} aria-label="Choisir une couleur personnalisée"/>
            <button type="button" data-chat-format onClick={() => chooseChatColor(kind, customColor)}>Appliquer</button>
          </div>
        </div>}
      </div>)}
      <span className="chat-toolbar-divider"/>
      <button type="button" title="Émojis" aria-label="Choisir un émoji" onClick={() => {setColorPalette(null); openTool('emoji')}}><Smile size={17}/></button>
      <button type="button" title="GIF GIPHY" aria-label="Rechercher un GIF" onClick={() => {setColorPalette(null); openTool('gif')}}><ImageIcon size={17}/><span className="chat-gif-label">GIF</span></button>
    </div>
  }

  function toolContent() {
    if (activeTool === 'none') return null
    return <div className="chat-tool-panel" aria-label="Outils de discussion">
      <div className="chat-tool-title"><strong>{activeTool === 'meeting' ? 'Proposer une réunion' : activeTool === 'poll' ? 'Créer un sondage' : activeTool === 'gif' ? 'Choisir un GIF' : 'Émojis'}</strong><button type="button" aria-label="Fermer" onClick={() => setActiveTool('none')}><X size={16}/></button></div>
      {activeTool === 'emoji' && <div className="chat-emoji-grid">{QUICK_EMOJIS.map(emoji => <button type="button" key={emoji} aria-label={`Ajouter ${emoji}`} onClick={() => insertEmoji(emoji)}>{emoji}</button>)}</div>}
      {activeTool === 'meeting' && <div className="chat-tool-fields">
        <label>Objet<input value={meetingTitle} onChange={e => setMeetingTitle(e.target.value)} maxLength={100} placeholder="Réunion équipe Communication"/></label>
        <label>Date et heure<input type="datetime-local" value={meetingStart} onChange={e => setMeetingStart(e.target.value)}/></label>
        <label>Durée<select value={meetingMinutes} onChange={e => setMeetingMinutes(e.target.value)}><option value="15">15 min</option><option value="30">30 min</option><option value="60">1 h</option><option value="90">1 h 30</option><option value="120">2 h</option></select></label>
        <label>Lieu ou lien (facultatif)<input value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} maxLength={140} placeholder="Salle de réunion / lien visio"/></label>
        <button type="button" className="chat-tool-submit" disabled={!meetingStart || !Number.isFinite(new Date(meetingStart).getTime()) || sending} onClick={() => {
          const startsAt = new Date(meetingStart).toISOString()
          const title = meetingTitle.trim() || 'Réunion Opération Brioche'
          void sendStructured(`📅 Réunion proposée : ${title}`, { meeting: { title, startsAt, durationMinutes: Number(meetingMinutes), location: meetingLocation.trim() } })
        }}>Partager la proposition</button>
        <small>Chaque participant pourra télécharger l’invitation .ics et l’ajouter à son calendrier. Aucun rendez-vous n’est créé automatiquement.</small>
      </div>}
      {activeTool === 'poll' && <div className="chat-tool-fields">
        <label>Question<input value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} maxLength={180} placeholder="Quelle date vous convient ?"/></label>
        {pollOptions.map((value, index) => <label key={index}>Réponse {index+1}<input value={value} maxLength={100} onChange={e => setPollOptions(items => items.map((v,i) => i === index ? e.target.value : v))} placeholder={`Option ${index+1}`}/></label>)}
        {pollOptions.length < 8 && <button type="button" className="chat-tool-secondary" onClick={() => setPollOptions(items => [...items, ''])}><Plus size={14}/> Ajouter une réponse</button>}
        <button type="button" className="chat-tool-submit" disabled={!pollQuestion.trim() || pollOptions.filter(v=>v.trim()).length < 2 || sending} onClick={() => {
          const question = pollQuestion.trim()
          void sendStructured(`📊 Sondage : ${question}`, { poll: { question, options: pollOptions.map(v => v.trim()).filter(Boolean), votes: {} } })
        }}>Publier le sondage</button>
      </div>}
      {activeTool === 'gif' && <div className="chat-tool-fields">
        <div className="chat-gif-search">
          <input aria-label="Recherche GIPHY" value={gifQuery} onChange={e => setGifQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void searchGifs() } }} placeholder="Rechercher un GIF..."/>
          <button type="button" onClick={() => void searchGifs()} disabled={gifLoading || !gifQuery.trim()}>{gifLoading ? '...' : 'Chercher'}</button>
        </div>
        {gifError && <small role="status">{gifError}</small>}
        {gifResults.length > 0 && <div className="chat-gif-results">{gifResults.map(gif => <button type="button" key={gif.id} title={`Envoyer ${gif.title}`} onClick={() => void sendStructured('GIF GIPHY', { gif })}><img alt={gif.title} src={gif.url} loading="lazy"/></button>)}</div>}
        <label>Ou coller un lien GIPHY<input value={gifLink} onChange={e => setGifLink(e.target.value)} placeholder="https://giphy.com/gifs/..."/></label>
        <button type="button" className="chat-tool-submit" disabled={!parseGiphyLink(gifLink) || sending} onClick={() => { const gif = parseGiphyLink(gifLink); if (gif) void sendStructured('GIF GIPHY', { gif }) }}>Envoyer ce GIF</button>
        <small className="chat-giphy-attribution">Powered by <a href="https://giphy.com" target="_blank" rel="noopener noreferrer">GIPHY</a></small>
      </div>}
    </div>
  }

  function pendingAttachments() {
    if (!pendingFiles.length) return null
    return (
      <div className="chat-pending-files" aria-label="Pièces jointes à envoyer">
        {pendingFiles.map((file, index) => (
          <div key={`${file.name}-${index}`} className="chat-pending-file">
            <FileText size={16} />
            <span title={file.name}>{file.name} <small>({formatChatFileSize(file.size)})</small></span>
            <button type="button" disabled={sending} aria-label={`Retirer ${file.name}`} onClick={() => setPendingFiles(items => items.filter((_, i) => i !== index))}><X size={15} /></button>
          </div>
        ))}
      </div>
    )
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <>
      {chatError && chatError !== CHAT_MODERATION_ERROR && chatError !== CHAT_GROUP_NAME_ERROR && <div className="chat-storage-error" role="alert">{chatError}<button type="button" onClick={() => setChatError('')} aria-label="Fermer le message d’erreur">×</button></div>}

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
            showFloating ? '' : 'chat-panel--topbar'
          } ${
            isComposing
              ? `chat-panel--compose ${composeMode === 'group' ? 'chat-panel--compose-group' : 'chat-panel--compose-direct'}`
              : 'chat-panel--browse'
          } ${
            isComposing && recipientDropdownOpen ? 'chat-panel--recipients-open' : ''
          }`}
        >

          {/* EN-TÊTE */}

          <div className="chat-panel-header">

            <div className="chat-panel-title-row">

              <strong>
                {isComposing ? (composeMode === 'group' ? 'Nouveau groupe' : 'Nouveau message') : 'Discussions'}
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
              <button type="button" className="chat-new-message" aria-label={isComposing ? 'Revenir aux discussions' : 'Nouveau message'} title={isComposing ? 'Revenir aux discussions' : 'Nouveau message'} onClick={() => { setIsComposing(value => !value); setComposeMode('direct'); setGroupMemberIds([]); setGroupName(''); setRecipientId(null); setRecipientDropdownOpen(false); setActiveGroupId(null); setActiveConversationId(null); setSearch(''); setMessage(''); setRichRuns([]); setPendingFiles([]) }}>
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
            <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); if (composeMode === 'group') void createNewGroup(); else void sendNewMessage() }}>
              <div className="chat-compose-modes" role="group" aria-label="Type de conversation">
                <button type="button" className={composeMode === 'direct' ? 'selected' : ''} onClick={() => { setComposeMode('direct'); setGroupMemberIds([]); setSearch(''); setRecipientId(null); setRecipientDropdownOpen(false) }}>Individuel</button>
                <button type="button" className={composeMode === 'group' ? 'selected' : ''} onClick={() => { setComposeMode('group'); setRecipientId(null); setGroupMemberIds([]); setSearch(''); setRecipientDropdownOpen(false) }}><UsersRound size={15} /> Groupe</button>
              </div>
              {composeMode === 'group' && (
                <>
                  <label className="chat-compose-label" htmlFor="chat-group-name">Nom du groupe (facultatif)</label>
                  <input className="chat-group-name" id="chat-group-name" maxLength={80} value={groupName} onChange={event => { setGroupName(event.target.value); setChatError(current => current === CHAT_GROUP_NAME_ERROR ? '' : current) }} placeholder="Ex. : Communication – Brioches" />
                </>
              )}
              <label className="chat-compose-label" htmlFor="chat-recipient-search">{composeMode === 'group' ? 'Participants (au moins 2 collègues) :' : 'À :'}</label>
              {composeMode === 'group' && groupMemberIds.length > 0 && (
                <div className="chat-member-chips" aria-label="Participants sélectionnés">
                  {groupMemberIds.map(id => {
                    const user = chatUsers.find(item => item.id === id)
                    return <button type="button" key={id} className="chat-member-chip" onClick={() => setGroupMemberIds(ids => ids.filter(member => member !== id))} title="Retirer du groupe">{user?.name ?? 'Utilisateur'} <X size={13}/></button>
                  })}
                </div>
              )}
              <div className="chat-compose-search">
                <Search size={18} />
                <input
                  id="chat-recipient-search"
                  type="search"
                  value={search}
                  placeholder={composeMode === 'group' ? 'Ajouter des participants...' : 'Rechercher une personne...'}
                  onFocus={() => { if (composeMode === 'group' || !recipientId) setRecipientDropdownOpen(true) }}
                  onChange={event => { setSearch(event.target.value); if (composeMode === 'direct') setRecipientId(null); setRecipientDropdownOpen(true) }}
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
                <div id="chat-recipient-options" className="chat-compose-recipients" role="listbox" aria-multiselectable={composeMode === 'group'} aria-label={composeMode === 'group' ? 'Choisir les membres du groupe' : 'Choisir un destinataire'}>
                  {filteredUsers.length === 0 ? (
                    <p className="chat-compose-empty">Aucun utilisateur trouvé.</p>
                  ) : filteredUsers.map(user => (
                    <button
                      type="button"
                      role="option"
                      aria-selected={composeMode === 'group' ? groupMemberIds.includes(user.id) : recipientId === user.id}
                      key={user.id}
                      className={`chat-compose-recipient ${(composeMode === 'group' ? groupMemberIds.includes(user.id) : recipientId === user.id) ? 'selected' : ''}`}
                      onClick={() => {
                        if (composeMode === 'group') {
                          setGroupMemberIds(ids => ids.includes(user.id) ? ids.filter(id => id !== user.id) : [...ids, user.id])
                          setSearch('')
                        } else { setRecipientId(user.id); setSearch(user.name); setRecipientDropdownOpen(false) }
                      }}
                    >
                      <span className="chat-avatar">{user.name.charAt(0).toUpperCase()}</span>
                      <span><strong>{user.name}</strong><small>{user.poste.trim() || ROLE_LABELS[user.role]}</small></span>
                      {(composeMode === 'group' ? groupMemberIds.includes(user.id) : recipientId === user.id) && <span className="chat-compose-selected">✓</span>}
                    </button>
                  ))}
                </div>
              )}
              <label className="chat-compose-label" htmlFor="chat-new-message-text">Message :</label>
              <ChatRichEditor
                id="chat-new-message-text"
                className="chat-compose-textarea"
                ref={editorRef}
                value={message}
                richText={richRuns}
                onChange={onEditorChange}
                placeholder="Écrire votre message..."
              />
              {editorToolbar()}
              {toolContent()}
              {pendingAttachments()}
              {chatError && (chatError === CHAT_MODERATION_ERROR || chatError === CHAT_GROUP_NAME_ERROR) && <p role="alert" className="chat-moderation-alert">{chatError}</p>}
              <div className="chat-compose-actions">
                {toolLauncher()}
                <button type="submit" className="chat-compose-send" disabled={sending || (composeMode === 'group' ? groupMemberIds.length < 2 : (!recipientId || (!message.trim() && !pendingFiles.length)))}>
                  {composeMode === 'group' ? <UsersRound size={17} /> : <Send size={17} />}
                  {sending ? 'Envoi...' : composeMode === 'group' ? 'Créer le groupe' : 'Envoyer le message'}
                </button>
              </div>
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

            {chatUsers.length === 0 && filteredGroups.length === 0 && (
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

            {(chatUsers.length > 0 || myGroups.length > 0) &&
              filteredUsers.length === 0 && filteredGroups.length === 0 && (
                <div className="chat-empty">
                  {isComposing ? 'Aucun utilisateur trouvé.' : search ? 'Aucune conversation trouvée.' : 'Aucune discussion pour le moment. Cliquez sur + pour écrire un message.'}
                </div>
              )}

            {/* GROUPES : visibles uniquement pour leurs membres */}
            {filteredGroups.map(group => {
              const unread = groupUnreadCount(group.id)
              const mentionCount = groupMentionCount(group.id)
              const groupMute = muteSettings[`group:${group.id}`] ?? 0
              const groupMuted = groupMute === -1 || groupMute > Date.now()
              return (
                <button key={group.id} type="button" className={`chat-conversation ${activeGroupId === group.id ? 'active' : ''}`} onClick={() => openGroup(group.id)}>
                  <div className="chat-avatar chat-group-avatar"><UsersRound size={21} /></div>
                  <div className="chat-conversation-info">
                    <div className="chat-conversation-identity"><strong>{group.name}</strong><span className="chat-conversation-poste">· {group.memberIds.length} membres</span></div>
                    <span className="chat-conversation-preview">{getGroupLastMessage(group.id)}</span>
                  </div>
                  {mentionCount > 0 && <span className="chat-mention-unread" title={`${mentionCount} mention(s) non lue(s)`}>@{mentionCount}</span>}
                  {groupMuted && <BellOff size={14} className="chat-muted-icon" aria-label="En sourdine"/>}
                  {unread > 0 && <span className="chat-unread">{unread}</span>}
                </button>
              )
            })}

            {/* CONVERSATIONS INDIVIDUELLES */}

            {filteredUsers.map((user) => {
              const unread = getUnreadCount(user.id)
              const directMute = muteSettings[`direct:${user.id}`] ?? 0
              const directMuted = directMute === -1 || directMute > Date.now()

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

                  {directMuted && <BellOff size={14} className="chat-muted-icon" aria-label="En sourdine"/>}
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

      {isOpen && (activeConversation || activeGroup) && (
        <div
          className={`chat-message-window ${
            showFloating ? '' : 'chat-message-window--topbar'
          } ${activeGroup ? 'chat-message-window--group' : ''} ${
            activeMessages.length > 8
              ? 'chat-message-window--long'
              : activeMessages.length > 2
                ? 'chat-message-window--regular'
                : 'chat-message-window--short'
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
                  {activeGroup?.name ?? activeConversation?.name}
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

                  {activeGroup ? `${activeGroup.memberIds.length} membres` : 'Compte actif'}

                </span>

              </div>

            </div>

            {/* Les actions de groupe sont regroupées dans la barre bleue. */}
            <div className="chat-message-actions chat-message-actions--group">
              {activeGroup && <>
                <button type="button" aria-label="Ajouter des membres" title="Ajouter des membres"
                  aria-expanded={showAddMembers} aria-controls="chat-group-details"
                  onClick={() => { setShowAddMembers(value => !value); setShowGroupMembers(false) }}>
                  <UserPlus size={18} />
                </button>
                <button type="button" aria-label="Informations du groupe" title="Informations du groupe"
                  aria-expanded={showGroupMembers} aria-controls="chat-group-details"
                  onClick={() => { setShowGroupMembers(value => !value); setShowAddMembers(false); setMembersToAdd([]) }}>
                  <Info size={18} />
                </button>
              </>}
              <button type="button" aria-label="Rechercher dans les messages" title="Rechercher dans les messages"
                aria-expanded={showMessageSearch} onClick={() => { setShowMessageSearch(current => !current); setMessageSearch(''); setShowMuteOptions(false) }}>
                <Search size={17} />
              </button>
              <button type="button" aria-label={isMuted ? 'Réactiver les notifications' : 'Mettre en sourdine'}
                title={isMuted ? 'Réactiver les notifications' : 'Mettre en sourdine'} aria-expanded={showMuteOptions}
                onClick={() => { setShowMuteOptions(value => !value); setShowMessageSearch(false) }}>
                {isMuted ? <BellOff size={17}/> : <Bell size={17}/>}
              </button>
              <button type="button" aria-label="Réduire la discussion" title="Réduire la discussion"
                onClick={closeConversation}>
                <Minus size={20} />
              </button>
            </div>

          </div>

          {/* =================================================
              HISTORIQUE DES MESSAGES
          ================================================= */}

          <div className="chat-message-content">

            {showMessageSearch && <div className="chat-ops-bar">
              <Search size={15}/>
              <input aria-label="Rechercher dans la discussion" autoFocus placeholder="Rechercher un message ou un fichier..." value={messageSearch} onChange={event => setMessageSearch(event.target.value)} />
              <span>{visibleMessages.length} résultat(s)</span>
              <button type="button" aria-label="Fermer la recherche" onClick={() => { setShowMessageSearch(false); setMessageSearch('') }}><X size={15}/></button>
            </div>}
            {showMuteOptions && <div className="chat-ops-bar chat-mute-options">
              <strong>Notifications de cette discussion</strong>
              <div>
                <button type="button" onClick={() => updateMute(Date.now() + 60 * 60 * 1000)}>1 h</button>
                <button type="button" onClick={() => updateMute(Date.now() + 8 * 60 * 60 * 1000)}>8 h</button>
                <button type="button" onClick={() => updateMute(Date.now() + 24 * 60 * 60 * 1000)}>24 h</button>
                <button type="button" onClick={() => updateMute(-1)}>Toujours</button>
                {isMuted && <button type="button" onClick={() => updateMute(0)}>Réactiver</button>}
              </div>
            </div>}
            {reportingMessageId && <div className="chat-ops-bar chat-report-box">
              <strong>Signaler ce message</strong>
              <select aria-label="Motif du signalement" value={reportReason} onChange={event => setReportReason(event.target.value)}>
                {['Propos insultants ou offensants','Harcèlement','Menace','Contenu inapproprié','Autre'].map(reason => <option key={reason} value={reason}>{reason}</option>)}
              </select>
              <div><button type="button" onClick={() => setReportingMessageId(null)}>Annuler</button><button type="button" onClick={saveReport}>Enregistrer</button></div>
              <small>Signalement local à ce stade : aucun responsable n’est encore notifié.</small>
            </div>}
            {forwardingMessageId && <div className="chat-ops-bar chat-forward-box">
              <strong>Transférer le message</strong>
              <select aria-label="Destinataire du transfert" value={forwardRecipient} onChange={event => setForwardRecipient(event.target.value)}>
                <option value="">Choisir un destinataire...</option>
                {chatUsers.map(user => <option key={user.id} value={`direct:${user.id}`}>{user.name}</option>)}
                {myGroups.map(group => <option key={group.id} value={`group:${group.id}`}>Groupe · {group.name}</option>)}
              </select>
              <div><button type="button" onClick={() => setForwardingMessageId(null)}>Annuler</button><button type="button" disabled={!forwardRecipient} onClick={confirmForward}>Transférer</button></div>
            </div>}
            {activeGroup && (showGroupMembers || showAddMembers) && <section
              id="chat-group-details" className="chat-group-overlay" aria-label={showGroupMembers ? 'Informations du groupe' : 'Ajouter des membres'}>
              <div className="chat-group-overlay-main">
                <div className="chat-group-overlay-text">
                  <strong>{activeGroup.name}</strong>
                  <span>{activeGroup.memberIds.length} membres · {activeGroupMembers.map(user => user.name).join(', ')}</span>
                </div>
              </div>
              {showGroupMembers && <div className="chat-group-overlay-panel">
                <strong>Personnes présentes</strong>
                <ul>
                  {activeGroupMembers.map(user => <li key={user.id}>{user.name}</li>)}
                </ul>
                <button type="button" className="chat-group-leave" onClick={leaveCurrentGroup}>Quitter le groupe</button>
              </div>}
              {showAddMembers && <div className="chat-group-overlay-panel">
                <strong>Ajouter des membres</strong>
                {availableMembersToInvite.length === 0 ? <p>Tous les utilisateurs actifs sont déjà dans le groupe.</p> : <>
                  <div className="chat-group-overlay-list">
                    {availableMembersToInvite.map(user => <label key={user.id} className="chat-group-overlay-option"><input type="checkbox" checked={membersToAdd.includes(user.id)} onChange={() => toggleMemberToAdd(user.id)} /> <span>{user.name}</span></label>)}
                  </div>
                  <div className="chat-group-overlay-footer">
                    <button type="button" className="secondary" onClick={() => { setShowAddMembers(false); setMembersToAdd([]) }}>Annuler</button>
                    <button type="button" onClick={addSelectedMembers} disabled={!membersToAdd.length}>Ajouter</button>
                  </div>
                </>}
              </div>}
            </section>}

            {visibleMessages.length === 0 ? (

              <div className="chat-empty">
                Aucun message pour le moment.
                <br />
                Commencez la conversation.
              </div>

            ) : (

              visibleMessages.map((item) => {
                if (item.systemEvent === 'member-left' || item.systemEvent === 'member-joined') return <div key={item.id} className="chat-system-event" role="status">{item.text}</div>
                const sent = item.senderId === currentUserId
                const receiptStatus = sent ? getMessageReceiptStatus(item, activeGroup) : null
                const receiptExpanded = Boolean(activeGroup && menuReadingId === item.id)
                const receiptTitle = receiptStatus === 'read' ? (activeGroup ? 'Lu par tous les membres' : 'Lu') :
                  receiptStatus === 'delivered' ? (activeGroup ? 'Reçu par tous les membres' : 'Reçu') : 'Envoyé'
                const statuses = (item.groupRecipientIds ?? activeGroup?.memberIds.filter(id => id !== item.senderId) ?? []).map(id => ({
                  id, name: users.find(u => u.id === id)?.name ?? 'Utilisateur',
                  status: (item.readBy ?? []).includes(id) ? 'Lu' : (item.deliveredBy ?? []).includes(id) ? 'Reçu' : 'En attente',
                })) ?? []
                const poll = item.poll
                const voteCounts = poll?.options.map((_, i) => Object.values(poll.votes).filter(v => v === i).length) ?? []
                const voteTotal = poll ? Object.keys(poll.votes).length : 0
                const isPinned = pinnedMessageIds.includes(item.id)
                const privateReplyDisabled = !activeGroup || item.senderId === currentUserId
                return <div key={item.id} className={`chat-message-row ${sent ? 'is-sent' : 'is-received'}`}>
                  <div className={`chat-message ${sent ? 'sent' : 'received'} ${isPinned ? 'is-pinned' : ''}`}
                    onClick={(event) => openMessageMenu(item.id, event.currentTarget)}>
                    {activeGroup && <small className="chat-message-author">{users.find(user => user.id === item.senderId)?.name ?? 'Utilisateur'}</small>}
                    {isPinned && <span className="chat-message-pin-badge"><Pin size={12}/> Épinglé</span>}
                    {item.deletedAt ? <span className="chat-message-deleted">Message supprimé</span> : null}
                    {item.editedAt && !item.deletedAt && <small className="chat-message-edited">Modifié</small>}
                    {item.mentions?.includes(currentUserId) && !item.deletedAt && <small className="chat-mention-tag"><AtSign size={11}/> Vous êtes mentionné</small>}
                    {editingMessageId === item.id && <form className="chat-edit-inline" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); saveEditedMessage(item) }}>
                      <textarea aria-label="Modifier le message" autoFocus value={editText} onChange={event => setEditText(event.target.value)} />
                      <div><button type="button" onClick={() => setEditingMessageId(null)}>Annuler</button><button type="submit">Enregistrer</button></div>
                    </form>}
                    {item.replyTo && <div className="chat-message-quoted"><strong>{item.replyTo.author}</strong><span>{item.replyTo.excerpt}</span></div>}
                    {!item.deletedAt && editingMessageId !== item.id && (item.meeting ? <div className="chat-meeting-card">
                      <div className="chat-card-heading"><CalendarDays size={17}/><strong>{item.meeting.title}</strong></div>
                      <div>{new Date(item.meeting.startsAt).toLocaleString('fr-FR', {dateStyle:'full',timeStyle:'short'})}</div>
                      <small>{item.meeting.durationMinutes} min{item.meeting.location ? ` · ${item.meeting.location}` : ''}</small>
                      <button type="button" onClick={(event) => { event.stopPropagation(); downloadMeetingIcs(item) }}>Ajouter au calendrier (.ics)</button>
                    </div> : poll ? <div className="chat-poll-card">
                      <div className="chat-card-heading"><BarChart3 size={17}/><strong>{poll.question}</strong></div>
                      {poll.options.map((option, i) => <button type="button" key={i}
                        className={`chat-poll-option ${poll.votes[currentUserId] === i ? 'is-selected' : ''}`}
                        onClick={(event) => { event.stopPropagation(); try { chatStore.votePoll(currentUserId, item.id, i) } catch { setChatError('Le vote n’a pas pu être enregistré.') } }}>
                        <span>{option}</span><span>{voteCounts[i] ?? 0} vote(s)</span>
                        <span className="chat-poll-progress" style={{width: `${voteTotal ? (voteCounts[i] ?? 0)/voteTotal*100 : 0}%`}}/>
                      </button>)}
                      <small>{voteTotal} participant(s) ont voté · Un vote par compte, modifiable.</small>
                    </div> : item.gif ? <div className="chat-gif-card">
                      <img src={item.gif.url} alt={item.gif.title} loading="lazy" />
                      <a href={item.gif.pageUrl} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>Powered by GIPHY · Voir le GIF</a>
                    </div> : item.text ? <ChatRichText text={item.text} richText={item.richText}/> : null)}
                    {!item.deletedAt && editingMessageId !== item.id && Boolean(item.attachments?.length) && <div className="chat-message-files">
                      {item.attachments?.map(file => <button type="button" key={file.id} className="chat-message-file"
                        onClick={(event) => { event.stopPropagation(); void downloadChatFile(file).catch(() => setChatError(`Impossible de retrouver « ${file.name} » dans ce navigateur.`)) }}
                        title={`Télécharger ${file.name}`}><FileDown size={17}/><span>{file.name}<small>{formatChatFileSize(file.size)}</small></span></button>)}
                    </div>}
                    {messageMenuId === item.id && createPortal(<div ref={menuRef} className="chat-message-context-menu" style={{ left: messageMenuPosition.left, top: messageMenuPosition.top, maxHeight: `calc(100dvh - ${Math.max(8, messageMenuPosition.top)}px - 12px)` }} onClick={event => event.stopPropagation()}>
                      <button type="button" onClick={() => replyToMessage(item)}>Répondre</button>
                      {activeGroup && <>
                        <button type="button" aria-expanded={receiptExpanded} onClick={() => setMenuReadingId(value => value === item.id ? null : item.id)}>Lecture des participants</button>
                        {receiptExpanded && <div className="chat-menu-read-list" role="group" aria-label="Lecture des participants">
                          {statuses.length ? statuses.map(person => <div className="chat-receipt-person" key={person.id}><span>{person.name}</span><span className={person.status === 'Lu' ? 'is-read' : ''}>{person.status}</span></div>) : <span className="chat-menu-read-empty">Aucun autre participant destinataire.</span>}
                        </div>}
                      </>}
                      <button type="button" disabled={privateReplyDisabled} onClick={() => replyPrivately(item)}>Répondre en privé</button>
                      <button type="button" onClick={() => forwardMessage(item)}>Transférer</button>
                      <button type="button" onClick={() => void copyMessage(item)}>Copier</button>
                      <button type="button" onClick={() => togglePinnedMessage(item.id)}>{isPinned ? 'Désépingler le message' : 'Épingler le message'}</button>
                      {!item.deletedAt && item.senderId === currentUserId && !item.meeting && !item.poll && !item.gif && <button type="button" onClick={() => beginEdit(item)}><Pencil size={13}/> Modifier</button>}
                      {!item.deletedAt && item.senderId === currentUserId && <button type="button" onClick={() => void deleteOwnMessage(item)}><Trash2 size={13}/> Supprimer</button>}
                      {!item.deletedAt && item.senderId !== currentUserId && <button type="button" onClick={() => { setReportingMessageId(item.id); setMessageMenuId(null) }}><Flag size={13}/> {reportedIds.includes(item.id) ? 'Déjà signalé' : 'Signaler'}</button>}
                    </div>, document.body)}
                  </div>
                  {sent && <div className="chat-receipt-side">
                    <span className={`chat-receipt chat-receipt--${receiptStatus}`} role="img" aria-label={receiptTitle} title={activeGroup ? `${receiptTitle} · Cliquez sur le message puis Lecture des participants` : receiptTitle}>
                      {receiptStatus === 'sent' ? <Check size={16}/> : <CheckCheck size={16}/>}
                    </span>
                  </div>}
                </div>
              })

            )}

          </div>

          {/* =================================================
              BARRE D'ENVOI
          ================================================= */}

          {editorToolbar()}
          {toolContent()}
          {pendingAttachments()}
          {chatError === CHAT_MODERATION_ERROR && <p role="alert" className="chat-moderation-alert">{chatError}</p>}
          {replyTarget && <div className="chat-reply-preview">
            <div><strong>Répondre à {replyTarget.author}</strong><span>{replyTarget.excerpt}</span></div>
            <button type="button" title="Annuler la réponse" aria-label="Annuler la réponse" onClick={() => setReplyTarget(null)}><X size={17}/></button>
          </div>}
          {mentionCandidates.length > 0 && <div className="chat-mention-suggestions" role="listbox" aria-label="Mentionner un collègue">
            {mentionCandidates.map(user => <button key={user.id} type="button" onMouseDown={event => event.preventDefault()}
              onClick={() => { editorRef.current?.insertMention(user.name, mentionMatch?.[1] ?? ''); setChatError('') }}>
              <AtSign size={14}/>{user.name}
            </button>)}
          </div>}
          <form
            className="chat-message-input"
            onSubmit={(event) => {
              event.preventDefault()
              void sendMessage()
            }}
          >
            {toolLauncher()}

            <ChatRichEditor
              ref={editorRef}
              value={message}
              richText={richRuns}
              onChange={onEditorChange}
              submitOnEnter
              onSubmit={() => void sendMessage()}
              placeholder="Écrire un message..."
            />

            <button
              type="submit"
              className="chat-send-button"
              disabled={sending || (!message.trim() && !pendingFiles.length)}
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