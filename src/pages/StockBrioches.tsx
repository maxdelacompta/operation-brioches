import { useMemo, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, ClipboardList, Plus, Search, Trash2, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useEtablissements } from '../contexts/EtablissementsContext'
import './StockBrioches.css'

type TypeMouvement = 'reception' | 'sortie' | 'retour' | 'ajustement' | 'transfert'
type Mouvement = { id: string; date: string; type: TypeMouvement; etablissementId: string; destinationId?: string; quantite: number; commentaire: string }
const STORAGE = 'ob2026-stock-brioches-demo-v1'
const TYPES: Record<TypeMouvement,string> = { reception: 'Réception', sortie: 'Sortie / remise', retour: 'Retour en stock', ajustement: 'Ajustement (+/−)', transfert: 'Transfert' }
const number = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
function read(): Mouvement[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(STORAGE) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((x): x is Mouvement => Boolean(x && typeof x.id === 'string' && typeof x.date === 'string' && typeof x.etablissementId === 'string' && typeof x.quantite === 'number' && Number.isInteger(x.quantite) && typeof x.type === 'string' && ['reception','sortie','retour','ajustement','transfert'].includes(x.type) && typeof x.commentaire === 'string'))
  } catch { return [] }
}
function effect(m: Mouvement, id: string) {
  if (m.type === 'transfert') return m.etablissementId === id ? -m.quantite : m.destinationId === id ? m.quantite : 0
  if (m.etablissementId !== id) return 0
  return m.type === 'sortie' ? -m.quantite : m.quantite
}
export default function StockBrioches() {
  const { etablissements } = useEtablissements()
  const [mouvements, setMouvements] = useState<Mouvement[]>(read)
  const [etablissementId, setEtablissementId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [type, setType] = useState<TypeMouvement>('reception')
  const [quantite, setQuantite] = useState('1')
  const [commentaire, setCommentaire] = useState('')
  const [filtre, setFiltre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [erreur, setErreur] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const etablissementsActifs = useMemo(() => etablissements.filter(e => e.statut === 'ACTIF'), [etablissements])
  const noms = useMemo(() => new Map(etablissements.map(e => [e.id, e.nom])), [etablissements])
  const stocks = useMemo(() => new Map(etablissements.map(e => [e.id, mouvements.reduce((s,m) => s + effect(m,e.id),0)])), [etablissements, mouvements])
  const total = [...stocks.values()].reduce((a,b) => a+b,0)
  const reception = mouvements.filter(m => m.type === 'reception').reduce((a,m) => a+m.quantite,0)
  const sorties = mouvements.filter(m => m.type === 'sortie').reduce((a,m) => a+m.quantite,0)
  const stockNegatif = [...stocks.values()].filter(n => n < 0).length
  const visibles = mouvements.filter(m => (!filtre || m.etablissementId === filtre || m.destinationId === filtre) && `${TYPES[m.type]} ${noms.get(m.etablissementId) ?? ''} ${noms.get(m.destinationId ?? '') ?? ''} ${m.commentaire}`.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')))
  function sauvegarder(next: Mouvement[]) {
    try { localStorage.setItem(STORAGE,JSON.stringify(next)); setMouvements(next); setErreur(''); return true }
    catch { setErreur('Impossible de sauvegarder dans ce navigateur.'); return false }
  }
  function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setConfirmation('')
    const q = Number(quantite)
    if (!etablissementsActifs.some(e => e.id === etablissementId)) return setErreur('Choisissez un établissement actif.')
    if (!Number.isInteger(q) || (type === 'ajustement' ? q === 0 : q <= 0)) return setErreur('Indiquez une quantité entière valide (positive ou négative uniquement pour un ajustement).')
    if (type === 'transfert' && (!destinationId || destinationId === etablissementId || !etablissementsActifs.some(e => e.id === destinationId))) return setErreur('Choisissez un établissement destinataire différent.')
    if ((type === 'sortie' || type === 'transfert' || (type === 'ajustement' && q < 0)) && (stocks.get(etablissementId) ?? 0) < Math.abs(q)) return setErreur('Stock insuffisant : impossible de créer un stock négatif.')
    const item: Mouvement = { id: crypto.randomUUID(), date: new Date().toISOString(), type, etablissementId, destinationId: type === 'transfert' ? destinationId : undefined, quantite: q, commentaire: commentaire.trim() }
    if (sauvegarder([item,...mouvements])) { setQuantite('1'); setCommentaire(''); setConfirmation('Mouvement enregistré dans ce navigateur.') }
  }
  function supprimer(item: Mouvement) {
    if (!window.confirm('Supprimer ce mouvement de démonstration ?')) return
    const next = mouvements.filter(m => m.id !== item.id)
    const newStocks = etablissements.map(e => next.reduce((s,m) => s+effect(m,e.id),0))
    if (newStocks.some(v => v < 0)) return setErreur('Suppression impossible : elle rendrait un stock négatif. Supprimez d’abord les mouvements dépendants.')
    if (sauvegarder(next)) setConfirmation('Mouvement supprimé.')
  }
  return <main className="stk-page">
    <PageHeader eyebrow="ÉTABLISSEMENTS / STOCK BRIOCHES" title="Stock Brioches" description="Réceptions, sorties, transferts et stocks disponibles par établissement" illustration />
    <div className="stk-demo-note"><AlertTriangle size={17}/> Mode démonstration : les mouvements sont enregistrés uniquement dans ce navigateur. Le suivi des dons n’est pas encore synchronisé avec le stock.</div>
    <section className="stk-kpis" aria-label="Indicateurs de stock">
      <article className="stk-kpi"><span className="stk-kpi-icon stk-blue"><Boxes size={23}/></span><div><span>Stock disponible</span><strong>{number(total)}</strong></div></article>
      <article className="stk-kpi"><span className="stk-kpi-icon stk-green"><ArrowDownToLine size={23}/></span><div><span>Brioches réceptionnées</span><strong>{number(reception)}</strong></div></article>
      <article className="stk-kpi"><span className="stk-kpi-icon stk-orange"><ArrowUpFromLine size={23}/></span><div><span>Brioches sorties</span><strong>{number(sorties)}</strong></div></article>
      <article className="stk-kpi"><span className="stk-kpi-icon stk-blue"><ArrowLeftRight size={23}/></span><div><span>Établissements suivis</span><strong>{etablissements.length}</strong></div></article>
    </section>
    {stockNegatif > 0 && <p className="stk-error">{stockNegatif} établissement(s) ont un stock négatif dans les données enregistrées.</p>}
    <div className="stk-columns">
      <section className="stk-panel"><h2><Plus size={20}/> Enregistrer un mouvement</h2>
        <form className="stk-form" onSubmit={enregistrer}>
          <label>Établissement concerné<select value={etablissementId} onChange={e => setEtablissementId(e.target.value)} required><option value="">Sélectionner un établissement</option>{etablissementsActifs.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}</select></label>
          <label>Type de mouvement<select value={type} onChange={e => setType(e.target.value as TypeMouvement)}>{(Object.keys(TYPES) as TypeMouvement[]).map(t => <option key={t} value={t}>{TYPES[t]}</option>)}</select></label>
          {type === 'transfert' && <label>Établissement destinataire<select value={destinationId} onChange={e => setDestinationId(e.target.value)} required><option value="">Choisir un destinataire</option>{etablissementsActifs.filter(e => e.id !== etablissementId).map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}</select></label>}
          <label>Quantité de brioches<input type="number" step="1" min={type === 'ajustement' ? undefined : 1} required value={quantite} onChange={e => setQuantite(e.target.value)}/></label>
          {type === 'ajustement' && <p className="stk-hint">Saisissez un nombre positif pour ajouter du stock, ou négatif pour en retirer.</p>}
          <label>Commentaire (facultatif)<textarea rows={3} maxLength={250} placeholder="Ex. Livraison initiale, retour de campagne…" value={commentaire} onChange={e => setCommentaire(e.target.value)}/></label>
          {etablissementId && <p className="stk-stock-inline">Stock actuel : <strong>{number(stocks.get(etablissementId) ?? 0)} brioches</strong></p>}
          {erreur && <p className="stk-error" role="alert">{erreur}</p>}{confirmation && <p className="stk-success" role="status">{confirmation}</p>}
          <button className="stk-primary" type="submit" disabled={!etablissementsActifs.length}><Plus size={17}/> Enregistrer le mouvement</button>
          {!etablissementsActifs.length && <p className="stk-hint">Ajoutez d’abord un établissement actif dans Administration → Établissements.</p>}
        </form>
      </section>
      <section className="stk-panel"><h2><Boxes size={20}/> Stock par établissement</h2>
        <div className="stk-table-wrap"><table><thead><tr><th>Établissement</th><th>Stock actuel</th><th>État</th></tr></thead><tbody>{etablissements.map(e => { const q = stocks.get(e.id) ?? 0; return <tr key={e.id}><td>{e.nom}</td><td><strong>{number(q)}</strong></td><td><span className={`stk-pill ${q > 0 ? 'stk-pill--ok' : q < 0 ? 'stk-pill--alert' : 'stk-pill--neutral'}`}>{q > 0 ? 'Disponible' : q < 0 ? 'Anomalie' : 'Épuisé'}</span></td></tr> })}</tbody></table>{!etablissements.length && <p className="stk-empty">Aucun établissement enregistré dans Administration.</p>}</div>
      </section>
    </div>
    <section className="stk-panel stk-history"><div className="stk-history-head"><h2><ClipboardList size={20}/> Historique des mouvements</h2><div className="stk-filters"><select aria-label="Filtrer par établissement" value={filtre} onChange={e => setFiltre(e.target.value)}><option value="">Tous les établissements</option>{etablissements.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}</select><label className="stk-search"><Search size={17}/><input value={recherche} onChange={e => setRecherche(e.target.value)} aria-label="Rechercher un mouvement" placeholder="Rechercher…"/></label></div></div>
      <div className="stk-table-wrap"><table><thead><tr><th>Date / Heure</th><th>Type</th><th>Établissement</th><th>Destination</th><th>Quantité</th><th>Commentaire</th><th></th></tr></thead><tbody>{visibles.map(m => <tr key={m.id}><td>{new Date(m.date).toLocaleString('fr-FR')}</td><td>{TYPES[m.type]}</td><td>{noms.get(m.etablissementId) ?? 'Établissement supprimé'}</td><td>{m.destinationId ? noms.get(m.destinationId) ?? 'Établissement supprimé' : '—'}</td><td><strong>{m.type === 'sortie' || m.type === 'transfert' ? '−' : m.quantite > 0 ? '+' : ''}{number(m.quantite)}</strong></td><td>{m.commentaire || '—'}</td><td><button className="stk-delete" type="button" aria-label="Supprimer le mouvement" title="Supprimer" onClick={() => supprimer(m)}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!visibles.length && <p className="stk-empty">Aucun mouvement à afficher.</p>}</div>
    </section>
  </main>
}
