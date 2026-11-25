import { Fragment, type ReactNode } from 'react'
import type { ChatTextRun } from '../services/chatStore'

/** Rendu sûr : aucune interprétation HTML, balises limitées à des marqueurs internes. */
export default function ChatRichText({ text, richText }: { text: string; richText?: ChatTextRun[] }) {
  // Les messages récents stockent des segments sûrs : affichage réel de la mise en forme,
  // sans HTML brut ni interprétation de balises fournies par les utilisateurs.
  if (richText?.length && richText.map(segment => segment.text).join('') === text) {
    return <span className="chat-rich-text">{richText.map((segment, index) => (
      <span key={index} className={!segment.color && segment.blue ? 'chat-rich-blue' : undefined} style={{
        fontWeight: segment.bold ? 700 : undefined,
        fontStyle: segment.italic ? 'italic' : undefined,
        textDecoration: segment.underline ? 'underline' : undefined,
        color: segment.color ?? undefined,
        backgroundColor: segment.highlightColor ?? (segment.highlight ? '#fff09a' : undefined),
      }}>{segment.text}</span>
    ))}</span>
  }
  const tokens: ReactNode[] = []
  const regex = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|__([^_\n]+)__|==([^=\n]+)==|\[bleu\]([^\n]*?)\[\/bleu\])/g
  let cursor = 0
  for (const match of text.matchAll(regex)) {
    const index = match.index ?? 0
    if (index > cursor) tokens.push(text.slice(cursor, index))
    const key = `format-${index}`
    if (match[2] !== undefined) tokens.push(<strong key={key}>{match[2]}</strong>)
    else if (match[3] !== undefined) tokens.push(<em key={key}>{match[3]}</em>)
    else if (match[4] !== undefined) tokens.push(<u key={key}>{match[4]}</u>)
    else if (match[5] !== undefined) tokens.push(<mark key={key}>{match[5]}</mark>)
    else if (match[6] !== undefined) tokens.push(<span key={key} className="chat-rich-blue">{match[6]}</span>)
    cursor = index + match[0].length
  }
  if (cursor < text.length) tokens.push(text.slice(cursor))
  return <span className="chat-rich-text">{tokens.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</span>
}
