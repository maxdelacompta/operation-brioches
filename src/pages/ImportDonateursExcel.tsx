import { useMemo, useState, type ChangeEvent } from 'react'
import ExcelJS from 'exceljs'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import type { Donateur } from '../types/ob'
import './ImportMairiesExcel.css'

const HEADERS = ['Code donateur','Type','Nom','Numéro voie','Adresse','Code postal','Ville','Informations','Nom contact','Prénom contact','Email','Téléphone','Condition règlement','Mode règlement','JDI','JDP','RF','Remarque','Archivé']
type Preview = { line: number; value: Donateur; action: 'Créer' | 'Mettre à jour' | 'Erreur'; error?: string; existingId?: number }
const normalize = (value: unknown) => String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value
  if (v == null) return ''
  if (typeof v === 'object') {
    if ('text' in v) return String(v.text ?? '').trim()
    if ('result' in v) return String(v.result ?? '').trim()
    if ('richText' in v) return v.richText.map(p => p.text).join('').trim()
  }
  return String(v).trim()
}
function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function rowToDonateur(row: ExcelJS.Row): Donateur {
  const c = (i: number) => cellText(row.getCell(i))
  return { id: 0, code: c(1), type: c(2) || 'ENTREPRISE', nom: c(3), numeroVoie: c(4), adresse: c(5), cp: c(6), ville: c(7), informations: c(8), contactNom: c(9), contactPrenom: c(10), email: c(11), telephone: c(12), conditionReglement: c(13), modeReglement: c(14), jdi: c(15) || 'NON', jdp: c(16) || 'NON', rf: c(17) || 'NON', remarque: c(18), archive: ['oui','true','1','archive'].includes(normalize(c(19))) }
}
export default function ImportDonateursExcel({ donateurs, onCommit, onClose }: { donateurs: Donateur[]; onCommit: (rows: Donateur[]) => void; onClose: () => void }) {
  const [rows, setRows] = useState<Preview[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [filename, setFilename] = useState('')
  const valid = useMemo(() => rows.filter(r => r.action !== 'Erreur'), [rows])

  async function template() {
    const wb = new ExcelJS.Workbook()
    const sheet = wb.addWorksheet('Donateurs')
    sheet.addRow(HEADERS)
    sheet.columns = HEADERS.map(h => ({ width: Math.max(16, Math.min(28, h.length + 6)) }))
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B79' } }
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    const buffer = await wb.xlsx.writeBuffer()
    download('modele-import-donateurs.xlsx', new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  }

  async function read(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true); setRows([]); setError(''); setFilename(file.name)
    try {
      if (!/\.xlsx$/i.test(file.name)) throw new Error('Sélectionne un fichier Excel .xlsx.')
      const wb = new ExcelJS.Workbook()
      await wb.xlsx.load(await file.arrayBuffer())
      const sheet = wb.getWorksheet('Donateurs') ?? wb.worksheets[0]
      if (!sheet) throw new Error('Aucune feuille dans le fichier.')
      const headers = HEADERS.map((_, i) => normalize(cellText(sheet.getRow(1).getCell(i + 1))))
      if (!HEADERS.every((header, i) => normalize(header) === headers[i])) throw new Error('Colonnes non reconnues. Utilise le modèle Donateurs pour préparer le fichier.')
      const seen = new Set<string>()
      const prepared: Preview[] = []
      sheet.eachRow((row, index) => {
        if (index === 1 || !row.hasValues) return
        const value = rowToDonateur(row)
        const code = normalize(value.code)
        const existing = donateurs.find(d => normalize(d.code) === code)
        let reason = ''
        if (!code || !value.nom.trim()) reason = 'Code et nom obligatoires.'
        else if (seen.has(code)) reason = 'Code en double dans le fichier.'
        seen.add(code)
        prepared.push({ line: index, value, action: reason ? 'Erreur' : existing ? 'Mettre à jour' : 'Créer', error: reason, existingId: existing?.id })
      })
      if (!prepared.length) throw new Error('Aucune ligne à importer.')
      setRows(prepared)
    } catch(e) {
      setError(e instanceof Error ? e.message : 'Impossible de lire le fichier.')
    } finally { setLoading(false); event.target.value = '' }
  }

  function commit() {
    if (!valid.length || rows.some(row => row.action === 'Erreur')) return
    download(`sauvegarde-donateurs-avant-import-${new Date().toISOString().slice(0,10)}.json`, new Blob([JSON.stringify(donateurs,null,2)], { type: 'application/json' }))
    if (!window.confirm(`La sauvegarde JSON vient d'être téléchargée. Confirmer l'import de ${valid.length} donateur(s) ?`)) return
    const maxId = donateurs.reduce((max,d) => Math.max(max,d.id),0)
    let nextId = maxId
    const incoming = valid.map(row => {
      if (row.existingId != null) return { ...donateurs.find(d=>d.id===row.existingId)!, ...row.value, id: row.existingId }
      nextId += 1
      return { ...row.value, id: nextId }
    })
    onCommit(incoming)
    onClose()
  }

  return <div className="mi-overlay" onMouseDown={event => { if (event.target===event.currentTarget) onClose() }}>
    <section className="mi-dialog" role="dialog" aria-modal="true" aria-label="Import Excel Donateurs">
      <header className="mi-header"><div><strong><FileSpreadsheet size={20}/> Import Excel — BDD Donateurs</strong><p>Réservé à l'administrateur · création ou mise à jour par code donateur</p></div><button type="button" onClick={onClose} aria-label="Fermer"><X size={20}/></button></header>
      <div className="mi-body"><div className="mi-actions"><button type="button" onClick={template}><Download size={16}/> Télécharger le modèle</button><label className="mi-primary"><Upload size={16}/> Choisir un fichier .xlsx<input hidden type="file" accept=".xlsx" onChange={read}/></label></div>
        {filename && <p className="mi-muted">Fichier : {filename}{loading ? ' · Lecture en cours…' : ''}</p>}
        {error && <p className="mi-error" role="alert">{error}</p>}
        {rows.length > 0 && <><div className="mi-counts"><strong>{rows.length} ligne(s)</strong><span>{rows.filter(r=>r.action==='Créer').length} création(s)</span><span>{rows.filter(r=>r.action==='Mettre à jour').length} mise(s) à jour</span><span>{rows.filter(r=>r.action==='Erreur').length} erreur(s)</span></div><div className="mi-scroll"><table><thead><tr><th>Ligne</th><th>Code</th><th>Nom</th><th>Ville</th><th>Action / contrôle</th></tr></thead><tbody>{rows.map(r=><tr key={r.line}><td>{r.line}</td><td>{r.value.code}</td><td>{r.value.nom}</td><td>{r.value.ville || '—'}</td><td className={r.action === 'Erreur' ? 'mi-danger' : ''}>{r.error || r.action}</td></tr>)}</tbody></table></div></>}
        <p className="mi-muted">Mise à jour par code, sans supprimer les donateurs absents du fichier. Les identifiants des donateurs existants sont conservés pour préserver les commandes liées.</p>
      </div>
      <footer className="mi-footer"><button type="button" onClick={onClose}>Annuler</button><button className="mi-primary" type="button" disabled={!valid.length || rows.some(r=>r.action==='Erreur') || loading} onClick={commit}>Importer {valid.length} donateur(s)</button></footer>
    </section>
  </div>
}
