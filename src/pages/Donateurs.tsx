import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  Archive,
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Search,
  Settings2,
  ShoppingCart,
  User,
  X,
} from 'lucide-react'

import {
  useNavigate,
} from 'react-router-dom'

import ExcelJS from 'exceljs'

import {
  jsPDF,
} from 'jspdf'

import autoTable from 'jspdf-autotable'

import {
  useObData,
} from '../context/ObDataContext'

import type {
  Commande,
  Donateur,
  StatutCommande,
} from '../types/ob'

import './Donateurs.css'

/* =========================================================
   TYPES
   ========================================================= */

type SortKey =
  | 'code'
  | 'nom'
  | 'type'
  | 'ville'
  | 'contact'
  | 'telephone'
  | 'email'
  | 'jdi'
  | 'jdp'
  | 'rf'

type SortDirection =
  | 'asc'
  | 'desc'

type DonateurFormMode =
  | 'create'
  | 'edit'

type DetailTab =
  | 'general'
  | 'contacts'
  | 'commandes'
  | 'dons'
  | 'encaissements'
  | 'documents'
  | 'historique'

type ColumnKey =
  | 'type'
  | 'ville'
  | 'contact'
  | 'telephone'
  | 'email'
  | 'jdi'
  | 'jdp'
  | 'rf'

/* =========================================================
   COLONNES PAR DÉFAUT
   ========================================================= */

const DEFAULT_COLUMNS: Record<
  ColumnKey,
  boolean
> = {
  type: true,
  ville: true,
  contact: true,
  telephone: true,
  email: true,
  jdi: true,
  jdp: true,
  rf: true,
}

/* =========================================================
   DONATEUR VIDE
   ========================================================= */

const EMPTY_DONATEUR: Donateur = {
  id: 0,
  code: '',
  type: 'ENTREPRISE',
  nom: '',
  numeroVoie: '',
  adresse: '',
  cp: '',
  ville: '',
  informations: '',
  contactNom: '',
  contactPrenom: '',
  email: '',
  telephone: '',
  conditionReglement: '',
  modeReglement: '',
  jdi: 'NON',
  jdp: 'NON',
  rf: 'NON',
  remarque: '',
  archive: false,
}

/* =========================================================
   PAGE DONATEURS
   ========================================================= */

function Donateurs() {
  const navigate =
    useNavigate()

  const {
    donateurs,
    setDonateurs,
    commandes,
  } = useObData()

  /* =======================================================
     ETATS
     ======================================================= */

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    typeFilter,
    setTypeFilter,
  ] = useState('Tous')

  const [
    selectedDonateurId,
    setSelectedDonateurId,
  ] =
    useState<number | null>(
      null,
    )

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      'code',
    )

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      'desc',
    )

  const [
    exportMenuOpen,
    setExportMenuOpen,
  ] = useState(false)

  const [
    formOpen,
    setFormOpen,
  ] = useState(false)

  const [
    formMode,
    setFormMode,
  ] =
    useState<DonateurFormMode>(
      'create',
    )

  const [
    editingDonateur,
    setEditingDonateur,
  ] =
    useState<Donateur | null>(
      null,
    )

  const [
    actionMenuId,
    setActionMenuId,
  ] =
    useState<number | null>(
      null,
    )

  const [
    columnsMenuOpen,
    setColumnsMenuOpen,
  ] = useState(false)

  /* =======================================================
     COLONNES PERSONNALISÉES
     ======================================================= */

  const [
    visibleColumns,
    setVisibleColumns,
  ] = useState<
    Record<
      ColumnKey,
      boolean
    >
  >(() => {
    const saved =
      localStorage.getItem(
        'ob-donateurs-columns',
      )

    if (!saved) {
      return {
        ...DEFAULT_COLUMNS,
      }
    }

    try {
      return {
        ...DEFAULT_COLUMNS,
        ...JSON.parse(
          saved,
        ),
      }
    } catch {
      return {
        ...DEFAULT_COLUMNS,
      }
    }
  })

  useEffect(() => {
    localStorage.setItem(
      'ob-donateurs-columns',
      JSON.stringify(
        visibleColumns,
      ),
    )
  }, [
    visibleColumns,
  ])

  function toggleColumn(
    column: ColumnKey,
  ) {
    setVisibleColumns(
      (current) => ({
        ...current,

        [column]:
          !current[column],
      }),
    )
  }

  function showAllColumns() {
    setVisibleColumns({
      ...DEFAULT_COLUMNS,
    })
  }

  /* =======================================================
     DONATEUR SÉLECTIONNÉ
     ======================================================= */

  const selectedDonateur =
    useMemo(() => {
      if (
        selectedDonateurId ===
        null
      ) {
        return null
      }

      return (
        donateurs.find(
          (donateur) =>
            donateur.id ===
            selectedDonateurId,
        ) ?? null
      )
    }, [
      donateurs,
      selectedDonateurId,
    ])

  /* =======================================================
     TYPES
     ======================================================= */

  const types =
    useMemo(() => {
      const values =
        donateurs
          .map(
            (donateur) =>
              donateur.type,
          )
          .filter(Boolean)

      return [
        'Tous',

        ...Array.from(
          new Set(values),
        ).sort(
          (a, b) =>
            a.localeCompare(
              b,
              'fr',
            ),
        ),
      ]
    }, [
      donateurs,
    ])

  /* =======================================================
     FILTRE + TRI
     ======================================================= */

  const filteredDonateurs =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase()

      const filtered =
        donateurs.filter(
          (donateur) => {
            if (
              donateur.archive
            ) {
              return false
            }

            const searchableText =
              [
                donateur.code,
                donateur.nom,
                donateur.type,
                donateur.ville,
                donateur.contactNom,
                donateur.contactPrenom,
                donateur.telephone,
                donateur.email,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            const matchesSearch =
              !normalizedSearch ||
              searchableText.includes(
                normalizedSearch,
              )

            const matchesType =
              typeFilter ===
                'Tous' ||
              donateur.type ===
                typeFilter

            return (
              matchesSearch &&
              matchesType
            )
          },
        )

      return [
        ...filtered,
      ].sort(
        (a, b) => {
          const valueA =
            getSortValue(
              a,
              sortKey,
            )

          const valueB =
            getSortValue(
              b,
              sortKey,
            )

          const comparison =
            valueA.localeCompare(
              valueB,
              'fr',
              {
                numeric: true,
                sensitivity:
                  'base',
              },
            )

          return sortDirection ===
            'asc'
            ? comparison
            : -comparison
        },
      )
    }, [
      donateurs,
      search,
      typeFilter,
      sortKey,
      sortDirection,
    ])

  /* =======================================================
     TRI
     ======================================================= */

  function changeSort(
    key: SortKey,
  ) {
    if (
      sortKey === key
    ) {
      setSortDirection(
        (current) =>
          current ===
          'asc'
            ? 'desc'
            : 'asc',
      )

      return
    }

    setSortKey(
      key,
    )

    setSortDirection(
      'asc',
    )
  }

  /* =======================================================
     FICHE
     ======================================================= */

  function openDonateur(
    donateur: Donateur,
  ) {
    setSelectedDonateurId(
      donateur.id,
    )

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     CRÉATION DONATEUR
     ======================================================= */

  function openCreateDonateur() {
    setFormMode(
      'create',
    )

    setEditingDonateur(
      null,
    )

    setFormOpen(
      true,
    )

    setExportMenuOpen(
      false,
    )
  }

  /* =======================================================
     MODIFICATION
     ======================================================= */

  function openEditDonateur(
    donateur: Donateur,
  ) {
    setFormMode(
      'edit',
    )

    setEditingDonateur(
      donateur,
    )

    setFormOpen(
      true,
    )

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     ENREGISTREMENT
     ======================================================= */

  function saveDonateur(
    donateur: Donateur,
  ) {
    if (
      formMode ===
      'edit'
    ) {
      setDonateurs(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              donateur.id
                ? donateur
                : item,
          ),
      )
    } else {
      setDonateurs(
        (current) => [
          ...current,
          donateur,
        ],
      )
    }

    setFormOpen(
      false,
    )

    setEditingDonateur(
      null,
    )
  }

  /* =======================================================
     ARCHIVAGE
     ======================================================= */

  function archiveDonateur(
    donateur: Donateur,
  ) {
    setDonateurs(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            donateur.id
              ? {
                  ...item,
                  archive:
                    true,
                }
              : item,
        ),
    )

    setActionMenuId(
      null,
    )

    if (
      selectedDonateurId ===
      donateur.id
    ) {
      setSelectedDonateurId(
        null,
      )
    }
  }

  /* =======================================================
     COMMANDES
     ======================================================= */

  function createCommande(
    donateur: Donateur,
  ) {
    navigate(
      `/commandes?donateur=${donateur.id}`,
    )
  }

  function openCommande(
    commandeId: number,
  ) {
    navigate(
      `/commandes?commande=${commandeId}`,
    )
  }

  /* =======================================================
     EXPORT EXCEL
     ======================================================= */

  async function exportExcel() {
    const workbook =
      new ExcelJS.Workbook()

    const worksheet =
      workbook.addWorksheet(
        'Donateurs',
      )

    const columns: {
      header: string
      key: string
      width: number
    }[] = [
      {
        header: 'Code',
        key: 'code',
        width: 18,
      },

      {
        header:
          'Nom / Raison sociale',
        key: 'nom',
        width: 38,
      },
    ]

    if (
      visibleColumns.type
    ) {
      columns.push({
        header: 'Type',
        key: 'type',
        width: 18,
      })
    }

    if (
      visibleColumns.ville
    ) {
      columns.push({
        header: 'Ville',
        key: 'ville',
        width: 24,
      })
    }

    if (
      visibleColumns.contact
    ) {
      columns.push({
        header: 'Contact',
        key: 'contact',
        width: 28,
      })
    }

    if (
      visibleColumns.telephone
    ) {
      columns.push({
        header:
          'Téléphone',
        key: 'telephone',
        width: 20,
      })
    }

    if (
      visibleColumns.email
    ) {
      columns.push({
        header: 'Email',
        key: 'email',
        width: 35,
      })
    }

    if (
      visibleColumns.jdi
    ) {
      columns.push({
        header: 'JDI',
        key: 'jdi',
        width: 10,
      })
    }

    if (
      visibleColumns.jdp
    ) {
      columns.push({
        header: 'JDP',
        key: 'jdp',
        width: 10,
      })
    }

    if (
      visibleColumns.rf
    ) {
      columns.push({
        header: 'RF',
        key: 'rf',
        width: 10,
      })
    }

    worksheet.columns =
      columns

    filteredDonateurs.forEach(
      (donateur) => {
        worksheet.addRow({
          code:
            formatDonateurCode(
              donateur,
            ),

          nom:
            donateur.nom,

          type:
            donateur.type,

          ville:
            donateur.ville ||
            '',

          contact:
            formatContact(
              donateur,
            ),

          telephone:
            donateur.telephone ||
            '',

          email:
            donateur.email ||
            '',

          jdi:
            donateur.jdi ||
            'NON',

          jdp:
            donateur.jdp ||
            'NON',

          rf:
            donateur.rf ||
            'NON',
        })
      },
    )

    const header =
      worksheet.getRow(1)

    header.font = {
      bold: true,

      color: {
        argb:
          'FFFFFFFF',
      },
    }

    header.fill = {
      type: 'pattern',

      pattern: 'solid',

      fgColor: {
        argb:
          'FF063B7C',
      },
    }

    header.alignment = {
      horizontal:
        'center',

      vertical:
        'middle',
    }

    worksheet.views = [
      {
        state:
          'frozen',

        ySplit: 1,
      },
    ]

    const buffer =
      await workbook.xlsx.writeBuffer()

    const blob =
      new Blob(
        [
          new Uint8Array(
            buffer,
          ),
        ],
        {
          type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      )

    downloadBlob(
      blob,
      `Donateurs_${getFileDate()}.xlsx`,
    )

    setExportMenuOpen(
      false,
    )
  }

  /* =======================================================
     EXPORT PDF
     ======================================================= */

  function exportPdf() {
    const doc =
      new jsPDF({
        orientation:
          'landscape',

        unit: 'mm',

        format: 'a4',
      })

    doc.setFontSize(
      15,
    )

    doc.setTextColor(
      6,
      59,
      124,
    )

    doc.text(
      'Liste des donateurs',
      8,
      10,
    )

    const headers =
      [
        'Code',
        'Nom',
      ]

    if (
      visibleColumns.type
    ) {
      headers.push(
        'Type',
      )
    }

    if (
      visibleColumns.ville
    ) {
      headers.push(
        'Ville',
      )
    }

    if (
      visibleColumns.contact
    ) {
      headers.push(
        'Contact',
      )
    }

    if (
      visibleColumns.telephone
    ) {
      headers.push(
        'Téléphone',
      )
    }

    if (
      visibleColumns.email
    ) {
      headers.push(
        'Email',
      )
    }

    if (
      visibleColumns.jdi
    ) {
      headers.push(
        'JDI',
      )
    }

    if (
      visibleColumns.jdp
    ) {
      headers.push(
        'JDP',
      )
    }

    if (
      visibleColumns.rf
    ) {
      headers.push(
        'RF',
      )
    }

    const rows =
      filteredDonateurs.map(
        (donateur) => {
          const row = [
            formatDonateurCode(
              donateur,
            ),

            donateur.nom,
          ]

          if (
            visibleColumns.type
          ) {
            row.push(
              donateur.type ||
                '',
            )
          }

          if (
            visibleColumns.ville
          ) {
            row.push(
              donateur.ville ||
                '',
            )
          }

          if (
            visibleColumns.contact
          ) {
            row.push(
              formatContact(
                donateur,
              ),
            )
          }

          if (
            visibleColumns.telephone
          ) {
            row.push(
              donateur.telephone ||
                '',
            )
          }

          if (
            visibleColumns.email
          ) {
            row.push(
              donateur.email ||
                '',
            )
          }

          if (
            visibleColumns.jdi
          ) {
            row.push(
              donateur.jdi ||
                'NON',
            )
          }

          if (
            visibleColumns.jdp
          ) {
            row.push(
              donateur.jdp ||
                'NON',
            )
          }

          if (
            visibleColumns.rf
          ) {
            row.push(
              donateur.rf ||
                'NON',
            )
          }

          return row
        },
      )

    autoTable(
      doc,
      {
        startY: 15,

        head: [
          headers,
        ],

        body:
          rows,

        styles: {
          fontSize: 7,
        },

        headStyles: {
          fillColor: [
            6,
            59,
            124,
          ],
        },
      },
    )

    doc.save(
      `Donateurs_${getFileDate()}.pdf`,
    )

    setExportMenuOpen(
      false,
    )
  }

  /* =======================================================
     FICHE DONATEUR
     ======================================================= */

  if (
    selectedDonateur
  ) {
    return (
      <>
        <DonateurDetail
          donateur={
            selectedDonateur
          }
          commandes={
            commandes.filter(
              (commande) =>
                commande.donateurId ===
                selectedDonateur.id,
            )
          }
          onBack={() =>
            setSelectedDonateurId(
              null,
            )
          }
          onEdit={() =>
            openEditDonateur(
              selectedDonateur,
            )
          }
          onCreateCommande={() =>
            createCommande(
              selectedDonateur,
            )
          }
          onOpenCommande={
            openCommande
          }
        />

        {formOpen && (
          <DonateurModal
            mode={
              formMode
            }
            donateur={
              editingDonateur
            }
            donateurs={
              donateurs
            }
            onClose={() => {
              setFormOpen(
                false,
              )

              setEditingDonateur(
                null,
              )
            }}
            onSave={
              saveDonateur
            }
          />
        )}
      </>
    )
  }

  /* =======================================================
     LISTE PRINCIPALE
     ======================================================= */

  return (
    <div className="donateurs-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="donateurs-header">

        <div>

          <span className="donateurs-eyebrow">
            Base de données
          </span>

          <h1>
            Donateurs
          </h1>

          <p>
            Entreprises, organismes, associations, collectivités et partenaires liés à l'Opération Brioches.
          </p>

        </div>

        <button
          type="button"
          className="donateurs-primary-button"
          onClick={
            openCreateDonateur
          }
        >
          <Plus
            size={18}
          />

          Nouveau donateur
        </button>

      </header>

      {/* =================================================
          LISTE
      ================================================= */}

      <section className="donateurs-card">

        {/* ===============================================
            TOOLBAR
        =============================================== */}

        <div className="donateurs-toolbar">

          <div className="donateurs-search">

            <Search
              size={19}
            />

            <input
              type="text"
              placeholder="Rechercher un donateur, une ville, un contact..."
              value={
                search
              }
              onChange={(
                event,
              ) =>
                setSearch(
                  event.target.value,
                )
              }
            />

          </div>

          <select
            className="donateurs-select"
            value={
              typeFilter
            }
            onChange={(
              event,
            ) =>
              setTypeFilter(
                event.target.value,
              )
            }
          >
            {types.map(
              (type) => (
                <option
                  key={
                    type
                  }
                  value={
                    type
                  }
                >
                  {type}
                </option>
              ),
            )}
          </select>

          <div className="donateurs-export">

            <button
              type="button"
              className="donateurs-secondary-button donateurs-export-button"
              onClick={() =>
                setExportMenuOpen(
                  (current) =>
                    !current,
                )
              }
            >
              <Download
                size={17}
              />

              Exporter

              <ChevronDown
                size={15}
              />
            </button>

            {exportMenuOpen && (
              <div className="donateurs-export-menu">

                <button
                  type="button"
                  onClick={
                    exportExcel
                  }
                >
                  <FileSpreadsheet
                    size={18}
                  />

                  <div>

                    <strong>
                      Excel
                    </strong>

                    <span>
                      Vue actuelle
                    </span>

                  </div>

                </button>

                <button
                  type="button"
                  onClick={
                    exportPdf
                  }
                >
                  <FileDown
                    size={18}
                  />

                  <div>

                    <strong>
                      PDF
                    </strong>

                    <span>
                      Vue actuelle
                    </span>

                  </div>

                </button>

              </div>
            )}

          </div>

        </div>

        {/* ===============================================
            RESULTATS + PARAMÈTRES COLONNES
        =============================================== */}

        <div className="donateurs-results">

          <strong>
            {
              filteredDonateurs.length
            } donateur
            {filteredDonateurs.length >
            1
              ? 's'
              : ''}
          </strong>

          <div className="donateurs-results-right">

            <span>
              1 clic sur un libellé : trier • double-clic sur une ligne : ouvrir
            </span>

            <div className="donateurs-columns-wrapper">

              <button
                type="button"
                className="donateurs-columns-button"
                title="Personnaliser les colonnes"
                onClick={() =>
                  setColumnsMenuOpen(
                    (current) =>
                      !current,
                  )
                }
              >
                <Settings2
                  size={17}
                />
              </button>

              {columnsMenuOpen && (
                <div className="donateurs-columns-menu">

                  <div className="donateurs-columns-menu-header">

                    <strong>
                      Colonnes affichées
                    </strong>

                    <button
                      type="button"
                      onClick={
                        showAllColumns
                      }
                    >
                      Tout afficher
                    </button>

                  </div>

                  <ColumnToggle
                    label="Type"
                    checked={
                      visibleColumns.type
                    }
                    onChange={() =>
                      toggleColumn(
                        'type',
                      )
                    }
                  />

                  <ColumnToggle
                    label="Ville"
                    checked={
                      visibleColumns.ville
                    }
                    onChange={() =>
                      toggleColumn(
                        'ville',
                      )
                    }
                  />

                  <ColumnToggle
                    label="Contact"
                    checked={
                      visibleColumns.contact
                    }
                    onChange={() =>
                      toggleColumn(
                        'contact',
                      )
                    }
                  />

                  <ColumnToggle
                    label="Téléphone"
                    checked={
                      visibleColumns.telephone
                    }
                    onChange={() =>
                      toggleColumn(
                        'telephone',
                      )
                    }
                  />

                  <ColumnToggle
                    label="Email"
                    checked={
                      visibleColumns.email
                    }
                    onChange={() =>
                      toggleColumn(
                        'email',
                      )
                    }
                  />

                  <ColumnToggle
                    label="JDI"
                    checked={
                      visibleColumns.jdi
                    }
                    onChange={() =>
                      toggleColumn(
                        'jdi',
                      )
                    }
                  />

                  <ColumnToggle
                    label="JDP"
                    checked={
                      visibleColumns.jdp
                    }
                    onChange={() =>
                      toggleColumn(
                        'jdp',
                      )
                    }
                  />

                  <ColumnToggle
                    label="RF"
                    checked={
                      visibleColumns.rf
                    }
                    onChange={() =>
                      toggleColumn(
                        'rf',
                      )
                    }
                  />

                </div>
              )}

            </div>

          </div>

        </div>

        {/* ===============================================
            TABLEAU
        =============================================== */}

        <div className="donateurs-table-wrapper">

          <table className="donateurs-table">

            <thead>

              <tr>

                <SortableHeader
                  label="Code"
                  active={
                    sortKey ===
                    'code'
                  }
                  direction={
                    sortDirection
                  }
                  onClick={() =>
                    changeSort(
                      'code',
                    )
                  }
                />

                <SortableHeader
                  label="Nom / Raison sociale"
                  active={
                    sortKey ===
                    'nom'
                  }
                  direction={
                    sortDirection
                  }
                  onClick={() =>
                    changeSort(
                      'nom',
                    )
                  }
                />

                {visibleColumns.type && (
                  <SortableHeader
                    label="Type"
                    active={
                      sortKey ===
                      'type'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'type',
                      )
                    }
                  />
                )}

                {visibleColumns.ville && (
                  <SortableHeader
                    label="Ville"
                    active={
                      sortKey ===
                      'ville'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'ville',
                      )
                    }
                  />
                )}

                {visibleColumns.contact && (
                  <SortableHeader
                    label="Contact"
                    active={
                      sortKey ===
                      'contact'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'contact',
                      )
                    }
                  />
                )}

                {visibleColumns.telephone && (
                  <SortableHeader
                    label="Téléphone"
                    active={
                      sortKey ===
                      'telephone'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'telephone',
                      )
                    }
                  />
                )}

                {visibleColumns.email && (
                  <SortableHeader
                    label="Email"
                    active={
                      sortKey ===
                      'email'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'email',
                      )
                    }
                  />
                )}

                {visibleColumns.jdi && (
                  <SortableHeader
                    label="JDI"
                    active={
                      sortKey ===
                      'jdi'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'jdi',
                      )
                    }
                  />
                )}

                {visibleColumns.jdp && (
                  <SortableHeader
                    label="JDP"
                    active={
                      sortKey ===
                      'jdp'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'jdp',
                      )
                    }
                  />
                )}

                {visibleColumns.rf && (
                  <SortableHeader
                    label="RF"
                    active={
                      sortKey ===
                      'rf'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'rf',
                      )
                    }
                  />
                )}

                <th>
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredDonateurs.map(
                (donateur) => (
                  <tr
                    key={
                      donateur.id
                    }
                    onDoubleClick={() =>
                      openDonateur(
                        donateur,
                      )
                    }
                  >

                    <td className="donateur-code">
                      {formatDonateurCode(
                        donateur,
                      )}
                    </td>

                    <td>
                      <strong>
                        {
                          donateur.nom
                        }
                      </strong>
                    </td>

                    {visibleColumns.type && (
                      <td>

                        {donateur.type ? (
                          <span className="donateur-type">
                            {
                              donateur.type
                            }
                          </span>
                        ) : (
                          <span className="donateur-empty">
                            Non renseigné
                          </span>
                        )}

                      </td>
                    )}

                    {visibleColumns.ville && (
                      <td>
                        {
                          donateur.ville ||
                          '-'
                        }
                      </td>
                    )}

                    {visibleColumns.contact && (
                      <td>
                        {formatContact(
                          donateur,
                        ) || '-'}
                      </td>
                    )}

                    {visibleColumns.telephone && (
                      <td>
                        {
                          donateur.telephone ||
                          '-'
                        }
                      </td>
                    )}

                    {visibleColumns.email && (
                      <td>
                        {
                          donateur.email ||
                          '-'
                        }
                      </td>
                    )}

                    {visibleColumns.jdi && (
                      <td>
                        <BooleanBadge
                          value={
                            donateur.jdi
                          }
                        />
                      </td>
                    )}

                    {visibleColumns.jdp && (
                      <td>
                        <BooleanBadge
                          value={
                            donateur.jdp
                          }
                        />
                      </td>
                    )}

                    {visibleColumns.rf && (
                      <td>
                        <BooleanBadge
                          value={
                            donateur.rf
                          }
                        />
                      </td>
                    )}

                    <td>

                      <div className="donateurs-actions">

                        <button
                          type="button"
                          title="Voir la fiche"
                          onClick={() =>
                            openDonateur(
                              donateur,
                            )
                          }
                        >
                          <Eye
                            size={17}
                          />
                        </button>

                        <button
                          type="button"
                          title="Modifier"
                          onClick={() =>
                            openEditDonateur(
                              donateur,
                            )
                          }
                        >
                          <Pencil
                            size={17}
                          />
                        </button>

                        <div className="donateur-actions-menu-wrapper">

                          <button
                            type="button"
                            title="Plus"
                            onClick={() =>
                              setActionMenuId(
                                (
                                  current,
                                ) =>
                                  current ===
                                  donateur.id
                                    ? null
                                    : donateur.id,
                              )
                            }
                          >
                            <MoreVertical
                              size={17}
                            />
                          </button>

                          {actionMenuId ===
                            donateur.id && (
                            <div className="donateur-actions-menu">

                              <button
                                type="button"
                                onClick={() =>
                                  createCommande(
                                    donateur,
                                  )
                                }
                              >
                                <ShoppingCart
                                  size={17}
                                />

                                Faire une commande
                              </button>

                              <button
                                type="button"
                                className="danger"
                                onClick={() =>
                                  archiveDonateur(
                                    donateur,
                                  )
                                }
                              >
                                <Archive
                                  size={17}
                                />

                                Archiver
                              </button>

                            </div>
                          )}

                        </div>

                      </div>

                    </td>

                  </tr>
                ),
              )}

            </tbody>

          </table>

        </div>

      </section>

      {formOpen && (
        <DonateurModal
          mode={
            formMode
          }
          donateur={
            editingDonateur
          }
          donateurs={
            donateurs
          }
          onClose={() => {
            setFormOpen(
              false,
            )

            setEditingDonateur(
              null,
            )
          }}
          onSave={
            saveDonateur
          }
        />
      )}

    </div>
  )
}

/* =========================================================
   FICHE DONATEUR
   ========================================================= */

function DonateurDetail({
  donateur,
  commandes,
  onBack,
  onEdit,
  onCreateCommande,
  onOpenCommande,
}: {
  donateur:
    Donateur

  commandes:
    Commande[]

  onBack:
    () => void

  onEdit:
    () => void

  onCreateCommande:
    () => void

  onOpenCommande:
    (
      commandeId:
        number,
    ) => void
}) {
  const [
    tab,
    setTab,
  ] =
    useState<DetailTab>(
      'general',
    )

  const commandesTriees =
    useMemo(() => {
      return [
        ...commandes,
      ].sort(
        (a, b) =>
          b.dateCommande.localeCompare(
            a.dateCommande,
          ),
      )
    }, [
      commandes,
    ])

  const totalQuantite =
    commandes.reduce(
      (
        total,
        commande,
      ) =>
        total +
        commande.quantite,
      0,
    )

  const totalMontant =
    commandes.reduce(
      (
        total,
        commande,
      ) =>
        total +
        commande.quantite *
          commande.prixUnitaire,
      0,
    )

  return (
    <div className="donateurs-page">

      <button
        type="button"
        className="donateurs-back-button"
        onClick={
          onBack
        }
      >
        <ArrowLeft
          size={18}
        />

        Retour à la liste
      </button>

      <section className="donateur-profile">

        <div className="donateur-avatar">
          {getInitials(
            donateur.nom,
          )}
        </div>

        <div className="donateur-profile-info">

          <span className="donateurs-eyebrow">
            {formatDonateurCode(
              donateur,
            )}
          </span>

          <h1>
            {
              donateur.nom
            }
          </h1>

          <div className="donateur-profile-badges">

            {donateur.type && (
              <span>
                {
                  donateur.type
                }
              </span>
            )}

            <span className="active">
              Actif
            </span>

          </div>

        </div>

        <div
          style={{
            marginLeft:
              'auto',

            display:
              'flex',

            gap:
              '10px',

            flexWrap:
              'wrap',
          }}
        >

          <button
            type="button"
            className="donateurs-secondary-button"
            onClick={
              onEdit
            }
          >
            <Pencil
              size={17}
            />

            Modifier la fiche
          </button>

          <button
            type="button"
            className="donateurs-primary-button"
            onClick={
              onCreateCommande
            }
          >
            <ShoppingCart
              size={17}
            />

            Nouvelle commande
          </button>

        </div>

      </section>

      <nav className="donateur-tabs">

        {[
          [
            'general',
            'Vue générale',
          ],

          [
            'contacts',
            'Contacts',
          ],

          [
            'commandes',
            'Commandes',
          ],

          [
            'dons',
            'Dons',
          ],

          [
            'encaissements',
            'Encaissements',
          ],

          [
            'documents',
            'Documents',
          ],

          [
            'historique',
            'Historique',
          ],
        ].map(
          ([
            key,
            label,
          ]) => (
            <button
              type="button"
              key={
                key
              }
              className={
                tab === key
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setTab(
                  key as DetailTab,
                )
              }
            >
              {label}
            </button>
          ),
        )}

      </nav>

      {/* =================================================
          VUE GÉNÉRALE
      ================================================= */}

      {tab ===
        'general' && (
        <>

          <div className="donateur-kpi-grid">

            <div className="donateur-kpi">

              <ShoppingCart
                size={22}
              />

              <div>

                <strong>
                  {
                    commandes.length
                  }
                </strong>

                <span>
                  Commandes
                </span>

              </div>

            </div>

            <div className="donateur-kpi">

              <strong>
                {
                  totalQuantite
                }
              </strong>

              <span>
                Brioches commandées
              </span>

            </div>

            <div className="donateur-kpi">

              <strong>
                {formatMoney(
                  totalMontant,
                )}
              </strong>

              <span>
                Montant commandé
              </span>

            </div>

            <div className="donateur-kpi">

              <strong>
                {formatPaymentMethod(
                  donateur.modeReglement,
                )}
              </strong>

              <span>
                Mode de règlement
              </span>

            </div>

          </div>

          <div className="donateur-detail-grid">

            <section className="donateur-detail-card">

              <h2>
                <Building2
                  size={19}
                />

                Identité
              </h2>

              <InfoRow
                label="Code donateur"
                value={formatDonateurCode(
                  donateur,
                )}
              />

              <InfoRow
                label="Type"
                value={
                  donateur.type ||
                  'Non renseigné'
                }
              />

              <InfoRow
                label="Nom"
                value={
                  donateur.nom
                }
              />

            </section>

            <section className="donateur-detail-card">

              <h2>
                <MapPin
                  size={19}
                />

                Adresse
              </h2>

              <InfoRow
                label="N° de voie"
                value={
                  donateur.numeroVoie ||
                  '-'
                }
              />

              <InfoRow
                label="Adresse"
                value={
                  donateur.adresse ||
                  '-'
                }
              />

              <InfoRow
                label="Code postal"
                value={
                  donateur.cp ||
                  '-'
                }
              />

              <InfoRow
                label="Ville"
                value={
                  donateur.ville ||
                  '-'
                }
              />

              <InfoRow
                label="Informations"
                value={
                  donateur.informations ||
                  '-'
                }
              />

            </section>

            <section className="donateur-detail-card">

              <h2>
                <User
                  size={19}
                />

                Contact
              </h2>

              <InfoRow
                label="Nom"
                value={
                  donateur.contactNom ||
                  '-'
                }
              />

              <InfoRow
                label="Prénom"
                value={
                  donateur.contactPrenom ||
                  '-'
                }
              />

              <InfoRow
                label="Email"
                value={
                  donateur.email ||
                  '-'
                }
                icon={
                  <Mail
                    size={15}
                  />
                }
              />

              <InfoRow
                label="Téléphone"
                value={
                  donateur.telephone ||
                  '-'
                }
                icon={
                  <Phone
                    size={15}
                  />
                }
              />

            </section>

            <section className="donateur-detail-card">

              <h2>
                <ShoppingCart
                  size={19}
                />

                Opération Brioches
              </h2>

              <InfoRow
                label="Condition de règlement"
                value={
                  donateur.conditionReglement ||
                  '-'
                }
              />

              <InfoRow
                label="Mode de règlement"
                value={formatPaymentMethod(
                  donateur.modeReglement,
                )}
              />

              <InfoRow
                label="Nombre de commandes"
                value={String(
                  commandes.length,
                )}
              />

              <InfoRow
                label="Quantité totale"
                value={String(
                  totalQuantite,
                )}
              />

            </section>

          </div>

          <section className="donateur-detail-card donateur-documents-card">

            <h2>
              Suivi documentaire
            </h2>

            <div className="donateur-document-grid">

              <DocumentStatus
                label="JDI"
                value={
                  donateur.jdi
                }
              />

              <DocumentStatus
                label="JDP"
                value={
                  donateur.jdp
                }
              />

              <DocumentStatus
                label="RF"
                value={
                  donateur.rf
                }
              />

            </div>

          </section>

          {donateur.remarque && (
            <section className="donateur-detail-card">

              <h2>
                Remarque
              </h2>

              <p>
                {
                  donateur.remarque
                }
              </p>

            </section>
          )}

        </>
      )}

      {/* =================================================
          CONTACT
      ================================================= */}

      {tab ===
        'contacts' && (
        <section className="donateur-detail-card">

          <h2>
            <User
              size={19}
            />

            Contact principal
          </h2>

          <InfoRow
            label="Prénom"
            value={
              donateur.contactPrenom ||
              '-'
            }
          />

          <InfoRow
            label="Nom"
            value={
              donateur.contactNom ||
              '-'
            }
          />

          <InfoRow
            label="Téléphone"
            value={
              donateur.telephone ||
              '-'
            }
            icon={
              <Phone
                size={15}
              />
            }
          />

          <InfoRow
            label="Email"
            value={
              donateur.email ||
              '-'
            }
            icon={
              <Mail
                size={15}
              />
            }
          />

        </section>
      )}

      {/* =================================================
          COMMANDES
      ================================================= */}

      {tab ===
        'commandes' && (
        <section className="donateur-commandes">

          <div className="donateur-commandes-header">

            <div>

              <h2>
                Commandes
              </h2>

              <p>
                Commandes enregistrées pour {
                  donateur.nom
                }.
              </p>

            </div>

            <button
              type="button"
              className="donateurs-primary-button"
              onClick={
                onCreateCommande
              }
            >
              <Plus
                size={17}
              />

              Nouvelle commande
            </button>

          </div>

          <div className="donateur-commandes-kpis">

            <div>

              <span>
                Commandes
              </span>

              <strong>
                {
                  commandes.length
                }
              </strong>

            </div>

            <div>

              <span>
                Quantité
              </span>

              <strong>
                {
                  totalQuantite
                }
              </strong>

            </div>

            <div>

              <span>
                Montant
              </span>

              <strong>
                {formatMoney(
                  totalMontant,
                )}
              </strong>

            </div>

          </div>

          {commandesTriees.length ===
          0 ? (
            <div className="donateur-commandes-empty">

              <ShoppingCart
                size={36}
              />

              <strong>
                Aucune commande
              </strong>

              <span>
                Aucune commande n'est encore liée à ce donateur.
              </span>

              <button
                type="button"
                className="donateurs-primary-button"
                onClick={
                  onCreateCommande
                }
              >
                <Plus
                  size={17}
                />

                Créer une commande
              </button>

            </div>
          ) : (
            <div className="donateur-commandes-list">

              {commandesTriees.map(
                (commande) => (
                  <button
                    type="button"
                    key={
                      commande.id
                    }
                    className="donateur-commande-row"
                    onClick={() =>
                      onOpenCommande(
                        commande.id,
                      )
                    }
                  >

                    <div>

                      <span>
                        N° commande
                      </span>

                      <strong>
                        {
                          commande.numero
                        }
                      </strong>

                    </div>

                    <div>

                      <span>
                        Date
                      </span>

                      <strong>
                        {formatDate(
                          commande.dateCommande,
                        )}
                      </strong>

                    </div>

                    <div>

                      <span>
                        Quantité
                      </span>

                      <strong>
                        {
                          commande.quantite
                        }
                      </strong>

                    </div>

                    <div>

                      <span>
                        Montant
                      </span>

                      <strong>
                        {formatMoney(
                          commande.quantite *
                            commande.prixUnitaire,
                        )}
                      </strong>

                    </div>

                    <span
                      className={`donateur-commande-status ${commande.statut.toLowerCase()}`}
                    >
                      {getStatutLabel(
                        commande.statut,
                      )}
                    </span>

                  </button>
                ),
              )}

            </div>
          )}

        </section>
      )}

      {tab ===
        'dons' && (
        <EmptySection
          title="Dons"
          text="La gestion des dons sera reliée ici."
        />
      )}

      {tab ===
        'encaissements' && (
        <EmptySection
          title="Encaissements"
          text="Les encaissements du donateur seront affichés ici."
        />
      )}

      {tab ===
        'documents' && (
        <section className="donateur-detail-card donateur-documents-card">

          <h2>
            Documents
          </h2>

          <div className="donateur-document-grid">

            <DocumentStatus
              label="JDI"
              value={
                donateur.jdi
              }
            />

            <DocumentStatus
              label="JDP"
              value={
                donateur.jdp
              }
            />

            <DocumentStatus
              label="RF"
              value={
                donateur.rf
              }
            />

          </div>

        </section>
      )}

      {tab ===
        'historique' && (
        <EmptySection
          title="Historique"
          text="L'historique du donateur sera affiché ici."
        />
      )}

    </div>
  )
}

/* =========================================================
   MODALE DONATEUR
   ========================================================= */

function DonateurModal({
  mode,
  donateur,
  donateurs,
  onClose,
  onSave,
}: {
  mode:
    DonateurFormMode

  donateur:
    Donateur | null

  donateurs:
    Donateur[]

  onClose:
    () => void

  onSave:
    (
      donateur:
        Donateur,
    ) => void
}) {
  const [
    form,
    setForm,
  ] =
    useState<Donateur>(
      donateur
        ? {
            ...donateur,
          }
        : {
            ...EMPTY_DONATEUR,

            id:
              getNextDonateurId(
                donateurs,
              ),

            code:
              getNextDonateurCode(
                donateurs,
              ),
          },
    )

  const [
    error,
    setError,
  ] = useState('')

  function updateField<
    K extends keyof Donateur,
  >(
    key: K,
    value:
      Donateur[K],
  ) {
    setForm(
      (current) => ({
        ...current,

        [key]:
          value,
      }),
    )
  }

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')

    const name =
      form.nom.trim()

    const code =
      String(
        form.code,
      ).trim()

    if (
      !name
    ) {
      setError(
        'Le nom du donateur est obligatoire.',
      )

      return
    }

    if (
      !code
    ) {
      setError(
        'Le code donateur est obligatoire.',
      )

      return
    }

    const duplicate =
      donateurs.some(
        (item) =>
          String(
            item.code,
          ).trim() ===
            code &&
          item.id !==
            form.id,
      )

    if (
      duplicate
    ) {
      setError(
        'Ce code donateur existe déjà.',
      )

      return
    }

    onSave({
      ...form,

      nom:
        name,

      code,
    })
  }

  return (
    <div className="donateur-modal-overlay">

      <div className="donateur-modal">

        <header className="donateur-modal-header">

          <div>

            <span className="donateurs-eyebrow">
              Base de données
            </span>

            <h2>
              {mode ===
              'create'
                ? 'Nouveau donateur'
                : 'Modifier le donateur'}
            </h2>

          </div>

          <button
            type="button"
            className="donateur-modal-close"
            onClick={
              onClose
            }
          >
            <X
              size={22}
            />
          </button>

        </header>

        <form
          onSubmit={
            submit
          }
        >

          <div className="donateur-modal-content">

            <FormSection
              title="Informations générales"
            >

              <div className="donateur-form-grid">

                <FormField
                  label="Code"
                >
                  <input
                    value={
                      form.code
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'code',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Type"
                >
                  <select
                    value={
                      form.type
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'type',
                        event.target.value,
                      )
                    }
                  >
                    <option value="ENTREPRISE">
                      Entreprise
                    </option>

                    <option value="MAIRIE">
                      Mairie
                    </option>

                    <option value="ETABLISSEMENT">
                      Établissement
                    </option>

                    <option value="ASSOCIATION">
                      Association
                    </option>

                    <option value="PARTICULIER">
                      Particulier
                    </option>

                    <option value="AUTRE">
                      Autre
                    </option>

                  </select>
                </FormField>

                <FormField
                  label="Nom / Raison sociale"
                  wide
                >
                  <input
                    value={
                      form.nom
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'nom',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

              </div>

            </FormSection>

            <FormSection
              title="Adresse"
            >

              <div className="donateur-form-grid">

                <FormField
                  label="N° voie"
                >
                  <input
                    value={
                      form.numeroVoie ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'numeroVoie',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Adresse"
                >
                  <input
                    value={
                      form.adresse ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'adresse',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Code postal"
                >
                  <input
                    value={
                      form.cp ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'cp',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Ville"
                >
                  <input
                    value={
                      form.ville ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'ville',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

              </div>

            </FormSection>

            <FormSection
              title="Contact"
            >

              <div className="donateur-form-grid">

                <FormField
                  label="Prénom"
                >
                  <input
                    value={
                      form.contactPrenom ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'contactPrenom',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Nom"
                >
                  <input
                    value={
                      form.contactNom ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'contactNom',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Téléphone"
                >
                  <input
                    value={
                      form.telephone ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'telephone',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Email"
                >
                  <input
                    type="email"
                    value={
                      form.email ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'email',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

              </div>

            </FormSection>

            <FormSection
              title="Règlement & suivi"
            >

              <div className="donateur-form-grid">

                <FormField
                  label="Condition de règlement"
                >
                  <input
                    value={
                      form.conditionReglement ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'conditionReglement',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Mode de règlement"
                >
                  <select
                    value={
                      form.modeReglement ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'modeReglement',
                        event.target.value,
                      )
                    }
                  >

                    <option value="">
                      Non renseigné
                    </option>

                    <option value="VIREMENT">
                      Virement
                    </option>

                    <option value="CHEQUE">
                      Chèque
                    </option>

                    <option value="ESPECES">
                      Espèces
                    </option>

                    <option value="MANDAT">
                      Mandat administratif
                    </option>

                  </select>
                </FormField>

                <FormField
                  label="JDI"
                >
                  <YesNoSelect
                    value={
                      form.jdi
                    }
                    onChange={(
                      value,
                    ) =>
                      updateField(
                        'jdi',
                        value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="JDP"
                >
                  <YesNoSelect
                    value={
                      form.jdp
                    }
                    onChange={(
                      value,
                    ) =>
                      updateField(
                        'jdp',
                        value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="RF"
                >
                  <YesNoSelect
                    value={
                      form.rf
                    }
                    onChange={(
                      value,
                    ) =>
                      updateField(
                        'rf',
                        value,
                      )
                    }
                  />
                </FormField>

              </div>

            </FormSection>

            <FormSection
              title="Informations complémentaires"
            >

              <div className="donateur-form-grid">

                <FormField
                  label="Informations"
                  wide
                >
                  <textarea
                    rows={3}
                    value={
                      form.informations ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'informations',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Remarque"
                  wide
                >
                  <textarea
                    rows={4}
                    value={
                      form.remarque ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'remarque',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

              </div>

            </FormSection>

            {error && (
              <div className="donateur-form-error">
                {error}
              </div>
            )}

          </div>

          <footer className="donateur-modal-footer">

            <button
              type="button"
              className="donateurs-secondary-button"
              onClick={
                onClose
              }
            >
              Annuler
            </button>

            <button
              type="submit"
              className="donateurs-primary-button"
            >
              <Check
                size={18}
              />

              {mode ===
              'create'
                ? 'Créer le donateur'
                : 'Enregistrer'}
            </button>

          </footer>

        </form>

      </div>

    </div>
  )
}

/* =========================================================
   COMPOSANTS
   ========================================================= */

function ColumnToggle({
  label,
  checked,
  onChange,
}: {
  label:
    string

  checked:
    boolean

  onChange:
    () => void
}) {
  return (
    <label className="donateurs-column-toggle">

      <input
        type="checkbox"
        checked={
          checked
        }
        onChange={
          onChange
        }
      />

      <span>
        {label}
      </span>

    </label>
  )
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label:
    string

  active:
    boolean

  direction:
    SortDirection

  onClick:
    () => void
}) {
  return (
    <th
      onClick={
        onClick
      }
      style={{
        cursor:
          'pointer',

        userSelect:
          'none',
      }}
    >
      {label}

      {' '}

      <span
        style={{
          opacity:
            active
              ? 1
              : 0.35,
        }}
      >
        {active
          ? direction ===
            'asc'
            ? '↑'
            : '↓'
          : '↕'}
      </span>

    </th>
  )
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label:
    string

  value:
    string

  icon?:
    ReactNode
}) {
  return (
    <div className="donateur-info-row">

      <span>
        {label}
      </span>

      <strong>
        {icon}

        {value}
      </strong>

    </div>
  )
}

function BooleanBadge({
  value,
}: {
  value?:
    string
}) {
  const yes =
    value
      ?.toUpperCase() ===
    'OUI'

  return (
    <span
      className={`donateur-boolean ${
        yes
          ? 'yes'
          : 'no'
      }`}
    >
      {value ||
        'NON'}
    </span>
  )
}

function DocumentStatus({
  label,
  value,
}: {
  label:
    string

  value?:
    string
}) {
  const yes =
    value
      ?.toUpperCase() ===
    'OUI'

  return (
    <div className="donateur-document">

      <span>
        {label}
      </span>

      <strong
        className={
          yes
            ? 'yes'
            : 'no'
        }
      >
        {value ||
          'NON'}
      </strong>

    </div>
  )
}

function EmptySection({
  title,
  text,
}: {
  title:
    string

  text:
    string
}) {
  return (
    <section className="donateur-empty-section">

      <h2>
        {title}
      </h2>

      <p>
        {text}
      </p>

    </section>
  )
}

function FormSection({
  title,
  children,
}: {
  title:
    string

  children:
    ReactNode
}) {
  return (
    <section className="donateur-form-section">

      <h3>
        {title}
      </h3>

      {children}

    </section>
  )
}

function FormField({
  label,
  wide = false,
  children,
}: {
  label:
    string

  wide?:
    boolean

  children:
    ReactNode
}) {
  return (
    <label
      className={`donateur-form-field ${
        wide
          ? 'wide'
          : ''
      }`}
    >

      <span>
        {label}
      </span>

      {children}

    </label>
  )
}

function YesNoSelect({
  value,
  onChange,
}: {
  value?:
    string

  onChange:
    (
      value:
        string,
    ) => void
}) {
  return (
    <select
      value={
        value ||
        'NON'
      }
      onChange={(
        event,
      ) =>
        onChange(
          event.target.value,
        )
      }
    >

      <option value="NON">
        Non
      </option>

      <option value="OUI">
        Oui
      </option>

    </select>
  )
}

/* =========================================================
   HELPERS
   ========================================================= */

function getSortValue(
  donateur:
    Donateur,

  key:
    SortKey,
) {
  switch (
    key
  ) {
    case 'code':
      return String(
        donateur.code,
      )

    case 'nom':
      return (
        donateur.nom ||
        ''
      )

    case 'type':
      return (
        donateur.type ||
        ''
      )

    case 'ville':
      return (
        donateur.ville ||
        ''
      )

    case 'contact':
      return formatContact(
        donateur,
      )

    case 'telephone':
      return (
        donateur.telephone ||
        ''
      )

    case 'email':
      return (
        donateur.email ||
        ''
      )

    case 'jdi':
      return (
        donateur.jdi ||
        ''
      )

    case 'jdp':
      return (
        donateur.jdp ||
        ''
      )

    case 'rf':
      return (
        donateur.rf ||
        ''
      )

    default:
      return ''
  }
}

function formatContact(
  donateur:
    Donateur,
) {
  return [
    donateur.contactPrenom,
    donateur.contactNom,
  ]
    .filter(Boolean)
    .join(' ')
}

function formatDonateurCode(
  donateur:
    Donateur,
) {
  const code =
    String(
      donateur.code,
    )
      .replace(
        /^DON-/i,
        '',
      )
      .trim()

  return `DON-${code.padStart(
    6,
    '0',
  )}`
}

function formatPaymentMethod(
  value?:
    string,
) {
  switch (
    value
  ) {
    case 'VIREMENT':
      return 'Virement'

    case 'CHEQUE':
      return 'Chèque'

    case 'ESPECES':
      return 'Espèces'

    case 'MANDAT':
      return 'Mandat administratif'

    default:
      return (
        value ||
        '-'
      )
  }
}

function getStatutLabel(
  statut:
    StatutCommande,
) {
  switch (
    statut
  ) {
    case 'BROUILLON':
      return 'Brouillon'

    case 'CONFIRMEE':
      return 'Confirmée'

    case 'A_LIVRER':
      return 'À livrer'

    case 'LIVREE':
      return 'Livrée'

    case 'ANNULEE':
      return 'Annulée'

    default:
      return statut
  }
}

function formatMoney(
  value:
    number,
) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      style:
        'currency',

      currency:
        'EUR',
    },
  ).format(
    value,
  )
}

function formatDate(
  value:
    string,
) {
  if (
    !value
  ) {
    return '-'
  }

  const [
    year,
    month,
    day,
  ] =
    value.split(
      '-',
    )

  if (
    !year ||
    !month ||
    !day
  ) {
    return value
  }

  return `${day}/${month}/${year}`
}

function getInitials(
  name:
    string,
) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(
      0,
      2,
    )
    .map(
      (word) =>
        word.charAt(
          0,
        ),
    )
    .join('')
}

function getNextDonateurId(
  donateurs:
    Donateur[],
) {
  return (
    Math.max(
      0,

      ...donateurs.map(
        (donateur) =>
          donateur.id,
      ),
    ) + 1
  )
}

function getNextDonateurCode(
  donateurs:
    Donateur[],
) {
  const codes =
    donateurs
      .map(
        (donateur) =>
          Number(
            String(
              donateur.code,
            ).replace(
              /^DON-/i,
              '',
            ),
          ),
      )
      .filter(
        (
          value,
        ) =>
          Number.isFinite(
            value,
          ),
      )

  return String(
    Math.max(
      0,
      ...codes,
    ) + 1,
  )
}

function getFileDate() {
  const date =
    new Date()

  const year =
    date.getFullYear()

  const month =
    String(
      date.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    )

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    )

  return `${year}-${month}-${day}`
}

function downloadBlob(
  blob:
    Blob,

  filename:
    string,
) {
  const url =
    URL.createObjectURL(
      blob,
    )

  const link =
    document.createElement(
      'a',
    )

  link.href =
    url

  link.download =
    filename

  document.body.appendChild(
    link,
  )

  link.click()

  link.remove()

  URL.revokeObjectURL(
    url,
  )
}

export default Donateurs