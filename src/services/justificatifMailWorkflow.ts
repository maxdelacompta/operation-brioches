import type { JustificatifEmailDraft } from './justificatifEmail'

// Intégration Outlook : l'API sécurisée doit être fournie par l'AEIM.
// Aucun secret Microsoft ne doit être présent dans le navigateur.
export const microsoftMailConfigured = import.meta.env.VITE_OB_MICROSOFT_MAIL_ENABLED === 'true'
const STORAGE_KEY = 'ob-justificatifs-mail-suivi-v1'
export const MAIL_WORKFLOW_EVENT = 'ob-justificatifs-mail-updated'

export type MailWorkflowStatus = 'BROUILLON' | 'ACCEPTE_MICROSOFT' | 'ERREUR'
export type MailWorkflowEntry = {
  itemId: string
  numero: string
  campagne: string
  to: string
  subject: string
  body: string
  status: MailWorkflowStatus
  at: string
  by?: string
  messageId?: string
  error?: string
}

export function readMailWorkflow(): MailWorkflowEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((entry): entry is MailWorkflowEntry =>
      !!entry && typeof entry === 'object' &&
      typeof entry.itemId === 'string' && typeof entry.status === 'string',
    )
  } catch { return [] }
}

export function saveMailWorkflow(entry: MailWorkflowEntry): void {
  const entries = readMailWorkflow().filter(e => e.itemId !== entry.itemId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...entries].slice(0, 1000)))
  window.dispatchEvent(new Event(MAIL_WORKFLOW_EVENT))
}

export function validateMailDraft(draft: JustificatifEmailDraft): string | null {
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(draft.to.trim())) return 'Adresse destinataire invalide.'
  if (!draft.subject.trim()) return 'L’objet du mail est obligatoire.'
  if (!draft.body.trim()) return 'Le corps du mail est obligatoire.'
  return null
}

function base64(bytes: Uint8Array): string {
  let raw = ''
  for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(raw)
}

/**
 * Point de raccordement avec le backend AEIM. Ce backend doit authentifier,
 * autoriser, journaliser puis envoyer avec Microsoft Graph (Mail.Send).
 * Le front-end n'enregistre jamais de secret ni ne parle directement à Graph.
 * Réponse 2xx et accepted=true : Microsoft a accepté la demande, PAS preuve de livraison.
 */
export async function sendViaAeimMicrosoftMail(
  draft: JustificatifEmailDraft,
  pdf: Blob,
  filename: string,
): Promise<{ messageId?: string }> {
  if (!microsoftMailConfigured) throw new Error('Envoi Microsoft 365 non configuré par le service informatique.')
  const validation = validateMailDraft(draft)
  if (validation) throw new Error(validation)
  const response = await fetch('/api/justificatifs/send', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      itemId: draft.itemId,
      to: draft.to.trim(),
      subject: draft.subject,
      body: draft.body,
      attachment: { name: filename, mimeType: 'application/pdf', contentBase64: base64(new Uint8Array(await pdf.arrayBuffer())) },
    }),
  })
  if (!response.ok) throw new Error(`Échec de l'envoi Microsoft (HTTP ${response.status}).`)
  const result: unknown = await response.json()
  if (!result || typeof result !== 'object' || (result as { accepted?: unknown }).accepted !== true) {
    throw new Error("Le serveur n'a pas confirmé l'acceptation par Microsoft.")
  }
  const messageId = (result as { messageId?: unknown }).messageId
  return { messageId: typeof messageId === 'string' ? messageId : undefined }
}
