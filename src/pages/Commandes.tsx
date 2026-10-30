import {
  Fragment,
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

import {
  useSearchParams,
  Link,
} from 'react-router-dom'

import ExcelJS from 'exceljs'

import {
  jsPDF,
} from 'jspdf'

import autoTable from 'jspdf-autotable'

import {
  useObData,
} from '../contexts/ObDataContext'

import type {
  Commande,
  CommandeLivraison,
  Donateur,
  StatutCommande,
} from '../types/ob'

import { useUsers } from '../contexts/UsersContext'
import { useJustificatifs } from '../contexts/JustificatifsContext'
import { generateAndDownloadJustificatifPdf } from '../services/justificatifPdf'
import type { JustificatifDon } from '../types/justificatifs'

import './Commandes.css'

// Une campagne peut avoir été stockée sous '2025', 'OB 2025' ou 'OB2025'.
function memeCampagneEntreprise(a: string, b: string): boolean {
  if (a === b) return true
  if (/^TEST[-_ ]/i.test(a) || /^TEST[-_ ]/i.test(b)) return false
  const aa = a.match(/(?:19|20)\d{2}/)?.[0]
  const bb = b.match(/(?:19|20)\d{2}/)?.[0]
  return Boolean(aa && bb && aa === bb)
}

type CommandeFormMode =
  | 'create'
  | 'edit'

type GroupeStructure = {
  key: string
  payeur: Donateur | undefined
  campagne: string
  commandes: Commande[]
  nombreSites: number
  nombreDates: number
  totalBrioches: number
  montantTotal: number
}

/** Une structure multi-sites regroupe les commandes d'un même payeur et d'une même campagne.
 *  Chaque commande conserve son propre numéro et sa propre identité financière.
 */
function regrouperStructures(commandes: Commande[], donateurs: Donateur[]): GroupeStructure[] {
  const map = new Map<string, Commande[]>()
  for (const commande of commandes) {
    const cleCampagne = commande.campagne.match(/(?:19|20)\d{2}/)?.[0] ?? commande.campagne
    const cle = `${cleCampagne}:${commande.donateurId}`
    const groupe = map.get(cle) ?? []
    groupe.push(commande)
    map.set(cle, groupe)
  }

  const marqueAncienMulti = (value: string | undefined) =>
    /multi[\s-]*dates?|plusieurs?\s+(?:sites?|lieux)|multi[\s-]*sites?/i.test(value ?? '')

  const resultat: GroupeStructure[] = []
  map.forEach((commandesPayeur, key) => {
    const dates = new Set<string>()
    const lieux = new Set<string>()
    let contientRepartition = false

    for (const commande of commandesPayeur) {
      const lignes = commande.livraisons ?? []
      if (lignes.length >= 2 || marqueAncienMulti(commande.dateCommande) ||
          marqueAncienMulti(commande.datePrevueLivraison) || marqueAncienMulti(commande.remarque)) {
        contientRepartition = true
      }
      if (lignes.length) {
        for (const ligne of lignes) {
          if (ligne.datePrevue) dates.add(ligne.datePrevue)
          const lieu = [ligne.adresse, ligne.cp, ligne.ville, ligne.destinataireNom]
            .join('|').trim().toLocaleLowerCase('fr')
          if (lieu.replace(/\|/g, '')) lieux.add(lieu)
        }
      } else {
        const date = commande.datePrevueLivraison || commande.dateLivraison || commande.dateCommande
        if (date) dates.add(date)
        const payeur = donateurs.find(d => d.id === commande.donateurId)
        const lieu = [payeur?.adresse, payeur?.cp, payeur?.ville].join('|').trim().toLocaleLowerCase('fr')
        if (lieu.replace(/\|/g, '')) lieux.add(lieu)
      }
    }

    if (!contientRepartition && !(commandesPayeur.length > 1 && (dates.size > 1 || lieux.size > 1))) return

    const payeur = donateurs.find(d => d.id === commandesPayeur[0].donateurId)
    resultat.push({
      key,
      payeur,
      campagne: commandesPayeur[0].campagne,
      commandes: [...commandesPayeur].sort((a,b)=>a.dateCommande.localeCompare(b.dateCommande)),
      nombreSites: lieux.size,
      nombreDates: dates.size,
      totalBrioches: commandesPayeur.reduce((total,c)=>total+c.quantite,0),
      montantTotal: commandesPayeur.reduce((total,c)=>total+c.quantite*c.prixUnitaire,0),
    })
  })
  return resultat.sort((a,b)=>(a.payeur?.nom ?? '').localeCompare(b.payeur?.nom ?? '', 'fr'))
}


function Commandes() {
  const {
    donateurs,
    commandes,
    setCommandes,
    selectedCampagne,
    activeCampagne,
    campagnes: campagnesEnregistrees,
  } = useObData()
  const {currentUser} = useUsers()
  const admin = currentUser?.role === 'administrateur'
  const campagneTravail = selectedCampagne ?? activeCampagne
  const campagneId = campagneTravail?.id ?? ''
  const campagneFermee = campagneTravail?.statut === 'TERMINEE'
  const lectureSeule = campagneFermee && !admin
  const peutModifierCommande = (commande: Commande) => {
    const campagneSource = campagnesEnregistrees.find(c => memeCampagneEntreprise(c.id, commande.campagne))
    return Boolean(admin || (campagneSource && campagneSource.statut !== 'TERMINEE'))
  }

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams()

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    statutFilter,
    setStatutFilter,
  ] = useState('Tous')

  const [
    collapsedDays,
    setCollapsedDays,
  ] = useState<
    Record<string, boolean>
  >({})

  const [
    selectedCommande,
    setSelectedCommande,
  ] =
    useState<Commande | null>(
      commandes[0] ?? null,
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
  ] = useState(false)

  const [
    editingCommande,
    setEditingCommande,
  ] =
    useState<Commande | null>(
      null,
    )

  const [
    preselectedDonateurId,
    setPreselectedDonateurId,
  ] =
    useState<number | null>(
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
    exportMenuOpen,
    setExportMenuOpen,
  ] = useState(false)

  // Une vue dédiée évite de mélanger les structures multi-sites et le calendrier courant.
  const vueStructures = searchParams.get('vue') === 'structures'
  const [expandedStructures, setExpandedStructures] = useState<Record<string, boolean>>({})
  function changerVue(structures: boolean) {
    setSearchParams(current => {
      const next = new URLSearchParams(current)
      if (structures) next.set('vue', 'structures')
      else next.delete('vue')
      // Les filtres de recherche / sélection provenant de l'URL sont conservés.
      return next
    })
  }

  // Affichage des destinations directement sous chaque commande,
  // sans modifier sa sélection ou ouvrir le formulaire.
  const [expandedLivraisons, setExpandedLivraisons] =
    useState<Record<number, boolean>>({})

  /* =========================================================
     OUVERTURE DEPUIS DONATEURS
     ========================================================= */

  useEffect(() => {
    const donateurParam =
      searchParams.get(
        'donateur',
      )

    const commandeParam =
      searchParams.get(
        'commande',
      )

    if (
      commandeParam
    ) {
      const commandeId =
        Number(
          commandeParam,
        )

      const found =
        commandes.find(
          (commande) =>
            commande.id ===
            commandeId,
        )

      if (found) {
        setSelectedCommande(
          found,
        )
      }
    }

    if (
      donateurParam
    ) {
      const donateurId =
        Number(
          donateurParam,
        )

      const exists =
        donateurs.some(
          (donateur) =>
            donateur.id ===
            donateurId,
        )

      if (exists && campagneId && !lectureSeule) {
        setPreselectedDonateurId(
          donateurId,
        )

        setModalMode(
          'create',
        )

        setEditingCommande(
          null,
        )

        setModalOpen(true)
      }
    }
  }, [
    commandes,
    donateurs,
    searchParams,
    campagneId,
    lectureSeule,
  ])

  useEffect(() => {
    setSelectedCommande(null)
    setModalOpen(false)
    setEditingCommande(null)
    setActionMenuId(null)
  }, [campagneId])

  /* =========================================================
     HELPERS LOCAUX
     ========================================================= */

  function getDonateur(
    id: number,
  ) {
    return donateurs.find(
      (donateur) =>
        donateur.id === id,
    )
  }

  /* =========================================================
     FILTRES
     ========================================================= */

  const filteredCommandes =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase()

      return commandes.filter(
        (commande) => {
          const donateur =
            donateurs.find(
              (item) =>
                item.id ===
                commande.donateurId,
            )

          const searchable = [
            commande.numero,
            commande.campagne,
            commande.dateCommande,
            commande.datePrevueLivraison,
            donateur?.nom,
            donateur?.ville,
            donateur?.code,
            donateur?.contactNom,
            donateur?.contactPrenom,
            ...(commande.livraisons ?? []).flatMap(l => [l.destinataireNom, l.adresse, l.ville, l.cp]),
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
            Boolean(campagneId) && memeCampagneEntreprise(commande.campagne, campagneId)

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
      donateurs,
      search,
      campagneId,
      statutFilter,
    ])

  const structuresMultisites = useMemo(
    () => regrouperStructures(filteredCommandes, donateurs),
    [filteredCommandes, donateurs],
  )
  const commandesStructuresIds = useMemo(
    () => new Set(structuresMultisites.flatMap(structure => structure.commandes.map(c => c.id))),
    [structuresMultisites],
  )
  const commandesClassiques = useMemo(
    () => filteredCommandes.filter(c => !commandesStructuresIds.has(c.id)),
    [filteredCommandes, commandesStructuresIds],
  )
  const commandesVue = vueStructures
    ? filteredCommandes.filter(c => commandesStructuresIds.has(c.id))
    : commandesClassiques

  useEffect(() => {
    setSelectedCommande(current => current && !commandesVue.some(c=>c.id===current.id) ? null : current)
  }, [vueStructures, filteredCommandes])

  /* =========================================================
     GROUPES PAR DATE
     ========================================================= */

  const groupes =
    useMemo(() => {
      const map =
        new Map<
          string,
          Commande[]
        >()

      commandesClassiques.forEach(
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
      commandesClassiques,
    ])

  /* =========================================================
     KPI
     ========================================================= */

  const totalCommandes =
    commandesVue.length

  const totalQuantite =
    commandesVue.reduce(
      (
        total,
        commande,
      ) =>
        total +
        commande.quantite,
      0,
    )

  const totalMontant =
    commandesVue.reduce(
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
    commandesVue.filter(
      (commande) =>
        commande.statut ===
        'A_LIVRER',
    ).length

  const totalConfirmees =
    commandesVue.filter(
      (commande) =>
        commande.statut ===
        'CONFIRMEE',
    ).length

  /* =========================================================
     JOURNÉES
     ========================================================= */

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

  function expandAllDays() {
    setCollapsedDays({})
  }

  function collapseAllDays() {
    const next =
      groupes.reduce<
        Record<
          string,
          boolean
        >
      >(
        (
          result,
          groupe,
        ) => {
          result[
            groupe.date
          ] = true

          return result
        },
        {},
      )

    setCollapsedDays(
      next,
    )
  }

  /* =========================================================
     MODALE
     ========================================================= */

  function openCreateCommande() {
    if (!campagneId || lectureSeule) return
    setModalMode(
      'create',
    )

    setEditingCommande(
      null,
    )

    setPreselectedDonateurId(
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

  function openEditCommande(
    commande: Commande,
  ) {
    if (!memeCampagneEntreprise(commande.campagne, campagneId) || !peutModifierCommande(commande)) return
    setModalMode(
      'edit',
    )

    setEditingCommande(
      commande,
    )

    setPreselectedDonateurId(
      commande.donateurId,
    )

    setModalOpen(true)

    setActionMenuId(
      null,
    )
  }

  function closeModal() {
    setModalOpen(false)

    setEditingCommande(
      null,
    )

    setPreselectedDonateurId(
      null,
    )

    if (
      searchParams.has(
        'donateur',
      )
    ) {
      searchParams.delete(
        'donateur',
      )

      setSearchParams(
        searchParams,
        {
          replace: true,
        },
      )
    }
  }

  function saveCommande(
    commande: Commande,
  ) {
    if (!campagneId || !memeCampagneEntreprise(commande.campagne, campagneId)) return
    if (modalMode === 'edit') {
      const original = commandes.find(item => item.id === commande.id)
      if (!original || !peutModifierCommande(original)) return
      // Une commande ne peut pas être déplacée silencieusement vers une autre campagne.
      if (!memeCampagneEntreprise(original.campagne, commande.campagne)) return
    } else if (lectureSeule) return
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

    closeModal()
  }

  function cancelCommande(
    commande: Commande,
  ) {
    if (!memeCampagneEntreprise(commande.campagne, campagneId) || !peutModifierCommande(commande)) return
    const updated: Commande = {
      ...commande,
      statut: 'ANNULEE',
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

  function resetFilters() {
    setSearch('')
    setStatutFilter(
      'Tous',
    )
  }

  /* =========================================================
     EXPORT EXCEL
     ========================================================= */

  async function exportExcel() {
    const workbook =
      new ExcelJS.Workbook()

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
        key: 'code',
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
        key: 'prix',
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
          'Règlement',
        key: 'reglement',
        width: 18,
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
    ]

    commandesVue.forEach(
      (commande) => {
        const donateur =
          getDonateur(
            commande.donateurId,
          )

        worksheet.addRow({
          numero:
            commande.numero,

          date:
            formatDateShort(
              commande.dateCommande,
            ),

          campagne:
            commande.campagne,

          code:
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

          prix:
            commande.prixUnitaire,

          montant:
            commande.quantite *
            commande.prixUnitaire,

          statut:
            getStatutLabel(
              commande.statut,
            ),

          reglement:
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

    worksheet.autoFilter = {
      from: {
        row: 1,
        column: 1,
      },
      to: {
        row: 1,
        column: 14,
      },
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

  /* =========================================================
     EXPORT PDF
     ========================================================= */

  function exportPdf() {
    const doc =
      new jsPDF({
        orientation:
          'landscape',
        unit: 'mm',
        format: 'a4',
      })

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

    const rows =
      commandesVue.map(
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
          ]
        },
      )

    autoTable(
      doc,
      {
        startY: 15,

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
        ]],

        body: rows,

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
      `Commandes_${getFileDate()}.pdf`,
    )

    setExportMenuOpen(
      false,
    )
  }

  return (
    <div className="commandes-page">

      {campagneFermee && (
        <div className="commandes-campagne-verrouillee" role="status">
          <strong>Campagne terminée · {campagneTravail?.nom}</strong>
          <span>{admin ? 'Accès administrateur : corrections autorisées.' : 'Consultation uniquement : créations, modifications et annulations verrouillées.'}</span>
        </div>
      )}

      <header className="commandes-header">

        <div>

          <span className="commandes-eyebrow">
            Opération Brioches
          </span>

          <h1>
            Commandes
          </h1>

          <p>
            Suivez et organisez vos commandes jour par jour.
          </p>

        </div>

        <div className="commandes-header-actions">

          <div className="commandes-export">

            <button
              type="button"
              className="commandes-secondary-button commandes-export-button"
              onClick={() =>
                setExportMenuOpen(
                  (current) =>
                    !current,
                )
              }
            >
              <Download size={18} />

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
                      Exporter la vue actuelle
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
                      Exporter la vue actuelle
                    </span>
                  </div>
                </button>

              </div>
            )}

          </div>

          <button
            type="button"
            className="commandes-primary-button"
            disabled={!campagneId || lectureSeule}
            title={lectureSeule ? 'Campagne terminée : modification réservée aux administrateurs' : undefined}
            onClick={
              openCreateCommande
            }
          >
            <Plus size={20} />
            Nouvelle commande
          </button>

        </div>

      </header>

      <section className="commandes-filter-card">

        <div className="commandes-search">

          <Search size={20} />

          <input
            value={search}
            placeholder="Rechercher un donateur, une commune, une commande..."
            onChange={(
              event,
            ) =>
              setSearch(
                event.target.value,
              )
            }
          />

        </div>

        <div className="commandes-filter-field commandes-campagne-selection">
          <span>Campagne sélectionnée</span>
          <strong>{campagneTravail?.nom ?? 'Aucune campagne'}{campagneFermee ? ' · Terminée' : ''}</strong>
        </div>

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

      <nav className="commande-vues" aria-label="Types de commandes entreprises">
        <button
          type="button"
          className={`commande-vue-button ${!vueStructures ? 'is-active' : ''}`}
          aria-current={!vueStructures ? 'page' : undefined}
          onClick={() => changerVue(false)}
        >
          <CalendarDays size={18}/>
          Commandes par journée <span>{commandesClassiques.length}</span>
        </button>
        <button
          type="button"
          className={`commande-vue-button ${vueStructures ? 'is-active' : ''}`}
          aria-current={vueStructures ? 'page' : undefined}
          onClick={() => changerVue(true)}
        >
          <Building2 size={18}/>
          Structures multi-sites / multi-dates <span>{structuresMultisites.length}</span>
        </button>
      </nav>
      <p className="commande-vue-note">
        {vueStructures
          ? 'Classement par structure payeuse. Chaque commande conserve son numéro et son règlement ; ses livraisons peuvent avoir plusieurs adresses et dates.'
          : 'Commandes classiques classées par date. Les structures avec plusieurs sites ou dates possèdent désormais leur propre rubrique.'}
      </p>

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
          icon={<Euro />}
          value={formatMoney(
            totalMontant,
          )}
          label="montant total"
        />

        <CommandeKpi
          icon={<Truck />}
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

      {!vueStructures && groupes.length >
        0 && (
        <div className="commandes-days-toolbar">

          <span>
            Affichage des journées
          </span>

          <div>

            <button
              type="button"
              onClick={
                expandAllDays
              }
            >
              <ChevronDown
                size={17}
              />
              Tout déployer
            </button>

            <button
              type="button"
              onClick={
                collapseAllDays
              }
            >
              <ChevronUp
                size={17}
              />
              Tout replier
            </button>

          </div>

        </div>
      )}

      {vueStructures ? (
        <section className="commande-structures" aria-label="Structures multi-sites et multi-dates">
          {structuresMultisites.length === 0 && (
            <div className="commande-structures-empty">
              <Building2 size={32}/>
              <strong>Aucune structure multi-sites pour ces filtres</strong>
              <p>Crée une commande avec plusieurs destinations ou dates, ou vérifie tes filtres.</p>
            </div>
          )}
          {structuresMultisites.map(structure => {
            const expanded = expandedStructures[structure.key] ?? true
            return (
              <article className="commande-structure-card" key={structure.key}>
                <button
                  type="button"
                  className="commande-structure-header"
                  aria-expanded={expanded}
                  onClick={() => setExpandedStructures(current => ({...current,[structure.key]:!expanded}))}
                >
                  <span className="commande-structure-name">
                    <span className="commande-structure-icon"><Building2 size={21}/></span>
                    <span>
                      <strong>{structure.payeur?.nom || 'Structure inconnue'}</strong>
                      <small>Payeur unique par commande · {structure.campagne}</small>
                    </span>
                  </span>
                  <span className="commande-structure-metrics">
                    <span>{structure.commandes.length} commande(s)</span>
                    <span>{structure.nombreSites} site(s)</span>
                    <span>{structure.nombreDates} date(s)</span>
                    <strong>{formatNumber(structure.totalBrioches)} brioches</strong>
                    <strong>{formatMoney(structure.montantTotal)}</strong>
                    {expanded ? <ChevronUp size={18}/> : <ChevronDown size={18}/>}
                  </span>
                </button>
                {expanded && (
                  <div className="commande-structure-orders">
                    {structure.commandes.map(commande => {
                      const livraisons = commande.livraisons ?? []
                      const totalReparti = livraisons.reduce((total,ligne)=>total+(Number(ligne.quantite)||0),0)
                      return (
                        <div className="commande-structure-order" key={commande.id}>
                          <div className="commande-structure-order-head">
                            <div className="commande-structure-order-title">
                              <strong>{commande.numero}</strong>
                              <span>{formatDateShort(commande.dateCommande)}</span>
                              <StatutBadge statut={commande.statut}/>
                            </div>
                            <div className="commande-structure-order-actions">
                              <span>{formatNumber(commande.quantite)} brioches · {formatMoney(commande.quantite * commande.prixUnitaire)}</span>
                              <button type="button" onClick={() => setSelectedCommande(commande)}>Voir la commande</button>
                              <Link to={`/finance/justificatifs-dons?commande=${commande.id}`} className="commande-jd-link">
                                <FileDown size={14}/> JDI / JDP
                              </Link>
                              <button type="button" onClick={() => openEditCommande(commande)}><Edit3 size={14}/> Modifier</button>
                            </div>
                          </div>
                          {livraisons.length > 0 ? (
                            <>
                              <div className="commande-structure-deliveries">
                                {livraisons.map((ligne,index) => (
                                  <div className="commande-structure-delivery" key={ligne.id || `${commande.id}-${index}`}>
                                    <MapPin size={16}/>
                                    <div>
                                      <strong>{ligne.destinataireNom || 'Destination à définir'}</strong>
                                      <small>{[ligne.adresse,ligne.cp,ligne.ville].filter(Boolean).join(' · ') || 'Adresse non renseignée'}</small>
                                    </div>
                                    <span><CalendarDays size={14}/> {ligne.datePrevue ? formatDateShort(ligne.datePrevue) : 'Date à définir'}</span>
                                    <strong>{formatNumber(ligne.quantite)} brioches</strong>
                                    <span className={`commande-structure-status ${ligne.dateLivraison ? 'is-delivered' : ''}`}>{ligne.dateLivraison ? 'Livrée' : 'À planifier'}</span>
                                  </div>
                                ))}
                              </div>
                              <div className={`commande-structure-total ${totalReparti===commande.quantite?'is-valid':'is-invalid'}`}>
                                Répartition : <strong>{formatNumber(totalReparti)} / {formatNumber(commande.quantite)} brioches</strong>
                              </div>
                            </>
                          ) : (
                            <p className="commande-structure-single">
                              {/multi[\s-]*dates?|plusieurs?\s+(?:sites?|lieux)/i.test(`${commande.dateCommande} ${commande.datePrevueLivraison || ''}`)
                                ? 'Ancienne commande classée multi-sites : les lieux et dates doivent encore être détaillés via « Modifier ».'
                                : `Livraison unique · ${commande.datePrevueLivraison ? formatDateShort(commande.datePrevueLivraison) : 'Date à préciser'} · ${formatNumber(commande.quantite)} brioches`}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </article>
            )
          })}
        </section>
      ) : (
      <section className="commandes-days">

        {groupes.map(
          ({
            date,
            commandes:
              commandesJour,
          }) => {
            const collapsed =
              collapsedDays[
                date
              ] ?? false

            const quantity =
              commandesJour.reduce(
                (
                  total,
                  commande,
                ) =>
                  total +
                  commande.quantite,
                0,
              )

            const amount =
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
                      } commande
                      {commandesJour.length >
                      1
                        ? 's'
                        : ''}
                    </span>

                    <i />

                    <span>
                      {quantity} unités
                    </span>

                    <i />

                    <span>
                      {formatMoney(
                        amount,
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
                            const destinations = commande.livraisons ?? []
                            const isExpanded = Boolean(expandedLivraisons[commande.id])
                            const totalReparti = destinations.reduce(
                              (sum, livraison) => sum + (Number(livraison.quantite) || 0), 0,
                            )

                            return (
                              <Fragment key={commande.id}>
                              <tr
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
                                  <div className="commande-number-with-dispatch">
                                    <strong>{commande.numero}</strong>
                                    {destinations.length > 0 && (
                                      <button
                                        type="button"
                                        className="commande-dispatch-toggle"
                                        aria-expanded={isExpanded}
                                        aria-controls={`commande-dispatch-${commande.id}`}
                                        onClick={(event) => {
                                          event.stopPropagation()
                                          setExpandedLivraisons(current => ({
                                            ...current,
                                            [commande.id]: !current[commande.id],
                                          }))
                                        }}
                                      >
                                        <Truck size={14} aria-hidden="true" />
                                        <span>{destinations.length} livraison{destinations.length > 1 ? 's' : ''}</span>
                                        {isExpanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                                      </button>
                                    )}
                                  </div>
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
                                    commande.quantite *
                                      commande.prixUnitaire,
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
                                      disabled={!peutModifierCommande(commande)}
                                      title={!peutModifierCommande(commande) ? 'Lecture seule : campagne terminée' : undefined}
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
                              {isExpanded && destinations.length > 0 && (
                                <tr className="commande-dispatch-detail-row" onClick={event => event.stopPropagation()}>
                                  <td colSpan={9}>
                                    <section
                                      id={`commande-dispatch-${commande.id}`}
                                      className="commande-dispatch-panel"
                                      aria-label={`Répartition des livraisons de ${commande.numero}`}
                                    >
                                      <div className="commande-dispatch-panel-header">
                                        <div>
                                          <h4><Truck size={18} aria-hidden="true" /> Répartition des livraisons</h4>
                                          <p>Une seule commande et un seul payeur : {donateur?.nom || 'Donateur inconnu'}.</p>
                                        </div>
                                        <span className={`commande-dispatch-total ${totalReparti === commande.quantite ? 'is-ok' : 'is-warning'}`}>
                                          {formatNumber(totalReparti)} / {formatNumber(commande.quantite)} brioches réparties
                                        </span>
                                      </div>
                                      <div className="commande-dispatch-items">
                                        {destinations.map((livraison, index) => (
                                          <div className="commande-dispatch-item" key={livraison.id || `${commande.id}-${index}`}>
                                            <span className="commande-dispatch-item-index">{index + 1}</span>
                                            <div className="commande-dispatch-item-destination">
                                              <strong>{livraison.destinataireNom || 'Destinataire non renseigné'}</strong>
                                              <span>{[livraison.adresse, livraison.cp, livraison.ville].filter(Boolean).join(' · ') || 'Adresse non renseignée'}</span>
                                            </div>
                                            <div className="commande-dispatch-item-date">
                                              <CalendarDays size={15} aria-hidden="true" />
                                              <span>{livraison.datePrevue ? formatDateShort(livraison.datePrevue) : 'Date à définir'}</span>
                                            </div>
                                            <strong className="commande-dispatch-item-qty">{formatNumber(livraison.quantite)} brioches</strong>
                                            <span className={`commande-dispatch-item-status ${livraison.dateLivraison ? 'is-delivered' : ''}`}>
                                              {livraison.dateLivraison ? 'Livrée' : 'À planifier'}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </section>
                                  </td>
                                </tr>
                              )}
                              </Fragment>
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
        )}

      </section>
      )}

      {!vueStructures && groupes.length === 0 && (
        <div className="commande-structures-empty">Aucune commande classique pour ces filtres.</div>
      )}

      {selectedCommande && (
        <CommandeDetail
          commande={
            selectedCommande
          }
          canEdit={peutModifierCommande(selectedCommande)}
          onEdit={() =>
            openEditCommande(
              selectedCommande,
            )
          }
        />
      )}

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
          donateurs={
            donateurs
          }
          initialDonateurId={
            preselectedDonateurId
          }
          onClose={
            closeModal
          }
          onSave={
            saveCommande
          }
        />
      )}

    </div>
  )
}

/* =========================================================
   DÉTAIL
   ========================================================= */

function CommandeDetail({
  commande,
  onEdit,
  canEdit,
}: {
  commande: Commande
  onEdit: () => void
  canEdit: boolean
}) {
  const {
    donateurs,
  } = useObData()

  const donateur =
    donateurs.find(
      (item) =>
        item.id ===
        commande.donateurId,
    )

  const [activeDetailTab, setActiveDetailTab] = useState<'details' | 'suivi' | 'documents' | 'historique'>('details')
  const [jdMessage, setJdMessage] = useState('')
  const [jdBusy, setJdBusy] = useState(false)
  const {
    justificatifs,
    createJustificatif,
    markDocumentGenerated,
  } = useJustificatifs()
  const memeCampagne = (a: string, b: string) => {
    if (a === b) return true
    if (/^TEST[-_ ]/i.test(a) || /^TEST[-_ ]/i.test(b)) return false
    const aa = a.match(/(?:19|20)\d{2}/)?.[0]
    const bb = b.match(/(?:19|20)\d{2}/)?.[0]
    return Boolean(aa && bb && aa === bb)
  }
  const documentsCommande = justificatifs.filter((jd) =>
    (jd.commandeId === String(commande.id) || jd.commandeNumero === commande.numero) &&
    memeCampagne(jd.campagne, commande.campagne),
  )
  const hasJdi = documentsCommande.some((jd) => jd.type === 'JDI' && jd.statut !== 'ARCHIVE')
  const dateJour = () => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }
  const creerJdi = () => {
    if (!canEdit || hasJdi || jdBusy) return
    if (!donateur) {
      setJdMessage('Impossible de créer le JDI : le donateur lié à cette commande est introuvable.')
      return
    }
    if (commande.quantite <= 0 || commande.prixUnitaire <= 0) {
      setJdMessage('Complète la quantité et le prix unitaire avant de créer le JDI.')
      return
    }
    createJustificatif({
      type: 'JDI',
      campagne: commande.campagne,
      commandeId: String(commande.id),
      commandeNumero: commande.numero,
      donateurId: String(donateur.id),
      donateurCode: donateur.code,
      donateurNom: donateur.nom,
      donateurVille: donateur.ville || '',
      donateurAdresse: [donateur.numeroVoie, donateur.adresse, donateur.cp, donateur.ville].filter(Boolean).join(' '),
      donateurEmail: donateur.email || '',
      donateurTelephone: donateur.telephone || '',
      dateEmission: dateJour(),
      nbBrioches: commande.quantite,
      prixUnitaire: commande.prixUnitaire,
      statut: 'BROUILLON',
      paiementStatut: 'EN_ATTENTE',
      documentStatut: 'A_GENERER',
      remarque: `Établi à partir de la commande ${commande.numero}.`,
    })
    setJdMessage('JDI créé en brouillon et lié à cette commande. Aucun envoi effectué.')
  }
  const telechargerJd = async (jd: JustificatifDon) => {
    if (jdBusy) return
    setJdBusy(true)
    setJdMessage('')
    try {
      const result = await generateAndDownloadJustificatifPdf(jd)
      if (canEdit) markDocumentGenerated(jd.id, {
        modeleNom: result.template.fileName,
        modeleVersion: result.template.version,
        modeleCampagneId: jd.campagne,
        modeReglementGenere: result.donor.modeReglement,
      })
      setJdMessage(`PDF ${jd.numero} généré.`)
    } catch (error) {
      setJdMessage(error instanceof Error ? `Génération impossible : ${error.message}` : 'Génération impossible : vérifier le modèle PDF et les informations de règlement.')
    } finally {
      setJdBusy(false)
    }
  }

  return (
    <section className="commande-detail-card">

      <div className="commande-detail-tabs">

        <button type="button" className={activeDetailTab === 'details' ? 'active' : ''} onClick={() => setActiveDetailTab('details')}>Détails</button>
        <button type="button" className={activeDetailTab === 'suivi' ? 'active' : ''} onClick={() => setActiveDetailTab('suivi')}>Suivi</button>
        <button type="button" className={activeDetailTab === 'documents' ? 'active' : ''} onClick={() => setActiveDetailTab('documents')}>Documents {documentsCommande.length > 0 ? `(${documentsCommande.length})` : ''}</button>
        <button type="button" className={activeDetailTab === 'historique' ? 'active' : ''} onClick={() => setActiveDetailTab('historique')}>Historique</button>

        <button
          type="button"
          className="commande-detail-edit"
          onClick={onEdit}
          disabled={!canEdit}
          title={!canEdit ? 'Campagne terminée : lecture seule' : undefined}
        >
          <Edit3 size={17} />
          Modifier
        </button>

      </div>

      {activeDetailTab === 'documents' ? (
        <div className="commande-documents-inline">
          <div className="commande-documents-header">
            <div>
              <h3><FileDown size={19}/> Justificatifs de dons</h3>
              <p>JDI (impayé) et JDP (payé) rattachés à la commande {commande.numero}. Un seul payeur, même en multi-livraisons.</p>
            </div>
            {canEdit && !hasJdi && <button type="button" className="commande-documents-create" onClick={creerJdi} disabled={jdBusy}><Plus size={16}/> Créer un JDI</button>}
          </div>
          {documentsCommande.length > 0 ? (
            <div className="commande-documents-list">
              {documentsCommande.map((jd) => (
                <article className="commande-documents-row" key={jd.id}>
                  <span className={`commande-documents-type ${jd.type.toLowerCase()}`}>{jd.type}</span>
                  <div className="commande-documents-info">
                    <strong>{jd.numero}</strong>
                    <small>{jd.type === 'JDI' ? 'Justificatif de don impayé' : 'Justificatif de don payé'} · {jd.statut.replaceAll('_',' ')} · {jd.documentStatut.replaceAll('_',' ')}</small>
                    <small>{formatMoney(jd.montant)} · {jd.nbBrioches} brioche(s)</small>
                  </div>
                  <button type="button" disabled={jdBusy} className="commande-documents-download" onClick={() => void telechargerJd(jd)}><Download size={16}/> {jdBusy ? 'Génération…' : 'Générer le PDF'}</button>
                </article>
              ))}
            </div>
          ) : (
            <div className="commande-documents-empty"><FileDown size={24}/><strong>Aucun justificatif pour cette commande</strong><span>Crée un JDI en brouillon directement ici, puis génère son PDF depuis le modèle de la campagne.</span></div>
          )}
          <p className="commande-documents-disclaimer">Un JDP doit uniquement être établi après vérification du règlement. La création d'un JDI ne confirme pas un paiement.</p>
          {jdMessage && <p className="commande-documents-feedback" role="status">{jdMessage}</p>}
        </div>
      ) : <div className="commande-detail-grid">

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
            label="Date"
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

          {donateur && (
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
            label="Montant"
            value={formatMoney(
              commande.quantite *
                commande.prixUnitaire,
            )}
            strong
          />

          <CommandeInfoRow
            label="Règlement"
            value={formatPaymentMethod(
              commande.modeReglement,
            )}
          />

        </div>

        {(commande.livraisons?.length ?? 0) > 0 && (
          <div className="commande-detail-section commande-detail-deliveries">
            <h3>Destinations de livraison ({commande.livraisons?.length})</h3>
            <p>La commande reste facturée au donateur payeur ; les lignes ci-dessous sont uniquement logistiques.</p>
            {(commande.livraisons ?? []).map((l, i) => (
              <div className="commande-detail-delivery" key={l.id}>
                <strong>{i + 1}. {l.destinataireNom}</strong>
                <span>{[l.adresse, l.cp, l.ville].filter(Boolean).join(' · ')}</span>
                <span>{l.datePrevue} · {l.quantite.toLocaleString('fr-FR')} brioches</span>
              </div>
            ))}
          </div>
        )}

      </div>}

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
  donateurs,
  initialDonateurId,
  onClose,
  onSave,
}: {
  mode:
    CommandeFormMode

  commande:
    Commande | null

  commandes:
    Commande[]

  donateurs:
    Donateur[]

  initialDonateurId:
    number | null

  onClose: () => void

  onSave: (
    commande: Commande,
  ) => void
}) {
  const obData = useObData() as ReturnType<typeof useObData> & {
    selectedCampagne?: { id: string } | null
  }
  const campagneDefaut = obData.selectedCampagne?.id ?? obData.activeCampagne?.id ?? 'OB 2026'
  const campagnesDisponibles = obData.campagnes

  const initialId =
    commande?.donateurId ??
    initialDonateurId ??
    null

  const [
    donorSearch,
    setDonorSearch,
  ] = useState('')

  const [
    selectedDonateurId,
    setSelectedDonateurId,
  ] =
    useState<number | null>(
      initialId,
    )

  const initialDonateur =
    initialId
      ? donateurs.find(
          (donateur) =>
            donateur.id ===
            initialId,
        )
      : undefined

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
            id:
              Math.max(
                0,
                ...commandes.map(
                  (item) =>
                    item.id,
                ),
              ) + 1,

            numero:
              createCommandeNumber(
                commandes,
              ),

            donateurId:
              initialId ?? 0,

            campagne:
              campagneDefaut,

            dateCommande:
              getTodayInput(),

            quantite: 0,

            prixUnitaire: 5,

            statut:
              'BROUILLON',

            conditionReglement:
              initialDonateur?.conditionReglement ||
              '',

            modeReglement:
              initialDonateur?.modeReglement ||
              '',

            jdi:
              initialDonateur?.jdi ||
              'NON',

            jdp:
              initialDonateur?.jdp ||
              'NON',

            rf:
              initialDonateur?.rf ||
              'NON',

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
  ] = useState('')

  const selectedDonateur =
    selectedDonateurId
      ? donateurs.find(
          (donateur) =>
            donateur.id ===
            selectedDonateurId,
        )
      : undefined

  const filteredDonateurs =
    donateurs
      .filter(
        (donateur) =>
          !donateur.archive,
      )
      .filter(
        (donateur) => {
          const query =
            donorSearch
              .trim()
              .toLowerCase()

          if (!query) {
            return true
          }

          return [
            donateur.nom,
            donateur.code,
            donateur.ville,
            donateur.email,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(query)
        },
      )
      .slice(
        0,
        8,
      )

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
  }

  // Les anciennes commandes restent en mode livraison unique tant que
  // l'utilisateur n'active pas explicitement les destinations multiples.
  const multiLivraisons = Array.isArray(form.livraisons) && form.livraisons.length > 0
  const quantiteLivraisons = (form.livraisons ?? []).reduce(
    (total, livraison) => total + (Number(livraison.quantite) || 0), 0,
  )

  function nouvelleLivraison(): CommandeLivraison {
    const payeur = donateurs.find(d => d.id === selectedDonateurId)
    return {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `liv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      destinataireId: payeur?.id ?? null,
      destinataireNom: payeur?.nom ?? '',
      adresse: payeur?.adresse ?? '',
      cp: payeur?.cp ?? '',
      ville: payeur?.ville ?? '',
      datePrevue: form.datePrevueLivraison || '',
      quantite: 0,
    }
  }

  function activerMultiLivraisons() {
    setError('')
    if (multiLivraisons) {
      // Désactiver ne supprime pas silencieusement des destinations déjà saisies.
      if (form.livraisons && form.livraisons.length > 1 && !window.confirm(
        'Revenir à une livraison unique supprimera les lignes de répartition de ce formulaire. Continuer ?',
      )) return
      updateField('livraisons', [])
    } else {
      setForm(current => ({
        ...current,
        livraisons: [{
          ...nouvelleLivraison(),
          quantite: Number(current.quantite) || 0,
        }],
      }))
    }
  }

  function updateLivraison(livraisonId: string, patch: Partial<CommandeLivraison>) {
    setForm(current => ({
      ...current,
      livraisons: (current.livraisons ?? []).map(item =>
        item.id === livraisonId ? { ...item, ...patch } : item,
      ),
    }))
  }

  function choisirDestinataire(livraisonId: string, donorId: number | null) {
    const donor = donorId ? donateurs.find(d => d.id === donorId) : undefined
    updateLivraison(livraisonId, {
      destinataireId: donor?.id ?? null,
      destinataireNom: donor?.nom ?? '',
      adresse: donor?.adresse ?? '',
      cp: donor?.cp ?? '',
      ville: donor?.ville ?? '',
    })
  }

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !selectedDonateurId
    ) {
      setError(
        'Sélectionne un donateur.',
      )
      return
    }

    if (
      !Number.isSafeInteger(form.quantite) || form.quantite <= 0
    ) {
      setError(
        'La quantité doit être supérieure à 0.',
      )
      return
    }

    if (multiLivraisons) {
      const lignes = form.livraisons ?? []
      if (lignes.some(l => !Number.isSafeInteger(l.quantite) || l.quantite <= 0)) {
        setError('Chaque destination doit avoir une quantité entière supérieure à zéro.')
        return
      }
      if (lignes.some(l => !/^\d{4}-\d{2}-\d{2}$/.test(l.datePrevue))) {
        setError('Renseigne la date prévue de chaque livraison.')
        return
      }
      if (lignes.some(l => !l.destinataireNom.trim() || !l.ville.trim() || !l.adresse.trim())) {
        setError('Renseigne le destinataire, la ville et l’adresse de chaque livraison.')
        return
      }
      if (quantiteLivraisons !== form.quantite) {
        setError(`Répartition incohérente : ${quantiteLivraisons} brioches réparties sur ${form.quantite} commandées.`)
        return
      }
      const ids = lignes.map(l => l.id)
      if (new Set(ids).size !== ids.length) {
        setError('Une référence de livraison est en double.')
        return
      }
    }

    onSave({
      ...form,
      donateurId: selectedDonateurId,
      // Le champ legacy représente uniquement les livraisons uniques.
      // Une date unique serait trompeuse pour des destinations multiples.
      datePrevueLivraison: multiLivraisons ? '' : form.datePrevueLivraison,
      dateLivraison: multiLivraisons ? '' : form.dateLivraison,
      livraisons: multiLivraisons ? form.livraisons : undefined,
    })
  }

  return (
    <div className="commande-modal-overlay">

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
          </div>

          <button
            type="button"
            className="commande-modal-close"
            onClick={
              onClose
            }
          >
            <X size={23} />
          </button>

        </header>

        <form
          onSubmit={
            submit
          }
        >

          <div className="commande-modal-content">

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
                      placeholder="Rechercher un donateur..."
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
                          <Building2
                            size={22}
                          />

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
                              {' • '}
                              {
                                donateur.ville
                              }
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
                      onClick={() =>
                        setSelectedDonateurId(
                          null,
                        )
                      }
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
                        <Phone
                          size={17}
                        />
                      }
                    >
                      {selectedDonateur.telephone ||
                        'Non renseigné'}
                    </DonateurMiniLine>

                    <DonateurMiniLine
                      icon={
                        <Mail
                          size={17}
                        />
                      }
                    >
                      {selectedDonateur.email ||
                        'Non renseigné'}
                    </DonateurMiniLine>

                  </div>

                </div>
              )}

            </CommandeFormSection>

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
                  <input value={campagnesDisponibles.find(c => memeCampagneEntreprise(c.id, form.campagne))?.nom ?? form.campagne} disabled />
                </CommandeField>

                <CommandeField
                  label="Date"
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
                  Montant total
                </span>

                <strong>
                  {formatMoney(
                    form.quantite *
                      form.prixUnitaire,
                  )}
                </strong>
              </div>

            </CommandeFormSection>

            <CommandeFormSection number="3" title="Répartition des livraisons">
              <div className="commande-delivery-intro">
                <div>
                  <strong>Un seul payeur, plusieurs destinations possibles</strong>
                  <p>La maison mère sélectionnée reste responsable de la commande et du règlement.</p>
                </div>
                <button type="button" className="commandes-secondary-button"
                  onClick={activerMultiLivraisons}>
                  {multiLivraisons ? 'Livraison unique' : 'Plusieurs lieux / dates'}
                </button>
              </div>
              {!multiLivraisons ? (
                <p className="commande-delivery-hint">Livraison unique : utilise les dates et l'adresse habituelles de la commande. Active « Plusieurs lieux / dates » pour répartir les brioches.</p>
              ) : (
                <div className="commande-delivery-lines">
                  {(form.livraisons ?? []).map((livraison, index) => (
                    <div className="commande-delivery-line" key={livraison.id}>
                      <div className="commande-delivery-line-title">
                        <strong>Livraison {index + 1}</strong>
                        {(form.livraisons?.length ?? 0) > 1 && (
                          <button type="button" aria-label={`Supprimer la livraison ${index + 1}`}
                            onClick={() => setForm(current => ({ ...current,
                              livraisons: current.livraisons?.filter(l => l.id !== livraison.id),
                            }))}><X size={17}/> Retirer</button>
                        )}
                      </div>
                      <div className="commande-delivery-fields">
                        <label>Destinataire enregistré
                          <select value={livraison.destinataireId ?? ''}
                            onChange={e => choisirDestinataire(livraison.id, e.target.value ? Number(e.target.value) : null)}>
                            <option value="">Autre lieu / saisie libre</option>
                            {donateurs.filter(d => !d.archive).map(d => (
                              <option value={d.id} key={d.id}>{d.nom} — {d.ville || 'Sans ville'}</option>
                            ))}
                          </select>
                        </label>
                        <label>Nom du lieu / destinataire
                          <input value={livraison.destinataireNom}
                            onChange={e => updateLivraison(livraison.id, { destinataireNom: e.target.value })}
                            placeholder="Établissement PPPP1" />
                        </label>
                        <label>Adresse complète
                          <input value={livraison.adresse}
                            onChange={e => updateLivraison(livraison.id, { adresse: e.target.value })}
                            placeholder="Rue et numéro" />
                        </label>
                        <label>Code postal
                          <input value={livraison.cp}
                            onChange={e => updateLivraison(livraison.id, { cp: e.target.value })}
                            placeholder="54000" />
                        </label>
                        <label>Commune
                          <input value={livraison.ville}
                            onChange={e => updateLivraison(livraison.id, { ville: e.target.value })}
                            placeholder="Nancy" />
                        </label>
                        <label>Date de livraison prévue
                          <input type="date" value={livraison.datePrevue}
                            onChange={e => updateLivraison(livraison.id, { datePrevue: e.target.value })}/>
                        </label>
                        <label>Nombre de brioches
                          <input type="number" min="1" step="1" value={livraison.quantite}
                            onChange={e => updateLivraison(livraison.id, { quantite: Number(e.target.value) })}/>
                        </label>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="commandes-secondary-button"
                    onClick={() => setForm(current => ({ ...current,
                      livraisons: [...(current.livraisons ?? []), nouvelleLivraison()],
                    }))}><Plus size={17}/> Ajouter une destination</button>
                  <div className={`commande-delivery-total ${quantiteLivraisons === form.quantite ? 'is-valid' : 'is-invalid'}`}>
                    <span>Total réparti</span>
                    <strong>{quantiteLivraisons.toLocaleString('fr-FR')} / {form.quantite.toLocaleString('fr-FR')} brioches</strong>
                  </div>
                </div>
              )}
            </CommandeFormSection>

            <CommandeFormSection
              number="4"
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
                  </select>
                </CommandeField>

                <CommandeField
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
                </CommandeField>

                <CommandeField
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
                </CommandeField>

                <CommandeField
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

                {!multiLivraisons && (
                  <>
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

                  </>
                )}

                <CommandeField
                  label="Remarque"
                  wide
                >
                  <textarea
                    rows={5}
                    value={
                      form.remarque
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
              <Check size={19} />

              {mode ===
              'create'
                ? 'Créer la commande'
                : 'Enregistrer'}
            </button>

          </footer>

        </form>

      </div>

    </div>
  )
}

/* =========================================================
   MINI COMPOSANTS
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

function YesNoSelect({
  value,
  onChange,
}: {
  value?: string
  onChange: (
    value: string,
  ) => void
}) {
  return (
    <select
      value={
        value || 'NON'
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

function formatDonateurAddress(
  donateur: Donateur,
) {
  return [
    [
      donateur.numeroVoie,
      donateur.adresse,
    ]
      .filter(Boolean)
      .join(' '),

    [
      donateur.cp,
      donateur.ville,
    ]
      .filter(Boolean)
      .join(' '),
  ]
    .filter(Boolean)
    .join(' — ')
}

function getStatutLabel(
  statut:
    StatutCommande,
) {
  const labels:
    Record<
      StatutCommande,
      string
    > = {
    BROUILLON:
      'Brouillon',
    CONFIRMEE:
      'Confirmée',
    A_LIVRER:
      'À livrer',
    LIVREE:
      'Livrée',
    ANNULEE:
      'Annulée',
  }

  return labels[
    statut
  ]
}

function formatMoney(
  value: number,
) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      style: 'currency',
      currency: 'EUR',
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
  value: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || 'Date à préciser'
  return new Intl.DateTimeFormat(
    'fr-FR',
    {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  ).format(
    new Date(
      `${value}T12:00:00`,
    ),
  )
}

function formatDateShort(
  value: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || 'Date à préciser'
  return new Intl.DateTimeFormat(
    'fr-FR',
  ).format(
    new Date(
      `${value}T12:00:00`,
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
    default:
      return value || '-'
  }
}

function getTodayInput() {
  const now =
    new Date()

  return [
    now.getFullYear(),
    String(
      now.getMonth() +
        1,
    ).padStart(
      2,
      '0',
    ),
    String(
      now.getDate(),
    ).padStart(
      2,
      '0',
    ),
  ].join('-')
}

function createCommandeNumber(
  commandes:
    Commande[],
) {
  const year =
    new Date().getFullYear()

  const max =
    commandes
      .filter(
        (commande) =>
          commande.numero.startsWith(
            `CMD-${year}-`,
          ),
      )
      .reduce(
        (
          current,
          commande,
        ) => {
          const match =
            commande.numero.match(
              /(\d+)$/,
            )

          return Math.max(
            current,
            match
              ? Number(
                  match[1],
                )
              : 0,
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

function getFileDate() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    )
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

  link.remove()

  URL.revokeObjectURL(
    url,
  )
}

export default Commandes