import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Euro,
  Eye,
  FileCheck2,
  FileText,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Send,
  X,
} from 'lucide-react'

import { useJustificatifs } from '../contexts/JustificatifsContext'
import {
  ChorusIncompleteError,
  PaymentModeMissingError,
  TemplateNotConfiguredError,
  generateAndDownloadJustificatifPdf,
} from '../services/justificatifPdf'
import {
  getCampagneJustificatifsSettings,
  getCampagneTemplatePdf,
  previewCampagneTemplatePdf,
  type CampagnePdfTemplateMeta,
} from '../services/campagneJustificatifs'
import {
  createChorusMailDraft,
  updateDonateurChorusInfo,
  type DonateurDocumentData,
} from '../services/donateurReglement'
import type {
  DocumentStatut,
  JustificatifDon,
  JustificatifStatut,
  JustificatifType,
  NouveauJustificatif,
  PaiementStatut,
} from '../types/justificatifs'

import './JustificatifsDons.css'

type MainTab = 'ALL' | JustificatifType
type PageSize = 20 | 50 | 100

type DonateurRef = {
  id: string
  code?: string
  nom: string
  ville?: string
  adresse?: string
  cp?: string
  email?: string
  telephone?: string
}

type CommandeRef = {
  id: string
  numero?: string
  donateurId?: string
  campagne?: string
  quantite?: number
  prixUnitaire?: number
}

type CampagneRef = {
  id: string
  annee: number | null
  nom: string
  statut: string
}

type FormState = {
  type: JustificatifType
  campagne: string
  donateurId: string
  commandeId: string
  donateurNom: string
  donateurCode: string
  donateurVille: string
  donateurAdresse: string
  donateurEmail: string
  donateurTelephone: string
  dateEmission: string
  nbBrioches: number
  prixUnitaire: number
  statut: JustificatifStatut
  paiementStatut: PaiementStatut
  documentStatut: DocumentStatut
  datePaiement: string
  referencePaiement: string
  emailDestinataire: string
  remarque: string
}

const DEFAULT_CAMPAIGN = `OB ${new Date().getFullYear()}`

function todayInput() {
  const date = new Date()
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
}

function createEmptyForm(campagne = DEFAULT_CAMPAIGN): FormState {
  return {
    type: 'JDI',
    campagne,
    donateurId: '',
    commandeId: '',
    donateurNom: '',
    donateurCode: '',
    donateurVille: '',
    donateurAdresse: '',
    donateurEmail: '',
    donateurTelephone: '',
    dateEmission: todayInput(),
    nbBrioches: 0,
    prixUnitaire: 5,
    statut: 'A_VERIFIER',
    paiementStatut: 'EN_ATTENTE',
    documentStatut: 'A_GENERER',
    datePaiement: '',
    referencePaiement: '',
    emailDestinataire: '',
    remarque: '',
  }
}

function safeArrayFromStorage(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readDonateurs(): DonateurRef[] {
  return safeArrayFromStorage('ob-donateurs')
    .map<DonateurRef | null>((value) => {
      const item = value as Record<string, unknown>
      const nom = String(item.nom ?? '').trim()
      if (!nom) return null

      return {
        id: String(item.id ?? item.code ?? nom),
        code: item.code ? String(item.code) : undefined,
        nom,
        ville: item.ville ? String(item.ville) : undefined,
        adresse: [item.numeroVoie, item.adresse]
          .filter(Boolean)
          .map(String)
          .join(' '),
        cp: item.cp ? String(item.cp) : undefined,
        email: item.email ? String(item.email) : undefined,
        telephone: item.telephone
          ? String(item.telephone)
          : undefined,
      } satisfies DonateurRef
    })
    .filter((item): item is DonateurRef => item !== null)
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

function readCommandes(): CommandeRef[] {
  return safeArrayFromStorage('ob-commandes')
    .map<CommandeRef | null>((value) => {
      const item = value as Record<string, unknown>
      const id = item.id ?? item.numero
      if (id === undefined || id === null) return null

      return {
        id: String(id),
        numero: item.numero ? String(item.numero) : undefined,
        donateurId:
          item.donateurId !== undefined
            ? String(item.donateurId)
            : undefined,
        campagne: item.campagne
          ? String(item.campagne)
          : undefined,
        quantite:
          typeof item.quantite === 'number'
            ? item.quantite
            : Number(item.quantite ?? 0),
        prixUnitaire:
          typeof item.prixUnitaire === 'number'
            ? item.prixUnitaire
            : Number(item.prixUnitaire ?? 0),
      } satisfies CommandeRef
    })
    .filter((item): item is CommandeRef => item !== null)
}

function readCampagnes(): CampagneRef[] {
  const source = safeArrayFromStorage('ob-campagnes-v1')

  const values = source
    .map<CampagneRef | null>((value) => {
      const item = value as Record<string, unknown>
      const id = String(item.id ?? '').trim()

      if (!id) return null

      const anneeValue = item.annee
      const annee =
        typeof anneeValue === 'number' && Number.isFinite(anneeValue)
          ? anneeValue
          : Number(id.match(/\b(?:19|20)\d{2}\b/)?.[0] ?? NaN)

      return {
        id,
        annee: Number.isFinite(annee) ? annee : null,
        nom: String(item.nom ?? id),
        statut: String(item.statut ?? ''),
      } satisfies CampagneRef
    })
    .filter((item): item is CampagneRef => item !== null)
    .sort((a, b) => {
      if (a.statut === 'ACTIVE' && b.statut !== 'ACTIVE') return -1
      if (b.statut === 'ACTIVE' && a.statut !== 'ACTIVE') return 1
      return (b.annee ?? 0) - (a.annee ?? 0)
    })

  if (values.length > 0) {
    return values
  }

  return [
    {
      id: DEFAULT_CAMPAIGN,
      annee: Number(new Date().getFullYear()),
      nom: DEFAULT_CAMPAIGN,
      statut: 'ACTIVE',
    },
  ]
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(value)
}

function formatDate(value?: string) {
  if (!value) return '—'

  const date = new Date(
    value.length === 10 ? `${value}T12:00:00` : value,
  )

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('fr-FR').format(date)
}

function statusLabel(status: JustificatifStatut) {
  const labels: Record<JustificatifStatut, string> = {
    BROUILLON: 'Brouillon',
    A_VERIFIER: 'À vérifier',
    EMIS: 'Émis',
    ENVOYE: 'Envoyé',
    ARCHIVE: 'Archivé',
    ERREUR: 'Erreur',
  }

  return labels[status]
}

function paymentLabel(status: PaiementStatut) {
  const labels: Record<PaiementStatut, string> = {
    EN_ATTENTE: 'En attente',
    PAYE: 'Payé',
    NON_APPLICABLE: 'Non applicable',
  }

  return labels[status]
}

function documentLabel(status: DocumentStatut) {
  const labels: Record<DocumentStatut, string> = {
    A_GENERER: 'À générer',
    GENERE: 'PDF généré',
    ENVOYE: 'Envoyé',
    ERREUR: 'Erreur',
  }

  return labels[status]
}

function downloadText(
  content: string,
  filename: string,
  type = 'text/plain;charset=utf-8',
) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}


function JustificatifsDons() {
  const {
    justificatifs,
    createJustificatif,
    updateJustificatif,
    markDocumentGenerated,
    markSent,
    archiveJustificatif,
    convertJdiToJdp,
  } = useJustificatifs()

  const [activeTab, setActiveTab] = useState<MainTab>('ALL')
  const [search, setSearch] = useState('')
  const [campaignFilter, setCampaignFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [periodFilter, setPeriodFilter] = useState('ALL')
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [currentPage, setCurrentPage] = useState(1)

  const [modalMode, setModalMode] = useState<
    'create' | 'edit' | null
  >(null)
  const [editing, setEditing] = useState<JustificatifDon | null>(
    null,
  )
  const [detail, setDetail] = useState<JustificatifDon | null>(
    null,
  )
  const [moreId, setMoreId] = useState<string | null>(null)
  const [chorusIssue, setChorusIssue] = useState<{
    item: JustificatifDon
    donateur: DonateurDocumentData
    missing: string[]
  } | null>(null)
  const [chorusEditOpen, setChorusEditOpen] = useState(false)
  const [mailDraft, setMailDraft] = useState<{
    to: string
    subject: string
    body: string
    itemId: string
  } | null>(null)

  const campaigns = useMemo(() => {
    const values: string[] = Array.from(
      new Set<string>(justificatifs.map((item) => item.campagne)),
    ).sort((a, b) => b.localeCompare(a, 'fr'))

    return values
  }, [justificatifs])

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase()
    const now = new Date()

    return [...justificatifs]
      .filter((item) => {
        if (activeTab !== 'ALL' && item.type !== activeTab) {
          return false
        }

        if (
          campaignFilter !== 'ALL' &&
          item.campagne !== campaignFilter
        ) {
          return false
        }

        if (
          statusFilter !== 'ALL' &&
          item.statut !== statusFilter
        ) {
          return false
        }

        if (periodFilter !== 'ALL') {
          const days = Number(periodFilter)
          const itemDate = new Date(`${item.dateEmission}T12:00:00`)
          const diff =
            (now.getTime() - itemDate.getTime()) /
            (1000 * 60 * 60 * 24)

          if (diff < 0 || diff > days) {
            return false
          }
        }

        if (!normalized) {
          return true
        }

        return [
          item.numero,
          item.donateurNom,
          item.donateurCode,
          item.commandeNumero,
          item.donateurVille,
          item.type,
          item.campagne,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalized)
      })
      .sort((a, b) => {
        const dateCompare = b.dateEmission.localeCompare(
          a.dateEmission,
        )

        return dateCompare !== 0
          ? dateCompare
          : b.numero.localeCompare(a.numero, 'fr')
      })
  }, [
    activeTab,
    campaignFilter,
    justificatifs,
    periodFilter,
    search,
    statusFilter,
  ])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    activeTab,
    campaignFilter,
    statusFilter,
    periodFilter,
    pageSize,
    search,
  ])

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize),
  )

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const firstIndex = (currentPage - 1) * pageSize
  const visibleRows = filtered.slice(
    firstIndex,
    firstIndex + pageSize,
  )

  const pageNumbers = useMemo(() => {
    const values: Array<number | 'ellipsis'> = []

    if (totalPages <= 7) {
      for (let page = 1; page <= totalPages; page += 1) {
        values.push(page)
      }
      return values
    }

    values.push(1)

    if (currentPage > 4) values.push('ellipsis')

    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)

    for (let page = start; page <= end; page += 1) {
      values.push(page)
    }

    if (currentPage < totalPages - 3) values.push('ellipsis')

    values.push(totalPages)

    return values
  }, [currentPage, totalPages])

  const kpis = useMemo(() => {
    const jdiWaiting = justificatifs.filter(
      (item) =>
        item.type === 'JDI' &&
        item.paiementStatut === 'EN_ATTENTE' &&
        item.statut !== 'ARCHIVE',
    ).length

    const jdpPaid = justificatifs.filter(
      (item) =>
        item.type === 'JDP' &&
        item.paiementStatut === 'PAYE' &&
        item.statut !== 'ARCHIVE',
    ).length

    const errors = justificatifs.filter(
      (item) =>
        item.statut === 'ERREUR' ||
        item.documentStatut === 'ERREUR',
    ).length

    return {
      total: justificatifs.length,
      jdiWaiting,
      jdpPaid,
      errors,
      amount: justificatifs.reduce(
        (sum, item) => sum + item.montant,
        0,
      ),
      generated: justificatifs.filter(
        (item) => item.documentStatut !== 'A_GENERER',
      ).length,
      sent: justificatifs.filter(
        (item) => item.documentStatut === 'ENVOYE',
      ).length,
    }
  }, [justificatifs])

  function openCreate() {
    setEditing(null)
    setModalMode('create')
  }

  function openEdit(item: JustificatifDon) {
    setEditing(item)
    setModalMode('edit')
    setMoreId(null)
  }

  async function handleGenerate(item: JustificatifDon) {
    try {
      const result =
        await generateAndDownloadJustificatifPdf(item)

      markDocumentGenerated(item.id, {
        modeleNom: result.template.fileName,
        modeleVersion: result.template.version,
        modeleCampagneId: item.campagne,
        modeReglementGenere: result.donor.modeReglement,
      })
    } catch (error) {
      if (error instanceof ChorusIncompleteError) {
        updateJustificatif(
          item.id,
          { statut: 'A_VERIFIER' },
          'Génération bloquée : informations Chorus incomplètes',
        )

        setChorusIssue({
          item,
          donateur: error.donateur,
          missing: error.missing,
        })
        return
      }

      if (
        error instanceof TemplateNotConfiguredError ||
        error instanceof PaymentModeMissingError
      ) {
        window.alert(error.message)
        return
      }

      window.alert(
        error instanceof Error
          ? error.message
          : 'La génération du PDF a échoué.',
      )
    }
  }

  function handleConvert(item: JustificatifDon) {
    try {
      convertJdiToJdp(item.id)
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Conversion impossible.',
      )
    }

    setMoreId(null)
  }

  function exportCsv() {
    const header = [
      'N° justificatif',
      'Type',
      'Campagne',
      'Donateur',
      'Commande',
      'Date émission',
      'Nb brioches',
      'Prix unitaire',
      'Montant',
      'Statut',
      'Paiement',
      'Document',
    ]

    const rows = filtered.map((item) => [
      item.numero,
      item.type,
      item.campagne,
      item.donateurNom,
      item.commandeNumero || '',
      item.dateEmission,
      String(item.nbBrioches),
      String(item.prixUnitaire),
      String(item.montant),
      statusLabel(item.statut),
      paymentLabel(item.paiementStatut),
      documentLabel(item.documentStatut),
    ])

    const csv = [header, ...rows]
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
          .join(';'),
      )
      .join('\n')

    downloadText(
      `\uFEFF${csv}`,
      `justificatifs-dons-${todayInput()}.csv`,
      'text/csv;charset=utf-8',
    )
  }

  return (
    <div className="jd-page">
      <header className="jd-header">
        <div className="jd-title-wrap">
          <div className="jd-title-icon">
            <Euro size={32} />
          </div>

          <div>
            <span className="jd-eyebrow">FINANCE</span>
            <h1>Justificatifs de dons</h1>
            <p>
              Gérez, consultez et archivez les JDI et JDP liés aux
              dons et commandes de l’Opération Brioches.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="jd-primary-button"
          onClick={openCreate}
        >
          <Plus size={19} />
          Nouveau justificatif
        </button>
      </header>

      <div className="jd-tabs" role="tablist">
        <TabButton
          active={activeTab === 'ALL'}
          onClick={() => setActiveTab('ALL')}
        >
          Ensemble des JD
        </TabButton>
        <TabButton
          active={activeTab === 'JDI'}
          onClick={() => setActiveTab('JDI')}
        >
          JDI
        </TabButton>
        <TabButton
          active={activeTab === 'JDP'}
          onClick={() => setActiveTab('JDP')}
        >
          JDP
        </TabButton>
      </div>

      <section className="jd-kpi-grid">
        <Kpi
          icon={<FileText size={26} />}
          label="Justificatifs émis"
          value={String(kpis.total)}
          tone="blue"
        />
        <Kpi
          icon={<Clock3 size={26} />}
          label="JDI en attente"
          value={String(kpis.jdiWaiting)}
          tone="orange"
        />
        <Kpi
          icon={<CheckCircle2 size={26} />}
          label="JDP payés"
          value={String(kpis.jdpPaid)}
          tone="green"
        />
        <Kpi
          icon={<AlertTriangle size={26} />}
          label="Retours / erreurs"
          value={String(kpis.errors)}
          tone="red"
        />
      </section>

      <section className="jd-card">
        <div className="jd-card-title-row">
          <div>
            <h2>Liste des justificatifs</h2>
            <span>
              {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
              {' · '}
              {formatMoney(
                filtered.reduce((sum, item) => sum + item.montant, 0),
              )}
            </span>
          </div>
        </div>

        <div className="jd-toolbar">
          <div className="jd-search">
            <Search size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un justificatif, un donateur, une commande..."
            />
          </div>

          <select
            value={campaignFilter}
            onChange={(event) =>
              setCampaignFilter(event.target.value)
            }
            className="jd-select"
            aria-label="Filtrer par campagne"
          >
            <option value="ALL">Toutes les campagnes</option>
            {campaigns.map((campaign) => (
              <option key={campaign} value={campaign}>
                {campaign}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="jd-select"
            aria-label="Filtrer par statut"
          >
            <option value="ALL">Tous les statuts</option>
            <option value="A_VERIFIER">À vérifier</option>
            <option value="EMIS">Émis</option>
            <option value="ENVOYE">Envoyé</option>
            <option value="BROUILLON">Brouillon</option>
            <option value="ARCHIVE">Archivé</option>
            <option value="ERREUR">Erreur</option>
          </select>

          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
            className="jd-select"
            aria-label="Filtrer par période"
          >
            <option value="ALL">Toutes les dates</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="90">90 derniers jours</option>
          </select>

          <button
            type="button"
            className="jd-secondary-button"
            onClick={exportCsv}
          >
            <Download size={18} />
            Exporter
          </button>
        </div>

        <div className="jd-table-wrap">
          <table className="jd-table">
            <thead>
              <tr>
                <th>N° JD</th>
                <th>Donateur</th>
                <th>Type</th>
                <th>Date d’émission</th>
                <th>Montant</th>
                <th>Paiement</th>
                <th>Document</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((item) => (
                <tr key={item.id}>
                  <td className="jd-number">{item.numero}</td>
                  <td>
                    <div className="jd-donor-cell">
                      <strong>{item.donateurNom}</strong>
                      <span>
                        {item.commandeNumero || item.donateurVille || '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`jd-type-badge ${
                        item.type === 'JDI' ? 'jdi' : 'jdp'
                      }`}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td>{formatDate(item.dateEmission)}</td>
                  <td className="jd-amount">
                    {formatMoney(item.montant)}
                  </td>
                  <td>
                    <PaymentBadge value={item.paiementStatut} />
                  </td>
                  <td>
                    <DocumentBadge value={item.documentStatut} />
                  </td>
                  <td>
                    <StatusBadge value={item.statut} />
                  </td>
                  <td>
                    <div className="jd-row-actions">
                      <button
                        type="button"
                        title="Voir"
                        onClick={() => setDetail(item)}
                      >
                        <Eye size={17} />
                      </button>
                      <button
                        type="button"
                        title="Modifier"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        type="button"
                        title="Générer / imprimer le PDF"
                        onClick={() => handleGenerate(item)}
                      >
                        <Download size={17} />
                      </button>
                      <div className="jd-more-wrap">
                        <button
                          type="button"
                          title="Plus d’actions"
                          onClick={() =>
                            setMoreId((current) =>
                              current === item.id ? null : item.id,
                            )
                          }
                        >
                          <MoreHorizontal size={17} />
                        </button>

                        {moreId === item.id && (
                          <div className="jd-more-menu">
                            {item.documentStatut !== 'ENVOYE' && (
                              <button
                                type="button"
                                onClick={() => {
                                  markSent(item.id)
                                  setMoreId(null)
                                }}
                              >
                                <Send size={16} />
                                Marquer envoyé
                              </button>
                            )}

                            {item.type === 'JDI' && (
                              <button
                                type="button"
                                onClick={() => handleConvert(item)}
                              >
                                <FileCheck2 size={16} />
                                Créer le JDP
                              </button>
                            )}

                            {item.statut !== 'ARCHIVE' && (
                              <button
                                type="button"
                                onClick={() => {
                                  archiveJustificatif(item.id)
                                  setMoreId(null)
                                }}
                              >
                                <Archive size={16} />
                                Archiver
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {visibleRows.length === 0 && (
            <div className="jd-empty-state">
              <FileText size={40} />
              <strong>Aucun justificatif trouvé</strong>
              <span>
                Modifie les filtres ou crée un nouveau justificatif.
              </span>
            </div>
          )}
        </div>

        <div className="jd-pagination-bar">
          <div className="jd-page-size">
            <span>Afficher</span>
            <select
              value={pageSize}
              onChange={(event) =>
                setPageSize(Number(event.target.value) as PageSize)
              }
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span>justificatifs</span>
          </div>

          <div className="jd-pagination-info">
            Affichage de{' '}
            {filtered.length === 0 ? 0 : firstIndex + 1} à{' '}
            {Math.min(firstIndex + pageSize, filtered.length)} sur{' '}
            {filtered.length}
          </div>

          <div className="jd-pagination-buttons">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() =>
                setCurrentPage((page) => Math.max(1, page - 1))
              }
              aria-label="Page précédente"
            >
              <ChevronLeft size={18} />
            </button>

            {pageNumbers.map((value, index) =>
              value === 'ellipsis' ? (
                <span
                  className="jd-pagination-ellipsis"
                  key={`ellipsis-${index}`}
                >
                  …
                </span>
              ) : (
                <button
                  key={value}
                  type="button"
                  className={
                    currentPage === value ? 'active' : undefined
                  }
                  onClick={() => setCurrentPage(value)}
                >
                  {value}
                </button>
              ),
            )}

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(totalPages, page + 1),
                )
              }
              aria-label="Page suivante"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      <section className="jd-bottom-grid">
        <article className="jd-summary-card">
          <h3>
            <FileText size={19} />
            Suivi documentaire
          </h3>
          <div className="jd-summary-grid">
            <MiniStat
              icon={<FileCheck2 size={20} />}
              label="PDF générés"
              value={String(kpis.generated)}
            />
            <MiniStat
              icon={<Send size={20} />}
              label="Envoyés"
              value={String(kpis.sent)}
            />
            <MiniStat
              icon={<AlertTriangle size={20} />}
              label="À relancer"
              value={String(kpis.jdiWaiting)}
            />
            <MiniStat
              icon={<Euro size={20} />}
              label="Montant total"
              value={formatMoney(kpis.amount)}
            />
          </div>
        </article>

        <article className="jd-reminders-card">
          <h3>
            <AlertTriangle size={19} />
            Rappels
          </h3>
          <Reminder
            tone="orange"
            text={`${kpis.jdiWaiting} JDI en attente de règlement`}
          />
          <Reminder
            tone="blue"
            text={`${justificatifs.filter((item) => item.documentStatut === 'A_GENERER').length} documents à générer`}
          />
          <Reminder
            tone="red"
            text={`${kpis.errors} retour(s) / erreur(s) à traiter`}
          />
        </article>
      </section>

      {modalMode && (
        <JustificatifFormModal
          mode={modalMode}
          item={editing}
          onClose={() => {
            setModalMode(null)
            setEditing(null)
          }}
          onCreate={async (input, generateNow) => {
            const created = createJustificatif(input)

            setModalMode(null)
            setEditing(null)

            if (generateNow) {
              await handleGenerate(created)
            }
          }}
          onUpdate={(id, patch) => {
            updateJustificatif(id, patch)
            setModalMode(null)
            setEditing(null)
          }}
        />
      )}

      {detail && (
        <JustificatifDetailModal
          item={
            justificatifs.find((item) => item.id === detail.id) ??
            detail
          }
          onClose={() => setDetail(null)}
          onEdit={(item) => {
            setDetail(null)
            openEdit(item)
          }}
          onGenerate={handleGenerate}
          onMarkSent={(item) => {
            markSent(item.id)
          }}
          onConvert={(item) => {
            try {
              convertJdiToJdp(item.id)
              setDetail(null)
            } catch (error) {
              window.alert(
                error instanceof Error
                  ? error.message
                  : 'Conversion impossible.',
              )
            }
          }}
        />
      )}

      {chorusIssue && !chorusEditOpen && !mailDraft && (
        <ChorusBlockingModal
          issue={chorusIssue}
          onClose={() => setChorusIssue(null)}
          onComplete={() => setChorusEditOpen(true)}
          onMail={() => {
            const draft = createChorusMailDraft(
              chorusIssue.donateur,
              chorusIssue.item.campagne,
            )

            setMailDraft({
              ...draft,
              itemId: chorusIssue.item.id,
            })
          }}
        />
      )}

      {chorusIssue && chorusEditOpen && (
        <ChorusCompletionModal
          donateur={chorusIssue.donateur}
          onClose={() => setChorusEditOpen(false)}
          onSave={async (values) => {
            try {
              updateDonateurChorusInfo(
                chorusIssue.donateur.id,
                values,
              )

              updateJustificatif(
                chorusIssue.item.id,
                {},
                'Informations Chorus complétées',
              )

              setChorusEditOpen(false)
              const retryItem =
                justificatifs.find(
                  (item) => item.id === chorusIssue.item.id,
                ) ?? chorusIssue.item
              setChorusIssue(null)
              await handleGenerate(retryItem)
            } catch (error) {
              window.alert(
                error instanceof Error
                  ? error.message
                  : 'Impossible de mettre à jour la fiche donateur.',
              )
            }
          }}
        />
      )}

      {mailDraft && (
        <ChorusMailModal
          draft={mailDraft}
          onClose={() => setMailDraft(null)}
          onChange={setMailDraft}
          onPrepare={() => {
            const url = `mailto:${encodeURIComponent(mailDraft.to)}?subject=${encodeURIComponent(
              mailDraft.subject,
            )}&body=${encodeURIComponent(mailDraft.body)}`

            updateJustificatif(
              mailDraft.itemId,
              {},
              'Demande d’informations Chorus préparée',
            )

            window.location.href = url
            setMailDraft(null)
          }}
        />
      )}
    </div>
  )
}

function ChorusBlockingModal({
  issue,
  onClose,
  onComplete,
  onMail,
}: {
  issue: {
    item: JustificatifDon
    donateur: DonateurDocumentData
    missing: string[]
  }
  onClose: () => void
  onComplete: () => void
  onMail: () => void
}) {
  return (
    <div className="jd-modal-overlay" role="presentation">
      <section
        className="jd-chorus-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jd-chorus-title"
      >
        <header className="jd-chorus-header">
          <div className="jd-chorus-alert-icon">
            <AlertTriangle size={24} />
          </div>
          <div>
            <span>Génération bloquée</span>
            <h2 id="jd-chorus-title">
              Informations Chorus incomplètes
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        <div className="jd-chorus-body">
          <p>
            Le justificatif <strong>{issue.item.numero}</strong> ne peut
            pas encore être généré pour{' '}
            <strong>{issue.donateur.nom}</strong>.
          </p>

          <div className="jd-chorus-missing">
            <strong>Informations manquantes</strong>
            <ul>
              {issue.missing.map((field) => (
                <li key={field}>{field}</li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="jd-chorus-actions">
          <button
            type="button"
            className="jd-secondary-button"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            className="jd-secondary-button"
            onClick={onMail}
          >
            <Mail size={17} />
            Envoyer un mail
          </button>
          <button
            type="button"
            className="jd-primary-button"
            onClick={onComplete}
          >
            <Pencil size={17} />
            Compléter la fiche donateur
          </button>
        </footer>
      </section>
    </div>
  )
}

function ChorusCompletionModal({
  donateur,
  onClose,
  onSave,
}: {
  donateur: DonateurDocumentData
  onClose: () => void
  onSave: (values: {
    siret: string
    chorusNumeroEngagement: string
    chorusCodeService: string
  }) => void | Promise<void>
}) {
  const [siret, setSiret] = useState(donateur.siret || '')
  const [numeroEngagement, setNumeroEngagement] = useState(
    donateur.chorusNumeroEngagement || '',
  )
  const [codeService, setCodeService] = useState(
    donateur.chorusCodeService || '',
  )

  return (
    <div className="jd-modal-overlay" role="presentation">
      <form
        className="jd-chorus-modal"
        onSubmit={(event) => {
          event.preventDefault()
          void onSave({
            siret,
            chorusNumeroEngagement: numeroEngagement,
            chorusCodeService: codeService,
          })
        }}
      >
        <header className="jd-chorus-header">
          <div>
            <span>BDD Donateurs</span>
            <h2>Compléter les informations Chorus</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        <div className="jd-chorus-body">
          <div className="jd-chorus-donor-name">{donateur.nom}</div>

          <label className="jd-chorus-field">
            <span>SIRET</span>
            <input
              value={siret}
              onChange={(event) => setSiret(event.target.value)}
              placeholder="Ex. 123 456 789 00012"
            />
          </label>

          <label className="jd-chorus-field">
            <span>Numéro d'engagement</span>
            <input
              value={numeroEngagement}
              onChange={(event) =>
                setNumeroEngagement(event.target.value)
              }
              placeholder="Ex. EJ202600458"
            />
          </label>

          <label className="jd-chorus-field">
            <span>Code service</span>
            <input
              value={codeService}
              onChange={(event) => setCodeService(event.target.value)}
              placeholder="Ex. FINANCES"
            />
          </label>
        </div>

        <footer className="jd-chorus-actions">
          <button
            type="button"
            className="jd-secondary-button"
            onClick={onClose}
          >
            Annuler
          </button>
          <button type="submit" className="jd-primary-button">
            <Check size={17} />
            Enregistrer et générer
          </button>
        </footer>
      </form>
    </div>
  )
}

function ChorusMailModal({
  draft,
  onClose,
  onChange,
  onPrepare,
}: {
  draft: {
    to: string
    subject: string
    body: string
    itemId: string
  }
  onClose: () => void
  onChange: (value: {
    to: string
    subject: string
    body: string
    itemId: string
  }) => void
  onPrepare: () => void
}) {
  return (
    <div className="jd-modal-overlay" role="presentation">
      <section className="jd-chorus-modal jd-mail-modal">
        <header className="jd-chorus-header">
          <div>
            <span>Demande d'informations</span>
            <h2>Préparer le mail Chorus</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        <div className="jd-chorus-body">
          <label className="jd-chorus-field">
            <span>Destinataire</span>
            <input
              type="email"
              value={draft.to}
              onChange={(event) =>
                onChange({ ...draft, to: event.target.value })
              }
            />
          </label>

          <label className="jd-chorus-field">
            <span>Objet</span>
            <input
              value={draft.subject}
              onChange={(event) =>
                onChange({ ...draft, subject: event.target.value })
              }
            />
          </label>

          <label className="jd-chorus-field">
            <span>Message</span>
            <textarea
              rows={13}
              value={draft.body}
              onChange={(event) =>
                onChange({ ...draft, body: event.target.value })
              }
            />
          </label>
        </div>

        <footer className="jd-chorus-actions">
          <button
            type="button"
            className="jd-secondary-button"
            onClick={onClose}
          >
            Annuler
          </button>
          <button
            type="button"
            className="jd-primary-button"
            onClick={onPrepare}
            disabled={!draft.to.trim()}
          >
            <Mail size={17} />
            Ouvrir dans la messagerie
          </button>
        </footer>
      </section>
    </div>
  )
}

function TabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`jd-tab ${active ? 'active' : ''}`}
      onClick={onClick}
    >
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
  value: string
  tone: 'blue' | 'orange' | 'green' | 'red'
}) {
  return (
    <article className="jd-kpi">
      <div className={`jd-kpi-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="jd-mini-stat">
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function Reminder({
  text,
  tone,
}: {
  text: string
  tone: 'orange' | 'blue' | 'red'
}) {
  return (
    <div className="jd-reminder">
      <span className={`jd-reminder-dot ${tone}`} />
      <span>{text}</span>
      <ChevronRight size={16} />
    </div>
  )
}

function PaymentBadge({ value }: { value: PaiementStatut }) {
  return (
    <span className={`jd-pill payment ${value.toLowerCase()}`}>
      {value === 'PAYE' ? (
        <Check size={14} />
      ) : value === 'EN_ATTENTE' ? (
        <Clock3 size={14} />
      ) : null}
      {paymentLabel(value)}
    </span>
  )
}

function DocumentBadge({ value }: { value: DocumentStatut }) {
  return (
    <span className={`jd-pill document ${value.toLowerCase()}`}>
      {value === 'ENVOYE' ? (
        <Send size={14} />
      ) : value === 'GENERE' ? (
        <CheckCircle2 size={14} />
      ) : value === 'ERREUR' ? (
        <AlertTriangle size={14} />
      ) : (
        <Clock3 size={14} />
      )}
      {documentLabel(value)}
    </span>
  )
}

function StatusBadge({ value }: { value: JustificatifStatut }) {
  return (
    <span className={`jd-status ${value.toLowerCase()}`}>
      {statusLabel(value)}
    </span>
  )
}

function JustificatifFormModal({
  mode,
  item,
  onClose,
  onCreate,
  onUpdate,
}: {
  mode: 'create' | 'edit'
  item: JustificatifDon | null
  onClose: () => void
  onCreate: (
    input: NouveauJustificatif,
    generateNow: boolean,
  ) => void | Promise<void>
  onUpdate: (
    id: string,
    patch: Partial<JustificatifDon>,
  ) => void
}) {
  const [donateurs] = useState<DonateurRef[]>(readDonateurs)
  const [commandes] = useState<CommandeRef[]>(readCommandes)
  const [campagnes] = useState<CampagneRef[]>(readCampagnes)
  const [error, setError] = useState('')
  const [submitAction, setSubmitAction] =
    useState<'save' | 'generate'>('generate')
  const [templateMeta, setTemplateMeta] =
    useState<CampagnePdfTemplateMeta | null>(null)
  const [templateAvailable, setTemplateAvailable] = useState(false)
  const [templateChecking, setTemplateChecking] = useState(false)

  const [form, setForm] = useState<FormState>(() => {
    if (!item) {
      const active =
        campagnes.find((campagne) => campagne.statut === 'ACTIVE') ??
        campagnes[0]

      return createEmptyForm(active?.id ?? DEFAULT_CAMPAIGN)
    }

    return {
      type: item.type,
      campagne: item.campagne,
      donateurId: item.donateurId || '',
      commandeId: item.commandeId || '',
      donateurNom: item.donateurNom,
      donateurCode: item.donateurCode || '',
      donateurVille: item.donateurVille || '',
      donateurAdresse: item.donateurAdresse || '',
      donateurEmail: item.donateurEmail || '',
      donateurTelephone: item.donateurTelephone || '',
      dateEmission: item.dateEmission,
      nbBrioches: item.nbBrioches,
      prixUnitaire: item.prixUnitaire,
      statut: item.statut,
      paiementStatut: item.paiementStatut,
      documentStatut: item.documentStatut,
      datePaiement: item.datePaiement || '',
      referencePaiement: item.referencePaiement || '',
      emailDestinataire:
        item.emailDestinataire || item.donateurEmail || '',
      remarque: item.remarque || '',
    }
  })

  useEffect(() => {
    let cancelled = false

    async function checkTemplate() {
      setTemplateChecking(true)

      try {
        const campagne = campagnes.find(
          (candidate) => candidate.id === form.campagne,
        )

        const settings = getCampagneJustificatifsSettings(
          form.campagne,
          campagne?.annee ?? null,
        )

        const meta = settings.templates[form.type]
        const blob = meta
          ? await getCampagneTemplatePdf(form.campagne, form.type)
          : null

        if (!cancelled) {
          setTemplateMeta(meta)
          setTemplateAvailable(Boolean(meta && blob))
        }
      } catch {
        if (!cancelled) {
          setTemplateMeta(null)
          setTemplateAvailable(false)
        }
      } finally {
        if (!cancelled) {
          setTemplateChecking(false)
        }
      }
    }

    void checkTemplate()

    return () => {
      cancelled = true
    }
  }, [campagnes, form.campagne, form.type])

  const commandesForDonor = commandes.filter(
    (commande) =>
      !form.donateurId ||
      commande.donateurId === form.donateurId,
  )

  const amount =
    Math.max(0, Number(form.nbBrioches) || 0) *
    Math.max(0, Number(form.prixUnitaire) || 0)

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function selectDonateur(id: string) {
    const donateur = donateurs.find(
      (candidate) => candidate.id === id,
    )

    setForm((current) => ({
      ...current,
      donateurId: id,
      commandeId: '',
      donateurNom: donateur?.nom || current.donateurNom,
      donateurCode: donateur?.code || '',
      donateurVille: donateur?.ville || '',
      donateurAdresse: [donateur?.adresse, donateur?.cp, donateur?.ville]
        .filter(Boolean)
        .join(' '),
      donateurEmail: donateur?.email || '',
      donateurTelephone: donateur?.telephone || '',
      emailDestinataire: donateur?.email || current.emailDestinataire,
    }))
  }

  function selectCommande(id: string) {
    const commande = commandes.find(
      (candidate) => candidate.id === id,
    )

    setForm((current) => ({
      ...current,
      commandeId: id,
      campagne: commande?.campagne || current.campagne,
      nbBrioches:
        commande?.quantite !== undefined
          ? Number(commande.quantite) || 0
          : current.nbBrioches,
      prixUnitaire:
        commande?.prixUnitaire !== undefined &&
        Number(commande.prixUnitaire) > 0
          ? Number(commande.prixUnitaire)
          : current.prixUnitaire,
    }))
  }

  function handleType(type: JustificatifType) {
    setForm((current) => ({
      ...current,
      type,
      paiementStatut:
        type === 'JDP' ? 'PAYE' : 'EN_ATTENTE',
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')

    if (!form.donateurNom.trim()) {
      setError('Le nom du donateur est obligatoire.')
      return
    }

    if (!form.campagne.trim()) {
      setError('La campagne est obligatoire.')
      return
    }

    if (!form.dateEmission) {
      setError("La date d'émission est obligatoire.")
      return
    }

    if (form.nbBrioches < 0 || form.prixUnitaire < 0) {
      setError('Les quantités et montants ne peuvent pas être négatifs.')
      return
    }

    const linkedCommande = commandes.find(
      (commande) => commande.id === form.commandeId,
    )

    const shared = {
      type: form.type,
      campagne: form.campagne.trim(),
      donateurId: form.donateurId || undefined,
      donateurCode: form.donateurCode || undefined,
      donateurNom: form.donateurNom.trim(),
      donateurVille: form.donateurVille || undefined,
      donateurAdresse: form.donateurAdresse || undefined,
      donateurEmail: form.donateurEmail || undefined,
      donateurTelephone: form.donateurTelephone || undefined,
      commandeId: form.commandeId || undefined,
      commandeNumero: linkedCommande?.numero || undefined,
      dateEmission: form.dateEmission,
      nbBrioches: Number(form.nbBrioches) || 0,
      prixUnitaire: Number(form.prixUnitaire) || 0,
      statut: form.statut,
      paiementStatut: form.paiementStatut,
      documentStatut: form.documentStatut,
      datePaiement: form.datePaiement || undefined,
      referencePaiement: form.referencePaiement || undefined,
      emailDestinataire: form.emailDestinataire || undefined,
      remarque: form.remarque || undefined,
    }

    if (mode === 'create') {
      if (submitAction === 'generate' && !templateAvailable) {
        setError(
          `Aucun modèle ${form.type} exploitable n'est enregistré pour ${form.campagne}. ` +
            'Importe d’abord le PDF vierge dans Administration > Campagnes > Documents.',
        )
        return
      }

      await onCreate(shared, submitAction === 'generate')
      return
    }

    if (item) {
      onUpdate(item.id, shared)
    }
  }

  return (
    <div className="jd-modal-overlay" role="presentation">
      <form className="jd-form-modal" onSubmit={submit}>
        <header className="jd-modal-header">
          <div>
            <span>JUSTIFICATIF DE DON</span>
            <h2>
              {mode === 'create'
                ? 'Nouveau justificatif'
                : `Modifier ${item?.numero || ''}`}
            </h2>
          </div>

          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        <div className="jd-modal-body">
          <FormSection number="1" title="Type & campagne">
            <div className="jd-form-grid">
              <FormField label="Type">
                <div className="jd-segmented">
                  <button
                    type="button"
                    className={form.type === 'JDI' ? 'active' : ''}
                    onClick={() => handleType('JDI')}
                  >
                    JDI
                  </button>
                  <button
                    type="button"
                    className={form.type === 'JDP' ? 'active' : ''}
                    onClick={() => handleType('JDP')}
                  >
                    JDP
                  </button>
                </div>
              </FormField>

              <FormField label="Campagne">
                <select
                  value={form.campagne}
                  onChange={(event) =>
                    update('campagne', event.target.value)
                  }
                >
                  {campagnes.map((campagne) => (
                    <option key={campagne.id} value={campagne.id}>
                      {campagne.id}
                      {campagne.statut === 'ACTIVE' ? ' — active' : ''}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Date d’émission">
                <input
                  type="date"
                  value={form.dateEmission}
                  onChange={(event) =>
                    update('dateEmission', event.target.value)
                  }
                />
              </FormField>
            </div>

            <div
              className={`jd-template-link ${
                templateAvailable ? 'ready' : 'missing'
              }`}
            >
              <div className="jd-template-link-icon">
                {templateAvailable ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertTriangle size={20} />
                )}
              </div>

              <div className="jd-template-link-copy">
                <strong>
                  {templateChecking
                    ? `Vérification du modèle ${form.type}…`
                    : templateAvailable
                      ? `Modèle ${form.type} prêt`
                      : `Modèle ${form.type} manquant`}
                </strong>

                <span>
                  {templateAvailable && templateMeta
                    ? `${templateMeta.fileName} · version ${templateMeta.version} · ${form.campagne}`
                    : `Le PDF vierge ${form.type} doit être importé dans Administration > Campagnes > Documents pour ${form.campagne}.`}
                </span>
              </div>

              {templateAvailable && (
                <button
                  type="button"
                  className="jd-template-preview"
                  onClick={() =>
                    void previewCampagneTemplatePdf(
                      form.campagne,
                      form.type,
                    )
                  }
                >
                  <Eye size={16} />
                  Voir le modèle
                </button>
              )}
            </div>
          </FormSection>

          <FormSection number="2" title="Donateur & commande">
            <div className="jd-form-grid">
              <FormField label="Donateur" wide>
                {donateurs.length > 0 ? (
                  <select
                    value={form.donateurId}
                    onChange={(event) =>
                      selectDonateur(event.target.value)
                    }
                  >
                    <option value="">Sélectionner un donateur</option>
                    {donateurs.map((donateur) => (
                      <option key={donateur.id} value={donateur.id}>
                        {donateur.nom}
                        {donateur.ville ? ` — ${donateur.ville}` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={form.donateurNom}
                    onChange={(event) =>
                      update('donateurNom', event.target.value)
                    }
                    placeholder="Nom du donateur"
                  />
                )}
              </FormField>

              {donateurs.length > 0 && (
                <FormField label="Nom / raison sociale" wide>
                  <input
                    value={form.donateurNom}
                    onChange={(event) =>
                      update('donateurNom', event.target.value)
                    }
                  />
                </FormField>
              )}

              <FormField label="Commande liée" wide>
                <select
                  value={form.commandeId}
                  onChange={(event) =>
                    selectCommande(event.target.value)
                  }
                >
                  <option value="">Aucune commande liée</option>
                  {commandesForDonor.map((commande) => (
                    <option key={commande.id} value={commande.id}>
                      {commande.numero || commande.id}
                      {commande.campagne
                        ? ` — ${commande.campagne}`
                        : ''}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Ville">
                <input
                  value={form.donateurVille}
                  onChange={(event) =>
                    update('donateurVille', event.target.value)
                  }
                />
              </FormField>

              <FormField label="E-mail">
                <input
                  type="email"
                  value={form.donateurEmail}
                  onChange={(event) => {
                    update('donateurEmail', event.target.value)
                    if (!form.emailDestinataire) {
                      update('emailDestinataire', event.target.value)
                    }
                  }}
                />
              </FormField>

              <FormField label="Téléphone">
                <input
                  value={form.donateurTelephone}
                  onChange={(event) =>
                    update('donateurTelephone', event.target.value)
                  }
                />
              </FormField>

              <FormField label="Adresse" wide>
                <input
                  value={form.donateurAdresse}
                  onChange={(event) =>
                    update('donateurAdresse', event.target.value)
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection number="3" title="Montant & suivi">
            <div className="jd-form-grid">
              <FormField label="Nombre de brioches">
                <input
                  type="number"
                  min="0"
                  value={form.nbBrioches}
                  onChange={(event) =>
                    update('nbBrioches', Number(event.target.value))
                  }
                />
              </FormField>

              <FormField label="Prix unitaire (€)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.prixUnitaire}
                  onChange={(event) =>
                    update('prixUnitaire', Number(event.target.value))
                  }
                />
              </FormField>

              <FormField label="Paiement">
                <select
                  value={form.paiementStatut}
                  onChange={(event) =>
                    update(
                      'paiementStatut',
                      event.target.value as PaiementStatut,
                    )
                  }
                >
                  <option value="EN_ATTENTE">En attente</option>
                  <option value="PAYE">Payé</option>
                  <option value="NON_APPLICABLE">Non applicable</option>
                </select>
              </FormField>

              <FormField label="Statut">
                <select
                  value={form.statut}
                  onChange={(event) =>
                    update(
                      'statut',
                      event.target.value as JustificatifStatut,
                    )
                  }
                >
                  <option value="BROUILLON">Brouillon</option>
                  <option value="A_VERIFIER">À vérifier</option>
                  <option value="EMIS">Émis</option>
                  <option value="ENVOYE">Envoyé</option>
                  <option value="ARCHIVE">Archivé</option>
                  <option value="ERREUR">Erreur</option>
                </select>
              </FormField>

              <FormField label="Date de paiement">
                <input
                  type="date"
                  value={form.datePaiement}
                  onChange={(event) =>
                    update('datePaiement', event.target.value)
                  }
                />
              </FormField>

              <FormField label="Référence paiement">
                <input
                  value={form.referencePaiement}
                  onChange={(event) =>
                    update('referencePaiement', event.target.value)
                  }
                />
              </FormField>

              <FormField label="Destinataire e-mail" wide>
                <input
                  type="email"
                  value={form.emailDestinataire}
                  onChange={(event) =>
                    update('emailDestinataire', event.target.value)
                  }
                />
              </FormField>

              <FormField label="Remarque" wide>
                <textarea
                  rows={4}
                  value={form.remarque}
                  onChange={(event) =>
                    update('remarque', event.target.value)
                  }
                />
              </FormField>
            </div>

            <div className="jd-form-total">
              <span>Montant du justificatif</span>
              <strong>{formatMoney(amount)}</strong>
            </div>
          </FormSection>

          {error && <div className="jd-form-error">{error}</div>}
        </div>

        <footer className="jd-modal-footer">
          <button
            type="button"
            className="jd-secondary-button"
            onClick={onClose}
          >
            Annuler
          </button>

          {mode === 'create' ? (
            <>
              <button
                type="submit"
                className="jd-secondary-button"
                onClick={() => setSubmitAction('save')}
              >
                <Check size={18} />
                Enregistrer sans PDF
              </button>

              <button
                type="submit"
                className="jd-primary-button"
                onClick={() => setSubmitAction('generate')}
                disabled={templateChecking || !templateAvailable}
                title={
                  templateAvailable
                    ? `Créer le justificatif et remplir le modèle ${form.type}`
                    : `Importe d’abord le modèle ${form.type} pour ${form.campagne}`
                }
              >
                <FileCheck2 size={18} />
                Créer et générer le PDF
              </button>
            </>
          ) : (
            <button type="submit" className="jd-primary-button">
              <Check size={18} />
              Enregistrer les modifications
            </button>
          )}
        </footer>
      </form>
    </div>
  )
}

function FormSection({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="jd-form-section">
      <div className="jd-form-section-title">
        <span>{number}</span>
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  )
}

function FormField({
  label,
  children,
  wide = false,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <label className={`jd-form-field ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  )
}

function JustificatifDetailModal({
  item,
  onClose,
  onEdit,
  onGenerate,
  onMarkSent,
  onConvert,
}: {
  item: JustificatifDon
  onClose: () => void
  onEdit: (item: JustificatifDon) => void
  onGenerate: (item: JustificatifDon) => void
  onMarkSent: (item: JustificatifDon) => void
  onConvert: (item: JustificatifDon) => void
}) {
  const [tab, setTab] = useState<
    'general' | 'document' | 'paiement' | 'historique'
  >('general')

  return (
    <div className="jd-modal-overlay">
      <div className="jd-detail-modal">
        <header className="jd-modal-header">
          <div>
            <span>JUSTIFICATIF DE DON</span>
            <h2>{item.numero}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </button>
        </header>

        <div className="jd-detail-hero">
          <div>
            <span
              className={`jd-type-badge ${
                item.type === 'JDI' ? 'jdi' : 'jdp'
              }`}
            >
              {item.type}
            </span>
            <h3>{item.donateurNom}</h3>
            <p>
              {item.campagne} · {formatDate(item.dateEmission)}
            </p>
          </div>
          <strong>{formatMoney(item.montant)}</strong>
        </div>

        <nav className="jd-detail-tabs">
          {[
            ['general', 'Vue générale'],
            ['document', 'Document'],
            ['paiement', 'Paiement'],
            ['historique', 'Historique'],
          ].map(([key, label]) => (
            <button
              type="button"
              key={key}
              className={tab === key ? 'active' : ''}
              onClick={() =>
                setTab(
                  key as
                    | 'general'
                    | 'document'
                    | 'paiement'
                    | 'historique',
                )
              }
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="jd-detail-content">
          {tab === 'general' && (
            <div className="jd-detail-grid">
              <DetailCard title="Identité">
                <InfoLine label="N° justificatif" value={item.numero} />
                <InfoLine label="Type" value={item.type} />
                <InfoLine label="Campagne" value={item.campagne} />
                <InfoLine
                  label="Statut"
                  value={statusLabel(item.statut)}
                />
              </DetailCard>

              <DetailCard title="Donateur">
                <InfoLine label="Nom" value={item.donateurNom} />
                <InfoLine
                  label="Code"
                  value={item.donateurCode || '—'}
                />
                <InfoLine
                  label="Ville"
                  value={item.donateurVille || '—'}
                />
                <InfoLine
                  label="Commande"
                  value={item.commandeNumero || '—'}
                />
              </DetailCard>

              <DetailCard title="Montant">
                <InfoLine
                  label="Brioches"
                  value={String(item.nbBrioches)}
                />
                <InfoLine
                  label="Prix unitaire"
                  value={formatMoney(item.prixUnitaire)}
                />
                <InfoLine
                  label="Montant"
                  value={formatMoney(item.montant)}
                  strong
                />
              </DetailCard>
            </div>
          )}

          {tab === 'document' && (
            <DetailCard title="Suivi documentaire">
              <InfoLine
                label="Statut document"
                value={documentLabel(item.documentStatut)}
              />
              <InfoLine
                label="Version"
                value={`v${item.version}`}
              />
              <InfoLine
                label="Modèle utilisé"
                value={
                  item.modeleNom
                    ? `${item.modeleNom}${
                        item.modeleVersion
                          ? ` · modèle v${item.modeleVersion}`
                          : ''
                      }`
                    : 'Non généré'
                }
              />
              <InfoLine
                label="Mode de règlement"
                value={item.modeReglementGenere || '—'}
              />
              <InfoLine
                label="Destinataire"
                value={item.emailDestinataire || item.donateurEmail || '—'}
              />
              <InfoLine
                label="Date d’envoi"
                value={formatDate(item.dateEnvoi)}
              />
            </DetailCard>
          )}

          {tab === 'paiement' && (
            <DetailCard title="Paiement lié">
              <InfoLine
                label="Statut"
                value={paymentLabel(item.paiementStatut)}
              />
              <InfoLine
                label="Date"
                value={formatDate(item.datePaiement)}
              />
              <InfoLine
                label="Référence"
                value={item.referencePaiement || '—'}
              />
            </DetailCard>
          )}

          {tab === 'historique' && (
            <div className="jd-history-list">
              {[...item.historique]
                .reverse()
                .map((entry) => (
                  <div className="jd-history-item" key={entry.id}>
                    <div className="jd-history-dot" />
                    <div>
                      <strong>{entry.action}</strong>
                      {entry.detail && <span>{entry.detail}</span>}
                      <small>{formatDate(entry.date)}</small>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <footer className="jd-detail-actions">
          <button
            type="button"
            className="jd-secondary-button"
            onClick={() => onEdit(item)}
          >
            <Pencil size={17} />
            Modifier
          </button>
          <button
            type="button"
            className="jd-secondary-button"
            onClick={() => onGenerate(item)}
          >
            <Download size={17} />
            Générer / imprimer
          </button>
          {item.documentStatut !== 'ENVOYE' && (
            <button
              type="button"
              className="jd-secondary-button"
              onClick={() => onMarkSent(item)}
            >
              <Mail size={17} />
              Marquer envoyé
            </button>
          )}
          {item.type === 'JDI' && (
            <button
              type="button"
              className="jd-primary-button"
              onClick={() => onConvert(item)}
            >
              <FileCheck2 size={17} />
              Créer le JDP
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

function DetailCard({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="jd-detail-card">
      <h4>{title}</h4>
      {children}
    </section>
  )
}

function InfoLine({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className={`jd-info-line ${strong ? 'strong' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export default JustificatifsDons
