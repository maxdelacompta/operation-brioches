import {
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
  Edit3,
  Eye,
  FileDown,
  FileSpreadsheet,
  Mail,
  MapPin,
  MoreVertical,
  Phone,
  Plus,
  Search,
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
  Donateur,
  StatutCommande,
} from '../types/ob'

import './Donateurs.css'

/* =========================================================
   TYPES
   ========================================================= */

type DetailTab =
  | 'general'
  | 'contacts'
  | 'commandes'
  | 'dons'
  | 'encaissements'
  | 'documents'
  | 'historique'

type DonateurFormMode =
  | 'create'
  | 'edit'

type ArchiveFilter =
  | 'actifs'
  | 'archives'
  | 'tous'

/* =========================================================
   DONATEUR VIDE
   ========================================================= */

const EMPTY_DONATEUR: Donateur = {
  id: 0,
  code: '',
  type: 'Entreprise',
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
     ÉTATS
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
    archiveFilter,
    setArchiveFilter,
  ] =
    useState<ArchiveFilter>(
      'actifs',
    )

  const [
    selectedDonateurId,
    setSelectedDonateurId,
  ] =
    useState<number | null>(
      null,
    )

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<DetailTab>(
      'general',
    )

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
    exportMenuOpen,
    setExportMenuOpen,
  ] = useState(false)

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
     TYPES DISPONIBLES
     ======================================================= */

  const types =
    useMemo(() => {
      const uniqueTypes =
        Array.from(
          new Set(
            donateurs
              .map(
                (donateur) =>
                  donateur.type,
              )
              .filter(Boolean),
          ),
        ).sort(
          (a, b) =>
            a.localeCompare(
              b,
              'fr',
            ),
        )

      return [
        'Tous',
        ...uniqueTypes,
      ]
    }, [donateurs])

  /* =======================================================
     FILTRAGE
     ======================================================= */

  const filteredDonateurs =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase()

      return donateurs
        .filter(
          (donateur) => {
            if (
              archiveFilter ===
                'actifs' &&
              donateur.archive
            ) {
              return false
            }

            if (
              archiveFilter ===
                'archives' &&
              !donateur.archive
            ) {
              return false
            }

            return true
          },
        )
        .filter(
          (donateur) =>
            typeFilter ===
              'Tous' ||
            donateur.type ===
              typeFilter,
        )
        .filter(
          (donateur) => {
            if (!query) {
              return true
            }

            const searchable =
              [
                donateur.code,
                donateur.nom,
                donateur.type,

                donateur.numeroVoie,
                donateur.adresse,
                donateur.cp,
                donateur.ville,

                donateur.contactNom,
                donateur.contactPrenom,
                donateur.email,
                donateur.telephone,

                donateur.informations,
                donateur.remarque,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()

            return searchable.includes(
              query,
            )
          },
        )
        .sort(
          (a, b) =>
            a.nom.localeCompare(
              b.nom,
              'fr',
            ),
        )
    }, [
      donateurs,
      search,
      typeFilter,
      archiveFilter,
    ])

  /* =======================================================
     COMMANDES DU DONATEUR
     ======================================================= */

  const commandesDonateur =
    useMemo(() => {
      if (
        !selectedDonateur
      ) {
        return []
      }

      return commandes
        .filter(
          (commande) =>
            commande.donateurId ===
            selectedDonateur.id,
        )
        .sort(
          (a, b) =>
            b.dateCommande.localeCompare(
              a.dateCommande,
            ),
        )
    }, [
      commandes,
      selectedDonateur,
    ])

  const totalCommandesMontant =
    useMemo(() => {
      return commandesDonateur.reduce(
        (
          total,
          commande,
        ) =>
          total +
          commande.quantite *
            commande.prixUnitaire,
        0,
      )
    }, [
      commandesDonateur,
    ])

  const totalCommandesQuantite =
    useMemo(() => {
      return commandesDonateur.reduce(
        (
          total,
          commande,
        ) =>
          total +
          commande.quantite,
        0,
      )
    }, [
      commandesDonateur,
    ])

  /* =======================================================
     OUVERTURE DONATEUR
     ======================================================= */

  function openDonateur(
    donateur: Donateur,
  ) {
    setSelectedDonateurId(
      donateur.id,
    )

    setActiveTab(
      'general',
    )

    setActionMenuId(
      null,
    )
  }

  function closeDonateur() {
    setSelectedDonateurId(
      null,
    )

    setActiveTab(
      'general',
    )
  }

  /* =======================================================
     AJOUT
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

    setActionMenuId(
      null,
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
     SAUVEGARDE
     ======================================================= */

  function saveDonateur(
    donateur: Donateur,
  ) {
    if (
      formMode === 'edit'
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

  function toggleArchive(
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
                    !item.archive,
                }
              : item,
        ),
    )

    setActionMenuId(
      null,
    )
  }

  /* =======================================================
     NOUVELLE COMMANDE
     ======================================================= */

  function createCommande(
    donateur: Donateur,
  ) {
    navigate(
      `/commandes?donateur=${donateur.id}`,
    )
  }

  /* =======================================================
     OUVRIR COMMANDE
     ======================================================= */

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

    worksheet.columns = [
      {
        header:
          'Code donateur',
        key: 'code',
        width: 18,
      },

      {
        header: 'Type',
        key: 'type',
        width: 20,
      },

      {
        header: 'Nom',
        key: 'nom',
        width: 38,
      },

      {
        header: 'Adresse',
        key: 'adresse',
        width: 40,
      },

      {
        header:
          'Code postal',
        key: 'cp',
        width: 12,
      },

      {
        header: 'Ville',
        key: 'ville',
        width: 24,
      },

      {
        header: 'Contact',
        key: 'contact',
        width: 28,
      },

      {
        header: 'E-mail',
        key: 'email',
        width: 35,
      },

      {
        header:
          'Téléphone',
        key: 'telephone',
        width: 20,
      },

      {
        header:
          'Condition règlement',
        key:
          'conditionReglement',
        width: 25,
      },

      {
        header:
          'Mode règlement',
        key:
          'modeReglement',
        width: 22,
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
        header: 'Archivé',
        key: 'archive',
        width: 12,
      },
    ]

    filteredDonateurs.forEach(
      (donateur) => {
        worksheet.addRow({
          code:
            formatDonateurCode(
              donateur,
            ),

          type:
            donateur.type,

          nom:
            donateur.nom,

          adresse:
            formatStreetAddress(
              donateur,
            ),

          cp:
            donateur.cp || '',

          ville:
            donateur.ville || '',

          contact:
            formatContactName(
              donateur,
            ),

          email:
            donateur.email || '',

          telephone:
            donateur.telephone ||
            '',

          conditionReglement:
            donateur.conditionReglement ||
            '',

          modeReglement:
            formatPaymentMethod(
              donateur.modeReglement,
            ),

          jdi:
            donateur.jdi || '',

          jdp:
            donateur.jdp || '',

          rf:
            donateur.rf || '',

          archive:
            donateur.archive
              ? 'Oui'
              : 'Non',
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
      vertical:
        'middle',

      horizontal:
        'center',
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
        column: 15,
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

    const rows =
      filteredDonateurs.map(
        (donateur) => [
          formatDonateurCode(
            donateur,
          ),

          donateur.type,

          donateur.nom,

          donateur.ville ||
            '',

          formatContactName(
            donateur,
          ),

          donateur.telephone ||
            '',

          donateur.email ||
            '',

          formatPaymentMethod(
            donateur.modeReglement,
          ),

          donateur.archive
            ? 'Oui'
            : 'Non',
        ],
      )

    autoTable(
      doc,
      {
        startY: 15,

        head: [[
          'Code',
          'Type',
          'Nom',
          'Ville',
          'Contact',
          'Téléphone',
          'E-mail',
          'Règlement',
          'Archivé',
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
      `Donateurs_${getFileDate()}.pdf`,
    )

    setExportMenuOpen(
      false,
    )
  }

  /* =======================================================
     VUE DÉTAIL DONATEUR
     ======================================================= */

  if (
    selectedDonateur
  ) {
    return (
      <div className="donateurs-page">

        {/* =================================================
            HEADER FICHE
        ================================================= */}

        <header className="donateur-detail-header">

          <div className="donateur-detail-header-left">

            <button
              type="button"
              className="donateur-back-button"
              onClick={
                closeDonateur
              }
            >
              <ArrowLeft
                size={18}
              />

              Retour
            </button>

            <div className="donateur-detail-title">

              <div className="donateur-detail-icon">
                <Building2
                  size={27}
                />
              </div>

              <div>

                <span className="donateurs-eyebrow">
                  Donateur
                </span>

                <h1>
                  {
                    selectedDonateur.nom
                  }
                </h1>

                <p>
                  {formatDonateurCode(
                    selectedDonateur,
                  )}

                  {' • '}

                  {
                    selectedDonateur.type
                  }

                  {selectedDonateur.archive
                    ? ' • Archivé'
                    : ''}
                </p>

              </div>

            </div>

          </div>

          <div className="donateur-detail-actions">

            <button
              type="button"
              className="donateurs-secondary-button"
              onClick={() =>
                openEditDonateur(
                  selectedDonateur,
                )
              }
            >
              <Edit3
                size={18}
              />

              Modifier
            </button>

            <button
              type="button"
              className="donateurs-primary-button"
              onClick={() =>
                createCommande(
                  selectedDonateur,
                )
              }
            >
              <ShoppingCart
                size={18}
              />

              Nouvelle commande
            </button>

          </div>

        </header>

        {/* =================================================
            ONGLETS
        ================================================= */}

        <div className="donateur-detail-tabs">

          <DetailTabButton
            active={
              activeTab ===
              'general'
            }
            onClick={() =>
              setActiveTab(
                'general',
              )
            }
          >
            Vue générale
          </DetailTabButton>

          <DetailTabButton
            active={
              activeTab ===
              'contacts'
            }
            onClick={() =>
              setActiveTab(
                'contacts',
              )
            }
          >
            Contacts
          </DetailTabButton>

          <DetailTabButton
            active={
              activeTab ===
              'commandes'
            }
            onClick={() =>
              setActiveTab(
                'commandes',
              )
            }
          >
            Commandes
          </DetailTabButton>

          <DetailTabButton
            active={
              activeTab ===
              'dons'
            }
            onClick={() =>
              setActiveTab(
                'dons',
              )
            }
          >
            Dons
          </DetailTabButton>

          <DetailTabButton
            active={
              activeTab ===
              'encaissements'
            }
            onClick={() =>
              setActiveTab(
                'encaissements',
              )
            }
          >
            Encaissements
          </DetailTabButton>

          <DetailTabButton
            active={
              activeTab ===
              'documents'
            }
            onClick={() =>
              setActiveTab(
                'documents',
              )
            }
          >
            Documents
          </DetailTabButton>

          <DetailTabButton
            active={
              activeTab ===
              'historique'
            }
            onClick={() =>
              setActiveTab(
                'historique',
              )
            }
          >
            Historique
          </DetailTabButton>

        </div>

        {/* =================================================
            VUE GÉNÉRALE
        ================================================= */}

        {activeTab ===
          'general' && (
          <section className="donateur-detail-grid">

            <div className="donateur-detail-card">

              <h2>
                Informations générales
              </h2>

              <DetailRow
                label="Code"
                value={formatDonateurCode(
                  selectedDonateur,
                )}
              />

              <DetailRow
                label="Type"
                value={
                  selectedDonateur.type
                }
              />

              <DetailRow
                label="Nom"
                value={
                  selectedDonateur.nom
                }
              />

              <DetailRow
                label="Adresse"
                value={formatStreetAddress(
                  selectedDonateur,
                )}
              />

              <DetailRow
                label="Code postal"
                value={
                  selectedDonateur.cp ||
                  'Non renseigné'
                }
              />

              <DetailRow
                label="Ville"
                value={
                  selectedDonateur.ville ||
                  'Non renseignée'
                }
              />

            </div>

            <div className="donateur-detail-card">

              <h2>
                Règlement
              </h2>

              <DetailRow
                label="Condition"
                value={
                  selectedDonateur.conditionReglement ||
                  'Non renseignée'
                }
              />

              <DetailRow
                label="Mode"
                value={formatPaymentMethod(
                  selectedDonateur.modeReglement,
                )}
              />

              <DetailRow
                label="JDI"
                value={
                  selectedDonateur.jdi ||
                  'NON'
                }
              />

              <DetailRow
                label="JDP"
                value={
                  selectedDonateur.jdp ||
                  'NON'
                }
              />

              <DetailRow
                label="RF"
                value={
                  selectedDonateur.rf ||
                  'NON'
                }
              />

            </div>

            <div className="donateur-detail-card">

              <h2>
                Informations complémentaires
              </h2>

              <DetailRow
                label="Informations"
                value={
                  selectedDonateur.informations ||
                  'Aucune information'
                }
              />

              <DetailRow
                label="Remarque"
                value={
                  selectedDonateur.remarque ||
                  'Aucune remarque'
                }
              />

            </div>

          </section>
        )}

        {/* =================================================
            CONTACTS
        ================================================= */}

        {activeTab ===
          'contacts' && (
          <section className="donateur-detail-card">

            <h2>
              Contact principal
            </h2>

            <div className="donateur-contact-card">

              <div className="donateur-contact-icon">
                <User
                  size={26}
                />
              </div>

              <div>

                <strong>
                  {formatContactName(
                    selectedDonateur,
                  ) ||
                    'Aucun contact renseigné'}
                </strong>

                <ContactLine
                  icon={
                    <Mail
                      size={17}
                    />
                  }
                >
                  {
                    selectedDonateur.email ||
                    'E-mail non renseigné'
                  }
                </ContactLine>

                <ContactLine
                  icon={
                    <Phone
                      size={17}
                    />
                  }
                >
                  {
                    selectedDonateur.telephone ||
                    'Téléphone non renseigné'
                  }
                </ContactLine>

                <ContactLine
                  icon={
                    <MapPin
                      size={17}
                    />
                  }
                >
                  {formatFullAddress(
                    selectedDonateur,
                  )}
                </ContactLine>

              </div>

            </div>

          </section>
        )}

        {/* =================================================
            COMMANDES
        ================================================= */}

        {activeTab ===
          'commandes' && (
          <section className="donateur-commandes">

            <div className="donateur-commandes-header">

              <div>

                <h2>
                  Commandes
                </h2>

                <p>
                  Toutes les commandes liées à ce donateur.
                </p>

              </div>

              <button
                type="button"
                className="donateurs-primary-button"
                onClick={() =>
                  createCommande(
                    selectedDonateur,
                  )
                }
              >
                <Plus
                  size={18}
                />

                Nouvelle commande
              </button>

            </div>

            <div className="donateur-commandes-kpis">

              <div>
                <span>
                  Nombre de commandes
                </span>

                <strong>
                  {
                    commandesDonateur.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  Quantité totale
                </span>

                <strong>
                  {
                    totalCommandesQuantite
                  }
                </strong>
              </div>

              <div>
                <span>
                  Montant total
                </span>

                <strong>
                  {formatMoney(
                    totalCommandesMontant,
                  )}
                </strong>
              </div>

            </div>

            {commandesDonateur.length >
            0 ? (
              <div className="donateur-commandes-list">

                {commandesDonateur.map(
                  (commande) => (
                    <button
                      type="button"
                      key={
                        commande.id
                      }
                      className="donateur-commande-row"
                      onClick={() =>
                        openCommande(
                          commande.id,
                        )
                      }
                    >

                      <div>
                        <span>
                          Commande
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
            ) : (
              <div className="donateur-commandes-empty">

                <ShoppingCart
                  size={38}
                />

                <strong>
                  Aucune commande
                </strong>

                <span>
                  Ce donateur n'a encore aucune commande enregistrée.
                </span>

                <button
                  type="button"
                  className="donateurs-primary-button"
                  onClick={() =>
                    createCommande(
                      selectedDonateur,
                    )
                  }
                >
                  <Plus
                    size={18}
                  />

                  Créer une commande
                </button>

              </div>
            )}

          </section>
        )}

        {/* =================================================
            DONS
        ================================================= */}

        {activeTab ===
          'dons' && (
          <EmptyTab
            title="Dons"
            text="Les dons liés à ce donateur apparaîtront ici."
          />
        )}

        {/* =================================================
            ENCAISSEMENTS
        ================================================= */}

        {activeTab ===
          'encaissements' && (
          <EmptyTab
            title="Encaissements"
            text="Les encaissements liés à ce donateur apparaîtront ici."
          />
        )}

        {/* =================================================
            DOCUMENTS
        ================================================= */}

        {activeTab ===
          'documents' && (
          <EmptyTab
            title="Documents"
            text="Les documents liés à ce donateur apparaîtront ici."
          />
        )}

        {/* =================================================
            HISTORIQUE
        ================================================= */}

        {activeTab ===
          'historique' && (
          <EmptyTab
            title="Historique"
            text="Les modifications et actions liées à ce donateur apparaîtront ici."
          />
        )}

        {/* =================================================
            MODALE
        ================================================= */}

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
            Gérez les entreprises, mairies, établissements et autres donateurs de l'Opération Brioches.
          </p>

        </div>

        <div className="donateurs-header-actions">

          {/* EXPORT */}

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
                size={18}
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

          {/* NOUVEAU */}

          <button
            type="button"
            className="donateurs-primary-button"
            onClick={
              openCreateDonateur
            }
          >
            <Plus
              size={19}
            />

            Nouveau donateur
          </button>

        </div>

      </header>

      {/* =================================================
          FILTRES
      ================================================= */}

      <section className="donateurs-filter-card">

        <div className="donateurs-search">

          <Search
            size={19}
          />

          <input
            value={
              search
            }
            placeholder="Rechercher un donateur, une commune, un contact..."
            onChange={(
              event,
            ) =>
              setSearch(
                event.target.value,
              )
            }
          />

        </div>

        <label className="donateurs-filter-field">

          <span>
            Type
          </span>

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

        </label>

        <label className="donateurs-filter-field">

          <span>
            Affichage
          </span>

          <select
            value={
              archiveFilter
            }
            onChange={(
              event,
            ) =>
              setArchiveFilter(
                event.target.value as ArchiveFilter,
              )
            }
          >
            <option value="actifs">
              Actifs
            </option>

            <option value="archives">
              Archivés
            </option>

            <option value="tous">
              Tous
            </option>
          </select>

        </label>

      </section>

      {/* =================================================
          TABLE
      ================================================= */}

      <section className="donateurs-table-card">

        <div className="donateurs-table-header">

          <div>
            <strong>
              {
                filteredDonateurs.length
              }
            </strong>

            <span>
              donateur
              {filteredDonateurs.length >
              1
                ? 's'
                : ''}
            </span>
          </div>

        </div>

        <div className="donateurs-table-wrapper">

          <table className="donateurs-table">

            <thead>
              <tr>

                <th>
                  Code
                </th>

                <th>
                  Type
                </th>

                <th>
                  Donateur
                </th>

                <th>
                  Commune
                </th>

                <th>
                  Contact
                </th>

                <th>
                  Téléphone
                </th>

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
                    className={
                      donateur.archive
                        ? 'donateur-row-archived'
                        : ''
                    }
                    onDoubleClick={() =>
                      openDonateur(
                        donateur,
                      )
                    }
                  >

                    {/* CODE */}

                    <td className="donateur-code">
                      {formatDonateurCode(
                        donateur,
                      )}
                    </td>

                    {/* TYPE */}

                    <td>

                      <div className="donateur-type-wrapper">

                        <span className="donateur-type-badge">
                          {
                            donateur.type
                          }
                        </span>

                        {donateur.archive && (
                          <span className="donateur-archive-badge">
                            Archivé
                          </span>
                        )}

                      </div>

                    </td>

                    {/* NOM */}

                    <td>

                      <div className="donateur-name-cell">

                        <Building2
                          size={18}
                        />

                        <div>

                          <strong>
                            {
                              donateur.nom
                            }
                          </strong>

                          <span>
                            {
                              donateur.email ||
                              'Aucun e-mail'
                            }
                          </span>

                        </div>

                      </div>

                    </td>

                    {/* VILLE */}

                    <td>
                      {
                        donateur.ville ||
                        '-'
                      }
                    </td>

                    {/* CONTACT */}

                    <td>
                      {formatContactName(
                        donateur,
                      ) || '-'}
                    </td>

                    {/* TELEPHONE */}

                    <td>
                      {
                        donateur.telephone ||
                        '-'
                      }
                    </td>

                    {/* ACTIONS */}

                    <td>

                      <div
                        className="donateur-actions-menu-wrapper"
                      >

                        <button
                          type="button"
                          className="donateur-actions-button"
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
                            size={19}
                          />
                        </button>

                        {actionMenuId ===
                          donateur.id && (
                          <div className="donateur-actions-menu">

                            <button
                              type="button"
                              onClick={() =>
                                openDonateur(
                                  donateur,
                                )
                              }
                            >
                              <Eye
                                size={17}
                              />

                              Voir la fiche
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEditDonateur(
                                  donateur,
                                )
                              }
                            >
                              <Edit3
                                size={17}
                              />

                              Modifier
                            </button>

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
                              className={
                                donateur.archive
                                  ? ''
                                  : 'danger'
                              }
                              onClick={() =>
                                toggleArchive(
                                  donateur,
                                )
                              }
                            >
                              <Archive
                                size={17}
                              />

                              {donateur.archive
                                ? 'Réactiver'
                                : 'Archiver'}
                            </button>

                          </div>
                        )}

                      </div>

                    </td>

                  </tr>
                ),
              )}

            </tbody>

          </table>

          {/* AUCUN RÉSULTAT */}

          {filteredDonateurs.length ===
            0 && (
            <div className="donateurs-empty">

              <Building2
                size={40}
              />

              <strong>
                Aucun donateur trouvé
              </strong>

              <span>
                Modifie les filtres ou ajoute un nouveau donateur.
              </span>

            </div>
          )}

        </div>

      </section>

      {/* =================================================
          MODALE
      ================================================= */}

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
  const initialValue =
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
        }

  const [
    form,
    setForm,
  ] =
    useState<Donateur>(
      initialValue,
    )

  const [
    error,
    setError,
  ] = useState('')

  /* =======================================================
     CHAMP
     ======================================================= */

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

  /* =======================================================
     VALIDATION
     ======================================================= */

  function submit(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError('')

    const cleanedName =
      form.nom.trim()

    const cleanedCode =
      String(
        form.code,
      ).trim()

    if (
      !cleanedName
    ) {
      setError(
        'Le nom du donateur est obligatoire.',
      )

      return
    }

    if (
      !cleanedCode
    ) {
      setError(
        'Le code donateur est obligatoire.',
      )

      return
    }

    const duplicateCode =
      donateurs.some(
        (item) =>
          String(
            item.code,
          )
            .trim()
            .toLowerCase() ===
            cleanedCode.toLowerCase() &&
          item.id !==
            form.id,
      )

    if (
      duplicateCode
    ) {
      setError(
        'Ce code donateur existe déjà.',
      )

      return
    }

    onSave({
      ...form,

      nom:
        cleanedName,

      code:
        cleanedCode,
    })
  }

  return (
    <div className="donateur-modal-overlay">

      <div className="donateur-modal">

        {/* =================================================
            HEADER
        ================================================= */}

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
              size={23}
            />
          </button>

        </header>

        {/* =================================================
            FORMULAIRE
        ================================================= */}

        <form
          onSubmit={
            submit
          }
        >

          <div className="donateur-modal-content">

            {/* =============================================
                IDENTITÉ
            ============================================= */}

            <DonateurFormSection
              title="Informations générales"
            >

              <div className="donateur-form-grid">

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                    <option value="Entreprise">
                      Entreprise
                    </option>

                    <option value="Mairie">
                      Mairie
                    </option>

                    <option value="Établissement">
                      Établissement
                    </option>

                    <option value="Association">
                      Association
                    </option>

                    <option value="Particulier">
                      Particulier
                    </option>

                    <option value="Autre">
                      Autre
                    </option>
                  </select>
                </DonateurField>

                <DonateurField
                  label="Nom"
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
                </DonateurField>

              </div>

            </DonateurFormSection>

            {/* =============================================
                ADRESSE
            ============================================= */}

            <DonateurFormSection
              title="Adresse"
            >

              <div className="donateur-form-grid">

                <DonateurField
                  label="N° de voie"
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

              </div>

            </DonateurFormSection>

            {/* =============================================
                CONTACT
            ============================================= */}

            <DonateurFormSection
              title="Contact principal"
            >

              <div className="donateur-form-grid">

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

                <DonateurField
                  label="E-mail"
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

              </div>

            </DonateurFormSection>

            {/* =============================================
                RÈGLEMENT
            ============================================= */}

            <DonateurFormSection
              title="Règlement & paramètres"
            >

              <div className="donateur-form-grid">

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

              </div>

            </DonateurFormSection>

            {/* =============================================
                INFORMATIONS
            ============================================= */}

            <DonateurFormSection
              title="Informations complémentaires"
            >

              <div className="donateur-form-grid">

                <DonateurField
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
                </DonateurField>

                <DonateurField
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
                </DonateurField>

              </div>

            </DonateurFormSection>

            {/* ERREUR */}

            {error && (
              <div className="donateur-form-error">
                {error}
              </div>
            )}

          </div>

          {/* =================================================
              FOOTER
          ================================================= */}

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
   ONGLET
   ========================================================= */

function DetailTabButton({
  active,
  onClick,
  children,
}: {
  active:
    boolean

  onClick:
    () => void

  children:
    ReactNode
}) {
  return (
    <button
      type="button"
      className={
        active
          ? 'active'
          : ''
      }
      onClick={
        onClick
      }
    >
      {children}
    </button>
  )
}

/* =========================================================
   LIGNE DÉTAIL
   ========================================================= */

function DetailRow({
  label,
  value,
}: {
  label:
    string

  value:
    string
}) {
  return (
    <div className="donateur-detail-row">

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

    </div>
  )
}

/* =========================================================
   LIGNE CONTACT
   ========================================================= */

function ContactLine({
  icon,
  children,
}: {
  icon:
    ReactNode

  children:
    ReactNode
}) {
  return (
    <div className="donateur-contact-line">

      {icon}

      <span>
        {children}
      </span>

    </div>
  )
}

/* =========================================================
   ONGLET VIDE
   ========================================================= */

function EmptyTab({
  title,
  text,
}: {
  title:
    string

  text:
    string
}) {
  return (
    <section className="donateur-detail-card donateur-empty-tab">

      <Building2
        size={36}
      />

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
   SECTION FORMULAIRE
   ========================================================= */

function DonateurFormSection({
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

/* =========================================================
   CHAMP FORMULAIRE
   ========================================================= */

function DonateurField({
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

/* =========================================================
   OUI / NON
   ========================================================= */

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

function formatDonateurCode(
  donateur:
    Donateur,
) {
  const raw =
    String(
      donateur.code,
    ).trim()

  if (
    raw
      .toUpperCase()
      .startsWith(
        'DON-',
      )
  ) {
    return raw
  }

  return `DON-${raw.padStart(
    6,
    '0',
  )}`
}

function formatStreetAddress(
  donateur:
    Donateur,
) {
  return (
    [
      donateur.numeroVoie,
      donateur.adresse,
    ]
      .filter(Boolean)
      .join(' ') ||
    'Non renseignée'
  )
}

function formatFullAddress(
  donateur:
    Donateur,
) {
  const street =
    [
      donateur.numeroVoie,
      donateur.adresse,
    ]
      .filter(Boolean)
      .join(' ')

  const city =
    [
      donateur.cp,
      donateur.ville,
    ]
      .filter(Boolean)
      .join(' ')

  return (
    [
      street,
      city,
    ]
      .filter(Boolean)
      .join(', ') ||
    'Adresse non renseignée'
  )
}

function formatContactName(
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
        'Non renseigné'
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
  const numericCodes =
    donateurs
      .map(
        (donateur) => {
          const raw =
            String(
              donateur.code,
            )
              .replace(
                /^DON-/i,
                '',
              )
              .trim()

          return Number(
            raw,
          )
        },
      )
      .filter(
        (value) =>
          Number.isFinite(
            value,
          ),
      )

  return String(
    Math.max(
      0,
      ...numericCodes,
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