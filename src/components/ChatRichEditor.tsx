import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import type { ChatTextRun } from '../services/chatStore'

export type ChatFormatCommand = 'bold' | 'italic' | 'underline' | 'blue' | 'highlight'
export type ChatColorKind = 'text' | 'highlight'
export type ChatRichEditorHandle = {
  format: (command: ChatFormatCommand) => void
  applyColor: (kind: ChatColorKind, color: string) => void
  insertEmoji: (emoji: string) => void
  insertMention: (fullName: string, typedFragment: string) => void
  focus: () => void
}

type Props = {
  id?: string
  value: string
  richText: ChatTextRun[]
  onChange: (plainText: string, richText: ChatTextRun[]) => void
  placeholder?: string
  className?: string
  submitOnEnter?: boolean
  onSubmit?: () => void
}

function sameFormatting(left: ChatTextRun, right: ChatTextRun): boolean {
  return Boolean(left.bold) === Boolean(right.bold) && Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline) && Boolean(left.blue) === Boolean(right.blue) &&
    Boolean(left.highlight) === Boolean(right.highlight) &&
    left.color === right.color && left.highlightColor === right.highlightColor
}

export function normalizeRuns(runs: ChatTextRun[]): ChatTextRun[] {
  const output: ChatTextRun[] = []
  for (const run of runs) {
    if (!run.text) continue
    const prior = output.at(-1)
    if (prior && sameFormatting(prior, run)) prior.text += run.text
    else output.push({ ...run })
  }
  return output
}

/** Autorise uniquement des couleurs CSS RVB converties en hexadécimal sûr. */
function normalizeColor(raw: string): string | undefined {
  const value = raw.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  if (/^#[0-9a-f]{3}$/.test(value)) return '#' + value.slice(1).split('').map(c => c + c).join('')
  const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(?:1(?:\.0+)?|0?\.\d+))?\s*\)$/.exec(value)
  if (!match) return undefined
  const rgb = match.slice(1, 4).map(Number)
  if (rgb.some(channel => channel > 255)) return undefined
  return '#' + rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')
}

/** Lecture autorisée des seuls attributs de formatage, sans reprendre du HTML injecté. */
export function extractRichRuns(root: HTMLElement): ChatTextRun[] {
  const result: ChatTextRun[] = []
  const append = (value: string, marks: Omit<ChatTextRun, 'text'>) => {
    if (value) result.push({ text: value.replace(/\u00a0/g, ' '), ...marks })
  }
  const walk = (node: Node, marks: Omit<ChatTextRun, 'text'>) => {
    if (node.nodeType === Node.TEXT_NODE) { append(node.textContent ?? '', marks); return }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const element = node as HTMLElement
    const name = element.tagName.toLowerCase()
    if (name === 'br') { append('\n', marks); return }
    if (['script', 'style', 'iframe', 'img', 'svg'].includes(name)) return
    const css = element.style
    const explicitColor = normalizeColor(css.color || element.getAttribute('color') || '')
    const explicitHighlight = normalizeColor(css.backgroundColor || '')
    const next: Omit<ChatTextRun, 'text'> = {
      bold: Boolean(marks.bold || name === 'b' || name === 'strong' || /^(bold|[6-9]00)$/.test(css.fontWeight)),
      italic: Boolean(marks.italic || name === 'i' || name === 'em' || css.fontStyle === 'italic'),
      underline: Boolean(marks.underline || name === 'u' || css.textDecoration.includes('underline')),
      blue: Boolean(marks.blue),
      highlight: Boolean(marks.highlight || name === 'mark' && !explicitHighlight),
      color: explicitColor ?? marks.color,
      highlightColor: explicitHighlight ?? (name === 'mark' ? '#fff09a' : marks.highlightColor),
    }
    const block = ['div', 'p'].includes(name) && node !== root
    if (block && result.length && !result.at(-1)!.text.endsWith('\n')) append('\n', marks)
    for (const child of Array.from(element.childNodes)) walk(child, next)
  }
  for (const child of Array.from(root.childNodes)) walk(child, {})
  return normalizeRuns(result)
}

function writeRuns(root: HTMLElement, runs: ChatTextRun[]) {
  root.replaceChildren()
  const doc = root.ownerDocument
  for (const run of runs) {
    if (!run.text) continue
    const span = doc.createElement('span')
    span.textContent = run.text
    if (run.bold) span.style.fontWeight = '700'
    if (run.italic) span.style.fontStyle = 'italic'
    if (run.underline) span.style.textDecoration = 'underline'
    if (run.color || run.blue) span.style.color = run.color ?? '#1465b7'
    if (run.highlightColor || run.highlight) span.style.backgroundColor = run.highlightColor ?? '#fff09a'
    root.appendChild(span)
  }
}

const ChatRichEditor = forwardRef<ChatRichEditorHandle, Props>(function ChatRichEditor(
  { id, value, richText, onChange, placeholder = 'Écrire un message...', className = '', submitOnEnter = false, onSubmit }, ref,
) {
  const editableRef = useRef<HTMLDivElement>(null)
  const lastEmitted = useRef<string | null>(null)
  const selectionRef = useRef<Range | null>(null)

  useLayoutEffect(() => {
    const element = editableRef.current
    if (!element || value === lastEmitted.current) return
    // Un changement externe (envoi / retour / annulation) doit réinitialiser l’éditeur.
    writeRuns(element, richText.length && richText.map(run => run.text).join('') === value ? richText : [{ text: value }])
    lastEmitted.current = value
    selectionRef.current = null
  }, [value, richText])

  const commit = () => {
    const element = editableRef.current
    if (!element) return
    const runs = extractRichRuns(element)
    const text = runs.map(item => item.text).join('')
    lastEmitted.current = text
    onChange(text, runs)
  }

  const rememberSelection = () => {
    const element = editableRef.current
    const selection = element?.ownerDocument.defaultView?.getSelection()
    if (!element || !selection?.rangeCount || !element.contains(selection.anchorNode)) return
    selectionRef.current = selection.getRangeAt(0).cloneRange()
  }

  const restoreSelection = () => {
    const element = editableRef.current
    if (!element) return
    element.focus()
    const selection = element.ownerDocument.defaultView?.getSelection()
    if (selection && selectionRef.current) {
      try { selection.removeAllRanges(); selection.addRange(selectionRef.current) }
      catch { selectionRef.current = null }
    }
  }

  const insertPlain = (text: string) => {
    const element = editableRef.current
    if (!element) return
    restoreSelection()
    if (!document.execCommand('insertText', false, text)) {
      const selection = window.getSelection()
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        const node = document.createTextNode(text)
        range.insertNode(node)
        range.setStartAfter(node)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      } else element.appendChild(document.createTextNode(text))
    }
    commit()
    rememberSelection()
  }

  useImperativeHandle(ref, () => ({
    format: (command) => {
      restoreSelection()
      const actions: Record<ChatFormatCommand, [string, string | null]> = {
        bold: ['bold', null], italic: ['italic', null], underline: ['underline', null],
        blue: ['foreColor', '#1465b7'], highlight: ['hiliteColor', '#fff09a'],
      }
      const [name, color] = actions[command]
      document.execCommand(name, false, color ?? undefined)
      commit()
      rememberSelection()
    },
    applyColor: (kind, color) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return
      restoreSelection()
      document.execCommand(kind === 'text' ? 'foreColor' : 'hiliteColor', false, color)
      commit()
      rememberSelection()
    },
    insertEmoji: insertPlain,
    insertMention: (fullName, typedFragment) => {
      const element = editableRef.current
      if (!element || !fullName.trim()) return
      restoreSelection()
      const selection = element.ownerDocument.defaultView?.getSelection()
      if (!selection?.rangeCount) { insertPlain(`@${fullName} `); return }
      const range = selection.getRangeAt(0)
      const fragment = `@${typedFragment}`
      if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset >= fragment.length &&
          (range.startContainer.textContent ?? '').slice(range.startOffset - fragment.length, range.startOffset).toLocaleLowerCase('fr') === fragment.toLocaleLowerCase('fr')) {
        range.setStart(range.startContainer, range.startOffset - fragment.length)
        range.deleteContents()
        const node = element.ownerDocument.createTextNode(`@${fullName} `)
        range.insertNode(node)
        range.setStartAfter(node)
        range.collapse(true)
        selection.removeAllRanges(); selection.addRange(range)
        commit(); rememberSelection()
      } else insertPlain(`@${fullName} `)
    },
    focus: () => editableRef.current?.focus(),
  }))

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && submitOnEnter) {
      event.preventDefault()
      onSubmit?.()
    }
  }
  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    insertPlain(event.clipboardData.getData('text/plain'))
  }
  return <div
    id={id}
    ref={editableRef}
    role="textbox"
    contentEditable
    suppressContentEditableWarning
    aria-label="Écrire un message"
    aria-multiline="true"
    data-placeholder={placeholder}
    className={`chat-rich-editor ${className}`.trim()}
    onInput={commit}
    onPaste={handlePaste}
    onKeyDown={handleKeyDown}
    onMouseUp={rememberSelection}
    onKeyUp={rememberSelection}
    onBlur={rememberSelection}
  />
})

export default ChatRichEditor
