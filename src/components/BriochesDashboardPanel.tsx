import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, CalendarClock, PackageCheck, Route, Save } from 'lucide-react'
import { useUsers } from '../contexts/UsersContext'
import { useObData } from '../contexts/ObDataContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { loadStockDons, loadStockMovements, STOCK_CHANGED, stockFor } from '../lib/briochesStock'
import { lireStandsEstimes } from '../lib/stocksBriochesStands'
import { lireTransfertsStands } from '../lib/compteurBrioches'
import { composerFluxBrioches, NATURES_FLUX, type FluxBrioche, type MouvementFlux } from '../lib/stocksBriochesFlux'
import {
  calculerReceptionsLots, enregistrerLot, FAMILLES_BRIOCHES, joursAvantDateLimite,
  lireLots, LOTS_CHANGED, type FamilleBrioche, type LimiteBrioche,
} from '../lib/stocksBriochesLots'
import { estDestinataireAlertesStocks, readUserAlerts, ALERTS_EVENT } from '../services/userAlerts'
import './BriochesDashboardPanel.css'

const nf = (n: number) => n.toLocaleString('fr-FR')
function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
/** Lecture réactive des sources de stock existantes ; aucune écriture de stock depuis le dashboard. */
export default function BriochesDashboardPanel() {
  const { currentUser } = useUsers()
  const { selectedCampagne, activeCampagne, fichesCaisse } = useObData()
  const { etablissements } = useEtablissements()
  const campagne = (selectedCampagne ?? activeCampagne)?.id ?? 'OB 2026'
  const autorise = estDestinataireAlertesStocks(currentUser?.role) && currentUser?.status === 'actif'
  const [revision, setRevision] = useState(0)
  const [filtre, setFiltre] = useState<'tous' | 'comptabilise' | 'indicatif'>('tous')
  const [receptionId, setReceptionId] = useState('')
  const [famille, setFamille] = useState<FamilleBrioche>('autre')
  const [reference, setReference] = useState('')
  const [fabrication, setFabrication] = useState('')
  const [limite, setLimite] = useState('')
  const [nature, setNature] = useState<LimiteBrioche>('interne')
  const [commentaire, setCommentaire] = useState('')
  const [feedback, setFeedback] = useState('')

  useEffect(() => {
    const refresh = () => setRevision(n => n + 1)
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener(STOCK_CHANGED, refresh)
    window.addEventListener(LOTS_CHANGED, refresh)
    window.addEventListener(ALERTS_EVENT, refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener(STOCK_CHANGED, refresh)
      window.removeEventListener(LOTS_CHANGED, refresh)
      window.removeEventListener(ALERTS_EVENT, refresh)
    }
  }, [])

  // Hook toujours appelé, y compris lorsqu'un autre profil visite le dashboard.
  const data = useMemo(() => {
    const mouvements = loadStockMovements(campagne).map((m, index) => {
      const item = m as typeof m & {id?: string; date?: string; commentaire?: string}
      return { ...m, id: item.id || `historique-${index}`, date: item.date || '',
        commentaire: item.commentaire || '' } as MouvementFlux
    })
    const dons = loadStockDons(campagne)
    const stands = lireStandsEstimes(campagne, fichesCaisse)
    const transferts = lireTransfertsStands(campagne)
    const noms = new Map(etablissements.map(e => [e.id, e.nom]))
    const flux = composerFluxBrioches({
      mouvements, dons, nomsEtablissements: noms, stands,
      transferts,
    })
    const bilan = etablissements.map(e => ({ id: e.id, nom: e.nom, quantite: stockFor(e.id, mouvements, dons) }))
    const lots = lireLots(campagne)
    const receptions = calculerReceptionsLots(mouvements, lots, dons)
    const aujourdHui = todayLocal()
    const prochains = receptions.filter(r => r.quantiteRestanteEstimee > 0 && r.meta?.dateLimite &&
      (joursAvantDateLimite(r.meta.dateLimite, aujourdHui) ?? 999) <= 2)
    const aQualifier = receptions.filter(r => r.quantiteRestanteEstimee > 0 && !r.meta?.dateLimite)
    const alertes = readUserAlerts().filter(a => a.campagneId === campagne && a.module === 'Stocks brioches' &&
      a.automaticKey && a.assigneeId === currentUser?.id && a.status !== 'terminee')
    return {
      mouvements, dons, stands, flux, bilan, receptions, prochains, aQualifier, alertes,
      stock: bilan.reduce((n, e) => n + e.quantite, 0),
      entrees: mouvements.filter(m => m.type === 'reception' || m.type === 'retour').reduce((n,m) => n + m.quantite, 0),
      sorties: mouvements.filter(m => m.type === 'sortie').reduce((n,m) => n + m.quantite, 0) +
        dons.filter(d => d.type !== 'sans').reduce((n,d) => n + d.quantite, 0),
      prevuesStands: stands.reduce((n,s) => n + s.prevues, 0),
      remisesStands: stands.reduce((n,s) => n + s.remises, 0),
    }
  // Revision invalidates the localStorage-based projections.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campagne, fichesCaisse, etablissements, currentUser?.id, revision])

  const rec = data.receptions.find(x => x.id === receptionId)
  const visibles = data.flux.filter(f => filtre === 'tous' || f.statut === filtre).slice(0, 12)

  function choisirReception(id: string) {
    setReceptionId(id)
    setFeedback('')
    const selected = data.receptions.find(r => r.id === id)
    setFamille(selected?.meta?.famille ?? selected?.famille ?? 'autre')
    setReference(selected?.meta?.reference ?? selected?.commentaire ?? '')
    setFabrication(selected?.meta?.fabrication ?? '')
    setLimite(selected?.meta?.dateLimite ?? '')
    setNature(selected?.meta?.natureLimite ?? 'interne')
    setCommentaire(selected?.meta?.commentaire ?? '')
  }
  function saveLot(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!rec) return
    if (!limite) { setFeedback('Renseigne la date limite réelle ou interne avant de valider.'); return }
    try {
      enregistrerLot(campagne, { mouvementId: rec.id, famille, reference, fabrication,
        dateLimite: limite, natureLimite: nature, commentaire })
      setFeedback('Date limite du lot enregistrée. Les alertes seront actualisées automatiquement.')
    } catch(error) { setFeedback(error instanceof Error ? error.message : 'Erreur d’enregistrement du lot.') }
  }
  return <section className="briodash" aria-label="Suivi des brioches">
    <div className="briodash-head">
      <div><span>LOGISTIQUE · {campagne}</span><h2><PackageCheck size={23}/> Suivi des brioches</h2>
        <p>Stocks physiques comptabilisés et activité des stands indicative, sans double addition.</p></div>
      <Link to="/etablissements/stock-brioches" className="briodash-link">Saisir une réception / un mouvement</Link>
    </div>
    <div className="briodash-stats">
      <div><PackageCheck size={20}/><small>Stock établissements</small><strong>{nf(data.stock)}</strong></div>
      <div><ArrowDownToLine size={20}/><small>Entrées enregistrées</small><strong>{nf(data.entrees)}</strong></div>
      <div><ArrowUpFromLine size={20}/><small>Sorties enregistrées</small><strong>{nf(data.sorties)}</strong></div>
      <div><CalendarClock size={20}/><small>Lots à échéance ≤ 2 j</small><strong>{nf(data.prochains.length)}</strong></div>
    </div>
    <div className="briodash-details">
      <div><span>Stands suivis</span><strong>{nf(data.stands.length)}</strong></div>
      <div><span>Prévues / mises à disposition (est.)</span><strong>{nf(data.prevuesStands)}</strong></div>
      <div><span>Distribuées (déclaration stands)</span><strong>{nf(data.remisesStands)}</strong></div>
      <div><span>Dates à renseigner</span><strong>{nf(data.aQualifier.length)}</strong></div>
    </div>
    <div className="briodash-section-title"><h3><Route size={18}/> Suivi des flux</h3>
      <label>Afficher <select value={filtre} onChange={e=>setFiltre(e.target.value as typeof filtre)}>
        <option value="tous">Tous les flux</option><option value="comptabilise">Comptabilisés</option>
        <option value="indicatif">Indicatifs (stands)</option></select></label></div>
    <div className="briodash-table-scroll"><table><thead><tr><th>Date</th><th>Nature</th><th>Origine → Destination</th><th>Quantité</th><th>Type</th></tr></thead><tbody>
      {visibles.map((f:FluxBrioche) => <tr key={f.id}><td>{f.date ? f.date.slice(0, 10).split('-').reverse().join('/') : '—'}</td>
        <td>{NATURES_FLUX[f.nature]}</td><td>{f.origine} → {f.destination}</td><td><strong>{nf(f.quantite)}</strong></td>
        <td><span className={'briodash-pill briodash-pill--'+f.statut}>{f.statut === 'comptabilise' ? 'Comptabilisé' : 'Indicatif'}</span></td></tr>)}
    </tbody></table>{!visibles.length && <p className="briodash-empty">Aucun flux enregistré pour ce filtre.</p>}</div>
    <p className="briodash-disclaimer">Les compteurs de stands et les flux indicatifs ne sont pas déduits une seconde fois du stock des établissements. Les livraisons directes et retraits non enregistrés ne peuvent pas être reconstitués automatiquement.</p>
    {autorise && <details className="briodash-lots">
      <summary>Lots et dates limites · {data.aQualifier.length} à renseigner · {data.prochains.length} proches de l'échéance</summary>
      <p>Artisan : repère interne de 2 jours ; GMS : 2 à 5 jours ; industriel : durée variable, souvent plus longue. Saisir la <strong>date réelle du lot</strong> et distinguer DLC, DDM et limite interne. Aucun blocage de stock automatique n'est déduit de ces repères.</p>
      <label>Choisir une réception
        <select value={receptionId} onChange={e => choisirReception(e.target.value)}>
          <option value="">Sélectionner une réception</option>
          {data.receptions.filter(r=>r.quantiteRestanteEstimee>0).map(r=><option key={r.id} value={r.id}>{r.meta?.reference || r.commentaire || r.id} · {r.quantiteRestanteEstimee} estimées · {r.meta?.dateLimite || 'date à préciser'}</option>)}
        </select>
      </label>
      {rec && <form onSubmit={saveLot} className="briodash-lot-form">
        <label>Famille<select value={famille} onChange={e=>setFamille(e.target.value as FamilleBrioche)}>
          {(Object.keys(FAMILLES_BRIOCHES) as FamilleBrioche[]).map(k=><option key={k} value={k}>{FAMILLES_BRIOCHES[k]}</option>)}
        </select></label>
        <label>Référence / numéro de lot<input value={reference} onChange={e=>setReference(e.target.value)} maxLength={100}/></label>
        <label>Fabrication connue<input type="date" value={fabrication} onChange={e=>setFabrication(e.target.value)}/></label>
        <label>Date limite effective<input type="date" value={limite} onChange={e=>setLimite(e.target.value)} required/></label>
        <label>Nature<select value={nature} onChange={e=>setNature(e.target.value as LimiteBrioche)}>
          <option value="DLC">DLC</option><option value="DDM">DDM</option><option value="interne">Limite interne</option></select></label>
        <label>Note<input value={commentaire} onChange={e=>setCommentaire(e.target.value)} maxLength={200}/></label>
        <button type="submit"><Save size={16}/> Enregistrer la date</button>
      </form>}
      {feedback && <p className="briodash-feedback" role="status">{feedback}</p>}
      <p className="briodash-disclaimer">Stock restant par lot estimé par FEFO : une sortie physique doit être confirmée avant de conclure qu'un lot donné a été distribué.</p>
    </details>}
    <div className="briodash-foot"><ArrowLeftRight size={18}/><span>Les alertes de péremption, de rupture et d’écarts sont attribuées uniquement à la Communication et aux stagiaires Communication dans le centre de notifications.</span>
      <Link to="/mes-alertes">Gestion des notifications{data.alertes.length ? ` (${data.alertes.length})` : ''}</Link></div>
  </section>
}
