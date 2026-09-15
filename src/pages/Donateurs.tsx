import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpDown,
  Building2,
  ChevronDown,
  Download,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Gift,
  History,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  User,
  Wallet,
  X,
} from 'lucide-react'

import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import './Donateurs.css'

/* =========================================================
   TYPES
   ========================================================= */

type Donateur = {
  id: number
  code: string
  type: string
  nom: string

  numeroVoie?: string
  adresse?: string
  cp?: string
  ville?: string
  informations?: string

  contactNom?: string
  contactPrenom?: string
  email?: string
  telephone?: string

  conditionReglement?: string
  modeReglement?: string

  jdi?: string
  jdp?: string
  rf?: string

  remarque?: string

  archive?: boolean
}

type TabId =
  | 'general'
  | 'contacts'
  | 'commandes'
  | 'dons'
  | 'encaissements'
  | 'documents'
  | 'historique'

type SortDirection =
  | 'asc'
  | 'desc'

type ColumnKey =
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

type SortConfig = {
  column: ColumnKey
  direction: SortDirection
}

/* =========================================================
   DONNÉES INITIALES
   ========================================================= */

const initialDonateurs: Donateur[] = [
  {
    id: 222,
    code: '222',
    type: 'ENTREPRISE',
    nom: 'MEUBLE FOISSEY',
    adresse: 'BP13',
    cp: '54302',
    ville: 'LUNEVILLE CEDEX',
    email: 'BATISCAL@GMAIL.COM',
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
    archive: false,
  },

  {
    id: 221,
    code: '221',
    type: 'ENTREPRISE',
    nom: 'LUNEDENT',
    numeroVoie: '72',
    adresse: "RUE D'ALSACE",
    cp: '54300',
    ville: 'LUNEVILLE',
    email: 'BATISCAL@GMAIL.COM',
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
    archive: false,
  },

  {
    id: 220,
    code: '220',
    type: 'ENTREPRISE',
    nom: 'RITH SARL',
    numeroVoie: '18',
    adresse: 'RUE DE POLOGNE',
    cp: '54300',
    ville: 'LUNEVILLE',
    email: 'BATISCAL@GMAIL.COM',
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
    archive: false,
  },

  {
    id: 219,
    code: '219',
    type: 'ENTREPRISE',
    nom: 'OPTIC CHIC',
    numeroVoie: '6',
    adresse: 'RUE CARNOT',
    cp: '54300',
    ville: 'LUNEVILLE',
    email: 'BATISCAL@GMAIL.COM',
    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
    archive: false,
  },

  {
    id: 218,
    code: '218',
    type: 'MAIRIE',
    nom: 'MAIRIE DE BRULEY',
    numeroVoie: '36',
    adresse: 'RUE VICTOR HUGO',
    cp: '54200',
    ville: 'BRULEY',
    contactNom: 'BUGNET',
    contactPrenom: 'MIREILLE',
    email: 'COMMUNE.DE.BRULEY@ORANGE.FR',
    conditionReglement: 'JUSTIFICATIF',
    modeReglement: 'VIREMENT',
    jdi: 'OUI',
    jdp: 'NON',
    rf: 'NON',
    archive: false,
  },

  {
    id: 139,
    code: '139',
    type: 'ENTREPRISE',
    nom: 'SCEA HARAUX',
    numeroVoie: '34',
    adresse: 'VAYRINGE',
    cp: '54000',
    ville: 'NANCY',
    informations: '8H-12H ET 14H-17H',
    contactNom: 'HARAUX',
    contactPrenom: 'FRANCIS',
    email: 'FRANCIS.HARAUX@WANADOO.FR',
    telephone: '06 87 89 95 74',
    conditionReglement: 'COMMANDE',
    modeReglement: 'VIREMENT',
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
    archive: false,
  },

  {
    id: 136,
    code: '136',
    type: 'ENTREPRISE',
    nom: 'OPCO SANTE',
    numeroVoie: '2',
    adresse: 'RUE JACQUES VILLERMAUX',
    cp: '54000',
    ville: 'NANCY',
    informations: '9H-12H ET 14H-16H45',
    contactNom: 'FELLRATH',
    contactPrenom: 'FREDERIC',
    email: 'LAURENCE.GIRARD@OPCO-SANTE.FR',
    telephone: '03 90 22 22 39',
    conditionReglement: 'JUSTIFICATIF',
    modeReglement: 'VIREMENT',
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
    archive: false,
  },

  {
    id: 124,
    code: '124',
    type: 'ENTREPRISE',
    nom: 'HOTEL IBIS STYLES NANCY CENTRE GARE',
    numeroVoie: '3',
    adresse: "RUE DE L'ARMEE PATTON",
    cp: '54000',
    ville: 'NANCY',
    informations: '24/24H',
    contactNom: 'GIRARD',
    contactPrenom: 'CHARLES',
    email: 'charles.girard@groupesphb.fr',
    telephone: '06 60 44 93 36',
    conditionReglement: 'SUR JUSTIFICATIF',
    modeReglement: 'VIREMENT',
    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
    archive: false,
  },
]

/* =========================================================
   PAGE PRINCIPALE
   ========================================================= */

function Donateurs() {
  const [
    donateurs,
    setDonateurs,
  ] = useState<Donateur[]>(
    initialDonateurs,
  )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    typeFilter,
    setTypeFilter,
  ] = useState('Tous')

  const [
    selectedDonateur,
    setSelectedDonateur,
  ] = useState<Donateur | null>(
    null,
  )

  const [
    selectedTab,
    setSelectedTab,
  ] = useState<TabId>(
    'general',
  )

  const [
    sortConfig,
    setSortConfig,
  ] = useState<SortConfig | null>(
    null,
  )

  const [
    activeColumnFilter,
    setActiveColumnFilter,
  ] = useState<ColumnKey | null>(
    null,
  )

  const [
    columnFilters,
    setColumnFilters,
  ] = useState<
    Partial<
      Record<ColumnKey, string>
    >
  >({})

  const [
    exportMenuOpen,
    setExportMenuOpen,
  ] = useState(false)

  const [
    newDonateurOpen,
    setNewDonateurOpen,
  ] = useState(false)

  const [
    editDonateur,
    setEditDonateur,
  ] = useState<Donateur | null>(
    null,
  )

  const [
    actionMenuId,
    setActionMenuId,
  ] = useState<number | null>(
    null,
  )

  /* =======================================================
     TYPES
     ======================================================= */

  const types = useMemo(() => {
    const values = donateurs
      .map(
        (donateur) =>
          donateur.type,
      )
      .filter(Boolean)

    return [
      'Tous',
      ...Array.from(
        new Set(values),
      ),
    ]
  }, [donateurs])

  /* =======================================================
     FILTRAGE + TRI
     ======================================================= */

  const filteredDonateurs =
    useMemo(() => {
      const normalizedSearch =
        search
          .toLowerCase()
          .trim()

      let result =
        donateurs.filter(
          (donateur) => {
            const searchableText = [
              donateur.code,
              donateur.nom,
              donateur.type,
              donateur.ville,
              donateur.contactNom,
              donateur.contactPrenom,
              donateur.email,
              donateur.telephone,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()

            const matchesSearch =
              normalizedSearch === '' ||
              searchableText.includes(
                normalizedSearch,
              )

            const matchesType =
              typeFilter === 'Tous' ||
              donateur.type ===
                typeFilter

            const matchesColumns =
              Object.entries(
                columnFilters,
              ).every(
                ([
                  column,
                  filterValue,
                ]) => {
                  if (
                    !filterValue?.trim()
                  ) {
                    return true
                  }

                  const value =
                    getColumnValue(
                      donateur,
                      column as ColumnKey,
                    )

                  return String(value)
                    .toLowerCase()
                    .includes(
                      filterValue
                        .toLowerCase()
                        .trim(),
                    )
                },
              )

            return (
              matchesSearch &&
              matchesType &&
              matchesColumns
            )
          },
        )

      if (sortConfig) {
        result = [
          ...result,
        ].sort(
          (a, b) => {
            const valueA =
              getColumnValue(
                a,
                sortConfig.column,
              )

            const valueB =
              getColumnValue(
                b,
                sortConfig.column,
              )

            if (
              typeof valueA ===
                'number' &&
              typeof valueB ===
                'number'
            ) {
              return sortConfig.direction ===
                'asc'
                ? valueA - valueB
                : valueB - valueA
            }

            const comparison =
              String(
                valueA,
              ).localeCompare(
                String(valueB),
                'fr',
                {
                  numeric: true,
                  sensitivity:
                    'base',
                },
              )

            return sortConfig.direction ===
              'asc'
              ? comparison
              : -comparison
          },
        )
      }

      return result
    }, [
      donateurs,
      search,
      typeFilter,
      columnFilters,
      sortConfig,
    ])

  /* =======================================================
     TRI
     ======================================================= */

  function handleSort(
    column: ColumnKey,
  ) {
    setSortConfig(
      (current) => {
        if (
          current?.column ===
          column
        ) {
          return {
            column,
            direction:
              current.direction ===
              'asc'
                ? 'desc'
                : 'asc',
          }
        }

        return {
          column,
          direction: 'asc',
        }
      },
    )
  }

  /* =======================================================
     FILTRES COLONNES
     ======================================================= */

  function updateColumnFilter(
    column: ColumnKey,
    value: string,
  ) {
    setColumnFilters(
      (current) => ({
        ...current,
        [column]: value,
      }),
    )
  }

  /* =======================================================
     MODIFICATION
     ======================================================= */

  function updateDonateur(
    updatedDonateur: Donateur,
  ) {
    setDonateurs(
      (current) =>
        current.map(
          (donateur) =>
            donateur.id ===
            updatedDonateur.id
              ? updatedDonateur
              : donateur,
        ),
    )

    if (
      selectedDonateur?.id ===
      updatedDonateur.id
    ) {
      setSelectedDonateur(
        updatedDonateur,
      )
    }

    setEditDonateur(null)
  }

  /* =======================================================
     ARCHIVAGE
     ======================================================= */

  function toggleArchive(
    donateur: Donateur,
  ) {
    const updatedDonateur: Donateur = {
      ...donateur,

      archive:
        !donateur.archive,
    }

    setDonateurs(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            donateur.id
              ? updatedDonateur
              : item,
        ),
    )

    if (
      selectedDonateur?.id ===
      donateur.id
    ) {
      setSelectedDonateur(
        updatedDonateur,
      )
    }

    setActionMenuId(null)
  }

  /* =======================================================
     COMMANDES
     ======================================================= */

  function openCommande(
    donateur: Donateur,
  ) {
    setSelectedTab(
      'commandes',
    )

    setSelectedDonateur(
      donateur,
    )

    setActionMenuId(null)
  }

  /* =======================================================
     EXPORT EXCEL
     ======================================================= */

  async function exportExcel() {
    const workbook =
      new ExcelJS.Workbook()

    workbook.creator =
      'Opération Brioches'

    workbook.created =
      new Date()

    const worksheet =
      workbook.addWorksheet(
        'Donateurs',
      )

    const exportDate =
      getExportDate()

    worksheet.columns = [
      {
        header: 'Code',
        key: 'code',
        width: 17,
      },

      {
        header:
          'Nom / Raison sociale',
        key: 'nom',
        width: 35,
      },

      {
        header: 'Type',
        key: 'type',
        width: 17,
      },

      {
        header: 'Ville',
        key: 'ville',
        width: 22,
      },

      {
        header: 'Contact',
        key: 'contact',
        width: 25,
      },

      {
        header: 'Téléphone',
        key: 'telephone',
        width: 18,
      },

      {
        header: 'Email',
        key: 'email',
        width: 36,
      },

      {
        header: 'JDI',
        key: 'jdi',
        width: 9,
      },

      {
        header: 'JDP',
        key: 'jdp',
        width: 9,
      },

      {
        header: 'RF',
        key: 'rf',
        width: 9,
      },

      {
        header: 'Statut',
        key: 'statut',
        width: 13,
      },
    ]

    filteredDonateurs.forEach(
      (donateur) => {
        worksheet.addRow({
          code:
            `DON-${donateur.code.padStart(
              6,
              '0',
            )}`,

          nom:
            donateur.nom,

          type:
            donateur.type || '',

          ville:
            donateur.ville || '',

          contact: [
            donateur.contactPrenom,
            donateur.contactNom,
          ]
            .filter(Boolean)
            .join(' '),

          telephone:
            donateur.telephone ||
            '',

          email:
            donateur.email || '',

          jdi:
            donateur.jdi || '',

          jdp:
            donateur.jdp || '',

          rf:
            donateur.rf || '',

          statut:
            donateur.archive
              ? 'ARCHIVÉ'
              : 'ACTIF',
        })
      },
    )

    const headerRow =
      worksheet.getRow(1)

    headerRow.height = 27

    headerRow.font = {
      bold: true,

      color: {
        argb: 'FFFFFFFF',
      },
    }

    headerRow.fill = {
      type: 'pattern',

      pattern: 'solid',

      fgColor: {
        argb: 'FF063B7C',
      },
    }

    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center',
    }

    worksheet.eachRow(
      {
        includeEmpty: false,
      },

      (
        row,
        rowNumber,
      ) => {
        row.eachCell(
          (cell) => {
            cell.border = {
              top: {
                style: 'thin',

                color: {
                  argb:
                    'FFE1E9F2',
                },
              },

              left: {
                style: 'thin',

                color: {
                  argb:
                    'FFE1E9F2',
                },
              },

              bottom: {
                style: 'thin',

                color: {
                  argb:
                    'FFE1E9F2',
                },
              },

              right: {
                style: 'thin',

                color: {
                  argb:
                    'FFE1E9F2',
                },
              },
            }

            if (
              rowNumber > 1
            ) {
              cell.alignment = {
                vertical:
                  'middle',

                wrapText: true,
              }
            }
          },
        )

        if (
          rowNumber > 1
        ) {
          row.height = 22
        }
      },
    )

    for (
      let rowNumber = 2;
      rowNumber <=
      worksheet.rowCount;
      rowNumber++
    ) {
      const row =
        worksheet.getRow(
          rowNumber,
        )

      const donateur =
        filteredDonateurs[
          rowNumber - 2
        ]

      if (
        donateur?.archive
      ) {
        row.eachCell(
          (cell) => {
            cell.fill = {
              type: 'pattern',

              pattern: 'solid',

              fgColor: {
                argb:
                  'FFFFE9EA',
              },
            }

            cell.font = {
              color: {
                argb:
                  'FFB12C38',
              },
            }
          },
        )
      } else if (
        rowNumber % 2 ===
        0
      ) {
        row.eachCell(
          (cell) => {
            cell.fill = {
              type: 'pattern',

              pattern: 'solid',

              fgColor: {
                argb:
                  'FFF8FAFC',
              },
            }
          },
        )
      }
    }

    worksheet.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },

      to: {
        row: 1,
        column: 11,
      },
    }

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 1,
      },
    ]

    worksheet.pageSetup = {
      orientation:
        'landscape',

      paperSize: 9,

      fitToPage: true,

      fitToWidth: 1,

      fitToHeight: 0,

      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.4,
        bottom: 0.55,
        header: 0.2,
        footer: 0.25,
      },
    }

    worksheet.pageSetup.printTitlesRow =
      '1:1'

    worksheet.headerFooter = {
      oddFooter:
        `&CExport du ${exportDate}`,

      evenFooter:
        `&CExport du ${exportDate}`,

      firstFooter:
        `&CExport du ${exportDate}`,
    }

    const buffer =
      await workbook.xlsx.writeBuffer()

    const blob =
      new Blob(
        [buffer],
        {
          type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      )

    downloadBlob(
      blob,
      `Donateurs_${getFileDate()}.xlsx`,
    )

    setExportMenuOpen(false)
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

    const exportDate =
      getExportDate()

    const pageWidth =
      doc.internal.pageSize.getWidth()

    doc.setFont(
      'helvetica',
      'bold',
    )

    doc.setFontSize(15)

    doc.setTextColor(
      6,
      59,
      124,
    )

    doc.text(
      'Liste des donateurs',
      7,
      10,
    )

    doc.setFont(
      'helvetica',
      'normal',
    )

    doc.setFontSize(7)

    doc.setTextColor(
      102,
      130,
      165,
    )

    doc.text(
      `${filteredDonateurs.length} donateur${
        filteredDonateurs.length >
        1
          ? 's'
          : ''
      }`,
      7,
      15,
    )

    const rows =
      filteredDonateurs.map(
        (donateur) => [
          `DON-${donateur.code.padStart(
            6,
            '0',
          )}`,

          donateur.nom,

          donateur.type || '',

          donateur.ville || '',

          [
            donateur.contactPrenom,
            donateur.contactNom,
          ]
            .filter(Boolean)
            .join(' '),

          donateur.telephone ||
            '',

          donateur.email || '',

          donateur.jdi || '',

          donateur.jdp || '',

          donateur.rf || '',

          donateur.archive
            ? 'ARCHIVÉ'
            : 'ACTIF',
        ],
      )

    autoTable(
      doc,
      {
        startY: 19,

        head: [[
          'Code',
          'Nom / Raison sociale',
          'Type',
          'Ville',
          'Contact',
          'Téléphone',
          'Email',
          'JDI',
          'JDP',
          'RF',
          'Statut',
        ]],

        body: rows,

        theme: 'grid',

        margin: {
          top: 7,
          left: 4,
          right: 4,
          bottom: 13,
        },

        styles: {
          font: 'helvetica',

          fontSize: 5.4,

          cellPadding: 1.2,

          overflow:
            'linebreak',

          valign: 'middle',

          lineColor: [
            225,
            233,
            242,
          ],

          lineWidth: 0.15,

          textColor: [
            6,
            59,
            124,
          ],
        },

        headStyles: {
          fillColor: [
            6,
            59,
            124,
          ],

          textColor: [
            255,
            255,
            255,
          ],

          fontStyle: 'bold',

          halign: 'center',
        },

        showHead:
          'everyPage',

        didParseCell: (
          data,
        ) => {
          if (
            data.section ===
              'body' &&
            filteredDonateurs[
              data.row.index
            ]?.archive
          ) {
            data.cell.styles.fillColor =
              [
                255,
                233,
                234,
              ]

            data.cell.styles.textColor =
              [
                177,
                44,
                56,
              ]
          }
        },

        didDrawPage: (
          data,
        ) => {
          const pageHeight =
            doc.internal.pageSize.getHeight()

          doc.setFont(
            'helvetica',
            'normal',
          )

          doc.setFontSize(7)

          doc.setTextColor(
            102,
            130,
            165,
          )

          doc.text(
            `Export du ${exportDate}`,
            pageWidth / 2,
            pageHeight - 5,
            {
              align:
                'center',
            },
          )

          doc.text(
            `Page ${data.pageNumber}`,
            pageWidth - 7,
            pageHeight - 5,
            {
              align:
                'right',
            },
          )
        },
      },
    )

    doc.save(
      `Donateurs_${getFileDate()}.pdf`,
    )

    setExportMenuOpen(false)
  }

  /* =======================================================
     FICHE DONATEUR
     ======================================================= */

  if (selectedDonateur) {
    return (
      <>
        <DonateurDetail
          donateur={
            selectedDonateur
          }
          initialTab={
            selectedTab
          }
          onBack={() => {
            setSelectedDonateur(
              null,
            )

            setSelectedTab(
              'general',
            )
          }}
          onEdit={() =>
            setEditDonateur(
              selectedDonateur,
            )
          }
        />

        {editDonateur && (
          <DonateurFormModal
            mode="edit"
            donateur={
              editDonateur
            }
            donateurs={
              donateurs
            }
            onClose={() =>
              setEditDonateur(
                null,
              )
            }
            onSave={
              updateDonateur
            }
          />
        )}
      </>
    )
  }

  /* =======================================================
     LISTE
     ======================================================= */

  return (
    <div className="donateurs-page">

      <header className="donateurs-header">

        <div>

          <span className="donateurs-eyebrow">
            Base de données
          </span>

          <h1>
            Donateurs
          </h1>

          <p>
            Entreprises,
            organismes,
            associations,
            collectivités et
            partenaires liés à
            l'Opération Brioches.
          </p>

        </div>

        <button
          type="button"
          className="donateurs-primary-button"
          onClick={() =>
            setNewDonateurOpen(
              true,
            )
          }
        >
          <Plus size={18} />

          Nouveau donateur
        </button>

      </header>

      <section className="donateurs-card">

        <div className="donateurs-toolbar">

          <div className="donateurs-search">

            <Search size={18} />

            <input
              type="text"
              placeholder="Rechercher un donateur, une ville, un contact..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
            />

          </div>

          <select
            className="donateurs-select"
            value={typeFilter}
            onChange={(event) =>
              setTypeFilter(
                event.target.value,
              )
            }
          >
            {types.map(
              (type) => (
                <option
                  key={type}
                  value={type}
                >
                  {type}
                </option>
              ),
            )}
          </select>

          <div className="donateurs-export">

            <button
              type="button"
              className="donateurs-secondary-button"
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
                size={14}
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
                      Fichier .xlsx
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
                      A4 paysage
                    </span>
                  </div>
                </button>

              </div>
            )}

          </div>

        </div>

        <div className="donateurs-results">

          <strong>
            {
              filteredDonateurs.length
            }{' '}
            donateur
            {filteredDonateurs.length >
            1
              ? 's'
              : ''}
          </strong>

          <span>
            1 clic sur un libellé :
            trier • double-clic :
            filtrer
          </span>

        </div>

        <div className="donateurs-table-wrapper">

          <table className="donateurs-table">

            <thead>
              <tr>

                <SortableHeader
                  label="Code"
                  column="code"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.code ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'code',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="Nom / Raison sociale"
                  column="nom"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.nom ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'nom',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="Type"
                  column="type"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.type ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'type',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="Ville"
                  column="ville"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.ville ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'ville',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="Contact"
                  column="contact"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.contact ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'contact',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="Téléphone"
                  column="telephone"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.telephone ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'telephone',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="Email"
                  column="email"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.email ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'email',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="JDI"
                  column="jdi"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.jdi ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'jdi',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="JDP"
                  column="jdp"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.jdp ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'jdp',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <SortableHeader
                  label="RF"
                  column="rf"
                  sortConfig={
                    sortConfig
                  }
                  activeFilter={
                    activeColumnFilter
                  }
                  filterValue={
                    columnFilters.rf ||
                    ''
                  }
                  onSort={
                    handleSort
                  }
                  onFilterOpen={
                    setActiveColumnFilter
                  }
                  onFilterChange={(
                    value,
                  ) =>
                    updateColumnFilter(
                      'rf',
                      value,
                    )
                  }
                  onFilterClose={() =>
                    setActiveColumnFilter(
                      null,
                    )
                  }
                />

                <th />

              </tr>
            </thead>

            <tbody>

              {filteredDonateurs.map(
                (donateur) => (
                  <tr
                    key={
                      donateur.id
                    }
                    className={
                      donateur.archive
                        ? 'donateur-row-archived'
                        : ''
                    }
                    onClick={() => {
                      setSelectedTab(
                        'general',
                      )

                      setSelectedDonateur(
                        donateur,
                      )
                    }}
                  >

                    <td className="donateur-code">
                      DON-
                      {donateur.code.padStart(
                        6,
                        '0',
                      )}
                    </td>

                    <td>
                      <strong>
                        {
                          donateur.nom
                        }
                      </strong>
                    </td>

                    <td>

                      <div className="donateur-type-wrapper">

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

                        {donateur.archive && (
                          <span className="donateur-archive-badge">
                            Archivé
                          </span>
                        )}

                      </div>

                    </td>

                    <td>
                      {donateur.ville ||
                        '-'}
                    </td>

                    <td>
                      {[
                        donateur.contactPrenom,
                        donateur.contactNom,
                      ]
                        .filter(Boolean)
                        .join(' ') ||
                        '-'}
                    </td>

                    <td>
                      {donateur.telephone ||
                        '-'}
                    </td>

                    <td>
                      {donateur.email ||
                        '-'}
                    </td>

                    <td>
                      <BooleanBadge
                        value={
                          donateur.jdi
                        }
                      />
                    </td>

                    <td>
                      <BooleanBadge
                        value={
                          donateur.jdp
                        }
                      />
                    </td>

                    <td>
                      <BooleanBadge
                        value={
                          donateur.rf
                        }
                      />
                    </td>

                    <td>

                      <div
                        className="donateurs-actions"
                        onClick={(
                          event,
                        ) =>
                          event.stopPropagation()
                        }
                      >

                        <button
                          type="button"
                          title="Voir la fiche"
                          onClick={() => {
                            setSelectedTab(
                              'general',
                            )

                            setSelectedDonateur(
                              donateur,
                            )
                          }}
                        >
                          <Eye
                            size={16}
                          />
                        </button>

                        <button
                          type="button"
                          title="Modifier"
                          onClick={() => {
                            setEditDonateur(
                              donateur,
                            )

                            setActionMenuId(
                              null,
                            )
                          }}
                        >
                          <Pencil
                            size={16}
                          />
                        </button>

                        <div className="donateur-actions-menu-wrapper">

                          <button
                            type="button"
                            title="Plus d'actions"
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
                              size={16}
                            />
                          </button>

                          {actionMenuId ===
                            donateur.id && (
                            <div className="donateur-actions-menu">

                              <button
                                type="button"
                                onClick={() =>
                                  openCommande(
                                    donateur,
                                  )
                                }
                              >
                                <ShoppingCart
                                  size={15}
                                />

                                Faire une commande
                              </button>

                              <button
                                type="button"
                                className={
                                  donateur.archive
                                    ? 'restore'
                                    : 'archive'
                                }
                                onClick={() =>
                                  toggleArchive(
                                    donateur,
                                  )
                                }
                              >
                                {donateur.archive ? (
                                  <RotateCcw
                                    size={15}
                                  />
                                ) : (
                                  <Archive
                                    size={15}
                                  />
                                )}

                                {donateur.archive
                                  ? 'Réactiver la fiche'
                                  : 'Archiver la fiche'}
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

      {newDonateurOpen && (
        <DonateurFormModal
          mode="create"
          donateurs={
            donateurs
          }
          onClose={() =>
            setNewDonateurOpen(
              false,
            )
          }
          onSave={(
            newDonateur,
          ) => {
            setDonateurs(
              (current) => [
                newDonateur,
                ...current,
              ],
            )

            setNewDonateurOpen(
              false,
            )

            setSelectedTab(
              'general',
            )

            setSelectedDonateur(
              newDonateur,
            )
          }}
        />
      )}

      {editDonateur && (
        <DonateurFormModal
          mode="edit"
          donateur={
            editDonateur
          }
          donateurs={
            donateurs
          }
          onClose={() =>
            setEditDonateur(
              null,
            )
          }
          onSave={
            updateDonateur
          }
        />
      )}

    </div>
  )
}

/* =========================================================
   FORMULAIRE DONATEUR
   ========================================================= */

function DonateurFormModal({
  mode,
  donateur,
  donateurs,
  onClose,
  onSave,
}: {
  mode: 'create' | 'edit'
  donateur?: Donateur
  donateurs: Donateur[]
  onClose: () => void
  onSave: (
    donateur: Donateur,
  ) => void
}) {
  const nextCode =
    Math.max(
      0,
      ...donateurs.map(
        (item) =>
          Number(
            item.code,
          ) || 0,
      ),
    ) + 1

  const [
    form,
    setForm,
  ] = useState<Donateur>(
    mode === 'edit' &&
      donateur
      ? {
          ...donateur,
        }
      : {
          id: nextCode,

          code:
            String(nextCode),

          type:
            'ENTREPRISE',

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

          conditionReglement:
            '',

          modeReglement:
            '',

          jdi: 'NON',
          jdp: 'NON',
          rf: 'NON',

          remarque: '',

          archive: false,
        },
  )

  const [
    error,
    setError,
  ] = useState('')

  const duplicateDonateur =
    useMemo(
      () =>
        findDuplicateDonateur(
          form,
          donateurs,
          mode === 'edit'
            ? form.id
            : undefined,
        ),
      [
        form,
        donateurs,
        mode,
      ],
    )

  function updateField<
    K extends keyof Donateur,
  >(
    field: K,
    value: Donateur[K],
  ) {
    setForm(
      (current) => ({
        ...current,

        [field]: value,
      }),
    )

    if (error) {
      setError('')
    }
  }

  function handleSubmit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.nom.trim()) {
      setError(
        'Le nom ou la raison sociale est obligatoire.',
      )

      return
    }

    if (!form.type.trim()) {
      setError(
        'Le type de donateur est obligatoire.',
      )

      return
    }

    if (duplicateDonateur) {
      setError(
        `Ce donateur semble déjà exister : ${duplicateDonateur.nom} — DON-${duplicateDonateur.code.padStart(
          6,
          '0',
        )}.`,
      )

      return
    }

    onSave({
      ...form,

      nom:
        form.nom
          .trim()
          .toUpperCase(),

      ville:
        form.ville
          ?.trim()
          .toUpperCase() ||
        '',

      contactNom:
        form.contactNom
          ?.trim()
          .toUpperCase() ||
        '',

      contactPrenom:
        form.contactPrenom
          ?.trim() ||
        '',

      email:
        form.email
          ?.trim() ||
        '',

      telephone:
        form.telephone
          ?.trim() ||
        '',

      adresse:
        form.adresse
          ?.trim() ||
        '',

      numeroVoie:
        form.numeroVoie
          ?.trim() ||
        '',

      cp:
        form.cp
          ?.trim() ||
        '',

      informations:
        form.informations
          ?.trim() ||
        '',

      remarque:
        form.remarque
          ?.trim() ||
        '',
    })
  }

  return (
    <div
      className="donateur-modal-overlay"
      onMouseDown={(
        event,
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose()
        }
      }}
    >

      <div className="donateur-modal">

        <header className="donateur-modal-header">

          <div>

            <span className="donateurs-eyebrow">
              Base de données
            </span>

            <h2>
              {mode === 'create'
                ? 'Nouveau donateur'
                : 'Modifier le donateur'}
            </h2>

            <p>
              {mode === 'create'
                ? "Création d'une nouvelle fiche donateur ou organisation."
                : `Modification de ${form.nom}.`}
            </p>

          </div>

          <button
            type="button"
            className="donateur-modal-close"
            onClick={
              onClose
            }
            title="Fermer"
          >
            <X size={19} />
          </button>

        </header>

        <form
          onSubmit={
            handleSubmit
          }
        >

          <div className="donateur-modal-content">

            {/* IDENTITÉ */}

            <section className="donateur-form-section">

              <div className="donateur-form-section-title">

                <div className="donateur-form-section-icon">
                  <Building2
                    size={18}
                  />
                </div>

                <div>
                  <h3>
                    Identité
                  </h3>

                  <p>
                    Informations principales
                    de l'organisation.
                  </p>
                </div>

              </div>

              <div className="donateur-form-grid">

                <FormField
                  label="Code donateur"
                >
                  <input
                    value={`DON-${form.code.padStart(
                      6,
                      '0',
                    )}`}
                    disabled
                  />
                </FormField>

                <FormField
                  label="Type"
                  required
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

                    <option value="STRUCTURE">
                      Structure
                    </option>

                    <option value="ASSOCIATION">
                      Association
                    </option>

                    <option value="ORGANISME">
                      Organisme
                    </option>

                    <option value="AUTRE">
                      Autre
                    </option>
                  </select>
                </FormField>

                <FormField
                  label="Nom / Raison sociale"
                  required
                  wide
                >
                  <input
                    value={
                      form.nom
                    }
                    placeholder="Ex. DUPONT SARL"
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

            </section>

            {/* DOUBLON */}

            {duplicateDonateur && (
              <div className="donateur-duplicate-warning">

                <div className="donateur-duplicate-warning-icon">
                  <Search
                    size={19}
                  />
                </div>

                <div className="donateur-duplicate-warning-content">

                  <strong>
                    Donateur potentiellement déjà existant
                  </strong>

                  <p>
                    {
                      duplicateDonateur.nom
                    }

                    {' • '}

                    DON-
                    {duplicateDonateur.code.padStart(
                      6,
                      '0',
                    )}

                    {duplicateDonateur.ville
                      ? ` • ${duplicateDonateur.ville}`
                      : ''}
                  </p>

                  <span>
                    Vérifie cette fiche avant
                    d'enregistrer.
                  </span>

                </div>

              </div>
            )}

            {/* ADRESSE */}

            <section className="donateur-form-section">

              <div className="donateur-form-section-title">

                <div className="donateur-form-section-icon">
                  <MapPin
                    size={18}
                  />
                </div>

                <div>
                  <h3>
                    Adresse
                  </h3>

                  <p>
                    Adresse principale
                    du donateur.
                  </p>
                </div>

              </div>

              <div className="donateur-form-grid">

                <FormField
                  label="N° de voie"
                >
                  <input
                    value={
                      form.numeroVoie
                    }
                    placeholder="Ex. 24"
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
                  wide
                >
                  <input
                    value={
                      form.adresse
                    }
                    placeholder="Rue, avenue, lieu-dit..."
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
                      form.cp
                    }
                    placeholder="54000"
                    maxLength={5}
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
                      form.ville
                    }
                    placeholder="Nancy"
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

                <FormField
                  label="Informations / Horaires"
                  wide
                >
                  <input
                    value={
                      form.informations
                    }
                    placeholder="Ex. 8h-12h / 14h-17h"
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

              </div>

            </section>

            {/* CONTACT */}

            <section className="donateur-form-section">

              <div className="donateur-form-section-title">

                <div className="donateur-form-section-icon">
                  <User
                    size={18}
                  />
                </div>

                <div>
                  <h3>
                    Contact principal
                  </h3>

                  <p>
                    Personne référente
                    pour cette organisation.
                  </p>
                </div>

              </div>

              <div className="donateur-form-grid">

                <FormField
                  label="Prénom"
                >
                  <input
                    value={
                      form.contactPrenom
                    }
                    placeholder="Prénom"
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
                      form.contactNom
                    }
                    placeholder="Nom"
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
                  label="Email"
                >
                  <input
                    type="email"
                    value={
                      form.email
                    }
                    placeholder="contact@exemple.fr"
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

                <FormField
                  label="Téléphone"
                >
                  <input
                    type="tel"
                    value={
                      form.telephone
                    }
                    placeholder="06 00 00 00 00"
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

              </div>

            </section>

            {/* PARAMÈTRES OB */}

            <section className="donateur-form-section">

              <div className="donateur-form-section-title">

                <div className="donateur-form-section-icon">
                  <FileText
                    size={18}
                  />
                </div>

                <div>
                  <h3>
                    Paramètres Opération Brioches
                  </h3>

                  <p>
                    Paramètres administratifs
                    utilisés lors des opérations.
                  </p>
                </div>

              </div>

              <div className="donateur-form-grid">

                <FormField
                  label="Condition de règlement"
                >
                  <input
                    value={
                      form.conditionReglement
                    }
                    placeholder="Commande, justificatif..."
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
                      form.modeReglement
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

                    <option value="TPE">
                      TPE
                    </option>

                    <option value="AUTRE">
                      Autre
                    </option>
                  </select>
                </FormField>

                <FormField
                  label="JDI"
                >
                  <select
                    value={
                      form.jdi
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'jdi',
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
                </FormField>

                <FormField
                  label="JDP"
                >
                  <select
                    value={
                      form.jdp
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'jdp',
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
                </FormField>

                <FormField
                  label="RF"
                >
                  <select
                    value={
                      form.rf
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'rf',
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
                </FormField>

                <FormField
                  label="Remarque"
                  wide
                >
                  <textarea
                    rows={4}
                    value={
                      form.remarque
                    }
                    placeholder="Ajouter une remarque..."
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

            </section>

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
              disabled={
                Boolean(
                  duplicateDonateur,
                )
              }
            >
              {mode === 'create' ? (
                <Plus
                  size={17}
                />
              ) : (
                <Pencil
                  size={17}
                />
              )}

              {mode === 'create'
                ? 'Créer le donateur'
                : 'Enregistrer les modifications'}
            </button>

          </footer>

        </form>

      </div>

    </div>
  )
}

/* =========================================================
   HEADER TRIABLE / FILTRABLE
   ========================================================= */

function SortableHeader({
  label,
  column,
  sortConfig,
  activeFilter,
  filterValue,
  onSort,
  onFilterOpen,
  onFilterChange,
  onFilterClose,
}: {
  label: string
  column: ColumnKey
  sortConfig: SortConfig | null
  activeFilter: ColumnKey | null
  filterValue: string

  onSort: (
    column: ColumnKey,
  ) => void

  onFilterOpen: (
    column: ColumnKey,
  ) => void

  onFilterChange: (
    value: string,
  ) => void

  onFilterClose: () => void
}) {
  const clickTimer =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(null)

  const isSorted =
    sortConfig?.column ===
    column

  const filterOpen =
    activeFilter ===
    column

  function handleClick() {
    if (
      clickTimer.current
    ) {
      clearTimeout(
        clickTimer.current,
      )
    }

    clickTimer.current =
      setTimeout(() => {
        onSort(column)

        clickTimer.current =
          null
      }, 220)
  }

  function handleDoubleClick() {
    if (
      clickTimer.current
    ) {
      clearTimeout(
        clickTimer.current,
      )

      clickTimer.current =
        null
    }

    onFilterOpen(column)
  }

  return (
    <th
      className={
        filterValue
          ? 'donateurs-sortable-header filtered'
          : 'donateurs-sortable-header'
      }
    >

      <button
        type="button"
        className="donateurs-header-button"
        onClick={
          handleClick
        }
        onDoubleClick={
          handleDoubleClick
        }
        title="1 clic : trier • double-clic : filtrer"
      >

        <span>
          {label}
        </span>

        {isSorted ? (
          sortConfig.direction ===
          'asc' ? (
            <ArrowUp
              size={12}
            />
          ) : (
            <ArrowDown
              size={12}
            />
          )
        ) : (
          <ArrowUpDown
            size={12}
          />
        )}

        {filterValue && (
          <span className="donateurs-filter-dot" />
        )}

      </button>

      {filterOpen && (
        <div
          className="donateurs-column-filter"
          onClick={(
            event,
          ) =>
            event.stopPropagation()
          }
        >

          <input
            autoFocus
            value={
              filterValue
            }
            placeholder={`Filtrer ${label.toLowerCase()}...`}
            onChange={(
              event,
            ) =>
              onFilterChange(
                event.target.value,
              )
            }
          />

          <button
            type="button"
            title="Effacer le filtre"
            onClick={() => {
              onFilterChange('')
              onFilterClose()
            }}
          >
            <X
              size={13}
            />
          </button>

        </div>
      )}

    </th>
  )
}

/* =========================================================
   FICHE DONATEUR
   ========================================================= */

function DonateurDetail({
  donateur,
  initialTab = 'general',
  onBack,
  onEdit,
}: {
  donateur: Donateur
  initialTab?: TabId
  onBack: () => void
  onEdit: () => void
}) {
  const [
    tab,
    setTab,
  ] = useState<TabId>(
    initialTab,
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

      <section
        className={`donateur-profile ${
          donateur.archive
            ? 'archived'
            : ''
        }`}
      >

        <div className="donateur-avatar">
          {getInitials(
            donateur.nom,
          )}
        </div>

        <div className="donateur-profile-info">

          <span className="donateurs-eyebrow">
            Donateur / Organisation
          </span>

          <h1>
            {donateur.nom}
          </h1>

          <div className="donateur-profile-badges">

            {donateur.type && (
              <span>
                {donateur.type}
              </span>
            )}

            {donateur.archive ? (
              <span className="donateur-archive-badge">
                Archivé
              </span>
            ) : (
              <span className="active">
                Donateur actif
              </span>
            )}

          </div>

          <p className="donateur-profile-code">
            Code : DON-
            {donateur.code.padStart(
              6,
              '0',
            )}
          </p>

        </div>

        <button
          type="button"
          className="donateurs-primary-button"
          onClick={
            onEdit
          }
        >
          <Pencil
            size={17}
          />

          Modifier la fiche
        </button>

      </section>

      <nav className="donateur-tabs">

        <TabButton
          tab="general"
          currentTab={tab}
          onClick={
            setTab
          }
        >
          Vue générale
        </TabButton>

        <TabButton
          tab="contacts"
          currentTab={tab}
          onClick={
            setTab
          }
        >
          Contacts
        </TabButton>

        <TabButton
          tab="commandes"
          currentTab={tab}
          onClick={
            setTab
          }
        >
          Commandes
        </TabButton>

        <TabButton
          tab="dons"
          currentTab={tab}
          onClick={
            setTab
          }
        >
          Dons
        </TabButton>

        <TabButton
          tab="encaissements"
          currentTab={tab}
          onClick={
            setTab
          }
        >
          Encaissements
        </TabButton>

        <TabButton
          tab="documents"
          currentTab={tab}
          onClick={
            setTab
          }
        >
          Documents
        </TabButton>

        <TabButton
          tab="historique"
          currentTab={tab}
          onClick={
            setTab
          }
        >
          Historique
        </TabButton>

      </nav>

      {tab ===
        'general' && (
        <>

          <div className="donateur-kpi-grid">

            <DonateurKpi
              icon={
                <Building2
                  size={22}
                />
              }
              value={
                donateur.type ||
                '-'
              }
              label="Type de donateur"
            />

            <DonateurKpi
              icon={
                <MapPin
                  size={22}
                />
              }
              value={
                donateur.ville ||
                '-'
              }
              label="Ville"
            />

            <DonateurKpi
              icon={
                <Wallet
                  size={22}
                />
              }
              value={
                donateur.modeReglement ||
                '-'
              }
              label="Mode de règlement"
            />

            <DonateurKpi
              icon={
                <FileText
                  size={22}
                />
              }
              value={
                donateur.conditionReglement ||
                '-'
              }
              label="Condition de règlement"
            />

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
                value={`DON-${donateur.code.padStart(
                  6,
                  '0',
                )}`}
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

              <InfoRow
                label="Statut"
                value={
                  donateur.archive
                    ? 'Archivé'
                    : 'Actif'
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

                Contact principal
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
                <Wallet
                  size={19}
                />

                Paramètres de règlement
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
                value={
                  donateur.modeReglement ||
                  '-'
                }
              />

            </section>

          </div>

          <section className="donateur-detail-card donateur-documents-card">

            <h2>
              <FileText
                size={19}
              />

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
            <section className="donateur-detail-card donateur-remarque-card">

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

      {tab ===
        'contacts' && (
        <EmptySection
          icon={
            <User
              size={30}
            />
          }
          title="Contacts"
          text="Les contacts liés à cette organisation seront affichés ici."
        />
      )}

      {tab ===
        'commandes' && (
        <EmptySection
          icon={
            <ShoppingCart
              size={30}
            />
          }
          title="Commandes"
          text="La gestion complète des commandes de ce donateur sera développée ici."
        />
      )}

      {tab ===
        'dons' && (
        <EmptySection
          icon={
            <Gift
              size={30}
            />
          }
          title="Dons"
          text="L'historique des dons sera affiché ici."
        />
      )}

      {tab ===
        'encaissements' && (
        <EmptySection
          icon={
            <Wallet
              size={30}
            />
          }
          title="Encaissements"
          text="Les règlements et encaissements seront affichés ici."
        />
      )}

      {tab ===
        'documents' && (
        <EmptySection
          icon={
            <FileText
              size={30}
            />
          }
          title="Documents"
          text="Les documents liés au donateur seront affichés ici."
        />
      )}

      {tab ===
        'historique' && (
        <EmptySection
          icon={
            <History
              size={30}
            />
          }
          title="Historique"
          text="Les événements et modifications de la fiche seront affichés ici."
        />
      )}

    </div>
  )
}

/* =========================================================
   FORM FIELD
   ========================================================= */

function FormField({
  label,
  required = false,
  wide = false,
  children,
}: {
  label: string
  required?: boolean
  wide?: boolean
  children: ReactNode
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

        {required && (
          <strong>
            *
          </strong>
        )}
      </span>

      {children}

    </label>
  )
}

/* =========================================================
   ONGLET
   ========================================================= */

function TabButton({
  tab,
  currentTab,
  onClick,
  children,
}: {
  tab: TabId
  currentTab: TabId
  onClick: (
    tab: TabId,
  ) => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={
        currentTab ===
        tab
          ? 'active'
          : ''
      }
      onClick={() =>
        onClick(tab)
      }
    >
      {children}
    </button>
  )
}

/* =========================================================
   KPI
   ========================================================= */

function DonateurKpi({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: string
  label: string
}) {
  return (
    <div className="donateur-kpi">

      <div className="donateur-kpi-icon">
        {icon}
      </div>

      <div>

        <strong>
          {value}
        </strong>

        <span>
          {label}
        </span>

      </div>

    </div>
  )
}

/* =========================================================
   INFO ROW
   ========================================================= */

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon?: ReactNode
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

/* =========================================================
   BADGE OUI / NON
   ========================================================= */

function BooleanBadge({
  value,
}: {
  value?: string
}) {
  const yes =
    value?.toUpperCase() ===
    'OUI'

  return (
    <span
      className={`donateur-boolean ${
        yes
          ? 'yes'
          : 'no'
      }`}
    >
      {value || '-'}
    </span>
  )
}

/* =========================================================
   DOCUMENT
   ========================================================= */

function DocumentStatus({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  const yes =
    value?.toUpperCase() ===
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
        {value || 'NON'}
      </strong>

    </div>
  )
}

/* =========================================================
   SECTION VIDE
   ========================================================= */

function EmptySection({
  icon,
  title,
  text,
}: {
  icon: ReactNode
  title: string
  text: string
}) {
  return (
    <section className="donateur-empty-section">

      <div className="donateur-empty-icon">
        {icon}
      </div>

      <h2>
        {title}
      </h2>

      <p>
        {text}
      </p>

    </section>
  )
}

/* =========================================================
   DOUBLONS
   ========================================================= */

function normalizeDonateurValue(
  value?: string,
) {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .replace(
      /[^a-z0-9]/g,
      '',
    )
}

function findDuplicateDonateur(
  form: Donateur,
  donateurs: Donateur[],
  ignoredId?: number,
): Donateur | null {
  const formNom =
    normalizeDonateurValue(
      form.nom,
    )

  const formEmail =
    normalizeDonateurValue(
      form.email,
    )

  const formTelephone =
    normalizeDonateurValue(
      form.telephone,
    )

  const formVille =
    normalizeDonateurValue(
      form.ville,
    )

  const duplicate =
    donateurs.find(
      (item) => {
        if (
          ignoredId !==
            undefined &&
          item.id ===
            ignoredId
        ) {
          return false
        }

        const sameName =
          Boolean(
            formNom,
          ) &&
          normalizeDonateurValue(
            item.nom,
          ) === formNom

        const sameEmail =
          Boolean(
            formEmail,
          ) &&
          normalizeDonateurValue(
            item.email,
          ) === formEmail

        const sameTelephone =
          Boolean(
            formTelephone,
          ) &&
          normalizeDonateurValue(
            item.telephone,
          ) ===
            formTelephone

        const sameNameAndCity =
          Boolean(
            formNom &&
            formVille,
          ) &&
          normalizeDonateurValue(
            item.nom,
          ) === formNom &&
          normalizeDonateurValue(
            item.ville,
          ) === formVille

        return (
          sameName ||
          sameEmail ||
          sameTelephone ||
          sameNameAndCity
        )
      },
    )

  return (
    duplicate ??
    null
  )
}

/* =========================================================
   VALEURS COLONNES
   ========================================================= */

function getColumnValue(
  donateur: Donateur,
  column: ColumnKey,
): string | number {
  switch (column) {
    case 'code':
      return Number(
        donateur.code,
      )

    case 'nom':
      return donateur.nom

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
      return [
        donateur.contactPrenom,
        donateur.contactNom,
      ]
        .filter(Boolean)
        .join(' ')

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
  }
}

/* =========================================================
   EXPORT
   ========================================================= */

function getExportDate() {
  return new Intl.DateTimeFormat(
    'fr-FR',
  ).format(
    new Date(),
  )
}

function getFileDate() {
  const today =
    new Date()

  const day =
    String(
      today.getDate(),
    ).padStart(
      2,
      '0',
    )

  const month =
    String(
      today.getMonth() + 1,
    ).padStart(
      2,
      '0',
    )

  const year =
    today.getFullYear()

  return `${year}-${month}-${day}`
}

function downloadBlob(
  blob: Blob,
  filename: string,
) {
  const url =
    URL.createObjectURL(
      blob,
    )

  const link =
    document.createElement(
      'a',
    )

  link.href = url

  link.download =
    filename

  document.body.appendChild(
    link,
  )

  link.click()

  document.body.removeChild(
    link,
  )

  URL.revokeObjectURL(
    url,
  )
}

/* =========================================================
   INITIALS
   ========================================================= */

function getInitials(
  name: string,
) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (word) =>
        word.charAt(0),
    )
    .join('')
}

export default Donateurs