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
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Minus,
  Printer,
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
  commandes: Record<number, { selected: boolean; heure: string }>
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
}
function readMultiAffectations(): Record<string, MultiAffectation> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(MULTI_STORAGE_KEY) || '{}')
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, MultiAffectation> : {}
  } catch { return {} }
}
const keyMulti = (commandeId: number, ligneId: string) => `${commandeId}:${ligneId}`
const anneeDe = (value: string) => value.match(/(?:19|20)\d{2}/)?.[0] ?? ''


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

  const [selectedDate, setSelectedDate] =
    useState(initialDate)

  const multiDuJour = useMemo(() => lignesMulti.filter(item =>
    (multiAffectations[item.cle]?.date || item.ligne.datePrevue) === selectedDate),
    [lignesMulti, multiAffectations, selectedDate])

  const [activeTab, setActiveTab] =
    useState<Tab>('GLOBAL')

  const [search, setSearch] = useState('')
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
  const [alertesReattribution,setAlertesReattribution]=useState<Record<string,string>>(()=>readObject<string>(TOUR_ALERTES_KEY))
  const [tourEdit,setTourEdit]=useState<{mode:ModeLivraison;responsable:string}|null>(null)
  const [commandeAjout,setCommandeAjout]=useState('')
  useEffect(()=>{localStorage.setItem(TOUR_DEPART_KEY,JSON.stringify(departs))},[departs])
  useEffect(()=>{localStorage.setItem(TOUR_ORDRE_KEY,JSON.stringify(ordreTour))},[ordreTour])
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

  const responsablesProposes = useMemo(() => {
    if(tourForm.mode === 'BENEVOLE') return benevolesLogistique
      .filter(b=>b.statut !== 'Inactif' && b.peutEffectuerLivraisons === true && availableForDate(b,tourForm.date))
      .map(b=>({id:b.id,label:`${b.prenom} ${b.nom}`.trim()}))
    if(tourForm.mode === 'ESAT') return etablissements
      // La BDD Établissements est la source de référence : les ESAT sont
      // proposés même lorsque la case « peut effectuer des livraisons » est vide.
      // Les établissements portant les codes 20 ou 29 sont également inclus.
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
      // Un retrait peut avoir lieu le lendemain du stand : on filtre donc sur
      // la campagne, et non sur l'égalité stricte des dates.
      .filter(st=>!campagneAnnee || anneeDe(st.campagne||st.date)===campagneAnnee)
      .sort((a,b)=>{
        // Les stands prévus le jour de la tournée sont proposés en premier.
        const aToday=a.date===tourForm.date ? 0 : 1
        const bToday=b.date===tourForm.date ? 0 : 1
        return aToday-bToday || a.date.localeCompare(b.date) || a.nom.localeCompare(b.nom,'fr')
      })
      .map(st=>({id:st.id,label:`${st.nom}${st.lieu ? ` · ${st.lieu}` : ''} · ${st.date}`}))
  },[tourForm.mode,tourForm.retraitType,tourForm.date,benevolesLogistique,etablissements,users,standsLogistique,campagneAnnee])

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

  const enriched = useMemo(
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

  const stats = useMemo(() => {
    const unique = (mode: ModeLivraison) =>
      new Set(
        enriched
          .filter(
            ({ mission }) => mission.mode === mode,
          )
          .map(
            ({ mission }) =>
              mission.responsable || MODE_LABELS[mode],
          ),
      ).size

    const brioches = enriched.reduce(
      (total, { commande }) =>
        total + Number(commande.quantite || 0),
      0,
    )

    const nonAffectees = enriched.filter(
      ({ mission }) =>
        mission.mode === 'NON_AFFECTE',
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

  const selectedDetail = detailId
    ? enriched.find(
        ({ mission }) => mission.id === detailId,
      ) ?? null
    : null

  const eligibleCommandes = useMemo(
    () =>
      commandes
        .filter(
          (commande) => commande.statut !== 'ANNULEE' && (commande.livraisons?.length ?? 0) === 0 && (campagneAnnee === '' || anneeDe(commande.campagne) === campagneAnnee) &&
            !missions.some(m=>m.commandeId===commande.id && m.mode!=='NON_AFFECTE'),
        )
        .sort((a, b) =>
          a.numero.localeCompare(b.numero, 'fr', {
            numeric: true,
          }),
        ),
    [commandes, campagneAnnee, missions],
  )

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

  function openTour() {
    const commandState: TourForm['commandes'] = {}

    for (const commande of eligibleCommandes) {
      const existing = missions.find(
        (mission) =>
          mission.commandeId === commande.id &&
          mission.date === selectedDate,
      )

      commandState[commande.id] = {
        selected: false,
        heure: existing?.heure || '',
      }
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

    const selectedIds = (
      Object.entries(
        tourForm.commandes,
      ) as Array<
        [
          string,
          { selected: boolean; heure: string },
        ]
      >
    )
      .filter(([, value]) => value.selected)
      .map(([id]) => Number(id))

    if (selectedIds.length === 0) {
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

    if(selectedIds.some(id=>missions.some(m=>m.commandeId===id && m.mode!=='NON_AFFECTE'))){
      window.alert('Une commande a déjà été affectée à une tournée. Actualise la liste avant de continuer.');return
    }
    const now = new Date().toISOString()

    setMissions((current) => {
      const next = [...current]

      for (const commandeId of selectedIds) {
        const currentMissionIndex = next.findIndex(
          (mission) => mission.commandeId === commandeId,
        )

        const heure =
          tourForm.commandes[commandeId]?.heure ||
          ''

        if (currentMissionIndex >= 0) {
          next[currentMissionIndex] = {
            ...next[currentMissionIndex],
            mode: tourForm.mode,
            responsable,
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
            statut: 'PLANIFIEE',
            commentaire: '',
            updatedAt: now,
          })
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
    setSelectedDate(tourForm.date)
    setTourOpen(false)
  }

  function updateMission(
    id: string,
    patch: Partial<MissionLivraison>,
  ) {
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

  const tourKey=(mode:ModeLivraison,responsable:string)=>`${selectedDate}|${mode}|${responsable}`
  const missionsDeTour=(mode:ModeLivraison,responsable:string)=>enriched
    .filter(item=>item.mission.mode===mode && item.mission.responsable===responsable)
    .sort((a,b)=>(ordreTour[a.mission.id]??9999)-(ordreTour[b.mission.id]??9999) ||
       a.ville.localeCompare(b.ville,'fr') || a.nom.localeCompare(b.nom,'fr'))

  function enleverDeTour(mission:MissionLivraison){
    if(mission.statut==='LIVREE') {window.alert('Livraison déjà effectuée : elle ne peut pas être retirée sans procédure de correction.');return}
    if(!window.confirm('Retirer cette livraison de la tournée ? Elle sera signalée comme À RÉATTRIBUER.')) return
    setMissions(current=>current.map(m=>m.id===mission.id?{
      ...m,mode:'NON_AFFECTE',responsable:'',heure:'',statut:'A_PLANIFIER',updatedAt:new Date().toISOString()
    }:m))
    setAlertesReattribution(prev=>({...prev,[String(mission.commandeId)]:'Commande retirée de la tournée, à réattribuer'}))
  }

  function ajouterATour(mode:ModeLivraison,responsable:string){
    const commandeId=Number(commandeAjout)
    if(!commandeId || !eligibleCommandes.some(c=>c.id===commandeId)){window.alert('Sélectionne une commande non affectée.');return}
    setMissions(current=>{
      if(current.some(m=>m.commandeId===commandeId && m.mode!=='NON_AFFECTE'))return current
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

  function imprimerTour(mode:ModeLivraison,responsable:string){
    const stops=missionsDeTour(mode,responsable)
    if(!stops.length)return
    const departure=departs[tourKey(mode,responsable)]?.trim()||'Non renseigné'
    const rows=stops.map((item,i)=>`<tr><td>${i+1}</td><td>${htmlEscape(item.nom)}<br/><small>${htmlEscape(item.ville)} · ${htmlEscape(item.donateur?.adresse??'')}</small></td><td>${htmlEscape(item.commande.numero)}</td><td>${htmlEscape(item.commande.quantite)}</td><td>${htmlEscape(item.mission.heure||'À prévoir')}</td></tr>`).join('')
    const bons=stops.map((item,i)=>`<section class="bon"><h2>Bon de livraison ${i+1}/${stops.length}</h2><p><b>Commande :</b> ${htmlEscape(item.commande.numero)} — <b>Campagne :</b> ${htmlEscape(item.commande.campagne)}</p><p><b>Destinataire :</b> ${htmlEscape(item.nom)}</p><p><b>Adresse / ville :</b> ${htmlEscape(item.donateur?.adresse??'')} ${htmlEscape(item.ville)}</p><p><b>Quantité à remettre :</b> ${htmlEscape(item.commande.quantite)} brioches</p><p><b>Quantité effectivement reçue :</b> __________________</p><div class="sign"><div>Date / heure : _______________</div><div>Signature et tampon du destinataire :<div class="space"></div></div></div></section>`).join('')
    const html=`<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Tournée ${htmlEscape(responsable)} ${htmlEscape(selectedDate)}</title><style>@page{size:A4;margin:14mm}body{font:12px Arial,sans-serif;color:#153764}h1{font-size:24px}h2{font-size:18px}table{border-collapse:collapse;width:100%;margin:22px 0}th,td{border:1px solid #bdcddd;padding:9px;text-align:left}th{background:#eef5fc}.meta{background:#f4f8fc;padding:12px;line-height:1.7}small{color:#627b98}.bon{page-break-before:always;min-height:240mm}.space{height:90px}.sign{margin-top:36px;border:1px solid #c7d4e2;padding:16px;line-height:2}.footer{font-size:11px;color:#71849d}@media print{button{display:none}}</style></head><body><h1>Opération Brioche · Feuille de tournée</h1><div class="meta"><b>Date :</b> ${htmlEscape(formatDateLabel(selectedDate))}<br/><b>Responsable :</b> ${htmlEscape(responsable)}<br/><b>Mode :</b> ${htmlEscape(MODE_LABELS[mode])}<br/><b>Départ :</b> ${htmlEscape(departure)}<br/><b>Heure de départ :</b> __________ &nbsp; <b>Temps de route :</b> à calculer &nbsp; <b>Retour :</b> __________</div><p>Ordre des arrêts défini dans le logiciel. Les durées de route et d'arrivée doivent être confirmées avant le départ.</p><table><thead><tr><th>#</th><th>Destination</th><th>Commande</th><th>Brioches</th><th>Heure prévue</th></tr></thead><tbody>${rows}</tbody></table><p class="footer">Document opérationnel — les quantités remises sont à confirmer et signer sur les bons suivants.</p>${bons}<script>window.addEventListener('load',()=>window.print())<\/script></body></html>`
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
        <div>
          <span className="lr-eyebrow">
            Commandes dons · Logistique
          </span>
          <h1>Livraisons / Retraits</h1>
          <p>
            Pilotez les tournées, bénévoles, ESAT,
            Services Comm et retraits de la journée.
          </p>
        </div>

        <div className="lr-header-actions">
          <label className="lr-date-control">
            <CalendarDays size={17} />
            <input
              type="date"
              value={selectedDate}
              onChange={(event) =>
                setSelectedDate(event.target.value)
              }
            />
          </label>

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
            onClick={openTour}
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
          tone="red"
          label="Alertes / problèmes"
          value={stats.alertes}
        />
      </section>

      <section className="lr-multisites lr-card">
        <div className="lr-multisites-heading">
          <div><h2><Truck size={19}/> Destinations multi-sites</h2>
            <p>Une ligne par destination · un seul donateur payeur · campagne {campagneAnnee || 'courante'}</p></div>
          <span className="lr-multisites-count">{lignesMulti.length} destination(s) · {multiDuJour.length} pour le {formatDateLabel(selectedDate)}</span>
        </div>
        {multiDuJour.length ? <div className="lr-multisites-list">
          {multiDuJour.map(item => {
            const state = multiAffectations[item.cle]
            const delivered = Boolean(item.ligne.dateLivraison) || state?.statut === 'LIVREE'
            const currentStatus: StatutLivraison = delivered ? 'LIVREE' : state?.statut || 'A_PLANIFIER'
            return <article className="lr-multisite-row" key={item.cle}>
              <div className="lr-multisite-destination">
                <strong>{item.ligne.destinataireNom || 'Destinataire sans nom'}</strong>
                <span>{[item.ligne.adresse, item.ligne.cp, item.ligne.ville].filter(Boolean).join(' · ') || 'Adresse à compléter'}</span>
                <small>{item.commande.numero} · {item.ligne.quantite} brioches · payeur : {getDonateurById(item.commande.donateurId)?.nom || 'Inconnu'}</small>
              </div>
              <label>Mode<select value={state?.mode || 'NON_AFFECTE'} disabled={delivered} onChange={event => updateMulti(item.cle,item.commande.id,item.ligneId,item.ligne.datePrevue,{mode:event.target.value as ModeLivraison})}>
                {Object.entries(MODE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
              </select></label>
              <label>Responsable<input value={state?.responsable || ''} disabled={delivered} onChange={event => updateMulti(item.cle,item.commande.id,item.ligneId,item.ligne.datePrevue,{responsable:event.target.value})} placeholder="Nom / structure" /></label>
              <label>Heure<input type="time" value={state?.heure || ''} disabled={delivered} onChange={event => updateMulti(item.cle,item.commande.id,item.ligneId,item.ligne.datePrevue,{heure:event.target.value})}/></label>
              <div className="lr-multisite-actions"><span className={delivered?'is-delivered':''}>{STATUS_LABELS[currentStatus]}</span>
                {!delivered && <button type="button" onClick={() => {
                  if((state?.mode || 'NON_AFFECTE')==='NON_AFFECTE' || !state?.responsable?.trim()) {window.alert('Choisis un mode et un responsable avant de planifier.');return}
                  setMultiStatut(item,'PLANIFIEE')
                }}>Planifier</button>}
                {currentStatus === 'PLANIFIEE' && <button type="button" className="lr-multi-deliver" onClick={() => setMultiStatut(item,'LIVREE')}>Marquer livrée</button>}
              </div>
            </article>
          })}
        </div> : <p className="lr-multisites-empty">Aucune destination multi-sites prévue à cette date. Choisis la date d'une livraison dans le calendrier.</p>}
        <p className="lr-multisites-note">Les affectations sont enregistrées dans ce navigateur. La facturation reste unique par commande ; les livraisons sont suivies individuellement.</p>
      </section>

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

          {activeTab === 'BENEVOLES' ? (
            <div className="lr-benevole-groups">
              <p className="lr-benevole-explain">Choisis un bénévole pour voir ses livraisons du jour. Les bénévoles sans mission sont aussi affichés.</p>
              {groupesBenevoles.map(b => {
                const ouvert = benevoleDeplie === b.id
                const quantite = b.missions.reduce((n,item) => n + Number(item.commande.quantite || 0),0)
                return <section key={b.id} className="lr-benevole-group">
                  <button type="button" className="lr-benevole-group-trigger" aria-expanded={ouvert} onClick={() => setBenevoleDeplie(ouvert ? null : b.id)}>
                    <UserRound size={19}/>
                    <span className="lr-benevole-group-name"><strong>{b.nom}</strong><small>{b.missions.length} livraison(s) · {quantite.toLocaleString('fr-FR')} brioches</small></span>
                    {!b.disponibiliteDeclaree && <span className="lr-benevole-unknown">Disponibilité à confirmer</span>}
                    <ChevronRight size={18} className={ouvert ? 'is-open' : ''}/>
                  </button>
                  {ouvert && <div className="lr-benevole-group-content">
                    {b.missions.length ? <div className="lr-table-wrap"><table className="lr-table"><thead><tr>
                      <th>Heure</th><th>Client / destinataire</th><th>Quantité</th><th>Ville</th><th>Statut</th><th>Actions</th>
                    </tr></thead><tbody>{b.missions.map(({mission,commande,nom,ville,contact}) => <tr key={mission.id}>
                      <td>{mission.heure || '—'}</td><td><strong>{nom}</strong><small>{contact ? `Contact : ${contact}` : commande.numero}</small></td>
                      <td>{commande.quantite} brioches</td><td>{ville || '—'}</td><td><StatusBadge status={mission.statut}/></td>
                      <td><button type="button" className="lr-icon-button" onClick={()=>setDetailId(mission.id)} aria-label={`Ouvrir ${commande.numero}`}><MoreHorizontal size={18}/></button></td>
                    </tr>)}</tbody></table></div>
                    : <p className="lr-benevole-no-mission">Aucune livraison attribuée pour cette date.</p>}
                  </div>}
                </section>
              })}
              {groupesBenevoles.length === 0 && <p className="lr-benevole-no-mission">Aucun bénévole autorisé à livrer et disponible dans la BDD pour cette date.</p>}
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
                          mission.mode ===
                          'NON_AFFECTE'
                            ? 'lr-unassigned'
                            : ''
                        }
                      >
                        {mission.responsable ||
                          'Non affecté'}
                      </td>
                      <td>
                        <ModeBadge
                          mode={mission.mode}
                        />
                      </td>
                      <td>
                        <StatusBadge
                          status={mission.statut}
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
          <section className="lr-card lr-tours">
            <div className="lr-aside-title">
              <div>
                <Truck size={19} />
                <h2>Tournées du jour</h2>
              </div>
              <span>
                {activeTab === 'BENEVOLES' ? benevolesDuJour.length : tournees.length} responsables
              </span>
            </div>

            {activeTab === 'BENEVOLES' ? (
              <div className="lr-benevole-today">
                <p>Bénévoles autorisés à livrer et compatibles avec la date sélectionnée.</p>
                {benevolesDuJour.map(b => {
                  const count = enriched.filter(item => item.mission.mode === 'BENEVOLE' && normalizeText(item.mission.responsable) === normalizeText(b.nom)).length
                  return <button type="button" key={b.id} className="lr-benevole-today-item" onClick={() => {setBenevoleDeplie(b.id);setResponsableFilter('TOUS')}}>
                    <UserRound size={17}/><span><strong>{b.nom}</strong><small>{count} livraison(s){!b.disponibiliteDeclaree ? ' · Disponibilité à confirmer' : ''}</small></span><ChevronRight size={16}/>
                  </button>
                })}
                {benevolesDuJour.length === 0 && <p className="lr-benevole-no-mission">Aucun bénévole disponible à cette date.</p>}
              </div>
            ) : <>
            {Object.keys(alertesReattribution).filter(id=>commandes.some(c=>String(c.id)===id && (!campagneAnnee || anneeDe(c.campagne)===campagneAnnee))).length>0&&
              <div className="lr-reattribution-alert"><AlertTriangle size={16}/>
                {Object.keys(alertesReattribution).filter(id=>commandes.some(c=>String(c.id)===id && (!campagneAnnee || anneeDe(c.campagne)===campagneAnnee))).length} commande(s) retirée(s) à réattribuer.
              </div>}
            <div className="lr-tour-management">
              <p>Gestion des arrêts · + ajouter · − retirer · ↑↓ ordonner</p>
              {tournees.filter(t=>t.mode!=='NON_AFFECTE').map(t=>{
                const stops=missionsDeTour(t.mode,t.responsable)
                const key=tourKey(t.mode,t.responsable)
                return <div className="lr-tour-editor" key={key}>
                  <div className="lr-tour-editor-head"><strong>{t.responsable} · {MODE_LABELS[t.mode]}</strong>
                    <button type="button" onClick={()=>imprimerTour(t.mode,t.responsable)}><Printer size={15}/> Feuille de tournée</button>
                  </div>
                  <label className="lr-depart-field">Point de départ (domicile, établissement ou Siège)
                    <input placeholder="Ex. Siège AEIM, Villers-lès-Nancy" value={departs[key]||''} onChange={e=>setDeparts(old=>({...old,[key]:e.target.value}))}/>
                  </label>
                  {stops.map((item,i)=><div className="lr-tour-editor-stop" key={item.mission.id}>
                    <span><b>{i+1}. {item.nom}</b><small>{item.ville} · {item.commande.quantite} brioches</small></span>
                    <button type="button" title="Monter" disabled={i===0} onClick={()=>bougerArret(t.mode,t.responsable,item.mission.id,-1)}>↑</button>
                    <button type="button" title="Descendre" disabled={i===stops.length-1} onClick={()=>bougerArret(t.mode,t.responsable,item.mission.id,1)}>↓</button>
                    <button type="button" title="Retirer et réattribuer" disabled={item.mission.statut==='LIVREE'} onClick={()=>enleverDeTour(item.mission)}><Minus size={15}/></button>
                  </div>)}
                  {tourEdit?.mode===t.mode&&tourEdit?.responsable===t.responsable ? <div className="lr-add-stop">
                    <select value={commandeAjout} onChange={e=>setCommandeAjout(e.target.value)}>
                      <option value="">Choisir une commande non affectée</option>
                      {eligibleCommandes.map(c=><option key={c.id} value={c.id}>{c.numero} · {getDonateurById(c.donateurId)?.nom||'Donateur'} · {c.quantite} brioches</option>)}
                    </select><button type="button" onClick={()=>ajouterATour(t.mode,t.responsable)}>Ajouter</button>
                    <button type="button" onClick={()=>setTourEdit(null)}>Annuler</button>
                  </div>:<button type="button" className="lr-tour-add" onClick={()=>{setTourEdit({mode:t.mode,responsable:t.responsable});setCommandeAjout('')}}><Plus size={15}/> Ajouter une livraison</button>}
                </div>
              })}
            </div>
            <div className="lr-tour-list">
              {tournees.map((tour) => {
                const total = tour.missions.reduce(
                  (sum, item) =>
                    sum +
                    Number(
                      item.commande.quantite || 0,
                    ),
                  0,
                )

                const livrees =
                  tour.missions.filter(
                    (item) =>
                      item.mission.statut ===
                      'LIVREE',
                  ).length

                const enCours =
                  tour.missions.filter(
                    (item) =>
                      item.mission.statut ===
                      'EN_COURS',
                  ).length

                const progress = tour.missions.length
                  ? Math.round(
                      ((livrees +
                        enCours * 0.5) /
                        tour.missions.length) *
                        100,
                    )
                  : 0

                return (
                  <button
                    type="button"
                    className="lr-tour"
                    key={`${tour.mode}-${tour.responsable}`}
                    onClick={() => {
                      setActiveTab(tabForMode(tour.mode))
                      setStatusFilter('TOUS')
                      setModeFilter(tour.mode)
                      setResponsableFilter(
                        tour.responsable ===
                          'Non affecté'
                          ? 'TOUS'
                          : tour.responsable,
                      )
                    }}
                  >
                    <span
                      className={`lr-tour-icon mode-${tour.mode.toLowerCase()}`}
                    >
                      {tour.mode === 'ESAT' ? (
                        <Building2 size={20} />
                      ) : tour.mode ===
                        'SERVICE_COMM' ? (
                        <Truck size={20} />
                      ) : tour.mode ===
                        'NON_AFFECTE' ? (
                        <UsersRound size={20} />
                      ) : (
                        <UserRound size={20} />
                      )}
                    </span>

                    <span className="lr-tour-body">
                      <span className="lr-tour-heading">
                        <strong>
                          {tour.responsable}
                        </strong>
                        <em>
                          {MODE_LABELS[tour.mode]}
                        </em>
                      </span>

                      <span className="lr-tour-meta">
                        {tour.missions.length} arrêt
                        {tour.missions.length > 1
                          ? 's'
                          : ''}{' '}
                        · {total} brioches
                      </span>

                      <span className="lr-progress">
                        <i
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </span>

                      <span className="lr-tour-statuses">
                        {livrees > 0 && (
                          <b className="done">
                            {livrees} livrée
                            {livrees > 1 ? 's' : ''}
                          </b>
                        )}
                        {enCours > 0 && (
                          <b className="running">
                            {enCours} en cours
                          </b>
                        )}
                        {tour.missions.length -
                          livrees -
                          enCours >
                          0 && (
                          <b>
                            {tour.missions.length -
                              livrees -
                              enCours}{' '}
                            à venir
                          </b>
                        )}
                      </span>
                    </span>

                    <ChevronRight size={17} />
                  </button>
                )
              })}

              {tournees.length === 0 && (
                <p className="lr-empty-side">
                  Aucune tournée sur cette journée.
                </p>
              )}
            </div>
            </>}
          </section>

          <section className="lr-card lr-alert-card">
            <div className="lr-alert-title">
              <AlertTriangle size={19} />
              <h2>Alertes du jour</h2>
              <span>{stats.alertes}</span>
            </div>

            {stats.nonAffectees > 0 && (
              <button
                type="button"
                onClick={() => {
                  changeTab('GLOBAL')
                  setModeFilter('NON_AFFECTE')
                  setResponsableFilter('TOUS')
                }}
              >
                <UsersRound size={16} />
                {stats.nonAffectees} mission
                {stats.nonAffectees > 1
                  ? 's'
                  : ''}{' '}
                non affectée
                {stats.nonAffectees > 1
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

            {stats.alertes === 0 && (
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
                        Ajouter les commandes
                      </h3>
                      <p>
                        Seules les commandes non affectées sont proposées. Les horaires sont indicatifs.
                      </p>
                    </div>
                  </div>

                  <div className="lr-stop-list">
                    {eligibleCommandes.map(
                      (commande) => {
                        const donateur =
                          getDonateurById(
                            commande.donateurId,
                          )

                        const value =
                          tourForm.commandes[
                            commande.id
                          ] || {
                            selected: false,
                            heure: '',
                          }

                        return (
                          <label
                            className={`lr-stop-row ${
                              value.selected
                                ? 'selected'
                                : ''
                            }`}
                            key={commande.id}
                          >
                            <input
                              type="checkbox"
                              checked={value.selected}
                              onChange={(event) =>
                                setTourForm(
                                  (current) => ({
                                    ...current,
                                    commandes: {
                                      ...current.commandes,
                                      [commande.id]: {
                                        ...value,
                                        selected:
                                          event.target
                                            .checked,
                                      },
                                    },
                                  }),
                                )
                              }
                            />

                            <span className="lr-stop-main">
                              <strong>
                                {donateur?.nom ||
                                  'Donateur inconnu'}
                              </strong>
                              <small>
                                {commande.numero} ·{' '}
                                {commande.quantite}{' '}
                                brioches
                                {donateur?.ville
                                  ? ` · ${donateur.ville}`
                                  : ''}
                              </small>
                            </span>

                            <input
                              className="lr-time-input"
                              type="time"
                              value={value.heure}
                              disabled={!value.selected}
                              onChange={(event) =>
                                setTourForm(
                                  (current) => ({
                                    ...current,
                                    commandes: {
                                      ...current.commandes,
                                      [commande.id]: {
                                        ...value,
                                        heure:
                                          event.target
                                            .value,
                                      },
                                    },
                                  }),
                                )
                              }
                              aria-label={`Heure ${commande.numero}`}
                            />
                          </label>
                        )
                      },
                    )}
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
}: {
  mode: ModeLivraison
}) {
  return (
    <span
      className={`lr-mode mode-${mode.toLowerCase()}`}
    >
      {mode === 'ESAT' ? (
        <Building2 size={14} />
      ) : mode === 'SERVICE_COMM' ? (
        <Truck size={14} />
      ) : mode === 'RETRAIT' ? (
        <Package size={14} />
      ) : mode === 'NON_AFFECTE' ? (
        <AlertTriangle size={14} />
      ) : (
        <UserRound size={14} />
      )}
      {MODE_LABELS[mode]}
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
