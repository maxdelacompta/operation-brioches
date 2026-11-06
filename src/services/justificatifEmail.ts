import type { JustificatifDon } from '../types/justificatifs'

export type JustificatifEmailDraft = {
  to: string
  subject: string
  body: string
  itemId: string
}

/** Modèle éditable : aucun envoi ni changement de statut automatique. */
export function prepareJustificatifEmail(item: JustificatifDon): JustificatifEmailDraft {
  const name = item.donateurNom?.trim() || 'Madame, Monsieur'
  const isJdp = item.type === 'JDP'
  return {
    itemId: item.id,
    to: item.emailDestinataire?.trim() || item.donateurEmail?.trim() || '',
    subject: `Opération Brioche – ${isJdp ? 'Justificatif de paiement' : 'Justificatif de don'} ${item.numero} – ${item.campagne}`,
    body: `Bonjour,\n\nVeuillez trouver en pièce jointe le ${isJdp ? 'justificatif de paiement' : 'justificatif de don'} n° ${item.numero} établi pour ${name}, dans le cadre de la campagne ${item.campagne}.\n\nNous vous remercions chaleureusement pour votre soutien à l'Opération Brioche.\n\nNous restons à votre disposition pour toute information complémentaire.\n\nBien cordialement,\nL'équipe Opération Brioche\nAEIM`,
  }
}

const cleanHeader = (value: string) => value.replace(/[\r\n\0]+/g, ' ').trim()
const mimeEncoded = (value: string) => `=?UTF-8?B?${base64(new TextEncoder().encode(cleanHeader(value)))}?=`

function base64(bytes: Uint8Array): string {
  // Construit progressivement les segments afin d'éviter les gros appels spread.
  let result = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    result += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(result)
}

/** Prépare un fichier EML MIME avec un véritable PDF joint. Pas d'envoi réseau. */
export async function createJustificatifEml(
  draft: JustificatifEmailDraft,
  pdf: Blob,
  pdfFilename: string,
): Promise<Blob> {
  const to = cleanHeader(draft.to)
  if (!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(to)) {
    throw new Error('Renseigne une adresse e-mail destinataire valide.')
  }
  if (!draft.subject.trim()) throw new Error("L'objet du mail est obligatoire.")
  if (!draft.body.trim()) throw new Error('Le corps du mail est obligatoire.')

  const boundary = `ob-jd-${crypto.randomUUID()}`
  const safeFilename = pdfFilename.replace(/[\r\n"\\]/g, '_')
  const textEncoded = base64(new TextEncoder().encode(draft.body.replace(/\r?\n/g, '\r\n')))
  const pdfEncoded = base64(new Uint8Array(await pdf.arrayBuffer()))
  const fold = (input: string) => input.match(/.{1,76}/g)?.join('\r\n') || ''
  const eml = [
    `To: ${to}`,
    `Subject: ${mimeEncoded(draft.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    fold(textEncoded),
    `--${boundary}`,
    `Content-Type: application/pdf; name="${safeFilename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${safeFilename}"`,
    '',
    fold(pdfEncoded),
    `--${boundary}--`,
    '',
  ].join('\r\n')
  return new Blob([eml], { type: 'message/rfc822' })
}

export function downloadJustificatifEml(blob: Blob, numero: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `Justificatif_${numero.replace(/[^a-z0-9_-]+/gi, '_')}_mail.eml`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
