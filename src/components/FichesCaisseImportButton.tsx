import { useRef, useState } from 'react'
import { Download, Upload, X } from 'lucide-react'
import ExcelJS from 'exceljs'
import { useObData } from '../contexts/ObDataContext'
import { useUsers } from '../contexts/UsersContext'
import { analyserFichesImport, lireCSV, modeleFichesCSV, type AnalyseImport } from '../lib/ficheCaisseImport'
import type { FicheCaisse } from '../types/ob'
import './FichesCaisseImportButton.css'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const money = (value: number) => value.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const number = (value: number) => value.toLocaleString('fr-FR')

function valeurCellule(value: ExcelJS.CellValue): string {
  if (value == null) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text ?? '')
    if ('result' in value) return String(value.result ?? '')
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map(fragment => fragment.text).join('')
    }
    return ''
  }
  return String(value)
}

async function lireClasseur(file: File): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load((await file.arrayBuffer()) as never)
  const feuille = workbook.worksheets[0]
  if (!feuille) throw new Error('Le classeur Excel ne contient pas de feuille.')
  const lignes: string[][] = []
  feuille.eachRow({ includeEmpty: false }, row => {
    const valeurs: string[] = []
    row.eachCell({ includeEmpty: true }, (cell, numeroColonne) => {
      valeurs[numeroColonne - 1] = valeurCellule(cell.value)
    })
    lignes.push(valeurs)
  })
  return lignes
}

export default function FichesCaisseImportButton() {
  const { currentUser } = useUsers()
  const { fichesCaisse, setFichesCaisse, selectedCampagne, activeCampagne } = useObData()
  const campagne = selectedCampagne ?? activeCampagne
  const estAdministrateur = currentUser?.role === 'administrateur'
  const fichierRef = useRef<HTMLInputElement>(null)
  const [ouvert, setOuvert] = useState(false)
  const [nomFichier, setNomFichier] = useState('')
  const [analyse, setAnalyse] = useState<AnalyseImport | null>(null)
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)
  const [confirme, setConfirme] = useState(false)

  if (!estAdministrateur) return null

  const fermer = () => {
    if (chargement) return
    setOuvert(false)
    setErreur('')
    setAnalyse(null)
    setConfirme(false)
    setNomFichier('')
  }

  const ouvrir = () => {
    setErreur('')
    setAnalyse(null)
    setConfirme(false)
    setNomFichier('')
    setOuvert(true)
  }

  const telechargerModele = () => {
    const csv = modeleFichesCSV(campagne?.id ?? '')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `modele-fiches-caisse-${campagne?.id ?? 'campagne'}.csv`
    document.body.appendChild(lien)
    lien.click()
    lien.remove()
    URL.revokeObjectURL(url)
  }

  const charger = async (file: File) => {
    setErreur('')
    setAnalyse(null)
    setConfirme(false)
    setNomFichier(file.name)
    setChargement(true)
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('Seuls les fichiers CSV et XLSX sont acceptés.')
      if (file.size > MAX_FILE_SIZE) throw new Error('Le fichier dépasse la limite de 10 Mo.')
      const lignes = /\.csv$/i.test(file.name) ? lireCSV(await file.text()) : await lireClasseur(file)
      setAnalyse(analyserFichesImport(lignes, campagne?.id ?? '', fichesCaisse))
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : 'Impossible de lire ce fichier.')
    } finally {
      setChargement(false)
    }
  }

  const importer = () => {
    if (!estAdministrateur || !confirme || !campagne?.id || chargement || !analyse ||
        analyse.erreurs.length > 0 || analyse.fiches.length === 0) return
    const nouveaux = analyse.fiches
    if (nouveaux.some(f => f.campagne !== campagne.id)) {
      setErreur('Le fichier doit correspondre à la campagne sélectionnée.')
      return
    }
    const numerosEnregistres = new Set(fichesCaisse.map(f => `${f.campagne}|${f.numero.trim().toLowerCase()}`))
    if (nouveaux.some(f => numerosEnregistres.has(`${f.campagne}|${f.numero.trim().toLowerCase()}`))) {
      setErreur('Un numéro existe déjà. Recharge le fichier pour actualiser les doublons.')
      return
    }
    const prochainId = Math.max(0, ...fichesCaisse.map(f => f.id)) + 1
    const dateControle = new Date().toISOString()
    const ajoutees: FicheCaisse[] = nouveaux.map((f, index) => ({
      ...f,
      id: prochainId + index,
      statutCoffre: 'CONTROLEE',
      dateControleCoffre: dateControle,
    }))
    setFichesCaisse(precedentes => [...precedentes, ...ajoutees])
    fermer()
  }

  return <>
    <button
      type="button"
      className="fc-import-trigger"
      onClick={ouvrir}
      title="Importer des fiches de caisse (administrateur)"
    >
      <Upload size={18} aria-hidden="true" /> Importer
    </button>
    {ouvert && <div className="fc-import-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) fermer()
    }}>
      <section className="fc-import-box" role="dialog" aria-modal="true" aria-labelledby="fc-import-heading">
        <header className="fc-import-top">
          <div>
            <span className="fc-import-eyebrow">FICHES DE CAISSE · ADMINISTRATION</span>
            <h2 id="fc-import-heading">Importer des fiches de caisse</h2>
            <p>Campagne ciblée : <strong>{campagne?.id ?? 'Aucune campagne sélectionnée'}</strong></p>
          </div>
          <button type="button" className="fc-import-close" aria-label="Fermer" onClick={fermer}><X size={20}/></button>
        </header>
        <div className="fc-import-content">
          <div className="fc-import-warning">
            <strong>À vérifier avant validation.</strong> Le coffre actuel prend en compte toutes les fiches enregistrées.
            Les lignes importées seront donc enregistrées comme contrôlées. Aucun enregistrement existant ne sera écrasé.
          </div>
          <div className="fc-import-toolbar">
            <button type="button" onClick={telechargerModele}><Download size={16}/> Télécharger le modèle CSV</button>
            <button type="button" onClick={() => fichierRef.current?.click()} disabled={chargement}><Upload size={16}/> Choisir un CSV ou Excel</button>
            <input
              ref={fichierRef} hidden type="file" accept=".csv,.xlsx"
              onChange={event => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void charger(file)
              }}
            />
          </div>
          {nomFichier && <p className="fc-import-filename">Fichier : <strong>{nomFichier}</strong></p>}
          {chargement && <p>Analyse du fichier en cours…</p>}
          {erreur && <p className="fc-import-error" role="alert">{erreur}</p>}
          {analyse && <>
            <div className="fc-import-summary">
              <strong>{number(analyse.fiches.length)} fiche(s) prête(s)</strong>
              <span>{number(analyse.erreurs.length)} erreur(s)</span>
            </div>
            {analyse.erreurs.length > 0 && <div className="fc-import-error-list" role="alert">
              {analyse.erreurs.slice(0, 20).map((e, index) => <p key={index}>{e}</p>)}
              {analyse.erreurs.length > 20 && <p>…et {analyse.erreurs.length - 20} autre(s) erreur(s).</p>}
            </div>}
            {analyse.fiches.length > 0 && <div className="fc-import-preview">
              <table>
                <thead><tr><th>Numéro</th><th>Date</th><th>Type</th><th>Structure</th><th>Chèques</th><th>TPE</th><th>Virements</th></tr></thead>
                <tbody>{analyse.fiches.slice(0, 35).map(f => <tr key={f.id}>
                  <td>{f.numero}</td><td>{f.date}</td><td>{f.type}</td><td>{f.libelle}</td>
                  <td>{money(f.montantCheques)}</td><td>{money(f.montantTpe)}</td><td>{money(f.montantVirement)}</td>
                </tr>)}</tbody>
              </table>
              {analyse.fiches.length > 35 && <p>35 lignes affichées sur {analyse.fiches.length}.</p>}
            </div>}
            {analyse.erreurs.length === 0 && analyse.fiches.length > 0 && <label className="fc-import-confirm">
              <input type="checkbox" checked={confirme} onChange={event => setConfirme(event.target.checked)}/>
              <span>Je confirme avoir vérifié les montants et leur intégration dans le coffre de {campagne?.id}.</span>
            </label>}
          </>}
        </div>
        <footer className="fc-import-footer">
          <button type="button" onClick={fermer}>Annuler</button>
          <button type="button" className="fc-import-primary" disabled={chargement || !confirme || !analyse || analyse.erreurs.length !== 0 || analyse.fiches.length === 0} onClick={importer}>
            Importer {analyse?.fiches.length ?? 0} fiche(s)
          </button>
        </footer>
      </section>
    </div>}
  </>
}
