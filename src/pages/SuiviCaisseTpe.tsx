import {
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Edit3,
  Eye,
  FileText,
  GripVertical,
  PackageCheck,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react'

import { useObData } from '../contexts/ObDataContext'
import {
  SuiviMaterielProvider,
  useSuiviMateriel,
} from '../contexts/SuiviMaterielContext'
import type {
  MouvementMateriel,
  NouveauMouvementMateriel,
  StatutSuiviMateriel,
  TypeSuiviMateriel,
} from '../types/suiviMateriel'
import './SuiviCaisseTpe.css'

type MainTab = 'CAISSES' | 'TPE' | 'PLANNING'
type FormMode = 'create' | 'edit' | 'return'
type FormState = NouveauMouvementMateriel
type PlanningMode = 'MIXTE' | 'CAISSES' | 'TPE'
type PlanningScope = 'GLOBALE' | 'PRIS' | 'JOUR'
type DrawerTab = 'CAISSES' | 'TPE'
type PlanningBadgeKind = 'CAISSE' | 'CAISSE_TPE' | 'TPE'
type PlanningRow = {
  key: string
  type: TypeSuiviMateriel
  numero: number
  label: string
  assignments: MouvementMateriel[]
}
type DragPayload =
  | { kind: 'material'; type: TypeSuiviMateriel; numero: number }
  | { kind: 'movement'; id: string }

type PlanningSegment = {
  startIndex: number
  span: number
  items: MouvementMateriel[]
}

const STATUS_LABELS: Record<StatutSuiviMateriel, string> = {
  A_PLANIFIER: 'À planifier',
  SORTI: 'Sorti',
  A_CONTROLER: 'À contrôler',
  RETOURNE: 'Retourné',
}

const BASE_CAISSES = Array.from({ length: 50 }, (_, index) => index + 1)
const BASE_TPES = Array.from({ length: 40 }, (_, index) => index + 1)
const DRAG_MIME = 'application/x-operation-brioches-materiel'

function todayInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function getCurrentCampaign() {
  return `OB ${new Date().getFullYear()}`
}

function emptyForm(type: TypeSuiviMateriel): FormState {
  return {
    campagne: getCurrentCampaign(),
    type,
    numeroMateriel: 0,
    numeroSerie: '',
    montantFond: type === 'CAISSE' ? 50 : null,
    tpeAssocieNumero: null,
    nomStand: '',
    responsable: '',
    dateSortie: todayInput(),
    signatureSortie: '',
    dateRetourPrevue: todayInput(),
    dateRetourReelle: '',
    montantEncaisse: null,
    signatureRetour: '',
    ficheCaisseNumero: '',
    observationRetour: '',
  }
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function money(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '—'
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T12:00:00`))
}

function formatMaterialNumber(type: TypeSuiviMateriel, numero: number) {
  return type === 'TPE'
    ? `TPE-${String(numero).padStart(3, '0')}`
    : `C-${String(numero).padStart(3, '0')}`
}

function statutMouvement(mouvement: MouvementMateriel): StatutSuiviMateriel {
  if (!mouvement.dateSortie || mouvement.dateSortie > todayInput()) return 'A_PLANIFIER'
  if (!mouvement.dateRetourReelle) return 'SORTI'
  if (mouvement.montantEncaisse === null || mouvement.montantEncaisse < 0) {
    return 'A_CONTROLER'
  }
  return 'RETOURNE'
}

function toDate(value: string) {
  return new Date(`${value}T12:00:00`)
}

function dateInput(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfWeek(value: string) {
  const date = toDate(value)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return dateInput(date)
}

function addDays(value: string, days: number) {
  const date = toDate(value)
  date.setDate(date.getDate() + days)
  return dateInput(date)
}

function daysBetween(start: string, end: string) {
  const a = toDate(start).getTime()
  const b = toDate(end).getTime()
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

function plannedEnd(mouvement: MouvementMateriel) {
  return mouvement.dateRetourPrevue || mouvement.dateSortie
}

function visualEnd(mouvement: MouvementMateriel) {
  return mouvement.dateRetourReelle || plannedEnd(mouvement)
}

function movementCoversDate(mouvement: MouvementMateriel, date: string) {
  if (!mouvement.dateSortie) return false
  return date >= mouvement.dateSortie && date <= visualEnd(mouvement)
}

function movementBlocksDate(mouvement: MouvementMateriel, date: string) {
  if (!mouvement.dateSortie) return false
  if (mouvement.dateRetourReelle && date >= mouvement.dateRetourReelle) return false
  return date >= mouvement.dateSortie && date <= plannedEnd(mouvement)
}

function intersectsDates(mouvement: MouvementMateriel, dates: string[]) {
  return dates.some((date) => movementCoversDate(mouvement, date))
}

function planningKind(mouvement: MouvementMateriel): PlanningBadgeKind {
  if (mouvement.type === 'CAISSE' && mouvement.tpeAssocieNumero) return 'CAISSE_TPE'
  return mouvement.type === 'CAISSE' ? 'CAISSE' : 'TPE'
}

function isLate(mouvement: MouvementMateriel) {
  return Boolean(
    !mouvement.dateRetourReelle &&
      mouvement.dateRetourPrevue &&
      mouvement.dateRetourPrevue < todayInput(),
  )
}

function getDragPayload(event: DragEvent): DragPayload | null {
  const raw = event.dataTransfer.getData(DRAG_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

function setDragPayload(event: DragEvent, payload: DragPayload) {
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = payload.kind === 'movement' ? 'move' : 'copy'
}

function movementUsesTpe(mouvement: MouvementMateriel, tpeNumero: number) {
  return (
    (mouvement.type === 'TPE' && mouvement.numeroMateriel === tpeNumero) ||
    (mouvement.type === 'CAISSE' && mouvement.tpeAssocieNumero === tpeNumero)
  )
}

function SuiviCaisseTpeContent() {
  const { fichesCaisse } = useObData()
  const { mouvements, createMouvement, updateMouvement, deleteMouvement } =
    useSuiviMateriel()

  const [activeTab, setActiveTab] = useState<MainTab>('PLANNING')
  const [search, setSearch] = useState('')
  const [campagneFilter, setCampagneFilter] = useState(getCurrentCampaign())
  const [statusFilter, setStatusFilter] = useState<'TOUS' | StatutSuiviMateriel>('TOUS')
  const [weekStart, setWeekStart] = useState(startOfWeek(todayInput()))
  const [planningViewMode, setPlanningViewMode] = useState<PlanningMode>('MIXTE')
  const [planningScope, setPlanningScope] = useState<PlanningScope>('GLOBALE')
  const [selectedPlanningCaisse, setSelectedPlanningCaisse] = useState('TOUTES')
  const [selectedPlanningTpe, setSelectedPlanningTpe] = useState('TOUS')
  const [planningSearch, setPlanningSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('CAISSES')
  const [drawerSearch, setDrawerSearch] = useState('')
  const [focusDate, setFocusDate] = useState(todayInput())
  const [dragOverKey, setDragOverKey] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm('CAISSE'))
  const [error, setError] = useState('')

  const campaigns = useMemo(
    () =>
      [
        ...new Set<string>([
          ...mouvements.map((item) => item.campagne).filter(Boolean),
          ...fichesCaisse.map((item) => item.campagne).filter(Boolean),
          getCurrentCampaign(),
        ]),
      ].sort((a, b) => b.localeCompare(a, 'fr', { numeric: true })),
    [mouvements, fichesCaisse],
  )

  const fichesCampagne = useMemo(
    () =>
      fichesCaisse
        .filter((fiche) => fiche.campagne === campagneFilter)
        .sort((a, b) => b.numero.localeCompare(a.numero, 'fr', { numeric: true })),
    [fichesCaisse, campagneFilter],
  )

  const filtered = useMemo(() => {
    const type: TypeSuiviMateriel = activeTab === 'TPE' ? 'TPE' : 'CAISSE'
    const query = normalize(search)
    return mouvements
      .filter((item) => item.campagne === campagneFilter && item.type === type)
      .filter((item) => statusFilter === 'TOUS' || statutMouvement(item) === statusFilter)
      .filter((item) => {
        if (!query) return true
        return normalize(
          [
            item.numeroMateriel,
            item.numeroSerie,
            item.nomStand,
            item.responsable,
            item.ficheCaisseNumero,
            item.observationRetour,
          ].join(' '),
        ).includes(query)
      })
      .sort((a, b) =>
        b.dateSortie.localeCompare(a.dateSortie) || a.numeroMateriel - b.numeroMateriel,
      )
  }, [mouvements, campagneFilter, activeTab, statusFilter, search])

  const stats = useMemo(() => {
    const current = mouvements.filter((item) => item.campagne === campagneFilter)
    const caisse = current.filter((item) => item.type === 'CAISSE')
    const directTpe = current.filter((item) => item.type === 'TPE')
    const active = (item: MouvementMateriel) =>
      statutMouvement(item) === 'SORTI' || statutMouvement(item) === 'A_PLANIFIER'

    return {
      caissesSorties: caisse.filter(active).length,
      caissesAControler: caisse.filter((item) => statutMouvement(item) === 'A_CONTROLER')
        .length,
      fondsSortis: caisse
        .filter(active)
        .reduce((total, item) => total + Number(item.montantFond || 0), 0),
      totalCaisse: caisse.reduce(
        (total, item) => total + Number(item.montantEncaisse || 0),
        0,
      ),
      tpeSortis:
        directTpe.filter(active).length +
        caisse.filter((item) => active(item) && item.tpeAssocieNumero).length,
      tpeAControler: directTpe.filter((item) => statutMouvement(item) === 'A_CONTROLER')
        .length,
      ticketsTpe: fichesCampagne.reduce((total, fiche) => total + Number(fiche.nbTpe || 0), 0),
      totalTpe: directTpe.reduce(
        (total, item) => total + Number(item.montantEncaisse || 0),
        0,
      ),
    }
  }, [mouvements, campagneFilter, fichesCampagne])

  const detail = detailId
    ? mouvements.find((item) => item.id === detailId) || null
    : null

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )
  const visibleDates = planningScope === 'JOUR' ? [focusDate] : weekDays

  const planningSource = useMemo(
    () =>
      mouvements.filter(
        (item) => item.campagne === campagneFilter && intersectsDates(item, visibleDates),
      ),
    [mouvements, campagneFilter, visibleDates],
  )

  const tpeAssignmentsFor = (numero: number) =>
    planningSource.filter((item) => movementUsesTpe(item, numero))

  const planningRows = useMemo(() => {
    const query = normalize(planningSearch)
    const selectedCaisse =
      selectedPlanningCaisse === 'TOUTES' ? null : Number(selectedPlanningCaisse)
    const selectedTpe = selectedPlanningTpe === 'TOUS' ? null : Number(selectedPlanningTpe)

    const caisseRows: PlanningRow[] = BASE_CAISSES.map((numero) => ({
      key: `C-${numero}`,
      type: 'CAISSE',
      numero,
      label: formatMaterialNumber('CAISSE', numero),
      assignments: planningSource
        .filter((item) => item.type === 'CAISSE' && item.numeroMateriel === numero)
        .sort((a, b) => a.dateSortie.localeCompare(b.dateSortie)),
    }))

    const tpeRows: PlanningRow[] = BASE_TPES.map((numero) => ({
      key: `T-${numero}`,
      type: 'TPE',
      numero,
      label: formatMaterialNumber('TPE', numero),
      assignments:
        planningViewMode === 'MIXTE'
          ? planningSource
              .filter((item) => item.type === 'TPE' && item.numeroMateriel === numero)
              .sort((a, b) => a.dateSortie.localeCompare(b.dateSortie))
          : tpeAssignmentsFor(numero).sort((a, b) => a.dateSortie.localeCompare(b.dateSortie)),
    }))

    const baseRows =
      planningViewMode === 'CAISSES'
        ? caisseRows
        : planningViewMode === 'TPE'
          ? tpeRows
          : [...caisseRows, ...tpeRows]

    return baseRows.filter((row) => {
      if (row.type === 'CAISSE' && selectedCaisse !== null && row.numero !== selectedCaisse) {
        return false
      }
      if (row.type === 'TPE' && selectedTpe !== null && row.numero !== selectedTpe) return false
      if (row.type === 'CAISSE' && selectedTpe !== null) {
        if (!row.assignments.some((item) => item.tpeAssocieNumero === selectedTpe)) return false
      }
      if (row.type === 'TPE' && selectedCaisse !== null) return false

      if (query) {
        const haystack = normalize(
          [
            row.label,
            ...row.assignments.map(
              (item) => `${item.nomStand} ${item.responsable} ${item.observationRetour}`,
            ),
          ].join(' '),
        )
        if (!haystack.includes(query)) return false
      }

      if (planningScope === 'PRIS' && row.assignments.length === 0) return false
      if (
        planningScope === 'JOUR' &&
        !row.assignments.some((item) => movementCoversDate(item, focusDate))
      ) {
        return false
      }
      return true
    })
  }, [
    planningSource,
    planningViewMode,
    planningScope,
    selectedPlanningCaisse,
    selectedPlanningTpe,
    planningSearch,
    focusDate,
  ])

  const isTpeUnavailableOnDate = (numero: number, date: string) =>
    mouvements.some(
      (item) =>
        item.campagne === campagneFilter &&
        movementUsesTpe(item, numero) &&
        movementBlocksDate(item, date),
    )

  const availableCaisses = useMemo(
    () =>
      BASE_CAISSES.filter(
        (numero) =>
          !mouvements.some(
            (item) =>
              item.campagne === campagneFilter &&
              item.type === 'CAISSE' &&
              item.numeroMateriel === numero &&
              movementBlocksDate(item, focusDate),
          ),
      ),
    [mouvements, campagneFilter, focusDate],
  )

  const availableTpes = useMemo(
    () => BASE_TPES.filter((numero) => !isTpeUnavailableOnDate(numero, focusDate)),
    [mouvements, campagneFilter, focusDate],
  )

  const drawerItems = useMemo(() => {
    const query = normalize(drawerSearch)
    const source = drawerTab === 'CAISSES' ? availableCaisses : availableTpes
    const type: TypeSuiviMateriel = drawerTab === 'CAISSES' ? 'CAISSE' : 'TPE'
    return source.filter((numero) => !query || normalize(formatMaterialNumber(type, numero)).includes(query))
  }, [drawerTab, availableCaisses, availableTpes, drawerSearch])

  function openCreate(type: TypeSuiviMateriel, numero?: number, date?: string) {
    const targetDate = date || focusDate
    setFormMode('create')
    setEditingId(null)
    setForm({
      ...emptyForm(type),
      campagne: campagneFilter,
      numeroMateriel: numero ?? 0,
      dateSortie: targetDate,
      dateRetourPrevue: targetDate,
    })
    setError('')
    setModalOpen(true)
  }

  function openEdit(item: MouvementMateriel) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...editable } = item
    setFormMode('edit')
    setEditingId(item.id)
    setForm(editable)
    setError('')
    setModalOpen(true)
  }

  function openReturn(item: MouvementMateriel) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...editable } = item
    setFormMode('return')
    setEditingId(item.id)
    setForm({ ...editable, dateRetourReelle: editable.dateRetourReelle || todayInput() })
    setError('')
    setModalOpen(true)
  }

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
    return aStart <= bEnd && aEnd >= bStart
  }

  function materialConflict(candidate: FormState, ignoreId: string | null = editingId) {
    const start = candidate.dateSortie
    const end = candidate.dateRetourPrevue || candidate.dateSortie
    if (!start || candidate.numeroMateriel <= 0) return ''

    const sameMaterial = mouvements.find((item) => {
      if (item.id === ignoreId || item.campagne !== candidate.campagne) return false
      if (item.dateRetourReelle && item.dateRetourReelle <= start) return false
      const same =
        item.type === candidate.type && item.numeroMateriel === candidate.numeroMateriel
      return same && rangesOverlap(start, end, item.dateSortie, plannedEnd(item))
    })
    if (sameMaterial) {
      return `${candidate.type === 'TPE' ? 'Le TPE' : 'La caisse'} ${formatMaterialNumber(candidate.type, candidate.numeroMateriel)} est déjà affecté(e) sur cette période.`
    }

    if (candidate.type === 'TPE') {
      const paired = mouvements.find((item) => {
        if (item.id === ignoreId || item.campagne !== candidate.campagne) return false
        if (item.dateRetourReelle && item.dateRetourReelle <= start) return false
        return (
          item.type === 'CAISSE' &&
          item.tpeAssocieNumero === candidate.numeroMateriel &&
          rangesOverlap(start, end, item.dateSortie, plannedEnd(item))
        )
      })
      if (paired) return `Le ${formatMaterialNumber('TPE', candidate.numeroMateriel)} est déjà associé à une caisse sur cette période.`
    }

    if (candidate.type === 'CAISSE' && candidate.tpeAssocieNumero) {
      const tpeBusy = mouvements.find((item) => {
        if (item.id === ignoreId || item.campagne !== candidate.campagne) return false
        if (item.dateRetourReelle && item.dateRetourReelle <= start) return false
        return (
          movementUsesTpe(item, candidate.tpeAssocieNumero as number) &&
          rangesOverlap(start, end, item.dateSortie, plannedEnd(item))
        )
      })
      if (tpeBusy) {
        return `Le ${formatMaterialNumber('TPE', candidate.tpeAssocieNumero)} est déjà utilisé sur cette période.`
      }
    }

    return ''
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (form.numeroMateriel <= 0) return setError('Le numéro du matériel est obligatoire.')
    if (!form.nomStand.trim()) return setError('Le nom du stand ou de la destination est obligatoire.')
    if (!form.responsable.trim()) return setError('Le responsable est obligatoire.')
    if (!form.dateSortie) return setError('La date de sortie est obligatoire.')
    if (!form.dateRetourPrevue) return setError('La date de retour prévue est obligatoire.')
    if (form.dateRetourPrevue < form.dateSortie) {
      return setError('La date de retour prévue ne peut pas être antérieure à la date de sortie.')
    }
    if (form.dateRetourReelle && form.dateRetourReelle < form.dateSortie) {
      return setError('La date de retour réelle ne peut pas être antérieure à la date de sortie.')
    }
    const conflict = materialConflict(form)
    if (conflict) return setError(conflict)

    const normalized: FormState = {
      ...form,
      nomStand: form.nomStand.trim(),
      responsable: form.responsable.trim(),
      numeroSerie: form.numeroSerie.trim(),
      signatureSortie: form.signatureSortie.trim(),
      signatureRetour: form.signatureRetour.trim(),
      ficheCaisseNumero: form.ficheCaisseNumero.trim(),
      observationRetour: form.observationRetour.trim(),
    }

    if (editingId && (formMode === 'edit' || formMode === 'return')) {
      updateMouvement(editingId, normalized)
    } else {
      createMouvement(normalized)
    }
    setModalOpen(false)
    setEditingId(null)
  }

  function remove(item: MouvementMateriel) {
    if (!window.confirm(`Supprimer l'affectation de ${formatMaterialNumber(item.type, item.numeroMateriel)} pour ${item.nomStand} ?`)) return
    deleteMouvement(item.id)
    if (detailId === item.id) setDetailId(null)
  }

  function moveMovementToDate(item: MouvementMateriel, targetDate: string) {
    if (item.dateRetourReelle) {
      window.alert('Une affectation déjà retournée ne peut plus être déplacée. Modifiez-la depuis sa fiche si nécessaire.')
      return
    }
    const duration = daysBetween(item.dateSortie, plannedEnd(item))
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...candidate } = item
    const shifted: FormState = {
      ...candidate,
      dateSortie: targetDate,
      dateRetourPrevue: addDays(targetDate, duration),
    }
    const conflict = materialConflict(shifted, item.id)
    if (conflict) {
      window.alert(conflict)
      return
    }
    updateMouvement(item.id, shifted)
  }

  function handleDayDrop(event: DragEvent<HTMLElement>, date: string) {
    event.preventDefault()
    setDragOverKey('')
    const payload = getDragPayload(event)
    if (!payload) return
    setFocusDate(date)
    if (payload.kind === 'material') {
      openCreate(payload.type, payload.numero, date)
      return
    }
    const item = mouvements.find((movement) => movement.id === payload.id)
    if (item) moveMovementToDate(item, date)
  }

  function handleTpeDropOnCaisse(event: DragEvent<HTMLElement>, item: MouvementMateriel) {
    const payload = getDragPayload(event)
    if (!payload || payload.kind !== 'material' || payload.type !== 'TPE' || item.type !== 'CAISSE') return
    event.preventDefault()
    event.stopPropagation()
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...candidate } = item
    const next: FormState = { ...candidate, tpeAssocieNumero: payload.numero }
    const conflict = materialConflict(next, item.id)
    if (conflict) {
      window.alert(conflict)
      return
    }
    updateMouvement(item.id, next)
  }

  function buildSegments(row: PlanningRow, dates: string[]): PlanningSegment[] {
    const segments: PlanningSegment[] = []
    let index = 0
    while (index < dates.length) {
      const date = dates[index]
      const items = row.assignments.filter((item) => movementCoversDate(item, date))
      if (items.length === 0) {
        segments.push({ startIndex: index, span: 1, items: [] })
        index += 1
        continue
      }
      if (items.length > 1) {
        segments.push({ startIndex: index, span: 1, items })
        index += 1
        continue
      }
      const item = items[0]
      let span = 1
      while (
        index + span < dates.length &&
        movementCoversDate(item, dates[index + span]) &&
        row.assignments.filter((other) => movementCoversDate(other, dates[index + span])).length === 1
      ) {
        span += 1
      }
      segments.push({ startIndex: index, span, items: [item] })
      index += span
    }
    return segments
  }

  const activeType: TypeSuiviMateriel = activeTab === 'TPE' ? 'TPE' : 'CAISSE'

  return (
    <main className="sct-page">
      <header className="sct-header">
        <div>
          <span className="sct-eyebrow">Gestion · Opération Brioches</span>
          <h1>Suivi caisse & TPE</h1>
          <p>Planification, disponibilité et suivi des 50 caisses et des TPE.</p>
        </div>
        <div className="sct-header-actions">
          <select value={campagneFilter} onChange={(e) => setCampagneFilter(e.target.value)}>
            {campaigns.map((campagne) => <option key={campagne}>{campagne}</option>)}
          </select>
          {activeTab !== 'PLANNING' && (
            <button className="sct-primary" type="button" onClick={() => openCreate(activeType)}>
              <Plus size={18} /> Nouvelle affectation
            </button>
          )}
        </div>
      </header>

      <nav className="sct-tabs">
        <button className={activeTab === 'CAISSES' ? 'active' : ''} type="button" onClick={() => setActiveTab('CAISSES')}>
          <WalletCards size={18} /> Suivi caisse
        </button>
        <button className={activeTab === 'TPE' ? 'active' : ''} type="button" onClick={() => setActiveTab('TPE')}>
          <CreditCard size={18} /> Suivi TPE
        </button>
        <button className={activeTab === 'PLANNING' ? 'active' : ''} type="button" onClick={() => setActiveTab('PLANNING')}>
          <CalendarDays size={18} /> Planning
        </button>
      </nav>

      {activeTab === 'CAISSES' && (
        <>
          <section className="sct-kpis sct-kpis-four">
            <Kpi tone="orange" icon={<WalletCards size={21} />} label="Caisses affectées" value={String(stats.caissesSorties)} subtitle="planifiées ou sorties" />
            <Kpi tone="blue" icon={<Banknote size={21} />} label="Fonds en circulation" value={money(stats.fondsSortis)} subtitle="fonds liés aux affectations actives" />
            <Kpi tone="green" icon={<PackageCheck size={21} />} label="Montant encaissé" value={money(stats.totalCaisse)} subtitle="retours enregistrés" />
            <Kpi tone="red" icon={<CircleAlert size={21} />} label="À contrôler" value={String(stats.caissesAControler)} subtitle="retours à vérifier" />
          </section>
          <TrackingTable type="CAISSE" data={filtered} search={search} onSearch={setSearch} statusFilter={statusFilter} onStatusFilter={setStatusFilter} onDetail={setDetailId} onEdit={openEdit} onReturn={openReturn} />
        </>
      )}

      {activeTab === 'TPE' && (
        <>
          <section className="sct-kpis sct-kpis-four">
            <Kpi tone="orange" icon={<CreditCard size={21} />} label="TPE affectés" value={String(stats.tpeSortis)} subtitle="seuls ou associés à une caisse" />
            <Kpi tone="blue" icon={<FileText size={21} />} label="Tickets TPE" value={new Intl.NumberFormat('fr-FR').format(stats.ticketsTpe)} subtitle="tickets saisis dans les fiches" />
            <Kpi tone="green" icon={<Banknote size={21} />} label="Montant encaissé" value={money(stats.totalTpe)} subtitle="retours TPE seuls" />
            <Kpi tone="red" icon={<CircleAlert size={21} />} label="À contrôler" value={String(stats.tpeAControler)} subtitle="retours à vérifier" />
          </section>
          <TrackingTable type="TPE" data={filtered} search={search} onSearch={setSearch} statusFilter={statusFilter} onStatusFilter={setStatusFilter} onDetail={setDetailId} onEdit={openEdit} onReturn={openReturn} />
        </>
      )}

      {activeTab === 'PLANNING' && (
        <section className={`sct-planning-layout ${drawerOpen ? 'drawer-open' : 'drawer-closed'}`}>
          <div className="sct-planning-main">
            <section className="sct-card sct-planning-card">
              <div className="sct-mode-bars">
                <div className="sct-view-switch sct-type-switch">
                  <button className={planningViewMode === 'MIXTE' ? 'active' : ''} type="button" onClick={() => setPlanningViewMode('MIXTE')}>Mixtes</button>
                  <button className={planningViewMode === 'CAISSES' ? 'active' : ''} type="button" onClick={() => setPlanningViewMode('CAISSES')}>Caisses</button>
                  <button className={planningViewMode === 'TPE' ? 'active' : ''} type="button" onClick={() => setPlanningViewMode('TPE')}>TPE</button>
                </div>
                <div className="sct-view-switch sct-scope-switch">
                  <button className={planningScope === 'GLOBALE' ? 'active' : ''} type="button" onClick={() => setPlanningScope('GLOBALE')}>Vue globale</button>
                  <button className={planningScope === 'PRIS' ? 'active' : ''} type="button" onClick={() => setPlanningScope('PRIS')}>Déjà pris</button>
                  <button className={planningScope === 'JOUR' ? 'active' : ''} type="button" onClick={() => setPlanningScope('JOUR')}>Journalière</button>
                </div>
              </div>

              <div className="sct-planning-filters">
                <select value={selectedPlanningCaisse} onChange={(e) => setSelectedPlanningCaisse(e.target.value)}>
                  <option value="TOUTES">Toutes les caisses</option>
                  {BASE_CAISSES.map((n) => <option key={n} value={n}>{formatMaterialNumber('CAISSE', n)}</option>)}
                </select>
                <select value={selectedPlanningTpe} onChange={(e) => setSelectedPlanningTpe(e.target.value)}>
                  <option value="TOUS">Tous les TPE</option>
                  {BASE_TPES.map((n) => <option key={n} value={n}>{formatMaterialNumber('TPE', n)}</option>)}
                </select>
                <label className="sct-search sct-search-small">
                  <Search size={16} />
                  <input value={planningSearch} onChange={(e) => setPlanningSearch(e.target.value)} placeholder="Stand, responsable, matériel..." />
                </label>
                <div className="sct-planning-controls">
                  {planningScope !== 'JOUR' && <button type="button" onClick={() => { const next = addDays(weekStart, -7); setWeekStart(next); setFocusDate(next) }}><ChevronLeft size={17} /></button>}
                  <label><CalendarDays size={16} /><input type="date" value={planningScope === 'JOUR' ? focusDate : weekStart} onChange={(e) => { if (planningScope === 'JOUR') { setFocusDate(e.target.value) } else { const next = startOfWeek(e.target.value); setWeekStart(next); setFocusDate(next) } }} /></label>
                  {planningScope !== 'JOUR' && <button type="button" onClick={() => { const next = addDays(weekStart, 7); setWeekStart(next); setFocusDate(next) }}><ChevronRight size={17} /></button>}
                </div>
                <button className="sct-drawer-toggle" type="button" onClick={() => setDrawerOpen((current) => !current)}>
                  {drawerOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
                  Matériel disponible
                </button>
              </div>

              <div className="sct-planning-head compact">
                <div>
                  <span className="sct-section-icon"><CalendarDays size={18} /></span>
                  <div>
                    <h2>Planning du matériel</h2>
                    <small>{planningScope === 'JOUR' ? `Vue du ${formatDate(focusDate)}` : `Semaine du ${formatDate(weekStart)}`}</small>
                  </div>
                </div>
                <div className="sct-legend">
                  <span className="legend-combo">Caisse + TPE</span>
                  <span className="legend-caisse">Caisse seule</span>
                  <span className="legend-tpe">TPE seul</span>
                  <span className="legend-return">Retour prévu</span>
                </div>
              </div>

              <div
                className={`sct-drop-strip ${dragOverKey === 'strip' ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOverKey('strip') }}
                onDragLeave={() => setDragOverKey('')}
                onDrop={(e) => handleDayDrop(e, planningScope === 'JOUR' ? focusDate : focusDate)}
              >
                <GripVertical size={16} />
                Glissez un matériel ici pour l'affecter au <strong>{formatDate(focusDate)}</strong>
              </div>

              <div className="sct-planning-wrap">
                <table className={`sct-planning-table ${planningScope === 'JOUR' ? 'daily' : ''}`}>
                  <thead>
                    <tr>
                      <th>Matériel</th>
                      {visibleDates.map((date) => (
                        <th key={date} className={focusDate === date ? 'focus' : ''} onClick={() => setFocusDate(date)}>
                          <strong>{new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(toDate(date))}</strong>
                          <small>{formatDate(date)}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {planningRows.map((row) => {
                      const segments = buildSegments(row, visibleDates)
                      return (
                        <tr key={row.key}>
                          <td className="sct-material-cell">
                            <strong>{row.label}</strong>
                            <small>{row.assignments.length ? `${row.assignments.length} affectation${row.assignments.length > 1 ? 's' : ''}` : 'Disponible'}</small>
                          </td>
                          {segments.map((segment) => {
                            const date = visibleDates[segment.startIndex]
                            const key = `${row.key}-${date}`
                            return (
                              <td
                                key={key}
                                colSpan={segment.span}
                                className={`${focusDate === date ? 'focus' : ''} ${dragOverKey === key ? 'drag-over' : ''}`}
                                onDragOver={(e) => { e.preventDefault(); setDragOverKey(key) }}
                                onDragLeave={() => setDragOverKey('')}
                                onDrop={(e) => handleDayDrop(e, date)}
                                onClick={() => setFocusDate(date)}
                              >
                                {segment.items.length === 0 ? (
                                  <span className="sct-empty-slot">Déposer ici</span>
                                ) : (
                                  segment.items.map((item) => (
                                    <button
                                      key={item.id}
                                      type="button"
                                      draggable={!item.dateRetourReelle}
                                      className={`sct-planning-event kind-${planningKind(item).toLowerCase()} ${segment.span > 1 ? 'multi-day' : ''} ${isLate(item) ? 'late' : ''}`}
                                      onDragStart={(e) => setDragPayload(e, { kind: 'movement', id: item.id })}
                                      onDragOver={(e) => {
                                        if (item.type === 'CAISSE') e.preventDefault()
                                      }}
                                      onDrop={(e) => handleTpeDropOnCaisse(e, item)}
                                      onClick={(e) => { e.stopPropagation(); setDetailId(item.id) }}
                                    >
                                      <span className="sct-event-main">
                                        <GripVertical size={14} />
                                        <span>
                                          <strong>{item.nomStand}</strong>
                                          <small>{item.responsable}</small>
                                        </span>
                                      </span>
                                      <span className="sct-event-meta">
                                        {item.type === 'CAISSE' && item.tpeAssocieNumero && <b>{formatMaterialNumber('TPE', item.tpeAssocieNumero)}</b>}
                                        <em>Retour prévu {formatDate(item.dateRetourPrevue)}</em>
                                      </span>
                                    </button>
                                  ))
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                    {planningRows.length === 0 && (
                      <tr><td colSpan={visibleDates.length + 1} className="sct-empty">Aucune affectation ne correspond à cette vue. Utilisez le volet « Matériel disponible » pour en créer une.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          {drawerOpen && (
            <aside className="sct-drawer">
              <header className="sct-drawer-header">
                <div><span>DISPONIBILITÉ</span><h3>Matériel disponible</h3><p>Pour le {formatDate(focusDate)}</p></div>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Fermer"><X size={18} /></button>
              </header>
              <div className="sct-drawer-tabs">
                <button className={drawerTab === 'CAISSES' ? 'active' : ''} type="button" onClick={() => setDrawerTab('CAISSES')}>Caisses ({availableCaisses.length})</button>
                <button className={drawerTab === 'TPE' ? 'active' : ''} type="button" onClick={() => setDrawerTab('TPE')}>TPE ({availableTpes.length})</button>
              </div>
              <div className="sct-drawer-body">
                <label className="sct-search sct-drawer-search"><Search size={16} /><input value={drawerSearch} onChange={(e) => setDrawerSearch(e.target.value)} placeholder={`Rechercher ${drawerTab === 'CAISSES' ? 'une caisse' : 'un TPE'}...`} /></label>
                <p className="sct-drag-help">Glissez une carte directement sur le planning.</p>
                <div className="sct-available-list">
                  {drawerItems.map((numero) => {
                    const type: TypeSuiviMateriel = drawerTab === 'CAISSES' ? 'CAISSE' : 'TPE'
                    return (
                      <article key={`${type}-${numero}`} draggable onDragStart={(e) => setDragPayload(e, { kind: 'material', type, numero })}>
                        <GripVertical className="sct-grip" size={18} />
                        <div><strong>{formatMaterialNumber(type, numero)}</strong><small>Disponible aujourd'hui</small></div>
                        <span className="sct-available-badge">Disponible</span>
                        <button type="button" onClick={() => openCreate(type, numero, focusDate)}>Affecter</button>
                      </article>
                    )
                  })}
                  {drawerItems.length === 0 && <div className="sct-drawer-empty">Aucun matériel disponible pour cette recherche.</div>}
                </div>
              </div>
            </aside>
          )}
        </section>
      )}

      {detail && (
        <div className="sct-overlay" onMouseDown={(e) => e.target === e.currentTarget && setDetailId(null)}>
          <section className="sct-modal sct-detail-modal">
            <header className="sct-modal-header">
              <div><span>{detail.type === 'TPE' ? 'SUIVI TPE' : 'SUIVI CAISSE'}</span><h2>{formatMaterialNumber(detail.type, detail.numeroMateriel)}</h2><p>{detail.nomStand}</p></div>
              <button type="button" onClick={() => setDetailId(null)}><X size={19} /></button>
            </header>
            <div className="sct-modal-body">
              <section className="sct-detail-grid">
                <Detail label="Campagne" value={detail.campagne} />
                {detail.type === 'TPE' && <Detail label="N° de série" value={detail.numeroSerie || '—'} />}
                {detail.type === 'CAISSE' && <Detail label="Fonds de caisse" value={money(detail.montantFond)} />}
                {detail.type === 'CAISSE' && <Detail label="TPE associé" value={detail.tpeAssocieNumero ? formatMaterialNumber('TPE', detail.tpeAssocieNumero) : '—'} />}
                <Detail label="Responsable" value={detail.responsable} />
                <Detail label="Date sortie" value={formatDate(detail.dateSortie)} />
                <Detail label="Retour prévu" value={formatDate(detail.dateRetourPrevue)} />
                <Detail label="Retour réel" value={formatDate(detail.dateRetourReelle)} />
                <Detail label="Montant encaissé" value={money(detail.montantEncaisse)} />
                <Detail label="Fiche de caisse" value={detail.ficheCaisseNumero || '—'} />
                <Detail label="Statut" value={STATUS_LABELS[statutMouvement(detail)]} />
              </section>
              {detail.observationRetour && <section className="sct-note"><strong>Observation du retour</strong><p>{detail.observationRetour}</p></section>}
            </div>
            <footer className="sct-modal-footer">
              <button type="button" className="sct-danger" onClick={() => remove(detail)}><Trash2 size={16} /> Supprimer</button>
              <span />
              <button type="button" className="sct-secondary" onClick={() => { setDetailId(null); openEdit(detail) }}><Edit3 size={16} /> Modifier</button>
              {!detail.dateRetourReelle && <button type="button" className="sct-primary" onClick={() => { setDetailId(null); openReturn(detail) }}><RotateCcw size={16} /> Enregistrer le retour</button>}
            </footer>
          </section>
        </div>
      )}

      {modalOpen && (
        <div className="sct-overlay" onMouseDown={(e) => e.target === e.currentTarget && setModalOpen(false)}>
          <section className="sct-modal">
            <header className="sct-modal-header">
              <div><span>GESTION DU MATÉRIEL</span><h2>{formMode === 'return' ? 'Enregistrer le retour' : formMode === 'edit' ? 'Modifier l’affectation' : 'Nouvelle affectation'}</h2></div>
              <button type="button" onClick={() => setModalOpen(false)}><X size={19} /></button>
            </header>
            <form onSubmit={submit}>
              <div className="sct-modal-body">
                <FormSection title="Matériel" icon={form.type === 'TPE' ? <CreditCard size={18} /> : <WalletCards size={18} />}>
                  <Field label="Campagne"><select value={form.campagne} onChange={(e) => updateField('campagne', e.target.value)}>{campaigns.map((c) => <option key={c}>{c}</option>)}</select></Field>
                  <Field label={form.type === 'TPE' ? 'N° TPE *' : 'N° caisse *'}><input type="number" min="1" max={form.type === 'TPE' ? 40 : 50} value={form.numeroMateriel || ''} onChange={(e) => updateField('numeroMateriel', Number(e.target.value) || 0)} /></Field>
                  {form.type === 'TPE' && <Field label="N° de série TPE"><input value={form.numeroSerie} onChange={(e) => updateField('numeroSerie', e.target.value)} /></Field>}
                  {form.type === 'CAISSE' && <Field label="Montant fonds de caisse"><input type="number" min="0" step="0.01" value={form.montantFond ?? ''} onChange={(e) => updateField('montantFond', e.target.value === '' ? null : Number(e.target.value))} /></Field>}
                  {form.type === 'CAISSE' && <Field label="TPE associé"><select value={form.tpeAssocieNumero ?? ''} onChange={(e) => updateField('tpeAssocieNumero', e.target.value === '' ? null : Number(e.target.value))}><option value="">Caisse seule</option>{BASE_TPES.map((n) => <option key={n} value={n}>{formatMaterialNumber('TPE', n)}</option>)}</select></Field>}
                </FormSection>

                <FormSection title="Affectation" icon={<UserRound size={18} />}>
                  <Field label="Stand / destination *" wide><input value={form.nomStand} onChange={(e) => updateField('nomStand', e.target.value)} placeholder="Ex. Leclerc Verdun" /></Field>
                  <Field label="Responsable *"><input value={form.responsable} onChange={(e) => updateField('responsable', e.target.value)} /></Field>
                  <Field label="Date de sortie *"><input type="date" value={form.dateSortie} onChange={(e) => updateField('dateSortie', e.target.value)} /></Field>
                  <Field label="Retour prévu *"><input type="date" value={form.dateRetourPrevue} onChange={(e) => updateField('dateRetourPrevue', e.target.value)} /></Field>
                  <Field label="Validation sortie"><input value={form.signatureSortie} onChange={(e) => updateField('signatureSortie', e.target.value)} placeholder="Nom / initiales" /></Field>
                </FormSection>

                <FormSection title="Retour réel" icon={<RotateCcw size={18} />}>
                  <Field label="Date de retour réel"><input type="date" value={form.dateRetourReelle} onChange={(e) => updateField('dateRetourReelle', e.target.value)} /></Field>
                  <Field label="Montant encaissé"><input type="number" min="0" step="0.01" value={form.montantEncaisse ?? ''} onChange={(e) => updateField('montantEncaisse', e.target.value === '' ? null : Number(e.target.value))} /></Field>
                  <Field label="Fiche de caisse"><select value={form.ficheCaisseNumero} onChange={(e) => updateField('ficheCaisseNumero', e.target.value)}><option value="">Aucune / non renseignée</option>{fichesCampagne.map((fiche) => <option key={fiche.id} value={fiche.numero}>{fiche.numero} — {fiche.libelle}</option>)}</select></Field>
                  <Field label="Validation retour"><input value={form.signatureRetour} onChange={(e) => updateField('signatureRetour', e.target.value)} placeholder="Nom / initiales" /></Field>
                  <Field label="Observation du retour" wide><textarea rows={3} value={form.observationRetour} onChange={(e) => updateField('observationRetour', e.target.value)} /></Field>
                </FormSection>
                {error && <div className="sct-error"><CircleAlert size={17} />{error}</div>}
              </div>
              <footer className="sct-modal-footer"><button type="button" className="sct-secondary" onClick={() => setModalOpen(false)}>Annuler</button><span /><button type="submit" className="sct-primary"><CheckCircle2 size={17} /> Enregistrer</button></footer>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default function SuiviCaisseTpe() {
  return <SuiviMaterielProvider><SuiviCaisseTpeContent /></SuiviMaterielProvider>
}

function TrackingTable({ type, data, search, onSearch, statusFilter, onStatusFilter, onDetail, onEdit, onReturn }: {
  type: TypeSuiviMateriel
  data: MouvementMateriel[]
  search: string
  onSearch: (value: string) => void
  statusFilter: 'TOUS' | StatutSuiviMateriel
  onStatusFilter: (value: 'TOUS' | StatutSuiviMateriel) => void
  onDetail: (id: string) => void
  onEdit: (item: MouvementMateriel) => void
  onReturn: (item: MouvementMateriel) => void
}) {
  return (
    <section className="sct-card">
      <div className="sct-card-title"><div><span className="sct-section-icon">{type === 'TPE' ? <CreditCard size={18} /> : <WalletCards size={18} />}</span><div><h2>{type === 'TPE' ? 'Liste des TPE' : 'Liste des caisses'}</h2><small>{data.length} mouvement{data.length > 1 ? 's' : ''}</small></div></div></div>
      <div className="sct-toolbar">
        <label className="sct-search"><Search size={17} /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Rechercher un matériel, un stand, un responsable..." /></label>
        <select value={statusFilter} onChange={(e) => onStatusFilter(e.target.value as 'TOUS' | StatutSuiviMateriel)}><option value="TOUS">Tous les statuts</option>{(Object.keys(STATUS_LABELS) as StatutSuiviMateriel[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select>
      </div>
      <div className="sct-table-wrap">
        <table className="sct-table"><thead><tr><th>{type === 'TPE' ? 'N° TPE' : 'N° caisse'}</th>{type === 'TPE' ? <th>N° série</th> : <th>Fonds</th>}<th>Destination</th><th>Responsable</th><th>Sortie</th><th>Retour prévu</th><th>Retour réel</th><th>Montant</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>{data.map((item) => <tr key={item.id} onDoubleClick={() => onDetail(item.id)}><td><strong className="sct-number">{formatMaterialNumber(item.type, item.numeroMateriel)}</strong>{item.type === 'CAISSE' && item.tpeAssocieNumero && <small>+ {formatMaterialNumber('TPE', item.tpeAssocieNumero)}</small>}</td>{type === 'TPE' ? <td>{item.numeroSerie || '—'}</td> : <td>{money(item.montantFond)}</td>}<td><strong>{item.nomStand}</strong></td><td>{item.responsable}</td><td>{formatDate(item.dateSortie)}</td><td><span className="sct-planned-date">{formatDate(item.dateRetourPrevue)}</span></td><td>{formatDate(item.dateRetourReelle)}</td><td><strong>{money(item.montantEncaisse)}</strong></td><td><StatusBadge status={statutMouvement(item)} /></td><td><div className="sct-actions"><button type="button" onClick={() => onDetail(item.id)}><Eye size={16} /></button><button type="button" onClick={() => onEdit(item)}><Edit3 size={16} /></button>{!item.dateRetourReelle && <button className="return" type="button" onClick={() => onReturn(item)}><RotateCcw size={16} /></button>}</div></td></tr>)}{data.length === 0 && <tr><td colSpan={10} className="sct-empty">Aucun mouvement enregistré.</td></tr>}</tbody>
        </table>
      </div>
    </section>
  )
}

function Kpi({ icon, tone, label, value, subtitle }: { icon: ReactNode; tone: 'blue' | 'orange' | 'green' | 'red'; label: string; value: string; subtitle?: string }) {
  return <article className="sct-kpi"><span className={`sct-kpi-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong>{subtitle && <em>{subtitle}</em>}</div></article>
}

function StatusBadge({ status }: { status: StatutSuiviMateriel }) {
  return <span className={`sct-status status-${status.toLowerCase()}`}>{status === 'RETOURNE' ? <CheckCircle2 size={13} /> : status === 'A_CONTROLER' ? <CircleAlert size={13} /> : status === 'SORTI' ? <PackageCheck size={13} /> : <CalendarDays size={13} />}{STATUS_LABELS[status]}</span>
}

function FormSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <section className="sct-form-section"><header>{icon}<h3>{title}</h3></header><div className="sct-form-grid">{children}</div></section>
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? 'sct-field-wide' : ''}><span>{label}</span>{children}</label>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="sct-detail"><span>{label}</span><strong>{value}</strong></div>
}
