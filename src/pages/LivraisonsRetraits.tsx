import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  AlertTriangle,
  Building2,
  Store,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Minus,
  Lock,
  Unlock,
  MapPin,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  Truck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'

import { useObData } from '../contexts/ObDataContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { useUsers } from '../contexts/UsersContext'
import type {
  MissionLivraison,
  ModeLivraison,
  StatutLivraison,
} from '../types/livraisons'

import './LivraisonsRetraits.css'
import './LivraisonsRetraitsSemaine.css'

type RetraitType = 'STAND' | 'ETABLISSEMENT'
type MissionAvecRetrait = MissionLivraison & { retraitType?: RetraitType }

type Tab =
  | 'GLOBAL'
  | 'BENEVOLES'
  | 'ESAT'
  | 'SERVICE_COMM'
  | 'RETRAITS'

type TourForm = {
  date: string
  mode: Exclude<ModeLivraison, 'NON_AFFECTE'>
  responsable: string
  retraitType: 'ETABLISSEMENT' | 'STAND'
  commandes: Record<string, { selected: boolean; heure: string }>
}

type BenevoleLivraison = { id:string;nom:string;prenom:string;mission?:string;statut?:string;disponibilites?:string;peutEffectuerLivraisons?:boolean;departLivraison?:string;adresseDepart?:string }
type StandLivraison = { id:string; nom:string; date:string;lieu?:string;campagne?:string }
function readArray<T>(key:string):T[] {
  try {const content:unknown=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(content)?content as T[]:[]}
  catch {return []}
}
const weekdayLabel = (date:string) => {
  const weekdays=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi']
  const [year,month,day]=date.split('-').map(Number)
  return weekdays[new Date(year,month-1,day).getDay()]
}
// Les créneaux servent à signaler une disponibilité déclarée, pas à prouver
// que le bénévole s'est engagé pour cette livraison.
function availableForDate(person:BenevoleLivraison,date:string) {
  if(!person.disponibilites?.trim()) return true
  const day=weekdayLabel(date).toLocaleLowerCase('fr')
  return person.disponibilites.toLocaleLowerCase('fr').includes(day)
}

const STORAGE_KEY = 'ob-livraisons-retraits-v1'
const MULTI_STORAGE_KEY = 'ob-livraisons-multisites-v1'
type MultiAffectation = {
  commandeId: number
  ligneId: string
  date: string
  heure: string
  mode: ModeLivraison
  responsable: string
  statut: StatutLivraison
  retraitType?: RetraitType
  commentaire?: string
}
function readMultiAffectations(): Record<string, MultiAffectation> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MULTI_STORAGE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, MultiAffectation> : {}
  } catch { return {} }
}
const keyMulti = (commandeId: number, ligneId: string) => `${commandeId}:${ligneId}`
const anneeDe = (value: string) => value.match(/(?:19|20)\d{2}/)?.[0] ?? ''

// Une livraison n'est réellement attribuée qu'avec un mode ET un responsable.
// Certaines anciennes missions peuvent conserver « Bénévole » ou « ESAT »
// alors qu'aucune personne/structure n'est sélectionnée : elles sont à attribuer.
const missionAUnResponsable = (mission: Pick<MissionLivraison, 'mode' | 'responsable'>) => {
  const responsable = mission.responsable?.trim() || ''
  if (mission.mode === 'NON_AFFECTE' || !responsable) return false
  // Les anciens libellés génériques ne désignent pas un vrai livreur.
  const valeur = responsable.toLocaleLowerCase('fr')
  const placeholders = ['non affecté', 'non affecte', 'bénévole', 'benevole', 'esat', 'services comm', 'retrait']
  return !placeholders.includes(valeur)
}
const missionDoitEtreAttribuee = (mission: Pick<MissionLivraison, 'mode' | 'responsable' | 'statut'>) =>
  mission.statut !== 'LIVREE' && !missionAUnResponsable(mission)


const MODE_LABELS: Record<ModeLivraison, string> = {
  NON_AFFECTE: 'Non affecté',
  BENEVOLE: 'Bénévole',
  ESAT: 'ESAT',
  SERVICE_COMM: 'Services Comm',
  RETRAIT: 'Retrait',
}

const STATUS_LABELS: Record<StatutLivraison, string> = {
  A_PLANIFIER: 'À planifier',
  PLANIFIEE: 'Planifiée',
  EN_COURS: 'En cours',
  LIVREE: 'Livrée',
  PROBLEME: 'Problème',
}

function todayInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 10)
}

function loadMissions(): MissionLivraison[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? (parsed as MissionLivraison[])
      : []
  } catch {
    return []
  }
}

function createMissionId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `mission-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fr')
}

function rawValue(
  value: unknown,
  key: string,
): string {
  if (
    typeof value !== 'object' ||
    value === null
  ) {
    return ''
  }

  return String(
    (value as Record<string, unknown>)[key] ?? '',
  ).trim()
}

// Navigation hebdomadaire : une semaine ISO (lundi → dimanche), puis un jour.
// Les calculs UTC évitent les décalages lors des changements d'heure.
function mondayOf(dateValue: string): string {
  const [y, m, d] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return date.toISOString().slice(0, 10)
}
function shiftDate(dateValue: string, days: number): string {
  const [y, m, d] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
function isoWeekValue(dateValue: string): string {
  const [y, m, d] = dateValue.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7))
  const year = date.getUTCFullYear()
  const start = new Date(Date.UTC(year, 0, 1))
  const week = Math.ceil((((date.getTime() - start.getTime()) / 86400000) + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}
function mondayFromWeek(value: string): string | null {
  const match = /^(\d{4})-W(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]); const week = Number(match[2])
  if (week < 1 || week > 53) return null
  const jan4 = new Date(Date.UTC(year, 0, 4))
  jan4.setUTCDate(jan4.getUTCDate() - (jan4.getUTCDay() + 6) % 7 + (week - 1) * 7)
  const monday = jan4.toISOString().slice(0, 10)
  return isoWeekValue(monday) === value ? monday : null
}
const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
function shortDate(value: string): string {
  const [, month, day] = value.split('-')
  return `${day}/${month}`
}

function formatDateLabel(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value || '—'
  }

  const [year, month, day] = value
    .split('-')
    .map(Number)

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

// Chaînes échappées avant toute utilisation dans la fenêtre d'impression.
const htmlEscape=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
} as Record<string,string>)[c])
// Route routière calculée à la demande : géocodage IGN puis OSRM Trip.
// Les services publics externes ne reçoivent que les adresses des arrêts,
// jamais les noms de clients, contacts ou quantités.
type RouteStop = { missionId:string; routeSeconds:number; arrival:string; departure:string; address:string }
type RoutePlan = { fingerprint:string; departureTime:string; totalSeconds:number; distanceMeters:number; stops:RouteStop[]; computedAt:string; warnings:string[] }
type GeoResult = { features?:Array<{geometry?:{coordinates?:number[]};properties?:{score?:number;label?:string}}> }
type TripResult = { code?:string; trips?:Array<{duration:number;distance:number;legs:Array<{duration:number;distance:number}>}>;waypoints?:Array<{waypoint_index:number}> }
const TOUR_HORAIRE_KEY='ob-livraisons-horaires-depart-v1'
const TOUR_ROUTE_KEY='ob-livraisons-routes-v1'
const STOP_MINUTES=8 // Temps de déchargement indicatif, modifiable plus tard.
function timeFromMinutes(minutes:number){
  const m=Math.round(minutes);return `${String(Math.floor(m/60)%24).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
}
function routeFingerprint(depart:string,time:string,stops:Array<{mission:{id:string};donateur:unknown;ville:string}>){
  return JSON.stringify([depart.trim(),time,stops.map(s=>[s.mission.id,rawValue(s.donateur,'adresse'),rawValue(s.donateur,'codePostal')||rawValue(s.donateur,'cp'),s.ville])])
}
function addressOf(item:{donateur:unknown;ville:string}){
  return [rawValue(item.donateur,'adresse'),rawValue(item.donateur,'codePostal')||rawValue(item.donateur,'cp'),item.ville].filter(Boolean).join(', ')
}
async function geocodeAddress(address:string):Promise<[number,number]>{
  const url=`https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(address)}&limit=1&index=address`
  const response=await fetch(url,{headers:{Accept:'application/json'}})
  if(!response.ok)throw Error(`Géocodage indisponible (HTTP ${response.status}).`)
  const result=await response.json() as GeoResult
  const place=result.features?.[0]
  const coords=place?.geometry?.coordinates
  if(!coords||coords.length<2||!coords.every(Number.isFinite))throw Error(`Adresse non trouvée : ${address}`)
  if(typeof place?.properties?.score==='number' && place.properties.score<0.45)throw Error(`Adresse ambiguë : ${address}`)
  return [coords[0],coords[1]]
}
const TOUR_DEPART_KEY='ob-livraisons-departs-v1'
const TOUR_ORDRE_KEY='ob-livraisons-ordre-v1'
const TOUR_ALERTES_KEY='ob-livraisons-reattribution-v1'
function readObject<T>(key:string):Record<string,T>{
  try{const data:unknown=JSON.parse(localStorage.getItem(key)||'{}');return data&&typeof data==='object'&&!Array.isArray(data)?data as Record<string,T>:{} }
  catch{return {}}
}
function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export default function LivraisonsRetraits() {
  const selection = useObData() as ReturnType<typeof useObData> & {selectedCampagne?: {id:string}}
  const {commandes, setCommandes, getDonateurById, activeCampagne} = selection
  const campagneAnnee = anneeDe(selection.selectedCampagne?.id ?? activeCampagne?.id ?? '')
  const { etablissements } = useEtablissements()
  const { users } = useUsers()
  const [benevolesLogistique,setBenevolesLogistique]=useState<BenevoleLivraison[]>(() => readArray('ob-bdd-benevoles-v1'))
  const [standsLogistique,setStandsLogistique]=useState<StandLivraison[]>(() => readArray('ob-stands-brioches-v1'))
  useEffect(()=>{
    const refresh=()=>{
      setBenevolesLogistique(readArray('ob-bdd-benevoles-v1'))
      setStandsLogistique(readArray('ob-stands-brioches-v1'))
    }
    window.addEventListener('focus',refresh)
    window.addEventListener('storage',refresh)
    return ()=>{window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh)}
  },[])

  const [multiAffectations, setMultiAffectations] = useState<Record<string, MultiAffectation>>(readMultiAffectations)
  useEffect(() => { localStorage.setItem(MULTI_STORAGE_KEY, JSON.stringify(multiAffectations)) }, [multiAffectations])
  const lignesMulti = useMemo(() => commandes
    .filter(commande => commande.statut !== 'ANNULEE' &&
      (campagneAnnee === '' || anneeDe(commande.campagne) === campagneAnnee))
    .flatMap(commande => (commande.livraisons ?? []).map((ligne, index) => ({
      commande, ligne, ligneId: ligne.id || `index-${index}`,
      cle: keyMulti(commande.id, ligne.id || `index-${index}`),
    }))), [commandes, campagneAnnee])
  function updateMulti(cle: string, commandeId: number, ligneId: string, dateInitiale: string, patch: Partial<MultiAffectation>) {
    setMultiAffectations(current => {
      const old = current[cle] ?? {
        commandeId, ligneId, date: dateInitiale || todayInput(), heure: '',
        mode: 'NON_AFFECTE' as ModeLivraison, responsable: '', statut: 'A_PLANIFIER' as StatutLivraison,
      }
      return {...current, [cle]: {...old, ...patch}}
    })
  }
  function setMultiStatut(item: (typeof lignesMulti)[number], status: StatutLivraison) {
    const itemState = multiAffectations[item.cle]
    const dateLivraison = itemState?.date || item.ligne.datePrevue || todayInput()
    updateMulti(item.cle, item.commande.id, item.ligneId, dateLivraison, {statut:status})
    // Une livraison partielle ne doit jamais marquer toute la commande livrée.
    setCommandes(current => current.map(commande => {
      if (commande.id !== item.commande.id) return commande
      const livraisons = (commande.livraisons ?? []).map((ligne, i) =>
        (ligne.id || `index-${i}`) === item.ligneId
          ? {...ligne, dateLivraison: status === 'LIVREE' ? dateLivraison : undefined}
          : ligne)
      const toutesLivrees = livraisons.length > 0 && livraisons.every(l => Boolean(l.dateLivraison))
      return {...commande, livraisons,
        ...(toutesLivrees ? {statut: 'LIVREE' as const, dateLivraison} : {}),
      }
    }))
  }


  const initialDate = useMemo(() => {
    const dates = commandes
      .flatMap((commande) => [commande.datePrevueLivraison, ...(commande.livraisons ?? []).map(l => l.datePrevue)])
      .filter((date): date is string => Boolean(date))
      .sort()

    const today = todayInput()
    return (
      dates.find((date) => date >= today) ||
      dates[0] ||
      today
    )
  }, [commandes])

  const [missions, setMissions] =
    useState<MissionLivraison[]>(loadMissions)

  // Le jour de travail reste mémorisé au retour sur le module.
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ob-livraisons-jour-travail-v1')
      return saved && /^\d{4}-\d{2}-\d{2}$/.test(saved) ? saved : initialDate
    } catch { return initialDate }
  })
  const [jourFige, setJourFige] = useState<boolean>(() => {
    try { return localStorage.getItem('ob-livraisons-jour-fige-v1') === 'true' }
    catch { return false }
  })
  useEffect(() => {
    try {
      localStorage.setItem('ob-livraisons-jour-travail-v1', selectedDate)
      localStorage.setItem('ob-livraisons-jour-fige-v1', String(jourFige))
    } catch { /* navigation disponible même sans stockage */ }
  }, [selectedDate, jourFige])

  const weekStart = mondayOf(selectedDate)
  const weekEnd = shiftDate(weekStart, 6)
  const daysOfWeek = Array.from({ length: 7 }, (_, index) => shiftDate(weekStart, index))
  const selectedWeek = isoWeekValue(selectedDate)
  function changeWeek(monday: string) {
    if (jourFige) return
    // Conserve le jour de semaine choisi quand on change de semaine.
    const dayOffset = daysOfWeek.indexOf(selectedDate)
    setSelectedDate(shiftDate(monday, Math.max(0, dayOffset)))
  }

  const [activeTab, setActiveTab] =
    useState<Tab>('GLOBAL')

  const [search, setSearch] = useState('')
  const [searchNonAffectees, setSearchNonAffectees] = useState('')
  const [nonAffecteesOuvertes, setNonAffecteesOuvertes] = useState(false)
  const [voirToutesDates, setVoirToutesDates] = useState(false)
  const [statusFilter, setStatusFilter] =
    useState<'TOUS' | StatutLivraison>('TOUS')
  const [modeFilter, setModeFilter] =
    useState<'TOUS' | ModeLivraison>('TOUS')
  const [responsableFilter, setResponsableFilter] =
    useState('TOUS')
  const [benevoleDeplie, setBenevoleDeplie] = useState<string | null>(null)
  const [secteurFilter, setSecteurFilter] =
    useState('TOUS')

  const [departs,setDeparts]=useState<Record<string,string>>(()=>readObject<string>(TOUR_DEPART_KEY))
  const [ordreTour,setOrdreTour]=useState<Record<string,number>>(()=>readObject<number>(TOUR_ORDRE_KEY))
  const [horairesDepart,setHorairesDepart]=useState<Record<string,string>>(()=>readObject<string>(TOUR_HORAIRE_KEY))
  const [routesCalculees,setRoutesCalculees]=useState<Record<string,RoutePlan>>(()=>readObject<RoutePlan>(TOUR_ROUTE_KEY))
  const [routeBusy,setRouteBusy]=useState<string|null>(null)
  const [routeError,setRouteError]=useState<Record<string,string>>({})
  const [alertesReattribution,setAlertesReattribution]=useState<Record<string,string>>(()=>readObject<string>(TOUR_ALERTES_KEY))
  const [tourEdit,setTourEdit]=useState<{mode:ModeLivraison;responsable:string}|null>(null)
  const [commandeAjout,setCommandeAjout]=useState('')
  useEffect(()=>{localStorage.setItem(TOUR_DEPART_KEY,JSON.stringify(departs))},[departs])
  useEffect(()=>{localStorage.setItem(TOUR_ORDRE_KEY,JSON.stringify(ordreTour))},[ordreTour])
  useEffect(()=>{localStorage.setItem(TOUR_HORAIRE_KEY,JSON.stringify(horairesDepart))},[horairesDepart])
  useEffect(()=>{localStorage.setItem(TOUR_ROUTE_KEY,JSON.stringify(routesCalculees))},[routesCalculees])
  useEffect(()=>{localStorage.setItem(TOUR_ALERTES_KEY,JSON.stringify(alertesReattribution))},[alertesReattribution])
  const [tourOpen, setTourOpen] = useState(false)
  const [detailId, setDetailId] =
    useState<string | null>(null)

  const [tourForm, setTourForm] =
    useState<TourForm>(() => ({
      date: initialDate,
      mode: 'BENEVOLE',
      responsable: '',
      retraitType: 'ETABLISSEMENT',
      commandes: {},
    }))

  // Les missions historiques restent sélectionnables, même lorsque la BDD
  // bénévole n'avait pas encore le champ explicite de livraison. On n'ajoute
  // pas de comptes inactifs ni de responsables génériques (« Bénévole », etc.).
  const responsablesProposes = useMemo(() => {
    if(tourForm.mode === 'BENEVOLE') {
      const choices = new Map<string,{id:string;label:string}>()
      for (const b of benevolesLogistique) {
        if (b.statut?.toLocaleLowerCase('fr') === 'inactif') continue
        const label = `${b.prenom || ''} ${b.nom || ''}`.trim()
        if (!label) continue
        const dejaLivreur = missions.some(m =>
          m.mode === 'BENEVOLE' && missionAUnResponsable(m) &&
          m.responsable.trim().toLocaleLowerCase('fr') === label.toLocaleLowerCase('fr'))
        const missionLivraison = /livraison|logistique|transport|chauffeur/i.test(b.mission || '')
        if (b.peutEffectuerLivraisons === true || dejaLivreur || missionLivraison) {
          // La disponibilité est indicative : elle ne doit pas cacher
          // un bénévole qui doit être exceptionnellement mobilisé.
          choices.set(label.toLocaleLowerCase('fr'),{id:b.id,label})
        }
      }
      for(const m of missions) {
        if(m.mode !== 'BENEVOLE' || !missionAUnResponsable(m)) continue
        const label=m.responsable.trim()
        if(!label) continue
        const profile=benevolesLogistique.find(b =>
          `${b.prenom || ''} ${b.nom || ''}`.trim().toLocaleLowerCase('fr')===label.toLocaleLowerCase('fr'))
        if(profile?.statut?.toLocaleLowerCase('fr')==='inactif') continue
        if(!choices.has(label.toLocaleLowerCase('fr')))
          choices.set(label.toLocaleLowerCase('fr'),{id:profile?.id||`historique:${label}`,label})
      }
      return [...choices.values()].sort((a,b)=>a.label.localeCompare(b.label,'fr'))
    }
    if(tourForm.mode === 'ESAT') return etablissements
      .filter(e=>e.statut==='ACTIF' && (
        e.type==='ESAT' || ['20','29'].includes(String(e.code ?? '').trim().replace(/^0+(?=\d)/,''))
      ))
      .map(e=>({id:e.id,label:`${e.nom}${e.ville ? ` · ${e.ville}` : ''}`}))
      .sort((a,b)=>a.label.localeCompare(b.label,'fr'))
    if(tourForm.mode === 'SERVICE_COMM') return users
      .filter(u=>u.role==='communication' && u.status==='actif')
      .map(u=>({id:u.id,label:u.name}))
    if(tourForm.retraitType === 'ETABLISSEMENT') return etablissements
      .filter(e=>e.statut==='ACTIF' && e.peutEffectuerLivraisons)
      .map(e=>({id:e.id,label:e.nom}))
    return standsLogistique
      .filter(st=>!campagneAnnee || anneeDe(st.campagne||st.date)===campagneAnnee)
      .sort((a,b)=>{
        const aToday=a.date===tourForm.date ? 0 : 1
        const bToday=b.date===tourForm.date ? 0 : 1
        return aToday-bToday || a.date.localeCompare(b.date) || a.nom.localeCompare(b.nom,'fr')
      })
      .map(st=>({id:st.id,label:`${st.nom}${st.lieu ? ` · ${st.lieu}` : ''} · ${st.date}`}))
  },[tourForm.mode,tourForm.retraitType,tourForm.date,benevolesLogistique,missions,etablissements,users,standsLogistique,campagneAnnee])

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(missions),
    )
  }, [missions])

  useEffect(() => {
    setMissions((current) => {
      let changed = false
      const next = [...current]

      for (const commande of commandes) {
        if (
          commande.statut === 'ANNULEE' ||
          ((commande.livraisons?.length ?? 0) > 0) ||
          (!commande.datePrevueLivraison &&
            !commande.dateLivraison)
        ) {
          continue
        }

        const index = next.findIndex(
          (mission) =>
            mission.commandeId === commande.id,
        )

        if (index < 0) {
          next.push({
            id: createMissionId(),
            commandeId: commande.id,
            date:
              commande.datePrevueLivraison ||
              commande.dateLivraison ||
              todayInput(),
            heure: '',
            mode: 'NON_AFFECTE',
            responsable: '',
            statut: commande.dateLivraison
              ? 'LIVREE'
              : 'A_PLANIFIER',
            commentaire: '',
            updatedAt: new Date().toISOString(),
          })
          changed = true
          continue
        }

        const mission = next[index]

        if (
          commande.dateLivraison &&
          mission.statut !== 'LIVREE'
        ) {
          next[index] = {
            ...mission,
            statut: 'LIVREE',
            updatedAt: new Date().toISOString(),
          }
          changed = true
        } else if (
          mission.mode === 'NON_AFFECTE' &&
          mission.statut === 'A_PLANIFIER' &&
          commande.datePrevueLivraison &&
          mission.date !== commande.datePrevueLivraison
        ) {
          next[index] = {
            ...mission,
            date: commande.datePrevueLivraison,
            updatedAt: new Date().toISOString(),
          }
          changed = true
        }
      }

      return changed ? next : current
    })
  }, [commandes])

  const selectedDayMissions = useMemo(
    () =>
      missions.filter(
        (mission) => mission.date === selectedDate &&
          commandes.some(c=>c.id===mission.commandeId &&
            (!campagneAnnee || anneeDe(c.campagne)===campagneAnnee)),
      ),
    [missions, selectedDate, commandes, campagneAnnee],
  )

  const commandesSimplesDuJour = useMemo(
    () =>
      selectedDayMissions
        .map((mission) => {
          const commande = commandes.find(
            (item) => item.id === mission.commandeId,
          )

          if (!commande) return null

          const donateur =
            getDonateurById(commande.donateurId)

          const contact = [
            donateur?.contactPrenom,
            donateur?.contactNom,
          ]
            .filter(Boolean)
            .join(' ')

          const secteur =
            rawValue(donateur, 'secteur') ||
            rawValue(donateur, 'responsableSecteur') ||
            ''

          return {
            mission,
            commande,
            donateur,
            nom: donateur?.nom || 'Donateur inconnu',
            ville: donateur?.ville || '',
            secteur,
            contact,
          }
        })
        .filter(
          (
            item,
          ): item is NonNullable<typeof item> =>
            item !== null,
        ),
    [
      selectedDayMissions,
      commandes,
      getDonateurById,
    ],
  )

  // Une livraison multi-sites est un arrêt à part entière, associé à une
  // commande mère unique (facturation et règlements restent inchangés).
  const enriched = useMemo(() => {
    const destinations = lignesMulti
      .filter(item => (multiAffectations[item.cle]?.date || item.ligne.datePrevue) === selectedDate)
      .map(item => {
        const affectation = multiAffectations[item.cle]
        const donneur = getDonateurById(item.commande.donateurId)
        const nom = item.ligne.destinataireNom?.trim() || 'Destination sans nom'
        const ville = item.ligne.ville || ''
        const donateur = {
          ...donneur, nom, ville,
          adresse: item.ligne.adresse || '',
          codePostal: item.ligne.cp || '',
          cp: item.ligne.cp || '',
        } as typeof donneur
        const mission: MissionAvecRetrait = {
          id: `multi:${item.cle}`,
          commandeId: item.commande.id,
          date: affectation?.date || item.ligne.datePrevue || selectedDate,
          heure: affectation?.heure || '',
          mode: affectation?.mode || 'NON_AFFECTE',
          responsable: affectation?.responsable || '',
          statut: item.ligne.dateLivraison ? 'LIVREE' : affectation?.statut || 'A_PLANIFIER',
          commentaire: affectation?.commentaire || '',
          retraitType: affectation?.retraitType,
          updatedAt: '',
        }
        return {
          mission,
          commande: { ...item.commande, quantite: item.ligne.quantite },
          donateur,
          nom, ville,
          secteur: '',
          contact: '',
        }
      })
    return [...commandesSimplesDuJour, ...destinations] as typeof commandesSimplesDuJour
  }, [commandesSimplesDuJour, lignesMulti, multiAffectations, selectedDate, getDonateurById])

  const responsables = useMemo(
    () =>
      [
        ...new Set<string>(
          enriched
            .map(
              ({ mission }) =>
                mission.responsable.trim(),
            )
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, 'fr')),
    [enriched],
  )

  const secteurs = useMemo(
    () =>
      [
        ...new Set<string>(
          enriched
            .map(
              ({ secteur, ville }) =>
                secteur || ville,
            )
            .filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b, 'fr')),
    [enriched],
  )

  const visible = useMemo(() => {
    const query = normalizeText(search)

    return enriched
      .filter(({ mission }) => {
        if (
          activeTab === 'BENEVOLES' &&
          mission.mode !== 'BENEVOLE'
        ) {
          return false
        }

        if (
          activeTab === 'ESAT' &&
          mission.mode !== 'ESAT'
        ) {
          return false
        }

        if (
          activeTab === 'SERVICE_COMM' &&
          mission.mode !== 'SERVICE_COMM'
        ) {
          return false
        }

        if (
          activeTab === 'RETRAITS' &&
          mission.mode !== 'RETRAIT'
        ) {
          return false
        }

        return true
      })
      .filter(
        ({ mission }) =>
          statusFilter === 'TOUS' ||
          mission.statut === statusFilter,
      )
      .filter(
        ({ mission }) =>
          modeFilter === 'TOUS' ||
          mission.mode === modeFilter,
      )
      .filter(
        ({ mission }) =>
          responsableFilter === 'TOUS' ||
          mission.responsable === responsableFilter,
      )
      .filter(
        ({ secteur, ville }) =>
          secteurFilter === 'TOUS' ||
          secteur === secteurFilter ||
          (!secteur && ville === secteurFilter),
      )
      .filter(
        ({
          mission,
          commande,
          nom,
          ville,
          contact,
        }) => {
          if (!query) return true

          return normalizeText(
            [
              nom,
              ville,
              contact,
              commande.numero,
              mission.responsable,
            ].join(' '),
          ).includes(query)
        },
      )
      .sort((a, b) => {
        const timeCompare =
          (a.mission.heure || '99:99').localeCompare(
            b.mission.heure || '99:99',
          )

        return (
          timeCompare ||
          a.nom.localeCompare(b.nom, 'fr')
        )
      })
  }, [
    enriched,
    activeTab,
    statusFilter,
    modeFilter,
    responsableFilter,
    secteurFilter,
    search,
  ])

  // La vue bénévoles présente des personnes, pas une liste plate de commandes.
  const benevolesDuJour = useMemo(() => benevolesLogistique
    .filter(b => (b.statut || '').toLocaleLowerCase('fr') !== 'inactif')
    .filter(b => b.peutEffectuerLivraisons === true)
    .filter(b => availableForDate(b, selectedDate))
    .map(b => ({
      id: b.id,
      nom: `${b.prenom || ''} ${b.nom || ''}`.trim(),
      disponibiliteDeclaree: Boolean(b.disponibilites?.trim()),
    }))
    .filter(b => Boolean(b.nom))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [benevolesLogistique, selectedDate])

  const groupesBenevoles = useMemo(() => {
    const map = new Map<string, {id:string; nom:string; disponibiliteDeclaree:boolean; missions:typeof visible}>()
    benevolesDuJour.forEach(b => map.set(normalizeText(b.nom), {...b, missions:[]}))
    // On conserve les missions affectées, même si la fiche bénévole a été modifiée
    // ou si la disponibilité déclarée a changé entre-temps.
    visible.filter(item => item.mission.mode === 'BENEVOLE' && item.mission.responsable.trim())
      .forEach(item => {
        const key = normalizeText(item.mission.responsable)
        if (!map.has(key)) map.set(key, {
          id: `historique-${key}`,nom: item.mission.responsable,
          disponibiliteDeclaree: false,missions: [],
        })
        map.get(key)!.missions.push(item)
      })
    return [...map.values()].sort((a,b) => a.nom.localeCompare(b.nom,'fr'))
  }, [benevolesDuJour, visible])

  // Même présentation de tournées pour les trois familles de livreurs.
  // Les ESAT et les comptes Communication viennent des BDD, auxquels on
  // ajoute les affectations historiques pour ne perdre aucune tournée.
  const groupesIntervenants = useMemo(() => {
    if (activeTab === 'BENEVOLES') return groupesBenevoles
    if (activeTab !== 'ESAT' && activeTab !== 'SERVICE_COMM') return []
    const mode: ModeLivraison = activeTab === 'ESAT' ? 'ESAT' : 'SERVICE_COMM'
    const disponibles = mode === 'ESAT'
      ? etablissements
          .filter(e => e.statut === 'ACTIF' && (
            e.type === 'ESAT' || ['20', '29'].includes(String(e.code ?? '').trim().replace(/^0+(?=\d)/, ''))
          ))
          .map(e => ({id: String(e.id), nom: `${e.nom}${e.ville ? ` · ${e.ville}` : ''}`}))
      : users
          .filter(u => u.role === 'communication' && u.status === 'actif')
          .map(u => ({id: String(u.id), nom: u.name}))
    const map = new Map<string, {id: string; nom: string; disponibiliteDeclaree: boolean; missions: typeof visible}>()
    disponibles.filter(p => p.nom.trim()).forEach(p => {
      map.set(normalizeText(p.nom), {...p, disponibiliteDeclaree: true, missions: []})
    })
    visible.filter(item => item.mission.mode === mode && missionAUnResponsable(item.mission))
      .forEach(item => {
        const key = normalizeText(item.mission.responsable)
        if (!map.has(key)) map.set(key, {
          id: `historique-${mode}-${key}`,
          nom: item.mission.responsable.trim(), disponibiliteDeclaree: true, missions: [],
        })
        map.get(key)!.missions.push(item)
      })
    return [...map.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [activeTab, groupesBenevoles, visible, etablissements, users])

  const stats = useMemo(() => {
    const unique = (mode: ModeLivraison) =>
      new Set(
        enriched
          .filter(({ mission }) => mission.mode === mode && missionAUnResponsable(mission))
          .map(({ mission }) => mission.responsable.trim()),
      ).size

    const brioches = enriched.reduce(
      (total, { commande }) =>
        total + Number(commande.quantite || 0),
      0,
    )

    const nonAffectees = enriched.filter(
      ({ mission }) =>
        missionDoitEtreAttribuee(mission),
    ).length

    const problemes = enriched.filter(
      ({ mission }) =>
        mission.statut === 'PROBLEME',
    ).length

    return {
      missions: enriched.length,
      brioches,
      benevoles: unique('BENEVOLE'),
      esat: unique('ESAT'),
      serviceComm: unique('SERVICE_COMM'),
      livrees: enriched.filter(
        ({ mission }) =>
          mission.statut === 'LIVREE',
      ).length,
      alertes: nonAffectees + problemes,
      nonAffectees,
      problemes,
    }
  }, [enriched])

  const tournees = useMemo(() => {
    const map = new Map<
      string,
      {
        mode: ModeLivraison
        responsable: string
        missions: typeof enriched
      }
    >()

    for (const item of enriched) {
      const responsable =
        item.mission.responsable ||
        (item.mission.mode === 'NON_AFFECTE'
          ? 'Non affecté'
          : MODE_LABELS[item.mission.mode])

      const key = `${item.mission.mode}::${responsable}`
      const existing = map.get(key)

      if (existing) {
        existing.missions.push(item)
      } else {
        map.set(key, {
          mode: item.mission.mode,
          responsable,
          missions: [item],
        })
      }
    }

    return [...map.values()].sort((a, b) => {
      if (a.mode === 'NON_AFFECTE') return 1
      if (b.mode === 'NON_AFFECTE') return -1
      return a.responsable.localeCompare(
        b.responsable,
        'fr',
      )
    })
  }, [enriched])

  // La colonne « Livreurs du jour » suit l’onglet actif : chaque pôle
  // ne voit que ses intervenants. La vue globale reste transversale.
  const livreursDuJour = useMemo(() => {
    const modeOnglet: Partial<Record<Tab, ModeLivraison>> = {
      BENEVOLES: 'BENEVOLE',
      ESAT: 'ESAT',
      SERVICE_COMM: 'SERVICE_COMM',
      RETRAITS: 'RETRAIT',
    }
    const modeAttendu = modeOnglet[activeTab]
    return tournees.filter(tour =>
      (!modeAttendu || tour.mode === modeAttendu) &&
      tour.mode !== 'NON_AFFECTE' &&
      tour.missions.some(item =>
        missionAUnResponsable(item.mission) && item.mission.statut !== 'LIVREE',
      ),
    )
  }, [tournees, activeTab])

  const selectedDetail = detailId
    ? enriched.find(
        ({ mission }) => mission.id === detailId,
      ) ?? null
    : null

  const eligibleCommandes = useMemo(
    () => commandes
      .filter(commande => {
        if (commande.statut === 'ANNULEE' || commande.statut === 'LIVREE' ||
            commande.dateLivraison || (commande.livraisons?.length ?? 0) > 0 ||
            (campagneAnnee && anneeDe(commande.campagne) !== campagneAnnee)) return false
        const commandesMissions = missions.filter(m => m.commandeId === commande.id)
        return commandesMissions.length === 0 ||
          commandesMissions.every(missionDoitEtreAttribuee)
      })
      .sort((a, b) => a.numero.localeCompare(b.numero, 'fr', { numeric: true })),
    [commandes, campagneAnnee, missions],
  )

  // Les commandes simples et chaque adresse multi-sites sont proposées dans
  // un seul sélecteur, sans risque de doublon sur une même destination.
  const eligibleStops = useMemo(() => [
    ...eligibleCommandes.map(commande => {
      const donneur = getDonateurById(commande.donateurId)
      return { key: `simple:${commande.id}`, label: donneur?.nom || 'Donateur inconnu',
        numero: commande.numero, quantite: commande.quantite, ville: donneur?.ville || '', multi: false }
    }),
    ...lignesMulti.filter(item => {
      const state=multiAffectations[item.cle]
      return !item.ligne.dateLivraison && (!state || missionDoitEtreAttribuee(state))
    }).map(item => ({ key: `multi:${item.cle}`,
      label: item.ligne.destinataireNom || 'Destination sans nom',
      numero: item.commande.numero, quantite: item.ligne.quantite,
      ville: item.ligne.ville || '', multi: true })),
  ], [eligibleCommandes, lignesMulti, multiAffectations, getDonateurById])

  // Une destination = une bannette à la date prévue, quel que soit le mode
  // initialement choisi. Les commandes multi-sites restent indépendantes.
  const datesNonAffectees = useMemo(() => {
    const byKey = new Map<string,string>()
    for (const commande of eligibleCommandes) {
      const mission = missions.find(m => m.commandeId === commande.id && missionDoitEtreAttribuee(m))
      byKey.set(`simple:${commande.id}`, mission?.date || commande.datePrevueLivraison || '')
    }
    for (const item of lignesMulti) {
      const key = `multi:${item.cle}`
      if (eligibleStops.some(stop => stop.key === key))
        byKey.set(key, multiAffectations[item.cle]?.date || item.ligne.datePrevue || '')
    }
    return byKey
  }, [eligibleCommandes, missions, lignesMulti, multiAffectations, eligibleStops])
  const nonAffecteesPourDate = (date: string) => eligibleStops.filter(stop => datesNonAffectees.get(stop.key) === date)
  // Le sélecteur d'une tournée suit la bannette de la date du formulaire,
  // et non la totalité des destinations encore libres dans la campagne.
  const stopsDisponiblesTour = eligibleStops.filter(stop => datesNonAffectees.get(stop.key) === tourForm.date)
  const nombreNonAffecteesJour = nonAffecteesPourDate(selectedDate).length
  const quantiteNonAffecteeJour = nonAffecteesPourDate(selectedDate).reduce((sum,stop) => sum + Number(stop.quantite || 0),0)

  // La liste des livraisons sans affectation utilise exactement la même
  // source que « Planifier une tournée » : commandes simples ET chaque
  // destination multi-sites, y compris celles prévues un autre jour.
  // La date prévue est affichée pour éviter de confondre avec le jour ouvert.
  const nonAffecteesDuJour = useMemo(() => {
    const query = normalizeText(searchNonAffectees)
    const result = eligibleStops.map(stop => {
      if (stop.multi) {
        const line = lignesMulti.find(item => `multi:${item.cle}` === stop.key)
        if (!line) return null
        const donneur = getDonateurById(line.commande.donateurId)
        const affectation = multiAffectations[line.cle]
        const datePrevue = affectation?.date || line.ligne.datePrevue || ''
        const mission: MissionAvecRetrait = {
          id: stop.key,
          commandeId: line.commande.id,
          date: datePrevue || selectedDate,
          heure: affectation?.heure || '',
          mode: 'NON_AFFECTE',
          responsable: '',
          statut: 'A_PLANIFIER',
          commentaire: affectation?.commentaire || '',
          retraitType: affectation?.retraitType,
          updatedAt: '',
        }
        return {
          mission,
          commande: { ...line.commande, quantite: line.ligne.quantite },
          nom: stop.label,
          ville: stop.ville,
          contact: [donneur?.contactPrenom, donneur?.contactNom].filter(Boolean).join(' '),
          secteur: '',
          datePrevue,
        }
      }
      const commande = eligibleCommandes.find(item => `simple:${item.id}` === stop.key)
      if (!commande) return null
      const donneur = getDonateurById(commande.donateurId)
      const existante = missions.find(item => item.commandeId === commande.id)
      const datePrevue = existante?.date || commande.datePrevueLivraison || ''
      const mission: MissionLivraison = existante && missionDoitEtreAttribuee(existante)
        ? existante
        : {
          id: stop.key,
          commandeId: commande.id,
          date: datePrevue || selectedDate,
          heure: '',
          mode: 'NON_AFFECTE',
          responsable: '',
          statut: 'A_PLANIFIER',
          commentaire: '',
          updatedAt: '',
        }
      return {
        mission,
        commande,
        nom: stop.label,
        ville: stop.ville,
        contact: [donneur?.contactPrenom, donneur?.contactNom].filter(Boolean).join(' '),
        secteur: rawValue(donneur, 'secteur') || rawValue(donneur, 'responsableSecteur') || '',
        datePrevue,
      }
    }).filter((item): item is NonNullable<typeof item> => item !== null)
    return result.filter(item => {
      if (!voirToutesDates && item.datePrevue !== selectedDate) return false
      if (secteurFilter !== 'TOUS' && item.secteur !== secteurFilter && item.ville !== secteurFilter) return false
      if (!query) return true
      return normalizeText([item.nom, item.ville, item.contact, item.commande.numero, item.datePrevue].join(' ')).includes(query)
    }).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [eligibleStops, eligibleCommandes, lignesMulti, multiAffectations, missions, selectedDate,
      getDonateurById, searchNonAffectees, secteurFilter, voirToutesDates])

  function changeTab(tab: Tab) {
    setActiveTab(tab)
    setStatusFilter('TOUS')
    setModeFilter('TOUS')
    setResponsableFilter('TOUS')
  }

  function tabForMode(mode: ModeLivraison): Tab {
    if (mode === 'BENEVOLE') return 'BENEVOLES'
    if (mode === 'ESAT') return 'ESAT'
    if (mode === 'SERVICE_COMM') return 'SERVICE_COMM'
    if (mode === 'RETRAIT') return 'RETRAITS'
    return 'GLOBAL'
  }

  function openTour(preselectedKey?: string) {
    const commandState: TourForm['commandes'] = {}

    for (const stop of nonAffecteesPourDate(selectedDate)) {
      commandState[stop.key] = { selected: stop.key === preselectedKey, heure: '' }
    }

    setTourForm({
      date: selectedDate,
      mode: 'BENEVOLE',
      responsable: '',
      retraitType: 'ETABLISSEMENT',
      commandes: commandState,
    })

    setTourOpen(true)
  }

  function saveTour(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const selectedKeys = Object.entries(tourForm.commandes)
      .filter(([,value]) => value.selected)
      .map(([key]) => key)
    const validKeys = new Set(stopsDisponiblesTour.map(stop => stop.key))
    if(selectedKeys.some(key => !validKeys.has(key))){
      window.alert('Une destination vient d’être affectée à une autre tournée. Actualise la liste.');return
    }
    const selectedIds = selectedKeys.filter(key=>key.startsWith('simple:')).map(key=>Number(key.slice(7)))
    const multiKeys = selectedKeys.filter(key=>key.startsWith('multi:')).map(key=>key.slice(6))

    if (selectedKeys.length === 0) {
      window.alert(
        'Sélectionne au moins une commande.',
      )
      return
    }

    const responsable = tourForm.responsable.trim()
    if(!responsablesProposes.some(option=>option.label===responsable)) {
      window.alert('Sélectionne un responsable dans la liste correspondant au mode choisi.')
      return
    }

    if (!responsable) {
      window.alert(
        'Renseigne la personne ou la structure responsable.',
      )
      return
    }

    if(selectedIds.some(id=>missions.some(m=>m.commandeId===id && !missionDoitEtreAttribuee(m)))){
      window.alert('Une commande a déjà été affectée à une tournée. Actualise la liste avant de continuer.');return
    }
    if(multiKeys.some(key => {
      const state=multiAffectations[key]
      return state && !missionDoitEtreAttribuee(state)
    })){
      window.alert('Une destination multi-sites est déjà affectée.');return
    }
    if(multiKeys.length){
      setMultiAffectations(current => {
        const next={...current}
        for(const key of multiKeys){
          const item=lignesMulti.find(line=>line.cle===key)
          if(!item) continue
          next[key]={commandeId:item.commande.id,ligneId:item.ligneId,
            date:tourForm.date,heure:tourForm.commandes[`multi:${key}`]?.heure||'',
            mode:tourForm.mode,responsable,statut:'PLANIFIEE',
            retraitType:tourForm.mode==='RETRAIT'?tourForm.retraitType:undefined,
            commentaire:current[key]?.commentaire||''}
        }
        return next
      })
      setAlertesReattribution(prev=>{
        const next={...prev};multiKeys.forEach(key=>delete next[`multi:${key}`]);return next
      })
    }
    const now = new Date().toISOString()

    setMissions((current) => {
      const next = [...current]

      for (const commandeId of selectedIds) {
        const currentMissionIndex = next.findIndex(
          (mission) => mission.commandeId === commandeId,
        )

        const heure =
          tourForm.commandes[`simple:${commandeId}`]?.heure ||
          ''

        if (currentMissionIndex >= 0) {
          next[currentMissionIndex] = {
            ...next[currentMissionIndex],
            mode: tourForm.mode,
            responsable,
            retraitType: tourForm.mode === 'RETRAIT' ? tourForm.retraitType : undefined,
            date: tourForm.date,
            heure,
            statut:
              next[currentMissionIndex].statut ===
              'LIVREE'
                ? 'LIVREE'
                : 'PLANIFIEE',
            updatedAt: now,
          }
        } else {
          next.push({
            id: createMissionId(),
            commandeId,
            date: tourForm.date,
            heure,
            mode: tourForm.mode,
            responsable,
            retraitType: tourForm.mode === 'RETRAIT' ? tourForm.retraitType : undefined,
            statut: 'PLANIFIEE',
            commentaire: '',
            updatedAt: now,
          } as MissionAvecRetrait)
        }
      }

      return next
    })

    setCommandes((current) =>
      current.map((commande) =>
        selectedIds.includes(commande.id)
          ? {
              ...commande,
              datePrevueLivraison: tourForm.date,
            }
          : commande,
      ),
    )

    setAlertesReattribution(prev=>{const next={...prev};selectedIds.forEach(id=>delete next[String(id)]);return next})
    if (!jourFige) setSelectedDate(tourForm.date)
    setTourOpen(false)
  }

  function updateMission(
    id: string,
    patch: Partial<MissionLivraison>,
  ) {
    if(id.startsWith('multi:')){
      const key=id.slice(6)
      const item=lignesMulti.find(line=>line.cle===key)
      if(item) updateMulti(key,item.commande.id,item.ligneId,item.ligne.datePrevue,patch)
      return
    }
    setMissions((current) =>
      current.map((mission) =>
        mission.id === id
          ? {
              ...mission,
              ...patch,
              updatedAt: new Date().toISOString(),
            }
          : mission,
      ),
    )
  }

  function setMissionStatus(
    mission: MissionLivraison,
    statut: StatutLivraison,
  ) {
    if(mission.id.startsWith('multi:')){
      const item=lignesMulti.find(line=>line.cle===mission.id.slice(6))
      if(item) setMultiStatut(item,statut)
      return
    }
    updateMission(mission.id, { statut })

    if (statut === 'LIVREE') {
      setCommandes((current) =>
        current.map((commande) =>
          commande.id === mission.commandeId
            ? {
                ...commande,
                statut: 'LIVREE',
                dateLivraison: mission.date,
              }
            : commande,
        ),
      )
    }
  }

  // Préserver les anciens retraits : si le type n'était pas stocké, tenter
  // une reconnaissance sûre à partir des structures de référence.
  function typeRetraitPourMission(mission:MissionLivraison): RetraitType | undefined {
    if(mission.mode !== 'RETRAIT') return undefined
    const saved=(mission as MissionAvecRetrait).retraitType
    if(saved === 'STAND' || saved === 'ETABLISSEMENT') return saved
    const label=mission.responsable.trim().toLocaleLowerCase('fr')
    if(!label) return undefined
    const stand=standsLogistique.some(st=>
      label === st.nom.trim().toLocaleLowerCase('fr') ||
      label.startsWith(`${st.nom.trim().toLocaleLowerCase('fr')} · `))
    const etablissement=etablissements.some(et=>
      label === et.nom.trim().toLocaleLowerCase('fr'))
    if(stand !== etablissement) return stand ? 'STAND' : 'ETABLISSEMENT'
    return undefined
  }

  const tourKey=(mode:ModeLivraison,responsable:string)=>`${selectedDate}|${mode}|${responsable}`
  const missionsDeTour=(mode:ModeLivraison,responsable:string)=>enriched
    .filter(item=>item.mission.mode===mode && item.mission.responsable===responsable)
    .sort((a,b)=>(ordreTour[a.mission.id]??9999)-(ordreTour[b.mission.id]??9999) ||
       a.ville.localeCompare(b.ville,'fr') || a.nom.localeCompare(b.nom,'fr'))

  function enleverDeTour(mission:MissionLivraison){
    if(mission.statut==='LIVREE') {window.alert('Livraison déjà effectuée : elle ne peut pas être retirée sans procédure de correction.');return}
    if(!window.confirm('Retirer cette livraison de la tournée ? Elle sera signalée comme À RÉATTRIBUER.')) return
    if(mission.id.startsWith('multi:')){
      const key=mission.id.slice(6)
      const item=lignesMulti.find(line=>line.cle===key)
      if(item) updateMulti(key,item.commande.id,item.ligneId,item.ligne.datePrevue,{
        mode:'NON_AFFECTE',responsable:'',heure:'',statut:'A_PLANIFIER',retraitType:undefined
      })
      setAlertesReattribution(prev=>({...prev,[mission.id]:'Destination multi-sites à réattribuer'}))
      return
    }
    setMissions(current=>current.map(m=>m.id===mission.id?{
      ...m,mode:'NON_AFFECTE',responsable:'',heure:'',statut:'A_PLANIFIER',retraitType:undefined,updatedAt:new Date().toISOString()
    }:m))
    setAlertesReattribution(prev=>({...prev,[String(mission.commandeId)]:'Commande retirée de la tournée, à réattribuer'}))
  }

  function ajouterATour(mode:ModeLivraison,responsable:string){
    const key=commandeAjout
    if(!eligibleStops.some(stop=>stop.key===key)){
      window.alert('Sélectionne une destination non affectée.');return
    }
    if(key.startsWith('multi:')){
      const multiKey=key.slice(6)
      const item=lignesMulti.find(line=>line.cle===multiKey)
      if(!item)return
      updateMulti(multiKey,item.commande.id,item.ligneId,item.ligne.datePrevue,{
        date:selectedDate,heure:'',mode,responsable,statut:'PLANIFIEE'
      })
      setAlertesReattribution(prev=>{const next={...prev};delete next[key];return next})
      setCommandeAjout('');setTourEdit(null)
      return
    }
    const commandeId=Number(key.slice(7))
    setMissions(current=>{
      if(current.some(m=>m.commandeId===commandeId && !missionDoitEtreAttribuee(m)))return current
      const old=current.find(m=>m.commandeId===commandeId)
      return old?current.map(m=>m.id===old.id?{...m,date:selectedDate,mode,responsable,heure:'',statut:'PLANIFIEE',updatedAt:new Date().toISOString()}:m):[
        ...current,{id:createMissionId(),commandeId,date:selectedDate,mode,responsable,heure:'',statut:'PLANIFIEE',commentaire:'',updatedAt:new Date().toISOString()}]
    })
    setCommandes(current=>current.map(c=>c.id===commandeId?{...c,datePrevueLivraison:selectedDate}:c))
    setAlertesReattribution(prev=>{const next={...prev};delete next[String(commandeId)];return next})
    setCommandeAjout('');setTourEdit(null)
  }

  function bougerArret(mode:ModeLivraison,responsable:string,missionId:string,direction:-1|1){
    const stops=missionsDeTour(mode,responsable)
    const i=stops.findIndex(x=>x.mission.id===missionId)
    const j=i+direction
    if(i<0||j<0||j>=stops.length)return
    const next=[...stops];[next[i],next[j]]=[next[j],next[i]]
    setOrdreTour(old=>({...old,...Object.fromEntries(next.map((x,k)=>[x.mission.id,k]))}))
  }

  function planValide(mode:ModeLivraison,responsable:string){
    const key=tourKey(mode,responsable)
    const stops=missionsDeTour(mode,responsable)
    const plan=routesCalculees[key]
    return plan?.fingerprint===routeFingerprint(departs[key]||'',horairesDepart[key]||'',stops)?plan:null
  }

  async function calculerItineraire(mode:ModeLivraison,responsable:string){
    const key=tourKey(mode,responsable)
    const stops=missionsDeTour(mode,responsable)
    const depart=departs[key]?.trim()||''
    const horaire=horairesDepart[key]||''
    if(!depart||!/^([01]\d|2[0-3]):[0-5]\d$/.test(horaire)){
      setRouteError(prev=>({...prev,[key]:'Renseigne une adresse de départ précise et une heure au format HH:MM.'}));return
    }
    if(!stops.length){setRouteError(prev=>({...prev,[key]:'Cette tournée ne contient aucune livraison.'}));return}
    const incomplete=stops.filter(item=>!rawValue(item.donateur,'adresse')||!item.ville.trim())
    if(incomplete.length){
      setRouteError(prev=>({...prev,[key]:`Adresse complète manquante pour : ${incomplete.map(i=>i.nom).join(', ')}. Corrige les fiches donateurs avant le calcul.`}));return
    }
    setRouteBusy(key);setRouteError(prev=>({...prev,[key]:''}))
    try{
      const coords=await Promise.all([depart,...stops.map(addressOf)].map(geocodeAddress))
      const points=coords.map(c=>c.join(',')).join(';')
      // Open trip : départ fixé au siège, aucune obligation de revenir au siège.
      // Le service OSRM public sert de démonstrateur ; pour un déploiement
      // institutionnel, le remplacer par une instance maîtrisée et supervisée.
      const url=`https://router.project-osrm.org/trip/v1/driving/${points}?roundtrip=false&source=first&destination=any&overview=false&steps=false`
      const response=await fetch(url)
      if(!response.ok)throw Error(`Calcul routier indisponible (HTTP ${response.status}).`)
      const data=await response.json() as TripResult
      if(data.code!=='Ok'||!data.trips?.[0]||data.waypoints?.length!==coords.length)throw Error('Impossible de calculer une tournée routière avec ces adresses.')
      const route=data.trips[0]
      const sorted=stops.map((item,i)=>({item,rank:data.waypoints![i+1].waypoint_index})).sort((a,b)=>a.rank-b.rank)
      if(sorted.some(x=>x.rank<1)||route.legs.length<sorted.length)throw Error('Réponse itinéraire incomplète.')
      const [h,m]=horaire.split(':').map(Number)
      let running=h*60+m
      const computedStops:RouteStop[]=[]
      for(let i=0;i<sorted.length;i++){
        const leg=route.legs[i]
        if(!leg||!Number.isFinite(leg.duration))throw Error('Temps de route incomplet.')
        running+=leg.duration/60
        const arrival=timeFromMinutes(running)
        running+=STOP_MINUTES
        computedStops.push({missionId:sorted[i].item.mission.id,routeSeconds:leg.duration,arrival,departure:timeFromMinutes(running),address:addressOf(sorted[i].item)})
      }
      const plan:RoutePlan={
        fingerprint:routeFingerprint(depart,horaire,stops),departureTime:horaire,
        totalSeconds:sorted.reduce((n,_,i)=>n+(route.legs[i]?.duration||0),0),
        distanceMeters:sorted.reduce((n,_,i)=>n+(route.legs[i]?.distance||0),0),
        computedAt:new Date().toISOString(),stops:computedStops,
        warnings:[`Horaires indicatifs sans trafic en temps réel ; ${STOP_MINUTES} min prévues par arrêt.`, 'Vérifier les adresses et la faisabilité avant validation.'],
      }
      // Le nouvel ordre s'enregistre explicitement, mais la route garde sa
      // signature d'origine jusqu'au calcul suivant.
      setOrdreTour(old=>({...old,...Object.fromEntries(sorted.map((s,i)=>[s.item.mission.id,i]))}))
      setRoutesCalculees(old=>({...old,[key]:{...plan,fingerprint:routeFingerprint(depart,horaire,sorted.map(s=>s.item))}}))
    }catch(error){setRouteError(prev=>({...prev,[key]:error instanceof Error?error.message:'Erreur du service cartographique.'}))}
    finally{setRouteBusy(null)}
  }

  // Téléchargement direct d'un PDF A4 (sans fenêtre d'impression).
  // jsPDF est déjà employé par les autres modules d'Opération Brioche.
  async function telechargerTourPdf(mode:ModeLivraison,responsable:string){
    const stops=missionsDeTour(mode,responsable)
    if(!stops.length){window.alert('Aucune livraison à exporter pour cette tournée.');return}
    try{
      const {jsPDF}=await import('jspdf')
      const doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true})
      const W=210,H=297, margin=12, usable=W-2*margin
      const ink:[number,number,number]=[24,49,79]
      const muted:[number,number,number]=[92,111,132]
      const light:[number,number,number]=[234,240,246]
      const border:[number,number,number]=[190,204,217]
      const depart=departs[tourKey(mode,responsable)]?.trim()||'Non renseigné'
      const plan=planValide(mode,responsable)
      const quantities=stops.reduce((sum,item)=>sum+Number(item.commande.quantite||0),0)
      const value=(input:unknown)=>String(input??'').trim()||'—'
      const text=(str:unknown,x:number,y:number,opt?:{maxWidth?:number;align?:'left'|'center'|'right'})=>{
        doc.setTextColor(...ink)
        doc.text(value(str),x,y,opt)
      }
      const label=(str:string,x:number,y:number)=>{
        doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(...muted);doc.text(str,x,y)
      }
      const wrap=(str:unknown,maxWidth:number)=>doc.splitTextToSize(value(str),maxWidth) as string[]
      const drawPageHeader=(title:string,subtitle:string)=>{
        doc.setFillColor(...ink);doc.roundedRect(margin,11,15,15,2.5,2.5,'F')
        doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('OB',margin+7.5,20.6,{align:'center'})
        doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(17);doc.text(title,margin+20,17)
        doc.setFont('helvetica','normal');doc.setFontSize(9);doc.setTextColor(...muted);doc.text(subtitle,margin+20,23)
        doc.setDrawColor(...border);doc.line(margin,30,W-margin,30)
      }
      const drawFooter=()=>{
        doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...muted)
        doc.text('Opération Brioche • Document logistique',margin,H-8)
        doc.text(String(doc.getCurrentPageInfo().pageNumber),W-margin,H-8,{align:'right'})
      }
      const drawSummary=()=>{
        drawPageHeader('Feuille de tournée',`${formatDateLabel(selectedDate)}  •  ${responsable}`)
        let y=39
        doc.setFillColor(247,249,251);doc.setDrawColor(...border)
        doc.roundedRect(margin,y,usable,40,3,3,'FD')
        label('LIVREUR / RESPONSABLE',margin+5,y+7)
        doc.setFont('helvetica','bold');doc.setFontSize(11);text(responsable,margin+5,y+13)
        label('POINT DE DÉPART',margin+5,y+21)
        doc.setFont('helvetica','normal');doc.setFontSize(9)
        const depLines=wrap(depart,usable-10).slice(0,2);doc.text(depLines,margin+5,y+27)
        y+=47
        const stats=[
          [`${stops.length}`,'LIVRAISONS'],
          [`${quantities}`,'BRIOCHES'],
          [plan?`${(plan.distanceMeters/1000).toFixed(1)} km`:'—','DISTANCE'],
          [plan?`${Math.round(plan.totalSeconds/60)} min`:'—','TRAJET'],
        ] as const
        const statW=(usable-9)/4
        stats.forEach(([v,l],i)=>{
          const x=margin+i*(statW+3)
          doc.setDrawColor(...border);doc.roundedRect(x,y,statW,20,2.5,2.5,'S')
          doc.setFont('helvetica','bold');doc.setFontSize(12);text(v,x+4,y+9)
          label(l,x+4,y+15)
        })
        y+=28
        doc.setFont('helvetica','bold');doc.setFontSize(9)
        text(`Départ : ${plan?.departureTime||'À renseigner'}`,margin,y)
        text(`Dernière arrivée : ${plan?.stops.at(-1)?.arrival||'À calculer'}`,W-margin,y,{align:'right'})
        y+=11
        doc.setFillColor(...light);doc.rect(margin,y-7,usable,9,'F')
        label('N°',margin+2,y-1);label('DESTINATAIRE ET ADRESSE',margin+12,y-1)
        label('BRIOCHES',W-margin-55,y-1);label('HEURE',W-margin-19,y-1)
        y+=3
        stops.forEach((item,i)=>{
          const arrival=plan?.stops.find(st=>st.missionId===item.mission.id)?.arrival||item.mission.heure||'À prévoir'
          const address=[item.donateur?.adresse,item.ville].filter(Boolean).join(' · ')
          const recipient=wrap(item.nom,100)
          const addr=wrap(address,100)
          const rowHeight=Math.max(18,8+recipient.length*4+Math.min(addr.length,2)*3.4)
          if(y+rowHeight>H-19){drawFooter();doc.addPage();drawPageHeader('Suite de la tournée',`${formatDateLabel(selectedDate)}  •  ${responsable}`);y=38}
          if(i%2===0){doc.setFillColor(250,251,253);doc.rect(margin,y-2,usable,rowHeight,'F')}
          doc.setFont('helvetica','bold');doc.setFontSize(9)
          text(`${i+1}.`,margin+2,y+5)
          doc.text(recipient,margin+12,y+5)
          doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...muted)
          doc.text(addr.slice(0,2),margin+12,y+5+recipient.length*4)
          doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(9)
          text(item.commande.quantite,W-margin-52,y+5)
          text(arrival,W-margin-19,y+5)
          y+=rowHeight
          doc.setDrawColor(...light);doc.line(margin,y-2,W-margin,y-2)
        })
        if(y+16<H-18){doc.setFont('helvetica','normal');doc.setFontSize(8);doc.setTextColor(...muted);doc.text('Horaires indicatifs, hors trafic en temps réel. Faire signer chaque bon au destinataire.',margin,y+9)}
        drawFooter()
      }
      drawSummary()
      // Chaque nouvelle page contient exactement trois emplacements de bons.
      // 3 x 85 mm + 2 x 5 mm = 265 mm dans la zone de 273 mm (marges 12 mm).
      const cardHeight=85, gap=5
      for(let pageStart=0;pageStart<stops.length;pageStart+=3){
        doc.addPage()
        for(let slot=0;slot<3;slot++){
          const index=pageStart+slot
          const item=stops[index]
          if(!item)break
          const x=margin, top=12+slot*(cardHeight+gap)
          doc.setDrawColor(...border);doc.setLineWidth(.3)
          doc.roundedRect(x,top,usable,cardHeight,3,3,'S')
          doc.setFillColor(...ink);doc.roundedRect(x+3,top+4,12,12,2,2,'F')
          doc.setFont('helvetica','bold');doc.setTextColor(255,255,255);doc.setFontSize(9)
          doc.text('OB',x+9,top+11.6,{align:'center'})
          doc.setTextColor(...ink);doc.setFont('helvetica','bold');doc.setFontSize(8)
          doc.text('OPÉRATION BRIOCHE  •  BON DE LIVRAISON',x+19,top+8)
          doc.setFontSize(13)
          const recipient=wrap(item.nom,115).slice(0,2)
          doc.text(recipient,x+19,top+14)
          doc.setFontSize(9);doc.setFont('helvetica','bold')
          doc.text(`${index+1} / ${stops.length}`,W-margin-5,top+10,{align:'right'})
          doc.setDrawColor(...border);doc.line(x+4,top+22,W-margin-4,top+22)
          const cols=[x+5,x+82,x+134]
          const labels=['COMMANDE','BRIOCHES À REMETTRE','HEURE PRÉVUE']
          const arrival=plan?.stops.find(st=>st.missionId===item.mission.id)?.arrival||item.mission.heure||'—'
          const vals=[value(item.commande.numero),`${value(item.commande.quantite)} brioches`,value(arrival)]
          cols.forEach((col,k)=>{
            label(labels[k],col,top+29)
            doc.setFont('helvetica','bold');doc.setFontSize(9);text(vals[k],col,top+35,{maxWidth:k===0?70:46})
          })
          const address=[item.donateur?.adresse,item.ville].filter(Boolean).join(' · ')
          label('DESTINATAIRE / ADRESSE',x+5,top+43)
          doc.setFont('helvetica','normal');doc.setFontSize(9)
          const addrLines=wrap(address,usable-12).slice(0,2)
          doc.text(addrLines,x+5,top+49)
          const sy=top+59
          doc.setDrawColor(...border);doc.setLineDashPattern([1.5,1],0)
          doc.roundedRect(x+4,sy,usable-8,21,2,2,'S');doc.setLineDashPattern([],0)
          doc.setFont('helvetica','normal');doc.setFontSize(8.5)
          text('Quantité reçue : __________',x+8,sy+6)
          text('Date / heure : ______________',x+94,sy+6)
          doc.setFont('helvetica','bold');doc.setFontSize(8)
          text('Signature et tampon du destinataire :',x+8,sy+13)
          if(slot<2&&index+1<stops.length){
            doc.setDrawColor(120,136,153);doc.setLineWidth(.2);doc.setLineDashPattern([2,1.5],0)
            const cutY=top+cardHeight+gap/2
            doc.line(x,cutY,W-margin,cutY);doc.setLineDashPattern([],0)
          }
        }
      }
      const safeName=responsable.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'')||'livreur'
      doc.save(`Operation_Brioche_Tournee_${selectedDate}_${safeName}.pdf`)
    }catch(error){
      console.error('Erreur de génération du PDF de tournée',error)
      window.alert('Impossible de télécharger le PDF. Vérifie que le module jsPDF est disponible.')
    }
  }

  function imprimerTour(mode:ModeLivraison,responsable:string){
    const stops=missionsDeTour(mode,responsable)
    if(!stops.length)return
    const departure=departs[tourKey(mode,responsable)]?.trim()||'Non renseigné'
    const plan=planValide(mode,responsable)
    const qty=stops.reduce((sum,item)=>sum+Number(item.commande.quantite||0),0)
    const rows=stops.map((item,i)=>{
      const arrival=plan?.stops.find(s=>s.missionId===item.mission.id)?.arrival||item.mission.heure||'À prévoir'
      return `<tr><td class="number">${i+1}</td><td><b>${htmlEscape(item.nom)}</b><span class="muted destination">${htmlEscape(item.donateur?.adresse??'')} · ${htmlEscape(item.ville)}</span></td><td>${htmlEscape(item.commande.numero)}</td><td class="center">${htmlEscape(item.commande.quantite)}</td><td class="center"><b>${htmlEscape(arrival)}</b></td></tr>`
    }).join('')
    // A4 : marge 9 mm -> 279 mm utiles. Trois bons de 85 mm, séparés par 5 mm.
    // La réserve de 14 mm évite qu'une bordure ou la mise à l'échelle ajoute une page.
    const bonsParPage=3
    const pagesBons=Array.from({length:Math.ceil(stops.length/bonsParPage)},(_,pageIndex)=>{
      const cards=stops.slice(pageIndex*bonsParPage,(pageIndex+1)*bonsParPage).map((item,localIndex)=>{
        const i=pageIndex*bonsParPage+localIndex
        const arrival=plan?.stops.find(s=>s.missionId===item.mission.id)?.arrival||item.mission.heure||'—'
        return `<article class="bon-card">
          <div class="bon-top"><div class="bon-logo">OB</div><div class="bon-title"><span class="bon-kicker">OPÉRATION BRIOCHE · BON DE LIVRAISON</span><h2>${htmlEscape(item.nom)}</h2></div><div class="bon-index">${i+1} / ${stops.length}</div></div>
          <div class="bon-grid">
            <div><span class="field-label">COMMANDE</span><strong>${htmlEscape(item.commande.numero)}</strong></div>
            <div><span class="field-label">BRIOCHES À REMETTRE</span><strong>${htmlEscape(item.commande.quantite)}</strong></div>
            <div><span class="field-label">HEURE PRÉVUE</span><strong>${htmlEscape(arrival)}</strong></div>
          </div>
          <div class="bon-address"><b>Adresse :</b> ${htmlEscape(item.donateur?.adresse??'')} ${htmlEscape(item.ville)} <span class="muted">· Campagne ${htmlEscape(item.commande.campagne)}</span></div>
          <div class="receipt"><div class="receipt-fields"><div><b>Quantité reçue :</b> _______________</div><div><b>Date / heure :</b> _______________</div></div><div class="signature-label">Signature et tampon du destinataire</div><div class="sign-space"></div></div>
          <div class="cut"><span>✂ &nbsp; Bon détachable</span></div>
        </article>`
      }).join('')
      return `<section class="bons-page" aria-label="Bons de livraison, feuille ${pageIndex+1}">${cards}</section>`
    }).join('')
    const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Livraisons · ${htmlEscape(responsable)} · ${htmlEscape(selectedDate)}</title><style>
      @page{size:A4 portrait;margin:9mm}
      *{box-sizing:border-box}html,body{margin:0;padding:0}body{font:11px/1.4 Arial,Helvetica,sans-serif;color:#172d49;background:white}
      h1,h2,p{margin:0}.muted{color:#65758a}.center{text-align:center}.number{font-weight:bold;text-align:center}
      .summary-head{display:flex;align-items:center;gap:12px;border-bottom:2px solid #233d5b;padding:0 0 12px;margin-bottom:15px}
      .logo{width:52px;height:52px;display:flex;align-items:center;justify-content:center;border:2px solid #233d5b;border-radius:12px;font-weight:900;font-size:21px;flex-shrink:0}
      .summary-title{flex:1}.eyebrow{font-weight:700;letter-spacing:1px;font-size:9px;text-transform:uppercase}.summary-title h1{font-size:24px;color:#172d49;line-height:1.2;margin:4px 0}
      .head-counter{font-size:11px;text-align:right;border:1px solid #becbd7;padding:8px 12px;border-radius:9px}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:9px 18px;border:1px solid #c9d4df;background:#f5f7f9;padding:13px;border-radius:10px;margin-bottom:14px}
      .meta span{display:block;color:#64758a;text-transform:uppercase;font-size:9px;letter-spacing:.4px}.meta strong{font-size:12px}
      .stats{display:flex;gap:9px;margin-bottom:13px}.stat{flex:1;border:1px solid #cdd6df;border-radius:9px;padding:10px 12px}.stat b{font-size:17px;display:block}.stat small{font-size:9px;color:#60738a;text-transform:uppercase}
      .section-title{font-size:13px;margin:16px 0 8px}.route-table{width:100%;border-collapse:collapse;table-layout:fixed}
      .route-table th,.route-table td{border-bottom:1px solid #d4dce5;padding:9px 7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
      .route-table th{font-size:9px;text-transform:uppercase;background:#eef1f5;border-top:1px solid #cbd5e0}
      .route-table th:nth-child(1){width:7%}.route-table th:nth-child(2){width:41%}.route-table th:nth-child(3){width:21%}.route-table th:nth-child(4){width:13%}.route-table th:nth-child(5){width:18%}
      .destination{display:block;font-size:10px;margin-top:3px}.route-note{border-left:3px solid #233d5b;padding:9px 12px;background:#f6f8fa;margin-top:15px;font-size:10px}
      .summary-foot{font-size:10px;color:#65758a;margin-top:18px;display:flex;justify-content:space-between;gap:15px}
      .bons-page{break-before:page;page-break-before:always;height:265mm;display:flex;flex-direction:column;gap:5mm;align-content:start}
      .bon-card{height:85mm;flex:0 0 85mm;border:1px solid #718298;border-radius:9px;padding:10px 12px 7px;position:relative;break-inside:avoid;page-break-inside:avoid;overflow:hidden}
      .bon-top{display:flex;align-items:center;gap:9px;border-bottom:1px solid #c9d3df;padding-bottom:6px;margin-bottom:7px}
      .bon-logo{width:30px;height:30px;border:1.5px solid #233d5b;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;flex-shrink:0}
      .bon-title{flex:1;min-width:0}.bon-kicker{display:block;font-size:9px;font-weight:700;letter-spacing:.55px;color:#40556d}.bon-title h2{font-size:14px;line-height:1.3;margin-top:2px;overflow-wrap:anywhere}
      .bon-index{font-size:12px;font-weight:800;border:1px solid #bcc8d3;border-radius:7px;padding:5px 9px;white-space:nowrap}
      .bon-grid{display:grid;grid-template-columns:1.5fr 1fr .7fr;gap:6px;margin:7px 0}
      .bon-grid>div{border:1px solid #d2dbe4;border-radius:6px;padding:5px 8px}.field-label{display:block;font-size:8px;font-weight:700;color:#62758b;letter-spacing:.4px}.bon-grid strong{font-size:11px;display:block;margin-top:2px}
      .bon-address{font-size:10px;line-height:1.35;overflow-wrap:anywhere;margin-bottom:7px}
      .receipt{border:1px solid #8999a9;border-radius:6px;padding:7px 9px;flex:1;min-height:27mm}
      .receipt-fields{display:flex;justify-content:space-between;gap:9px;font-size:10px}.signature-label{font-size:10px;font-weight:bold;margin-top:6px}.sign-space{height:12mm}
      .cut{height:7px;position:absolute;bottom:0;left:8px;right:8px;border-top:1px dashed #97a5b3;text-align:right;font-size:8px;color:#66788c}.cut span{position:relative;top:-7px;background:#fff;padding-left:6px}
      @media print{html,body{width:auto!important}.meta,.route-note,.route-table th{background:#fff!important}.bon-card{box-shadow:none!important}.bons-page{height:265mm!important}.bon-card{height:85mm!important} }
    </style></head><body>
      <section class="summary">
        <div class="summary-head"><div class="logo">OB</div><div class="summary-title"><span class="eyebrow">Opération Brioche · Logistique</span><h1>Feuille de tournée</h1><span class="muted">À conserver par le conducteur · ${htmlEscape(formatDateLabel(selectedDate))}</span></div><div class="head-counter">${stops.length} arrêt(s)<br/><b>${qty} brioches</b></div></div>
        <div class="meta"><div><span>Responsable</span><strong>${htmlEscape(responsable)}</strong></div><div><span>Mode</span><strong>${htmlEscape(MODE_LABELS[mode])}</strong></div><div><span>Point de départ</span><strong>${htmlEscape(departure)}</strong></div><div><span>Date et heure de départ</span><strong>${htmlEscape(formatDateLabel(selectedDate))} · ${htmlEscape(plan?.departureTime||'À renseigner')}</strong></div></div>
        <div class="stats"><div class="stat"><small>Distance estimée</small><b>${plan?`${(plan.distanceMeters/1000).toFixed(1)} km`:'—'}</b></div><div class="stat"><small>Temps de route estimé</small><b>${plan?`${Math.round(plan.totalSeconds/60)} min`:'—'}</b></div><div class="stat"><small>Dernière arrivée prévue</small><b>${htmlEscape(plan?.stops.at(-1)?.arrival||'—')}</b></div></div>
        <h2 class="section-title">Ordre de passage des livraisons</h2><table class="route-table"><thead><tr><th>#</th><th>Destination / adresse</th><th>Commande</th><th>Qté</th><th>Arrivée</th></tr></thead><tbody>${rows}</tbody></table>
        <div class="route-note">${plan?'Ordre optimisé selon le réseau routier. Horaires indicatifs hors trafic en temps réel, avec 8 min de manutention par arrêt.':'Ordre manuel : vérifier le parcours et les horaires avant le départ.'} Vérifier les quantités et faire signer un bon à chaque livraison.</div>
        <div class="summary-foot"><span>Document Opération Brioche · ${htmlEscape(selectedDate)}</span><span>Bons de livraison détachables sur les feuilles suivantes</span></div>
      </section>
      ${pagesBons}
      <script>window.addEventListener('load',()=>window.print())</script>
    </body></html>`
    const frame=window.open('','_blank')
    if(!frame){window.alert('Autorise les fenêtres pop-up pour imprimer la feuille de tournée.');return}
    frame.document.open();frame.document.write(html);frame.document.close()
  }

  function exportCsv() {
    const header = [
      'Heure',
      'Client',
      'Quantité',
      'Ville',
      'Affecté à',
      'Mode',
      'Statut',
      'Commande',
    ]

    const rows = visible.map(
      ({ mission, commande, nom, ville }) => [
        mission.heure,
        nom,
        commande.quantite,
        ville,
        mission.responsable,
        MODE_LABELS[mission.mode],
        STATUS_LABELS[mission.statut],
        commande.numero,
      ],
    )

    const content =
      '\ufeff' +
      [header, ...rows]
        .map((row) => row.map(csvCell).join(';'))
        .join('\r\n')

    const url = URL.createObjectURL(
      new Blob([content], {
        type: 'text/csv;charset=utf-8',
      }),
    )

    const link = document.createElement('a')
    link.href = url
    link.download = `livraisons-${selectedDate}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      1000,
    )
  }

  return (
    <main className="lr-page">
      <header className="lr-header">
        <div className="lr-header-main">
          <span className="lr-eyebrow">
            Commandes dons · Logistique
          </span>
          <h1>Livraisons / Retraits</h1>
          <p>
            Pilotez les tournées, bénévoles, ESAT,
            Services Comm et retraits de la journée.
          </p>
          <div className="lr-week-in-header">
          <div className="lr-week-picker" aria-label="Choisir la semaine et le jour des livraisons">
            <div className="lr-week-picker-top">
              <CalendarDays size={17} aria-hidden="true" />
              <button type="button" className="lr-week-arrow" aria-label="Semaine précédente" disabled={jourFige} onClick={() => changeWeek(shiftDate(weekStart, -7))}>‹</button>
              <label className="lr-week-select">
                <span>Semaine du {shortDate(weekStart)} au {shortDate(weekEnd)}</span>
                <input type="week" aria-label="Choisir une semaine" disabled={jourFige} value={selectedWeek} onChange={event => {
                  const monday = mondayFromWeek(event.target.value)
                  if (monday) changeWeek(monday)
                }} />
              </label>
              <button type="button" className="lr-week-arrow" aria-label="Semaine suivante" disabled={jourFige} onClick={() => changeWeek(shiftDate(weekStart, 7))}>›</button>
            </div>
            <div className="lr-week-days" role="group" aria-label="Jour de la semaine">
              {daysOfWeek.map((date, index) => (
                <button type="button" key={date} className={`lr-week-day${date === selectedDate ? ' is-active' : ''}`} aria-pressed={date === selectedDate} disabled={jourFige} onClick={() => setSelectedDate(date)}>
                  <span>{WEEKDAYS_SHORT[index]}</span><strong>{shortDate(date)}</strong>
                  {nonAffecteesPourDate(date).length > 0 && <em className="lr-day-pending" title={`${nonAffecteesPourDate(date).length} livraison(s) non affectée(s)`}>{nonAffecteesPourDate(date).length}</em>}
                </button>
              ))}
            </div>
            <button type="button" className={`lr-day-lock${jourFige ? ' is-locked' : ''}`} aria-pressed={jourFige} onClick={() => setJourFige(value => !value)}>
              {jourFige ? <Lock size={14}/> : <Unlock size={14}/>}
              {jourFige ? `Jour figé : ${shortDate(selectedDate)}` : 'Figer ce jour'}
            </button>
          </div>
          </div>
        </div>

        <div className="lr-header-actions">


          <select
            className="lr-top-select"
            value={secteurFilter}
            onChange={(event) =>
              setSecteurFilter(event.target.value)
            }
            aria-label="Filtrer par secteur"
          >
            <option value="TOUS">
              Tous les secteurs
            </option>
            {secteurs.map((secteur) => (
              <option
                key={secteur}
                value={secteur}
              >
                {secteur}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="lr-primary"
            onClick={() => openTour()}
          >
            <Plus size={18} />
            Planifier une tournée
          </button>
        </div>
      </header>

      <nav
        className="lr-tabs"
        aria-label="Parties prenantes"
      >
        <TabButton
          active={activeTab === 'GLOBAL'}
          onClick={() => changeTab('GLOBAL')}
          icon={<Package size={18} />}
        >
          Vue globale
        </TabButton>

        <TabButton
          active={activeTab === 'BENEVOLES'}
          onClick={() => changeTab('BENEVOLES')}
          icon={<UsersRound size={18} />}
        >
          Bénévoles
        </TabButton>

        <TabButton
          active={activeTab === 'ESAT'}
          onClick={() => changeTab('ESAT')}
          icon={<Building2 size={18} />}
        >
          ESAT
        </TabButton>

        <TabButton
          active={activeTab === 'SERVICE_COMM'}
          onClick={() =>
            changeTab('SERVICE_COMM')
          }
          icon={<Truck size={18} />}
        >
          Services Comm
        </TabButton>

        <TabButton
          active={activeTab === 'RETRAITS'}
          onClick={() => changeTab('RETRAITS')}
          icon={<Package size={18} />}
        >
          Retraits
        </TabButton>
      </nav>

      <section className="lr-kpis">
        <Kpi
          icon={<CalendarDays size={22} />}
          tone="orange"
          label="Missions du jour"
          value={stats.missions}
        />
        <Kpi
          icon={<Package size={22} />}
          tone="blue"
          label="Brioches à livrer"
          value={stats.brioches}
        />
        <Kpi
          icon={<UsersRound size={22} />}
          tone="green"
          label="Bénévoles mobilisés"
          value={stats.benevoles}
        />
        <Kpi
          icon={<Building2 size={22} />}
          tone="purple"
          label="ESAT mobilisés"
          value={stats.esat}
        />
        <Kpi
          icon={<Truck size={22} />}
          tone="blue"
          label="Services Comm"
          value={stats.serviceComm}
        />
        <Kpi
          icon={<CheckCircle2 size={22} />}
          tone="green"
          label="Livrées"
          value={stats.livrees}
        />
        <Kpi
          icon={<AlertTriangle size={22} />}
          tone="orange"
          label="Non affectées du jour"
          value={nombreNonAffecteesJour}
        />
        <Kpi
          icon={<AlertTriangle size={22} />}
          tone="red"
          label="Alertes / problèmes"
          value={stats.alertes}
        />
      </section>

      {activeTab === 'GLOBAL' && (
        <section className="lr-card lr-unassigned-card" aria-label="Livraisons non affectées">
          <div className="lr-unassigned-summary">
            <button
              type="button"
              className="lr-unassigned-toggle"
              onClick={() => setNonAffecteesOuvertes(value => !value)}
              aria-expanded={nonAffecteesOuvertes}
              aria-controls="lr-non-affectees-detail"
            >
              <span className="lr-unassigned-warning"><AlertTriangle size={25}/></span>
              <span className="lr-unassigned-heading">
                <strong>Livraisons non affectées</strong>
                <small>{nombreNonAffecteesJour === 0 ? 'Toutes les livraisons de cette journée ont un responsable.' : 'Des livraisons attendent encore leur responsable pour cette journée.'}</small>
                <span className="lr-unassigned-campaign">{eligibleStops.length} livraison(s) à attribuer sur toute la campagne</span>
              </span>
            </button>
            <div className="lr-unassigned-metrics" aria-label="Résumé des livraisons non affectées">
              <span><b>{nombreNonAffecteesJour}</b><small>à affecter</small></span>
              <span><b>{quantiteNonAffecteeJour.toLocaleString('fr-FR')}</b><small>brioches</small></span>
              <span><b>{new Set(nonAffecteesPourDate(selectedDate).map(stop => stop.ville.trim().toUpperCase()).filter(Boolean)).size}</b><small>ville(s)</small></span>
            </div>
            <div className="lr-unassigned-buttons">
              <button type="button" className="lr-secondary" onClick={() => setNonAffecteesOuvertes(value => !value)} aria-expanded={nonAffecteesOuvertes}>
                {nonAffecteesOuvertes ? 'Masquer la liste' : 'Voir les livraisons'}
                <ChevronRight size={17} className={nonAffecteesOuvertes ? 'lr-chevron-open' : undefined}/>
              </button>
              <button type="button" className="lr-primary" onClick={() => openTour()}>
                <Plus size={17}/> Planifier une tournée
              </button>
            </div>
          </div>
          {nonAffecteesOuvertes && <div id="lr-non-affectees-detail">
          <div className="lr-toolbar lr-unassigned-toolbar">
            <label className="lr-search">
              <Search size={17}/>
              <input value={searchNonAffectees} onChange={event=>setSearchNonAffectees(event.target.value)}
                placeholder="Rechercher une livraison, un destinataire ou une ville…" />
            </label>
            <label className="lr-unassigned-date-toggle"><input type="checkbox" checked={voirToutesDates} onChange={event => setVoirToutesDates(event.target.checked)}/> Toutes les dates</label>
            <span className="lr-unassigned-counter">{nonAffecteesDuJour.length} à affecter{voirToutesDates ? ' (campagne)' : ' ce jour'}</span>
          </div>
          <div className="lr-table-wrap">
            <table className="lr-table">
              <thead><tr>
                <th>Heure</th><th>Client / destinataire</th><th>Quantité</th><th>Ville</th>
                <th>Affecté à</th><th>Mode</th><th>Statut</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {nonAffecteesDuJour.map(({mission,commande,nom,ville,contact,datePrevue}) => (
                  <tr key={mission.id}>
                    <td className="lr-time">{mission.heure || '—'}</td>
                    <td><strong>{nom}</strong><small>{contact ? `Contact : ${contact} · ` : ''}{commande.numero}{mission.id.startsWith('multi:') ? ' · Multi-sites' : ''}{datePrevue ? ` · Prévue le ${datePrevue.split('-').reverse().join('/')}` : ''}</small></td>
                    <td><strong>{commande.quantite}</strong> brioches</td>
                    <td><span className="lr-city"><MapPin size={14}/>{ville || '—'}</span></td>
                    <td className="lr-unassigned">Non affecté</td>
                    <td><ModeBadge mode={missionAUnResponsable(mission) ? mission.mode : 'NON_AFFECTE'} retraitType={typeRetraitPourMission(mission)}/></td>
                    <td><StatusBadge status={mission.statut}/></td>
                    <td><div className="lr-unassigned-actions">
                      <button type="button" className="lr-unassigned-plan" onClick={() => openTour(mission.id.startsWith('multi:') ? mission.id : `simple:${mission.commandeId}`)}>
                        <Plus size={14}/> Planifier
                      </button>
                      <button type="button" className="lr-icon-button" onClick={() => setDetailId(mission.id)} aria-label={`Détails de ${commande.numero}`} title="Détails de la livraison"><MoreHorizontal size={18}/></button>
                    </div></td>
                  </tr>
                ))}
                {nonAffecteesDuJour.length === 0 && <tr><td colSpan={8} className="lr-empty">Aucune livraison non affectée pour ce jour. Cochez « Toutes les dates » pour consulter le reste de la campagne.</td></tr>}
              </tbody>
            </table>
          </div>
          </div>}
        </section>
      )}

      <div className="lr-main-grid">
        <section className="lr-card lr-missions-card">
          <div className="lr-card-title">
            <div>
              <span className="lr-title-icon">
                <Package size={18} />
              </span>
              <div>
                <h2>
                  {activeTab === 'GLOBAL'
                    ? 'Tableau global des missions'
                    : activeTab === 'BENEVOLES'
                      ? 'Tournées bénévoles'
                      : activeTab === 'ESAT'
                        ? 'Tournées ESAT'
                        : activeTab ===
                            'SERVICE_COMM'
                          ? 'Tournées Services Comm'
                          : 'Retraits du jour'}
                </h2>
                <small>
                  {formatDateLabel(selectedDate)}
                </small>
              </div>
            </div>

            <button
              type="button"
              className="lr-secondary"
              onClick={exportCsv}
            >
              <Download size={16} />
              Exporter
            </button>
          </div>

          {activeTab === 'RETRAITS' && <div className="lr-retrait-legend" aria-label="Légende des types de retrait">
            <span className="lr-retrait-legend-label">Types de retrait</span>
            <span className="lr-retrait-legend-chip stand"><Store size={15}/> Retrait stand</span>
            <span className="lr-retrait-legend-chip etablissement"><Building2 size={15}/> Retrait établissement</span>
          </div>}

          <div className="lr-toolbar">
            <label className="lr-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Rechercher un client, une ville, un responsable..."
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as
                    | 'TOUS'
                    | StatutLivraison,
                )
              }
            >
              <option value="TOUS">
                Tous les statuts
              </option>
              {(
                Object.keys(
                  STATUS_LABELS,
                ) as StatutLivraison[]
              ).map((status) => (
                <option
                  key={status}
                  value={status}
                >
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            <select
              value={modeFilter}
              onChange={(event) =>
                setModeFilter(
                  event.target.value as
                    | 'TOUS'
                    | ModeLivraison,
                )
              }
            >
              <option value="TOUS">
                Tous les modes
              </option>
              {(
                Object.keys(
                  MODE_LABELS,
                ) as ModeLivraison[]
              ).map((mode) => (
                <option
                  key={mode}
                  value={mode}
                >
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>

            <select
              value={responsableFilter}
              onChange={(event) =>
                setResponsableFilter(
                  event.target.value,
                )
              }
            >
              <option value="TOUS">
                Tous les responsables
              </option>
              {responsables.map((responsable) => (
                <option
                  key={responsable}
                  value={responsable}
                >
                  {responsable}
                </option>
              ))}
            </select>
          </div>

          {(activeTab === 'BENEVOLES' || activeTab === 'ESAT' || activeTab === 'SERVICE_COMM') ? (
            <div className="lr-benevole-groups">
              <p className="lr-benevole-explain">{activeTab === 'BENEVOLES' ? 'Choisis un bénévole pour voir ses livraisons du jour. Les bénévoles sans mission sont aussi affichés.' : activeTab === 'ESAT' ? 'Choisis un ESAT pour consulter ses livraisons du jour ou lui en attribuer de nouvelles.' : 'Choisis une personne du service Communication pour consulter et gérer ses livraisons du jour.'}</p>
              {Object.keys(alertesReattribution).filter(id=>id.startsWith('multi:') ? lignesMulti.some(l=>`multi:${l.cle}`===id) : commandes.some(c=>String(c.id)===id && (!campagneAnnee || anneeDe(c.campagne)===campagneAnnee))).length > 0 &&
                <div className="lr-reattribution-alert" role="status"><AlertTriangle size={16}/>
                  {Object.keys(alertesReattribution).filter(id=>id.startsWith('multi:') ? lignesMulti.some(l=>`multi:${l.cle}`===id) : commandes.some(c=>String(c.id)===id && (!campagneAnnee || anneeDe(c.campagne)===campagneAnnee))).length} commande(s) retirée(s) à réattribuer. Elles sont de nouveau disponibles dans « Planifier une tournée ».
                </div>}
              {groupesIntervenants.map(b => {
                const ouvert = benevoleDeplie === b.id
                const quantite = b.missions.reduce((n,item) => n + Number(item.commande.quantite || 0),0)
                const missionsOrdonnees=[...b.missions].sort((a,c)=>(ordreTour[a.mission.id]??9999)-(ordreTour[c.mission.id]??9999) || a.ville.localeCompare(c.ville,'fr'))
                const modeBenevole: ModeLivraison = activeTab === 'ESAT' ? 'ESAT' : activeTab === 'SERVICE_COMM' ? 'SERVICE_COMM' : 'BENEVOLE'
                const editionOuverte = tourEdit?.mode === modeBenevole && tourEdit?.responsable === b.nom
                return <section key={b.id} className="lr-benevole-group">
                  <button type="button" className="lr-benevole-group-trigger" aria-expanded={ouvert} onClick={() => setBenevoleDeplie(ouvert ? null : b.id)}>
                    {modeBenevole === 'ESAT' ? <Building2 size={19}/> : modeBenevole === 'SERVICE_COMM' ? <Truck size={19}/> : <UserRound size={19}/>}
                    <span className="lr-benevole-group-name"><strong>{b.nom}</strong><small>{b.missions.length} livraison(s) · {quantite.toLocaleString('fr-FR')} brioches</small></span>
                    {modeBenevole === 'BENEVOLE' && !b.disponibiliteDeclaree && <span className="lr-benevole-unknown">Disponibilité à confirmer</span>}
                    <ChevronRight size={18} className={ouvert ? 'is-open' : ''}/>
                  </button>
                  {ouvert && <div className="lr-benevole-group-content">
                    {b.missions.length ? <div className="lr-table-wrap"><table className="lr-table"><thead><tr>
                      <th>Heure</th><th>Client / destinataire</th><th>Quantité</th><th>Ville</th><th>Statut</th><th>Actions</th>
                    </tr></thead><tbody>{missionsOrdonnees.map(({mission,commande,nom,ville,contact}, arretIndex) => <tr key={mission.id}>
                      <td>{mission.heure || '—'}</td><td><strong>{nom}</strong><small>{contact ? `Contact : ${contact}` : commande.numero}</small></td>
                      <td>{commande.quantite} brioches</td><td>{ville || '—'}</td><td><StatusBadge status={mission.statut}/></td>
                      <td><div className="lr-benevole-row-actions">
                        <button type="button" className="lr-icon-button" disabled={arretIndex === 0} onClick={() => bougerArret(modeBenevole,b.nom,mission.id,-1)} aria-label={`Monter ${commande.numero} dans la tournée`} title="Monter dans la tournée">↑</button>
                        <button type="button" className="lr-icon-button" disabled={arretIndex === missionsOrdonnees.length - 1} onClick={() => bougerArret(modeBenevole,b.nom,mission.id,1)} aria-label={`Descendre ${commande.numero} dans la tournée`} title="Descendre dans la tournée">↓</button>
                        <button type="button" className="lr-icon-button" onClick={()=>setDetailId(mission.id)} aria-label={`Détails de ${commande.numero}`} title="Détails"><MoreHorizontal size={18}/></button>
                        <button type="button" className="lr-icon-button lr-benevole-remove" disabled={mission.statut==='LIVREE'} onClick={()=>enleverDeTour(mission)} aria-label={`Retirer ${commande.numero} de la tournée de ${b.nom}`} title={mission.statut==='LIVREE'?'Livraison terminée':'Retirer et remettre à réattribuer'}><Minus size={18}/></button>
                      </div></td>
                    </tr>)}</tbody></table></div>
                    : <p className="lr-benevole-no-mission">Aucune livraison attribuée pour cette date.</p>}
                    <div className="lr-route-planner">
                      <div className="lr-route-heading"><MapPin size={17}/><strong>Optimiser la tournée de {b.nom}</strong></div>
                      <div className="lr-route-fields">
                        <label>Adresse précise du départ (siège AEIM ou autre)
                          <input placeholder="Numéro, rue, code postal, commune" value={departs[tourKey(modeBenevole,b.nom)]||''}
                            onChange={e=>setDeparts(old=>({...old,[tourKey(modeBenevole,b.nom)]:e.target.value}))}/>
                        </label>
                        <label>Heure de départ
                          <input type="time" value={horairesDepart[tourKey(modeBenevole,b.nom)]||''}
                            onChange={e=>setHorairesDepart(old=>({...old,[tourKey(modeBenevole,b.nom)]:e.target.value}))}/>
                        </label>
                        <button type="button" disabled={!b.missions.length||routeBusy!==null} onClick={()=>calculerItineraire(modeBenevole,b.nom)}>
                          <Truck size={16}/> {routeBusy===tourKey(modeBenevole,b.nom)?'Calcul en cours…':'Calculer le trajet le plus court'}
                        </button>
                      </div>
                      {routeError[tourKey(modeBenevole,b.nom)]&&<div className="lr-route-error" role="alert"><AlertTriangle size={16}/>{routeError[tourKey(modeBenevole,b.nom)]}</div>}
                      {(()=>{const plan=planValide(modeBenevole,b.nom);return plan?<div className="lr-route-result">
                        <strong>{(plan.distanceMeters/1000).toFixed(1)} km · {Math.round(plan.totalSeconds/60)} min de route</strong>
                        <small>Départ {plan.departureTime} · Dernière arrivée prévue {plan.stops.at(-1)?.arrival} · {STOP_MINUTES} min de déchargement par arrêt</small>
                        <ol>{plan.stops.map(stop=>{const item=b.missions.find(x=>x.mission.id===stop.missionId);return <li key={stop.missionId}>
                          <b>{stop.arrival} — {item?.nom||'Livraison'}</b><small>{stop.address} · {Math.round(stop.routeSeconds/60)} min depuis l’arrêt précédent</small>
                        </li>})}</ol>
                        <small>Estimation routière sans trafic en temps réel. Contrôler les adresses et horaires avec le livreur.</small>
                        <button type="button" onClick={()=>{void telechargerTourPdf(modeBenevole,b.nom)}}><Download size={16}/> Télécharger la feuille de tournée et les bons</button>
                        <button type="button" onClick={()=>imprimerTour(modeBenevole,b.nom)}>Imprimer la feuille de tournée et les bons</button>
                      </div>:<p className="lr-route-hint">Le calcul nécessite les adresses complètes des destinataires. Les horaires ne sont pas issus du trafic en temps réel.</p>})()}
                    </div>
                    <div className="lr-benevole-toolbar">
                      {editionOuverte ? <div className="lr-add-stop lr-benevole-add-form">
                        <select aria-label={`Commande à ajouter à ${b.nom}`} value={commandeAjout} onChange={e=>setCommandeAjout(e.target.value)}>
                          <option value="">Sélectionner une livraison à ajouter</option>
                          {eligibleStops.map(stop=><option key={stop.key} value={stop.key}>{stop.numero} · {stop.label} · {stop.quantite} brioches{stop.multi ? ' · multi-sites' : ''}</option>)}
                        </select>
                        <button type="button" disabled={!commandeAjout} onClick={()=>ajouterATour(modeBenevole,b.nom)}>Confirmer l'ajout</button>
                        <button type="button" onClick={()=>{setTourEdit(null);setCommandeAjout('')}}>Annuler</button>
                        {eligibleStops.length===0 && <small>Aucune commande non affectée pour cette campagne.</small>}
                      </div> : <button type="button" className="lr-tour-add" onClick={()=>{setTourEdit({mode:modeBenevole,responsable:b.nom});setCommandeAjout('')}}><Plus size={16}/> Ajouter une livraison à {b.nom}</button>}
                    </div>
                  </div>}
                </section>
              })}
              {groupesIntervenants.length === 0 && <p className="lr-benevole-no-mission">{activeTab === 'BENEVOLES' ? 'Aucun bénévole autorisé à livrer et disponible dans la BDD pour cette date.' : activeTab === 'ESAT' ? 'Aucun ESAT actif éligible dans la BDD Établissements (type ESAT ou code 20/29).' : 'Aucune personne active du service Communication dans la BDD Utilisateurs.'}</p>}
            </div>
          ) : (
          <div className="lr-table-wrap">
            <table className="lr-table">
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Client / destinataire</th>
                  <th>Quantité</th>
                  <th>Ville</th>
                  <th>Affecté à</th>
                  <th>Mode</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {visible.map(
                  ({
                    mission,
                    commande,
                    nom,
                    ville,
                    contact,
                  }) => (
                    <tr key={mission.id}>
                      <td className="lr-time">
                        {mission.heure || '—'}
                      </td>
                      <td>
                        <strong>{nom}</strong>
                        <small>
                          {contact
                            ? `Contact : ${contact}`
                            : commande.numero}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {commande.quantite}
                        </strong>{' '}
                        brioches
                      </td>
                      <td>
                        <span className="lr-city">
                          <MapPin size={14} />
                          {ville || '—'}
                        </span>
                      </td>
                      <td
                        className={
                          !missionAUnResponsable(mission)
                            ? 'lr-unassigned'
                            : ''
                        }
                      >
                        {missionAUnResponsable(mission) ? mission.responsable : 'Non affecté'}
                      </td>
                      <td>
                        <ModeBadge
                          mode={missionAUnResponsable(mission) ? mission.mode : 'NON_AFFECTE'}
                          retraitType={typeRetraitPourMission(mission)}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          status={!missionAUnResponsable(mission) && mission.statut !== 'LIVREE' ? 'A_PLANIFIER' : mission.statut}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="lr-icon-button"
                          onClick={() =>
                            setDetailId(mission.id)
                          }
                          aria-label={`Ouvrir ${commande.numero}`}
                        >
                          <MoreHorizontal
                            size={18}
                          />
                        </button>
                      </td>
                    </tr>
                  ),
                )}

                {visible.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="lr-empty"
                    >
                      Aucune mission pour ces
                      critères.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}
        </section>

        <aside className="lr-aside">
          <section className="lr-card lr-tours lr-tours-compact">
            <div className="lr-aside-title">
              <div>
                <Truck size={19} />
                <h2>Livreurs du jour</h2>
              </div>
              <span>{livreursDuJour.length} en tournée</span>
            </div>
            <p className="lr-drivers-intro">Les livreurs affectés au {formatDateLabel(selectedDate)}. Cliquez sur un nom pour consulter ses missions.</p>
            <div className="lr-drivers-list">
              {livreursDuJour.map(tour => {
                const livrees = tour.missions.filter(item => item.mission.statut === 'LIVREE').length
                const enCours = tour.missions.filter(item => item.mission.statut === 'EN_COURS').length
                const total = tour.missions.length
                const remaining = total - livrees
                const progression = Math.round((livrees / total) * 100)
                return <button
                  type="button"
                  className="lr-driver-card"
                  key={`${tour.mode}-${tour.responsable}`}
                  onClick={() => {
                    setActiveTab(tabForMode(tour.mode))
                    setStatusFilter('TOUS')
                    setModeFilter('TOUS')
                    setResponsableFilter(tour.responsable)
                    setSearch('')
                  }}
                  title={`Afficher les livraisons de ${tour.responsable}`}
                >
                  <span className="lr-driver-avatar">
                    {tour.mode === 'ESAT' ? <Building2 size={19} /> : tour.mode === 'SERVICE_COMM' ? <Truck size={19} /> : <UserRound size={19} />}
                  </span>
                  <span className="lr-driver-info">
                    <span className="lr-driver-name">{tour.responsable}</span>
                    <span className="lr-driver-role">{MODE_LABELS[tour.mode]} · {total} livraison{total > 1 ? 's' : ''}</span>
                    {tour.mode === 'RETRAIT' && <span className="lr-retrait-driver-types">
                      {tour.missions.filter(item=>typeRetraitPourMission(item.mission)==='STAND').length > 0 && <span className="lr-retrait-type-count stand"><Store size={13}/>{tour.missions.filter(item=>typeRetraitPourMission(item.mission)==='STAND').length} retrait(s) stand</span>}
                      {tour.missions.filter(item=>typeRetraitPourMission(item.mission)==='ETABLISSEMENT').length > 0 && <span className="lr-retrait-type-count etablissement"><Building2 size={13}/>{tour.missions.filter(item=>typeRetraitPourMission(item.mission)==='ETABLISSEMENT').length} retrait(s) établissement</span>}
                    </span>}
                    <span className="lr-driver-progress"><i style={{width:`${progression}%`}} /></span>
                    <span className="lr-driver-count">{remaining === 0 ? 'Tournée terminée' : `${remaining} à livrer`}{enCours > 0 ? ` · ${enCours} en cours` : ''}</span>
                  </span>
                  <ChevronRight size={17} />
                </button>
              })}
              {livreursDuJour.length === 0 && (
                <p className="lr-empty-side">Aucun livreur affecté à cette journée. Les missions en attente restent dans « Livraisons non affectées ».</p>
              )}
            </div>
          </section>

          <section className="lr-card lr-alert-card">
            <div className="lr-alert-title">
              <AlertTriangle size={19} />
              <h2>Alertes du jour</h2>
              <span>{nombreNonAffecteesJour + stats.problemes}</span>
            </div>

            {nombreNonAffecteesJour > 0 && (
              <button
                type="button"
                onClick={() => {
                  changeTab('GLOBAL')
                  setModeFilter('TOUS')
                  setResponsableFilter('TOUS')
                  setNonAffecteesOuvertes(true)
                }}
              >
                <UsersRound size={16} />
                {nombreNonAffecteesJour} livraison
                {nombreNonAffecteesJour > 1
                  ? 's'
                  : ''}{' '}
                non affectée
                {nombreNonAffecteesJour > 1
                  ? 's'
                  : ''}
                <ChevronRight size={15} />
              </button>
            )}

            {stats.problemes > 0 && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('PROBLEME')
                }}
              >
                <AlertTriangle size={16} />
                {stats.problemes} problème
                {stats.problemes > 1 ? 's' : ''}{' '}
                signalé
                {stats.problemes > 1 ? 's' : ''}
                <ChevronRight size={15} />
              </button>
            )}

            {nombreNonAffecteesJour + stats.problemes === 0 && (
              <p className="lr-no-alert">
                Aucun problème signalé.
              </p>
            )}
          </section>
        </aside>
      </div>

      <section className="lr-info-strip">
        <span>
          <Truck size={22} />
        </span>
        <div>
          <strong>
            Information aux bénévoles
          </strong>
          <p>
            La prochaine étape sera le lien personnel
            permettant à chaque intervenant de voir sa
            journée et de confirmer ses livraisons.
          </p>
        </div>
      </section>

      {tourOpen && (
        <div
          className="lr-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setTourOpen(false)
            }
          }}
        >
          <section
            className="lr-modal lr-tour-modal"
            role="dialog"
            aria-modal="true"
          >
            <header className="lr-modal-header">
              <div>
                <span>
                  COMMANDES DONS · LOGISTIQUE
                </span>
                <h2>Planifier une tournée</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setTourOpen(false)
                }
                aria-label="Fermer"
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={saveTour}>
              <div className="lr-modal-body">
                <div className="lr-tour-form-head">
                  <label>
                    <span>Date</span>
                    <input
                      type="date"
                      value={tourForm.date}
                      onChange={(event) =>
                        setTourForm(
                          (current) => ({
                            ...current,
                            date: event.target.value,
                            responsable:'',
                            // Éviter de conserver des arrêts cochés pour l'ancien jour.
                            commandes: {},
                          }),
                        )
                      }
                      required
                    />
                  </label>

                  <label>
                    <span>Partie prenante</span>
                    <select
                      value={tourForm.mode}
                      onChange={(event) => {
                        const mode =
                          event.target
                            .value as TourForm['mode']

                        setTourForm(
                          (current) => ({
                            ...current,
                            mode,
                            responsable: '',
                          }),
                        )
                      }}
                    >
                      <option value="BENEVOLE">
                        Bénévole
                      </option>
                      <option value="ESAT">
                        ESAT
                      </option>
                      <option value="SERVICE_COMM">
                        Services Comm
                      </option>
                      <option value="RETRAIT">
                        Retrait
                      </option>
                    </select>
                  </label>

                  {tourForm.mode === 'RETRAIT' && <label>
                    <span>Type de retrait</span>
                    <select value={tourForm.retraitType} onChange={event=>setTourForm(current=>({
                      ...current,retraitType:event.target.value as TourForm['retraitType'],responsable:''
                    }))}>
                      <option value="ETABLISSEMENT">Retrait établissement</option>
                      <option value="STAND">Retrait stand</option>
                    </select>
                  </label>}
                  <label>
                    <span>{tourForm.mode==='BENEVOLE'?'Bénévole disponible':tourForm.mode==='ESAT'?'ESAT pouvant livrer':tourForm.mode==='SERVICE_COMM'?'Personne du service communication':tourForm.retraitType==='STAND'?'Stand concerné':'Établissement concerné'}</span>
                    <select required value={tourForm.responsable} onChange={event=>setTourForm(current=>({
                      ...current,responsable:event.target.value
                    }))}>
                      <option value="">Sélectionner dans la liste</option>
                      {responsablesProposes.map(option=><option key={option.id} value={option.label}>{option.label}</option>)}
                    </select>
                    {tourForm.mode==='BENEVOLE' && responsablesProposes.length>0 && <small className="lr-source-info">
                      Vérifie la disponibilité du bénévole pour le {tourForm.date} avant de confirmer la tournée.
                    </small>}
                    {responsablesProposes.length===0&&<small className="lr-source-empty">{
                      tourForm.mode==='ESAT'
                        ? 'Aucun ESAT actif trouvé dans BDD → Établissements (type ESAT ou code 20/29).'
                        : tourForm.mode==='RETRAIT' && tourForm.retraitType==='STAND'
                          ? 'Aucun stand trouvé dans Gestion → Stands Brioches pour la campagne sélectionnée.'
                          : 'Aucune entrée éligible. Vérifie les disponibilités ou les autorisations dans la base correspondante.'
                    }</small>}
                  </label>
                </div>

                <div className="lr-stop-picker">
                  <div className="lr-stop-picker-title">
                    <div>
                      <h3>
                        Ajouter les livraisons
                      </h3>
                      <p>
                        Livraisons non affectées prévues pour le jour choisi, commandes classiques et multi-sites. Les horaires sont indicatifs.
                      </p>
                    </div>
                  </div>

                  <div className="lr-stop-list">
                    {stopsDisponiblesTour.length === 0 && <p className="lr-source-empty" role="status" style={{padding:'14px'}}>
                      Aucune livraison non affectée à cette date. Choisis une autre journée pour consulter sa bannette.
                    </p>}
                    {stopsDisponiblesTour.map(stop => {
                      const value = tourForm.commandes[stop.key] || { selected:false, heure:'' }
                      return <label className={`lr-stop-row ${value.selected ? 'selected' : ''}`} key={stop.key}>
                        <input type="checkbox" checked={value.selected} onChange={event=>setTourForm(current=>({
                          ...current, commandes:{...current.commandes,[stop.key]:{...value,selected:event.target.checked}}
                        }))}/>
                        <span className="lr-stop-main">
                          <strong>{stop.label}</strong>
                          <small>{stop.numero} · {stop.quantite} brioches{stop.ville ? ` · ${stop.ville}` : ''}{stop.multi ? ' · Destination multi-sites' : ''}</small>
                        </span>
                        <input className="lr-time-input" type="time" value={value.heure}
                          disabled={!value.selected} onChange={event=>setTourForm(current=>({
                            ...current, commandes:{...current.commandes,[stop.key]:{...value,heure:event.target.value}}
                          }))} aria-label={`Heure ${stop.numero} ${stop.label}`}/>
                      </label>
                    })}
                  </div>
                </div>
              </div>

              <footer className="lr-modal-footer">
                <button
                  type="button"
                  className="lr-secondary"
                  onClick={() =>
                    setTourOpen(false)
                  }
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="lr-primary"
                >
                  <CheckCircle2 size={17} />
                  Enregistrer la tournée
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {selectedDetail && (
        <div
          className="lr-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setDetailId(null)
            }
          }}
        >
          <section
            className="lr-modal lr-detail-modal"
            role="dialog"
            aria-modal="true"
          >
            <header className="lr-modal-header">
              <div>
                <span>
                  MISSION DE LIVRAISON
                </span>
                <h2>{selectedDetail.nom}</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setDetailId(null)
                }
                aria-label="Fermer"
              >
                <X size={19} />
              </button>
            </header>

            <div className="lr-modal-body">
              <div className="lr-detail-grid">
                <Detail
                  label="Commande"
                  value={
                    selectedDetail.commande.numero
                  }
                />
                <Detail
                  label="Quantité"
                  value={`${selectedDetail.commande.quantite} brioches`}
                />
                <Detail
                  label="Heure"
                  value={
                    selectedDetail.mission.heure ||
                    'Non renseignée'
                  }
                />
                <Detail
                  label="Ville"
                  value={
                    selectedDetail.ville || '—'
                  }
                />
                <Detail
                  label="Affecté à"
                  value={
                    selectedDetail.mission
                      .responsable ||
                    'Non affecté'
                  }
                />
                <Detail
                  label="Mode"
                  value={
                    MODE_LABELS[
                      selectedDetail.mission.mode
                    ]
                  }
                />
              </div>

              <label className="lr-comment-field">
                <span>Commentaire terrain</span>
                <textarea
                  rows={3}
                  value={
                    selectedDetail.mission
                      .commentaire
                  }
                  onChange={(event) =>
                    updateMission(
                      selectedDetail.mission.id,
                      {
                        commentaire:
                          event.target.value,
                      },
                    )
                  }
                  placeholder="Retard, personne absente, quantité, information utile..."
                />
              </label>

              <div className="lr-status-actions">
                <button
                  type="button"
                  onClick={() =>
                    setMissionStatus(
                      selectedDetail.mission,
                      'PLANIFIEE',
                    )
                  }
                >
                  <Clock3 size={17} />
                  Planifiée
                </button>

                <button
                  type="button"
                  className="running"
                  onClick={() =>
                    setMissionStatus(
                      selectedDetail.mission,
                      'EN_COURS',
                    )
                  }
                >
                  <Truck size={17} />
                  En cours
                </button>

                <button
                  type="button"
                  className="done"
                  onClick={() =>
                    setMissionStatus(
                      selectedDetail.mission,
                      'LIVREE',
                    )
                  }
                >
                  <CheckCircle2 size={17} />
                  Livrée
                </button>

                <button
                  type="button"
                  className="problem"
                  onClick={() =>
                    setMissionStatus(
                      selectedDetail.mission,
                      'PROBLEME',
                    )
                  }
                >
                  <AlertTriangle size={17} />
                  Problème
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={active ? 'active' : ''}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  )
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode
  label: string
  value: number
  tone:
    | 'orange'
    | 'blue'
    | 'green'
    | 'purple'
    | 'red'
}) {
  return (
    <article className="lr-kpi">
      <span className={`lr-kpi-icon ${tone}`}>
        {icon}
      </span>
      <div>
        <small>{label}</small>
        <strong>
          {new Intl.NumberFormat('fr-FR').format(
            value,
          )}
        </strong>
      </div>
    </article>
  )
}

function ModeBadge({
  mode,
  retraitType,
}: {
  mode: ModeLivraison
  retraitType?: RetraitType
}) {
  const isRetrait = mode === 'RETRAIT'
  const kindClass = isRetrait && retraitType ? ` mode-retrait-${retraitType.toLowerCase()}` : ''
  const label = isRetrait
    ? retraitType === 'STAND' ? 'Retrait stand'
      : retraitType === 'ETABLISSEMENT' ? 'Retrait établissement'
      : 'Retrait · type à préciser'
    : MODE_LABELS[mode]
  return (
    <span className={`lr-mode mode-${mode.toLowerCase()}${kindClass}`}>
      {mode === 'ESAT' ? <Building2 size={14} />
        : mode === 'SERVICE_COMM' ? <Truck size={14} />
        : isRetrait && retraitType === 'STAND' ? <Store size={14} />
        : isRetrait && retraitType === 'ETABLISSEMENT' ? <Building2 size={14} />
        : isRetrait ? <Package size={14} />
        : mode === 'NON_AFFECTE' ? <AlertTriangle size={14} />
        : <UserRound size={14} />}
      {label}
    </span>
  )
}

function StatusBadge({
  status,
}: {
  status: StatutLivraison
}) {
  return (
    <span
      className={`lr-status status-${status.toLowerCase()}`}
    >
      {status === 'LIVREE' ? (
        <CheckCircle2 size={14} />
      ) : status === 'PROBLEME' ? (
        <AlertTriangle size={14} />
      ) : status === 'EN_COURS' ? (
        <Truck size={14} />
      ) : (
        <Clock3 size={14} />
      )}
      {STATUS_LABELS[status]}
    </span>
  )
}

function Detail({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="lr-detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
