import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  Banknote,
  Check,
  ChevronDown,
  Coins,
  CreditCard,
  Download,
  Edit3,
  Euro,
  Eye,
  FileDown,
  FileSpreadsheet,
  FileText,
  Gift,
  MoreVertical,
  Plus,
  Search,
  Settings2,
  WalletCards,
  X,
} from 'lucide-react'

import ExcelJS, {
  type Row,
} from 'exceljs'

import {
  jsPDF,
} from 'jspdf'

import autoTable from 'jspdf-autotable'

import {
  useObData,
} from '../context/ObDataContext'

import type {
  FicheCaisse,
  TypeFicheCaisse,
} from '../types/ob'

import './FichesCaisse.css'

/* =========================================================
   TYPES
   ========================================================= */

type FicheFormMode =
  | 'create'
  | 'edit'

type ColumnKey =
  | 'date'
  | 'type'
  | 'ville'
  | 'secteur'
  | 'especes'
  | 'cheques'
  | 'tpe'
  | 'virement'
  | 'dons'

type SortKey =
  | 'numero'
  | 'date'
  | 'type'
  | 'libelle'
  | 'ville'
  | 'secteur'
  | 'especes'
  | 'cheques'
  | 'tpe'
  | 'virement'
  | 'dons'
  | 'total'

type SortDirection =
  | 'asc'
  | 'desc'

type NumericFicheField =
  | 'billets100'
  | 'billets50'
  | 'billets20'
  | 'billets10'
  | 'billets5'
  | 'pieces2'
  | 'pieces1'
  | 'pieces050'
  | 'pieces020'
  | 'pieces010'
  | 'pieces005'
  | 'pieces002'
  | 'pieces001'
  | 'nbCheques'
  | 'montantCheques'
  | 'nbTpe'
  | 'montantTpe'
  | 'montantVirement'
  | 'nbDons5'
  | 'nbDons3'
  | 'montantDonsAutres'

type PdfMoneyRow = {
  label: string
  quantity: string
  amount: string
}

/* =========================================================
   CONFIGURATION
   ========================================================= */

const DEFAULT_COLUMNS: Record<
  ColumnKey,
  boolean
> = {
  date: true,
  type: true,
  ville: true,
  secteur: true,
  especes: true,
  cheques: true,
  tpe: true,
  virement: true,
  dons: true,
}

const COLUMN_OPTIONS: {
  key: ColumnKey
  label: string
}[] = [
  {
    key: 'date',
    label: 'Date',
  },
  {
    key: 'type',
    label: 'Type',
  },
  {
    key: 'ville',
    label: 'Ville',
  },
  {
    key: 'secteur',
    label: 'Secteur',
  },
  {
    key: 'especes',
    label: 'Espèces',
  },
  {
    key: 'cheques',
    label: 'Chèques',
  },
  {
    key: 'tpe',
    label: 'TPE',
  },
  {
    key: 'virement',
    label: 'Virement',
  },
  {
    key: 'dons',
    label: 'Dons',
  },
]

const BILLETS: {
  key: NumericFicheField
  label: string
  valeur: number
}[] = [
  {
    key: 'billets100',
    label: '100 €',
    valeur: 100,
  },
  {
    key: 'billets50',
    label: '50 €',
    valeur: 50,
  },
  {
    key: 'billets20',
    label: '20 €',
    valeur: 20,
  },
  {
    key: 'billets10',
    label: '10 €',
    valeur: 10,
  },
  {
    key: 'billets5',
    label: '5 €',
    valeur: 5,
  },
]

const PIECES: {
  key: NumericFicheField
  label: string
  valeur: number
}[] = [
  {
    key: 'pieces2',
    label: '2 €',
    valeur: 2,
  },
  {
    key: 'pieces1',
    label: '1 €',
    valeur: 1,
  },
  {
    key: 'pieces050',
    label: '0,50 €',
    valeur: 0.5,
  },
  {
    key: 'pieces020',
    label: '0,20 €',
    valeur: 0.2,
  },
  {
    key: 'pieces010',
    label: '0,10 €',
    valeur: 0.1,
  },
  {
    key: 'pieces005',
    label: '0,05 €',
    valeur: 0.05,
  },
  {
    key: 'pieces002',
    label: '0,02 €',
    valeur: 0.02,
  },
  {
    key: 'pieces001',
    label: '0,01 €',
    valeur: 0.01,
  },
]

/* =========================================================
   PAGE
   ========================================================= */

function FichesCaisse() {
  const {
    fichesCaisse,
    setFichesCaisse,
  } = useObData()

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    typeFilter,
    setTypeFilter,
  ] = useState('Tous')

  const [
    secteurFilter,
    setSecteurFilter,
  ] = useState('Tous')

  const [
    dateFilter,
    setDateFilter,
  ] = useState('')

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      'numero',
    )

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      'desc',
    )

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false)

  const [
    modalMode,
    setModalMode,
  ] =
    useState<FicheFormMode>(
      'create',
    )

  const [
    editingFiche,
    setEditingFiche,
  ] =
    useState<FicheCaisse | null>(
      null,
    )

  const [
    detailFiche,
    setDetailFiche,
  ] =
    useState<FicheCaisse | null>(
      null,
    )

  const [
    exportMenuOpen,
    setExportMenuOpen,
  ] = useState(false)

  const [
    columnsMenuOpen,
    setColumnsMenuOpen,
  ] = useState(false)

  const [
    actionMenuId,
    setActionMenuId,
  ] =
    useState<number | null>(
      null,
    )

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
        'ob-fiches-caisse-columns',
      )

    if (!saved) {
      return {
        ...DEFAULT_COLUMNS,
      }
    }

    try {
      return {
        ...DEFAULT_COLUMNS,
        ...JSON.parse(saved),
      }
    } catch {
      return {
        ...DEFAULT_COLUMNS,
      }
    }
  })

  /* =======================================================
     MEMORISATION DES COLONNES
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      'ob-fiches-caisse-columns',
      JSON.stringify(
        visibleColumns,
      ),
    )
  }, [
    visibleColumns,
  ])

  /* =======================================================
     SECTEURS
     ======================================================= */

  const secteurs =
    useMemo(() => {
      const values =
        fichesCaisse
          .map(
            (fiche) =>
              fiche.secteur,
          )
          .filter(
            (
              value,
            ): value is string =>
              Boolean(value),
          )

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
      fichesCaisse,
    ])

  /* =======================================================
     FILTRE + TRI
     ======================================================= */

  const filteredFiches =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      const filtered =
        fichesCaisse.filter(
          (fiche) => {
            const searchable =
              [
                fiche.numero,
                fiche.libelle,
                fiche.ville,
                fiche.cp,
                fiche.secteur,
                fiche.type,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            const matchesSearch =
              !query ||
              searchable.includes(
                query,
              )

            const matchesType =
              typeFilter ===
                'Tous' ||
              fiche.type ===
                typeFilter

            const matchesSecteur =
              secteurFilter ===
                'Tous' ||
              fiche.secteur ===
                secteurFilter

            const matchesDate =
              !dateFilter ||
              fiche.date ===
                dateFilter

            return (
              matchesSearch &&
              matchesType &&
              matchesSecteur &&
              matchesDate
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

          let comparison = 0

          if (
            typeof valueA ===
              'number' &&
            typeof valueB ===
              'number'
          ) {
            comparison =
              valueA -
              valueB
          } else {
            comparison =
              String(
                valueA,
              ).localeCompare(
                String(
                  valueB,
                ),
                'fr',
                {
                  numeric: true,
                  sensitivity:
                    'base',
                },
              )
          }

          return sortDirection ===
            'asc'
            ? comparison
            : -comparison
        },
      )
    }, [
      fichesCaisse,
      search,
      typeFilter,
      secteurFilter,
      dateFilter,
      sortKey,
      sortDirection,
    ])

  /* =======================================================
     TOTAUX
     ======================================================= */

  const totals =
    useMemo(() => {
      return filteredFiches.reduce(
        (
          result,
          fiche,
        ) => {
          result.especes +=
            getMontantEspeces(
              fiche,
            )

          result.cheques +=
            fiche.montantCheques

          result.tpe +=
            fiche.montantTpe

          result.virement +=
            fiche.montantVirement

          result.dons +=
            getMontantDons(
              fiche,
            )

          result.total +=
            getTotalFiche(
              fiche,
            )

          return result
        },
        {
          especes: 0,
          cheques: 0,
          tpe: 0,
          virement: 0,
          dons: 0,
          total: 0,
        },
      )
    }, [
      filteredFiches,
    ])

  /* =======================================================
     TRI
     ======================================================= */

  function changeSort(
    key: SortKey,
  ) {
    if (
      key === sortKey
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
     COLONNES
     ======================================================= */

  function toggleColumn(
    key: ColumnKey,
  ) {
    setVisibleColumns(
      (current) => ({
        ...current,
        [key]:
          !current[key],
      }),
    )
  }

  /* =======================================================
     CREATION
     ======================================================= */

  function openCreateModal() {
    setEditingFiche(
      null,
    )

    setModalMode(
      'create',
    )

    setModalOpen(
      true,
    )

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     MODIFICATION
     ======================================================= */

  function openEditModal(
    fiche: FicheCaisse,
  ) {
    setDetailFiche(
      null,
    )

    setEditingFiche(
      fiche,
    )

    setModalMode(
      'edit',
    )

    setModalOpen(
      true,
    )

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     SAUVEGARDE
     ======================================================= */

  function saveFiche(
    fiche: FicheCaisse,
  ) {
    if (
      modalMode ===
      'edit'
    ) {
      setFichesCaisse(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              fiche.id
                ? fiche
                : item,
          ),
      )
    } else {
      setFichesCaisse(
        (current) => [
          ...current,
          fiche,
        ],
      )
    }

    setModalOpen(
      false,
    )

    setEditingFiche(
      null,
    )
  }

  /* =======================================================
     EXPORT GLOBAL EXCEL
     ======================================================= */

  async function exportExcel() {
    const workbook =
      new ExcelJS.Workbook()

    const worksheet =
      workbook.addWorksheet(
        'Fiches de caisse',
      )

    worksheet.columns = [
      {
        header:
          'N° fiche',
        key: 'numero',
        width: 18,
      },
      {
        header:
          'Date',
        key: 'date',
        width: 14,
      },
      {
        header:
          'Type',
        key: 'type',
        width: 18,
      },
      {
        header:
          'Structure',
        key: 'structure',
        width: 35,
      },
      {
        header:
          'CP',
        key: 'cp',
        width: 12,
      },
      {
        header:
          'Ville',
        key: 'ville',
        width: 22,
      },
      {
        header:
          'Secteur',
        key: 'secteur',
        width: 25,
      },
      {
        header:
          'Espèces',
        key: 'especes',
        width: 15,
      },
      {
        header:
          'Nb chèques',
        key: 'nbCheques',
        width: 15,
      },
      {
        header:
          'Chèques',
        key: 'cheques',
        width: 15,
      },
      {
        header:
          'Nb tickets TPE',
        key: 'nbTpe',
        width: 17,
      },
      {
        header:
          'TPE',
        key: 'tpe',
        width: 15,
      },
      {
        header:
          'Virement',
        key: 'virement',
        width: 15,
      },
      {
        header:
          'Dons',
        key: 'dons',
        width: 15,
      },
      {
        header:
          'Total',
        key: 'total',
        width: 16,
      },
    ]

    filteredFiches.forEach(
      (fiche) => {
        worksheet.addRow({
          numero:
            fiche.numero,

          date:
            formatDate(
              fiche.date,
            ),

          type:
            formatType(
              fiche.type,
            ),

          structure:
            fiche.libelle,

          cp:
            fiche.cp ||
            '',

          ville:
            fiche.ville ||
            '',

          secteur:
            fiche.secteur ||
            '',

          especes:
            getMontantEspeces(
              fiche,
            ),

          nbCheques:
            fiche.nbCheques,

          cheques:
            fiche.montantCheques,

          nbTpe:
            fiche.nbTpe,

          tpe:
            fiche.montantTpe,

          virement:
            fiche.montantVirement,

          dons:
            getMontantDons(
              fiche,
            ),

          total:
            getTotalFiche(
              fiche,
            ),
        })
      },
    )

    styleExcelHeader(
      worksheet.getRow(
        1,
      ),
    )

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
      `Fiches_caisse_${getFileDate()}.xlsx`,
    )

    setExportMenuOpen(
      false,
    )
  }

  /* =======================================================
     EXPORT GLOBAL PDF
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
      'Fiches de caisse contrôlées',
      8,
      10,
    )

    autoTable(
      doc,
      {
        startY: 15,

        head: [[
          'N°',
          'Date',
          'Type',
          'Structure',
          'Ville',
          'Secteur',
          'Espèces',
          'Chèques',
          'TPE',
          'Virement',
          'Dons',
          'Total',
        ]],

        body:
          filteredFiches.map(
            (fiche) => [
              fiche.numero,

              formatDate(
                fiche.date,
              ),

              formatType(
                fiche.type,
              ),

              fiche.libelle,

              fiche.ville ||
                '',

              fiche.secteur ||
                '',

              formatMoney(
                getMontantEspeces(
                  fiche,
                ),
              ),

              formatMoney(
                fiche.montantCheques,
              ),

              formatMoney(
                fiche.montantTpe,
              ),

              formatMoney(
                fiche.montantVirement,
              ),

              formatMoney(
                getMontantDons(
                  fiche,
                ),
              ),

              formatMoney(
                getTotalFiche(
                  fiche,
                ),
              ),
            ],
          ),

        styles: {
          fontSize: 6.5,
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
      `Fiches_caisse_${getFileDate()}.pdf`,
    )

    setExportMenuOpen(
      false,
    )
  }

  /* =======================================================
     EXPORT EXCEL INDIVIDUEL
     ======================================================= */

  async function exportSingleFicheExcel(
    fiche: FicheCaisse,
  ) {
    const workbook =
      new ExcelJS.Workbook()

    const worksheet =
      workbook.addWorksheet(
        'Fiche de caisse',
      )

    worksheet.columns = [
      {
        key: 'libelle',
        width: 32,
      },
      {
        key: 'quantite',
        width: 16,
      },
      {
        key: 'montant',
        width: 22,
      },
    ]

    worksheet.mergeCells(
      'A1:C1',
    )

    worksheet.getCell(
      'A1',
    ).value =
      'OPÉRATION BRIOCHES'

    worksheet.mergeCells(
      'A2:C2',
    )

    worksheet.getCell(
      'A2',
    ).value =
      'FICHE DE CAISSE CONTRÔLÉE'

    worksheet.mergeCells(
      'A3:C3',
    )

    worksheet.getCell(
      'A3',
    ).value =
      fiche.numero

    worksheet.mergeCells(
      'A5:C5',
    )

    worksheet.getCell(
      'A5',
    ).value =
      fiche.libelle

    worksheet.addRow([])

    worksheet.addRow([
      'Date',
      '',
      formatDate(
        fiche.date,
      ),
    ])

    worksheet.addRow([
      'Type',
      '',
      formatType(
        fiche.type,
      ),
    ])

    worksheet.addRow([
      'Campagne',
      '',
      fiche.campagne,
    ])

    worksheet.addRow([
      'Code postal',
      '',
      fiche.cp || '',
    ])

    worksheet.addRow([
      'Ville',
      '',
      fiche.ville || '',
    ])

    worksheet.addRow([
      'Secteur',
      '',
      fiche.secteur ||
        '',
    ])

    worksheet.addRow([])

    const billetsTitleRow =
      worksheet.addRow([
        'BILLETS',
        'QUANTITÉ',
        'MONTANT',
      ])

    BILLETS.forEach(
      (item) => {
        const quantity =
          Number(
            fiche[
              item.key
            ],
          )

        worksheet.addRow([
          item.label,
          quantity,
          quantity *
            item.valeur,
        ])
      },
    )

    worksheet.addRow([
      'Total billets',
      '',
      getMontantBillets(
        fiche,
      ),
    ])

    worksheet.addRow([])

    const piecesTitleRow =
      worksheet.addRow([
        'PIÈCES',
        'QUANTITÉ',
        'MONTANT',
      ])

    PIECES.forEach(
      (item) => {
        const quantity =
          Number(
            fiche[
              item.key
            ],
          )

        worksheet.addRow([
          item.label,
          quantity,
          quantity *
            item.valeur,
        ])
      },
    )

    worksheet.addRow([
      'Total pièces',
      '',
      getMontantPieces(
        fiche,
      ),
    ])

    worksheet.addRow([
      'TOTAL ESPÈCES',
      '',
      getMontantEspeces(
        fiche,
      ),
    ])

    worksheet.addRow([])

    const encaissementTitle =
      worksheet.addRow([
        'ENCAISSEMENTS',
        'NOMBRE',
        'MONTANT',
      ])

    worksheet.addRow([
      'Chèques',
      fiche.nbCheques,
      fiche.montantCheques,
    ])

    worksheet.addRow([
      'TPE',
      fiche.nbTpe,
      fiche.montantTpe,
    ])

    worksheet.addRow([
      'Virement',
      '',
      fiche.montantVirement,
    ])

    worksheet.addRow([])

    const donsTitle =
      worksheet.addRow([
        'DONS',
        'QUANTITÉ',
        'MONTANT',
      ])

    worksheet.addRow([
      'Dons à 5 €',
      fiche.nbDons5,
      fiche.nbDons5 *
        5,
    ])

    worksheet.addRow([
      'Dons à 3 €',
      fiche.nbDons3,
      fiche.nbDons3 *
        3,
    ])

    worksheet.addRow([
      'Autres dons',
      '',
      fiche.montantDonsAutres,
    ])

    worksheet.addRow([
      'TOTAL DONS',
      '',
      getMontantDons(
        fiche,
      ),
    ])

    worksheet.addRow([])

    const totalRow =
      worksheet.addRow([
        'TOTAL DE LA FICHE',
        '',
        getTotalFiche(
          fiche,
        ),
      ])

    if (
      fiche.remarque
    ) {
      worksheet.addRow([])

      worksheet.addRow([
        'Remarque',
        '',
        fiche.remarque,
      ])
    }

    /* =====================================================
       STYLE EXCEL
       ===================================================== */

    ;[
      'A1',
      'A2',
      'A3',
      'A5',
    ].forEach(
      (cell) => {
        worksheet.getCell(
          cell,
        ).alignment = {
          horizontal:
            'center',
          vertical:
            'middle',
        }
      },
    )

    worksheet.getCell(
      'A1',
    ).font = {
      bold: true,
      size: 18,
      color: {
        argb:
          'FF063B7C',
      },
    }

    worksheet.getCell(
      'A2',
    ).font = {
      bold: true,
      size: 14,
      color: {
        argb:
          'FF063B7C',
      },
    }

    worksheet.getCell(
      'A3',
    ).font = {
      bold: true,
      size: 12,
      color: {
        argb:
          'FFFF8614',
      },
    }

    worksheet.getCell(
      'A5',
    ).font = {
      bold: true,
      size: 14,
      color: {
        argb:
          'FF1F344D',
      },
    }

    ;[
      billetsTitleRow,
      piecesTitleRow,
      encaissementTitle,
      donsTitle,
    ].forEach(
      (row) => {
        row.eachCell(
          (cell) => {
            cell.font = {
              bold: true,
              color: {
                argb:
                  'FFFFFFFF',
              },
            }

            cell.fill = {
              type:
                'pattern',
              pattern:
                'solid',
              fgColor: {
                argb:
                  'FF063B7C',
              },
            }

            cell.alignment = {
              horizontal:
                'center',
              vertical:
                'middle',
            }
          },
        )
      },
    )

    totalRow.eachCell(
      (cell) => {
        cell.font = {
          bold: true,
          size: 13,
          color: {
            argb:
              'FFFF8614',
          },
        }

        cell.fill = {
          type:
            'pattern',
          pattern:
            'solid',
          fgColor: {
            argb:
              'FFFFF3E8',
          },
        }
      },
    )

    worksheet.eachRow(
      (row) => {
        row.height =
          Math.max(
            row.height ||
              15,
            21,
          )

        row.eachCell(
          (cell) => {
            cell.alignment = {
              ...cell.alignment,
              vertical:
                'middle',
            }
          },
        )
      },
    )

    worksheet.getColumn(
      3,
    ).numFmt =
      '#,##0.00 [$€-fr-FR]'

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
      `${fiche.numero}_${safeFilename(
        fiche.libelle,
      )}.xlsx`,
    )

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     PDF INDIVIDUEL - UNE SEULE PAGE
     ======================================================= */

  async function exportSingleFichePdf(
    fiche: FicheCaisse,
  ) {
    const doc =
      new jsPDF({
        orientation:
          'portrait',
        unit: 'mm',
        format: 'a4',
      })

    const pageWidth =
      doc.internal.pageSize.getWidth()

    const pageHeight =
      doc.internal.pageSize.getHeight()

    const center =
      pageWidth /
      2

    const margin =
      14

    /* =====================================================
       LOGOS
       ===================================================== */

    try {
      const [
        logoGauche,
        logoDroite,
      ] =
        await Promise.all([
          loadImageAsDataUrl(
            '/logos/logo-gauche.png',
          ),

          loadImageAsDataUrl(
            '/logos/logo-droite.png',
          ),
        ])

      doc.addImage(
        logoGauche,
        'PNG',
        14,
        7,
        25,
        21,
        undefined,
        'FAST',
      )

      doc.addImage(
        logoDroite,
        'PNG',
        pageWidth -
          39,
        7,
        25,
        21,
        undefined,
        'FAST',
      )
    } catch (
      error
    ) {
      console.warn(
        'Les logos du PDF n’ont pas pu être chargés.',
        error,
      )
    }

    /* =====================================================
       TITRE
       ===================================================== */

    doc.setFont(
      'helvetica',
      'bold',
    )

    doc.setTextColor(
      6,
      59,
      124,
    )

    doc.setFontSize(
      17,
    )

    doc.text(
      'OPÉRATION BRIOCHES',
      center,
      13,
      {
        align:
          'center',
      },
    )

    doc.setFontSize(
      10.5,
    )

    doc.text(
      'FICHE DE CAISSE CONTRÔLÉE',
      center,
      20,
      {
        align:
          'center',
      },
    )

    doc.setTextColor(
      255,
      134,
      20,
    )

    doc.setFontSize(
      9.5,
    )

    doc.text(
      fiche.numero,
      center,
      26,
      {
        align:
          'center',
      },
    )

    doc.setDrawColor(
      225,
      233,
      242,
    )

    doc.line(
      margin,
      32,
      pageWidth -
        margin,
      32,
    )

    /* =====================================================
       STRUCTURE
       ===================================================== */

    doc.setFont(
      'helvetica',
      'bold',
    )

    doc.setTextColor(
      31,
      52,
      77,
    )

    doc.setFontSize(
      13,
    )

    doc.text(
      fiche.libelle,
      center,
      39,
      {
        align:
          'center',
      },
    )

    doc.setFont(
      'helvetica',
      'normal',
    )

    doc.setFontSize(
      8,
    )

    doc.setTextColor(
      102,
      130,
      165,
    )

    const localisation =
      [
        fiche.cp,
        fiche.ville,
      ]
        .filter(Boolean)
        .join(' ')

    if (
      localisation
    ) {
      doc.text(
        localisation,
        center,
        44,
        {
          align:
            'center',
        },
      )
    }

    if (
      fiche.secteur
    ) {
      doc.text(
        `Secteur : ${fiche.secteur}`,
        center,
        49,
        {
          align:
            'center',
        },
      )
    }

    /* =====================================================
       INFORMATIONS GENERALES
       ===================================================== */

    drawPdfInfoBox(
      doc,
      20,
      54,
      52,
      14,
      'DATE',
      formatDate(
        fiche.date,
      ),
    )

    drawPdfInfoBox(
      doc,
      79,
      54,
      52,
      14,
      'TYPE',
      formatType(
        fiche.type,
      ),
    )

    drawPdfInfoBox(
      doc,
      138,
      54,
      52,
      14,
      'CAMPAGNE',
      fiche.campagne,
    )

    /* =====================================================
       COMPTAGE ESPÈCES
       ===================================================== */

    doc.setFont(
      'helvetica',
      'bold',
    )

    doc.setTextColor(
      6,
      59,
      124,
    )

    doc.setFontSize(
      10,
    )

    doc.text(
      'COMPTAGE DES ESPÈCES',
      center,
      76,
      {
        align:
          'center',
      },
    )

    const billetRows:
      PdfMoneyRow[] =
      BILLETS.map(
        (item) => {
          const quantity =
            Number(
              fiche[
                item.key
              ],
            )

          return {
            label:
              item.label,

            quantity:
              String(
                quantity,
              ),

            amount:
              formatMoneyPdf(
                quantity *
                  item.valeur,
              ),
          }
        },
      )

    const pieceRows:
      PdfMoneyRow[] =
      PIECES.map(
        (item) => {
          const quantity =
            Number(
              fiche[
                item.key
              ],
            )

          return {
            label:
              item.label,

            quantity:
              String(
                quantity,
              ),

            amount:
              formatMoneyPdf(
                quantity *
                  item.valeur,
              ),
          }
        },
      )

    drawPdfMoneyTable(
      doc,
      14,
      80,
      86,
      'Billets',
      billetRows,
      'Total billets',
      formatMoneyPdf(
        getMontantBillets(
          fiche,
        ),
      ),
    )

    drawPdfMoneyTable(
      doc,
      110,
      80,
      86,
      'Pièces',
      pieceRows,
      'Total pièces',
      formatMoneyPdf(
        getMontantPieces(
          fiche,
        ),
      ),
    )

    /* =====================================================
       TOTAL ESPECES
       ===================================================== */

    doc.setFillColor(
      238,
      245,
      251,
    )

    doc.setDrawColor(
      210,
      225,
      238,
    )

    doc.roundedRect(
      40,
      138,
      pageWidth -
        80,
      12,
      2.5,
      2.5,
      'FD',
    )

    doc.setFont(
      'helvetica',
      'bold',
    )

    doc.setTextColor(
      6,
      59,
      124,
    )

    doc.setFontSize(
      8.5,
    )

    doc.text(
      'TOTAL ESPÈCES',
      47,
      145.5,
    )

    doc.setFontSize(
      11,
    )

    doc.text(
      formatMoneyPdf(
        getMontantEspeces(
          fiche,
        ),
      ),
      pageWidth -
        47,
      145.5,
      {
        align:
          'right',
      },
    )

    /* =====================================================
       ENCAISSEMENTS
       ===================================================== */

    doc.setFontSize(
      10,
    )

    doc.text(
      'AUTRES ENCAISSEMENTS',
      57,
      159,
      {
        align:
          'center',
      },
    )

    drawPdfSimpleTable(
      doc,
      14,
      163,
      86,
      [
        {
          label:
            'Chèques',
          quantity:
            String(
              fiche.nbCheques,
            ),
          amount:
            formatMoneyPdf(
              fiche.montantCheques,
            ),
        },

        {
          label:
            'TPE',
          quantity:
            String(
              fiche.nbTpe,
            ),
          amount:
            formatMoneyPdf(
              fiche.montantTpe,
            ),
        },

        {
          label:
            'Virement',
          quantity:
            '-',
          amount:
            formatMoneyPdf(
              fiche.montantVirement,
            ),
        },
      ],
      [
        6,
        59,
        124,
      ],
    )

    /* =====================================================
       DONS
       ===================================================== */

    doc.setTextColor(
      6,
      59,
      124,
    )

    doc.setFont(
      'helvetica',
      'bold',
    )

    doc.setFontSize(
      10,
    )

    doc.text(
      'DONS',
      153,
      159,
      {
        align:
          'center',
      },
    )

    drawPdfSimpleTable(
      doc,
      110,
      163,
      86,
      [
        {
          label:
            'Dons à 5 €',
          quantity:
            String(
              fiche.nbDons5,
            ),
          amount:
            formatMoneyPdf(
              fiche.nbDons5 *
                5,
            ),
        },

        {
          label:
            'Dons à 3 €',
          quantity:
            String(
              fiche.nbDons3,
            ),
          amount:
            formatMoneyPdf(
              fiche.nbDons3 *
                3,
            ),
        },

        {
          label:
            'Autres dons',
          quantity:
            '-',
          amount:
            formatMoneyPdf(
              fiche.montantDonsAutres,
            ),
        },
      ],
      [
        255,
        134,
        20,
      ],
    )

    /* =====================================================
       SOUS-TOTAUX
       ===================================================== */

    drawPdfInfoBox(
      doc,
      14,
      194,
      86,
      14,
      'AUTRES ENCAISSEMENTS',
      formatMoneyPdf(
        fiche.montantCheques +
          fiche.montantTpe +
          fiche.montantVirement,
      ),
    )

    drawPdfInfoBox(
      doc,
      110,
      194,
      86,
      14,
      'TOTAL DONS',
      formatMoneyPdf(
        getMontantDons(
          fiche,
        ),
      ),
      true,
    )

    /* =====================================================
       TOTAL FINAL
       ===================================================== */

    doc.setFillColor(
      255,
      247,
      239,
    )

    doc.setDrawColor(
      255,
      190,
      125,
    )

    doc.roundedRect(
      35,
      216,
      pageWidth -
        70,
      24,
      3,
      3,
      'FD',
    )

    doc.setFont(
      'helvetica',
      'bold',
    )

    doc.setTextColor(
      181,
      106,
      36,
    )

    doc.setFontSize(
      9,
    )

    doc.text(
      'TOTAL DE LA FICHE',
      center,
      223,
      {
        align:
          'center',
      },
    )

    doc.setTextColor(
      255,
      134,
      20,
    )

    doc.setFontSize(
      19,
    )

    doc.text(
      formatMoneyPdf(
        getTotalFiche(
          fiche,
        ),
      ),
      center,
      233.5,
      {
        align:
          'center',
      },
    )

    /* =====================================================
       REMARQUE
       ===================================================== */

    doc.setDrawColor(
      225,
      233,
      242,
    )

    doc.setFillColor(
      250,
      252,
      254,
    )

    doc.roundedRect(
      14,
      248,
      pageWidth -
        28,
      27,
      2,
      2,
      'FD',
    )

    doc.setFont(
      'helvetica',
      'bold',
    )

    doc.setTextColor(
      6,
      59,
      124,
    )

    doc.setFontSize(
      8,
    )

    doc.text(
      'REMARQUE',
      19,
      254,
    )

    doc.setFont(
      'helvetica',
      'normal',
    )

    doc.setTextColor(
      80,
      100,
      120,
    )

    doc.setFontSize(
      7.2,
    )

    if (
      fiche.remarque
    ) {
      const lines =
        doc.splitTextToSize(
          fiche.remarque,
          pageWidth -
            40,
        )

      doc.text(
        lines.slice(
          0,
          4,
        ),
        19,
        260,
      )
    } else {
      doc.text(
        'Aucune remarque.',
        19,
        260,
      )
    }

    /* =====================================================
       PIED DE PAGE
       ===================================================== */

    doc.setDrawColor(
      225,
      233,
      242,
    )

    doc.line(
      margin,
      pageHeight -
        14,
      pageWidth -
        margin,
      pageHeight -
        14,
    )

    doc.setFont(
      'helvetica',
      'normal',
    )

    doc.setFontSize(
      6.5,
    )

    doc.setTextColor(
      145,
      160,
      175,
    )

    doc.text(
      `Opération Brioches • ${fiche.numero}`,
      center,
      pageHeight -
        8,
      {
        align:
          'center',
      },
    )

    /*
     * Aucun doc.addPage()
     * dans ce PDF individuel.
     * Il restera donc sur une seule feuille.
     */

    doc.save(
      `${fiche.numero}_${safeFilename(
        fiche.libelle,
      )}.pdf`,
    )

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <div className="fiches-caisse-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <header className="fiches-caisse-header">

        <div>

          <span className="fiches-caisse-eyebrow">
            Encaissements
          </span>

          <h1>
            Fiches de caisse
          </h1>

          <p>
            Saisie et centralisation des fiches de caisse contrôlées de l'Opération Brioches.
          </p>

        </div>

        <div className="fiches-caisse-header-actions">

          <div className="fiches-caisse-export">

            <button
              type="button"
              className="fiches-caisse-secondary-button"
              onClick={() =>
                setExportMenuOpen(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
            >
              <Download
                size={18}
              />

              Exporter

              <ChevronDown
                size={15}
              />
            </button>

            {exportMenuOpen && (
              <div className="fiches-caisse-export-menu">

                <button
                  type="button"
                  onClick={
                    exportExcel
                  }
                >
                  <FileSpreadsheet
                    size={20}
                  />

                  <div>

                    <strong>
                      Excel
                    </strong>

                    <span>
                      Toutes les fiches filtrées
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
                    size={20}
                  />

                  <div>

                    <strong>
                      PDF
                    </strong>

                    <span>
                      Récapitulatif de la vue
                    </span>

                  </div>

                </button>

              </div>
            )}

          </div>

          <button
            type="button"
            className="fiches-caisse-primary-button"
            onClick={
              openCreateModal
            }
          >
            <Plus
              size={19}
            />

            Nouvelle fiche
          </button>

        </div>

      </header>

      {/* =================================================
          KPI
      ================================================= */}

      <section className="fiches-caisse-kpis">

        <KpiCard
          icon={
            <WalletCards
              size={24}
            />
          }
          label="Fiches contrôlées"
          value={String(
            filteredFiches.length,
          )}
        />

        <KpiCard
          icon={
            <Banknote
              size={24}
            />
          }
          label="Espèces"
          value={formatMoney(
            totals.especes,
          )}
        />

        <KpiCard
          icon={
            <Check
              size={24}
            />
          }
          label="Chèques"
          value={formatMoney(
            totals.cheques,
          )}
        />

        <KpiCard
          icon={
            <CreditCard
              size={24}
            />
          }
          label="TPE"
          value={formatMoney(
            totals.tpe,
          )}
        />

        <KpiCard
          icon={
            <Euro
              size={24}
            />
          }
          label="Total encaissé"
          value={formatMoney(
            totals.total,
          )}
          important
        />

      </section>

      {/* =================================================
          FILTRES
      ================================================= */}

      <section className="fiches-caisse-filters">

        <div className="fiches-caisse-search">

          <Search
            size={19}
          />

          <input
            type="text"
            placeholder="Rechercher une fiche, une structure, une ville..."
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
          <option value="Tous">
            Tous les types
          </option>

          <option value="ENTREPRISE">
            Entreprises
          </option>

          <option value="MAIRIE">
            Mairies
          </option>

          <option value="ETABLISSEMENT">
            Établissements
          </option>

          <option value="STAND">
            Stands
          </option>

          <option value="AUTRE">
            Autres
          </option>
        </select>

        <select
          value={
            secteurFilter
          }
          onChange={(
            event,
          ) =>
            setSecteurFilter(
              event.target.value,
            )
          }
        >
          {secteurs.map(
            (
              secteur,
            ) => (
              <option
                key={
                  secteur
                }
                value={
                  secteur
                }
              >
                {secteur ===
                'Tous'
                  ? 'Tous les secteurs'
                  : secteur}
              </option>
            ),
          )}
        </select>

        <input
          type="date"
          className="fiches-caisse-date-filter"
          value={
            dateFilter
          }
          onChange={(
            event,
          ) =>
            setDateFilter(
              event.target.value,
            )
          }
        />

        {(search ||
          typeFilter !==
            'Tous' ||
          secteurFilter !==
            'Tous' ||
          dateFilter) && (
          <button
            type="button"
            className="fiches-caisse-reset"
            onClick={() => {
              setSearch('')

              setTypeFilter(
                'Tous',
              )

              setSecteurFilter(
                'Tous',
              )

              setDateFilter('')
            }}
          >
            Réinitialiser
          </button>
        )}

      </section>

      {/* =================================================
          TABLEAU
      ================================================= */}

      <section className="fiches-caisse-card">

        <div className="fiches-caisse-card-header">

          <div>

            <h2>
              Fiches de caisse contrôlées
            </h2>

            <span>
              {filteredFiches.length} fiche
              {filteredFiches.length >
              1
                ? 's'
                : ''}
              {' '}
              • double-clic sur une ligne pour ouvrir
            </span>

          </div>

          <div className="fiches-caisse-columns-wrapper">

            <button
              type="button"
              className="fiches-caisse-columns-button"
              title="Personnaliser les colonnes"
              onClick={() =>
                setColumnsMenuOpen(
                  (
                    current,
                  ) =>
                    !current,
                )
              }
            >
              <Settings2
                size={18}
              />
            </button>

            {columnsMenuOpen && (
              <div className="fiches-caisse-columns-menu">

                <div className="fiches-caisse-columns-menu-header">

                  <strong>
                    Colonnes affichées
                  </strong>

                  <button
                    type="button"
                    onClick={() =>
                      setVisibleColumns({
                        ...DEFAULT_COLUMNS,
                      })
                    }
                  >
                    Tout afficher
                  </button>

                </div>

                {COLUMN_OPTIONS.map(
                  (
                    column,
                  ) => (
                    <ColumnToggle
                      key={
                        column.key
                      }
                      label={
                        column.label
                      }
                      checked={
                        visibleColumns[
                          column.key
                        ]
                      }
                      onChange={() =>
                        toggleColumn(
                          column.key,
                        )
                      }
                    />
                  ),
                )}

              </div>
            )}

          </div>

        </div>

        <div className="fiches-caisse-table-wrapper">

          <table className="fiches-caisse-table">

            <thead>

              <tr>

                <SortableHeader
                  label="N° fiche"
                  active={
                    sortKey ===
                    'numero'
                  }
                  direction={
                    sortDirection
                  }
                  onClick={() =>
                    changeSort(
                      'numero',
                    )
                  }
                />

                {visibleColumns.date && (
                  <SortableHeader
                    label="Date"
                    active={
                      sortKey ===
                      'date'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'date',
                      )
                    }
                  />
                )}

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

                <SortableHeader
                  label="Structure"
                  active={
                    sortKey ===
                    'libelle'
                  }
                  direction={
                    sortDirection
                  }
                  onClick={() =>
                    changeSort(
                      'libelle',
                    )
                  }
                />

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

                {visibleColumns.secteur && (
                  <SortableHeader
                    label="Secteur"
                    active={
                      sortKey ===
                      'secteur'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'secteur',
                      )
                    }
                  />
                )}

                {visibleColumns.especes && (
                  <SortableHeader
                    label="Espèces"
                    active={
                      sortKey ===
                      'especes'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'especes',
                      )
                    }
                  />
                )}

                {visibleColumns.cheques && (
                  <SortableHeader
                    label="Chèques"
                    active={
                      sortKey ===
                      'cheques'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'cheques',
                      )
                    }
                  />
                )}

                {visibleColumns.tpe && (
                  <SortableHeader
                    label="TPE"
                    active={
                      sortKey ===
                      'tpe'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'tpe',
                      )
                    }
                  />
                )}

                {visibleColumns.virement && (
                  <SortableHeader
                    label="Virement"
                    active={
                      sortKey ===
                      'virement'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'virement',
                      )
                    }
                  />
                )}

                {visibleColumns.dons && (
                  <SortableHeader
                    label="Dons"
                    active={
                      sortKey ===
                      'dons'
                    }
                    direction={
                      sortDirection
                    }
                    onClick={() =>
                      changeSort(
                        'dons',
                      )
                    }
                  />
                )}

                <SortableHeader
                  label="Total"
                  active={
                    sortKey ===
                    'total'
                  }
                  direction={
                    sortDirection
                  }
                  onClick={() =>
                    changeSort(
                      'total',
                    )
                  }
                />

                <th>
                  Actions
                </th>

              </tr>

            </thead>

            <tbody>

              {filteredFiches.map(
                (
                  fiche,
                ) => (
                  <tr
                    key={
                      fiche.id
                    }
                    onDoubleClick={() =>
                      setDetailFiche(
                        fiche,
                      )
                    }
                  >

                    <td className="fiche-caisse-number">
                      {
                        fiche.numero
                      }
                    </td>

                    {visibleColumns.date && (
                      <td>
                        {formatDate(
                          fiche.date,
                        )}
                      </td>
                    )}

                    {visibleColumns.type && (
                      <td>

                        <TypeBadge
                          type={
                            fiche.type
                          }
                        />

                      </td>
                    )}

                    <td className="fiche-caisse-structure">

                      <strong>
                        {
                          fiche.libelle
                        }
                      </strong>

                    </td>

                    {visibleColumns.ville && (
                      <td>
                        {
                          fiche.ville ||
                          '-'
                        }
                      </td>
                    )}

                    {visibleColumns.secteur && (
                      <td>
                        {
                          fiche.secteur ||
                          '-'
                        }
                      </td>
                    )}

                    {visibleColumns.especes && (
                      <td>
                        {formatMoney(
                          getMontantEspeces(
                            fiche,
                          ),
                        )}
                      </td>
                    )}

                    {visibleColumns.cheques && (
                      <td>
                        {formatMoney(
                          fiche.montantCheques,
                        )}
                      </td>
                    )}

                    {visibleColumns.tpe && (
                      <td>
                        {formatMoney(
                          fiche.montantTpe,
                        )}
                      </td>
                    )}

                    {visibleColumns.virement && (
                      <td>
                        {formatMoney(
                          fiche.montantVirement,
                        )}
                      </td>
                    )}

                    {visibleColumns.dons && (
                      <td>
                        {formatMoney(
                          getMontantDons(
                            fiche,
                          ),
                        )}
                      </td>
                    )}

                    <td className="fiche-caisse-total">
                      {formatMoney(
                        getTotalFiche(
                          fiche,
                        ),
                      )}
                    </td>

                    <td>

                      <div
                        className="fiches-caisse-row-actions"
                        onClick={(
                          event,
                        ) =>
                          event.stopPropagation()
                        }
                      >

                        <button
                          type="button"
                          title="Voir la fiche"
                          onClick={() =>
                            setDetailFiche(
                              fiche,
                            )
                          }
                        >
                          <Eye
                            size={18}
                          />
                        </button>

                        <button
                          type="button"
                          title="Modifier"
                          onClick={() =>
                            openEditModal(
                              fiche,
                            )
                          }
                        >
                          <Edit3
                            size={18}
                          />
                        </button>

                        <div className="fiche-row-more-wrapper">

                          <button
                            type="button"
                            title="Plus d'actions"
                            onClick={() =>
                              setActionMenuId(
                                (
                                  current,
                                ) =>
                                  current ===
                                  fiche.id
                                    ? null
                                    : fiche.id,
                              )
                            }
                          >
                            <MoreVertical
                              size={18}
                            />
                          </button>

                          {actionMenuId ===
                            fiche.id && (
                            <div className="fiche-row-more-menu">

                              <button
                                type="button"
                                onClick={() =>
                                  void exportSingleFicheExcel(
                                    fiche,
                                  )
                                }
                              >
                                <FileSpreadsheet
                                  size={18}
                                />

                                <div>

                                  <strong>
                                    Exporter
                                  </strong>

                                  <span>
                                    Cette fiche en Excel
                                  </span>

                                </div>

                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void exportSingleFichePdf(
                                    fiche,
                                  )
                                }
                              >
                                <FileText
                                  size={18}
                                />

                                <div>

                                  <strong>
                                    Fiche PDF
                                  </strong>

                                  <span>
                                    Une page A4 complète
                                  </span>

                                </div>

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

          {filteredFiches.length ===
            0 && (
            <div className="fiches-caisse-empty">

              <WalletCards
                size={44}
              />

              <strong>
                Aucune fiche trouvée
              </strong>

              <span>
                Modifie les filtres ou crée une nouvelle fiche.
              </span>

            </div>
          )}

        </div>

      </section>

      {/* =================================================
          DETAIL
      ================================================= */}

      {detailFiche && (
        <FicheDetailModal
          fiche={
            detailFiche
          }
          onClose={() =>
            setDetailFiche(
              null,
            )
          }
          onEdit={() =>
            openEditModal(
              detailFiche,
            )
          }
          onPdf={() =>
            void exportSingleFichePdf(
              detailFiche,
            )
          }
          onExcel={() =>
            void exportSingleFicheExcel(
              detailFiche,
            )
          }
        />
      )}

      {/* =================================================
          CREATION / MODIFICATION
      ================================================= */}

      {modalOpen && (
        <FicheCaisseModal
          mode={
            modalMode
          }
          fiche={
            editingFiche
          }
          fiches={
            fichesCaisse
          }
          onClose={() => {
            setModalOpen(
              false,
            )

            setEditingFiche(
              null,
            )
          }}
          onSave={
            saveFiche
          }
        />
      )}

    </div>
  )
}

/* =========================================================
   GRANDE FICHE DETAIL
   ========================================================= */

function FicheDetailModal({
  fiche,
  onClose,
  onEdit,
  onPdf,
  onExcel,
}: {
  fiche: FicheCaisse
  onClose: () => void
  onEdit: () => void
  onPdf: () => void
  onExcel: () => void
}) {
  const billets =
    getMontantBillets(
      fiche,
    )

  const pieces =
    getMontantPieces(
      fiche,
    )

  const especes =
    getMontantEspeces(
      fiche,
    )

  const dons =
    getMontantDons(
      fiche,
    )

  return (
    <div className="fiche-modal-overlay">

      <div className="fiche-detail-modal">

        <header className="fiche-modal-header">

          <div>

            <span>
              Fiche de caisse contrôlée
            </span>

            <h2>
              {
                fiche.numero
              }
            </h2>

          </div>

          <div className="fiche-detail-modal-actions">

            <button
              type="button"
              className="fiches-caisse-secondary-button"
              onClick={
                onExcel
              }
            >
              <FileSpreadsheet
                size={18}
              />

              Excel
            </button>

            <button
              type="button"
              className="fiches-caisse-secondary-button"
              onClick={
                onPdf
              }
            >
              <FileText
                size={18}
              />

              PDF
            </button>

            <button
              type="button"
              className="fiches-caisse-secondary-button"
              onClick={
                onEdit
              }
            >
              <Edit3
                size={18}
              />

              Modifier
            </button>

            <button
              type="button"
              className="fiche-modal-close-button"
              onClick={
                onClose
              }
            >
              <X
                size={22}
              />
            </button>

          </div>

        </header>

        <div className="fiche-detail-modal-content">

          <section className="fiche-detail-hero">

            <div>

              <TypeBadge
                type={
                  fiche.type
                }
              />

              <h3>
                {
                  fiche.libelle
                }
              </h3>

              <p>
                {[
                  fiche.cp,
                  fiche.ville,
                ]
                  .filter(Boolean)
                  .join(' ')}
              </p>

              <span>
                {
                  fiche.secteur ||
                  'Secteur non renseigné'
                }
              </span>

            </div>

            <div className="fiche-detail-hero-total">

              <span>
                Total de la fiche
              </span>

              <strong>
                {formatMoney(
                  getTotalFiche(
                    fiche,
                  ),
                )}
              </strong>

            </div>

          </section>

          <div className="fiche-detail-kpis">

            <DetailKpi
              icon={
                <Banknote
                  size={22}
                />
              }
              label="Espèces"
              value={formatMoney(
                especes,
              )}
            />

            <DetailKpi
              icon={
                <Check
                  size={22}
                />
              }
              label={`${fiche.nbCheques} chèque${
                fiche.nbCheques >
                1
                  ? 's'
                  : ''
              }`}
              value={formatMoney(
                fiche.montantCheques,
              )}
            />

            <DetailKpi
              icon={
                <CreditCard
                  size={22}
                />
              }
              label={`${fiche.nbTpe} ticket${
                fiche.nbTpe >
                1
                  ? 's'
                  : ''
              } TPE`}
              value={formatMoney(
                fiche.montantTpe,
              )}
            />

            <DetailKpi
              icon={
                <Euro
                  size={22}
                />
              }
              label="Virement"
              value={formatMoney(
                fiche.montantVirement,
              )}
            />

            <DetailKpi
              icon={
                <Gift
                  size={22}
                />
              }
              label="Dons"
              value={formatMoney(
                dons,
              )}
            />

          </div>

          <div className="fiche-detail-grid">

            <section className="fiche-detail-card">

              <h3>
                <Banknote
                  size={20}
                />

                Billets
              </h3>

              {BILLETS.map(
                (
                  item,
                ) => {
                  const count =
                    Number(
                      fiche[
                        item.key
                      ],
                    )

                  return (
                    <DetailCashLine
                      key={
                        item.key
                      }
                      label={
                        item.label
                      }
                      count={
                        count
                      }
                      total={
                        count *
                        item.valeur
                      }
                    />
                  )
                },
              )}

              <div className="fiche-detail-card-total">

                <span>
                  Total billets
                </span>

                <strong>
                  {formatMoney(
                    billets,
                  )}
                </strong>

              </div>

            </section>

            <section className="fiche-detail-card">

              <h3>
                <Coins
                  size={20}
                />

                Pièces
              </h3>

              {PIECES.map(
                (
                  item,
                ) => {
                  const count =
                    Number(
                      fiche[
                        item.key
                      ],
                    )

                  return (
                    <DetailCashLine
                      key={
                        item.key
                      }
                      label={
                        item.label
                      }
                      count={
                        count
                      }
                      total={
                        count *
                        item.valeur
                      }
                    />
                  )
                },
              )}

              <div className="fiche-detail-card-total">

                <span>
                  Total pièces
                </span>

                <strong>
                  {formatMoney(
                    pieces,
                  )}
                </strong>

              </div>

            </section>

          </div>

          <div className="fiche-detail-grid">

            <section className="fiche-detail-card">

              <h3>
                Informations
              </h3>

              <InfoLine
                label="Date"
                value={formatDate(
                  fiche.date,
                )}
              />

              <InfoLine
                label="Campagne"
                value={
                  fiche.campagne
                }
              />

              <InfoLine
                label="Type"
                value={formatType(
                  fiche.type,
                )}
              />

              <InfoLine
                label="Code postal"
                value={
                  fiche.cp ||
                  '-'
                }
              />

              <InfoLine
                label="Ville"
                value={
                  fiche.ville ||
                  '-'
                }
              />

              <InfoLine
                label="Secteur"
                value={
                  fiche.secteur ||
                  '-'
                }
              />

            </section>

            <section className="fiche-detail-card">

              <h3>
                Dons
              </h3>

              <InfoLine
                label="Dons à 5 €"
                value={`${fiche.nbDons5} × 5 €`}
              />

              <InfoLine
                label="Dons à 3 €"
                value={`${fiche.nbDons3} × 3 €`}
              />

              <InfoLine
                label="Autres dons"
                value={formatMoney(
                  fiche.montantDonsAutres,
                )}
              />

              <div className="fiche-detail-card-total">

                <span>
                  Total dons
                </span>

                <strong>
                  {formatMoney(
                    dons,
                  )}
                </strong>

              </div>

            </section>

          </div>

          <div className="fiche-detail-grid">

            <section className="fiche-detail-card">

              <h3>
                Chèques & TPE
              </h3>

              <InfoLine
                label="Nombre de chèques"
                value={String(
                  fiche.nbCheques,
                )}
              />

              <InfoLine
                label="Montant chèques"
                value={formatMoney(
                  fiche.montantCheques,
                )}
              />

              <InfoLine
                label="Nombre de tickets TPE"
                value={String(
                  fiche.nbTpe,
                )}
              />

              <InfoLine
                label="Montant TPE"
                value={formatMoney(
                  fiche.montantTpe,
                )}
              />

            </section>

            <section className="fiche-detail-card">

              <h3>
                Autres encaissements
              </h3>

              <InfoLine
                label="Virement"
                value={formatMoney(
                  fiche.montantVirement,
                )}
              />

              <InfoLine
                label="Total espèces"
                value={formatMoney(
                  especes,
                )}
              />

              <InfoLine
                label="Total dons"
                value={formatMoney(
                  dons,
                )}
              />

              <div className="fiche-detail-card-total">

                <span>
                  Total fiche
                </span>

                <strong>
                  {formatMoney(
                    getTotalFiche(
                      fiche,
                    ),
                  )}
                </strong>

              </div>

            </section>

          </div>

          {fiche.remarque && (
            <section className="fiche-detail-card">

              <h3>
                Remarque
              </h3>

              <p>
                {
                  fiche.remarque
                }
              </p>

            </section>
          )}

        </div>

      </div>

    </div>
  )
}

/* =========================================================
   MODALE CREATION / MODIFICATION
   ========================================================= */

function FicheCaisseModal({
  mode,
  fiche,
  fiches,
  onClose,
  onSave,
}: {
  mode: FicheFormMode
  fiche: FicheCaisse | null
  fiches: FicheCaisse[]
  onClose: () => void
  onSave: (fiche: FicheCaisse) => void
}) {
  const [
    form,
    setForm,
  ] =
    useState<FicheCaisse>(
      fiche
        ? {
            ...fiche,
          }
        : createEmptyFiche(
            fiches,
          ),
    )

  const [
    error,
    setError,
  ] = useState('')

  function updateField<
    K extends keyof FicheCaisse,
  >(
    key: K,
    value:
      FicheCaisse[K],
  ) {
    setForm(
      (current) => ({
        ...current,
        [key]:
          value,
      }),
    )
  }

  function updateNumber(
    key:
      NumericFicheField,
    value:
      string,
  ) {
    const number =
      Math.max(
        0,
        Number(value) ||
          0,
      )

    setForm(
      (current) => ({
        ...current,
        [key]:
          number,
      }),
    )
  }

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')

    if (
      !form.libelle.trim()
    ) {
      setError(
        'Le nom de la structure est obligatoire.',
      )

      return
    }

    if (
      !form.date
    ) {
      setError(
        'La date est obligatoire.',
      )

      return
    }

    onSave({
      ...form,

      libelle:
        form.libelle.trim(),
    })
  }

  const montantBillets =
    getMontantBillets(
      form,
    )

  const montantPieces =
    getMontantPieces(
      form,
    )

  const montantEspeces =
    getMontantEspeces(
      form,
    )

  const montantDons =
    getMontantDons(
      form,
    )

  const total =
    getTotalFiche(
      form,
    )

  return (
    <div className="fiche-modal-overlay">

      <div className="fiche-modal">

        <header className="fiche-modal-header">

          <div>

            <span>
              Fiche de caisse contrôlée
            </span>

            <h2>
              {mode ===
              'create'
                ? 'Nouvelle fiche'
                : 'Modifier la fiche'}
            </h2>

          </div>

          <button
            type="button"
            className="fiche-modal-close-button"
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

          <div className="fiche-modal-content">

            <FormSection
              title="Identification de la fiche"
            >

              <div className="fiche-form-grid">

                <FormField
                  label="N° de fiche"
                >
                  <input
                    value={
                      form.numero
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'numero',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Date"
                >
                  <input
                    type="date"
                    value={
                      form.date
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'date',
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
                        event.target.value as TypeFicheCaisse,
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

                    <option value="STAND">
                      Stand
                    </option>

                    <option value="AUTRE">
                      Autre
                    </option>
                  </select>
                </FormField>

                <FormField
                  label="Campagne"
                >
                  <input
                    value={
                      form.campagne
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'campagne',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Structure / Nom"
                  wide
                >
                  <input
                    value={
                      form.libelle
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'libelle',
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

                <FormField
                  label="Secteur"
                  wide
                >
                  <input
                    value={
                      form.secteur ||
                      ''
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'secteur',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

              </div>

            </FormSection>

            <FormSection
              title="Comptage des espèces"
            >

              <div className="fiche-cash-columns">

                <div className="fiche-cash-column">

                  <div className="fiche-cash-column-title">

                    <Banknote
                      size={21}
                    />

                    <span>
                      Billets
                    </span>

                    <strong>
                      {formatMoney(
                        montantBillets,
                      )}
                    </strong>

                  </div>

                  {BILLETS.map(
                    (
                      item,
                    ) => (
                      <CashInput
                        key={
                          item.key
                        }
                        label={
                          item.label
                        }
                        value={Number(
                          form[
                            item.key
                          ],
                        )}
                        total={
                          Number(
                            form[
                              item.key
                            ],
                          ) *
                          item.valeur
                        }
                        onChange={(
                          value,
                        ) =>
                          updateNumber(
                            item.key,
                            value,
                          )
                        }
                      />
                    ),
                  )}

                </div>

                <div className="fiche-cash-column">

                  <div className="fiche-cash-column-title">

                    <Coins
                      size={21}
                    />

                    <span>
                      Pièces
                    </span>

                    <strong>
                      {formatMoney(
                        montantPieces,
                      )}
                    </strong>

                  </div>

                  {PIECES.map(
                    (
                      item,
                    ) => (
                      <CashInput
                        key={
                          item.key
                        }
                        label={
                          item.label
                        }
                        value={Number(
                          form[
                            item.key
                          ],
                        )}
                        total={
                          Number(
                            form[
                              item.key
                            ],
                          ) *
                          item.valeur
                        }
                        onChange={(
                          value,
                        ) =>
                          updateNumber(
                            item.key,
                            value,
                          )
                        }
                      />
                    ),
                  )}

                </div>

              </div>

              <div className="fiche-cash-total">

                <span>
                  Total espèces
                </span>

                <strong>
                  {formatMoney(
                    montantEspeces,
                  )}
                </strong>

              </div>

            </FormSection>

            <FormSection
              title="Autres encaissements"
            >

              <div className="fiche-payment-grid">

                <PaymentCard
                  icon={
                    <Check
                      size={21}
                    />
                  }
                  title="Chèques"
                >

                  <FormField
                    label="Nombre de chèques"
                  >
                    <input
                      type="number"
                      min="0"
                      value={
                        form.nbCheques
                      }
                      onChange={(
                        event,
                      ) =>
                        updateNumber(
                          'nbCheques',
                          event.target.value,
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Montant"
                  >
                    <MoneyInput
                      value={
                        form.montantCheques
                      }
                      onChange={(
                        value,
                      ) =>
                        updateNumber(
                          'montantCheques',
                          value,
                        )
                      }
                    />
                  </FormField>

                </PaymentCard>

                <PaymentCard
                  icon={
                    <CreditCard
                      size={21}
                    />
                  }
                  title="TPE"
                >

                  <FormField
                    label="Nombre de tickets"
                  >
                    <input
                      type="number"
                      min="0"
                      value={
                        form.nbTpe
                      }
                      onChange={(
                        event,
                      ) =>
                        updateNumber(
                          'nbTpe',
                          event.target.value,
                        )
                      }
                    />
                  </FormField>

                  <FormField
                    label="Montant"
                  >
                    <MoneyInput
                      value={
                        form.montantTpe
                      }
                      onChange={(
                        value,
                      ) =>
                        updateNumber(
                          'montantTpe',
                          value,
                        )
                      }
                    />
                  </FormField>

                </PaymentCard>

                <PaymentCard
                  icon={
                    <Euro
                      size={21}
                    />
                  }
                  title="Virement"
                >

                  <FormField
                    label="Montant"
                  >
                    <MoneyInput
                      value={
                        form.montantVirement
                      }
                      onChange={(
                        value,
                      ) =>
                        updateNumber(
                          'montantVirement',
                          value,
                        )
                      }
                    />
                  </FormField>

                </PaymentCard>

              </div>

            </FormSection>

            <FormSection
              title="Dons"
            >

              <div className="fiche-form-grid fiche-dons-grid">

                <FormField
                  label="Nombre de dons à 5 €"
                >
                  <input
                    type="number"
                    min="0"
                    value={
                      form.nbDons5
                    }
                    onChange={(
                      event,
                    ) =>
                      updateNumber(
                        'nbDons5',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Nombre de dons à 3 €"
                >
                  <input
                    type="number"
                    min="0"
                    value={
                      form.nbDons3
                    }
                    onChange={(
                      event,
                    ) =>
                      updateNumber(
                        'nbDons3',
                        event.target.value,
                      )
                    }
                  />
                </FormField>

                <FormField
                  label="Autres dons"
                >
                  <MoneyInput
                    value={
                      form.montantDonsAutres
                    }
                    onChange={(
                      value,
                    ) =>
                      updateNumber(
                        'montantDonsAutres',
                        value,
                      )
                    }
                  />
                </FormField>

                <div className="fiche-dons-result">

                  <span>
                    Total dons
                  </span>

                  <strong>
                    {formatMoney(
                      montantDons,
                    )}
                  </strong>

                </div>

              </div>

            </FormSection>

            <FormSection
              title="Remarque"
            >

              <textarea
                className="fiche-remarque-input"
                rows={4}
                placeholder="Informations complémentaires..."
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

            </FormSection>

            {error && (
              <div className="fiche-form-error">
                {error}
              </div>
            )}

          </div>

          <footer className="fiche-modal-footer">

            <div className="fiche-modal-footer-total">

              <span>
                TOTAL DE LA FICHE
              </span>

              <strong>
                {formatMoney(
                  total,
                )}
              </strong>

            </div>

            <div className="fiche-modal-footer-actions">

              <button
                type="button"
                className="fiches-caisse-secondary-button"
                onClick={
                  onClose
                }
              >
                Annuler
              </button>

              <button
                type="submit"
                className="fiches-caisse-primary-button"
              >
                <Check
                  size={18}
                />

                {mode ===
                'create'
                  ? 'Enregistrer la fiche'
                  : 'Enregistrer les modifications'}
              </button>

            </div>

          </footer>

        </form>

      </div>

    </div>
  )
}

/* =========================================================
   COMPOSANTS UI
   ========================================================= */

function KpiCard({
  icon,
  label,
  value,
  important = false,
}: {
  icon: ReactNode
  label: string
  value: string
  important?: boolean
}) {
  return (
    <div
      className={`fiche-kpi ${
        important
          ? 'important'
          : ''
      }`}
    >

      <div className="fiche-kpi-icon">
        {icon}
      </div>

      <div>

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  )
}

function SortableHeader({
  label,
  active,
  direction,
  onClick,
}: {
  label: string
  active: boolean
  direction: SortDirection
  onClick: () => void
}) {
  return (
    <th
      className="fiches-caisse-sortable"
      onClick={
        onClick
      }
    >
      {label}

      <span>
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

function ColumnToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="fiches-caisse-column-toggle">

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

function TypeBadge({
  type,
}: {
  type:
    TypeFicheCaisse
}) {
  return (
    <span
      className={`fiche-type-badge ${type.toLowerCase()}`}
    >
      {formatType(
        type,
      )}
    </span>
  )
}

function DetailKpi({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <div className="fiche-detail-kpi">

      <div>
        {icon}
      </div>

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  )
}

function DetailCashLine({
  label,
  count,
  total,
}: {
  label: string
  count: number
  total: number
}) {
  return (
    <div className="fiche-detail-cash-line">

      <strong>
        {label}
      </strong>

      <span>
        × {count}
      </span>

      <b>
        {formatMoney(
          total,
        )}
      </b>

    </div>
  )
}

function InfoLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="fiche-detail-info-line">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  )
}

function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="fiche-form-section">

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
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label
      className={`fiche-form-field ${
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

function CashInput({
  label,
  value,
  total,
  onChange,
}: {
  label: string
  value: number
  total: number
  onChange: (value: string) => void
}) {
  return (
    <div className="fiche-cash-input">

      <strong>
        {label}
      </strong>

      <span>
        ×
      </span>

      <input
        type="number"
        min="0"
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
      />

      <span>
        =
      </span>

      <b>
        {formatMoney(
          total,
        )}
      </b>

    </div>
  )
}

function PaymentCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <div className="fiche-payment-card">

      <h4>
        {icon}
        {title}
      </h4>

      {children}

    </div>
  )
}

function MoneyInput({
  value,
  onChange,
}: {
  value: number
  onChange: (value: string) => void
}) {
  return (
    <div className="fiche-money-input">

      <input
        type="number"
        min="0"
        step="0.01"
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
      />

      <span>
        €
      </span>

    </div>
  )
}

/* =========================================================
   CALCULS
   ========================================================= */

function getMontantBillets(
  fiche: FicheCaisse,
) {
  return (
    fiche.billets100 *
      100 +
    fiche.billets50 *
      50 +
    fiche.billets20 *
      20 +
    fiche.billets10 *
      10 +
    fiche.billets5 *
      5
  )
}

function getMontantPieces(
  fiche: FicheCaisse,
) {
  return (
    fiche.pieces2 *
      2 +
    fiche.pieces1 +
    fiche.pieces050 *
      0.5 +
    fiche.pieces020 *
      0.2 +
    fiche.pieces010 *
      0.1 +
    fiche.pieces005 *
      0.05 +
    fiche.pieces002 *
      0.02 +
    fiche.pieces001 *
      0.01
  )
}

function getMontantEspeces(
  fiche: FicheCaisse,
) {
  return (
    getMontantBillets(
      fiche,
    ) +
    getMontantPieces(
      fiche,
    )
  )
}

function getMontantDons(
  fiche: FicheCaisse,
) {
  return (
    fiche.nbDons5 *
      5 +
    fiche.nbDons3 *
      3 +
    fiche.montantDonsAutres
  )
}

function getTotalFiche(
  fiche: FicheCaisse,
) {
  return (
    getMontantEspeces(
      fiche,
    ) +
    fiche.montantCheques +
    fiche.montantTpe +
    fiche.montantVirement +
    getMontantDons(
      fiche,
    )
  )
}

/* =========================================================
   TRI
   ========================================================= */

function getSortValue(
  fiche: FicheCaisse,
  key: SortKey,
):
  | string
  | number {
  switch (key) {
    case 'numero':
      return fiche.numero

    case 'date':
      return fiche.date

    case 'type':
      return fiche.type

    case 'libelle':
      return fiche.libelle

    case 'ville':
      return (
        fiche.ville ||
        ''
      )

    case 'secteur':
      return (
        fiche.secteur ||
        ''
      )

    case 'especes':
      return getMontantEspeces(
        fiche,
      )

    case 'cheques':
      return fiche.montantCheques

    case 'tpe':
      return fiche.montantTpe

    case 'virement':
      return fiche.montantVirement

    case 'dons':
      return getMontantDons(
        fiche,
      )

    case 'total':
      return getTotalFiche(
        fiche,
      )
  }
}

/* =========================================================
   CREATION D'UNE FICHE VIDE
   ========================================================= */

function createEmptyFiche(
  fiches: FicheCaisse[],
): FicheCaisse {
  const year =
    new Date().getFullYear()

  return {
    id:
      Math.max(
        0,
        ...fiches.map(
          (fiche) =>
            fiche.id,
        ),
      ) + 1,

    numero:
      createFicheNumber(
        fiches,
      ),

    campagne:
      `OB ${year}`,

    date:
      getTodayInput(),

    type:
      'ENTREPRISE',

    libelle: '',

    ville: '',

    cp: '',

    secteur: '',

    billets100: 0,
    billets50: 0,
    billets20: 0,
    billets10: 0,
    billets5: 0,

    pieces2: 0,
    pieces1: 0,
    pieces050: 0,
    pieces020: 0,
    pieces010: 0,
    pieces005: 0,
    pieces002: 0,
    pieces001: 0,

    nbCheques: 0,

    montantCheques: 0,

    nbTpe: 0,

    montantTpe: 0,

    montantVirement: 0,

    nbDons5: 0,

    nbDons3: 0,

    montantDonsAutres: 0,

    remarque: '',
  }
}

function createFicheNumber(
  fiches: FicheCaisse[],
) {
  const year =
    new Date().getFullYear()

  const next =
    Math.max(
      0,
      ...fiches.map(
        (fiche) => {
          const match =
            fiche.numero.match(
              /(\d+)$/,
            )

          return match
            ? Number(
                match[1],
              )
            : 0
        },
      ),
    ) + 1

  return `FC-${year}-${String(
    next,
  ).padStart(
    4,
    '0',
  )}`
}

/* =========================================================
   PDF - COMPOSANTS DE DESSIN
   ========================================================= */

function drawPdfInfoBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  value: string,
  orange = false,
) {
  doc.setFillColor(
    orange
      ? 255
      : 249,
    orange
      ? 248
      : 251,
    orange
      ? 239
      : 253,
  )

  doc.setDrawColor(
    orange
      ? 255
      : 225,
    orange
      ? 200
      : 233,
    orange
      ? 145
      : 242,
  )

  doc.roundedRect(
    x,
    y,
    width,
    height,
    2,
    2,
    'FD',
  )

  doc.setFont(
    'helvetica',
    'bold',
  )

  doc.setFontSize(
    6.5,
  )

  doc.setTextColor(
    orange
      ? 181
      : 102,
    orange
      ? 106
      : 130,
    orange
      ? 36
      : 165,
  )

  doc.text(
    label,
    x + width / 2,
    y + 4.5,
    {
      align:
        'center',
    },
  )

  doc.setFontSize(
    8.5,
  )

  doc.setTextColor(
    orange
      ? 255
      : 31,
    orange
      ? 134
      : 52,
    orange
      ? 20
      : 77,
  )

  doc.text(
    value,
    x + width / 2,
    y + 10.5,
    {
      align:
        'center',
    },
  )
}

function drawPdfMoneyTable(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  title: string,
  rows: PdfMoneyRow[],
  totalLabel: string,
  totalValue: string,
) {
  const headerHeight =
    8

  const rowHeight =
    5.1

  const totalHeight =
    8

  const height =
    headerHeight +
    rows.length *
      rowHeight +
    totalHeight

  doc.setFillColor(
    255,
    255,
    255,
  )

  doc.setDrawColor(
    225,
    233,
    242,
  )

  doc.roundedRect(
    x,
    y,
    width,
    height,
    2,
    2,
    'FD',
  )

  doc.setFillColor(
    31,
    52,
    77,
  )

  doc.roundedRect(
    x,
    y,
    width,
    headerHeight,
    2,
    2,
    'F',
  )

  doc.rect(
    x,
    y +
      headerHeight -
      2,
    width,
    2,
    'F',
  )

  doc.setFont(
    'helvetica',
    'bold',
  )

  doc.setFontSize(
    8,
  )

  doc.setTextColor(
    255,
    255,
    255,
  )

  doc.text(
    title.toUpperCase(),
    x + 4,
    y + 5.3,
  )

  doc.setFontSize(
    6,
  )

  doc.text(
    'QTÉ',
    x + width -
      34,
    y + 5.3,
    {
      align:
        'center',
    },
  )

  doc.text(
    'MONTANT',
    x + width -
      4,
    y + 5.3,
    {
      align:
        'right',
    },
  )

  rows.forEach(
    (
      row,
      index,
    ) => {
      const rowY =
        y +
        headerHeight +
        index *
          rowHeight

      if (
        index %
          2 ===
        0
      ) {
        doc.setFillColor(
          248,
          250,
          252,
        )

        doc.rect(
          x + 0.5,
          rowY,
          width - 1,
          rowHeight,
          'F',
        )
      }

      doc.setFont(
        'helvetica',
        'normal',
      )

      doc.setFontSize(
        6.7,
      )

      doc.setTextColor(
        49,
        89,
        127,
      )

      doc.text(
        row.label,
        x + 4,
        rowY + 3.5,
      )

      doc.text(
        row.quantity,
        x + width -
          34,
        rowY + 3.5,
        {
          align:
            'center',
        },
      )

      doc.setFont(
        'helvetica',
        'bold',
      )

      doc.setTextColor(
        31,
        52,
        77,
      )

      doc.text(
        row.amount,
        x + width -
          4,
        rowY + 3.5,
        {
          align:
            'right',
        },
      )
    },
  )

  const totalY =
    y +
    headerHeight +
    rows.length *
      rowHeight

  doc.setDrawColor(
    220,
    228,
    236,
  )

  doc.line(
    x + 3,
    totalY,
    x + width -
      3,
    totalY,
  )

  doc.setFont(
    'helvetica',
    'bold',
  )

  doc.setFontSize(
    7,
  )

  doc.setTextColor(
    6,
    59,
    124,
  )

  doc.text(
    totalLabel,
    x + 4,
    totalY + 5.2,
  )

  doc.setFontSize(
    8,
  )

  doc.text(
    totalValue,
    x + width -
      4,
    totalY + 5.2,
    {
      align:
        'right',
    },
  )
}

function drawPdfSimpleTable(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  rows: PdfMoneyRow[],
  headerColor: [
    number,
    number,
    number,
  ],
) {
  const headerHeight =
    7

  const rowHeight =
    6.2

  const height =
    headerHeight +
    rows.length *
      rowHeight

  doc.setDrawColor(
    225,
    233,
    242,
  )

  doc.roundedRect(
    x,
    y,
    width,
    height,
    2,
    2,
    'S',
  )

  doc.setFillColor(
    headerColor[0],
    headerColor[1],
    headerColor[2],
  )

  doc.roundedRect(
    x,
    y,
    width,
    headerHeight,
    2,
    2,
    'F',
  )

  doc.rect(
    x,
    y +
      headerHeight -
      2,
    width,
    2,
    'F',
  )

  doc.setTextColor(
    255,
    255,
    255,
  )

  doc.setFont(
    'helvetica',
    'bold',
  )

  doc.setFontSize(
    6,
  )

  doc.text(
    'MODE',
    x + 4,
    y + 4.8,
  )

  doc.text(
    'NB',
    x + width -
      30,
    y + 4.8,
    {
      align:
        'center',
    },
  )

  doc.text(
    'MONTANT',
    x + width -
      4,
    y + 4.8,
    {
      align:
        'right',
    },
  )

  rows.forEach(
    (
      row,
      index,
    ) => {
      const rowY =
        y +
        headerHeight +
        index *
          rowHeight

      if (
        index %
          2 ===
        0
      ) {
        doc.setFillColor(
          248,
          250,
          252,
        )

        doc.rect(
          x + 0.5,
          rowY,
          width - 1,
          rowHeight,
          'F',
        )
      }

      doc.setFont(
        'helvetica',
        'normal',
      )

      doc.setFontSize(
        6.8,
      )

      doc.setTextColor(
        49,
        89,
        127,
      )

      doc.text(
        row.label,
        x + 4,
        rowY + 4,
      )

      doc.text(
        row.quantity,
        x + width -
          30,
        rowY + 4,
        {
          align:
            'center',
        },
      )

      doc.setFont(
        'helvetica',
        'bold',
      )

      doc.setTextColor(
        31,
        52,
        77,
      )

      doc.text(
        row.amount,
        x + width -
          4,
        rowY + 4,
        {
          align:
            'right',
        },
      )
    },
  )
}

/* =========================================================
   EXCEL
   ========================================================= */

function styleExcelHeader(
  row: Row,
) {
  row.font = {
    bold: true,
    color: {
      argb:
        'FFFFFFFF',
    },
  }

  row.fill = {
    type:
      'pattern',
    pattern:
      'solid',
    fgColor: {
      argb:
        'FF063B7C',
    },
  }

  row.alignment = {
    horizontal:
      'center',
    vertical:
      'middle',
  }
}

/* =========================================================
   FORMATAGE
   ========================================================= */

function formatType(
  type:
    TypeFicheCaisse,
) {
  switch (type) {
    case 'ENTREPRISE':
      return 'Entreprise'

    case 'MAIRIE':
      return 'Mairie'

    case 'ETABLISSEMENT':
      return 'Établissement'

    case 'STAND':
      return 'Stand'

    case 'AUTRE':
      return 'Autre'
  }
}

function formatMoney(
  value: number,
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

function formatMoneyPdf(
  value: number,
) {
  return formatMoney(
    value,
  ).replace(
    /[\u00A0\u202F]/g,
    ' ',
  )
}

function formatDate(
  value: string,
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
    value.split('-')

  if (
    !year ||
    !month ||
    !day
  ) {
    return value
  }

  return `${day}/${month}/${year}`
}

function getTodayInput() {
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

function getFileDate() {
  return getTodayInput()
}

function safeFilename(
  value: string,
) {
  return value
    .normalize(
      'NFD',
    )
    .replace(
      /[\u0300-\u036f]/g,
      '',
    )
    .replace(
      /[^a-zA-Z0-9-_]+/g,
      '_',
    )
    .replace(
      /^_+|_+$/g,
      '',
    )
}

/* =========================================================
   CHARGEMENT DES LOGOS
   ========================================================= */

async function loadImageAsDataUrl(
  url: string,
): Promise<string> {
  const response =
    await fetch(
      url,
    )

  if (
    !response.ok
  ) {
    throw new Error(
      `Impossible de charger l'image : ${url}`,
    )
  }

  const blob =
    await response.blob()

  return new Promise(
    (
      resolve,
      reject,
    ) => {
      const reader =
        new FileReader()

      reader.onloadend =
        () => {
          if (
            typeof reader.result ===
            'string'
          ) {
            resolve(
              reader.result,
            )
          } else {
            reject(
              new Error(
                'Conversion du logo impossible.',
              ),
            )
          }
        }

      reader.onerror =
        () => {
          reject(
            new Error(
              'Lecture du logo impossible.',
            ),
          )
        }

      reader.readAsDataURL(
        blob,
      )
    },
  )
}

/* =========================================================
   TELECHARGEMENT
   ========================================================= */

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

export default FichesCaisse