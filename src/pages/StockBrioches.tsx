import { livraisonsStands } from '../lib/standsLivraisons'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Boxes, ClipboardList, Plus, Search, Trash2, AlertTriangle, Store } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useUsers } from '../contexts/UsersContext'
import { useArtisans } from '../contexts/ArtisansContext'
import { useObData } from '../contexts/ObDataContext'
import './StockBrioches.css'
import { STOCK_CHANGED, donsKeyForCampaign, stockKeyForCampaign, loadStockDons, donBrioches, stockFor, publishBriochesChange } from '../lib/briochesStock'

type TypeMouvement = 'reception' | 'sortie' | 'retour' | 'ajustement' | 'transfert'
type Mouvement = { id: string; date: string; type: TypeMouvement; etablissementId: string; destinationId?: string; quantite: number; commentaire: string }

const TYPES: Record<TypeMouvement,string> = { reception: 'Réception', sortie: 'Sortie / remise', retour: 'Retour en stock', ajustement: 'Ajustement (+/−)', transfert: 'Transfert' }
const number = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

// Les livraisons fournisseurs sont rapprochées par commande et campagne.
// Leur identifiant stable empêche toute seconde entrée lors des rechargements.
function memeCampagne(commande: string, selection: string): boolean {
  if (commande.trim().toUpperCase() === selection.trim().toUpperCase()) return true
  const annee = (texte: string) => texte.trim().toUpperCase().match(/^(?:OB\s*[- ]?\s*)?((?:19|20)\d{2})$/)?.[1]
  return Boolean(annee(commande) && annee(commande) === annee(selection))
}

function estLivre(c: { livre?: boolean; destinations?: Array<{ livre?: boolean }> }): boolean {
  return c.livre === true || Boolean(c.destinations?.length && c.destinations.every(d => d.livre === true))
}

function read(campagne: string): Mouvement[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(stockKeyForCampaign(campagne)) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((x): x is Mouvement => Boolean(x && typeof x.id === 'string' && typeof x.date === 'string' && typeof x.etablissementId === 'string' && typeof x.quantite === 'number' && Number.isInteger(x.quantite) && typeof x.type === 'string' && ['reception','sortie','retour','ajustement','transfert'].includes(x.type) && typeof x.commentaire === 'string'))
  } catch { return [] }
}
type StandEstime = {
  id:string; campagne?:string; nom:string; date:string;
  briochesPrevues?:number; briochesRemises?:number
}
type OperationStand = {kind?:string;qty?:number}
type ClotureStand = {briochesTotal?:number; closedAt?:string}
const STANDS_KEY = 'ob-stands-brioches-v1'
const readJson = (key:string):unknown => {
  try{return JSON.parse(localStorage.getItem(key) || 'null') as unknown}catch{return null}
}
const anneeCampagne=(value:string)=>value.match(/(?:19|20)\\d{2}/)?.[0] ?? ''
const appartientCampagne=(stand:StandEstime,campagne:string)=>{
  if (stand.campagne) return stand.campagne===campagne ||
    (anneeCampagne(stand.campagne) !== '' && anneeCampagne(stand.campagne)===anneeCampagne(campagne))
  // Anciens stands sans campagne : affectation indicative d'après l'année de la date.
  return /^\\d{4}-\\d{2}-\\d{2}$/.test(stand.date) && stand.date.slice(0,4)===anneeCampagne(campagne)
}
function lireStandsEstimes(campagne:string) {
  const records=readJson(STANDS_KEY)
  if(!Array.isArray(records)) return [] as Array<{id:string;nom:string;date:string;prevues:number;remises:number;restantes:number;cloture:boolean;origine:string}>
  return records.filter((raw):raw is StandEstime=>Boolean(raw&&typeof raw==='object'&&typeof raw.id==='string'&&typeof raw.nom==='string'&&typeof raw.date==='string'))
    .filter(s=>appartientCampagne(s,campagne))
    .map(s=>{
      const operations=readJson(`ob-stand-operations-v1-${s.id}`)
      const compte=Array.isArray(operations)?operations.reduce((sum:number,op:OperationStand)=>sum+(op?.kind==='brioche'&&Number.isFinite(op.qty)?Math.max(0,Number(op.qty)):0),0):0
      const cloture=readJson(`ob-stand-cloture-v1-${s.id}`) as ClotureStand|null
      // Les livraisons déjà effectuées priment sur la prévision initiale.
      const quantitesLivrees=livraisonsStands(campagne)
      const livraison=quantitesLivrees[s.id]||0
      const prevues=livraison>0?livraison:Math.max(0,Number(s.briochesPrevues)||0)
      const calculees=Math.max(0,(Number(s.briochesRemises)||0)+compte)
      const remises=Math.max(0,cloture && Number.isFinite(cloture.briochesTotal) ? Number(cloture.briochesTotal) : calculees)
      return {id:s.id,nom:s.nom,date:s.date,prevues,remises,restantes:Math.max(0,prevues-remises),cloture:Boolean(cloture?.closedAt),origine:livraison>0?'Livraison effectuée':'Prévision'}
    })
}

export default function StockBrioches() {
  const { etablissements } = useEtablissements()
  const { commandesArtisans } = useArtisans()
  const { selectedCampagne, activeCampagne } = useObData()
  const campagne = (selectedCampagne ?? activeCampagne)?.id ?? 'OB 2026'
  const STORAGE = stockKeyForCampaign(campagne)
  const DONATIONS = donsKeyForCampaign(campagne)
  const { currentUser } = useUsers()
  // Les droits d'accès au module sont conservés par la navigation existante.
  // Ici, on limite la visibilité et les actions au périmètre des établissements.
  const tousEtablissements = currentUser?.role === 'administrateur' || currentUser?.tousEtablissements === true
  const idsAutorises = useMemo(() => new Set(currentUser?.etablissementIds?.length
    ? currentUser.etablissementIds
    : currentUser?.etablissementId ? [currentUser.etablissementId] : []), [currentUser])
  const estAutorise = (id: string) => Boolean(currentUser?.status === 'actif' && (tousEtablissements || idsAutorises.has(id)))
  const etablissementsVisibles = useMemo(() => etablissements.filter(e => estAutorise(e.id)), [etablissements, currentUser])
  // Les réceptions livrées au Siège alimentent la bonne campagne.
  // Seuls les bons expressément marqués livrés sont rapprochés :
  // le statut « Payé » seul ne déclenche jamais un mouvement de stock.
  // Les mouvements manuels sont intégralement conservés.
  useEffect(() => {
    const commandesLivrees = commandesArtisans.filter(c => {
      const x = c as typeof c & {
        livre?: boolean
        destinations?: Array<{ type?: string; referenceId?: string; quantite?: number; livre?: boolean }>
      }
      return memeCampagne(c.campagne, campagne)
        && c.statut !== 'ANNULEE'
        && estLivre(x)
        && Number.isInteger(c.quantiteCommandee)
        && c.quantiteCommandee > 0
    })

    const attendus = new Map<string, Mouvement>()
    for (const c of commandesLivrees) {
      const x = c as typeof c & {
        destinationId?: string
        etablissementId?: string
        destinations?: Array<{ type?: string; referenceId?: string; quantite?: number; livre?: boolean }>
      }
      const destinations = (x.destinations ?? []).filter(d => d.livre && d.type === 'ETABLISSEMENT' && d.referenceId)
      // Pour les livraisons multi-établissements, une réception par lieu.
      if (destinations.length) {
        destinations.forEach((d, i) => {
          const etablissementId = d.referenceId!
          const q = Number(d.quantite)
          if (!etablissements.some(e => e.id === etablissementId) || !Number.isInteger(q) || q <= 0) return
          const id = `achat-reception-${c.id}-${i}`
          attendus.set(id, { id, date: c.dateRetrait || c.dateCommande || new Date().toISOString(), type: 'reception', etablissementId, quantite: q, commentaire: `Livraison achat ${c.numero} (automatique)` })
        })
      } else if (x.livre && (x.etablissementId || x.destinationId)) {
        const etablissementId = x.etablissementId || x.destinationId || ''
        if (!etablissements.some(e => e.id === etablissementId)) continue
        const id = `achat-reception-${c.id}-0`
        attendus.set(id, { id, date: c.dateRetrait || c.dateCommande || new Date().toISOString(), type: 'reception', etablissementId, quantite: c.quantiteCommandee, commentaire: `Livraison achat ${c.numero} (automatique)` })
      }
    }

    const existants = read(campagne)
    const manuels = existants.filter(m => !m.id.startsWith('achat-reception-'))
    const prochains = [...manuels, ...attendus.values()]
    if (JSON.stringify(existants) === JSON.stringify(prochains)) return
    try {
      localStorage.setItem(stockKeyForCampaign(campagne), JSON.stringify(prochains))
      window.dispatchEvent(new Event(STOCK_CHANGED))
    } catch {
      // N'altère pas le stock si le navigateur refuse l'enregistrement.
    }
  }, [commandesArtisans, campagne, etablissements])
  const [mouvements, setMouvements] = useState<Mouvement[]>(() => read(campagne))
  const [dons, setDons] = useState(() => loadStockDons(campagne))
  useEffect(() => {
    const refresh = () => { setMouvements(read(campagne)); setDons(loadStockDons(campagne)) }
    const storageRefresh = (e: StorageEvent) => { if (e.key === STORAGE || e.key === DONATIONS) refresh() }
    window.addEventListener(STOCK_CHANGED, refresh)
    window.addEventListener('storage', storageRefresh)
    return () => { window.removeEventListener(STOCK_CHANGED, refresh); window.removeEventListener('storage', storageRefresh) }
  }, [campagne, STORAGE, DONATIONS])
  const [standsEstimes,setStandsEstimes]=useState(()=>lireStandsEstimes(campagne))
  useEffect(()=>{
    const refresh=()=>setStandsEstimes(lireStandsEstimes(campagne))
    refresh()
    window.addEventListener('focus',refresh)
    window.addEventListener('storage',refresh)
    return ()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh)}
  },[campagne])
  const totalStandsPrevus=standsEstimes.reduce((n,s)=>n+s.prevues,0)
  const totalStandsRemis=standsEstimes.reduce((n,s)=>n+s.remises,0)
  const [etablissementId, setEtablissementId] = useState('')
  const [destinationId, setDestinationId] = useState('')
  const [type, setType] = useState<TypeMouvement>('reception')
  const [quantite, setQuantite] = useState('1')
  const [commentaire, setCommentaire] = useState('')
  const [filtre, setFiltre] = useState('')
  const [recherche, setRecherche] = useState('')
  const [erreur, setErreur] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const etablissementsActifs = useMemo(() => etablissementsVisibles.filter(e => e.statut === 'ACTIF'), [etablissements])
  const noms = useMemo(() => new Map(etablissements.map(e => [e.id, e.nom])), [etablissements])
  const stocks = useMemo(() => new Map(etablissementsVisibles.map(e => [e.id, stockFor(e.id, mouvements, dons)])), [etablissementsVisibles, mouvements, dons])
  const total = [...stocks.values()].reduce((a,b) => a+b,0)
  const reception = mouvements.filter(m => m.type === 'reception' && estAutorise(m.etablissementId)).reduce((a,m) => a+m.quantite,0)
  const sorties = mouvements.filter(m => m.type === 'sortie' && estAutorise(m.etablissementId)).reduce((a,m) => a+m.quantite,0) + etablissementsVisibles.reduce((a,e) => a+donBrioches(e.id,dons),0)
  const stockNegatif = [...stocks.values()].filter(n => n < 0).length
  const visibles = mouvements.filter(m => estAutorise(m.etablissementId) && (!m.destinationId || estAutorise(m.destinationId)) && (!filtre || m.etablissementId === filtre || m.destinationId === filtre) && `${TYPES[m.type]} ${noms.get(m.etablissementId) ?? ''} ${noms.get(m.destinationId ?? '') ?? ''} ${m.commentaire}`.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')))
  function sauvegarder(next: Mouvement[]) {
    try { localStorage.setItem(STORAGE,JSON.stringify(next)); setMouvements(next); publishBriochesChange(); setErreur(''); return true }
    catch { setErreur('Impossible de sauvegarder dans ce navigateur.'); return false }
  }
  function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setConfirmation('')
    const q = Number(quantite)
    if (!estAutorise(etablissementId) || (type === 'transfert' && !estAutorise(destinationId))) return setErreur('Vous ne pouvez enregistrer un mouvement que pour vos établissements autorisés.')
    if (!etablissementsActifs.some(e => e.id === etablissementId)) return setErreur('Choisissez un établissement actif.')
    if (!Number.isInteger(q) || (type === 'ajustement' ? q === 0 : q <= 0)) return setErreur('Indiquez une quantité entière valide (positive ou négative uniquement pour un ajustement).')
    if (type === 'transfert' && (!destinationId || destinationId === etablissementId || !etablissementsActifs.some(e => e.id === destinationId))) return setErreur('Choisissez un établissement destinataire différent.')
    if ((type === 'sortie' || type === 'transfert' || (type === 'ajustement' && q < 0)) && (stocks.get(etablissementId) ?? 0) < Math.abs(q)) return setErreur('Stock insuffisant : impossible de créer un stock négatif.')
    const item: Mouvement = { id: crypto.randomUUID(), date: new Date().toISOString(), type, etablissementId, destinationId: type === 'transfert' ? destinationId : undefined, quantite: q, commentaire: commentaire.trim() }
    if (sauvegarder([item,...mouvements])) { setQuantite('1'); setCommentaire(''); setConfirmation('Mouvement enregistré dans ce navigateur.') }
  }
  function supprimer(item: Mouvement) {
    if (item.id.startsWith('achat-reception-')) return setErreur('Cette réception provient d’une commande achat. Corrigez la livraison depuis le module Commandes achats.')
    if (!estAutorise(item.etablissementId) || (item.destinationId && !estAutorise(item.destinationId))) return setErreur('Mouvement hors de votre périmètre.')
    if (!window.confirm('Supprimer ce mouvement de démonstration ?')) return
    const next = mouvements.filter(m => m.id !== item.id)
    const newStocks = etablissements.map(e => stockFor(e.id, next, dons))
    if (newStocks.some(v => v < 0)) return setErreur('Suppression impossible : elle rendrait un stock négatif. Supprimez d’abord les mouvements dépendants.')
    if (sauvegarder(next)) setConfirmation('Mouvement supprimé.')
  }
  return <main className="stk-page">
    <PageHeader eyebrow="ÉTABLISSEMENTS / STOCK BRIOCHES" title="Stock Brioches" description="Réceptions, sorties, transferts et stocks disponibles par établissement" illustration />
    <div className="stk-demo-note">Campagne consultée : <strong>{campagne}</strong> · mouvements et stock indépendants des autres campagnes.</div>
    {!tousEtablissements && <div className="stk-demo-note">Périmètre limité : seuls vos établissements affectés sont visibles ({etablissementsVisibles.length}).</div>}
    <div className="stk-demo-note"><AlertTriangle size={17}/> Mode démonstration : les mouvements sont enregistrés uniquement dans ce navigateur. Les dons avec contrepartie sont automatiquement déduits du stock de leur établissement.</div>
    <section className="stk-kpis" aria-label="Indicateurs de stock">
      <article className="stk-kpi"><span className="stk-kpi-icon stk-blue"><Boxes size={23}/></span><div><span>Stock disponible</span><strong>{number(total)}</strong></div></article>
      <article className="stk-kpi"><span className="stk-kpi-icon stk-green"><ArrowDownToLine size={23}/></span><div><span>Brioches réceptionnées</span><strong>{number(reception)}</strong></div></article>
      <article className="stk-kpi"><span className="stk-kpi-icon stk-orange"><ArrowUpFromLine size={23}/></span><div><span>Brioches sorties</span><strong>{number(sorties)}</strong></div></article>
      <article className="stk-kpi"><span className="stk-kpi-icon stk-blue"><ArrowLeftRight size={23}/></span><div><span>Établissements suivis</span><strong>{etablissementsVisibles.length}</strong></div></article>
    </section>
    {stockNegatif > 0 && <p className="stk-error">{stockNegatif} établissement(s) ont un stock négatif dans les données enregistrées.</p>}
    <section className="stk-panel stk-stands-estimes">
      <h2><Store size={20}/> Stock approximatif des stands · {campagne}</h2>
      <p className="stk-estimation-note">Quantités livrées aux stands lorsqu’elles existent, sinon prévisions des fiches de stands. Le reste correspond à une estimation, pas à un inventaire physique. Elles ne créent aucun mouvement de stock et ne sont pas soustraites au stock des établissements.</p>
      <div className="stk-stands-summary">
        <div><span>Stands</span><strong>{number(standsEstimes.length)}</strong></div>
        <div><span>Mises à disposition (approx.)</span><strong>{number(totalStandsPrevus)}</strong></div>
        <div><span>Brioches remises déclarées</span><strong>{number(totalStandsRemis)}</strong></div>
        <div><span>Restantes estimées</span><strong>{number(standsEstimes.reduce((n,s)=>n+s.restantes,0))}</strong></div>
      </div>
      <div className="stk-table-wrap">
        <table>
          <thead><tr><th>Stand</th><th>Date</th><th>Origine</th><th>Mises à disposition (approx.)</th><th>Remises</th><th>Restantes estimées</th><th>Décompte</th></tr></thead>
          <tbody>{standsEstimes.map(s=><tr key={s.id}>
            <td>{s.nom}</td><td>{s.date}</td><td>{s.origine}</td><td>{number(s.prevues)}</td><td>{number(s.remises)}</td><td><strong>{number(s.restantes)}</strong></td>
            <td>{s.cloture?'Fermé':'En cours / prévu'}</td>
          </tr>)}</tbody>
        </table>
        {standsEstimes.length===0&&<p className="stk-empty">Aucun stand enregistré pour cette campagne.</p>}
      </div>
    </section>
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
        <div className="stk-table-wrap"><table><thead><tr><th>Établissement</th><th>Stock actuel</th><th>État</th></tr></thead><tbody>{etablissementsVisibles.map(e => { const q = stocks.get(e.id) ?? 0; return <tr key={e.id}><td>{e.nom}</td><td><strong>{number(q)}</strong></td><td><span className={`stk-pill ${q > 0 ? 'stk-pill--ok' : q < 0 ? 'stk-pill--alert' : 'stk-pill--neutral'}`}>{q > 0 ? 'Disponible' : q < 0 ? 'Anomalie' : 'Épuisé'}</span></td></tr> })}</tbody></table>{!etablissementsVisibles.length && <p className="stk-empty">Aucun établissement enregistré dans Administration.</p>}</div>
      </section>
    </div>
    <section className="stk-panel stk-history"><div className="stk-history-head"><h2><ClipboardList size={20}/> Historique des mouvements</h2><div className="stk-filters"><select aria-label="Filtrer par établissement" value={filtre} onChange={e => setFiltre(e.target.value)}><option value="">Tous les établissements</option>{etablissementsVisibles.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}</select><label className="stk-search"><Search size={17}/><input value={recherche} onChange={e => setRecherche(e.target.value)} aria-label="Rechercher un mouvement" placeholder="Rechercher…"/></label></div></div>
      <div className="stk-table-wrap"><table><thead><tr><th>Date / Heure</th><th>Type</th><th>Établissement</th><th>Destination</th><th>Quantité</th><th>Commentaire</th><th></th></tr></thead><tbody>{visibles.map(m => <tr key={m.id}><td>{new Date(m.date).toLocaleString('fr-FR')}</td><td>{TYPES[m.type]}</td><td>{noms.get(m.etablissementId) ?? 'Établissement supprimé'}</td><td>{m.destinationId ? noms.get(m.destinationId) ?? 'Établissement supprimé' : '—'}</td><td><strong>{m.type === 'sortie' || m.type === 'transfert' ? '−' : m.quantite > 0 ? '+' : ''}{number(m.quantite)}</strong></td><td>{m.commentaire || '—'}</td><td><button className="stk-delete" type="button" aria-label="Supprimer le mouvement" title="Supprimer" onClick={() => supprimer(m)} disabled={m.id.startsWith('achat-reception-')}><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!visibles.length && <p className="stk-empty">Aucun mouvement à afficher.</p>}</div>
    </section>
  </main>
}
