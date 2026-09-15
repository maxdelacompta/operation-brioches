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

import {
  useSearchParams,
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

import './Commandes.css'

type CommandeFormMode =
  | 'create'
  | 'edit'

function Commandes() {
  const {
    donateurs,
    commandes,
    setCommandes,
  } = useObData()

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams()

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    campagneFilter,
    setCampagneFilter,
  ] = useState('Toutes')

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

      if (exists) {
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
  ])

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
      donateurs,
      search,
      campagneFilter,
      statutFilter,
    ])

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

  /* =========================================================
     KPI
     ========================================================= */

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
    setCampagneFilter(
      'Toutes',
    )
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

    filteredCommandes.forEach(
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

      {groupes.length >
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
        )}

      </section>

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
}: {
  commande: Commande
  onEdit: () => void
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

  return (
    <section className="commande-detail-card">

      <div className="commande-detail-tabs">

        <button
          type="button"
          className="active"
        >
          Détails
        </button>

        <button
          type="button"
        >
          Suivi
        </button>

        <button
          type="button"
        >
          Documents
        </button>

        <button
          type="button"
        >
          Historique
        </button>

        <button
          type="button"
          className="commande-detail-edit"
          onClick={
            onEdit
          }
        >
          <Edit3 size={17} />
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
              'OB 2026',

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
      form.quantite <= 0
    ) {
      setError(
        'La quantité doit être supérieure à 0.',
      )
      return
    }

    onSave({
      ...form,
      donateurId:
        selectedDonateurId,
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
                    <option>
                      OB 2025
                    </option>

                    <option>
                      OB 2026
                    </option>

                    <option>
                      OB 2027
                    </option>
                  </select>
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