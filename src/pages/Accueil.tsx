import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, Building2, Euro, FileText, Package, Plus, RotateCcw, ShoppingCart, SlidersHorizontal, TrendingUp, Truck, Users, Wallet, X, Zap, Database, Landmark, GripVertical, ArrowLeft, ArrowRight, Handshake, Gift, Receipt, ClipboardList, CircleAlert, Banknote, BellRing, BadgeCheck, BadgeEuro } from 'lucide-react'
import { useUsers } from '../contexts/UsersContext'
import { useObData } from '../contexts/ObDataContext'
import { useArtisans } from '../contexts/ArtisansContext'
import { useMairies } from '../contexts/MairiesContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useJustificatifs } from '../contexts/JustificatifsContext'
import { calculerCoffre } from '../services/coffre'
import { purchaseSummary, invoiceSummary, financeSummary, readDashboardInvoices, readDashboardPayments } from '../lib/dashboardMetrics'
import { readFinanceRows } from '../lib/financeRegister'
import { useCommandesMairiesRs } from '../contexts/CommandesMairiesRsContext'
import { readUserAlerts, ALERTS_EVENT } from '../services/userAlerts'
import { useAccess } from '../lib/useAccess'
import { readActivityLog, ACTIVITY_EVENT_NAME, type ActivityEntry } from '../services/activityLog'
import './Accueil.css'
import './AccueilMove.css'

type WidgetId = 'commandes' | 'encaissements' | 'livraisons' | 'alertes' | 'activite' | 'raccourcis' | 'avancement' | 'documents' | 'donateurs' | 'fiches' | 'campagne' | 'brioches' | 'mairies' | 'benevoles' | 'coffre' | 'etablissements' | 'mairiesrs' | 'achatsmontant' | 'factures' | 'resteapayer' | 'mecenatfinancier' | 'mecenatnature' | 'ecarts' | 'justificatifsattente' | 'remises' | 'mesalertes'
type WidgetSize = { width: number; height: number }
type WidgetSizes = Partial<Record<WidgetId, WidgetSize>>
const SIZE_STORAGE_PREFIX = 'operation-brioches-accueil-widget-sizes-v1:'
const clamp = (v:number,min:number,max:number) => Math.max(min,Math.min(max,Math.round(v)))
type WidgetDefinition = { id: WidgetId; label: string; description: string; route?: string; large?: boolean }
const STORAGE_PREFIX = 'operation-brioches-accueil-widgets-v2:'
const DEFAULT_WIDGETS: WidgetId[] = ['commandes','encaissements','livraisons','alertes','activite','raccourcis','avancement','documents']
const WIDGETS: WidgetDefinition[] = [
  { id:'commandes', label:'Commandes à traiter',description:'Commandes à traiter',route:'/commandes' },
  { id:'encaissements',label:'Encaissements',description:'Fiches de caisse à contrôler',route:'/encaissements/fiches-caisse' },
  { id:'livraisons',label:'Livraisons à prévoir',description:'Commandes à livrer',route:'/commandes/livraisons-retraits' },
  { id:'alertes',label:'Alertes',description:'Anomalies et tâches en attente',route:'/encaissements/fiches-caisse' },
  { id:'activite',label:'Activité récente',description:'Journal réel des actions',route:'/administration/journal',large:true },
  { id:'raccourcis',label:'Mes raccourcis',description:'Accès rapides selon les droits',large:true },
  { id:'avancement',label:'Avancement global',description:'Objectif de la campagne',route:'/administration/campagnes',large:true },
  { id:'documents',label:'Documents',description:'Accès aux justificatifs',route:'/finance/justificatifs-dons',large:true },
  { id:'donateurs',label:'Donateurs',description:'Fiches donateurs',route:'/bdd/donateurs' },
  { id:'fiches',label:'Fiches de caisse',description:'Total des fiches',route:'/encaissements/fiches-caisse' },
  { id:'campagne',label:'Campagne active',description:'Campagne en cours',route:'/administration/campagnes' },
  { id:'brioches',label:'Brioches commandées',description:'Quantités de la campagne',route:'/commandes-achats/suivi-global' },
  { id:'mairies',label:'BDD Mairies',description:'Accéder à la base des mairies',route:'/bdd/mairies' },
  { id:'benevoles',label:'BDD Bénévoles',description:'Accéder aux bénévoles',route:'/bdd/benevoles' },
  { id:'coffre',label:'Coffre',description:'Accéder au coffre',route:'/encaissements/coffre' },
  { id:'etablissements',label:'Établissements',description:'Accéder aux établissements',route:'/administration/etablissements' },
  { id:'mairiesrs', label:'Commandes Mairies / RS', description:'Commandes de la campagne', route:'/commandes/mairies-rs' },
  { id:'achatsmontant', label:'Achats fournisseurs', description:'Budget estimatif TTC', route:'/commandes-achats/suivi-global' },
  { id:'factures', label:'Factures fournisseurs', description:'Factures enregistrées', route:'/finance/factures-paiements' },
  { id:'resteapayer', label:'Reste à payer', description:'Factures non soldées', route:'/finance/factures-paiements' },
  { id:'mecenatfinancier', label:'Mécénat financier', description:'Contributions de la campagne', route:'/finance/mecenat' },
  { id:'mecenatnature', label:'Mécénat non financier', description:'Nature et compétences valorisées', route:'/finance/mecenat' },
  { id:'ecarts', label:'Pertes et écarts', description:'Écarts restant à traiter', route:'/finance/pertes-ecarts' },
  { id:'justificatifsattente', label:'Justificatifs à traiter', description:'Documents à vérifier ou générer', route:'/finance/justificatifs-dons' },
  { id:'remises', label:'Remises en banque', description:'Dépôts enregistrés', route:'/encaissements/suivi-banque' },
  { id:'mesalertes', label:'Mes alertes', description:'Alertes qui me sont attribuées', route:'/mes-alertes' },

]
const number = (v:number) => v.toLocaleString('fr-FR')
const money = (v:number) => v.toLocaleString('fr-FR', {style:'currency', currency:'EUR'})

/** Les bénévoles sont actuellement gérés par le module BDD dans localStorage. */
function lireBenevolesAccueil(): Array<{id:string;statut?:string}> {
  try {
    const data: unknown = JSON.parse(localStorage.getItem('ob-bdd-benevoles-v1') || '[]')
    if (!Array.isArray(data)) return []
    return data.filter((item): item is {id:string;statut?:string} =>
      Boolean(item && typeof item === 'object' && typeof item.id === 'string'))
  } catch { return [] }
}
const icons: Record<WidgetId, ReactNode> = { commandes:<ShoppingCart/>, encaissements:<Euro/>, livraisons:<Truck/>, alertes:<AlertTriangle/>, activite:<Activity/>, raccourcis:<Zap/>, avancement:<TrendingUp/>, documents:<FileText/>, donateurs:<Users/>, fiches:<FileText/>, campagne:<Activity/>, brioches:<Package/>, mairies:<Landmark/>, benevoles:<Users/>, coffre:<Wallet/>, etablissements:<Building2/>, mairiesrs:<ClipboardList/>, achatsmontant:<Receipt/>, factures:<FileText/>, resteapayer:<BadgeEuro/>, mecenatfinancier:<Handshake/>, mecenatnature:<Gift/>, ecarts:<CircleAlert/>, justificatifsattente:<BadgeCheck/>, remises:<Banknote/>, mesalertes:<BellRing/> }

// La personnalisation est initialisée depuis le stockage : pas de rendu
// intermédiaire avec les paramètres d'un autre utilisateur.
function readVisibleWidgets(storageKey: string): WidgetId[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored !== null) {
      const parsed: unknown = JSON.parse(stored)
      return Array.isArray(parsed)
        ? Array.from(new Set(parsed.filter((id): id is WidgetId => typeof id === 'string' && WIDGETS.some(w => w.id === id))))
        : DEFAULT_WIDGETS
    }
    const legacy = localStorage.getItem('operation-brioches-accueil-widgets')
    if (!legacy) return DEFAULT_WIDGETS
    const parsed: unknown = JSON.parse(legacy)
    return Array.isArray(parsed)
      ? parsed.filter((id): id is WidgetId => typeof id === 'string' && WIDGETS.some(w => w.id === id))
      : DEFAULT_WIDGETS
  } catch {
    return DEFAULT_WIDGETS
  }
}

function readWidgetSizes(storageKey: string): WidgetSizes {
  try {
    const raw = localStorage.getItem(SIZE_STORAGE_PREFIX + storageKey)
    const saved: unknown = raw ? JSON.parse(raw) : {}
    const valid: WidgetSizes = {}
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const widget of WIDGETS) {
        const size = (saved as Record<string, unknown>)[widget.id]
        if (size && typeof size === 'object' && !Array.isArray(size)) {
          const value = size as Record<string, unknown>
          if (typeof value.width === 'number' && Number.isFinite(value.width) && typeof value.height === 'number' && Number.isFinite(value.height)) {
            valid[widget.id] = { width: clamp(value.width, 1, 8), height: clamp(value.height, 1, 3) }
          }
        }
      }
    }
    return valid
  } catch {
    return {}
  }
}

function Accueil() {
  const { currentUser } = useUsers()
  const storageKey = STORAGE_PREFIX + (currentUser?.id || 'anonymous')
  return <AccueilPersonnalise key={storageKey} storageKey={storageKey} />
}

function AccueilPersonnalise({ storageKey }: { storageKey: string }) {
  const { currentUser } = useUsers()
  const { canVisit } = useAccess()
  const { commandes, fichesCaisse, donateurs, depotsBanque, activeCampagne, selectedCampagne } = useObData()
  const { mairies } = useMairies()
  const { etablissements } = useEtablissements()
  const { justificatifs } = useJustificatifs()
  const [benevoles, setBenevoles] = useState(lireBenevolesAccueil)
  useEffect(() => {
    const refresh = () => setBenevoles(lireBenevolesAccueil())
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => { window.removeEventListener('storage', refresh); window.removeEventListener('focus', refresh) }
  }, [])
  const { commandesArtisans } = useArtisans()
  const { commandes: commandesMairiesRs } = useCommandesMairiesRs()
  // Ces registres locaux sont rechargés au retour sur la page : pas d'événement métier universel.
  const [registers, setRegisters] = useState(() => ({
    mecenat: readFinanceRows('mecenat'),
    ecarts: readFinanceRows('ecarts'),
    factures: readDashboardInvoices(),
    reglements: readDashboardPayments(),
    alertes: readUserAlerts(),
  }))
  useEffect(() => {
    const refresh = () => setRegisters({
      mecenat: readFinanceRows('mecenat'),
      ecarts: readFinanceRows('ecarts'),
      factures: readDashboardInvoices(),
      reglements: readDashboardPayments(),
      alertes: readUserAlerts(),
    })
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener(ALERTS_EVENT, refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener(ALERTS_EVENT, refresh)
    }
  }, [])
  const campagneCourante = selectedCampagne ?? activeCampagne
  const [customizing, setCustomizing] = useState(false)
  const [visible, setVisible] = useState<WidgetId[]>(() => readVisibleWidgets(storageKey))
  const [widgetSizes, setWidgetSizes] = useState<WidgetSizes>(() => readWidgetSizes(storageKey))
  const [activity, setActivity] = useState<ActivityEntry[]>(readActivityLog)

  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(visible)) }
    catch { /* stockage indisponible */ }
  }, [visible, storageKey])

  useEffect(() => {
    try { localStorage.setItem(SIZE_STORAGE_PREFIX + storageKey, JSON.stringify(widgetSizes)) }
    catch { /* stockage indisponible */ }
  }, [widgetSizes, storageKey])
  const getWidgetSize = (w:WidgetDefinition):WidgetSize => widgetSizes[w.id] ?? {width:w.large?4:2,height:2}
  // Redimensionnement à la souris / au doigt, calé sur la grille CSS réelle.
  const gridRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<null | {id:WidgetId; axis:'width'|'height'|'both'; x:number; y:number; width:number; height:number; stepX:number; stepY:number; columns:number}>(null)
  const [resizing,setResizing] = useState<WidgetId|null>(null)
  const moveRef = useRef<null | { id: WidgetId; pointerId: number }>(null)
  const [moving, setMoving] = useState<WidgetId | null>(null)
  const [dropTarget, setDropTarget] = useState<WidgetId | null>(null)
  const reorder = (source: WidgetId, target: WidgetId) => {
    if (source === target) return
    setVisible(current => {
      const next = [...current]
      const from = next.indexOf(source)
      const to = next.indexOf(target)
      if (from < 0 || to < 0) return current
      next.splice(from, 1)
      next.splice(to, 0, source)
      return next
    })
  }
  const stepWidget = (id: WidgetId, direction: -1 | 1) => {
    const list = visible.filter(widgetId => available.some(w => w.id === widgetId))
    const currentIndex = list.indexOf(id)
    const other = list[currentIndex + direction]
    if (other) reorder(id, other)
  }
  const getDropWidget = (x: number, y: number): WidgetId | null => {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-widget-id]')
    const id = element?.dataset.widgetId
    return id && WIDGETS.some(w => w.id === id) ? id as WidgetId : null
  }
  const onMoveStart = (event: ReactPointerEvent<HTMLButtonElement>, id: WidgetId) => {
    if (!customizing || resizing) return
    event.preventDefault()
    event.stopPropagation()
    moveRef.current = { id, pointerId: event.pointerId }
    setMoving(id)
    setDropTarget(null)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onMoveOver = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!moveRef.current || moveRef.current.pointerId !== event.pointerId) return
    const id = getDropWidget(event.clientX, event.clientY)
    setDropTarget(id && id !== moveRef.current.id ? id : null)
  }
  const onMoveEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = moveRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const id = getDropWidget(event.clientX, event.clientY)
    if (id && id !== drag.id) reorder(drag.id, id)
    moveRef.current = null
    setMoving(null)
    setDropTarget(null)
  }
  const onMoveCancel = () => {
    moveRef.current = null
    setMoving(null)
    setDropTarget(null)
  }
  const onResizeStart = (event:ReactPointerEvent<HTMLButtonElement>, w:WidgetDefinition, axis:'width'|'height'|'both') => {
    if (!customizing || !gridRef.current) return
    event.preventDefault()
    event.stopPropagation()
    const grid = gridRef.current
    const styles = getComputedStyle(grid)
    const columns = styles.gridTemplateColumns.split(' ').filter(Boolean).length || 8
    const gapX = parseFloat(styles.columnGap) || 0
    const gapY = parseFloat(styles.rowGap) || 0
    const stepX = (grid.getBoundingClientRect().width - gapX*(columns-1))/columns+gapX
    const stepY = (parseFloat(styles.gridAutoRows) || 112)+gapY
    const size = getWidgetSize(w)
    resizeRef.current = {id:w.id,axis,x:event.clientX,y:event.clientY,width:size.width,height:size.height,stepX,stepY,columns}
    setResizing(w.id)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onResizeMove = (event:ReactPointerEvent<HTMLButtonElement>) => {
    const drag = resizeRef.current
    if (!drag) return
    const width = drag.axis==='height'?drag.width:clamp(drag.width+Math.round((event.clientX-drag.x)/drag.stepX),1,Math.min(8,drag.columns))
    const height = drag.axis==='width'?drag.height:clamp(drag.height+Math.round((event.clientY-drag.y)/drag.stepY),1,3)
    setWidgetSizes(prev => {
      const existing = prev[drag.id]
      if (existing?.width===width && existing?.height===height) return prev
      return {...prev,[drag.id]:{width,height}}
    })
  }
  const onResizeEnd = () => {resizeRef.current=null;setResizing(null)}
  useEffect(()=>{
    const refresh = ()=> setActivity(readActivityLog())
    window.addEventListener(ACTIVITY_EVENT_NAME,refresh)
    window.addEventListener('storage',refresh)
    return ()=>{window.removeEventListener(ACTIVITY_EVENT_NAME,refresh);window.removeEventListener('storage',refresh)}
  },[])
  const available = useMemo(()=>WIDGETS.filter(w=>!w.route || canVisit(w.route)),[canVisit])
  const shown = visible.map(id => available.find(w => w.id === id)).filter((w): w is WidgetDefinition => Boolean(w))
  const hidden = available.filter(w=>!visible.includes(w.id))
  const campaignOrders = campagneCourante ? commandes.filter(c=>c.campagne===campagneCourante.id) : commandes
  const campaignFiches = campagneCourante ? fichesCaisse.filter(f=>f.campagne===campagneCourante.id) : fichesCaisse
  const pendingOrders = campaignOrders.filter(c=>c.statut==='BROUILLON'||c.statut==='CONFIRMEE')
  const deliveries = campaignOrders.filter(c=>c.statut==='A_LIVRER')
  const toCheck = campaignFiches.filter(f=>f.statutCoffre !== 'CONTROLEE')
  // Même source que le Dashboard : achats Artisans / GMS / Industriels de la
  // campagne sélectionnée. Ne pas utiliser les commandes entreprises (dons).
  const purchases = useMemo(
    () => purchaseSummary(commandesArtisans, campagneCourante?.id ?? ''),
    [commandesArtisans, campagneCourante?.id],
  )
  const commandesMairiesRsCampagne = commandesMairiesRs.filter(c => c.campagne === campagneCourante?.id && c.statut !== 'ANNULEE')
  const facturesCampagne = invoiceSummary(registers.factures, registers.reglements, campagneCourante?.id ?? '')
  const financeCampagne = financeSummary(registers.mecenat, registers.ecarts, campagneCourante?.id ?? '')
  const justificatifsAttente = justificatifs.filter(j => j.campagne === campagneCourante?.id && ['BROUILLON', 'A_VERIFIER', 'ERREUR'].includes(j.statut))
  const mesAlertesOuvertes = registers.alertes.filter(a => a.assigneeId === currentUser?.id && a.status !== 'terminee')
  const remisesCampagne = depotsBanque.filter(d => d.campagne === campagneCourante?.id && d.statut === 'ENREGISTRE')
  const ordered = purchases.quantite
  const goal = campagneCourante?.objectifBrioches && campagneCourante.objectifBrioches > 0
    ? campagneCourante.objectifBrioches
    : null
  const progress = goal !== null ? Math.round(ordered / goal * 100) : null
  const progressBarWidth = progress === null ? 0 : Math.min(100, Math.max(0, progress))
  // Reprendre exactement le service de calcul du module Coffre :
  // fiches enregistrées - remises bancaires enregistrées, par campagne.
  const coffre = useMemo(() => {
    if (!campagneCourante?.id) return { data: null, error: 'Aucune campagne sélectionnée' }
    try {
      return { data: calculerCoffre(campagneCourante.id, fichesCaisse, depotsBanque), error: '' }
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : 'Coffre indisponible' }
    }
  }, [campagneCourante?.id, fichesCaisse, depotsBanque])
  const mairiesActives = mairies.filter(m => m.statut === 'ACTIVE')
  const mairiesAContacter = mairiesActives.filter(m => m.participations?.find(p => p.campagne === campagneCourante?.id)?.statut === 'A_CONTACTER' ||
    (!m.participations?.some(p => p.campagne === campagneCourante?.id) && m.participation === 'A_CONTACTER'))
  const benevolesActifs = benevoles.filter(b => b.statut === 'Actif')
  const etablissementsActifs = etablissements.filter(e => e.statut === 'ACTIF')
  const etablissementsParticipants = etablissementsActifs.filter(e => e.participeOperationBrioches)
  const documentsCampagne = justificatifs.filter(j => j.campagne === campagneCourante?.id)
  const documentsGeneres = documentsCampagne.filter(j => j.documentStatut === 'GENERE' || j.documentStatut === 'ENVOYE')
  const firstName = currentUser?.name?.trim().split(/\s+/)[0] || 'Utilisateur'
  const remove = (id:WidgetId)=>setVisible(list=>list.filter(x=>x!==id))
  const add = (id:WidgetId)=>setVisible(list=>list.includes(id)?list:[...list,id])
  const shortcutItems = [
    {name:'Commandes',route:'/commandes',icon:<ShoppingCart size={17}/>},
    {name:'Fiches de caisse',route:'/encaissements/fiches-caisse',icon:<Euro size={17}/>},
    {name:'Donateurs',route:'/bdd/donateurs',icon:<Users size={17}/>},
    {name:'Justificatifs de dons',route:'/finance/justificatifs-dons',icon:<FileText size={17}/>},
    {name:'Stands Brioches',route:'/gestion/stands-brioches',icon:<Package size={17}/>},
    {name:'Recherche globale',route:'/recherche',icon:<Database size={17}/>},
  ].filter(item=>canVisit(item.route))
  const valueFor = (id:WidgetId):{value:string;detail:string;link?:string}|null => {
    switch(id){
      case 'commandes':return {value:number(pendingOrders.length),detail:'Brouillons et commandes confirmées',link:'Voir les commandes'}
      case 'encaissements':return {value:number(toCheck.length),detail:'Fiches de caisse à contrôler',link:'Voir les fiches'}
      case 'livraisons':return {value:number(deliveries.length),detail:'Commandes au statut « À livrer »',link:'Voir les livraisons'}
      case 'alertes':return {value:number(toCheck.length + pendingOrders.length),detail:'Fiches à contrôler et commandes à traiter',link:'Consulter'}
      case 'donateurs':return {value:number(donateurs.filter(d=>!d.archive).length),detail:'Donateurs non archivés',link:'Ouvrir la BDD'}
      case 'fiches':return {value:number(campaignFiches.length),detail:'Fiches de la campagne',link:'Consulter les fiches'}
      case 'campagne':return {value:campagneCourante?.nom||'Aucune',detail:campagneCourante ? `Campagne ${campagneCourante.statut.toLowerCase()}` : 'Aucune campagne sélectionnée',link:'Gérer les campagnes'}
      case 'brioches':return {value:number(ordered),detail:'Brioches commandées aux fournisseurs de la campagne',link:'Voir les commandes fournisseurs'}
      case 'mairiesrs':return {value:number(commandesMairiesRsCampagne.length),detail:`${number(commandesMairiesRsCampagne.reduce((sum,c)=>sum+Math.max(0,c.quantite||0),0))} brioches · hors commandes annulées`,link:'Voir les commandes'}
      case 'achatsmontant':return {value:money(purchases.estime),detail:`${number(purchases.lignes.length)} commande(s) · estimation, non payée`,link:'Voir les achats'}
      case 'factures':return {value:money(facturesCampagne.amount),detail:`${number(facturesCampagne.lines.length)} facture(s) de la campagne`,link:'Voir les factures'}
      case 'resteapayer':return {value:money(facturesCampagne.outstanding),detail:`${number(facturesCampagne.unpaidCount)} facture(s) non soldée(s) · paiements confirmés uniquement`,link:'Voir les règlements'}
      case 'mecenatfinancier':return {value:money(financeCampagne.financialDeclared),detail:`${number(financeCampagne.mecenatCount)} contribution(s) enregistrée(s) · déclaré, non encaissé`,link:'Voir le mécénat'}
      case 'mecenatnature':return {value:money(financeCampagne.inKindDeclared),detail:'Valeur nature et compétences · non encaissée',link:'Voir le mécénat'}
      case 'ecarts':return {value:money(financeCampagne.pendingLossAmount),detail:`${number(financeCampagne.pendingLossesCount)} écart(s) à traiter · montant déclaratif`,link:'Voir les écarts'}
      case 'justificatifsattente':return {value:number(justificatifsAttente.length),detail:'Brouillons, à vérifier et erreurs · campagne sélectionnée',link:'Voir les justificatifs'}
      case 'remises':return {value:number(remisesCampagne.length),detail:'Dépôts actifs · hors remises annulées',link:'Voir la banque'}
      case 'mesalertes':return {value:number(mesAlertesOuvertes.length),detail:'Alertes attribuées à mon compte · non terminées',link:'Gérer mes alertes'}
      default:return null
    }
  }
  return <div className="accueil-page">
    <header className="accueil-header"><div><span className="accueil-eyebrow">Accueil</span><h1>Bonjour {firstName} 👋</h1><p>Voici les informations disponibles pour votre campagne.</p></div>
      <button type="button" className={'accueil-customize-button'+(customizing?' active':'')} onClick={()=>setCustomizing(v=>!v)}><SlidersHorizontal size={18}/>{customizing?'Terminer':'Personnaliser'}</button>
    </header>
    {customizing && <section className="accueil-inline-library" aria-label="Personnaliser les modules"><div className="accueil-library-header"><div><h2>Personnaliser mon accueil</h2><p>Ajoute ou retire des modules, déplace-les avec la poignée à six points et redimensionne-les par les bords. La disposition est enregistrée par utilisateur.</p></div><button className="accueil-library-close" type="button" onClick={()=>{setVisible(DEFAULT_WIDGETS);setWidgetSizes({})}} title="Rétablir les modules par défaut"><RotateCcw size={18}/></button></div>
      {hidden.length===0?<p className="accueil-library-empty">Tous les modules autorisés sont affichés.</p>:<div className="accueil-library-grid">{hidden.map(w=><button type="button" key={w.id} className="accueil-library-item" onClick={()=>add(w.id)}><Plus size={19}/><strong>{w.label}</strong><span>{w.description}</span></button>)}</div>}
    </section>}
    <div className="accueil-widgets" ref={gridRef}>{shown.map(w=>{
      const stat=valueFor(w.id)
      const size = getWidgetSize(w)
      return <section key={w.id} className={'accueil-widget '+(customizing?' customizing':'')+(resizing===w.id?' is-resizing':'')+(moving===w.id?' is-moving':'')+(dropTarget===w.id?' is-drop-target':'')}
        style={{gridColumn:`span ${size.width}`,gridRow:`span ${size.height}`,'--widget-width':size.width} as CSSProperties} data-width={size.width} data-height={size.height} data-widget-id={w.id}>
        {customizing && <>
          <div className="accueil-move-controls">
            <button type="button" className="accueil-move-handle" aria-label={'Déplacer '+w.label} title="Glisser pour déplacer le module" onPointerDown={e=>onMoveStart(e,w.id)} onPointerMove={onMoveOver} onPointerUp={onMoveEnd} onPointerCancel={onMoveCancel}><GripVertical size={17}/></button>
            <button type="button" className="accueil-move-step" aria-label={'Déplacer '+w.label+' vers la gauche'} title="Déplacer avant" onClick={()=>stepWidget(w.id,-1)}><ArrowLeft size={13}/></button>
            <button type="button" className="accueil-move-step" aria-label={'Déplacer '+w.label+' vers la droite'} title="Déplacer après" onClick={()=>stepWidget(w.id,1)}><ArrowRight size={13}/></button>
          </div>
          <button type="button" className="accueil-resize-handle accueil-resize-right" aria-label={'Élargir '+w.label} title="Glisser horizontalement pour élargir" onPointerDown={e=>onResizeStart(e,w,'width')} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd}><span aria-hidden="true">⋮</span></button>
          <button type="button" className="accueil-resize-handle accueil-resize-bottom" aria-label={'Agrandir en hauteur '+w.label} title="Glisser verticalement pour agrandir" onPointerDown={e=>onResizeStart(e,w,'height')} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd}><span aria-hidden="true">⋯</span></button>
          <button type="button" className="accueil-resize-handle accueil-resize-corner" aria-label={'Redimensionner '+w.label} title="Glisser pour ajuster largeur et hauteur" onPointerDown={e=>onResizeStart(e,w,'both')} onPointerMove={onResizeMove} onPointerUp={onResizeEnd} onPointerCancel={onResizeEnd}><span aria-hidden="true">⤡</span></button>
          <span className="accueil-resize-indicator">{size.width} × {size.height}</span>
        </>}
        {customizing && <button type="button" className="accueil-widget-remove" title={'Retirer '+w.label} aria-label={'Retirer '+w.label} onClick={()=>remove(w.id)}><X size={14}/></button>}
        <div className="accueil-widget-header"><div className="accueil-widget-icon">{icons[w.id]}</div><div><h2>{w.label}</h2><p>{w.description}</p></div></div>
        {stat && <><div className="accueil-widget-value">{stat.value}</div><div className="accueil-widget-label">{stat.detail}</div>{w.route && <Link className="accueil-widget-link" to={w.route}>{stat.link} →</Link>}</>}
        {w.id==='activite' && <div className="accueil-activity-list">{activity.length===0?<p className="accueil-widget-label">Aucune activité enregistrée pour le moment.</p>:activity.slice(0,4).map(a=><div className="accueil-activity-item" key={a.id}><span>{new Date(a.at).toLocaleDateString('fr-FR')}</span><strong>{a.target || a.message || a.action}</strong></div>)}{w.route&&<Link className="accueil-widget-link" to={w.route}>Voir le journal →</Link>}</div>}
        {w.id==='raccourcis' && <div className="accueil-shortcuts">{shortcutItems.map(item=><Link className="accueil-shortcut" to={item.route} key={item.route}>{item.icon}{item.name}</Link>)}{shortcutItems.length===0&&<p>Aucun raccourci autorisé.</p>}</div>}
        {w.id==='avancement' && <><div className="accueil-progress-top"><div><div className="accueil-progress-value">{progress===null?'Non configuré':`${number(progress)} %`}</div><div className="accueil-widget-label">{goal===null?'Définir un objectif de brioches dans Administration → Campagnes':`${number(ordered)} / ${number(goal)} brioches commandées aux fournisseurs`}</div><div className="accueil-widget-label">{purchases.lignes.length} commande(s) fournisseurs · Artisans, GMS, Industriels{progress !== null && progress > 100 ? ' · objectif dépassé' : ''}</div></div></div>{progress!==null&&<><div className="accueil-progress-track"><div className="accueil-progress-bar" style={{width:`${progressBarWidth}%`}}/></div><div className="accueil-progress-footer"><span>0 %</span><span>Objectif</span><span>100 %</span></div></>}{w.route&&<Link to={w.route} className="accueil-widget-link">Voir la campagne →</Link>}</>}
        {w.id==='documents' && <>
          <div className="accueil-widget-value">{number(documentsCampagne.length)}</div>
          <div className="accueil-widget-label">Justificatifs de dons · campagne sélectionnée</div>
          {size.width >= 3 && <div className="accueil-widget-breakdown"><span>Documents générés / envoyés</span><strong>{number(documentsGeneres.length)}</strong></div>}
          {w.route&&<Link to={w.route} className="accueil-widget-link">Voir les justificatifs →</Link>}
        </>}
        {w.id==='mairies' && <>
          <div className="accueil-widget-value">{number(mairiesActives.length)}</div>
          <div className="accueil-widget-label">Mairies disponibles dans la BDD</div>
          {size.width >= 3 && <div className="accueil-widget-breakdown"><span>À contacter · campagne sélectionnée</span><strong>{number(mairiesAContacter.length)}</strong></div>}
          {w.route&&<Link to={w.route} className="accueil-widget-link">Consulter les mairies →</Link>}
        </>}
        {w.id==='benevoles' && <>
          <div className="accueil-widget-value">{number(benevolesActifs.length)}</div>
          <div className="accueil-widget-label">Bénévoles actifs · {number(benevoles.length)} enregistrés</div>
          {size.width >= 3 && <div className="accueil-widget-breakdown"><span>Bénévoles inactifs</span><strong>{number(benevoles.length-benevolesActifs.length)}</strong></div>}
          {w.route&&<Link to={w.route} className="accueil-widget-link">Consulter les bénévoles →</Link>}
        </>}
        {w.id==='etablissements' && <>
          <div className="accueil-widget-value">{number(etablissementsActifs.length)}</div>
          <div className="accueil-widget-label">Établissements actifs · {number(etablissements.length)} enregistrés</div>
          {size.width >= 3 && <div className="accueil-widget-breakdown"><span>Participant à l'opération</span><strong>{number(etablissementsParticipants.length)}</strong></div>}
          {w.route&&<Link to={w.route} className="accueil-widget-link">Consulter les établissements →</Link>}
        </>}
        {w.id==='coffre' && <>
          <div className="accueil-widget-value">{coffre.data ? money(coffre.data.totalGeneral / 100) : '—'}</div>
          <div className="accueil-widget-label">{coffre.data ? `Solde théorique · ${campagneCourante?.id ?? ''} · après remises` : coffre.error}</div>
          {coffre.data && size.width >= 3 && <div className="accueil-widget-breakdown">
            <span>Billets</span><strong>{money(coffre.data.montantBillets / 100)}</strong>
            <span>Pièces</span><strong>{money(coffre.data.montantPieces / 100)}</strong>
            <span>Chèques</span><strong>{money(coffre.data.montantCheques / 100)}</strong>
          </div>}
          {coffre.data && size.width < 3 && size.height >= 3 && <div className="accueil-widget-label">Espèces : {money(coffre.data.totalEspeces / 100)} · Chèques : {money(coffre.data.montantCheques / 100)}</div>}
          {w.route&&<Link to={w.route} className="accueil-widget-link">Ouvrir le coffre →</Link>}
        </>}
      </section>
    })}</div>
    {shown.length===0&&<div className="accueil-no-widgets"><h2>Ton accueil est vide</h2><p>Choisis Personnaliser pour ajouter les cartes qui t'intéressent.</p><button className="accueil-customize-button" onClick={()=>setCustomizing(true)}><Plus size={16}/>Ajouter un module</button></div>}
  </div>
}
export default Accueil
