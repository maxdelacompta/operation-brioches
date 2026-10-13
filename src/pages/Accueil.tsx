import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Activity, AlertTriangle, Building2, Euro, FileText, Package, Plus, RotateCcw, ShoppingCart, SlidersHorizontal, TrendingUp, Truck, Users, Wallet, X, Zap, Database, Landmark } from 'lucide-react'
import { useUsers } from '../contexts/UsersContext'
import { useObData } from '../contexts/ObDataContext'
import { useAccess } from '../lib/useAccess'
import { readActivityLog, ACTIVITY_EVENT_NAME, type ActivityEntry } from '../services/activityLog'
import './Accueil.css'

type WidgetId = 'commandes' | 'encaissements' | 'livraisons' | 'alertes' | 'activite' | 'raccourcis' | 'avancement' | 'documents' | 'donateurs' | 'fiches' | 'campagne' | 'brioches' | 'mairies' | 'benevoles' | 'coffre' | 'etablissements'
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
  { id:'brioches',label:'Brioches commandées',description:'Quantités de la campagne',route:'/commandes' },
  { id:'mairies',label:'BDD Mairies',description:'Accéder à la base des mairies',route:'/bdd/mairies' },
  { id:'benevoles',label:'BDD Bénévoles',description:'Accéder aux bénévoles',route:'/bdd/benevoles' },
  { id:'coffre',label:'Coffre',description:'Accéder au coffre',route:'/encaissements/coffre' },
  { id:'etablissements',label:'Établissements',description:'Accéder aux établissements',route:'/administration/etablissements' },
]
const currency = (v:number) => v.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})
const number = (v:number) => v.toLocaleString('fr-FR')
const icons: Record<WidgetId, ReactNode> = { commandes:<ShoppingCart/>, encaissements:<Euro/>, livraisons:<Truck/>, alertes:<AlertTriangle/>, activite:<Activity/>, raccourcis:<Zap/>, avancement:<TrendingUp/>, documents:<FileText/>, donateurs:<Users/>, fiches:<FileText/>, campagne:<Activity/>, brioches:<Package/>, mairies:<Landmark/>, benevoles:<Users/>, coffre:<Wallet/>, etablissements:<Building2/> }

function Accueil() {
  const { currentUser } = useUsers()
  const { canVisit } = useAccess()
  const { commandes, fichesCaisse, donateurs, activeCampagne } = useObData()
  const storageKey = STORAGE_PREFIX + (currentUser?.id || 'anonymous')
  const [customizing,setCustomizing] = useState(false)
  const [visible,setVisible] = useState<WidgetId[]>(DEFAULT_WIDGETS)
  const skipSave = useRef(true)
  const [widgetSizes,setWidgetSizes] = useState<WidgetSizes>({})
  const skipSizeSave = useRef(true)
  const [activity,setActivity] = useState<ActivityEntry[]>(readActivityLog)
  useEffect(()=>{
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) {
        const parsed: unknown = JSON.parse(stored)
        if (Array.isArray(parsed)) setVisible(Array.from(new Set(parsed.filter((id):id is WidgetId => typeof id==='string' && WIDGETS.some(w=>w.id===id)))))
        else setVisible(DEFAULT_WIDGETS)
      } else {
        // Migration de la personnalisation historique (sans écraser une liste vide enregistrée).
        const legacy = localStorage.getItem('operation-brioches-accueil-widgets')
        if (legacy) {
          const parsed: unknown = JSON.parse(legacy)
          setVisible(Array.isArray(parsed) ? parsed.filter((id):id is WidgetId => typeof id==='string' && WIDGETS.some(w=>w.id===id)) : DEFAULT_WIDGETS)
        } else setVisible(DEFAULT_WIDGETS)
      }
    } catch { setVisible(DEFAULT_WIDGETS) }
    skipSave.current = true
  },[storageKey])
  useEffect(()=>{ if (skipSave.current) {skipSave.current=false;return} try {localStorage.setItem(storageKey,JSON.stringify(visible))} catch { /* stockage indisponible */ } },[visible,storageKey])
  useEffect(()=>{
    skipSizeSave.current = true
    try {
      const raw = localStorage.getItem(SIZE_STORAGE_PREFIX + storageKey)
      const saved: unknown = raw ? JSON.parse(raw) : {}
      const valid: WidgetSizes = {}
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
        for (const widget of WIDGETS) {
          const size = (saved as Record<string,unknown>)[widget.id]
          if (size && typeof size === 'object' && !Array.isArray(size)) {
            const value = size as Record<string,unknown>
            if (typeof value.width === 'number' && Number.isFinite(value.width) && typeof value.height === 'number' && Number.isFinite(value.height)) {
              valid[widget.id] = {width:clamp(value.width,1,8),height:clamp(value.height,1,3)}
            }
          }
        }
      }
      setWidgetSizes(valid)
    } catch {setWidgetSizes({})}
  },[storageKey])
  useEffect(()=>{
    if (skipSizeSave.current) {skipSizeSave.current=false;return}
    try {localStorage.setItem(SIZE_STORAGE_PREFIX + storageKey,JSON.stringify(widgetSizes))} catch { /* stockage indisponible */ }
  },[widgetSizes,storageKey])
  const getWidgetSize = (w:WidgetDefinition):WidgetSize => widgetSizes[w.id] ?? {width:w.large?4:2,height:2}
  // Redimensionnement à la souris / au doigt, calé sur la grille CSS réelle.
  const gridRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<null | {id:WidgetId; axis:'width'|'height'|'both'; x:number; y:number; width:number; height:number; stepX:number; stepY:number; columns:number}>(null)
  const [resizing,setResizing] = useState<WidgetId|null>(null)
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
  const changeWidgetSize = (id:WidgetId,axis:keyof WidgetSize,value:number) => {
    const widget = WIDGETS.find(w=>w.id===id)
    if (!widget) return
    setWidgetSizes(prev=>{
      const old = prev[id] ?? {width:widget.large?4:2,height:2}
      return {...prev,[id]:{...old,[axis]:clamp(value,1,axis==='width'?8:3)}}
    })
  }

  useEffect(()=>{
    const refresh = ()=> setActivity(readActivityLog())
    window.addEventListener(ACTIVITY_EVENT_NAME,refresh)
    window.addEventListener('storage',refresh)
    return ()=>{window.removeEventListener(ACTIVITY_EVENT_NAME,refresh);window.removeEventListener('storage',refresh)}
  },[])
  const available = useMemo(()=>WIDGETS.filter(w=>!w.route || canVisit(w.route)),[canVisit,currentUser])
  const shown = available.filter(w=>visible.includes(w.id))
  const hidden = available.filter(w=>!visible.includes(w.id))
  const campaignOrders = activeCampagne ? commandes.filter(c=>c.campagne===activeCampagne.id) : commandes
  const campaignFiches = activeCampagne ? fichesCaisse.filter(f=>f.campagne===activeCampagne.id) : fichesCaisse
  const pendingOrders = campaignOrders.filter(c=>c.statut==='BROUILLON'||c.statut==='CONFIRMEE')
  const deliveries = campaignOrders.filter(c=>c.statut==='A_LIVRER')
  const toCheck = campaignFiches.filter(f=>f.statutCoffre !== 'CONTROLEE')
  const ordered = campaignOrders.filter(c=>c.statut!=='ANNULEE').reduce((sum,c)=>sum+(Number(c.quantite)||0),0)
  const goal = activeCampagne?.objectifBrioches ?? null
  const progress = goal && goal>0 ? Math.min(100,Math.round(ordered/goal*100)) : null
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
      case 'campagne':return {value:activeCampagne?.nom||'Aucune',detail:activeCampagne ? 'Campagne active' : 'Aucune campagne active',link:'Gérer les campagnes'}
      case 'brioches':return {value:number(ordered),detail:'Brioches dans les commandes non annulées',link:'Voir les commandes'}
      default:return null
    }
  }
  return <div className="accueil-page">
    <header className="accueil-header"><div><span className="accueil-eyebrow">Accueil</span><h1>Bonjour {firstName} 👋</h1><p>Voici les informations disponibles pour votre campagne.</p></div>
      <button type="button" className={'accueil-customize-button'+(customizing?' active':'')} onClick={()=>setCustomizing(v=>!v)}><SlidersHorizontal size={18}/>{customizing?'Terminer':'Personnaliser'}</button>
    </header>
    {customizing && <section className="accueil-inline-library" aria-label="Personnaliser les modules"><div className="accueil-library-header"><div><h2>Personnaliser mon accueil</h2><p>Ajoute ou retire des modules, puis étire les cartes par leur bord droit ou inférieur (jusqu’à 8 colonnes et 3 rangées). Les choix sont enregistrés par utilisateur.</p></div><button className="accueil-library-close" type="button" onClick={()=>{setVisible(DEFAULT_WIDGETS);setWidgetSizes({})}} title="Rétablir les modules par défaut"><RotateCcw size={18}/></button></div>
      {hidden.length===0?<p className="accueil-library-empty">Tous les modules autorisés sont affichés.</p>:<div className="accueil-library-grid">{hidden.map(w=><button type="button" key={w.id} className="accueil-library-item" onClick={()=>add(w.id)}><Plus size={19}/><strong>{w.label}</strong><span>{w.description}</span></button>)}</div>}
    </section>}
    <div className="accueil-widgets" ref={gridRef}>{shown.map(w=>{
      const stat=valueFor(w.id)
      const size = getWidgetSize(w)
      return <section key={w.id} className={'accueil-widget '+(customizing?' customizing':'')+(resizing===w.id?' is-resizing':'')}
        style={{gridColumn:`span ${size.width}`,gridRow:`span ${size.height}`,'--widget-width':size.width} as CSSProperties} data-width={size.width} data-height={size.height}>
        {customizing && <>
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
        {w.id==='avancement' && <><div className="accueil-progress-top"><div><div className="accueil-progress-value">{progress===null?'Non configuré':`${progress} %`}</div><div className="accueil-widget-label">{goal===null?'Définir un objectif de brioches dans la campagne':`${number(ordered)} / ${number(goal)} brioches commandées`}</div></div></div>{progress!==null&&<><div className="accueil-progress-track"><div className="accueil-progress-bar" style={{width:`${progress}%`}}/></div><div className="accueil-progress-footer"><span>0 %</span><span>Objectif</span><span>100 %</span></div></>}{w.route&&<Link to={w.route} className="accueil-widget-link">Voir la campagne →</Link>}</>}
        {w.id==='documents' && <><p className="accueil-widget-label">Consultez les justificatifs réels depuis le module Documents. Aucune liste fictive n'est affichée.</p>{w.route&&<Link to={w.route} className="accueil-widget-link">Ouvrir les justificatifs →</Link>}</>}
        {['mairies','benevoles','coffre','etablissements'].includes(w.id) && <><p className="accueil-widget-label">Accès direct au module existant. Un indicateur chiffré sera ajouté lorsqu'une source fiable sera disponible.</p>{w.route&&<Link to={w.route} className="accueil-widget-link">Ouvrir le module →</Link>}</>}
      </section>
    })}</div>
    {shown.length===0&&<div className="accueil-no-widgets"><h2>Ton accueil est vide</h2><p>Choisis Personnaliser pour ajouter les cartes qui t'intéressent.</p><button className="accueil-customize-button" onClick={()=>setCustomizing(true)}><Plus size={16}/>Ajouter un module</button></div>}
  </div>
}
export default Accueil
