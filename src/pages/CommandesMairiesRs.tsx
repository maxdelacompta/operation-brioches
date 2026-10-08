import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Download,
  Eye,
  Mail,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
  UserRound,
  X,
} from 'lucide-react'

import { useMairies } from '../contexts/MairiesContext'
import { useCommandesMairiesRs } from '../contexts/CommandesMairiesRsContext'
import type {
  CommandeMairieRs,
  NouvelleCommandeMairieRs,
  StatutCommandeMairieRs,
  TypeCommandeMairieRs,
} from '../types/commandesMairiesRs'
import './CommandesMairiesRs.css'

type FormMode = 'create' | 'edit'

const STATUS_LABELS: Record<StatutCommandeMairieRs, string> = {
  BROUILLON: 'Brouillon',
  COMMANDEE: 'Commandée',
  A_PREPARER: 'À préparer',
  A_RECUPERER: 'À récupérer',
  BRIOCHES_REMISES: 'Brioches remises',
  DONS_A_RECUPERER: 'Dons à récupérer',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
}

const TYPE_LABELS: Record<TypeCommandeMairieRs, string> = {
  MAIRIE: 'Mairie',
  RS: 'RS',
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function money(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function number(value: number) {
  return new Intl.NumberFormat('fr-FR').format(value)
}

function formatDate(value: string) {
  if (!value) return '—'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  return new Intl.DateTimeFormat('fr-FR').format(
    new Date(`${value}T12:00:00`),
  )
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function emptyCommande(
  campagne: string,
): NouvelleCommandeMairieRs {
  return {
    campagne,
    type: 'MAIRIE',
    mairieId: null,

    secteur: '',
    sousSecteur: '',
    quiPasseCommande: '',
    responsableSecteur: '',

    quantite: 0,
    nbCartons: 0,

    dateRecuperation: '',
    recuperationLibre: '',
    quiRecupere: '',
    email: '',
    telephone: '',
    lieuRecuperation: '',
    livraisonPar: '',
    remarque: '',

    prixUnitaire: 5,
    donPrevu: 0,
    nombreBriochesVendues: null,
    personneRapportantDons: '',
    lieuDepotDons: '',
    donRecu: null,

    statut: 'BROUILLON',
  }
}

function getGap(item: CommandeMairieRs) {
  if (item.donRecu === null) return null
  return item.donRecu - item.donPrevu
}


export default function CommandesMairiesRs() {
  const {
    commandes,
    createCommande,
    updateCommande,
    deleteCommande,
  } = useCommandesMairiesRs()

  const { mairies } = useMairies()

  const campaigns = useMemo(
    () =>
      Array.from(
        new Set(
          commandes
            .map((item) => item.campagne)
            .filter(Boolean),
        ),
      ).sort((a, b) =>
        b.localeCompare(a, 'fr', { numeric: true }),
      ),
    [commandes],
  )

  const [campagneFilter, setCampagneFilter] =
    useState(campaigns[0] || `OB ${new Date().getFullYear()}`)

  const [search, setSearch] = useState('')
  const [secteurFilter, setSecteurFilter] = useState('TOUS')
  const [sousSecteurFilter, setSousSecteurFilter] = useState('TOUS')
  const [typeFilter, setTypeFilter] = useState<'TOUS' | TypeCommandeMairieRs>('TOUS')
  const [statusFilter, setStatusFilter] = useState<'TOUS' | StatutCommandeMairieRs>('TOUS')

  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const [detailId, setDetailId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] =
    useState<NouvelleCommandeMairieRs>(
      emptyCommande(campagneFilter),
    )
  const [error, setError] = useState('')

  const campagneCommandes = useMemo(
    () =>
      commandes.filter(
        (item) => item.campagne === campagneFilter,
      ),
    [commandes, campagneFilter],
  )

  const secteurs = useMemo(
    () =>
      [
        'TOUS',
        ...Array.from(
          new Set(
            campagneCommandes
              .map((item) => item.secteur.trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, 'fr')),
      ],
    [campagneCommandes],
  )

  const sousSecteurs = useMemo(
    () =>
      [
        'TOUS',
        ...Array.from(
          new Set(
            campagneCommandes
              .filter(
                (item) =>
                  secteurFilter === 'TOUS' ||
                  item.secteur === secteurFilter,
              )
              .map((item) => item.sousSecteur.trim())
              .filter(Boolean),
          ),
        ).sort((a, b) => a.localeCompare(b, 'fr')),
      ],
    [campagneCommandes, secteurFilter],
  )

  const filtered = useMemo(() => {
    const query = normalize(search)

    return campagneCommandes
      .filter(
        (item) =>
          secteurFilter === 'TOUS' ||
          item.secteur === secteurFilter,
      )
      .filter(
        (item) =>
          sousSecteurFilter === 'TOUS' ||
          item.sousSecteur === sousSecteurFilter,
      )
      .filter(
        (item) =>
          typeFilter === 'TOUS' ||
          item.type === typeFilter,
      )
      .filter(
        (item) =>
          statusFilter === 'TOUS' ||
          item.statut === statusFilter,
      )
      .filter((item) => {
        if (!query) return true

        return normalize(
          [
            item.numero,
            item.quiPasseCommande,
            item.responsableSecteur,
            item.secteur,
            item.sousSecteur,
            item.quiRecupere,
            item.email,
            item.telephone,
            item.livraisonPar,
            item.lieuRecuperation,
          ].join(' '),
        ).includes(query)
      })
      .sort((a, b) =>
        a.numero.localeCompare(b.numero, 'fr', {
          numeric: true,
        }),
      )
  }, [
    campagneCommandes,
    search,
    secteurFilter,
    sousSecteurFilter,
    typeFilter,
    statusFilter,
  ])

  useEffect(() => {
    setPage(1)
  }, [
    search,
    campagneFilter,
    secteurFilter,
    sousSecteurFilter,
    typeFilter,
    statusFilter,
    perPage,
  ])

  useEffect(() => {
    if (
      sousSecteurFilter !== 'TOUS' &&
      !sousSecteurs.includes(sousSecteurFilter)
    ) {
      setSousSecteurFilter('TOUS')
    }
  }, [sousSecteurFilter, sousSecteurs])

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / perPage),
  )

  const safePage = Math.min(page, totalPages)

  const paged = filtered.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  )

  const stats = useMemo(() => {
    const active = campagneCommandes.filter(
      (item) => item.statut !== 'ANNULEE',
    )

    return {
      commandes: active.length,
      brioches: active.reduce(
        (sum, item) => sum + item.quantite,
        0,
      ),
      donsPrevus: active.reduce(
        (sum, item) => sum + item.donPrevu,
        0,
      ),
      donsRecus: active.reduce(
        (sum, item) => sum + (item.donRecu ?? 0),
        0,
      ),
    }
  }, [campagneCommandes])

  const repartition = useMemo(() => {
    const map = new Map<
      string,
      { secteur: string; count: number; brioches: number }
    >()

    for (const item of campagneCommandes) {
      if (item.statut === 'ANNULEE') continue

      const key = item.secteur || 'Non renseigné'
      const current = map.get(key) || {
        secteur: key,
        count: 0,
        brioches: 0,
      }

      current.count += 1
      current.brioches += item.quantite
      map.set(key, current)
    }

    return [...map.values()].sort(
      (a, b) => b.count - a.count,
    )
  }, [campagneCommandes])

  const vigilance = useMemo(() => {
    const commandesATraiter = campagneCommandes.filter(
      (item) =>
        item.statut === 'BROUILLON' ||
        item.statut === 'COMMANDEE' ||
        item.statut === 'A_PREPARER',
    ).length

    const donsARecuperer = campagneCommandes.filter(
      (item) => item.statut === 'DONS_A_RECUPERER',
    ).length

    const sansContact = campagneCommandes.filter(
      (item) => !item.email.trim() && !item.telephone.trim(),
    ).length

    const ecartsNegatifs = campagneCommandes.filter((item) => {
      const gap = getGap(item)
      return gap !== null && gap < 0
    }).length

    return {
      commandesATraiter,
      donsARecuperer,
      sansContact,
      ecartsNegatifs,
    }
  }, [campagneCommandes])

  const detail = detailId
    ? commandes.find((item) => item.id === detailId) ?? null
    : null

  function updateField<K extends keyof NouvelleCommandeMairieRs>(
    key: K,
    value: NouvelleCommandeMairieRs[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function openCreate() {
    setFormMode('create')
    setEditingId(null)
    setForm(emptyCommande(campagneFilter))
    setError('')
    setModalOpen(true)
  }

  function openEdit(item: CommandeMairieRs) {
    const {
      id: _id,
      numero: _numero,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...editable
    } = item

    setFormMode('edit')
    setEditingId(item.id)
    setForm(editable)
    setError('')
    setDetailId(null)
    setModalOpen(true)
  }

  function selectMairie(mairieId: string) {
    if (!mairieId) {
      updateField('mairieId', null)
      return
    }

    const mairie = mairies.find(
      (item) => item.id === mairieId,
    )

    if (!mairie) return

    const address = [
      [mairie.numeroVoie, mairie.adresse]
        .filter(Boolean)
        .join(' '),
      [mairie.cp, mairie.ville || mairie.commune]
        .filter(Boolean)
        .join(' '),
    ]
      .filter(Boolean)
      .join('\n')

    setForm((current) => ({
      ...current,
      mairieId: mairie.id,
      type: 'MAIRIE',
      secteur: mairie.secteur || current.secteur,
      quiPasseCommande: mairie.nomAffiche,
      quiRecupere:
        current.quiRecupere ||
        [mairie.contactPrenom, mairie.contactNom]
          .filter(Boolean)
          .join(' '),
      email: mairie.email,
      telephone: mairie.telephone,
      lieuRecuperation:
        current.lieuRecuperation || address,
    }))
  }

  function changeQuantity(value: number) {
    const quantity = Math.max(0, value || 0)

    setForm((current) => ({
      ...current,
      quantite: quantity,
      nbCartons: quantity / 7,
      donPrevu: quantity * current.prixUnitaire,
    }))
  }

  function changePrice(value: number) {
    const price = Math.max(0, value || 0)

    setForm((current) => ({
      ...current,
      prixUnitaire: price,
      donPrevu: current.quantite * price,
    }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!form.campagne.trim()) {
      setError('La campagne est obligatoire.')
      return
    }

    if (!form.quiPasseCommande.trim()) {
      setError(
        'La mairie ou le responsable de secteur est obligatoire.',
      )
      return
    }

    if (!form.secteur.trim()) {
      setError('Le secteur est obligatoire.')
      return
    }

    if (form.quantite <= 0) {
      setError(
        'Le nombre de brioches commandées doit être supérieur à 0.',
      )
      return
    }

    const normalized: NouvelleCommandeMairieRs = {
      ...form,
      secteur: form.secteur.trim(),
      sousSecteur: form.sousSecteur.trim(),
      quiPasseCommande: form.quiPasseCommande.trim(),
      responsableSecteur: form.responsableSecteur.trim(),
      recuperationLibre: form.recuperationLibre.trim(),
      quiRecupere: form.quiRecupere.trim(),
      email: form.email.trim(),
      telephone: form.telephone.trim(),
      lieuRecuperation: form.lieuRecuperation.trim(),
      livraisonPar: form.livraisonPar.trim(),
      remarque: form.remarque.trim(),
      personneRapportantDons:
        form.personneRapportantDons.trim(),
      lieuDepotDons: form.lieuDepotDons.trim(),
      nbCartons: Number(
        (form.nbCartons || form.quantite / 7).toFixed(2),
      ),
    }

    if (formMode === 'edit' && editingId) {
      updateCommande(editingId, normalized)
    } else {
      createCommande(normalized)
    }

    setModalOpen(false)
    setEditingId(null)
  }

  function remove(item: CommandeMairieRs) {
    const ok = window.confirm(
      `Supprimer la commande ${item.numero} de ${item.quiPasseCommande} ?`,
    )

    if (!ok) return

    deleteCommande(item.id)
    setDetailId(null)
  }

  function exportCsv() {
    const rows = [
      [
        'Numero',
        'Campagne',
        'Type',
        'Secteur',
        'Sous-secteur',
        'Qui passe la commande',
        'Responsable de secteur',
        'Brioches commandees',
        'Cartons',
        'Date de recuperation',
        'Information recuperation',
        'Qui recupere',
        'Email',
        'Telephone',
        'Lieu de recuperation',
        'Livraison par',
        'Remarque',
        'Don prevu',
        'Brioches vendues',
        'Personne rapportant les dons',
        'Lieu de depot des dons',
        'Don recu',
        'Ecart',
        'Statut',
      ],
      ...filtered.map((item) => [
        item.numero,
        item.campagne,
        TYPE_LABELS[item.type],
        item.secteur,
        item.sousSecteur,
        item.quiPasseCommande,
        item.responsableSecteur,
        item.quantite,
        item.nbCartons,
        item.dateRecuperation,
        item.recuperationLibre,
        item.quiRecupere,
        item.email,
        item.telephone,
        item.lieuRecuperation,
        item.livraisonPar,
        item.remarque,
        item.donPrevu,
        item.nombreBriochesVendues ?? '',
        item.personneRapportantDons,
        item.lieuDepotDons,
        item.donRecu ?? '',
        getGap(item) ?? '',
        STATUS_LABELS[item.statut],
      ]),
    ]

    const csv = rows
      .map((row) => row.map(csvCell).join(';'))
      .join('\n')

    const blob = new Blob([`\ufeff${csv}`], {
      type: 'text/csv;charset=utf-8',
    })

    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `commandes-mairies-rs-${campagneFilter
      .replace(/\s+/g, '-')
      .toLowerCase()}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const receivedProgress =
    stats.donsPrevus > 0
      ? Math.min(
          100,
          (stats.donsRecus / stats.donsPrevus) * 100,
        )
      : 0

  return (
    <main className="cmr-page">
      <header className="cmr-header">
        <div>
          <span className="cmr-eyebrow">
            Commandes dons · Mairies & RS
          </span>

          <h1>Commandes Mairies & RS</h1>

          <p>
            Suivez les commandes des mairies et responsables
            de secteur, les récupérations et les retours de dons.
          </p>
        </div>

        <div className="cmr-header-actions">
          <label>
            <span>Campagne</span>
            <select
              value={campagneFilter}
              onChange={(event) =>
                setCampagneFilter(event.target.value)
              }
            >
              {campaigns.map((campagne) => (
                <option
                  key={campagne}
                  value={campagne}
                >
                  {campagne}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="cmr-primary"
            onClick={openCreate}
          >
            <Plus size={18} />
            Nouvelle commande
          </button>
        </div>
      </header>

      <section className="cmr-kpis">
        <Kpi
          icon={<ClipboardList size={22} />}
          tone="orange"
          label="Commandes"
          value={number(stats.commandes)}
        />
        <Kpi
          icon={<Boxes size={22} />}
          tone="gold"
          label="Brioches"
          value={number(stats.brioches)}
        />
        <Kpi
          icon={<CircleDollarSign size={22} />}
          tone="orange"
          label="Dons prévus"
          value={money(stats.donsPrevus)}
        />
        <Kpi
          icon={<CheckCircle2 size={22} />}
          tone="green"
          label="Dons reçus"
          value={money(stats.donsRecus)}
        />
      </section>

      <section className="cmr-card">
        <div className="cmr-toolbar">
          <label className="cmr-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Rechercher une mairie, un RS, une commune..."
            />
          </label>

          <select
            value={secteurFilter}
            onChange={(event) =>
              setSecteurFilter(event.target.value)
            }
          >
            {secteurs.map((secteur) => (
              <option
                key={secteur}
                value={secteur}
              >
                {secteur === 'TOUS'
                  ? 'Tous les secteurs'
                  : secteur}
              </option>
            ))}
          </select>

          <select
            value={sousSecteurFilter}
            onChange={(event) =>
              setSousSecteurFilter(event.target.value)
            }
          >
            {sousSecteurs.map((sousSecteur) => (
              <option
                key={sousSecteur}
                value={sousSecteur}
              >
                {sousSecteur === 'TOUS'
                  ? 'Tous les sous-secteurs'
                  : sousSecteur}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value as
                  | 'TOUS'
                  | TypeCommandeMairieRs,
              )
            }
          >
            <option value="TOUS">Mairies + RS</option>
            <option value="MAIRIE">Mairies</option>
            <option value="RS">RS</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as
                  | 'TOUS'
                  | StatutCommandeMairieRs,
              )
            }
          >
            <option value="TOUS">Tous les statuts</option>
            {(
              Object.keys(
                STATUS_LABELS,
              ) as StatutCommandeMairieRs[]
            ).map((status) => (
              <option
                key={status}
                value={status}
              >
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="cmr-secondary"
            onClick={exportCsv}
          >
            <Download size={16} />
            Exporter
          </button>
        </div>

        <div className="cmr-table-wrap">
          <table className="cmr-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Mairie / RS</th>
                <th>Type</th>
                <th>Secteur</th>
                <th>Qté</th>
                <th>Récupération</th>
                <th>Récupéré par</th>
                <th>Livraison par</th>
                <th>Don prévu</th>
                <th>Don reçu</th>
                <th>Écart</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paged.map((item) => {
                const gap = getGap(item)

                return (
                  <tr
                    key={item.id}
                    onDoubleClick={() =>
                      setDetailId(item.id)
                    }
                  >
                    <td className="cmr-number">
                      {item.numero}
                    </td>

                    <td>
                      <strong>
                        {item.quiPasseCommande}
                      </strong>
                      {item.sousSecteur && (
                        <small>
                          {item.sousSecteur}
                        </small>
                      )}
                    </td>

                    <td>
                      <TypeBadge type={item.type} />
                    </td>

                    <td>{item.secteur || '—'}</td>

                    <td>
                      <strong>
                        {number(item.quantite)}
                      </strong>
                    </td>

                    <td>
                      {item.dateRecuperation
                        ? formatDate(item.dateRecuperation)
                        : item.recuperationLibre || '—'}
                    </td>

                    <td>{item.quiRecupere || '—'}</td>
                    <td>{item.livraisonPar || '—'}</td>
                    <td>{money(item.donPrevu)}</td>

                    <td>
                      {item.donRecu === null
                        ? '—'
                        : money(item.donRecu)}
                    </td>

                    <td>
                      {gap === null ? (
                        '—'
                      ) : (
                        <span
                          className={`cmr-gap ${
                            gap < 0
                              ? 'negative'
                              : gap > 0
                                ? 'positive'
                                : 'zero'
                          }`}
                        >
                          {gap > 0 ? '+' : ''}
                          {money(gap)}
                        </span>
                      )}
                    </td>

                    <td>
                      <StatusBadge
                        status={item.statut}
                      />
                    </td>

                    <td>
                      <div className="cmr-actions">
                        <button
                          type="button"
                          title="Voir"
                          onClick={() =>
                            setDetailId(item.id)
                          }
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          title="Modifier"
                          onClick={() =>
                            openEdit(item)
                          }
                        >
                          <Pencil size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}

              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={13}
                    className="cmr-empty"
                  >
                    Aucune commande ne correspond aux
                    critères sélectionnés.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="cmr-pagination">
          <span>
            {filtered.length === 0
              ? '0 résultat'
              : `${(safePage - 1) * perPage + 1}–${Math.min(
                  safePage * perPage,
                  filtered.length,
                )} sur ${filtered.length} commandes`}
          </span>

          <div>
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1),
                )
              }
            >
              <ChevronLeft size={16} />
            </button>

            <strong>
              {safePage} / {totalPages}
            </strong>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages, current + 1),
                )
              }
            >
              <ChevronRight size={16} />
            </button>

            <select
              value={perPage}
              onChange={(event) =>
                setPerPage(Number(event.target.value))
              }
            >
              <option value={10}>10 par page</option>
              <option value={25}>25 par page</option>
              <option value={50}>50 par page</option>
            </select>
          </div>
        </footer>
      </section>

      <section className="cmr-bottom-grid">
        <article className="cmr-dashboard-card">
          <header>
            <Boxes size={18} />
            <h2>Répartition des commandes</h2>
          </header>

          <div className="cmr-sector-list">
            {repartition.map((item, index) => {
              const percentage =
                stats.commandes > 0
                  ? Math.round(
                      (item.count / stats.commandes) * 100,
                    )
                  : 0

              return (
                <div
                  key={item.secteur}
                  className="cmr-sector-row"
                >
                  <span className={`dot dot-${index % 6}`} />
                  <strong>{item.secteur}</strong>
                  <span>{item.count}</span>
                  <em>{percentage} %</em>
                </div>
              )
            })}
          </div>
        </article>

        <article className="cmr-dashboard-card">
          <header>
            <CircleDollarSign size={18} />
            <h2>Suivi des dons</h2>
          </header>

          <Metric
            label="Dons prévus"
            value={money(stats.donsPrevus)}
          />
          <Metric
            label="Dons reçus"
            value={money(stats.donsRecus)}
          />
          <Metric
            label="Reste à collecter"
            value={money(
              Math.max(
                0,
                stats.donsPrevus - stats.donsRecus,
              ),
            )}
            danger
          />

          <div className="cmr-progress">
            <span
              style={{
                width: `${receivedProgress}%`,
              }}
            />
          </div>

          <strong className="cmr-progress-label">
            {Math.round(receivedProgress)} %
          </strong>
        </article>

        <article className="cmr-dashboard-card">
          <header>
            <AlertTriangle size={18} />
            <h2>Points de vigilance</h2>
          </header>

          <Vigilance
            value={vigilance.commandesATraiter}
            label="commandes à traiter / préparer"
            tone="orange"
          />
          <Vigilance
            value={vigilance.donsARecuperer}
            label="dons à récupérer"
            tone="blue"
          />
          <Vigilance
            value={vigilance.sansContact}
            label="commandes sans email ni téléphone"
            tone="red"
          />
          <Vigilance
            value={vigilance.ecartsNegatifs}
            label="écarts de dons négatifs"
            tone="red"
          />
        </article>
      </section>

      {detail && (
        <div
          className="cmr-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setDetailId(null)
            }
          }}
        >
          <section className="cmr-modal cmr-detail-modal">
            <header className="cmr-modal-header">
              <div>
                <span>COMMANDE {detail.numero}</span>
                <h2>{detail.quiPasseCommande}</h2>
                <p>
                  {TYPE_LABELS[detail.type]} · {detail.secteur}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailId(null)}
                aria-label="Fermer"
              >
                <X size={19} />
              </button>
            </header>

            <div className="cmr-modal-body">
              <div className="cmr-detail-grid">
                <DetailCard
                  title="Commande"
                  icon={<ClipboardList size={18} />}
                >
                  <Detail
                    label="Campagne"
                    value={detail.campagne}
                  />
                  <Detail
                    label="Secteur"
                    value={detail.secteur || '—'}
                  />
                  <Detail
                    label="Sous-secteur"
                    value={detail.sousSecteur || '—'}
                  />
                  <Detail
                    label="Responsable de secteur"
                    value={
                      detail.responsableSecteur || '—'
                    }
                  />
                  <Detail
                    label="Brioches commandées"
                    value={number(detail.quantite)}
                  />
                  <Detail
                    label="Cartons"
                    value={new Intl.NumberFormat(
                      'fr-FR',
                      {
                        maximumFractionDigits: 2,
                      },
                    ).format(detail.nbCartons)}
                  />
                </DetailCard>

                <DetailCard
                  title="Récupération / livraison"
                  icon={<Truck size={18} />}
                >
                  <Detail
                    label="Récupération"
                    value={
                      detail.dateRecuperation
                        ? formatDate(
                            detail.dateRecuperation,
                          )
                        : detail.recuperationLibre || '—'
                    }
                  />
                  <Detail
                    label="Qui récupère"
                    value={detail.quiRecupere || '—'}
                  />
                  <Detail
                    label="Livraison par"
                    value={detail.livraisonPar || '—'}
                  />
                  <Detail
                    label="Lieu"
                    value={detail.lieuRecuperation || '—'}
                  />
                </DetailCard>

                <DetailCard
                  title="Contact"
                  icon={<UserRound size={18} />}
                >
                  <Detail
                    label="Email"
                    value={detail.email || '—'}
                    icon={<Mail size={14} />}
                  />
                  <Detail
                    label="Téléphone"
                    value={detail.telephone || '—'}
                    icon={<Phone size={14} />}
                  />
                </DetailCard>

                <DetailCard
                  title="Retour des dons"
                  icon={<CircleDollarSign size={18} />}
                >
                  <Detail
                    label="Don prévu"
                    value={money(detail.donPrevu)}
                  />
                  <Detail
                    label="Brioches vendues"
                    value={
                      detail.nombreBriochesVendues === null
                        ? '—'
                        : number(
                            detail.nombreBriochesVendues,
                          )
                    }
                  />
                  <Detail
                    label="Personne rapportant les dons"
                    value={
                      detail.personneRapportantDons || '—'
                    }
                  />
                  <Detail
                    label="Lieu de dépôt"
                    value={detail.lieuDepotDons || '—'}
                  />
                  <Detail
                    label="Don reçu"
                    value={
                      detail.donRecu === null
                        ? '—'
                        : money(detail.donRecu)
                    }
                  />
                  <Detail
                    label="Écart"
                    value={
                      getGap(detail) === null
                        ? '—'
                        : money(getGap(detail) as number)
                    }
                  />
                </DetailCard>
              </div>

              {detail.remarque && (
                <section className="cmr-note">
                  <strong>Remarque</strong>
                  <p>{detail.remarque}</p>
                </section>
              )}
            </div>

            <footer className="cmr-modal-footer">
              <button
                type="button"
                className="cmr-danger"
                onClick={() => remove(detail)}
              >
                <Trash2 size={16} />
                Supprimer
              </button>

              <span />

              <button
                type="button"
                className="cmr-secondary"
                onClick={() => openEdit(detail)}
              >
                <Pencil size={16} />
                Modifier
              </button>
            </footer>
          </section>
        </div>
      )}

      {modalOpen && (
        <div
          className="cmr-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setModalOpen(false)
            }
          }}
        >
          <section className="cmr-modal">
            <header className="cmr-modal-header">
              <div>
                <span>COMMANDES MAIRIES & RS</span>
                <h2>
                  {formMode === 'create'
                    ? 'Nouvelle commande'
                    : 'Modifier la commande'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fermer"
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={submit}>
              <div className="cmr-modal-body">
                <FormSection
                  title="Commande"
                  icon={<ClipboardList size={18} />}
                >
                  <Field label="Campagne">
                    <input
                      value={form.campagne}
                      onChange={(event) =>
                        updateField(
                          'campagne',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Type">
                    <select
                      value={form.type}
                      onChange={(event) => {
                        const value =
                          event.target
                            .value as TypeCommandeMairieRs

                        setForm((current) => ({
                          ...current,
                          type: value,
                          mairieId:
                            value === 'RS'
                              ? null
                              : current.mairieId,
                        }))
                      }}
                    >
                      <option value="MAIRIE">
                        Mairie
                      </option>
                      <option value="RS">
                        Responsable de secteur
                      </option>
                    </select>
                  </Field>

                  {form.type === 'MAIRIE' && (
                    <Field
                      label="Mairie liée à la BDD"
                      wide
                    >
                      <select
                        value={form.mairieId || ''}
                        onChange={(event) =>
                          selectMairie(
                            event.target.value,
                          )
                        }
                      >
                        <option value="">
                          Saisie manuelle / mairie non liée
                        </option>

                        {mairies
                          .filter(
                            (item) =>
                              item.statut === 'ACTIVE',
                          )
                          .sort((a, b) =>
                            a.commune.localeCompare(
                              b.commune,
                              'fr',
                            ),
                          )
                          .map((mairie) => (
                            <option
                              key={mairie.id}
                              value={mairie.id}
                            >
                              {mairie.code} —{' '}
                              {mairie.nomAffiche}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}

                  <Field
                    label="Mairie / personne qui passe la commande *"
                    wide
                  >
                    <input
                      value={form.quiPasseCommande}
                      onChange={(event) =>
                        updateField(
                          'quiPasseCommande',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Secteur *">
                    <input
                      value={form.secteur}
                      onChange={(event) =>
                        updateField(
                          'secteur',
                          event.target.value,
                        )
                      }
                      list="cmr-secteurs"
                    />
                    <datalist id="cmr-secteurs">
                      {secteurs
                        .filter(
                          (value) => value !== 'TOUS',
                        )
                        .map((value) => (
                          <option
                            key={value}
                            value={value}
                          />
                        ))}
                    </datalist>
                  </Field>

                  <Field label="Sous-secteur">
                    <input
                      value={form.sousSecteur}
                      onChange={(event) =>
                        updateField(
                          'sousSecteur',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Responsable de secteur">
                    <input
                      value={form.responsableSecteur}
                      onChange={(event) =>
                        updateField(
                          'responsableSecteur',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Statut">
                    <select
                      value={form.statut}
                      onChange={(event) =>
                        updateField(
                          'statut',
                          event.target
                            .value as StatutCommandeMairieRs,
                        )
                      }
                    >
                      {(
                        Object.keys(
                          STATUS_LABELS,
                        ) as StatutCommandeMairieRs[]
                      ).map((status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Brioches commandées *">
                    <input
                      type="number"
                      min="0"
                      value={form.quantite || ''}
                      onChange={(event) =>
                        changeQuantity(
                          Number(event.target.value),
                        )
                      }
                    />
                  </Field>

                  <Field label="Nombre de cartons">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.nbCartons || ''}
                      onChange={(event) =>
                        updateField(
                          'nbCartons',
                          Number(event.target.value),
                        )
                      }
                    />
                  </Field>
                </FormSection>

                <FormSection
                  title="Récupération / livraison"
                  icon={<Truck size={18} />}
                >
                  <Field label="Date de récupération">
                    <input
                      type="date"
                      value={form.dateRecuperation}
                      onChange={(event) =>
                        updateField(
                          'dateRecuperation',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Information de récupération">
                    <input
                      value={form.recuperationLibre}
                      onChange={(event) =>
                        updateField(
                          'recuperationLibre',
                          event.target.value,
                        )
                      }
                      placeholder="Ex. CF Jean Hypolite"
                    />
                  </Field>

                  <Field label="Qui récupère">
                    <input
                      value={form.quiRecupere}
                      onChange={(event) =>
                        updateField(
                          'quiRecupere',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Livraison par">
                    <input
                      value={form.livraisonPar}
                      onChange={(event) =>
                        updateField(
                          'livraisonPar',
                          event.target.value,
                        )
                      }
                      placeholder="Ex. ESAT Liverdun"
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        updateField(
                          'email',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Téléphone">
                    <input
                      value={form.telephone}
                      onChange={(event) =>
                        updateField(
                          'telephone',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="Lieu de récupération"
                    wide
                  >
                    <textarea
                      rows={3}
                      value={form.lieuRecuperation}
                      onChange={(event) =>
                        updateField(
                          'lieuRecuperation',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Remarque" wide>
                    <textarea
                      rows={3}
                      value={form.remarque}
                      onChange={(event) =>
                        updateField(
                          'remarque',
                          event.target.value,
                        )
                      }
                    />
                  </Field>
                </FormSection>

                <FormSection
                  title="Retour des dons"
                  icon={<CircleDollarSign size={18} />}
                >
                  <Field label="Prix unitaire">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.prixUnitaire}
                      onChange={(event) =>
                        changePrice(
                          Number(event.target.value),
                        )
                      }
                    />
                  </Field>

                  <Field label="Don prévu">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.donPrevu}
                      onChange={(event) =>
                        updateField(
                          'donPrevu',
                          Number(event.target.value),
                        )
                      }
                    />
                  </Field>

                  <Field label="Brioches vendues">
                    <input
                      type="number"
                      min="0"
                      value={
                        form.nombreBriochesVendues ??
                        ''
                      }
                      onChange={(event) =>
                        updateField(
                          'nombreBriochesVendues',
                          event.target.value === ''
                            ? null
                            : Number(
                                event.target.value,
                              ),
                        )
                      }
                    />
                  </Field>

                  <Field label="Don reçu">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.donRecu ?? ''}
                      onChange={(event) =>
                        updateField(
                          'donRecu',
                          event.target.value === ''
                            ? null
                            : Number(
                                event.target.value,
                              ),
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="Personne rapportant les dons"
                    wide
                  >
                    <input
                      value={
                        form.personneRapportantDons
                      }
                      onChange={(event) =>
                        updateField(
                          'personneRapportantDons',
                          event.target.value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Lieu de dépôt des dons" wide>
                    <input
                      value={form.lieuDepotDons}
                      onChange={(event) =>
                        updateField(
                          'lieuDepotDons',
                          event.target.value,
                        )
                      }
                    />
                  </Field>
                </FormSection>

                {error && (
                  <div className="cmr-error">
                    <AlertTriangle size={17} />
                    {error}
                  </div>
                )}
              </div>

              <footer className="cmr-modal-footer">
                <button
                  type="button"
                  className="cmr-secondary"
                  onClick={() => setModalOpen(false)}
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="cmr-primary"
                >
                  <CheckCircle2 size={17} />
                  Enregistrer
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

function Kpi({
  icon,
  tone,
  label,
  value,
}: {
  icon: ReactNode
  tone: 'orange' | 'gold' | 'green'
  label: string
  value: string
}) {
  return (
    <article className="cmr-kpi">
      <span className={`cmr-kpi-icon ${tone}`}>
        {icon}
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function TypeBadge({
  type,
}: {
  type: TypeCommandeMairieRs
}) {
  return (
    <span
      className={`cmr-type type-${type.toLowerCase()}`}
    >
      {TYPE_LABELS[type]}
    </span>
  )
}

function StatusBadge({
  status,
}: {
  status: StatutCommandeMairieRs
}) {
  return (
    <span
      className={`cmr-status status-${status.toLowerCase()}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string
  value: string
  danger?: boolean
}) {
  return (
    <div className="cmr-metric">
      <span>{label}</span>
      <strong className={danger ? 'danger' : ''}>
        {value}
      </strong>
    </div>
  )
}

function Vigilance({
  value,
  label,
  tone,
}: {
  value: number
  label: string
  tone: 'orange' | 'blue' | 'red'
}) {
  return (
    <div className="cmr-vigilance">
      <strong className={tone}>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function FormSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="cmr-form-section">
      <header>
        {icon}
        <h3>{title}</h3>
      </header>

      <div className="cmr-form-grid">
        {children}
      </div>
    </section>
  )
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label className={wide ? 'wide' : ''}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function DetailCard({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="cmr-detail-card">
      <header>
        {icon}
        <h3>{title}</h3>
      </header>
      {children}
    </section>
  )
}

function Detail({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
}) {
  return (
    <div className="cmr-detail-line">
      <span>{label}</span>
      <strong>
        {icon}
        {value}
      </strong>
    </div>
  )
}
