import { useMemo, useState } from 'react'
import { Download, Pencil, Plus, Search, Trash2, X } from 'lucide-react'
import './TableauxComplementaires.css'

type Column = { key: string; label: string; kind?: 'number' | 'date' | 'select' | 'textarea'; options?: string[] }
type RecordRow = { id: string; [field: string]: string }
type Props = { type: 'mecenat' | 'ecarts' }

const configs: Record<Props['type'], { title: string; intro: string; key: string; columns: Column[] }> = {
  mecenat: {
    title: 'Mécénat', intro: 'Référentiel des contributions en nature, financières et en compétences. Liaison aux donateurs et aux justificatifs à venir.', key: 'ob-mecenat-table-v1',
    columns: [
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'partenaire', label: 'Mécène / partenaire' },
      { key: 'nature', label: 'Nature', kind: 'select', options: ['Financier', 'En nature', 'Compétences', 'Autre'] },
      { key: 'description', label: 'Description' },
      { key: 'valeur', label: 'Valeur estimée (€)', kind: 'number' },
      { key: 'etablissement', label: 'Établissement / secteur' },
      { key: 'reference', label: 'Référence source' },
      { key: 'statut', label: 'Statut', kind: 'select', options: ['À confirmer', 'Confirmé', 'Clôturé'] },
    ],
  },
  ecarts: {
    title: 'Pertes / Écarts', intro: 'Suivi déclaratif des anomalies de brioches et de caisse. Aucune modification automatique du stock ou de la comptabilité.', key: 'ob-pertes-ecarts-table-v1',
    columns: [
      { key: 'date', label: 'Date', kind: 'date' },
      { key: 'etablissement', label: 'Établissement / stand' },
      { key: 'origine', label: 'Origine', kind: 'select', options: ['Brioches', 'Caisse', 'TPE', 'Chèques', 'Autre'] },
      { key: 'motif', label: 'Motif / observation' },
      { key: 'quantite', label: 'Quantité', kind: 'number' },
      { key: 'valeur', label: 'Montant de l’écart (€)', kind: 'number' },
      { key: 'reference', label: 'Référence source' },
      { key: 'statut', label: 'Statut', kind: 'select', options: ['À examiner', 'Justifié', 'Résolu'] },
    ],
  },
}

function readRows(key: string): RecordRow[] {
  try {
    const raw = localStorage.getItem(key)
    const value: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(value) ? value.filter((r): r is RecordRow => !!r && typeof r === 'object' && typeof r.id === 'string') : []
  } catch { return [] }
}

const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`
const newId = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export default function TableauxComplementaires({ type }: Props) {
  const config = configs[type]
  const [rows, setRows] = useState<RecordRow[]>(() => readRows(config.key))
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<RecordRow | null>(null)
  const filtered = useMemo(() => rows.filter(row => config.columns.some(col => (row[col.key] ?? '').toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))), [rows, search, config])

  const persist = (value: RecordRow[]) => {
    try { localStorage.setItem(config.key, JSON.stringify(value)); setRows(value) }
    catch { window.alert('Impossible d’enregistrer : stockage du navigateur indisponible ou plein.') }
  }
  const startCreate = () => setEditing({ id: newId(), date: new Date().toISOString().slice(0, 10), statut: type === 'mecenat' ? 'À confirmer' : 'À examiner' })
  const save = () => {
    if (!editing) return
    const primary = type === 'mecenat' ? 'partenaire' : 'etablissement'
    if (!editing.date || !editing[primary]?.trim()) { window.alert('Veuillez renseigner la date et ' + (type === 'mecenat' ? 'le mécène.' : 'l’établissement ou le stand.')); return }
    persist(rows.some(row => row.id === editing.id) ? rows.map(row => row.id === editing.id ? editing : row) : [...rows, editing])
    setEditing(null)
  }
  const exportCsv = () => {
    const headers = ['Identifiant', ...config.columns.map(c => c.label)]
    const lines = [headers, ...filtered.map(row => [row.id, ...config.columns.map(c => row[c.key] || '')])]
    const csv = '\uFEFF' + lines.map(line => line.map(csvEscape).join(';')).join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = `operation-brioche-${type}.csv`; link.click()
    URL.revokeObjectURL(url)
  }
  return <main className="ob-extra">
    <header className="ob-extra-header"><div><span className="ob-extra-eyebrow">DOCUMENTS · OPÉRATION BRIOCHE</span><h1>{config.title}</h1><p>{config.intro}</p></div></header>
    <div className="ob-extra-toolbar"><label className="ob-extra-search"><Search size={18}/><input aria-label="Rechercher" placeholder="Rechercher dans le tableau…" value={search} onChange={e => setSearch(e.target.value)}/></label><span className="ob-extra-count">{filtered.length} ligne(s)</span><button type="button" className="ob-extra-btn secondary" onClick={exportCsv}><Download size={17}/> Exporter CSV</button><button type="button" className="ob-extra-btn primary" onClick={startCreate}><Plus size={17}/> Ajouter</button></div>
    <div className="ob-extra-tablewrap"><table><thead><tr>{config.columns.map(c => <th key={c.key}>{c.label}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.length === 0 ? <tr><td colSpan={config.columns.length + 1} className="ob-extra-empty">Aucune ligne. Utilise « Ajouter » pour commencer.</td></tr> : filtered.map(row => <tr key={row.id}>{config.columns.map(col => <td key={col.key}>{row[col.key] || '—'}</td>)}<td><div className="ob-extra-actions"><button type="button" title="Modifier" aria-label="Modifier" onClick={() => setEditing({...row})}><Pencil size={16}/></button><button type="button" title="Supprimer" aria-label="Supprimer" onClick={() => { if (window.confirm('Supprimer cette ligne ?')) persist(rows.filter(r => r.id !== row.id)) }}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
    <p className="ob-extra-note">Données stockées localement dans ce navigateur. Les références sont prévues pour de futures connexions aux autres modules ; aucune synchronisation ou écriture comptable n’est active.</p>
    {editing && <div className="ob-extra-overlay" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setEditing(null) }}><section className="ob-extra-modal" role="dialog" aria-modal="true" aria-label={`Saisie ${config.title}`}><div className="ob-extra-modalhead"><h2>{rows.some(r => r.id === editing.id) ? 'Modifier' : 'Ajouter'} — {config.title}</h2><button type="button" onClick={() => setEditing(null)} aria-label="Fermer"><X size={20}/></button></div><div className="ob-extra-form">{config.columns.map(col => <label key={col.key}><span>{col.label}</span>{col.kind === 'select' ? <select value={editing[col.key] || ''} onChange={e => setEditing({ ...editing, [col.key]: e.target.value })}><option value="">Sélectionner…</option>{col.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> : <input type={col.kind === 'number' ? 'number' : col.kind === 'date' ? 'date' : 'text'} step={col.kind === 'number' ? 'any' : undefined} value={editing[col.key] || ''} onChange={e => setEditing({ ...editing, [col.key]: e.target.value })}/>}</label>)}</div><div className="ob-extra-footer"><button type="button" className="ob-extra-btn secondary" onClick={() => setEditing(null)}>Annuler</button><button type="button" className="ob-extra-btn primary" onClick={save}>Enregistrer</button></div></section></div>}
  </main>
}
