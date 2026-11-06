import { useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import ExcelJS from 'exceljs'
import { useUsers } from '../contexts/UsersContext'
import { useObData } from '../contexts/ObDataContext'
import { useJustificatifs } from '../contexts/JustificatifsContext'
import {
  analyserImportJustificatifs,
  lireCSV,
  modeleImportJustificatifs,
  type AnalyseJustificatifsImport,
} from '../lib/justificatifsImport'
import './JustificatifsImportButton.css'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const argent = (valeur: number) => valeur.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

function valeurCellule(cell: ExcelJS.CellValue): string {
  if (cell == null) return ''
  if (cell instanceof Date) return cell.toISOString().slice(0, 10)
  if (typeof cell === 'object') {
    if ('text' in cell) return String(cell.text ?? '')
    if ('result' in cell) return String(cell.result ?? '')
    if ('richText' in cell && Array.isArray(cell.richText)) return cell.richText.map(fragment => fragment.text).join('')
    return ''
  }
  return String(cell)
}

async function lireExcel(file: File): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load((await file.arrayBuffer()) as never)
  const feuille = workbook.worksheets[0]
  if (!feuille) throw new Error('Le classeur ne contient aucune feuille Excel.')
  const lignes: string[][] = []
  feuille.eachRow({ includeEmpty: false }, row => {
    const valeurs: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, numero) => {
      valeurs[numero - 1] = valeurCellule(cell.value)
    })
    lignes.push(valeurs)
  })
  return lignes
}

export default function JustificatifsImportButton() {
  const { currentUser } = useUsers()
  const { selectedCampagne, activeCampagne } = useObData()
  const { justificatifs, importerJustificatifs } = useJustificatifs()
  const campagne = selectedCampagne ?? activeCampagne
  const estAdministrateur = currentUser?.role === 'administrateur'
  const fichierRef = useRef<HTMLInputElement>(null)
  const [ouvert, setOuvert] = useState(false)
  const [nomFichier, setNomFichier] = useState('')
  const [analyse, setAnalyse] = useState<AnalyseJustificatifsImport | null>(null)
  const [erreur, setErreur] = useState('')
  const [charge, setCharge] = useState(false)
  const [confirmation, setConfirmation] = useState(false)

  if (!estAdministrateur) return null

  const fermer = () => {
    if (charge) return
    setOuvert(false)
    setNomFichier('')
    setAnalyse(null)
    setErreur('')
    setConfirmation(false)
  }

  const telechargerModele = () => {
    const donnees = modeleImportJustificatifs(campagne?.id ?? '')
    const url = URL.createObjectURL(new Blob([donnees], { type: 'text/csv;charset=utf-8' }))
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `modele-justificatifs-${campagne?.id ?? 'campagne'}.csv`
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    URL.revokeObjectURL(url)
  }

  const choisirFichier = async (file: File) => {
    setErreur('')
    setAnalyse(null)
    setConfirmation(false)
    setNomFichier(file.name)
    setCharge(true)
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('Format accepté : CSV ou XLSX seulement.')
      if (file.size > MAX_FILE_SIZE) throw new Error('Le fichier dépasse 10 Mo.')
      const lignes = /\.csv$/i.test(file.name) ? lireCSV(await file.text()) : await lireExcel(file)
      setAnalyse(analyserImportJustificatifs(lignes, campagne?.id ?? '', justificatifs))
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : 'Impossible de lire ce fichier.')
    } finally {
      setCharge(false)
    }
  }

  const importer = () => {
    if (!estAdministrateur || !confirmation || charge || !analyse || !campagne?.id ||
        analyse.erreurs.length || !analyse.documents.length) return
    try {
      const analyseActualisee = analyserImportJustificatifs(
        [
          ['numero', 'type', 'campagne', 'donateurNom', 'dateEmission', 'nbBrioches', 'prixUnitaire'],
          ...analyse.documents.map(doc => [doc.numero, doc.type, doc.campagne, doc.donateurNom, doc.dateEmission, String(doc.nbBrioches), String(doc.prixUnitaire)]),
        ],
        campagne.id,
        justificatifs,
      )
      if (analyseActualisee.erreurs.length) {
        setErreur(analyseActualisee.erreurs.join(' · '))
        return
      }
      // La lecture d'origine conserve les champs facultatifs, contrairement à la
      // vérification ci-dessus qui ne sert qu'à recontrôler les numéros.
      importerJustificatifs(analyse.documents)
      fermer()
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : 'Import interrompu.')
    }
  }

  return <>
    <button type="button" className="jd-import-trigger" onClick={() => {
      setErreur(''); setAnalyse(null); setConfirmation(false); setNomFichier(''); setOuvert(true)
    }} title="Importer des justificatifs (administrateur)">
      <Upload size={18} aria-hidden="true" /> Importer
    </button>
    {ouvert && <div className="jd-import-overlay" onMouseDown={event => { if (event.target === event.currentTarget) fermer() }}>
      <section className="jd-import-dialog" role="dialog" aria-modal="true" aria-labelledby="jd-import-title">
        <header className="jd-import-header">
          <div>
            <span className="jd-import-eyebrow">JUSTIFICATIFS DE DONS · ADMINISTRATION</span>
            <h2 id="jd-import-title">Importer des justificatifs JDI / JDP</h2>
            <p>Campagne sélectionnée : <strong>{campagne?.id ?? 'Aucune'}</strong></p>
          </div>
          <button type="button" aria-label="Fermer" className="jd-import-close" onClick={fermer}><X size={19}/></button>
        </header>
        <div className="jd-import-body">
          <div className="jd-import-notice">
            Seules les <strong>données des justificatifs</strong> sont importées, pas leurs fichiers PDF.
            Les documents sont placés <strong>À vérifier / À générer</strong> : aucun justificatif ne sera marqué comme envoyé.
            Les enregistrements existants ne sont jamais remplacés.
          </div>
          <div className="jd-import-actions">
            <button type="button" onClick={telechargerModele}><Download size={17}/> Modèle CSV</button>
            <button type="button" onClick={() => fichierRef.current?.click()} disabled={charge || !campagne}><FileSpreadsheet size={17}/> Choisir CSV / Excel</button>
            <input ref={fichierRef} type="file" accept=".csv,.xlsx" hidden onChange={event => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void choisirFichier(file)
            }}/>
          </div>
          {nomFichier && <p className="jd-import-filename">Fichier : <strong>{nomFichier}</strong></p>}
          {charge && <p>Analyse du fichier en cours…</p>}
          {erreur && <p className="jd-import-error" role="alert">{erreur}</p>}
          {analyse && <>
            <div className="jd-import-summary">
              <strong>{analyse.documents.length} justificatif(s) prêt(s)</strong>
              <span>{analyse.erreurs.length} erreur(s)</span>
              {analyse.ignores > 0 && <span>{analyse.ignores} ligne(s) vide(s) ignorée(s)</span>}
            </div>
            {analyse.erreurs.length > 0 && <div className="jd-import-errors" role="alert">
              {analyse.erreurs.slice(0, 20).map((value, i) => <p key={i}>{value}</p>)}
              {analyse.erreurs.length > 20 && <p>…et {analyse.erreurs.length - 20} autre(s) erreur(s).</p>}
            </div>}
            {analyse.documents.length > 0 && <div className="jd-import-table-wrap">
              <table>
                <thead><tr><th>Numéro</th><th>Type</th><th>Donateur</th><th>Date</th><th>Montant</th><th>Paiement</th></tr></thead>
                <tbody>{analyse.documents.slice(0, 40).map(doc => <tr key={doc.numero}>
                  <td>{doc.numero}</td><td>{doc.type}</td><td>{doc.donateurNom}</td><td>{doc.dateEmission}</td>
                  <td>{argent(doc.nbBrioches * doc.prixUnitaire)}</td><td>{doc.paiementStatut}</td>
                </tr>)}</tbody>
              </table>
              {analyse.documents.length > 40 && <p>40 lignes affichées sur {analyse.documents.length}.</p>}
            </div>}
            {analyse.erreurs.length === 0 && analyse.documents.length > 0 && <label className="jd-import-confirm">
              <input type="checkbox" checked={confirmation} onChange={event => setConfirmation(event.target.checked)}/>
              <span>J'ai vérifié les numéros, la campagne et les montants. Je confirme l'intégration de {analyse.documents.length} justificatif(s) sans PDF.</span>
            </label>}
          </>}
        </div>
        <footer className="jd-import-footer">
          <button type="button" onClick={fermer}>Annuler</button>
          <button type="button" className="jd-import-validate" disabled={charge || !confirmation || !analyse || analyse.erreurs.length > 0 || analyse.documents.length === 0} onClick={importer}>
            <Upload size={16} /> Importer {analyse?.documents.length ?? 0} justificatif(s)
          </button>
        </footer>
      </section>
    </div>}
  </>
}
