import {
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  Euro,
  Eye,
  FileText,
  MapPin,
  Package,
  Search,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react'

import {
  useNavigate,
} from 'react-router-dom'

import {
  useObData,
} from '../contexts/ObDataContext'

import type {
  Commande,
  Donateur,
  StatutCommande,
} from '../types/ob'

import './SuiviGlobalEntreprises.css'

type SuiviStatut =
  | 'A_TRAITER'
  | 'EN_COURS'
  | 'A_LIVRER'
  | 'LIVREE'
  | 'ANNULEE'

type EntrepriseSuivi = {
  donateur: Donateur
  commandes: Commande[]
  commandesActives: Commande[]
  nbCommandes: number
  quantite: number
  montant: number
  quantiteLivree: number
  montantLivre: number
  progression: number
  statut: SuiviStatut
  derniereCommande: string
}

const STATUS_LABELS: Record<
  SuiviStatut,
  string
> = {
  A_TRAITER: 'À traiter',
  EN_COURS: 'En cours',
  A_LIVRER: 'À livrer',
  LIVREE: 'Livrée',
  ANNULEE: 'Annulée',
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function formatMoney(value: number) {
  return new Intl.NumberFormat(
    'fr-FR',
    {
      style: 'currency',
      currency: 'EUR',
    },
  ).format(value)
}

function formatNumber(value: number) {
  return new Intl.NumberFormat(
    'fr-FR',
  ).format(value)
}

function formatDate(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value || '—'
  }

  return new Intl.DateTimeFormat(
    'fr-FR',
  ).format(
    new Date(`${value}T12:00:00`),
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
    case 'CHORUS':
      return 'Chorus Pro'
    default:
      return value || '—'
  }
}

function statutCommandeLabel(
  statut: StatutCommande,
) {
  const labels: Record<
    StatutCommande,
    string
  > = {
    BROUILLON: 'Brouillon',
    CONFIRMEE: 'Confirmée',
    A_LIVRER: 'À livrer',
    LIVREE: 'Livrée',
    ANNULEE: 'Annulée',
  }

  return labels[statut]
}

function statutEntreprise(
  commandes: Commande[],
): SuiviStatut {
  if (!commandes.length) {
    return 'A_TRAITER'
  }

  const actives = commandes.filter(
    (commande) =>
      commande.statut !== 'ANNULEE',
  )

  if (actives.length === 0) {
    return 'ANNULEE'
  }

  const toutesLivrees =
    actives.every(
      (commande) =>
        commande.statut === 'LIVREE' ||
        Boolean(
          commande.dateLivraison,
        ),
    )

  if (toutesLivrees) {
    return 'LIVREE'
  }

  if (
    actives.some(
      (commande) =>
        commande.statut === 'A_LIVRER',
    )
  ) {
    return 'A_LIVRER'
  }

  if (
    actives.some(
      (commande) =>
        commande.statut === 'BROUILLON',
    )
  ) {
    return 'A_TRAITER'
  }

  return 'EN_COURS'
}

function csvCell(value: unknown) {
  return `"${String(value ?? '')
    .replace(/"/g, '""')}"`
}

export default function SuiviGlobalEntreprises() {
  const navigate = useNavigate()

  const {
    donateurs,
    commandes,
  } = useObData()

  const campagnes = useMemo(
    () =>
      [
        ...new Set(
          commandes
            .map(
              (commande) =>
                commande.campagne,
            )
            .filter(Boolean),
        ),
      ].sort((a, b) =>
        b.localeCompare(
          a,
          'fr',
          {
            numeric: true,
          },
        ),
      ),
    [commandes],
  )

  const [
    campagneFilter,
    setCampagneFilter,
  ] = useState(
    campagnes[0] || 'TOUTES',
  )

  const [search, setSearch] =
    useState('')

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<
    'TOUS' | SuiviStatut
  >('TOUS')

  const [
    villeFilter,
    setVilleFilter,
  ] = useState('TOUTES')

  const [
    selectedDonateurId,
    setSelectedDonateurId,
  ] = useState<number | null>(
    null,
  )

  const commandesCampagne =
    useMemo(
      () =>
        commandes.filter(
          (commande) =>
            campagneFilter ===
              'TOUTES' ||
            commande.campagne ===
              campagneFilter,
        ),
      [
        commandes,
        campagneFilter,
      ],
    )

  const suivis = useMemo<
    EntrepriseSuivi[]
  >(() => {
    const byDonateur =
      new Map<
        number,
        Commande[]
      >()

    for (
      const commande of commandesCampagne
    ) {
      const current =
        byDonateur.get(
          commande.donateurId,
        ) || []

      current.push(commande)

      byDonateur.set(
        commande.donateurId,
        current,
      )
    }

    return donateurs
      .filter(
        (donateur) =>
          !donateur.archive &&
          byDonateur.has(
            donateur.id,
          ),
      )
      .map(
        (
          donateur,
        ): EntrepriseSuivi => {
          const commandesDonateur =
            byDonateur.get(
              donateur.id,
            ) || []

          const actives =
            commandesDonateur.filter(
              (commande) =>
                commande.statut !==
                'ANNULEE',
            )

          const quantite =
            actives.reduce(
              (total, commande) =>
                total +
                Number(
                  commande.quantite ||
                    0,
                ),
              0,
            )

          const montant =
            actives.reduce(
              (total, commande) =>
                total +
                Number(
                  commande.quantite ||
                    0,
                ) *
                  Number(
                    commande.prixUnitaire ||
                      0,
                  ),
              0,
            )

          const livrees =
            actives.filter(
              (commande) =>
                commande.statut ===
                  'LIVREE' ||
                Boolean(
                  commande.dateLivraison,
                ),
            )

          const quantiteLivree =
            livrees.reduce(
              (total, commande) =>
                total +
                Number(
                  commande.quantite ||
                    0,
                ),
              0,
            )

          const montantLivre =
            livrees.reduce(
              (total, commande) =>
                total +
                Number(
                  commande.quantite ||
                    0,
                ) *
                  Number(
                    commande.prixUnitaire ||
                      0,
                  ),
              0,
            )

          const progression =
            quantite > 0
              ? Math.round(
                  (quantiteLivree /
                    quantite) *
                    100,
                )
              : 0

          const dates =
            commandesDonateur
              .map(
                (commande) =>
                  commande.dateCommande,
              )
              .filter(Boolean)
              .sort()

          return {
            donateur,
            commandes:
              commandesDonateur,
            commandesActives:
              actives,
            nbCommandes:
              commandesDonateur
                .length,
            quantite,
            montant,
            quantiteLivree,
            montantLivre,
            progression,
            statut:
              statutEntreprise(
                commandesDonateur,
              ),
            derniereCommande:
              dates.at(-1) || '',
          }
        },
      )
      .sort((a, b) =>
        b.montant - a.montant ||
        a.donateur.nom.localeCompare(
          b.donateur.nom,
          'fr',
        ),
      )
  }, [
    commandesCampagne,
    donateurs,
  ])

  const villes = useMemo(
    () =>
      [
        ...new Set(
          suivis
            .map(
              (item) =>
                item.donateur.ville,
            )
            .filter(
              (ville): ville is string =>
                Boolean(ville),
            ),
        ),
      ].sort((a, b) =>
        a.localeCompare(b, 'fr'),
      ),
    [suivis],
  )

  const filtered = useMemo(() => {
    const query =
      normalize(search)

    return suivis.filter(
      (item) => {
        if (
          statusFilter !== 'TOUS' &&
          item.statut !==
            statusFilter
        ) {
          return false
        }

        if (
          villeFilter !==
            'TOUTES' &&
          item.donateur.ville !==
            villeFilter
        ) {
          return false
        }

        if (!query) {
          return true
        }

        return normalize(
          [
            item.donateur.nom,
            item.donateur.code,
            item.donateur.ville,
            item.donateur.email,
            item.donateur.telephone,
            item.commandes
              .map(
                (commande) =>
                  commande.numero,
              )
              .join(' '),
          ].join(' '),
        ).includes(query)
      },
    )
  }, [
    suivis,
    search,
    statusFilter,
    villeFilter,
  ])

  const totals = useMemo(
    () => ({
      entreprises:
        filtered.length,
      commandes:
        filtered.reduce(
          (total, item) =>
            total +
            item.nbCommandes,
          0,
        ),
      brioches:
        filtered.reduce(
          (total, item) =>
            total +
            item.quantite,
          0,
        ),
      montant:
        filtered.reduce(
          (total, item) =>
            total +
            item.montant,
          0,
        ),
      livrees:
        filtered.filter(
          (item) =>
            item.statut ===
            'LIVREE',
        ).length,
      aTraiter:
        filtered.filter(
          (item) =>
            item.statut ===
              'A_TRAITER' ||
            item.statut ===
              'A_LIVRER',
        ).length,
    }),
    [filtered],
  )

  const selected =
    selectedDonateurId ===
    null
      ? null
      : suivis.find(
          (item) =>
            item.donateur.id ===
            selectedDonateurId,
        ) || null

  function exportCsv() {
    const header = [
      'Entreprise',
      'Code',
      'Ville',
      'Commandes',
      'Brioches',
      'Montant',
      'Brioches livrées',
      'Progression',
      'Statut',
      'Dernière commande',
    ]

    const rows = filtered.map(
      (item) => [
        item.donateur.nom,
        item.donateur.code,
        item.donateur.ville,
        item.nbCommandes,
        item.quantite,
        item.montant.toFixed(
          2,
        ),
        item.quantiteLivree,
        `${item.progression}%`,
        STATUS_LABELS[
          item.statut
        ],
        item.derniereCommande,
      ],
    )

    const content =
      '\ufeff' +
      [header, ...rows]
        .map((row) =>
          row
            .map(csvCell)
            .join(';'),
        )
        .join('\r\n')

    const url =
      URL.createObjectURL(
        new Blob([content], {
          type: 'text/csv;charset=utf-8',
        }),
      )

    const link =
      document.createElement(
        'a',
      )

    link.href = url
    link.download =
      `suivi-entreprises-${campagneFilter}.csv`

    document.body.appendChild(
      link,
    )
    link.click()
    link.remove()

    window.setTimeout(
      () =>
        URL.revokeObjectURL(
          url,
        ),
      1000,
    )
  }

  return (
    <main className="sge-page">
      <header className="sge-header">
        <div>
          <span className="sge-eyebrow">
            Commandes dons · Pilotage
          </span>
          <h1>
            Suivi global des entreprises
          </h1>
          <p>
            Une vue synthétique de chaque
            entreprise, de ses commandes
            et de l'avancement de
            l'Opération Brioches.
          </p>
        </div>

        <div className="sge-header-actions">
          <select
            value={
              campagneFilter
            }
            onChange={(event) =>
              setCampagneFilter(
                event.target.value,
              )
            }
            aria-label="Campagne"
          >
            <option value="TOUTES">
              Toutes les campagnes
            </option>

            {campagnes.map(
              (campagne) => (
                <option
                  key={campagne}
                  value={campagne}
                >
                  {campagne}
                </option>
              ),
            )}
          </select>

          <button
            type="button"
            className="sge-secondary"
            onClick={exportCsv}
          >
            <Download size={17} />
            Exporter
          </button>
        </div>
      </header>

      <section className="sge-kpis">
        <Kpi
          icon={
            <Building2
              size={21}
            />
          }
          tone="blue"
          label="Entreprises"
          value={formatNumber(
            totals.entreprises,
          )}
        />

        <Kpi
          icon={
            <ShoppingCart
              size={21}
            />
          }
          tone="orange"
          label="Commandes"
          value={formatNumber(
            totals.commandes,
          )}
        />

        <Kpi
          icon={
            <Package size={21} />
          }
          tone="purple"
          label="Brioches"
          value={formatNumber(
            totals.brioches,
          )}
        />

        <Kpi
          icon={<Euro size={21} />}
          tone="green"
          label="Montant"
          value={formatMoney(
            totals.montant,
          )}
        />

        <Kpi
          icon={
            <CheckCircle2
              size={21}
            />
          }
          tone="green"
          label="Entreprises livrées"
          value={formatNumber(
            totals.livrees,
          )}
        />

        <Kpi
          icon={<Truck size={21} />}
          tone="red"
          label="À traiter"
          value={formatNumber(
            totals.aTraiter,
          )}
        />
      </section>

      <section className="sge-card">
        <div className="sge-card-title">
          <div>
            <span>
              <Building2
                size={18}
              />
            </span>
            <div>
              <h2>
                Entreprises participantes
              </h2>
              <small>
                {filtered.length}{' '}
                résultat
                {filtered.length > 1
                  ? 's'
                  : ''}
              </small>
            </div>
          </div>
        </div>

        <div className="sge-toolbar">
          <label className="sge-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Rechercher une entreprise, une ville, une commande..."
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target
                  .value as
                  | 'TOUS'
                  | SuiviStatut,
              )
            }
          >
            <option value="TOUS">
              Tous les statuts
            </option>
            {(
              Object.keys(
                STATUS_LABELS,
              ) as SuiviStatut[]
            ).map((statut) => (
              <option
                key={statut}
                value={statut}
              >
                {
                  STATUS_LABELS[
                    statut
                  ]
                }
              </option>
            ))}
          </select>

          <select
            value={villeFilter}
            onChange={(event) =>
              setVilleFilter(
                event.target.value,
              )
            }
          >
            <option value="TOUTES">
              Toutes les villes
            </option>
            {villes.map((ville) => (
              <option
                key={ville}
                value={ville}
              >
                {ville}
              </option>
            ))}
          </select>
        </div>

        <div className="sge-table-wrap">
          <table className="sge-table">
            <thead>
              <tr>
                <th>Entreprise</th>
                <th>Ville</th>
                <th>Commandes</th>
                <th>Brioches</th>
                <th>Montant</th>
                <th>Livraison</th>
                <th>Statut</th>
                <th>Dernière commande</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map(
                (item) => (
                  <tr
                    key={
                      item.donateur.id
                    }
                    onClick={() =>
                      setSelectedDonateurId(
                        item.donateur.id,
                      )
                    }
                  >
                    <td>
                      <div className="sge-company">
                        <span>
                          <Building2
                            size={17}
                          />
                        </span>
                        <div>
                          <strong>
                            {
                              item
                                .donateur
                                .nom
                            }
                          </strong>
                          <small>
                            DON-
                            {String(
                              item
                                .donateur
                                .code,
                            ).padStart(
                              6,
                              '0',
                            )}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="sge-city">
                        <MapPin
                          size={14}
                        />
                        {item.donateur
                          .ville ||
                          '—'}
                      </span>
                    </td>

                    <td>
                      <strong>
                        {
                          item.nbCommandes
                        }
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {formatNumber(
                          item.quantite,
                        )}
                      </strong>
                    </td>

                    <td>
                      <strong>
                        {formatMoney(
                          item.montant,
                        )}
                      </strong>
                    </td>

                    <td>
                      <div className="sge-progress-cell">
                        <div>
                          <span>
                            {
                              item.quantiteLivree
                            }{' '}
                            /{' '}
                            {
                              item.quantite
                            }
                          </span>
                          <strong>
                            {
                              item.progression
                            }
                            %
                          </strong>
                        </div>

                        <span className="sge-progress">
                          <i
                            style={{
                              width: `${item.progression}%`,
                            }}
                          />
                        </span>
                      </div>
                    </td>

                    <td>
                      <StatusBadge
                        status={
                          item.statut
                        }
                      />
                    </td>

                    <td>
                      {formatDate(
                        item.derniereCommande,
                      )}
                    </td>

                    <td>
                      <button
                        type="button"
                        className="sge-icon-button"
                        onClick={(
                          event,
                        ) => {
                          event.stopPropagation()
                          setSelectedDonateurId(
                            item.donateur.id,
                          )
                        }}
                        aria-label={`Voir ${item.donateur.nom}`}
                      >
                        <Eye size={17} />
                      </button>
                    </td>
                  </tr>
                ),
              )}

              {filtered.length ===
                0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="sge-empty"
                  >
                    Aucune entreprise
                    ne correspond aux
                    filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selected && (
        <div
          className="sge-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setSelectedDonateurId(
                null,
              )
            }
          }}
        >
          <section
            className="sge-modal"
            role="dialog"
            aria-modal="true"
          >
            <header className="sge-modal-header">
              <div>
                <span>
                  SUIVI ENTREPRISE
                </span>
                <h2>
                  {
                    selected
                      .donateur.nom
                  }
                </h2>
                <p>
                  {selected.donateur
                    .ville ||
                    'Ville non renseignée'}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDonateurId(
                    null,
                  )
                }
                aria-label="Fermer"
              >
                <X size={19} />
              </button>
            </header>

            <div className="sge-modal-body">
              <section className="sge-detail-kpis">
                <DetailKpi
                  label="Commandes"
                  value={String(
                    selected.nbCommandes,
                  )}
                />
                <DetailKpi
                  label="Brioches"
                  value={formatNumber(
                    selected.quantite,
                  )}
                />
                <DetailKpi
                  label="Montant"
                  value={formatMoney(
                    selected.montant,
                  )}
                />
                <DetailKpi
                  label="Livré"
                  value={`${selected.progression}%`}
                />
              </section>

              <div className="sge-detail-grid">
                <section className="sge-info-card">
                  <header>
                    <Building2
                      size={17}
                    />
                    <h3>
                      Entreprise
                    </h3>
                  </header>

                  <InfoLine
                    label="Code"
                    value={`DON-${String(
                      selected.donateur
                        .code,
                    ).padStart(
                      6,
                      '0',
                    )}`}
                  />
                  <InfoLine
                    label="Ville"
                    value={
                      selected.donateur
                        .ville
                    }
                  />
                  <InfoLine
                    label="E-mail"
                    value={
                      selected.donateur
                        .email
                    }
                  />
                  <InfoLine
                    label="Téléphone"
                    value={
                      selected.donateur
                        .telephone
                    }
                  />
                </section>

                <section className="sge-info-card">
                  <header>
                    <Euro size={17} />
                    <h3>
                      Règlement
                    </h3>
                  </header>

                  <InfoLine
                    label="Mode"
                    value={formatPaymentMethod(
                      selected.commandesActives[
                        0
                      ]?.modeReglement,
                    )}
                  />
                  <InfoLine
                    label="JDI"
                    value={
                      selected
                        .commandesActives[
                        0
                      ]?.jdi ||
                      '—'
                    }
                  />
                  <InfoLine
                    label="JDP"
                    value={
                      selected
                        .commandesActives[
                        0
                      ]?.jdp ||
                      '—'
                    }
                  />
                  <InfoLine
                    label="RF"
                    value={
                      selected
                        .commandesActives[
                        0
                      ]?.rf ||
                      '—'
                    }
                  />
                </section>
              </div>

              <section className="sge-orders-card">
                <header>
                  <div>
                    <ShoppingCart
                      size={18}
                    />
                    <h3>
                      Commandes
                    </h3>
                  </div>

                  <button
                    type="button"
                    className="sge-link-button"
                    onClick={() =>
                      navigate(
                        `/commandes?donateur=${selected.donateur.id}`,
                      )
                    }
                  >
                    Voir toutes
                    <ChevronRight
                      size={15}
                    />
                  </button>
                </header>

                <div className="sge-order-list">
                  {[...selected.commandes]
                    .sort((a, b) =>
                      b.dateCommande.localeCompare(
                        a.dateCommande,
                      ),
                    )
                    .map(
                      (commande) => (
                        <article
                          key={
                            commande.id
                          }
                        >
                          <div>
                            <strong>
                              {
                                commande.numero
                              }
                            </strong>
                            <small>
                              {formatDate(
                                commande.dateCommande,
                              )}{' '}
                              ·{' '}
                              {
                                commande.campagne
                              }
                            </small>
                          </div>

                          <div className="sge-order-metrics">
                            <span>
                              {
                                commande.quantite
                              }{' '}
                              brioches
                            </span>
                            <strong>
                              {formatMoney(
                                commande.quantite *
                                  commande.prixUnitaire,
                              )}
                            </strong>
                          </div>

                          <span
                            className={`sge-order-status status-${commande.statut.toLowerCase()}`}
                          >
                            {statutCommandeLabel(
                              commande.statut,
                            )}
                          </span>
                        </article>
                      ),
                    )}
                </div>
              </section>
            </div>

            <footer className="sge-modal-footer">
              <button
                type="button"
                className="sge-secondary"
                onClick={() =>
                  navigate(
                    `/bdd/donateurs?donateur=${selected.donateur.id}`,
                  )
                }
              >
                <FileText
                  size={16}
                />
                Fiche donateur
              </button>

              <button
                type="button"
                className="sge-primary"
                onClick={() =>
                  navigate(
                    `/commandes?donateur=${selected.donateur.id}`,
                  )
                }
              >
                <ShoppingCart
                  size={16}
                />
                Voir les commandes
              </button>
            </footer>
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
  tone:
    | 'blue'
    | 'orange'
    | 'purple'
    | 'green'
    | 'red'
  label: string
  value: string
}) {
  return (
    <article className="sge-kpi">
      <span
        className={`sge-kpi-icon ${tone}`}
      >
        {icon}
      </span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function StatusBadge({
  status,
}: {
  status: SuiviStatut
}) {
  return (
    <span
      className={`sge-status status-${status.toLowerCase()}`}
    >
      {status ===
      'LIVREE' ? (
        <CheckCircle2
          size={14}
        />
      ) : status ===
        'A_LIVRER' ? (
        <Truck size={14} />
      ) : (
        <Package size={14} />
      )}
      {STATUS_LABELS[status]}
    </span>
  )
}

function DetailKpi({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <article>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  )
}

function InfoLine({
  label,
  value,
}: {
  label: string
  value?: string
}) {
  return (
    <div className="sge-info-line">
      <span>{label}</span>
      <strong>
        {value || '—'}
      </strong>
    </div>
  )
}
