import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Gift, HandCoins, ClipboardList, Plus, Search, Trash2, PackageCheck, Building2, Boxes, FileDown, CheckCircle2, Wallet, Truck, X, LayoutDashboard, History, ArrowRight, Info } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useUsers } from '../contexts/UsersContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useObData } from '../contexts/ObDataContext'
import './SuiviBrioches.css'
import { STOCK_CHANGED, stockKeyForCampaign, donsKeyForCampaign, stockFor, loadStockMovements, publishBriochesChange } from '../lib/briochesStock'
import { ETAB_COMMANDES_CHANGED, MODES_REGLEMENT_COMMANDES, centimes, commandeEtablissementKey, creerCommandeEtablissement, lireCommandesEtablissement, montantCommande, montantRegle, quantiteRemise, reglerCommandeEtablissement, remettreCommandeEtablissement, resteAregler, resteAremettre } from '../services/etablissementsCommandesStore'
import { exporterBonCommandeEtablissement } from '../services/etablissementsCommandesPdf'

type Don = {
  id: string
  donateur: string
  quantite: number
  montant: number
  mode: string
  date: string
  etablissementId?: string
  type?: 'avec' | 'sans'
}

type HistoriqueOperation = {
  id: string
  date: string
  categorie: 'don' | 'commande' | 'remise' | 'reglement'
  libelle: string
  demandeur: string
  reference: string
  brioches: number
  encaisse: number
  mode: string
  donId?: string
  commandeId?: string
}

const money = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)

function loadDons(campagne: string): Don[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(donsKeyForCampaign(campagne)) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((d): d is Don =>
      typeof d === 'object' && d !== null && typeof d.id === 'string' &&
      typeof d.donateur === 'string' && typeof d.quantite === 'number' &&
      typeof d.montant === 'number' && typeof d.mode === 'string' && typeof d.date === 'string' &&
      (d.etablissementId === undefined || typeof d.etablissementId === 'string') &&
      (d.type === undefined || d.type === 'avec' || d.type === 'sans'))
  } catch { return [] }
}

export default function SuiviBrioches() {
  const { currentUser } = useUsers()
  const { selectedCampagne, activeCampagne } = useObData()
  const campagneMeta = selectedCampagne ?? activeCampagne
  const campagne = campagneMeta?.id ?? 'OB 2026'
  const KEY = donsKeyForCampaign(campagne)
  const STOCK_KEY = stockKeyForCampaign(campagne)
  const { etablissements } = useEtablissements()
  const globalAccess = currentUser?.role === 'administrateur' || currentUser?.tousEtablissements === true
  const allowed = useMemo(() => {
    if (!currentUser || currentUser.status !== 'actif') return []
    const ids = currentUser.etablissementIds?.length ? currentUser.etablissementIds : (currentUser.etablissementId ? [currentUser.etablissementId] : [])
    return globalAccess ? etablissements : etablissements.filter(e => ids.includes(e.id))
  }, [currentUser, etablissements, globalAccess])

  // Les réceptions sont enregistrées par Stock Brioches : cette page les lit
  // uniquement. Ne jamais les recalculer ici (risque d'effacer les réceptions
  // d'autres catégories d'achats ou déjà rapprochées).
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('etablissement') ?? '')
  const effectiveId = allowed.some(e => e.id === selectedId) ? selectedId : (allowed[0]?.id || '')
  const [dons, setDons] = useState<Don[]>(() => loadDons(campagne))
  const [mouvements, setMouvements] = useState(() => loadStockMovements(campagne))
  useEffect(() => {
    const refresh = () => { setDons(loadDons(campagne)); setMouvements(loadStockMovements(campagne)) }
    refresh()
    const onStorage = (e: StorageEvent) => { if (e.key === STOCK_KEY || e.key === KEY) refresh() }
    window.addEventListener(STOCK_CHANGED, refresh)
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener(STOCK_CHANGED, refresh); window.removeEventListener('storage', onStorage) }
  }, [campagne, STOCK_KEY, KEY])
  const stockDisponible = effectiveId ? stockFor(effectiveId, mouvements, dons) : 0
  const briochesReceptionnees = mouvements.reduce((total, mouvement) =>
    total + (mouvement.etablissementId === effectiveId && mouvement.type === 'reception' ? mouvement.quantite : 0), 0)
  const number = (value: number) => new Intl.NumberFormat('fr-FR').format(value)
  const [typeDon, setTypeDon] = useState<'avec' | 'sans'>('avec')
  const [donateur, setDonateur] = useState('')
  const [quantite, setQuantite] = useState('1')
  const [montant, setMontant] = useState('6')
  const [mode, setMode] = useState('Espèces')
  const [recherche, setRecherche] = useState('')
  const [historiqueFiltre, setHistoriqueFiltre] = useState<'tous' | HistoriqueOperation['categorie']>('tous')
  const [section, setSection] = useState<'apercu' | 'don' | 'commandes' | 'historique'>('apercu')
  const [erreur, setErreur] = useState('')
  const [showLegacy, setShowLegacy] = useState(false)
  const [commandes, setCommandes] = useState(() => lireCommandesEtablissement(campagne))
  const [commandeTab, setCommandeTab] = useState<'bons' | 'encaisser' | 'payees'>('bons')
  const [nouvelleVisible, setNouvelleVisible] = useState(false)
  const [commandeDemandeur, setCommandeDemandeur] = useState('')
  const [commandeContact, setCommandeContact] = useState('')
  const [commandeQuantite, setCommandeQuantite] = useState('1')
  const [commandePrix, setCommandePrix] = useState('')
  const [commandeNote, setCommandeNote] = useState('')
  const [commandeRecherche, setCommandeRecherche] = useState('')
  const [commandeAction, setCommandeAction] = useState<{ type: 'remise' | 'reglement'; id: string } | null>(null)
  const [commandeActionValeur, setCommandeActionValeur] = useState('')
  const [commandeMode, setCommandeMode] = useState('Espèces')
  const [commandeDetailId, setCommandeDetailId] = useState<string | null>(null)
  const [commandeErreur, setCommandeErreur] = useState('')
  const [commandeSucces, setCommandeSucces] = useState('')
  useEffect(() => {
    const p = campagneMeta?.prixUnitaire
    setCommandePrix(typeof p === 'number' && Number.isFinite(p) && p > 0 ? String(p) : '')
    setNouvelleVisible(false)
    setCommandeAction(null)
  }, [campagne, campagneMeta?.prixUnitaire])
  useEffect(() => {
    const refresh = () => setCommandes(lireCommandesEtablissement(campagne))
    refresh()
    const key = commandeEtablissementKey(campagne)
    const onStorage = (e: StorageEvent) => { if (e.key === key) refresh() }
    window.addEventListener(ETAB_COMMANDES_CHANGED, refresh)
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener(ETAB_COMMANDES_CHANGED, refresh); window.removeEventListener('storage', onStorage) }
  }, [campagne])


  const scopedDons = useMemo(() => dons.filter(d => d.etablissementId === effectiveId), [dons, effectiveId])
  const legacyDons = useMemo(() => dons.filter(d => !d.etablissementId), [dons])
  const affiches = showLegacy && globalAccess ? legacyDons : scopedDons
  const sums = useMemo(() => affiches.reduce((a, d) => ({ brioches: a.brioches + (d.type === 'sans' ? 0 : d.quantite), montant: a.montant + d.montant }), { brioches: 0, montant: 0 }), [affiches])
  const save = (next: Don[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); setDons(next); publishBriochesChange(); setErreur('') }
    catch { setErreur("Impossible d'enregistrer les dons dans ce navigateur.") }
  }
  function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!effectiveId || !allowed.some(et => et.id === effectiveId)) { setErreur('Aucun établissement autorisé sélectionné.'); return }
    const q = typeDon === 'sans' ? 0 : Number(quantite)
    const m = Number(montant)
    if ((typeDon === 'avec' && (!Number.isInteger(q) || q < 1)) || !Number.isFinite(m) || m <= 0) {
      setErreur('Indiquez un montant positif et, si nécessaire, une quantité entière de brioches.'); return
    }
    if (typeDon === 'avec' && stockDisponible < q) { setErreur(`Stock insuffisant : ${stockDisponible} brioche(s) disponible(s) pour cet établissement.`); return }
    save([{ id: crypto.randomUUID(), etablissementId: effectiveId, type: typeDon, donateur: donateur.trim() || 'Donateur anonyme', quantite: q, montant: Math.round(m * 100) / 100, mode, date: new Date().toISOString() }, ...dons])
    setDonateur(''); setQuantite('1'); setMontant('6')
  }
  const commandesEtablissement = commandes.filter(c => c.etablissementId === effectiveId)
  const commandesFiltres = commandesEtablissement.filter(c => {
    const cible = `${c.numero} ${c.demandeur} ${c.contact}`.toLocaleLowerCase('fr-FR')
    return cible.includes(commandeRecherche.trim().toLocaleLowerCase('fr-FR')) &&
      (commandeTab === 'bons' || (commandeTab === 'encaisser' && resteAregler(c) > 0) || (commandeTab === 'payees' && resteAregler(c) === 0))
  })
  const commandesTotal = commandesEtablissement.reduce((n, c) => n + montantCommande(c), 0)
  const commandesEncaissees = commandesEtablissement.reduce((n, c) => n + montantRegle(c), 0)
  const afficherCentimes = (n: number) => money(n / 100)
  const dateFr = (value: string) => new Date(value).toLocaleDateString('fr-FR')
  const confirmerCommande = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setCommandeErreur(''); setCommandeSucces('')
    if (!effectiveId || showLegacy || !allowed.some(et => et.id === effectiveId)) return setCommandeErreur('Établissement non autorisé.')
    try {
      const c = creerCommandeEtablissement(campagne, {
        etablissementId: effectiveId, demandeur: commandeDemandeur, contact: commandeContact,
        quantite: Number(commandeQuantite), prixUnitaire: Number(commandePrix), commentaire: commandeNote
      })
      setCommandes(lireCommandesEtablissement(campagne))
      setCommandeDemandeur(''); setCommandeContact(''); setCommandeQuantite('1'); setCommandeNote('')
      setNouvelleVisible(false); setCommandeTab('bons'); setCommandeDetailId(c.id)
      setCommandeSucces(`Bon ${c.numero} enregistré. Vous pouvez l'exporter au format PDF. Le stock reste inchangé.`)
    } catch (error) { setCommandeErreur(error instanceof Error ? error.message : 'Impossible de créer le bon de commande.') }
  }
  const ouvrirActionCommande = (id: string, type: 'remise' | 'reglement') => {
    const c = commandesEtablissement.find(v => v.id === id)
    if (!c) return
    setCommandeErreur(''); setCommandeSucces('')
    setCommandeAction({ id, type }); setCommandeMode('Espèces')
    setCommandeActionValeur(type === 'remise' ? String(resteAremettre(c)) : String(resteAregler(c) / 100))
  }
  const confirmerActionCommande = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!commandeAction || !commandesEtablissement.some(c => c.id === commandeAction.id)) return
    setCommandeErreur(''); setCommandeSucces('')
    try {
      const c = commandeAction.type === 'remise'
        ? remettreCommandeEtablissement(campagne, commandeAction.id, Number(commandeActionValeur))
        : reglerCommandeEtablissement(campagne, commandeAction.id, centimes(Number(commandeActionValeur)), commandeMode)
      setCommandes(lireCommandesEtablissement(campagne))
      setCommandeSucces(commandeAction.type === 'remise'
        ? `Remise enregistrée sur ${c.numero}. Le stock de l'établissement a été diminué.`
        : `Règlement enregistré sur ${c.numero}. Le stock n'a pas changé.`)
      setCommandeAction(null); setCommandeDetailId(c.id)
    } catch (error) { setCommandeErreur(error instanceof Error ? error.message : 'Enregistrement impossible.') }
  }
  // Une chronologie unique : la création d'un bon et sa remise ne sont pas des encaissements.
  // Seuls les dons directs et les règlements des bons alimentent le total reçu.
  const operations = useMemo<HistoriqueOperation[]>(() => {
    const entries: HistoriqueOperation[] = affiches.map(d => ({
      id: `don:${d.id}`, date: d.date, categorie: 'don',
      libelle: d.type === 'sans' ? 'Don sans contrepartie' : 'Don avec contrepartie',
      demandeur: d.donateur, reference: 'Don direct',
      brioches: d.type === 'sans' ? 0 : d.quantite, encaisse: d.montant,
      mode: d.mode, donId: d.id
    }))
    if (!showLegacy) {
      for (const c of commandesEtablissement) {
        entries.push({ id: `commande:${c.id}`, date: c.date, categorie: 'commande',
          libelle: 'Bon de commande créé', demandeur: c.demandeur, reference: c.numero,
          brioches: 0, encaisse: 0, mode: '—', commandeId: c.id })
        for (const r of c.remises) entries.push({
          id: `remise:${c.id}:${r.id}`, date: r.date, categorie: 'remise',
          libelle: 'Brioches remises', demandeur: c.demandeur, reference: c.numero,
          brioches: r.quantite, encaisse: 0, mode: '—', commandeId: c.id
        })
        for (const r of c.reglements) entries.push({
          id: `reglement:${c.id}:${r.id}`, date: r.date, categorie: 'reglement',
          libelle: 'Règlement de commande', demandeur: c.demandeur, reference: c.numero,
          brioches: 0, encaisse: r.centimes / 100, mode: r.mode, commandeId: c.id
        })
      }
    }
    return entries.sort((a, b) => b.date.localeCompare(a.date))
  }, [affiches, commandesEtablissement, showLegacy])
  const visibleOperations = operations.filter(item => {
    if (historiqueFiltre !== 'tous' && item.categorie !== historiqueFiltre) return false
    const search = recherche.trim().toLocaleLowerCase('fr-FR')
    return !search || [item.libelle, item.demandeur, item.reference, item.mode, item.date, item.encaisse.toString()]
      .join(' ').toLocaleLowerCase('fr-FR').includes(search)
  })
  const commandesEnAttente = commandesEtablissement.filter(c => resteAregler(c) > 0).length
  const quantitesAremettre = commandesEtablissement.reduce((total, c) => total + resteAremettre(c), 0)
  const totalBriochesRemises = sums.brioches + (showLegacy ? 0 : commandesEtablissement.reduce((total, c) => total + quantiteRemise(c), 0))
  const totalEncaisse = sums.montant + (showLegacy ? 0 : commandesEncaissees / 100)
  const totalReste = showLegacy ? 0 : Math.max(0, commandesTotal - commandesEncaissees) / 100
  const ouvrirNouvelleCommande = () => {
    if (!effectiveId || showLegacy) return
    setSection('commandes')
    setNouvelleVisible(true)
    setCommandeErreur(''); setCommandeSucces(''); setCommandeAction(null)
  }
  useEffect(() => {
    if (!commandeAction) return
    const node = document.getElementById('sb-action-form')
    node?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [commandeAction])
  const title = allowed.find(e => e.id === effectiveId)?.nom

  return <main className="sb-page sb-redesigned">
    <PageHeader eyebrow="ÉTABLISSEMENTS / SUIVI BRIOCHES" title="Suivi Brioches" description="Dons, commandes et règlements : toutes les opérations de l’établissement au même endroit." illustration />
    <div className="sb-workspace-bar">
      <div className="sb-context-details"><strong>Campagne {campagneMeta?.nom || campagne}</strong><span>Les données sont séparées par campagne et par établissement.</span></div>
      <label className="sb-compact-selector" htmlFor="sb-etablissement"><Building2 size={17}/> Établissement
        <select id="sb-etablissement" value={effectiveId} onChange={e => { setSelectedId(e.target.value); setShowLegacy(false); setErreur(''); setCommandeErreur(''); setCommandeSucces(''); setCommandeAction(null); setCommandeDetailId(null) }} disabled={!allowed.length}>
          {!allowed.length && <option value="">Aucun établissement autorisé</option>}
          {allowed.map(et => <option key={et.id} value={et.id}>{et.nom}</option>)}
        </select>
      </label>
      <span className="sb-demo-pill" title="Les opérations de cette démonstration sont enregistrées dans le navigateur uniquement."><Info size={14}/> Démo locale</span>
    </div>
    {globalAccess && legacyDons.length > 0 && <div className="sb-legacy-notice">
      {legacyDons.length} ancien(s) don(s) non attribué(s).
      <button type="button" onClick={() => { setShowLegacy(v => !v); setSection('historique') }}>{showLegacy ? `Revenir à ${title || 'l’établissement'}` : 'Afficher les dons non attribués'}</button>
    </div>}
    <section className="sb-kpis" aria-label="Indicateurs de l’établissement">
      <article className="sb-kpi"><span className="sb-kpi-icon sb-blue"><Boxes size={21}/></span><div><span>Stock disponible</span><strong>{number(stockDisponible)}</strong><small>{number(briochesReceptionnees)} brioches réceptionnées</small></div></article>
      <article className="sb-kpi"><span className="sb-kpi-icon sb-orange"><Gift size={21}/></span><div><span>Brioches remises</span><strong>{number(totalBriochesRemises)}</strong><small>Dons directs et commandes</small></div></article>
      <article className="sb-kpi"><span className="sb-kpi-icon sb-green"><HandCoins size={21}/></span><div><span>Total encaissé</span><strong>{money(totalEncaisse)}</strong><small>Dons + règlements reçus</small></div></article>
      <article className="sb-kpi"><span className="sb-kpi-icon sb-amber"><Wallet size={21}/></span><div><span>Reste à encaisser</span><strong>{money(totalReste)}</strong><small>Sur les bons de commande</small></div></article>
    </section>

    <nav className="sb-main-tabs" role="tablist" aria-label="Sections du suivi des brioches">
      <button type="button" role="tab" aria-selected={section === 'apercu'} className={section === 'apercu' ? 'active' : ''} onClick={() => setSection('apercu')}><LayoutDashboard size={17}/> Vue d’ensemble</button>
      <button type="button" role="tab" aria-selected={section === 'don'} className={section === 'don' ? 'active' : ''} onClick={() => setSection('don')}><Gift size={17}/> Don direct</button>
      <button type="button" role="tab" aria-selected={section === 'commandes'} className={section === 'commandes' ? 'active' : ''} onClick={() => setSection('commandes')}><ClipboardList size={17}/> Bons de commande</button>
      <button type="button" role="tab" aria-selected={section === 'historique'} className={section === 'historique' ? 'active' : ''} onClick={() => setSection('historique')}><History size={17}/> Historique</button>
    </nav>

    {section === 'apercu' && <div role="tabpanel" className="sb-overview">
      <div className="sb-overview-intro"><div><h2>Que souhaitez-vous faire ?</h2><p>Choisissez votre opération, sans passer par un long formulaire.</p></div></div>
      <div className="sb-action-cards">
        <button type="button" className="sb-action-card" disabled={!effectiveId || showLegacy} onClick={() => setSection('don')}>
          <span className="sb-action-symbol orange"><Gift size={25}/></span><span className="sb-action-copy"><strong>Enregistrer un don direct</strong><small>Don immédiat, avec ou sans remise de brioches.</small></span><ArrowRight size={20}/>
        </button>
        <button type="button" className="sb-action-card" disabled={!effectiveId || showLegacy} onClick={ouvrirNouvelleCommande}>
          <span className="sb-action-symbol blue"><ClipboardList size={25}/></span><span className="sb-action-copy"><strong>Créer un bon de commande</strong><small>Préparer une commande et suivre son règlement.</small></span><ArrowRight size={20}/>
        </button>
      </div>
      <div className="sb-overview-columns">
        <section className="sb-panel sb-follow-up">
          <div className="sb-mini-header"><h2><Wallet size={19}/> À suivre</h2><button type="button" className="sb-text-link" onClick={() => setSection('commandes')}>Voir les bons <ArrowRight size={15}/></button></div>
          <button type="button" className="sb-follow-line" onClick={() => { setCommandeTab('encaisser'); setSection('commandes') }}><span>Commandes en attente de paiement</span><strong>{showLegacy ? 0 : commandesEnAttente}</strong><ArrowRight size={16}/></button>
          <button type="button" className="sb-follow-line" onClick={() => { setCommandeTab('bons'); setSection('commandes') }}><span>Brioches encore à remettre</span><strong>{showLegacy ? 0 : number(quantitesAremettre)}</strong><ArrowRight size={16}/></button>
          <div className="sb-mini-help">Un bon peut être payé avant la remise des brioches, ou remis avant le paiement.</div>
        </section>
        <section className="sb-panel sb-recent-activity">
          <div className="sb-mini-header"><h2><History size={19}/> Dernières opérations</h2><button type="button" className="sb-text-link" onClick={() => setSection('historique')}>Tout voir <ArrowRight size={15}/></button></div>
          {operations.length === 0 ? <p className="sb-empty">Aucune opération enregistrée pour le moment.</p> : <ul className="sb-recent-list">{operations.slice(0, 5).map(op => <li key={op.id}><span className={'sb-tiny-dot ' + op.categorie}/><span><strong>{op.libelle}</strong><small>{op.demandeur} · {new Date(op.date).toLocaleDateString('fr-FR')}</small></span><em>{op.encaisse > 0 ? money(op.encaisse) : op.brioches > 0 ? `${op.brioches} brioche(s)` : '—'}</em></li>)}</ul>}
        </section>
      </div>
      <div className="sb-explainer"><strong>Comment ça marche ?</strong><span><b>1.</b> Création du bon</span><span><b>2.</b> Remise = sortie de stock</span><span><b>3.</b> Règlement = encaissement</span></div>
    </div>}
    {section === 'don' && <div role="tabpanel" className="sb-don-view">
      <div className="sb-view-header"><div><h2>Don direct</h2><p>À utiliser lorsqu’un don est encaissé immédiatement, avec ou sans remise de brioche.</p></div></div>
      <div className="sb-columns">
      <section className="sb-panel sb-donation-form"><h2><Plus size={20}/> Enregistrer un don immédiat</h2><p className="sb-section-note">Le don et son règlement sont enregistrés ensemble. Si des brioches sont remises, le stock diminue immédiatement.</p>
        <form className="sb-form" onSubmit={enregistrer}>
          <fieldset className="sb-types"><legend>Type de don</legend>
            <label><input type="radio" name="type-don" checked={typeDon === 'avec'} onChange={() => setTypeDon('avec')}/> Avec contrepartie</label>
            <label><input type="radio" name="type-don" checked={typeDon === 'sans'} onChange={() => setTypeDon('sans')}/> Sans contrepartie</label>
          </fieldset>
          <label>Donateur (facultatif)<input value={donateur} onChange={e => setDonateur(e.target.value)} placeholder="Donateur anonyme" maxLength={120}/></label>
          <div className="sb-field-grid">
            {typeDon === 'avec' && <label>Nombre de brioches remises<input type="number" min="1" step="1" required value={quantite} onChange={e => setQuantite(e.target.value)}/></label>}
            <label>Montant du don (€)<input type="number" min="0.01" step="0.01" required value={montant} onChange={e => setMontant(e.target.value)}/></label>
          </div>
          {typeDon === 'avec' && <p className="sb-help">Stock disponible pour cet établissement : <strong>{stockDisponible}</strong> brioche(s).</p>}
          {typeDon === 'sans' && <p className="sb-help">Aucune brioche n'est remise : la quantité enregistrée est de 0.</p>}
          <label>Mode de règlement<select value={mode} onChange={e => setMode(e.target.value)}><option>Espèces</option><option>Carte bancaire</option><option>Chèque</option><option>Virement</option><option>Autre</option></select></label>
          {erreur && <p className="sb-error" role="alert">{erreur}</p>}
          <button className="sb-primary" type="submit" disabled={!effectiveId || showLegacy}><Plus size={18}/> Enregistrer le don</button>
        </form>
      </section>
      <section className="sb-panel sb-donation-summary"><h2><PackageCheck size={20}/> Résumé des dons directs</h2><p className="sb-section-note">Ce récapitulatif ne comprend pas les règlements des bons de commande.</p><dl className="sb-summary">
        <div><dt>Brioches remises</dt><dd>{sums.brioches}</dd></div><div><dt>Montant total des dons</dt><dd>{money(sums.montant)}</dd></div><div><dt>Montant moyen par don</dt><dd>{money(affiches.length ? sums.montant / affiches.length : 0)}</dd></div><div><dt>Dernier enregistrement</dt><dd>{affiches.length ? new Date([...affiches].sort((a,b) => b.date.localeCompare(a.date))[0].date).toLocaleString('fr-FR') : 'Aucun don'}</dd></div>
      </dl></section>

      </div>
      <div className="sb-inline-note"><Info size={17}/> Pour une commande à régler plus tard, utilisez « Bons de commande » : le paiement ne doit jamais être ressaisi ici.</div>
    </div>}
    {section === 'commandes' && <div role="tabpanel" className="sb-commandes-view">
    <section className="sb-panel sb-orders" aria-label="Bons de commande des établissements">
      <div className="sb-orders-head">
        <div><h2><ClipboardList size={20}/> Bons de commande</h2>
          <p>Créez un bon, remettez les brioches et enregistrez les règlements. Chaque étape reste traçable.</p>
        </div>
        <button type="button" className="sb-primary sb-order-create" disabled={!effectiveId || showLegacy} onClick={() => { setNouvelleVisible(value => !value); setCommandeErreur(''); setCommandeSucces(''); setCommandeAction(null) }}><Plus size={18}/> Nouveau bon de commande</button>
      </div>
      <div className="sb-order-stats">
        <div><span>Bons enregistrés</span><strong>{commandesEtablissement.length}</strong></div>
        <div><span>Montant commandé</span><strong>{afficherCentimes(commandesTotal)}</strong></div>
        <div><span>Règlements reçus</span><strong>{afficherCentimes(commandesEncaissees)}</strong></div>
        <div><span>Reste à encaisser</span><strong>{afficherCentimes(commandesTotal - commandesEncaissees)}</strong></div>
      </div>
      {commandeSucces && <p role="status" className="sb-order-success"><CheckCircle2 size={17}/>{commandeSucces}</p>}
      {commandeErreur && <p role="alert" className="sb-error sb-order-error">{commandeErreur}</p>}
      {nouvelleVisible && <form className="sb-order-form" onSubmit={confirmerCommande}>
        <div className="sb-order-form-head"><strong>Créer un bon de commande</strong><button type="button" aria-label="Fermer le formulaire" className="sb-order-icon" onClick={() => setNouvelleVisible(false)}><X size={18}/></button></div>
        <div className="sb-order-fields">
          <label>Nom du demandeur *<input required maxLength={120} placeholder="Ex. Famille Martin, service animation…" value={commandeDemandeur} onChange={e => setCommandeDemandeur(e.target.value)}/></label>
          <label>Contact (facultatif)<input maxLength={120} placeholder="Téléphone ou adresse e-mail" value={commandeContact} onChange={e => setCommandeContact(e.target.value)}/></label>
          <label>Nombre de brioches *<input type="number" min="1" step="1" required value={commandeQuantite} onChange={e => setCommandeQuantite(e.target.value)}/></label>
          <label>Contribution prévue par brioche (€) *<input type="number" min="0.01" step="0.01" required placeholder="Prix unitaire" value={commandePrix} onChange={e => setCommandePrix(e.target.value)}/></label>
          <label className="sb-order-wide">Remarques (facultatif)<input maxLength={500} placeholder="Ex. Remise prévue vendredi à l'accueil" value={commandeNote} onChange={e => setCommandeNote(e.target.value)}/></label>
        </div>
        <p className="sb-order-total">Montant prévu : <strong>{Number(commandeQuantite) > 0 && Number(commandePrix) > 0 ? money(Number(commandeQuantite) * Number(commandePrix)) : 'À compléter'}</strong></p>
        <div className="sb-order-footer"><small>La création du bon ne retire aucune brioche du stock. Le prix est proposé depuis la campagne lorsqu'il est renseigné.</small><button className="sb-primary" type="submit"><ClipboardList size={17}/> Créer le bon</button></div>
      </form>}
      {commandeAction && (() => {
        const c = commandesEtablissement.find(x => x.id === commandeAction.id)
        if (!c) return null
        return <form id="sb-action-form" className="sb-order-action-form" onSubmit={confirmerActionCommande}>
          <div className="sb-order-form-head"><strong>{commandeAction.type === 'remise' ? 'Remettre des brioches' : 'Enregistrer un règlement'} — {c.numero}</strong><button type="button" aria-label="Annuler l'action" className="sb-order-icon" onClick={() => { setCommandeAction(null); setCommandeErreur('') }}><X size={18}/></button></div>
          <p>{c.demandeur} · {commandeAction.type === 'remise' ? `${resteAremettre(c)} brioche(s) à remettre · stock : ${stockDisponible}` : `Reste à régler : ${afficherCentimes(resteAregler(c))}`}</p>
          <div className="sb-order-action-controls">
            <label>{commandeAction.type === 'remise' ? 'Quantité réellement remise' : 'Montant encaissé (€)'}<input required type="number" step={commandeAction.type === 'remise' ? '1' : '0.01'} min={commandeAction.type === 'remise' ? '1' : '0.01'} max={commandeAction.type === 'remise' ? Math.min(stockDisponible, resteAremettre(c)) : resteAregler(c) / 100} value={commandeActionValeur} onChange={e => setCommandeActionValeur(e.target.value)}/></label>
            {commandeAction.type === 'reglement' && <label>Mode de règlement<select value={commandeMode} onChange={e => setCommandeMode(e.target.value)}>{MODES_REGLEMENT_COMMANDES.map(m => <option key={m}>{m}</option>)}</select></label>}
            <button type="submit" className="sb-primary">Valider {commandeAction.type === 'remise' ? 'la remise' : 'le règlement'}</button>
          </div>
        </form>
      })()}
      {commandeDetailId && (() => {
        const c = commandesEtablissement.find(x => x.id === commandeDetailId)
        if (!c) return null
        const elements = [
          { id: c.id, date: c.date, texte: `Commande créée : ${c.quantite} brioche(s)` },
          ...c.remises.map(r => ({ id: r.id, date: r.date, texte: `Remise : ${r.quantite} brioche(s)` })),
          ...c.reglements.map(r => ({ id: r.id, date: r.date, texte: `Règlement : ${afficherCentimes(r.centimes)} (${r.mode})` }))
        ].sort((a, b) => a.date.localeCompare(b.date))
        return <div className="sb-order-details"><strong>Historique du bon {c.numero}</strong>{c.commentaire && <p>Remarques : {c.commentaire}</p>}<ul>{elements.map(el => <li key={el.id}>{new Date(el.date).toLocaleString('fr-FR')} — {el.texte}</li>)}</ul></div>
      })()}
      <div className="sb-order-toolbar">
        <div className="sb-order-tabs" role="group" aria-label="Vue des commandes">
          <button type="button" className={commandeTab === 'bons' ? 'selected' : ''} onClick={() => setCommandeTab('bons')}>Tous les bons</button>
          <button type="button" className={commandeTab === 'encaisser' ? 'selected' : ''} onClick={() => setCommandeTab('encaisser')}>À encaisser</button>
          <button type="button" className={commandeTab === 'payees' ? 'selected' : ''} onClick={() => setCommandeTab('payees')}>Commandes payées</button>
        </div>
        <label className="sb-search"><Search size={17}/><input aria-label="Rechercher un bon" placeholder="Numéro, demandeur…" value={commandeRecherche} onChange={e => setCommandeRecherche(e.target.value)}/></label>
      </div>
      <div className="sb-table-scroll sb-orders-table"><table><thead><tr><th>Bon</th><th>Demandeur</th><th>Commandé</th><th>Remis</th><th>Montant</th><th>Réglé</th><th>Reste dû</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
        {commandesFiltres.map(c => <tr key={c.id}>
          <td><strong>{c.numero}</strong><small>{dateFr(c.date)}</small></td>
          <td>{c.demandeur}{c.contact && <small>{c.contact}</small>}</td>
          <td>{c.quantite}</td><td>{quantiteRemise(c)} / {c.quantite}</td>
          <td>{afficherCentimes(montantCommande(c))}</td><td>{afficherCentimes(montantRegle(c))}</td>
          <td><strong>{afficherCentimes(resteAregler(c))}</strong></td>
          <td><div className="sb-order-status"><span className={resteAremettre(c) === 0 ? 'done' : 'pending'}>{resteAremettre(c) === 0 ? 'Remise complète' : quantiteRemise(c) > 0 ? 'Remise partielle' : 'À remettre'}</span><span className={resteAregler(c) === 0 ? 'done' : 'pending'}>{resteAregler(c) === 0 ? 'Réglée' : montantRegle(c) > 0 ? 'Règlement partiel' : 'À encaisser'}</span></div></td>
          <td><div className="sb-order-actions">
            <button type="button" title="Exporter le bon PDF" onClick={() => exporterBonCommandeEtablissement(c, title || 'Établissement', campagneMeta?.nom || campagne)}><FileDown size={15}/> PDF</button>
            {resteAremettre(c) > 0 && <button type="button" title="Enregistrer une remise de brioches" disabled={showLegacy} onClick={() => ouvrirActionCommande(c.id, 'remise')}><Truck size={15}/> Remettre</button>}
            {resteAregler(c) > 0 && <button type="button" title="Enregistrer un règlement" disabled={showLegacy} onClick={() => ouvrirActionCommande(c.id, 'reglement')}><Wallet size={15}/> Régler</button>}
            <button type="button" onClick={() => setCommandeDetailId(v => v === c.id ? null : c.id)}>{commandeDetailId === c.id ? 'Masquer' : 'Détails'}</button>
          </div></td>
        </tr>)}
      </tbody></table>{commandesFiltres.length === 0 && <p className="sb-empty">Aucun bon de commande pour cette sélection.</p>}</div>
      <p className="sb-order-hint">Un bon payé peut encore être en attente de remise. Le règlement d'une commande ne doit pas être ressaisi dans « Enregistrer un don ».</p>
    </section>

    </div>}
    {section === 'historique' && <section role="tabpanel" className="sb-panel sb-history">
      <div className="sb-history-head">
        <div><h2><History size={20}/> Historique des opérations {showLegacy ? 'non attribuées' : `— ${title || 'Établissement'}`}</h2>
          <p className="sb-section-note">Dons directs, bons créés, remises et règlements. Les montants encaissés ne comptent jamais deux fois.</p>
        </div>
      </div>
      <div className="sb-history-toolbar">
        <label className="sb-search"><Search size={17}/><input aria-label="Rechercher dans l’historique" placeholder="Rechercher un nom, un bon, un règlement…" value={recherche} onChange={e => setRecherche(e.target.value)}/></label>
        <label className="sb-filter-label">Type d’opération <select aria-label="Filtrer l’historique par type" value={historiqueFiltre} onChange={e => setHistoriqueFiltre(e.target.value as typeof historiqueFiltre)}>
          <option value="tous">Toutes les opérations</option><option value="don">Dons directs</option><option value="commande">Bons créés</option><option value="remise">Remises</option><option value="reglement">Règlements</option>
        </select></label>
      </div>
      <div className="sb-history-summary"><span>{visibleOperations.length} opération(s) affichée(s)</span><strong>Encaissé sur cette sélection : {money(visibleOperations.reduce((n, op) => n + op.encaisse, 0))}</strong></div>
      <div className="sb-table-scroll sb-unified-history"><table><thead><tr><th>Date / heure</th><th>Opération</th><th>Demandeur</th><th>Brioches sorties</th><th>Montant encaissé</th><th>Mode</th><th>Actions</th></tr></thead><tbody>
        {visibleOperations.map(op => <tr key={op.id}>
          <td className="sb-history-date">{new Date(op.date).toLocaleString('fr-FR')}</td>
          <td><span className={'sb-operation-badge ' + op.categorie}>{op.libelle}</span><small className="sb-event-reference">{op.reference}</small></td>
          <td>{op.demandeur}</td><td>{op.brioches > 0 ? op.brioches : '—'}</td>
          <td className={op.encaisse > 0 ? 'sb-amount-positive' : 'sb-amount-zero'}>{op.encaisse > 0 ? money(op.encaisse) : '—'}</td>
          <td>{op.mode}</td>
          <td>{op.donId ? <button type="button" className="sb-delete" aria-label={`Supprimer le don de ${op.demandeur}`} title="Supprimer ce don (mode démo)" onClick={() => { if (window.confirm('Supprimer cet enregistrement de démonstration ?')) save(dons.filter(item => item.id !== op.donId)) }}><Trash2 size={16}/></button> : op.commandeId && <button type="button" className="sb-order-jump" onClick={() => { setCommandeDetailId(op.commandeId || null); setCommandeTab('bons'); setSection('commandes') }}>Voir le bon <ArrowRight size={14}/></button>}</td>
        </tr>)}
      </tbody></table>{visibleOperations.length === 0 && <p className="sb-empty">Aucune opération à afficher pour les filtres sélectionnés.</p>}</div>
      <p className="sb-order-hint">Créer un bon ou remettre une brioche ne constitue pas un encaissement. Seuls les dons directs et les règlements réellement reçus apparaissent comme montants encaissés.</p>
    </section>}
  </main>
}
