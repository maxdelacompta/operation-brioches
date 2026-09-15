import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  Archive,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Edit3,
  Euro,
  FileDown,
  FileSpreadsheet,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  User,
  X,
} from 'lucide-react'

import ExcelJS from 'exceljs'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

import './Commandes.css'

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

  contactNom?: string
  contactPrenom?: string
  email?: string
  telephone?: string

  conditionReglement?: string
  modeReglement?: string

  jdi?: string
  jdp?: string
  rf?: string

  archive?: boolean
}

type StatutCommande =
  | 'BROUILLON'
  | 'CONFIRMEE'
  | 'A_LIVRER'
  | 'LIVREE'
  | 'ANNULEE'

type Commande = {
  id: number
  numero: string

  donateurId: number

  campagne: string
  dateCommande: string

  quantite: number
  prixUnitaire: number

  statut: StatutCommande

  conditionReglement?: string
  modeReglement?: string

  jdi?: string
  jdp?: string
  rf?: string

  datePrevueLivraison?: string
  dateLivraison?: string

  remarque?: string
}

type CommandeFormMode =
  | 'create'
  | 'edit'

/* =========================================================
   DONATEURS TEMPORAIRES
   ========================================================= */

const donateurs: Donateur[] = [
  {
    id: 139,
    code: '139',
    type: 'ENTREPRISE',
    nom: 'SCEA HARAUX',

    numeroVoie: '34',
    adresse: 'VAYRINGE',
    cp: '54000',
    ville: 'NANCY',

    contactNom: 'HARAUX',
    contactPrenom: 'FRANCIS',

    email:
      'FRANCIS.HARAUX@WANADOO.FR',

    telephone:
      '06 87 89 95 74',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'VIREMENT',

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
    adresse:
      'RUE JACQUES VILLERMAUX',

    cp: '54000',
    ville: 'NANCY',

    contactNom: 'FELLRATH',
    contactPrenom: 'FREDERIC',

    email:
      'LAURENCE.GIRARD@OPCO-SANTE.FR',

    telephone:
      '03 90 22 22 39',

    conditionReglement:
      'SUR JUSTIFICATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
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
    adresse:
      'RUE VICTOR HUGO',

    cp: '54200',
    ville: 'BRULEY',

    contactNom: 'BUGNET',
    contactPrenom: 'MIREILLE',

    email:
      'COMMUNE.DE.BRULEY@ORANGE.FR',

    conditionReglement:
      'JUSTIFICATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'NON',
    rf: 'NON',

    archive: false,
  },

  {
    id: 124,
    code: '124',
    type: 'ENTREPRISE',
    nom:
      'HOTEL IBIS STYLES NANCY CENTRE GARE',

    numeroVoie: '3',
    adresse:
      "RUE DE L'ARMEE PATTON",

    cp: '54000',
    ville: 'NANCY',

    contactNom: 'GIRARD',
    contactPrenom: 'CHARLES',

    email:
      'charles.girard@groupesphb.fr',

    telephone:
      '06 60 44 93 36',

    conditionReglement:
      'SUR JUSTIFICATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',

    archive: false,
  },

  {
    id: 300,
    code: '300',
    type: 'ENTREPRISE',
    nom: 'ENTREPRISE MARTIN',

    adresse:
      'RUE DE LA GARE',

    cp: '54520',
    ville: 'LAXOU',

    contactNom: 'MARTIN',
    contactPrenom: 'PIERRE',

    email:
      'contact@martin.fr',

    telephone:
      '03 83 00 00 01',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'CHEQUE',

    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',

    archive: false,
  },

  {
    id: 301,
    code: '301',
    type: 'MAIRIE',
    nom: 'MAIRIE DE VILLERS',

    adresse:
      'PLACE DE LA MAIRIE',

    cp: '54600',
    ville:
      'VILLERS-LES-NANCY',

    contactNom: 'DUPONT',
    contactPrenom: 'MARIE',

    email:
      'mairie@villers.fr',

    telephone:
      '03 83 00 00 02',

    conditionReglement:
      'MANDAT ADMINISTRATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'NON',
    rf: 'OUI',

    archive: false,
  },

  {
    id: 302,
    code: '302',
    type: 'ENTREPRISE',
    nom: 'PHARMACIE DU PARC',

    adresse:
      'AVENUE DU PARC',

    cp: '54000',
    ville: 'NANCY',

    contactNom: 'BERNARD',
    contactPrenom: 'SOPHIE',

    email:
      'contact@pharmacieduparc.fr',

    telephone:
      '03 83 00 00 03',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'ESPECES',

    jdi: 'NON',
    jdp: 'NON',
    rf: 'NON',

    archive: false,
  },
]

/* =========================================================
   COMMANDES DE DÉMONSTRATION
   ========================================================= */

const initialCommandes: Commande[] = [
  {
    id: 1,

    numero:
      'CMD-2026-0001',

    donateurId: 139,

    campagne:
      'OB 2026',

    dateCommande:
      '2026-09-15',

    quantite: 50,

    prixUnitaire: 5,

    statut:
      'CONFIRMEE',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',

    datePrevueLivraison:
      '2026-09-22',

    remarque:
      'Très bon partenaire, à recontacter l’année prochaine.',
  },

  {
    id: 2,

    numero:
      'CMD-2026-0002',

    donateurId: 300,

    campagne:
      'OB 2026',

    dateCommande:
      '2026-09-15',

    quantite: 30,

    prixUnitaire: 5,

    statut:
      'A_LIVRER',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'CHEQUE',

    jdi: 'NON',
    jdp: 'OUI',
    rf: 'NON',
  },

  {
    id: 3,

    numero:
      'CMD-2026-0003',

    donateurId: 301,

    campagne:
      'OB 2026',

    dateCommande:
      '2026-09-15',

    quantite: 100,

    prixUnitaire: 5,

    statut:
      'CONFIRMEE',

    conditionReglement:
      'MANDAT ADMINISTRATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'NON',
    rf: 'OUI',
  },

  {
    id: 4,

    numero:
      'CMD-2026-0004',

    donateurId: 302,

    campagne:
      'OB 2026',

    dateCommande:
      '2026-09-15',

    quantite: 20,

    prixUnitaire: 5,

    statut:
      'BROUILLON',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'ESPECES',

    jdi: 'NON',
    jdp: 'NON',
    rf: 'NON',
  },

  {
    id: 5,

    numero:
      'CMD-2026-0005',

    donateurId: 124,

    campagne:
      'OB 2026',

    dateCommande:
      '2026-09-16',

    quantite: 40,

    prixUnitaire: 5,

    statut:
      'CONFIRMEE',

    conditionReglement:
      'SUR JUSTIFICATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },

  {
    id: 6,

    numero:
      'CMD-2026-0006',

    donateurId: 136,

    campagne:
      'OB 2026',

    dateCommande:
      '2026-09-16',

    quantite: 60,

    prixUnitaire: 5,

    statut:
      'A_LIVRER',

    conditionReglement:
      'SUR JUSTIFICATIF',

    modeReglement:
      'CHEQUE',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },

  {
    id: 7,

    numero:
      'CMD-2026-0007',

    donateurId: 218,

    campagne:
      'OB 2026',

    dateCommande:
      '2026-09-16',

    quantite: 70,

    prixUnitaire: 5,

    statut:
      'BROUILLON',

    conditionReglement:
      'JUSTIFICATIF',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'NON',
    rf: 'NON',
  },

  {
    id: 8,

    numero:
      'CMD-2026-0008',

    donateurId: 139,

    campagne:
      'OB 2026',

    dateCommande:
      '2026-09-17',

    quantite: 45,

    prixUnitaire: 5,

    statut:
      'A_LIVRER',

    conditionReglement:
      'À RÉCEPTION',

    modeReglement:
      'VIREMENT',

    jdi: 'OUI',
    jdp: 'OUI',
    rf: 'NON',
  },
]

/* =========================================================
   PAGE PRINCIPALE
   ========================================================= */

function Commandes() {
  const [
    commandes,
    setCommandes,
  ] =
    useState<Commande[]>(
      () => {
        const saved =
          localStorage.getItem(
            'ob-commandes',
          )

        if (!saved) {
          return initialCommandes
        }

        try {
          return JSON.parse(
            saved,
          ) as Commande[]
        } catch {
          return initialCommandes
        }
      },
    )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    campagneFilter,
    setCampagneFilter,
  ] =
    useState('Toutes')

  const [
    statutFilter,
    setStatutFilter,
  ] =
    useState('Tous')

  const [
    collapsedDays,
    setCollapsedDays,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({})

  const [
    selectedCommande,
    setSelectedCommande,
  ] =
    useState<
      Commande | null
    >(
      commandes[0] ??
        null,
    )

  const [
    modalMode,
    setModalMode,
  ] =
    useState<CommandeFormMode>(
      'create',
    )

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(false)

  const [
    editingCommande,
    setEditingCommande,
  ] =
    useState<
      Commande | null
    >(null)

  const [
    actionMenuId,
    setActionMenuId,
  ] =
    useState<
      number | null
    >(null)

  const [
    exportMenuOpen,
    setExportMenuOpen,
  ] =
    useState(false)

  /* =======================================================
     LOCAL STORAGE
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      'ob-commandes',
      JSON.stringify(
        commandes,
      ),
    )
  }, [commandes])

  /* =======================================================
     FILTRAGE
     ======================================================= */

  const filteredCommandes =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase()

      return commandes.filter(
        (commande) => {
          const donateur =
            getDonateur(
              commande.donateurId,
            )

          const searchable =
            [
              commande.numero,
              commande.campagne,
              donateur?.nom,
              donateur?.ville,
              donateur?.code,
              donateur?.contactNom,
              donateur?.contactPrenom,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()

          const matchesSearch =
            !normalizedSearch ||
            searchable.includes(
              normalizedSearch,
            )

          const matchesCampagne =
            campagneFilter ===
              'Toutes' ||
            commande.campagne ===
              campagneFilter

          const matchesStatut =
            statutFilter ===
              'Tous' ||
            commande.statut ===
              statutFilter

          return (
            matchesSearch &&
            matchesCampagne &&
            matchesStatut
          )
        },
      )
    }, [
      commandes,
      search,
      campagneFilter,
      statutFilter,
    ])

  /* =======================================================
     REGROUPEMENT PAR DATE
     ======================================================= */

  const groupes =
    useMemo(() => {
      const map =
        new Map<
          string,
          Commande[]
        >()

      filteredCommandes.forEach(
        (commande) => {
          if (
            !map.has(
              commande.dateCommande,
            )
          ) {
            map.set(
              commande.dateCommande,
              [],
            )
          }

          map
            .get(
              commande.dateCommande,
            )
            ?.push(
              commande,
            )
        },
      )

      return Array.from(
        map.entries(),
      )
        .sort(
          (
            [dateA],
            [dateB],
          ) =>
            dateA.localeCompare(
              dateB,
            ),
        )
        .map(
          ([
            date,
            commandesJour,
          ]) => ({
            date,
            commandes:
              commandesJour,
          }),
        )
    }, [
      filteredCommandes,
    ])

  /* =======================================================
     CAMPAGNES
     ======================================================= */

  const campagnes =
    useMemo(() => {
      return [
        'Toutes',

        ...Array.from(
          new Set(
            commandes.map(
              (commande) =>
                commande.campagne,
            ),
          ),
        ),
      ]
    }, [commandes])

  /* =======================================================
     KPI
     ======================================================= */

  const totalCommandes =
    filteredCommandes.length

  const totalQuantite =
    filteredCommandes.reduce(
      (
        total,
        commande,
      ) =>
        total +
        commande.quantite,
      0,
    )

  const totalMontant =
    filteredCommandes.reduce(
      (
        total,
        commande,
      ) =>
        total +
        commande.quantite *
          commande.prixUnitaire,
      0,
    )

  const totalALivrer =
    filteredCommandes.filter(
      (commande) =>
        commande.statut ===
        'A_LIVRER',
    ).length

  const totalConfirmees =
    filteredCommandes.filter(
      (commande) =>
        commande.statut ===
        'CONFIRMEE',
    ).length

  /* =======================================================
     JOUR
     ======================================================= */

  function toggleDay(
    date: string,
  ) {
    setCollapsedDays(
      (current) => ({
        ...current,

        [date]:
          !current[date],
      }),
    )
  }

  /* =======================================================
     NOUVELLE COMMANDE
     ======================================================= */

  function openCreateCommande() {
    setModalMode(
      'create',
    )

    setEditingCommande(
      null,
    )

    setModalOpen(true)

    setActionMenuId(
      null,
    )

    setExportMenuOpen(
      false,
    )
  }

  /* =======================================================
     MODIFIER
     ======================================================= */

  function openEditCommande(
    commande: Commande,
  ) {
    setModalMode(
      'edit',
    )

    setEditingCommande(
      commande,
    )

    setModalOpen(true)

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     SAUVEGARDER
     ======================================================= */

  function saveCommande(
    commande: Commande,
  ) {
    if (
      modalMode ===
      'edit'
    ) {
      setCommandes(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              commande.id
                ? commande
                : item,
          ),
      )
    } else {
      setCommandes(
        (current) => [
          ...current,
          commande,
        ],
      )
    }

    setSelectedCommande(
      commande,
    )

    setModalOpen(false)

    setEditingCommande(
      null,
    )
  }

  /* =======================================================
     ANNULER COMMANDE
     ======================================================= */

  function cancelCommande(
    commande: Commande,
  ) {
    const updated: Commande =
      {
        ...commande,

        statut:
          'ANNULEE',
      }

    setCommandes(
      (current) =>
        current.map(
          (item) =>
            item.id ===
            commande.id
              ? updated
              : item,
        ),
    )

    if (
      selectedCommande?.id ===
      commande.id
    ) {
      setSelectedCommande(
        updated,
      )
    }

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     RÉINITIALISER
     ======================================================= */

  function resetFilters() {
    setSearch('')

    setCampagneFilter(
      'Toutes',
    )

    setStatutFilter(
      'Tous',
    )
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
        'Commandes',
      )

    worksheet.columns = [
      {
        header:
          'N° commande',
        key: 'numero',
        width: 20,
      },

      {
        header: 'Date',
        key: 'date',
        width: 14,
      },

      {
        header:
          'Campagne',
        key: 'campagne',
        width: 14,
      },

      {
        header:
          'Code donateur',
        key:
          'codeDonateur',
        width: 18,
      },

      {
        header:
          'Donateur',
        key: 'donateur',
        width: 35,
      },

      {
        header: 'Ville',
        key: 'ville',
        width: 22,
      },

      {
        header:
          'Quantité',
        key: 'quantite',
        width: 12,
      },

      {
        header:
          'Prix unitaire',
        key:
          'prixUnitaire',
        width: 15,
      },

      {
        header:
          'Montant',
        key: 'montant',
        width: 16,
      },

      {
        header:
          'Statut',
        key: 'statut',
        width: 16,
      },

      {
        header:
          'Condition règlement',
        key:
          'conditionReglement',
        width: 24,
      },

      {
        header:
          'Mode règlement',
        key:
          'modeReglement',
        width: 19,
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
        header:
          'Livraison prévue',
        key:
          'datePrevueLivraison',
        width: 19,
      },

      {
        header:
          'Livraison',
        key:
          'dateLivraison',
        width: 16,
      },

      {
        header:
          'Remarque',
        key: 'remarque',
        width: 40,
      },
    ]

    filteredCommandes.forEach(
      (commande) => {
        const donateur =
          getDonateur(
            commande.donateurId,
          )

        const montant =
          commande.quantite *
          commande.prixUnitaire

        worksheet.addRow({
          numero:
            commande.numero,

          date:
            formatDateShort(
              commande.dateCommande,
            ),

          campagne:
            commande.campagne,

          codeDonateur:
            donateur
              ? `DON-${donateur.code.padStart(
                  6,
                  '0',
                )}`
              : '',

          donateur:
            donateur?.nom ||
            '',

          ville:
            donateur?.ville ||
            '',

          quantite:
            commande.quantite,

          prixUnitaire:
            commande.prixUnitaire,

          montant,

          statut:
            getStatutLabel(
              commande.statut,
            ),

          conditionReglement:
            commande.conditionReglement ||
            '',

          modeReglement:
            formatPaymentMethod(
              commande.modeReglement,
            ),

          jdi:
            commande.jdi ||
            '',

          jdp:
            commande.jdp ||
            '',

          rf:
            commande.rf ||
            '',

          datePrevueLivraison:
            commande.datePrevueLivraison
              ? formatDateShort(
                  commande.datePrevueLivraison,
                )
              : '',

          dateLivraison:
            commande.dateLivraison
              ? formatDateShort(
                  commande.dateLivraison,
                )
              : '',

          remarque:
            commande.remarque ||
            '',
        })
      },
    )

    const headerRow =
      worksheet.getRow(1)

    headerRow.height = 28

    headerRow.font = {
      bold: true,

      color: {
        argb:
          'FFFFFFFF',
      },
    }

    headerRow.fill = {
      type: 'pattern',

      pattern: 'solid',

      fgColor: {
        argb:
          'FF063B7C',
      },
    }

    headerRow.alignment = {
      vertical:
        'middle',

      horizontal:
        'center',
    }

    worksheet.eachRow(
      {
        includeEmpty:
          false,
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
              rowNumber >
              1
            ) {
              cell.alignment =
                {
                  vertical:
                    'middle',

                  wrapText:
                    true,
                }
            }
          },
        )

        if (
          rowNumber > 1
        ) {
          row.height = 23
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

      const commande =
        filteredCommandes[
          rowNumber - 2
        ]

      if (
        commande?.statut ===
        'ANNULEE'
      ) {
        row.eachCell(
          (cell) => {
            cell.fill = {
              type:
                'pattern',

              pattern:
                'solid',

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
              type:
                'pattern',

              pattern:
                'solid',

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
        column: 18,
      },
    }

    worksheet.views = [
      {
        state:
          'frozen',

        ySplit: 1,
      },
    ]

    worksheet.pageSetup = {
      orientation:
        'landscape',

      paperSize: 9,

      fitToPage:
        true,

      fitToWidth:
        1,

      fitToHeight:
        0,

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

    const exportDate =
      getExportDate()

    worksheet.headerFooter =
      {
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
      `Commandes_${getFileDate()}.xlsx`,
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
      'Liste des commandes',
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
      `${filteredCommandes.length} commande${
        filteredCommandes.length >
        1
          ? 's'
          : ''
      }`,
      7,
      15,
    )

    const rows =
      filteredCommandes.map(
        (commande) => {
          const donateur =
            getDonateur(
              commande.donateurId,
            )

          return [
            commande.numero,

            formatDateShort(
              commande.dateCommande,
            ),

            donateur?.nom ||
              '',

            donateur?.ville ||
              '',

            commande.campagne,

            String(
              commande.quantite,
            ),

            formatMoney(
              commande.prixUnitaire,
            ),

            formatMoney(
              commande.quantite *
                commande.prixUnitaire,
            ),

            getStatutLabel(
              commande.statut,
            ),

            formatPaymentMethod(
              commande.modeReglement,
            ),

            commande.jdi ||
              '',

            commande.jdp ||
              '',

            commande.rf ||
              '',
          ]
        },
      )

    autoTable(
      doc,
      {
        startY: 19,

        head: [[
          'N° commande',
          'Date',
          'Donateur',
          'Ville',
          'Campagne',
          'Qté',
          'Prix unit.',
          'Montant',
          'Statut',
          'Règlement',
          'JDI',
          'JDP',
          'RF',
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
          font:
            'helvetica',

          fontSize:
            5.7,

          cellPadding:
            1.3,

          overflow:
            'linebreak',

          valign:
            'middle',

          lineColor: [
            225,
            233,
            242,
          ],

          lineWidth:
            0.15,

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

          fontStyle:
            'bold',

          halign:
            'center',
        },

        showHead:
          'everyPage',

        didParseCell: (
          data,
        ) => {
          if (
            data.section ===
              'body'
          ) {
            const commande =
              filteredCommandes[
                data.row.index
              ]

            if (
              commande?.statut ===
              'ANNULEE'
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
      `Commandes_${getFileDate()}.pdf`,
    )

    setExportMenuOpen(
      false,
    )
  }

  return (
    <div className="commandes-page">

      {/* ===================================================
          HEADER
          =================================================== */}

      <header className="commandes-header">

        <div>

          <span className="commandes-eyebrow">
            Opération Brioches
          </span>

          <h1>
            Commandes
          </h1>

          <p>
            Suivez et organisez
            vos commandes jour
            par jour.
          </p>

        </div>

        <div className="commandes-header-actions">

          {/* EXPORT */}

          <div className="commandes-export">

            <button
              type="button"
              className="commandes-secondary-button commandes-export-button"
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
              <div className="commandes-export-menu">

                <button
                  type="button"
                  onClick={
                    exportExcel
                  }
                >
                  <FileSpreadsheet
                    size={19}
                  />

                  <div>

                    <strong>
                      Excel
                    </strong>

                    <span>
                      Exporter la vue actuelle en .xlsx
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
                    size={19}
                  />

                  <div>

                    <strong>
                      PDF
                    </strong>

                    <span>
                      Exporter la vue actuelle en PDF
                    </span>

                  </div>

                </button>

              </div>
            )}

          </div>

          {/* NOUVELLE COMMANDE */}

          <button
            type="button"
            className="commandes-primary-button"
            onClick={
              openCreateCommande
            }
          >
            <Plus
              size={20}
            />

            Nouvelle commande
          </button>

        </div>

      </header>

      {/* ===================================================
          FILTRES
          =================================================== */}

      <section className="commandes-filter-card">

        <div className="commandes-search">

          <Search
            size={20}
          />

          <input
            value={search}
            placeholder="Rechercher un donateur, une commune, un numéro de commande..."
            onChange={(
              event,
            ) =>
              setSearch(
                event.target.value,
              )
            }
          />

        </div>

        <label className="commandes-filter-field">

          <span>
            Campagne
          </span>

          <select
            value={
              campagneFilter
            }
            onChange={(
              event,
            ) =>
              setCampagneFilter(
                event.target.value,
              )
            }
          >

            {campagnes.map(
              (campagne) => (
                <option
                  key={
                    campagne
                  }
                  value={
                    campagne
                  }
                >
                  {
                    campagne
                  }
                </option>
              ),
            )}

          </select>

        </label>

        <label className="commandes-filter-field">

          <span>
            Statut
          </span>

          <select
            value={
              statutFilter
            }
            onChange={(
              event,
            ) =>
              setStatutFilter(
                event.target.value,
              )
            }
          >

            <option value="Tous">
              Tous
            </option>

            <option value="BROUILLON">
              Brouillon
            </option>

            <option value="CONFIRMEE">
              Confirmée
            </option>

            <option value="A_LIVRER">
              À livrer
            </option>

            <option value="LIVREE">
              Livrée
            </option>

            <option value="ANNULEE">
              Annulée
            </option>

          </select>

        </label>

        <button
          type="button"
          className="commandes-reset-button"
          onClick={
            resetFilters
          }
        >
          <RefreshCw
            size={18}
          />

          Réinitialiser
        </button>

      </section>

      {/* ===================================================
          KPI
          =================================================== */}

      <section className="commandes-kpi-grid">

        <CommandeKpi
          icon={
            <CalendarDays />
          }
          value={String(
            totalCommandes,
          )}
          label="commandes"
        />

        <CommandeKpi
          icon={
            <ShoppingCart />
          }
          value={formatNumber(
            totalQuantite,
          )}
          label="unités commandées"
        />

        <CommandeKpi
          icon={
            <Euro />
          }
          value={formatMoney(
            totalMontant,
          )}
          label="montant total"
        />

        <CommandeKpi
          icon={
            <Truck />
          }
          value={String(
            totalALivrer,
          )}
          label="commandes à livrer"
        />

        <CommandeKpi
          icon={
            <CheckCircle2 />
          }
          value={String(
            totalConfirmees,
          )}
          label="commandes confirmées"
        />

      </section>

      {/* ===================================================
          JOURS
          =================================================== */}

      <section className="commandes-days">

        {groupes.length ===
        0 ? (
          <div className="commandes-empty">

            <Search
              size={40}
            />

            <strong>
              Aucune commande
            </strong>

            <span>
              Aucune commande ne
              correspond à votre
              recherche.
            </span>

          </div>
        ) : (
          groupes.map(
            ({
              date,
              commandes:
                commandesJour,
            }) => {
              const collapsed =
                collapsedDays[
                  date
                ] ?? false

              const quantiteJour =
                commandesJour.reduce(
                  (
                    total,
                    commande,
                  ) =>
                    total +
                    commande.quantite,
                  0,
                )

              const montantJour =
                commandesJour.reduce(
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
                <article
                  key={date}
                  className="commande-day"
                >

                  <button
                    type="button"
                    className="commande-day-header"
                    onClick={() =>
                      toggleDay(
                        date,
                      )
                    }
                  >

                    <div className="commande-day-title">

                      <div className="commande-day-calendar">

                        <CalendarDays
                          size={20}
                        />

                      </div>

                      <strong>
                        {formatDateLong(
                          date,
                        )}
                      </strong>

                    </div>

                    <div className="commande-day-summary">

                      <span>
                        {
                          commandesJour.length
                        }{' '}
                        commande
                        {commandesJour.length >
                        1
                          ? 's'
                          : ''}
                      </span>

                      <i />

                      <span>
                        {
                          quantiteJour
                        }{' '}
                        unités
                      </span>

                      <i />

                      <span>
                        {formatMoney(
                          montantJour,
                        )}
                      </span>

                      {collapsed ? (
                        <ChevronDown
                          size={20}
                        />
                      ) : (
                        <ChevronUp
                          size={20}
                        />
                      )}

                    </div>

                  </button>

                  {!collapsed && (
                    <div className="commande-day-table-wrapper">

                      <table className="commande-day-table">

                        <thead>

                          <tr>

                            <th>
                              N° commande
                            </th>

                            <th>
                              Donateur
                            </th>

                            <th>
                              Commune
                            </th>

                            <th>
                              Quantité
                            </th>

                            <th>
                              Prix unitaire
                            </th>

                            <th>
                              Montant
                            </th>

                            <th>
                              Statut
                            </th>

                            <th>
                              Règlement
                            </th>

                            <th>
                              Actions
                            </th>

                          </tr>

                        </thead>

                        <tbody>

                          {commandesJour.map(
                            (
                              commande,
                            ) => {
                              const donateur =
                                getDonateur(
                                  commande.donateurId,
                                )

                              const montant =
                                commande.quantite *
                                commande.prixUnitaire

                              return (
                                <tr
                                  key={
                                    commande.id
                                  }
                                  className={
                                    selectedCommande?.id ===
                                    commande.id
                                      ? 'selected'
                                      : ''
                                  }
                                  onClick={() =>
                                    setSelectedCommande(
                                      commande,
                                    )
                                  }
                                >

                                  <td className="commande-number">
                                    {
                                      commande.numero
                                    }
                                  </td>

                                  <td className="commande-donor-table">

                                    <strong>
                                      {donateur?.nom ||
                                        'Donateur inconnu'}
                                    </strong>

                                    <span>
                                      DON-
                                      {donateur?.code.padStart(
                                        6,
                                        '0',
                                      ) ||
                                        '------'}
                                    </span>

                                  </td>

                                  <td>
                                    {donateur?.ville ||
                                      '-'}
                                  </td>

                                  <td className="commande-quantity">
                                    {
                                      commande.quantite
                                    }
                                  </td>

                                  <td>
                                    {formatMoney(
                                      commande.prixUnitaire,
                                    )}
                                  </td>

                                  <td className="commande-amount">
                                    {formatMoney(
                                      montant,
                                    )}
                                  </td>

                                  <td>

                                    <StatutBadge
                                      statut={
                                        commande.statut
                                      }
                                    />

                                  </td>

                                  <td>
                                    {formatPaymentMethod(
                                      commande.modeReglement,
                                    )}
                                  </td>

                                  <td>

                                    <div
                                      className="commande-actions-wrapper"
                                      onClick={(
                                        event,
                                      ) =>
                                        event.stopPropagation()
                                      }
                                    >

                                      <button
                                        type="button"
                                        className="commande-actions-button"
                                        title="Actions"
                                        onClick={() =>
                                          setActionMenuId(
                                            (
                                              current,
                                            ) =>
                                              current ===
                                              commande.id
                                                ? null
                                                : commande.id,
                                          )
                                        }
                                      >
                                        <MoreVertical
                                          size={19}
                                        />
                                      </button>

                                      {actionMenuId ===
                                        commande.id && (
                                        <div className="commande-actions-menu">

                                          <button
                                            type="button"
                                            onClick={() =>
                                              openEditCommande(
                                                commande,
                                              )
                                            }
                                          >
                                            <Edit3
                                              size={17}
                                            />

                                            Modifier
                                          </button>

                                          {commande.statut !==
                                            'ANNULEE' && (
                                            <button
                                              type="button"
                                              className="danger"
                                              onClick={() =>
                                                cancelCommande(
                                                  commande,
                                                )
                                              }
                                            >
                                              <Archive
                                                size={17}
                                              />

                                              Annuler la commande
                                            </button>
                                          )}

                                        </div>
                                      )}

                                    </div>

                                  </td>

                                </tr>
                              )
                            },
                          )}

                        </tbody>

                      </table>

                    </div>
                  )}

                </article>
              )
            },
          )
        )}

      </section>

      {/* ===================================================
          DETAIL
          =================================================== */}

      {selectedCommande && (
        <CommandeDetail
          commande={
            selectedCommande
          }
          onEdit={() =>
            openEditCommande(
              selectedCommande,
            )
          }
        />
      )}

      {/* ===================================================
          MODALE
          =================================================== */}

      {modalOpen && (
        <CommandeModal
          mode={
            modalMode
          }
          commande={
            editingCommande
          }
          commandes={
            commandes
          }
          onClose={() => {
            setModalOpen(
              false,
            )

            setEditingCommande(
              null,
            )
          }}
          onSave={
            saveCommande
          }
        />
      )}

    </div>
  )
}

/* =========================================================
   DETAIL COMMANDE
   ========================================================= */

function CommandeDetail({
  commande,
  onEdit,
}: {
  commande: Commande
  onEdit: () => void
}) {
  const donateur =
    getDonateur(
      commande.donateurId,
    )

  const montant =
    commande.quantite *
    commande.prixUnitaire

  return (
    <section className="commande-detail-card">

      <div className="commande-detail-tabs">

        <button
          type="button"
          className="active"
        >
          Détails
        </button>

        <button type="button">
          Suivi
        </button>

        <button type="button">
          Documents
        </button>

        <button type="button">
          Historique
        </button>

        <button
          type="button"
          className="commande-detail-edit"
          onClick={
            onEdit
          }
        >
          <Edit3
            size={17}
          />

          Modifier
        </button>

      </div>

      <div className="commande-detail-grid">

        <div className="commande-detail-section">

          <h3>
            Informations générales
          </h3>

          <CommandeInfoRow
            label="N° commande"
            value={
              commande.numero
            }
          />

          <CommandeInfoRow
            label="Date de commande"
            value={formatDateShort(
              commande.dateCommande,
            )}
          />

          <CommandeInfoRow
            label="Campagne"
            value={
              commande.campagne
            }
          />

          <div className="commande-info-row">

            <span>
              Statut
            </span>

            <strong>
              <StatutBadge
                statut={
                  commande.statut
                }
              />
            </strong>

          </div>

        </div>

        <div className="commande-detail-section">

          <h3>
            Donateur
          </h3>

          {donateur ? (
            <div className="commande-donateur-card">

              <div className="commande-donateur-header">

                <div className="commande-donateur-icon">

                  <Building2
                    size={24}
                  />

                </div>

                <div>

                  <strong>
                    {
                      donateur.nom
                    }
                  </strong>

                  <span>
                    DON-
                    {donateur.code.padStart(
                      6,
                      '0',
                    )}
                  </span>

                </div>

              </div>

              <DonateurMiniLine
                icon={
                  <MapPin
                    size={16}
                  />
                }
              >
                {formatDonateurAddress(
                  donateur,
                )}
              </DonateurMiniLine>

              <DonateurMiniLine
                icon={
                  <User
                    size={16}
                  />
                }
              >
                {[
                  donateur.contactPrenom,
                  donateur.contactNom,
                ]
                  .filter(Boolean)
                  .join(' ') ||
                  'Aucun contact'}
              </DonateurMiniLine>

              <DonateurMiniLine
                icon={
                  <Phone
                    size={16}
                  />
                }
              >
                {donateur.telephone ||
                  'Non renseigné'}
              </DonateurMiniLine>

              <DonateurMiniLine
                icon={
                  <Mail
                    size={16}
                  />
                }
              >
                {donateur.email ||
                  'Non renseigné'}
              </DonateurMiniLine>

            </div>
          ) : (
            <div className="commande-donateur-missing">
              Donateur introuvable
            </div>
          )}

        </div>

        <div className="commande-detail-section">

          <h3>
            Détail de la commande
          </h3>

          <CommandeInfoRow
            label="Quantité"
            value={String(
              commande.quantite,
            )}
          />

          <CommandeInfoRow
            label="Prix unitaire"
            value={formatMoney(
              commande.prixUnitaire,
            )}
          />

          <CommandeInfoRow
            label="Montant total"
            value={formatMoney(
              montant,
            )}
            strong
          />

          <CommandeInfoRow
            label="Condition de règlement"
            value={
              commande.conditionReglement ||
              '-'
            }
          />

          <CommandeInfoRow
            label="Mode de règlement"
            value={
              formatPaymentMethod(
                commande.modeReglement,
              )
            }
          />

          <CommandeInfoRow
            label="Livraison prévue"
            value={
              commande.datePrevueLivraison
                ? formatDateShort(
                    commande.datePrevueLivraison,
                  )
                : '-'
            }
          />

          <CommandeInfoRow
            label="Date de livraison"
            value={
              commande.dateLivraison
                ? formatDateShort(
                    commande.dateLivraison,
                  )
                : '-'
            }
          />

        </div>

      </div>

      <div className="commande-detail-bottom">

        <div>

          <h3>
            Suivi documentaire
          </h3>

          <div className="commande-doc-badges">

            <DocumentBadge
              label="JDI"
              value={
                commande.jdi
              }
            />

            <DocumentBadge
              label="JDP"
              value={
                commande.jdp
              }
            />

            <DocumentBadge
              label="RF"
              value={
                commande.rf
              }
            />

          </div>

        </div>

        <div className="commande-remarque">

          <h3>
            Remarque
          </h3>

          <p>
            {commande.remarque ||
              'Aucune remarque.'}
          </p>

        </div>

      </div>

    </section>
  )
}

/* =========================================================
   MODALE
   ========================================================= */

function CommandeModal({
  mode,
  commande,
  commandes,
  onClose,
  onSave,
}: {
  mode:
    CommandeFormMode

  commande:
    Commande | null

  commandes:
    Commande[]

  onClose: () => void

  onSave: (
    commande: Commande,
  ) => void
}) {
  const [
    donorSearch,
    setDonorSearch,
  ] =
    useState('')

  const [
    selectedDonateurId,
    setSelectedDonateurId,
  ] =
    useState<
      number | null
    >(
      commande?.donateurId ??
        null,
    )

  const selectedDonateur =
    selectedDonateurId
      ? getDonateur(
          selectedDonateurId,
        )
      : undefined

  const nextId =
    Math.max(
      0,
      ...commandes.map(
        (item) =>
          item.id,
      ),
    ) + 1

  const [
    form,
    setForm,
  ] =
    useState<Commande>(
      commande
        ? {
            ...commande,
          }
        : {
            id: nextId,

            numero:
              createCommandeNumber(
                commandes,
              ),

            donateurId: 0,

            campagne:
              'OB 2026',

            dateCommande:
              getTodayInput(),

            quantite: 0,

            prixUnitaire: 5,

            statut:
              'BROUILLON',

            conditionReglement:
              '',

            modeReglement:
              '',

            jdi: 'NON',
            jdp: 'NON',
            rf: 'NON',

            datePrevueLivraison:
              '',

            dateLivraison:
              '',

            remarque:
              '',
          },
    )

  const [
    error,
    setError,
  ] =
    useState('')

  const filteredDonateurs =
    useMemo(() => {
      const search =
        donorSearch
          .trim()
          .toLowerCase()

      return donateurs
        .filter(
          (donateur) => {
            if (
              donateur.archive
            ) {
              return false
            }

            if (!search) {
              return true
            }

            const searchable =
              [
                donateur.nom,
                donateur.code,
                donateur.ville,
                donateur.contactNom,
                donateur.contactPrenom,
                donateur.telephone,
                donateur.email,
              ]
                .filter(
                  Boolean,
                )
                .join(' ')
                .toLowerCase()

            return searchable.includes(
              search,
            )
          },
        )
        .slice(
          0,
          8,
        )
    }, [
      donorSearch,
    ])

  function selectDonateur(
    donateur: Donateur,
  ) {
    setSelectedDonateurId(
      donateur.id,
    )

    setForm(
      (current) => ({
        ...current,

        donateurId:
          donateur.id,

        conditionReglement:
          donateur.conditionReglement ||
          '',

        modeReglement:
          donateur.modeReglement ||
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
      }),
    )

    setError('')
  }

  function updateField<
    K extends keyof Commande,
  >(
    key: K,
    value:
      Commande[K],
  ) {
    setForm(
      (current) => ({
        ...current,

        [key]: value,
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

    if (
      !selectedDonateurId
    ) {
      setError(
        'Sélectionne un donateur avant de créer la commande.',
      )

      return
    }

    if (
      !form.dateCommande
    ) {
      setError(
        'La date de commande est obligatoire.',
      )

      return
    }

    if (
      form.quantite <= 0
    ) {
      setError(
        'La quantité doit être supérieure à 0.',
      )

      return
    }

    if (
      form.prixUnitaire <=
      0
    ) {
      setError(
        'Le prix unitaire doit être supérieur à 0.',
      )

      return
    }

    onSave({
      ...form,

      donateurId:
        selectedDonateurId,
    })
  }

  const montant =
    form.quantite *
    form.prixUnitaire

  return (
    <div
      className="commande-modal-overlay"
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

      <div className="commande-modal">

        <header className="commande-modal-header">

          <div>

            <span className="commandes-eyebrow">
              Commandes
            </span>

            <h2>
              {mode ===
              'create'
                ? 'Nouvelle commande'
                : 'Modifier la commande'}
            </h2>

            {mode ===
              'edit' && (
              <p>
                {
                  form.numero
                }
              </p>
            )}

          </div>

          <button
            type="button"
            className="commande-modal-close"
            onClick={
              onClose
            }
          >
            <X
              size={23}
            />
          </button>

        </header>

        <form
          onSubmit={
            handleSubmit
          }
        >

          <div className="commande-modal-content">

            {/* =================================================
                DONATEUR
                ================================================= */}

            <CommandeFormSection
              number="1"
              title="Sélection du donateur"
            >

              {!selectedDonateur ? (
                <>

                  <div className="commande-donor-search">

                    <Search
                      size={20}
                    />

                    <input
                      value={
                        donorSearch
                      }
                      placeholder="Rechercher par nom, code, ville, contact..."
                      onChange={(
                        event,
                      ) =>
                        setDonorSearch(
                          event.target.value,
                        )
                      }
                    />

                  </div>

                  <div className="commande-donor-results">

                    {filteredDonateurs.map(
                      (donateur) => (
                        <button
                          type="button"
                          key={
                            donateur.id
                          }
                          onClick={() =>
                            selectDonateur(
                              donateur,
                            )
                          }
                        >

                          <div className="commande-search-donor-icon">

                            <Building2
                              size={22}
                            />

                          </div>

                          <div>

                            <strong>
                              {
                                donateur.nom
                              }
                            </strong>

                            <span>
                              DON-
                              {donateur.code.padStart(
                                6,
                                '0',
                              )}

                              {donateur.ville
                                ? ` • ${donateur.ville}`
                                : ''}
                            </span>

                          </div>

                        </button>
                      ),
                    )}

                  </div>

                </>
              ) : (
                <div className="commande-selected-donor">

                  <div className="commande-selected-donor-header">

                    <div className="commande-selected-donor-icon">

                      <Building2
                        size={27}
                      />

                    </div>

                    <div>

                      <strong>
                        {
                          selectedDonateur.nom
                        }
                      </strong>

                      <span>
                        DON-
                        {selectedDonateur.code.padStart(
                          6,
                          '0',
                        )}
                      </span>

                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDonateurId(
                          null,
                        )

                        setForm(
                          (
                            current,
                          ) => ({
                            ...current,

                            donateurId:
                              0,
                          }),
                        )

                        setDonorSearch(
                          '',
                        )
                      }}
                    >
                      Changer
                    </button>

                  </div>

                  <div className="commande-selected-donor-info">

                    <DonateurMiniLine
                      icon={
                        <MapPin
                          size={17}
                        />
                      }
                    >
                      {formatDonateurAddress(
                        selectedDonateur,
                      )}
                    </DonateurMiniLine>

                    <DonateurMiniLine
                      icon={
                        <User
                          size={17}
                        />
                      }
                    >
                      {[
                        selectedDonateur.contactPrenom,
                        selectedDonateur.contactNom,
                      ]
                        .filter(
                          Boolean,
                        )
                        .join(' ') ||
                        'Aucun contact'}
                    </DonateurMiniLine>

                    <DonateurMiniLine
                      icon={
                        <Phone
                          size={17}
                        />
                      }
                    >
                      {selectedDonateur.telephone ||
                        'Téléphone non renseigné'}
                    </DonateurMiniLine>

                    <DonateurMiniLine
                      icon={
                        <Mail
                          size={17}
                        />
                      }
                    >
                      {selectedDonateur.email ||
                        'Email non renseigné'}
                    </DonateurMiniLine>

                  </div>

                  <div className="commande-donor-selected-status">

                    <CheckCircle2
                      size={17}
                    />

                    Donateur sélectionné

                  </div>

                </div>
              )}

            </CommandeFormSection>

            {/* =================================================
                INFORMATIONS
                ================================================= */}

            <CommandeFormSection
              number="2"
              title="Informations de la commande"
            >

              <div className="commande-form-grid">

                <CommandeField
                  label="N° commande"
                >
                  <input
                    value={
                      form.numero
                    }
                    disabled
                  />
                </CommandeField>

                <CommandeField
                  label="Campagne"
                >
                  <select
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
                  >

                    <option value="OB 2025">
                      OB 2025
                    </option>

                    <option value="OB 2026">
                      OB 2026
                    </option>

                    <option value="OB 2027">
                      OB 2027
                    </option>

                  </select>
                </CommandeField>

                <CommandeField
                  label="Date de commande"
                  wide
                >
                  <input
                    type="date"
                    value={
                      form.dateCommande
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'dateCommande',
                        event.target.value,
                      )
                    }
                  />
                </CommandeField>

                <CommandeField
                  label="Quantité"
                >
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      form.quantite
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'quantite',
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                  />
                </CommandeField>

                <CommandeField
                  label="Prix unitaire (€)"
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.prixUnitaire
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'prixUnitaire',
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                  />
                </CommandeField>

              </div>

              <div className="commande-total-box">

                <span>
                  Montant total de la commande
                </span>

                <strong>
                  {formatMoney(
                    montant,
                  )}
                </strong>

              </div>

            </CommandeFormSection>

            {/* =================================================
                RÈGLEMENT
                ================================================= */}

            <CommandeFormSection
              number="3"
              title="Règlement & suivi"
            >

              <div className="commande-form-grid">

                <CommandeField
                  label="Condition de règlement"
                >
                  <input
                    value={
                      form.conditionReglement
                    }
                    placeholder="Ex. À réception"
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'conditionReglement',
                        event.target.value,
                      )
                    }
                  />
                </CommandeField>

                <CommandeField
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

                    <option value="MANDAT">
                      Mandat administratif
                    </option>

                    <option value="TPE">
                      TPE
                    </option>

                  </select>
                </CommandeField>

                <CommandeField
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
                </CommandeField>

                <CommandeField
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
                </CommandeField>

                <CommandeField
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
                </CommandeField>

                <CommandeField
                  label="Statut"
                >
                  <select
                    value={
                      form.statut
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'statut',
                        event.target.value as StatutCommande,
                      )
                    }
                  >

                    <option value="BROUILLON">
                      Brouillon
                    </option>

                    <option value="CONFIRMEE">
                      Confirmée
                    </option>

                    <option value="A_LIVRER">
                      À livrer
                    </option>

                    <option value="LIVREE">
                      Livrée
                    </option>

                    <option value="ANNULEE">
                      Annulée
                    </option>

                  </select>
                </CommandeField>

                <CommandeField
                  label="Date prévue de livraison"
                >
                  <input
                    type="date"
                    value={
                      form.datePrevueLivraison
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'datePrevueLivraison',
                        event.target.value,
                      )
                    }
                  />
                </CommandeField>

                <CommandeField
                  label="Date de livraison"
                >
                  <input
                    type="date"
                    value={
                      form.dateLivraison
                    }
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'dateLivraison',
                        event.target.value,
                      )
                    }
                  />
                </CommandeField>

                <CommandeField
                  label="Remarque"
                  wide
                >
                  <textarea
                    rows={5}
                    value={
                      form.remarque
                    }
                    placeholder="Ajouter une remarque concernant cette commande..."
                    onChange={(
                      event,
                    ) =>
                      updateField(
                        'remarque',
                        event.target.value,
                      )
                    }
                  />
                </CommandeField>

              </div>

            </CommandeFormSection>

            {error && (
              <div className="commande-form-error">
                {error}
              </div>
            )}

          </div>

          <footer className="commande-modal-footer">

            <button
              type="button"
              className="commandes-secondary-button"
              onClick={
                onClose
              }
            >
              Annuler
            </button>

            <button
              type="submit"
              className="commandes-primary-button"
            >
              <Check
                size={19}
              />

              {mode ===
              'create'
                ? 'Créer la commande'
                : 'Enregistrer les modifications'}
            </button>

          </footer>

        </form>

      </div>

    </div>
  )
}

/* =========================================================
   SOUS-COMPOSANTS
   ========================================================= */

function CommandeKpi({
  icon,
  value,
  label,
}: {
  icon: ReactNode
  value: string
  label: string
}) {
  return (
    <div className="commande-kpi">

      <div className="commande-kpi-icon">
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

function StatutBadge({
  statut,
}: {
  statut:
    StatutCommande
}) {
  return (
    <span
      className={`commande-status commande-status-${statut.toLowerCase()}`}
    >
      {getStatutLabel(
        statut,
      )}
    </span>
  )
}

function CommandeFormSection({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <section className="commande-form-section">

      <div className="commande-form-section-title">

        <span>
          {number}
        </span>

        <h3>
          {title}
        </h3>

      </div>

      {children}

    </section>
  )
}

function CommandeField({
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
      className={`commande-field ${
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

function CommandeInfoRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      className={`commande-info-row ${
        strong
          ? 'strong'
          : ''
      }`}
    >

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  )
}

function DonateurMiniLine({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="commande-donateur-line">

      {icon}

      <span>
        {children}
      </span>

    </div>
  )
}

function DocumentBadge({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  const yes =
    value === 'OUI'

  return (
    <div className="commande-document-badge">

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

/* =========================================================
   HELPERS DONATEURS
   ========================================================= */

function getDonateur(
  id: number,
) {
  return donateurs.find(
    (donateur) =>
      donateur.id === id,
  )
}

function formatDonateurAddress(
  donateur: Donateur,
) {
  const ligne1 = [
    donateur.numeroVoie,
    donateur.adresse,
  ]
    .filter(Boolean)
    .join(' ')

  const ligne2 = [
    donateur.cp,
    donateur.ville,
  ]
    .filter(Boolean)
    .join(' ')

  if (
    ligne1 &&
    ligne2
  ) {
    return `${ligne1} — ${ligne2}`
  }

  return (
    ligne1 ||
    ligne2 ||
    'Adresse non renseignée'
  )
}

/* =========================================================
   STATUT
   ========================================================= */

function getStatutLabel(
  statut:
    StatutCommande,
) {
  switch (statut) {
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
  }
}

/* =========================================================
   FORMAT
   ========================================================= */

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
  ).format(value)
}

function formatNumber(
  value: number,
) {
  return new Intl.NumberFormat(
    'fr-FR',
  ).format(value)
}

function formatDateLong(
  date: string,
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      weekday:
        'long',

      day:
        'numeric',

      month:
        'long',

      year:
        'numeric',
    },
  ).format(
    new Date(
      `${date}T12:00:00`,
    ),
  )
}

function formatDateShort(
  date: string,
) {
  return new Intl.DateTimeFormat(
    'fr-FR',
  ).format(
    new Date(
      `${date}T12:00:00`,
    ),
  )
}

function formatPaymentMethod(
  value?: string,
) {
  switch (value) {
    case 'CHEQUE':
      return 'Chèque'

    case 'ESPECES':
      return 'Espèces'

    case 'MANDAT':
      return 'Mandat administratif'

    case 'VIREMENT':
      return 'Virement'

    case 'TPE':
      return 'TPE'

    default:
      return value || '-'
  }
}

/* =========================================================
   DATE
   ========================================================= */

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

/* =========================================================
   NUMERO COMMANDE
   ========================================================= */

function createCommandeNumber(
  commandes:
    Commande[],
) {
  const year =
    new Date().getFullYear()

  const yearPrefix =
    `CMD-${year}-`

  const yearCommandes =
    commandes.filter(
      (commande) =>
        commande.numero.startsWith(
          yearPrefix,
        ),
    )

  const max =
    yearCommandes.reduce(
      (
        currentMax,
        commande,
      ) => {
        const match =
          commande.numero.match(
            /(\d+)$/,
          )

        const value =
          match
            ? Number(
                match[1],
              )
            : 0

        return Math.max(
          currentMax,
          value,
        )
      },
      0,
    )

  return `CMD-${year}-${String(
    max + 1,
  ).padStart(
    4,
    '0',
  )}`
}

/* =========================================================
   EXPORT HELPERS
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
      today.getMonth() +
        1,
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

export default Commandes