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
  commandes: Record<number, { selected: boolean; heure: string }>
}

const STORAGE_KEY = 'ob-livraisons-retraits-v1'

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

function csvCell(value: unknown) {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

export default function LivraisonsRetraits() {
  const {
    commandes,
    setCommandes,
    getDonateurById,
  } = useObData()

  const initialDate = useMemo(() => {
    const dates = commandes
      .map((commande) => commande.datePrevueLivraison)
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

  const [activeTab, setActiveTab] =
    useState<Tab>('GLOBAL')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<'TOUS' | StatutLivraison>('TOUS')
  const [modeFilter, setModeFilter] =
    useState<'TOUS' | ModeLivraison>('TOUS')
  const [responsableFilter, setResponsableFilter] =
    useState('TOUS')
  const [secteurFilter, setSecteurFilter] =
    useState('TOUS')

  const [tourOpen, setTourOpen] = useState(false)
  const [detailId, setDetailId] =
    useState<string | null>(null)

  const [tourForm, setTourForm] =
    useState<TourForm>(() => ({
      date: initialDate,
      mode: 'BENEVOLE',
      responsable: '',
      commandes: {},
    }))

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
        (mission) => mission.date === selectedDate,
      ),
    [missions, selectedDate],
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
          (commande) => commande.statut !== 'ANNULEE',
        )
        .sort((a, b) =>
          a.numero.localeCompare(b.numero, 'fr', {
            numeric: true,
          }),
        ),
    [commandes],
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

    const responsable =
      tourForm.mode === 'RETRAIT'
        ? tourForm.responsable.trim() ||
          'Retrait client'
        : tourForm.responsable.trim()

    if (!responsable) {
      window.alert(
        'Renseigne la personne ou la structure responsable.',
      )
      return
    }

    const now = new Date().toISOString()

    setMissions((current) => {
      const next = [...current]

      for (const commandeId of selectedIds) {
        const currentMissionIndex = next.findIndex(
          (mission) =>
            mission.commandeId === commandeId &&
            mission.date === tourForm.date,
        )

        const heure =
          tourForm.commandes[commandeId]?.heure ||
          ''

        if (currentMissionIndex >= 0) {
          next[currentMissionIndex] = {
            ...next[currentMissionIndex],
            mode: tourForm.mode,
            responsable,
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
        </section>

        <aside className="lr-aside">
          <section className="lr-card lr-tours">
            <div className="lr-aside-title">
              <div>
                <Truck size={19} />
                <h2>Tournées du jour</h2>
              </div>
              <span>
                {tournees.length} responsables
              </span>
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
                            responsable:
                              mode ===
                              'SERVICE_COMM'
                                ? 'Service Communication'
                                : mode ===
                                    'RETRAIT'
                                  ? 'Retrait client'
                                  : '',
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

                  <label>
                    <span>
                      Responsable / structure
                    </span>
                    <input
                      value={tourForm.responsable}
                      onChange={(event) =>
                        setTourForm(
                          (current) => ({
                            ...current,
                            responsable:
                              event.target.value,
                          }),
                        )
                      }
                      placeholder="Ex. Tartempion"
                    />
                  </label>
                </div>

                <div className="lr-stop-picker">
                  <div className="lr-stop-picker-title">
                    <div>
                      <h3>
                        Ajouter les commandes
                      </h3>
                      <p>
                        Coche les arrêts de cette
                        tournée et indique leur heure.
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
