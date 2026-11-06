import { useState, type ChangeEvent } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import type { CommandeMairieRs } from '../types/commandesMairiesRs'
import {
  COMMANDES_MAIRIES_RS_HEADERS,
  excelValueText,
  parseCommandesMairiesRsCsv,
  parseCommandesMairiesRsRows,
  type CommandeMairiesRsImportInput,
  type CommandeMairiesRsImportRow,
} from '../lib/commandesMairiesRsImport'
import './ImportCommandesMairiesRs.css'

type Props = {
  campagne: string
  commandes: CommandeMairieRs[]
  onImport: (items: CommandeMairiesRsImportInput[]) => { imported: number; skipped: number }
  onClose: () => void
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function downloadModel(campagne: string) {
  const example = [
    '', campagne, 'Mairie', 'Lunéville', '', 'Mairie de démonstration', '',
    '14', '2', '', '', '', '', '', '', '', '', '70', '', '', '', '', '', 'Brouillon',
  ]
  const csv = [COMMANDES_MAIRIES_RS_HEADERS, example]
    .map(row => row.map(csvCell).join(';')).join('\r\n')
  download(`modele-commandes-mairies-rs-${campagne.replace(/[^a-z0-9]+/gi, '-')}.csv`,
    new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }))
}

export default function ImportCommandesMairiesRs({ campagne, commandes, onImport, onClose }: Props) {
  const [rows, setRows] = useState<CommandeMairiesRsImportRow[]>([])
  const [error, setError] = useState('')
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)

  const invalid = rows.filter(row => row.problems.length > 0)
  const duplicates = rows.filter(row => row.duplicate && row.problems.length === 0)
  const accepted = rows.filter(row => !row.duplicate && row.problems.length === 0)

  async function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setRows([])
    setResult(null)
    setError('')
    setFileName(file.name)
    setLoading(true)
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('Fichier trop volumineux (maximum : 5 Mo).')
      let cells: unknown[][]
      if (/\.csv$/i.test(file.name)) {
        cells = parseCommandesMairiesRsCsv(await file.text())
      } else if (/\.xlsx$/i.test(file.name)) {
        const { default: ExcelJS } = await import('exceljs')
        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await file.arrayBuffer())
        const sheet = workbook.worksheets[0]
        if (!sheet) throw new Error('Le classeur ne contient aucune feuille.')
        cells = []
        sheet.eachRow(row => {
          cells.push(Array.from({ length: Math.min(sheet.columnCount, 60) }, (_, i) => row.getCell(i + 1).value))
        })
      } else {
        throw new Error('Sélectionne un fichier CSV ou Excel .xlsx.')
      }
      if (cells.length && cells[0].every(value => excelValueText(value) === '')) {
        throw new Error('La première ligne doit contenir les noms des colonnes.')
      }
      const prepared = parseCommandesMairiesRsRows(cells, campagne, commandes)
      if (prepared.length === 0) throw new Error('Aucune commande exploitable dans ce fichier.')
      setRows(prepared)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de lire le fichier.')
    } finally {
      setLoading(false)
    }
  }

  function confirm() {
    if (loading || result || invalid.length || !accepted.length) return
    try {
      // Une sauvegarde téléchargeable précède toute écriture dans la campagne.
      download(`sauvegarde-commandes-mairies-rs-${new Date().toISOString().slice(0, 10)}.json`,
        new Blob([JSON.stringify(commandes, null, 2)], { type: 'application/json' }))
      if (!window.confirm(`La sauvegarde des commandes vient d'être téléchargée. Importer ${accepted.length} nouvelle(s) commande(s) dans ${campagne} ? Les ${duplicates.length} doublon(s) seront ignorés.`)) return
      const outcome = onImport(accepted.map(row => ({ sourceNumero: row.sourceNumero, value: row.value })))
      setResult(outcome)
      setError('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de terminer l’import.')
    }
  }

  return (
    <div className="cmri-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <section className="cmri-dialog" role="dialog" aria-modal="true" aria-label="Importer des commandes Mairies et RS">
        <header className="cmri-header">
          <div>
            <span className="cmri-eyebrow">ADMINISTRATION DES COMMANDES</span>
            <h2><FileSpreadsheet size={22} /> Importer des commandes Mairies & RS</h2>
            <p>Campagne sélectionnée : <strong>{campagne}</strong> · Réservé aux administrateurs</p>
          </div>
          <button type="button" className="cmri-icon" onClick={onClose} aria-label="Fermer l’import"><X size={20}/></button>
        </header>
        <div className="cmri-content">
          <div className="cmri-actions">
            <button type="button" className="cmri-outline" onClick={() => downloadModel(campagne)}>
              <Download size={17}/> Télécharger le modèle CSV
            </button>
            <label className="cmri-file">
              <Upload size={17}/> Choisir un fichier CSV / XLSX
              <input hidden type="file" accept=".csv,.xlsx" onChange={event => { void pickFile(event) }} disabled={loading || Boolean(result)}/>
            </label>
          </div>
          <p className="cmri-help">Les commandes sont créées dans la campagne affichée, sans écraser celles déjà présentes. Les numéros existants sont détectés comme doublons. Un aperçu et une sauvegarde sont proposés avant confirmation.</p>
          {fileName && <p className="cmri-file-name">Fichier : <strong>{fileName}</strong>{loading ? ' · Lecture en cours…' : ''}</p>}
          {error && <p className="cmri-error" role="alert">{error}</p>}
          {result && <p className="cmri-success" role="status">Import terminé : {result.imported} nouvelle(s) commande(s) enregistrée(s){result.skipped ? `, ${result.skipped} doublon(s) ignoré(s)` : ''}.</p>}
          {rows.length > 0 && (
            <>
              <div className="cmri-totals">
                <span><strong>{rows.length}</strong> ligne(s)</span>
                <span className="cmri-good"><strong>{accepted.length}</strong> à importer</span>
                <span><strong>{duplicates.length}</strong> doublon(s) ignoré(s)</span>
                <span className={invalid.length ? 'cmri-bad' : ''}><strong>{invalid.length}</strong> erreur(s)</span>
              </div>
              <div className="cmri-table-scroll">
                <table>
                  <thead><tr><th>Ligne</th><th>N° source</th><th>Mairie / RS</th><th>Secteur</th><th>Brioches</th><th>Résultat</th></tr></thead>
                  <tbody>
                    {rows.slice(0, 100).map(row => (
                      <tr key={row.line}>
                        <td>{row.line}</td><td>{row.sourceNumero || 'Auto'}</td>
                        <td>{row.value.quiPasseCommande || '—'}</td><td>{row.value.secteur || '—'}</td>
                        <td>{row.value.quantite}</td>
                        <td className={row.problems.length ? 'cmri-bad' : row.duplicate ? '' : 'cmri-good'}>
                          {row.problems.length ? row.problems.join(' · ') : row.duplicate ? 'Déjà présente' : 'À créer'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 100 && <p className="cmri-help">Aperçu limité aux 100 premières lignes sur {rows.length}. Toutes les lignes sont contrôlées avant import.</p>}
              {invalid.length > 0 && <p className="cmri-help cmri-bad">Corrige les lignes en erreur dans le fichier et recharge-le pour autoriser l’import.</p>}
            </>
          )}
        </div>
        <footer className="cmri-footer">
          <button type="button" className="cmri-outline" onClick={onClose}>{result ? 'Fermer' : 'Annuler'}</button>
          {!result && <button type="button" className="cmri-confirm" onClick={confirm} disabled={loading || invalid.length > 0 || accepted.length === 0}>Importer {accepted.length} commande(s)</button>}
        </footer>
      </section>
    </div>
  )
}
