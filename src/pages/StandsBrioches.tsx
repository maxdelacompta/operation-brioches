import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useObData } from '../contexts/ObDataContext'
import { useUsers } from '../contexts/UsersContext'
import { livraisonsStands } from '../lib/standsLivraisons'
import FeuilleStand from './FeuilleStand'
import { readOperations } from './CompteurStand'
import { Store, CalendarDays, Users, Plus, Pencil, Trash2, Search, Wallet, CreditCard, Package, ClipboardCheck, X, Download, Send, Printer, LockKeyhole } from 'lucide-react'
import type { MouvementMateriel } from '../types/suiviMateriel'
import './StandsBrioches.css'

type Stand = {
  id: string; campagne?: string; nom: string; lieu: string; adresseStand?: string; date: string; debut: string; fin: string;
  benevoleIds: string[]; autresBenevoles: string; responsable: string;
  caissePrevue: boolean; tpePrevu: boolean;
  briochesPrevues: number; stockFournisseur?: boolean; briochesRemises: number; notes: string;
  ouverturePar?: string; apportBriochesPar?: string; fermeturePar?: string; repriseBriochesPar?: string; statut: 'Prévu' | 'En cours' | 'Terminé'
}
type Benevole = { id: string; nom: string; prenom: string; statut?: string }
type ClotureStand = { closedAt: string; briochesCompteur: number; briochesFiche: number; briochesTotal: number; donsSansBrioche: number; montantDonsSansBrioche: number }
const clotureKey = (id: string) => `ob-stand-cloture-v1-${id}`
const lireCloture = (id: string): ClotureStand | null => {
  try { const raw = localStorage.getItem(clotureKey(id)); return raw ? JSON.parse(raw) as ClotureStand : null }
  catch { return null }
}
type Reattribution = {id:string; from:string; to:string; qty:number; at:string}
const isoDay=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
const weekStart=(day:string)=>{const date=new Date(`${day}T12:00:00`);if(Number.isNaN(date.getTime()))return '';date.setDate(date.getDate()-(date.getDay()+6)%7);return isoDay(date)}
const nextDay=(day:string,count:number)=>{const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()+count);return isoDay(d)}
const readRecord=<T,>(key:string,fallback:T):T=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw) as T:fallback}catch{return fallback}}
const KEY = 'ob-stands-brioches-v1'
const BENEVOLES_KEY = 'ob-bdd-benevoles-v1'
const MATERIEL_KEY = 'ob-suivi-caisse-tpe-v1'
type Commune54 = { nom: string; code: string }
const COMMUNES_54_KEY = 'ob-communes-54-cache-v1'
const COMMUNES_54_URL = 'https://geo.api.gouv.fr/departements/54/communes?fields=nom,code&format=json'
const COMMUNES_54_SECOURS = ['Baccarat', 'Briey', 'Dombasle-sur-Meurthe', 'Heillecourt', 'Jarny', 'Laxou', 'Liverdun', 'Longwy', 'Ludres', 'Lunéville', 'Nancy', 'Neuves-Maisons', 'Pont-à-Mousson', 'Saint-Max', 'Tomblaine', 'Toul', 'Vandœuvre-lès-Nancy', 'Villerupt']
const normalizeCommune = (s: string) => s.toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/œ/g,'oe')
const DAYS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'] as const
const dayIndex = (date:string) => { const day=new Date(`${date}T12:00:00`).getDay();return (day+6)%7 }
const csvCell = (value:unknown) => { const raw=String(value??''); const safe=/^[=+@\-]/.test(raw)?`'${raw}`:raw; return `"${safe.replace(/"/g,'""')}"` } 
// Rattachement par période administrative, puis par année si les dates ne sont pas renseignées.
type PeriodeCampagne = { id:string; annee:number|null; dateDebut:string; dateFin:string }
const campagneDuStand = (stand: {date:string;campagne?:string}, campagnes:PeriodeCampagne[]):string => {
  const jour=stand.date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return stand.campagne||''
  const candidates=campagnes.filter(c=> !c.id.toUpperCase().startsWith('TEST-') &&
    c.dateDebut && c.dateFin && c.dateDebut<=jour && jour<=c.dateFin)
  if(candidates.length===1) return candidates[0].id
  // En cas de chevauchement, on ne modifie pas silencieusement une attribution existante.
  if(candidates.length>1) return stand.campagne||''
  const annee=Number(jour.slice(0,4))
  const parAnnee=campagnes.filter(c=> !c.id.toUpperCase().startsWith('TEST-') &&
    (c.annee===annee || new RegExp(`\\b${annee}\\b`).test(c.id)))
  if(parAnnee.length===1) return parAnnee[0].id
  return stand.campagne||''
}
const empty = (): Omit<Stand,'id'> => ({ nom: '', lieu: '', adresseStand: '', date: new Date().toLocaleDateString('en-CA'), debut: '09:00', fin: '17:00', benevoleIds: [], autresBenevoles: '', responsable: '', caissePrevue: false, tpePrevu: false, briochesPrevues: 0, stockFournisseur: false, briochesRemises: 0, notes: '', statut: 'Prévu' })
function loadArray<T>(key: string): T[] { try { const parsed: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] } }
function loadStands(): Stand[] { return loadArray<Stand>(KEY).filter(s => s && typeof s.id === 'string' && typeof s.nom === 'string').map(s => ({...empty(), ...s, benevoleIds: Array.isArray(s.benevoleIds) ? s.benevoleIds : []})) }
function same(v: string) { return (v || '').trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'') }
function localDate(d: string) { return d ? new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR') : '—' }
export default function StandsBrioches() {
  const [communes54,setCommunes54] = useState<string[]>(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(COMMUNES_54_KEY) || '[]')
      if (Array.isArray(cached) && cached.length > 100) return cached.filter((x): x is string => typeof x === 'string')
    } catch { /* cache absent */ }
    return COMMUNES_54_SECOURS
  })
  useEffect(() => {
    let active = true
    fetch(COMMUNES_54_URL)
      .then(response => {if (!response.ok) throw new Error('Communes indisponibles'); return response.json() as Promise<Commune54[]>})
      .then(data => {
        if (!active || !Array.isArray(data)) return
        const names = [...new Set(data.map(c => c.nom).filter((v): v is string => typeof v === 'string'))].sort((a,b) => a.localeCompare(b,'fr'))
        if (names.length < 100) return
        setCommunes54(names)
        try {localStorage.setItem(COMMUNES_54_KEY,JSON.stringify(names))}catch{/* quota */}
      }).catch(() => { /* conserve les communes en cache ou la liste de secours */ })
    return () => {active = false}
  }, [])
  const {campagnes,selectedCampagne,activeCampagne,fichesCaisse}=useObData()
  const {currentUser}=useUsers()
  const isAdmin=currentUser?.role==='administrateur'
  const campagneSelectionnee=selectedCampagne??activeCampagne
  const campagneId=campagneSelectionnee?.id??''
  const [stands, setStands] = useState<Stand[]>(loadStands)
  const standsCampagne=useMemo(()=>stands.filter(s=>campagneDuStand(s,campagnes)===campagneId),[stands,campagnes,campagneId])
  const [benevoles, setBenevoles] = useState<Benevole[]>(() => loadArray(BENEVOLES_KEY))
  const [materiels, setMateriels] = useState<MouvementMateriel[]>(() => loadArray(MATERIEL_KEY))
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Stand,'id'>>(empty)
  const [query, setQuery] = useState('')
  const [week,setWeek]=useState(()=>weekStart(isoDay(new Date())))
  const [reaffectationOpen,setReaffectationOpen]=useState(false)
  const [expandedStandIds, setExpandedStandIds] = useState<string[]>([])
  const toggleStandDetails = (id:string) => setExpandedStandIds(current => current.includes(id) ? current.filter(value=>value!==id) : [...current,id])
  const lockKey=`ob-stands-weeks-locked-v1-${campagneId}`
  const transferKey=`ob-stands-reattributions-v1-${campagneId}`
  const [lockedWeeks,setLockedWeeks]=useState<string[]>(()=>readRecord(lockKey,[]))
  const [transfers,setTransfers]=useState<Reattribution[]>(()=>readRecord(transferKey,[]))
  const [targetId,setTargetId]=useState('')
  const [transferQty,setTransferQty]=useState('1')
  const [selectedDay, setSelectedDay] = useState<number>((new Date().getDay()+6)%7)
  const [shareMessage,setShareMessage] = useState('')
  const [feuilleStandId, setFeuilleStandId] = useState<string | null>(null)
  const [materialStandId, setMaterialStandId] = useState<string | null>(null)
  const [materialChoice, setMaterialChoice] = useState<'aucun'|'caisse'|'tpe'|'deux'>('aucun')
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const [deliveryRevision, setDeliveryRevision] = useState(0)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(stands)) }, [stands])
  useEffect(()=>{setLockedWeeks(readRecord<string[]>(lockKey,[]));setTransfers(readRecord<Reattribution[]>(transferKey,[]));setTargetId('')},[lockKey,transferKey])
  const isLocked=(date:string)=>lockedWeeks.includes(weekStart(date))
  const weekLocked=lockedWeeks.includes(week)
  const toggleWeek=()=>{
    if(!isAdmin)return
    const next=weekLocked?lockedWeeks.filter(w=>w!==week):[...lockedWeeks,week]
    if(!window.confirm(weekLocked?'Déverrouiller cette semaine pour corrections ?':'Figer la semaine sélectionnée ? Les fiches et transferts de cette semaine seront figés sur cette page (le compteur numérique sera à verrouiller séparément).'))return
    localStorage.setItem(lockKey,JSON.stringify(next));setLockedWeeks(next)
  }
  const saveTransfer=(from:string,to:string,qty:number)=>{
    const next=[...transfers,{id:crypto.randomUUID(),from,to,qty,at:new Date().toISOString()}]
    localStorage.setItem(transferKey,JSON.stringify(next));setTransfers(next)
  }

  useEffect(() => {
    const refresh = () => { setBenevoles(loadArray(BENEVOLES_KEY)); setMateriels(loadArray(MATERIEL_KEY)); setRevision(v=>v+1); setDeliveryRevision(v=>v+1) }
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('storage', refresh) }
  }, [])
  const counted = (s: Stand) => {void revision; const o=readOperations(s.id);return {brioches:o.filter(x=>x.kind==='brioche').reduce((n,x)=>n+x.qty,0),dons:o.filter(x=>x.kind==='don'),montant:o.filter(x=>x.kind==='don').reduce((n,x)=>n+x.amount,0)}}
  const livraisonsParStand = useMemo(() => { void deliveryRevision; return livraisonsStands(campagneId) }, [campagneId, deliveryRevision])
  const initialStand=(stand:Stand)=>stand.stockFournisseur?Math.max(0,livraisonsParStand[stand.id]||0):stand.briochesPrevues
  const recuTransfer=(id:string)=>transfers.filter(t=>t.to===id).reduce((n,t)=>n+t.qty,0)
  const sortiTransfer=(id:string)=>transfers.filter(t=>t.from===id).reduce((n,t)=>n+t.qty,0)
  const qteStand=(stand:Stand)=>initialStand(stand)+recuTransfer(stand.id)
  // Une fiche de caisse rattachée au stand peut compléter un décompte papier fermé à zéro.
  // Ne pas l'additionner au compteur numérique : on prend le maximum des sources
  // pour éviter de compter deux fois les mêmes brioches.
  const remisSurFiche=(stand:Stand)=>fichesCaisse
    .filter(f=>f.type==='STAND' && (f as typeof f & {standId?:string}).standId===stand.id &&
      (f.campagne.match(/(?:19|20)\d{2}/)?.[0]===stand.date.slice(0,4)))
    .reduce((n,f)=>n+Math.max(0,Number((f as typeof f & {nbBriochesStand?:number}).nbBriochesStand)||0),0)
  const remisStand=(stand:Stand)=>{const cl=lireCloture(stand.id);return Math.max(stand.briochesRemises+counted(stand).brioches,cl?.briochesTotal||0,remisSurFiche(stand))} 
  const resteStand=(stand:Stand)=>Math.max(0,qteStand(stand)-remisStand(stand)-sortiTransfer(stand.id))
  const reattribuables=standsCampagne.filter(s=>Boolean(lireCloture(s.id))&&!isLocked(s.date)).map(s=>({...s,reste:resteStand(s)})).filter(s=>s.reste>0)
  const totalReattribuable=reattribuables.reduce((n,s)=>n+s.reste,0)
  const reattribuer=(from:Stand)=>{
    const dest=standsCampagne.find(s=>s.id===targetId)
    const qty=Number(transferQty)
    if(!dest||dest.id===from.id||lireCloture(dest.id)||isLocked(dest.date)||isLocked(from.date)||!Number.isSafeInteger(qty)||qty<=0||qty>resteStand(from)){setShareMessage('Réattribution impossible : sélectionne un stand ouvert et une quantité disponible.');return}
    if(!window.confirm(`Réattribuer ${qty} brioche(s) de « ${from.nom} » à « ${dest.nom} » ? Il s’agit d’un transfert ESTIMATIF, sans écriture de stock comptable.`))return
    saveTransfer(from.id,dest.id,qty);setShareMessage(`${qty} brioche(s) réattribuées à « ${dest.nom} » (estimation).`)
  }
  const livraisonFormulaire = editId ? Math.max(0,livraisonsParStand[editId] || 0) : 0
  const sorted = useMemo(() => standsCampagne.filter(s=>weekStart(s.date)===week).filter(s => dayIndex(s.date) === selectedDay).filter(s => `${s.nom} ${s.lieu} ${s.adresseStand || ''} ${s.responsable} ${s.statut}`.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).sort((a,b) => a.date.localeCompare(b.date) || a.debut.localeCompare(b.debut)), [standsCampagne,query,selectedDay,week])
  const exportDay = () => {
    const header=['Date','Stand','Lieu','Début','Fin','Statut','Responsable','Bénévoles','Caisse prévue','TPE prévu','Caisses affectées','TPE affectés','Brioches prévues','Brioches remises','Brioches restantes (estimées)','Dons sans brioche (nombre)','Dons sans brioche (€)','Notes']
    const lines=sorted.map(s=>{const b=counted(s);return [s.date,s.nom,s.lieu,s.debut,s.fin,s.statut,s.responsable,[...s.benevoleIds.map(id=>{const found=benevoles.find(v=>v.id===id);return found?`${found.prenom} ${found.nom}`:'Bénévole indisponible'}),s.autresBenevoles].filter(Boolean).join(' / '),s.caissePrevue?'Oui':'Non',s.tpePrevu?'Oui':'Non',moneyless(assignments(s,'CAISSE')),moneyless(assignments(s,'TPE')),qteStand(s),s.briochesRemises+b.brioches,qteStand(s)-s.briochesRemises-b.brioches,b.dons.length,b.montant.toFixed(2).replace('.',','),s.notes]})
    const csv='\uFEFF'+[header,...lines].map(line=>line.map(csvCell).join(';')).join('\r\n')
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}))
    const a=document.createElement('a');a.href=url;a.download=`stands-${DAYS[selectedDay].toLowerCase()}-operation-brioche.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  const shareCounter = async (s:Stand) => {
    const url=`${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/,'')}/gestion/stands-brioches/${encodeURIComponent(s.id)}/compteur`
    const message=`Opération Brioche – compteur du stand ${s.nom} (${localDate(s.date)}) : ${url}`
    try {
      if(navigator.share) await navigator.share({title:`Compteur ${s.nom}`,text:message})
      else if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(message);setShareMessage(`Lien du stand « ${s.nom} » copié. Attention : le compteur n’est pas encore synchronisé entre appareils.`)}
      else {window.prompt('Copiez le message à envoyer au bénévole :',message);setShareMessage('Lien préparé, mais les données du stand ne sont pas encore accessibles sur un autre appareil.')}
    }catch(e){if((e as Error).name!=='AbortError')setShareMessage('Partage impossible sur ce navigateur : ouvrez le compteur et copiez son adresse.')}
  }
  const assignments = (s: Stand, type: 'CAISSE'|'TPE') => materiels.filter(m => m.type === type && same(m.nomStand) === same(s.nom) && m.dateSortie <= s.date && (m.dateRetourReelle || m.dateRetourPrevue || m.dateSortie) >= s.date && m.numeroMateriel > 0)
  const count = (s: Stand) => s.benevoleIds.length + s.autresBenevoles.split(/[,;\n]/).filter(x => x.trim()).length
  const fermerStandSansCompteur = (stand: Stand) => {
    if (lireCloture(stand.id)||isLocked(stand.date)) return
    const bilan = counted(stand)
    if (bilan.brioches > 0 || stand.briochesRemises > 0) return
    if (!window.confirm(`Fermer le décompte du stand « ${stand.nom} » avec 0 brioche ? Le nombre pourra être renseigné manuellement dans la fiche de caisse.`)) return
    const cloture: ClotureStand = {
      closedAt: new Date().toISOString(), briochesCompteur: 0,
      briochesFiche: 0, briochesTotal: 0,
      donsSansBrioche: bilan.dons.length, montantDonsSansBrioche: bilan.montant,
    }
    try {
      localStorage.setItem(clotureKey(stand.id), JSON.stringify(cloture))
      setRevision(v => v + 1)
      setShareMessage(`Décompte fermé pour « ${stand.nom} » avec 0 brioche. La quantité pourra être saisie dans la fiche de caisse.`)
    } catch {
      setShareMessage('Fermeture impossible : stockage local indisponible.')
    }
  }
  const total = standsCampagne.reduce((sum,s) => sum + initialStand(s), 0) // Les transferts internes ne créent pas de brioches supplémentaires
  const remises = standsCampagne.reduce((sum,s) => sum + remisStand(s), 0)
  const startNew = () => { setEditId(null); setForm({...empty(),campagne:campagneId}); setError(''); setOpen(true) }
  const startEdit = (s: Stand) => {if(isLocked(s.date)){setShareMessage('Semaine figée : déverrouillage administrateur nécessaire.');return} const {id,...rest} = s; setEditId(id); setForm({...empty(),...rest}); setError(''); setOpen(true) }
  const save = (e: FormEvent) => {
    e.preventDefault()
    if(isLocked(form.date)||(editId&&isLocked(stands.find(s=>s.id===editId)?.date||''))){setError('Cette semaine est figée. Déverrouille-la avant toute modification.');return}
    if (!form.nom.trim() || !form.date) {setError('Le nom et la date sont obligatoires.');return}
    if (form.fin <= form.debut) {setError('L’heure de fin doit suivre l’heure de début.');return}
    if (![form.briochesPrevues,form.briochesRemises].every(n=>Number.isInteger(n) && n>=0)) {setError('Les quantités doivent être des entiers positifs ou nuls.');return}
    if (form.briochesRemises + (editId ? counted({id:editId} as Stand).brioches : 0) > (form.stockFournisseur ? livraisonFormulaire : form.briochesPrevues)) {setError('Les brioches remises dépassent l’estimation mise à disposition : ajustez l’estimation.');return}
    const item = {...form,briochesPrevues:form.stockFournisseur ? livraisonFormulaire : form.briochesPrevues,campagne:campagneDuStand(form,campagnes),nom:form.nom.trim(),lieu:form.lieu.trim(),adresseStand:(form.adresseStand || '').trim(),responsable:form.responsable.trim(),id:editId || crypto.randomUUID()}
    if(!item.campagne){setError('Aucune campagne correspondante à cette date. Configure la période de la campagne dans Administration → Campagnes.');return}
    setStands(prev => editId ? prev.map(s => s.id === editId ? item : s) : [...prev,item])
    setOpen(false)
  }
  const update = (key: keyof Omit<Stand,'id'>, value: unknown) => setForm(prev => ({...prev,[key]:value}))
  const startMaterialChoice = (s: Stand) => {
    setMaterialStandId(s.id)
    setMaterialChoice(s.caissePrevue && s.tpePrevu ? 'deux' : s.caissePrevue ? 'caisse' : s.tpePrevu ? 'tpe' : 'aucun')
  }
  const saveMaterialChoice = () => {
    if (!materialStandId) return
    const stand=stands.find(s=>s.id===materialStandId);if(stand&&isLocked(stand.date)){setMaterialStandId(null);setShareMessage('Semaine figée.');return}
    setStands(prev => prev.map(s => s.id === materialStandId ? { ...s, caissePrevue: materialChoice === 'caisse' || materialChoice === 'deux', tpePrevu: materialChoice === 'tpe' || materialChoice === 'deux' } : s))
    setMaterialStandId(null)
  }
  const moneyless = (a: MouvementMateriel[]) => a.length ? a.map(x=>`n° ${x.numeroMateriel}`).join(', ') : ''
  return <div className="ob-stand-page">
    <div className="ob-stand-heading"><div><div className="ob-stand-overline">GESTION · OPÉRATION BRIOCHE</div><h1>Stands Brioches</h1><p>Qui est présent, quel matériel est prévu et combien de brioches sont remises.</p></div><button type="button" onClick={startNew}><Plus size={18}/> Nouveau stand</button></div>
    <section className="ob-week-panel">
      <div><h2><CalendarDays size={18}/> Calendrier des semaines</h2><p>Choisis une date : la semaine du lundi au dimanche s’affiche. Le verrouillage est réservé aux administrateurs.</p></div>
      <label>Semaine du <input type="date" value={week} onChange={e=>e.target.value&&setWeek(weekStart(e.target.value))}/></label>
      <div className="ob-week-nav"><button type="button" onClick={()=>setWeek(nextDay(week,-7))}>← Précédente</button><strong>{localDate(week)} – {localDate(nextDay(week,6))}</strong><button type="button" onClick={()=>setWeek(nextDay(week,7))}>Suivante →</button></div>
      <span className={weekLocked?'ob-week-locked':'ob-week-unlocked'}>{weekLocked?'🔒 Semaine figée':'Semaine modifiable'}</span>
      {isAdmin&&<button type="button" className="ob-week-toggle" onClick={toggleWeek}>{weekLocked?'Déverrouiller':'Figer cette semaine'}</button>}
    </section>
    <section className={`ob-stand-redistribution ${reaffectationOpen ? 'is-expanded' : ''}`}>
      <button type="button" className="ob-stand-redistribution-toggle" aria-expanded={reaffectationOpen} onClick={()=>setReaffectationOpen(x=>!x)}><span className="ob-stand-redistribution-title"><Package size={20}/><strong>Brioches à réattribuer</strong><span className="ob-stand-redistribution-number">{totalReattribuable}</span></span><span className="ob-stand-redistribution-action">{reaffectationOpen?'Masquer les détails':'Voir les réattributions'} {reaffectationOpen?'−':'+'}</span></button>
      <div className="ob-stand-redistribution-content" hidden={!reaffectationOpen}>
      
      <p>Solde estimatif des stands clôturés : brioches mises à disposition moins brioches remises et déjà réattribuées. Ne modifie pas le stock comptable.</p>
      {reattribuables.map(source=><div key={source.id} className="ob-stand-redistribution-row"><span><strong>{source.nom}</strong> · {localDate(source.date)} · <b>{source.reste} disponible(s)</b></span><select value={targetId} onChange={e=>setTargetId(e.target.value)} aria-label="Stand destinataire"><option value="">Réattribuer vers…</option>{standsCampagne.filter(s=>s.id!==source.id&&!lireCloture(s.id)&&!isLocked(s.date)).map(s=><option key={s.id} value={s.id}>{s.nom} · {localDate(s.date)}</option>)}</select><input aria-label="Quantité réattribuée" type="number" min="1" max={source.reste} value={transferQty} onChange={e=>setTransferQty(e.target.value)}/><button type="button" disabled={!targetId} onClick={()=>reattribuer(source)}>Réattribuer</button></div>)}
      {reattribuables.length===0&&<p>Aucune brioche estimée à réattribuer depuis les stands clôturés non figés.</p>}
      </div>
    </section>
    <div className="ob-stand-section-title"><h2>Vue d’ensemble</h2><span>Indicateurs de la campagne</span></div>
    <div className="ob-stand-stats">
      <div><Store size={23}/><strong>{standsCampagne.length}</strong><span>Stands enregistrés</span></div>
      <div><CalendarDays size={23}/><strong>{standsCampagne.filter(s=>s.statut!=='Terminé').length}</strong><span>Stands en cours / prévus</span></div>
      <div><Users size={23}/><strong>{standsCampagne.reduce((n,s)=>n+count(s),0)}</strong><span>Affectations bénévoles</span></div>
      <div><Package size={23}/><strong>{total}</strong><span>Brioches prévues (estimation)</span></div>
      <div><ClipboardCheck size={23}/><strong>{remises}</strong><span>Brioches remises (déclaratif)</span></div>
      <div><Package size={23}/><strong>{total-remises}</strong><span>Écart prévisionnel restant</span></div>
    </div>
    <div className="ob-stand-notice">Les chiffres ci-dessus sont des estimations par stand. Ils ne modifient pas automatiquement les stocks, les dons, le coffre ou les écritures comptables. Les caisses et TPE affectés sont recherchés dans le planning selon le nom exact du stand et sa date.</div>
    <div className="ob-stand-section-title ob-stand-section-title--listing"><h2>Planning des stands</h2><span>Sélectionne un jour pour consulter les stands</span></div>
    <div className="ob-stand-days-toolbar"><div className="ob-stand-days" role="tablist" aria-label="Stands par jour">{DAYS.map((day,index)=><button key={day} type="button" role="tab" aria-selected={selectedDay===index} className={selectedDay===index?"active":""} onClick={()=>setSelectedDay(index)}>{day}<span>{standsCampagne.filter(s=>weekStart(s.date)===week&&dayIndex(s.date)===index).length}</span></button>)}</div><button type="button" className="ob-stand-export" disabled={!sorted.length} onClick={exportDay}><Download size={17}/> Exporter {DAYS[selectedDay].toLowerCase()} (CSV)</button></div>
    {shareMessage && <div className="ob-stand-share-notice" role="status">{shareMessage}<button type="button" onClick={()=>setShareMessage('')} aria-label="Fermer le message"><X size={15}/></button></div>}
    <div className="ob-stand-search"><Search size={17}/><input aria-label="Rechercher un stand" placeholder="Rechercher un stand, une commune, un responsable..." value={query} onChange={e=>setQuery(e.target.value)}/></div>
    {!sorted.length ? <section className="ob-stand-empty"><Store size={38}/><h2>{stands.length?'Aucun stand pour ce jour ou cette recherche':'Créez votre premier stand'}</h2><p>Enregistrez le lieu, le créneau, les bénévoles, le matériel et vos estimations de brioches.</p></section> : <div className="ob-stand-list">{sorted.map(s=>{
      const caisses = assignments(s,'CAISSE'); const tpes = assignments(s,'TPE'); const bilan=counted(s); const cloture=lireCloture(s.id); const aucunCompte = s.briochesRemises + bilan.brioches === 0; const locked=isLocked(s.date); const expanded=expandedStandIds.includes(s.id)
      return <article className={`ob-stand-card ${cloture ? "ob-stand-card--closed" : "ob-stand-card--open"}`} key={s.id}>
        <div className="ob-stand-card-head"><div><div className="ob-stand-title-row"><span className={`ob-stand-status ${cloture ? "ob-stand-status--closed" : "ob-stand-status--open"}`}>{cloture ? (cloture.briochesTotal === 0 ? "Décompte fermé" : "Stand terminé") : "Stand ouvert"}</span><h2>{s.nom}</h2></div><p>{[s.lieu, s.adresseStand].filter(Boolean).join(' · ')||'Lieu non précisé'} · {localDate(s.date)} · {s.debut}–{s.fin}</p></div><div className="ob-stand-actions"><button type="button" className="ob-stand-expand-button" onClick={()=>toggleStandDetails(s.id)} aria-expanded={expanded} aria-controls={`stand-details-${s.id}`} title={expanded?'Masquer les détails':'Afficher les détails'}><span aria-hidden="true">{expanded?'−':'+'}</span><span>{expanded?'Réduire':'Détails'}</span></button><button type="button" className="ob-stand-share-button" onClick={()=>void shareCounter(s)} title="Préparer le lien à transmettre au bénévole"><Send size={16}/> Envoyer au bénévole</button><Link className="ob-stand-counter-link" to={`/gestion/stands-brioches/${s.id}/compteur`}>Compteur</Link>{!cloture && aucunCompte && <button type="button" className="ob-stand-close-action" disabled={locked} onClick={()=>fermerStandSansCompteur(s)} title="Fermer le décompte à zéro et permettre la saisie sur la fiche de caisse"><LockKeyhole size={16}/> Fermer le stand</button>}<button type="button" className="ob-stand-sheet-button" onClick={()=>setFeuilleStandId(s.id)} title="Afficher et imprimer la feuille du stand"><Printer size={16}/> Feuille Stand</button><button type="button" className="ob-stand-edit-button" disabled={locked} onClick={()=>startEdit(s)} title="Modifier"><Pencil size={17}/> Modifier</button><button type="button" className="ob-stand-delete-button" title="Supprimer" aria-label="Supprimer le stand" disabled={locked} onClick={()=>{if(locked)return;if(window.confirm(`Supprimer le stand « ${s.nom} » ?`))setStands(prev=>prev.filter(v=>v.id!==s.id))}}><Trash2 size={17}/></button></div></div>
        <div className="ob-stand-compact-summary"><span><Users size={15}/> {count(s)} bénévole(s)</span><span><Package size={15}/> <b>{remisStand(s)}</b> / {qteStand(s)} brioches</span><span>Reste estimé : <b>{resteStand(s)}</b></span><span>{cloture?'Décompte clôturé':'Décompte en cours'}</span></div>
        <div id={`stand-details-${s.id}`} className="ob-stand-expanded-content" hidden={!expanded}>
        <div className="ob-stand-logistics-summary">
          <span><strong>Ouverture :</strong> {s.ouverturePar||'À définir'}</span>
          <span><strong>Apport brioches :</strong> {s.apportBriochesPar||'À définir'}</span>
          <span><strong>Fermeture :</strong> {s.fermeturePar||'À définir'}</span>
          <span><strong>Reprise invendus :</strong> {s.repriseBriochesPar||'À définir'}</span>
        </div>
        <div className="ob-stand-card-grid"><div><strong><Users size={16}/> Équipe ({count(s)})</strong><p>{[...s.benevoleIds.map(id=>{const b=benevoles.find(x=>x.id===id);return b?`${b.prenom} ${b.nom}`:'Bénévole indisponible'}),s.autresBenevoles].filter(Boolean).join(' · ')||'Aucun bénévole affecté'}</p><small>Responsable : {s.responsable||'Non désigné'}</small></div>
        <div><strong><Wallet size={16}/> Caisse</strong><p>{caisses.length ? `Affectée : ${moneyless(caisses)}` : s.caissePrevue?'Prévue · non trouvée dans le planning':'Non prévue'}</p><strong><CreditCard size={16}/> TPE</strong><p>{tpes.length ? `Affecté : ${moneyless(tpes)}` : s.tpePrevu?'Prévu · non trouvé dans le planning':'Non prévu'}</p>{!s.caissePrevue && !s.tpePrevu && !caisses.length && !tpes.length && <div className="ob-stand-material-callout"><span>Aucun matériel prévu pour ce stand.</span><button type="button" className="ob-stand-material-assign" disabled={locked} onClick={()=>startMaterialChoice(s)}>Attribuer du matériel ?</button></div>}{(s.caissePrevue || s.tpePrevu) && <button type="button" className="ob-stand-material-change" disabled={locked} onClick={()=>startMaterialChoice(s)}>Modifier les besoins en matériel</button>}</div>
        <div className="ob-stand-brioches-panel"><strong><Package size={16}/> Brioches</strong><p className="ob-stand-brioches-ratio"><b>{remisStand(s)}</b> remises <span>/ {qteStand(s)} prévues</span></p><div className="ob-stand-progress"><span style={{width:`${qteStand(s)?Math.min(100,remisStand(s)/qteStand(s)*100):0}%`}} /></div><small>Reste estimé : {resteStand(s)}</small><p>{bilan.dons.length} don(s) sans brioche · {bilan.montant.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})} déclarés</p></div></div>
        {locked&&<p className="ob-stand-week-locked">🔒 Semaine figée — modification désactivée</p>}{s.notes && <p className="ob-stand-notes">{s.notes}</p>}
        </div>
      </article>
    })}</div>}
    {feuilleStandId && (() => { const sheetStand = stands.find(stand => stand.id === feuilleStandId); if (!sheetStand) return null; const caisse=assignments(sheetStand,'CAISSE'); const tpe=assignments(sheetStand,'TPE'); const bilan=counted(sheetStand); return <FeuilleStand stand={sheetStand} benevoles={benevoles} caisseLabels={caisse.map(x=>String(x.numeroMateriel))} tpeLabels={tpe.map(x=>String(x.numeroMateriel))} distributed={remisStand(sheetStand)} giftCount={bilan.dons.length} giftTotal={bilan.montant} onClose={()=>setFeuilleStandId(null)}/> })()}
    {materialStandId && <div className="ob-stand-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setMaterialStandId(null)}}><section className="ob-stand-material-modal" role="dialog" aria-modal="true" aria-labelledby="ob-material-title"><h2 id="ob-material-title">Quel matériel prévoir pour ce stand ?</h2><p>Choisissez le matériel nécessaire. Les numéros des caisses et TPE seront attribués dans le planning « Suivi Caisse & TPE ».</p><div className="ob-stand-material-options">{([{id:'caisse',label:'Une caisse'}, {id:'tpe',label:'Un TPE'}, {id:'deux',label:'Les deux : caisse et TPE'}, {id:'aucun',label:'Aucun matériel'}] as const).map(option=><label key={option.id}><input type="radio" name="stand-material-choice" checked={materialChoice===option.id} onChange={()=>setMaterialChoice(option.id)}/>{option.label}</label>)}</div><div className="ob-stand-material-footer"><button type="button" onClick={()=>setMaterialStandId(null)}>Annuler</button><button type="button" onClick={saveMaterialChoice}>Enregistrer le choix</button></div></section></div>}
    {open && <div className="ob-stand-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><form className="ob-stand-modal" onSubmit={save}>
      <div className="ob-stand-modal-header"><h2>{editId?'Modifier le stand':'Nouveau stand'}</h2><button type="button" onClick={()=>setOpen(false)} aria-label="Fermer"><X/></button></div>
      <div className="ob-stand-form">
        <label>Nom du stand *<input required value={form.nom} onChange={e=>update('nom',e.target.value)} placeholder="Ex. Stand centre-ville Lunéville"/></label>
        <label>Commune (Meurthe-et-Moselle · 54)
          <input list="ob-stand-communes-54" autoComplete="off" value={form.lieu} onChange={e=>update('lieu',e.target.value)} placeholder="Rechercher une ville, ex. Vandœuvre..." />
          <datalist id="ob-stand-communes-54">{communes54.filter(n => normalizeCommune(n).includes(normalizeCommune(form.lieu))).slice(0,70).map(n=><option key={n} value={n}/>)}</datalist>
          <small>{communes54.length > 100 ? `${communes54.length} communes disponibles` : 'Liste de secours affichée : référentiel complet chargé dès que la connexion le permet.'}</small>
        </label>
        <label>Adresse ou emplacement précis (facultatif)<input value={form.adresseStand || ''} onChange={e=>update('adresseStand',e.target.value)} placeholder="Ex. Galerie marchande, entrée principale..." /></label>
        <label>Date *<input required type="date" value={form.date} onChange={e=>update('date',e.target.value)}/></label>
        <div className="ob-stand-form-pair"><label>Début<input required type="time" value={form.debut} onChange={e=>update('debut',e.target.value)}/></label><label>Fin<input required type="time" value={form.fin} onChange={e=>update('fin',e.target.value)}/></label></div>
        <label>Statut<select value={form.statut} onChange={e=>update('statut',e.target.value)}><option>Prévu</option><option>En cours</option><option>Terminé</option></select></label>
        <label>Responsable du stand<input value={form.responsable} onChange={e=>update('responsable',e.target.value)}/></label>
        <fieldset><legend>Bénévoles (BDD)</legend><div className="ob-stand-volunteers">{benevoles.filter(b=>b.statut!=='Inactif').length ? benevoles.filter(b=>b.statut!=='Inactif').map(b=><label key={b.id}><input type="checkbox" checked={form.benevoleIds.includes(b.id)} onChange={e=>update('benevoleIds',e.target.checked?[...form.benevoleIds,b.id]:form.benevoleIds.filter(id=>id!==b.id))}/>{b.prenom} {b.nom}</label>) : <small>Aucun bénévole actif dans la base.</small>}</div></fieldset>
        <label>Autres bénévoles (séparés par une virgule)<textarea rows={2} value={form.autresBenevoles} onChange={e=>update('autresBenevoles',e.target.value)}/></label>
        <fieldset><legend>Matériel prévu</legend><label className="ob-stand-check"><input type="checkbox" checked={form.caissePrevue} onChange={e=>update('caissePrevue',e.target.checked)}/> Caisse prévue</label><label className="ob-stand-check"><input type="checkbox" checked={form.tpePrevu} onChange={e=>update('tpePrevu',e.target.checked)}/> TPE prévu</label><small>Les affectations réelles se font dans « Suivi Caisse & TPE », en utilisant le même nom de stand.</small></fieldset>
        <div className="ob-stand-fournisseur-box">
          <label className="ob-stand-fournisseur-check"><input type="checkbox" checked={Boolean(form.stockFournisseur)} disabled={!editId || livraisonFormulaire===0} onChange={e=>setForm(prev=>({...prev,stockFournisseur:e.target.checked,briochesPrevues:e.target.checked?livraisonFormulaire:prev.briochesPrevues}))}/><span>Utiliser le stock livré par les fournisseurs pour ce stand</span></label>
          <small>{!editId ? 'Enregistrez d’abord le stand, puis attribuez-lui une livraison dans Artisans ou GMS.' : livraisonFormulaire>0 ? `${livraisonFormulaire.toLocaleString('fr-FR')} brioche(s) livrée(s) à ce stand pour ${campagneId}.` : 'Aucune livraison fournisseur confirmée pour ce stand. Saisie estimative disponible.'}</small>
        </div>
        <div className="ob-stand-form-pair"><label>Brioches mises à disposition (estimation)<input type="number" min="0" step="1" disabled={Boolean(form.stockFournisseur)} value={form.stockFournisseur?livraisonFormulaire:form.briochesPrevues} onChange={e=>update('briochesPrevues',Number(e.target.value))}/></label><label>Brioches données en échange (déclaratif)<input type="number" min="0" step="1" value={form.briochesRemises} onChange={e=>update('briochesRemises',Number(e.target.value))}/></label></div>
        <fieldset className="ob-stand-logistics">
          <legend>Organisation du stand</legend>
          <p>Précise les équipes chargées de l'ouverture, de l'approvisionnement et de la fermeture.</p>
          <div className="ob-stand-logistics-grid">
            {([
              ['ouverturePar','Ouverture du stand'],
              ['apportBriochesPar','Qui apporte les brioches ?'],
              ['fermeturePar','Fermeture du stand'],
              ['repriseBriochesPar','Qui reprend les brioches restantes ?'],
            ] as const).map(([key,label])=><label key={key}>{label}
              <select value={form[key]||''} onChange={e=>update(key,e.target.value)}>
                <option value="">À définir</option>
                <option value="Bénévole">Bénévole</option>
                <option value="Sur place">Équipe sur place</option>
                <option value="Pôle communication">Pôle communication</option>
                <option value="ESAT">ESAT</option>
              </select>
            </label>)}
          </div>
        </fieldset>
        <label>Notes<textarea rows={2} value={form.notes} onChange={e=>update('notes',e.target.value)}/></label>
        {error && <p className="ob-stand-error" role="alert">{error}</p>}
      </div>
      <div className="ob-stand-modal-footer"><button type="button" onClick={()=>setOpen(false)}>Annuler</button><button type="submit">Enregistrer le stand</button></div>
    </form></div>}
  </div>
}
