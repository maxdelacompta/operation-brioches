import { useState } from 'react'
import { Download, FileText, Upload } from 'lucide-react'
import {
  downloadEntityDocument, generateConvention, saveEntityDocument, type StoredDocumentMeta,
} from '../services/conventionDocuments'
import type { FinanceRow } from '../lib/financeRegister'

const STORAGE_KEY = 'ob-mecenat-signed-conventions-v1'
function savedKey(campaignId: string, id: string) { return JSON.stringify([campaignId, id]) }
function loadMeta(campaignId: string, id: string): StoredDocumentMeta | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, StoredDocumentMeta>
    return saved[savedKey(campaignId, id)] ?? null
  } catch { return null }
}

export default function MecenatConventionActions({ row, campaignName, canEdit, canExport, onNotice, onError }: {
  row: FinanceRow
  campaignName: string
  canEdit: boolean
  canExport: boolean
  onNotice: (message: string) => void
  onError: (message: string) => void
}) {
  const [signed, setSigned] = useState(() => loadMeta(row.campagne, row.id))

  async function generate() {
    if (!canExport) return
    try {
      await generateConvention(row.campagne, 'mecenat', {
        entreprise: row.partenaire ?? '',
        adresse: row.etablissement ?? '',
        montant: new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(row.valeur ?? 0)),
        campagne: campaignName,
        date: row.date ? new Date(`${row.date}T12:00:00`).toLocaleDateString('fr-FR') : '',
        contreparties: '',
        nature: row.nature ?? '',
        description: row.description ?? '',
      }, `convention-mecenat-${row.id}.docx`)
      onNotice('Convention de mécénat générée.')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Impossible de générer la convention.')
    }
  }

  async function upload(file: File | undefined) {
    if (!file || !canEdit) return
    try {
      const meta = await saveEntityDocument(row.campagne, row.id, 'mecenat-signe', file)
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, StoredDocumentMeta>
      all[savedKey(row.campagne, row.id)] = meta
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
      setSigned(meta)
      onNotice('Convention signée enregistrée.')
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Import impossible.')
    }
  }

  async function download() {
    if (!signed) return
    try { await downloadEntityDocument(row.campagne, row.id, 'mecenat-signe', signed.name) }
    catch (cause) { onError(cause instanceof Error ? cause.message : 'Document introuvable.') }
  }

  return <>
    {canExport && <button type="button" title="Générer la convention Word" aria-label={`Générer la convention de ${row.partenaire || row.id}`} onClick={() => void generate()}><FileText size={16}/></button>}
    {canEdit && <label title="Importer la convention signée" style={{ cursor: 'pointer', position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Upload size={16}/><input type="file" accept=".pdf,.docx" aria-label={`Importer convention signée de ${row.partenaire || row.id}`} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', cursor: 'pointer' }} onChange={event => { void upload(event.target.files?.[0]); event.target.value = '' }}/>
    </label>}
    {signed && canExport && <button type="button" title={`Télécharger la convention signée : ${signed.name}`} aria-label={`Télécharger convention signée ${row.id}`} onClick={() => void download()}><Download size={16}/></button>}
  </>
}
