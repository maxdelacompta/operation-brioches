import { affectationsCommandesEntreprise } from '../lib/ficheCaisseCommandes'
import {
  useEffect,
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
import { useJustificatifs } from '../contexts/JustificatifsContext'
import type { JustificatifDon } from '../types/justificatifs'

import type {
  Commande,
  FicheCaisse,
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
  paiement: 'PAYEE' | 'PARTIELLE' | 'A_CONFIRMER'
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

/** Le paiement est rapproché des fiches de caisse de la même campagne.
 * Ne jamais attribuer une fiche à plusieurs commandes d'un même donateur.
 */
type EtatPaiement = 'PAYEE' | 'PARTIELLE' | 'A_CONFIRMER'
type RapprochementPaiement = { etat: EtatPaiement; montantEncaisse: number; fiches: string[] }

const campagneAnnee = (value: unknown) => String(value ?? '').match(/20\d{2}/)?.[0] ?? normalize(value)
const montant = (value: unknown) => Math.max(0, Number(value) || 0)

function totalEncaisseFiche(fiche: FicheCaisse): number {
  const billets = montant(fiche.billets100) * 100 + montant(fiche.billets50) * 50 +
    montant(fiche.billets20) * 20 + montant(fiche.billets10) * 10 + montant(fiche.billets5) * 5
  const pieces = montant(fiche.pieces2) * 2 + montant(fiche.pieces1) +
    montant(fiche.pieces050) * .5 + montant(fiche.pieces020) * .2 + montant(fiche.pieces010) * .1 +
    montant(fiche.pieces005) * .05 + montant(fiche.pieces002) * .02 + montant(fiche.pieces001) * .01
  // Les dons de 3/5 euros et autres dons ne règlent pas une commande de brioches.
  return Math.round((billets + pieces + montant(fiche.montantCheques) +
    montant(fiche.montantTpe) + montant(fiche.montantVirement)) * 100) / 100
}

function rapprocherPaiements(
  commandes: Commande[],
  fiches: FicheCaisse[],
  justificatifs: JustificatifDon[],
): Map<number, RapprochementPaiement> {
  const actives = commandes.filter(c => c.statut !== 'ANNULEE')
  const byDonateur = new Map<string, Commande[]>()
  for (const commande of actives) {
    const key = `${campagneAnnee(commande.campagne)}:${commande.donateurId}`
    byDonateur.set(key, [...(byDonateur.get(key) ?? []), commande])
  }
  const encaissements = new Map<number, { montantEncaisse: number; fiches: string[] }>()
  for (const fiche of fiches) {
    if (fiche.type !== 'ENTREPRISE') continue
    const montantFiche = totalEncaisseFiche(fiche)
    if (montantFiche <= 0) continue
    const annee = campagneAnnee(fiche.campagne)
    const affectations = affectationsCommandesEntreprise(fiche)
    if (affectations.length > 0) {
      for (const ligne of affectations) {
        const commande = actives.find(c => c.id === Number(ligne.commandeId) && campagneAnnee(c.campagne) === annee)
        if (!commande || ligne.montant <= 0) continue
        const existing = encaissements.get(commande.id) ?? { montantEncaisse: 0, fiches: [] }
        encaissements.set(commande.id, {
          montantEncaisse: Math.round((existing.montantEncaisse + ligne.montant) * 100) / 100,
          fiches: [...existing.fiches, fiche.numero],
        })
      }
      continue
    }
    // Compatibilité des fiches anciennes non liées : une seule commande par donateur.
    // Une fiche explicitement ventilée, même vide, ne doit pas être attribuée par déduction.
    if (fiche.affectationsCommandesEntreprise !== undefined || fiche.commandeId !== undefined) continue
    if (fiche.donateurId == null) continue
    const candidates = byDonateur.get(`${annee}:${fiche.donateurId}`) ?? []
    if (candidates.length !== 1) continue
    const commande = candidates[0]
    const existing = encaissements.get(commande.id) ?? { montantEncaisse: 0, fiches: [] }
    encaissements.set(commande.id, {
      montantEncaisse: Math.round((existing.montantEncaisse + montantFiche) * 100) / 100,
      fiches: [...existing.fiches, fiche.numero],
    })
  }
  return new Map(actives.map(commande => {
    const result = encaissements.get(commande.id) ?? { montantEncaisse: 0, fiches: [] }
    const du = Math.round(montant(commande.quantite) * montant(commande.prixUnitaire) * 100) / 100
    const paiement = commande as Commande & { paiementStatut?: string; paye?: boolean; paiementConfirme?: boolean }
    const confirmation = paiement.paiementStatut === 'PAYE' || paiement.paye === true || paiement.paiementConfirme === true ||
      justificatifs.some(jd => jd.commandeId === String(commande.id) && jd.paiementStatut === 'PAYE' &&
        jd.statut !== 'ARCHIVE' && jd.statut !== 'ERREUR' &&
        (!jd.campagne || campagneAnnee(jd.campagne) === campagneAnnee(commande.campagne)))
    const etat: EtatPaiement = confirmation || (du > 0 && result.montantEncaisse >= du - 0.01)
      ? 'PAYEE' : result.montantEncaisse > 0 ? 'PARTIELLE' : 'A_CONFIRMER'
    return [commande.id, { ...result, etat }]
  }))
}

function PaiementBadge({ etat }: { etat: EntrepriseSuivi['paiement'] }) {
  return <span className={`sge-payment sge-payment-${etat.toLowerCase()}`}>
    {etat === 'PAYEE' ? <CheckCircle2 size={13} /> : <Euro size={13} />}
    {etat === 'PAYEE' ? 'Payée' : etat === 'PARTIELLE' ? 'Partiellement payée' : 'À confirmer'}
  </span>
}

/**
 * Les dates prévues et les statuts importés ne prouvent pas une livraison.
 * Seules les confirmations de missions depuis « Livraisons / Retraits »
 * alimentent la progression de ce tableau.
 *
 * Les clés des missions récentes identifient la commande et la campagne,
 * afin de ne pas réutiliser une ancienne mission après un reset local.
 */
type MissionDeSuivi = {
  commandeId: number
  commandeCle?: string
  date: string
  updatedAt?: string
  statut: string
  mode: string
  responsable: string
}
type MissionMultiDeSuivi = {
  commandeId: number
  ligneId: string
  statut: string
  mode: string
  responsable: string
}
type MissionsSauvegardees = {
  simples: MissionDeSuivi[]
  multis: Record<string, MissionMultiDeSuivi>
}

function lireMissionsSauvegardees(): MissionsSauvegardees {
  if (typeof localStorage === 'undefined') return { simples: [], multis: {} }
  let simples: MissionDeSuivi[] = []
  let multis: Record<string, MissionMultiDeSuivi> = {}
  try {
    const value: unknown = JSON.parse(localStorage.getItem('ob-livraisons-retraits-v1') || '[]')
    if (Array.isArray(value)) {
      simples = value.filter((item): item is MissionDeSuivi =>
        item != null && typeof item === 'object' &&
        typeof item.commandeId === 'number' && typeof item.statut === 'string' &&
        typeof item.date === 'string' && typeof item.mode === 'string' &&
        typeof item.responsable === 'string',
      )
    }
  } catch { /* missions locales absentes ou illisibles */ }
  try {
    const value: unknown = JSON.parse(localStorage.getItem('ob-livraisons-multisites-v1') || '{}')
    if (value != null && typeof value === 'object' && !Array.isArray(value)) {
      multis = value as Record<string, MissionMultiDeSuivi>
    }
  } catch { /* affectations multisites absentes ou illisibles */ }
  return { simples, multis }
}

const empreinteCommande = (commande: Commande): string => JSON.stringify([
  commande.campagne, commande.id, commande.numero, commande.dateCommande, commande.donateurId,
])

function estConfirmationReelle(mission: { statut: string; mode: string; responsable: string }): boolean {
  // Une ancienne migration pouvait créer une mission « LIVREE » automatiquement,
  // mais avec mode NON_AFFECTE et aucun livreur. Elle ne vaut pas confirmation.
  const responsable = mission.responsable.trim().toLocaleLowerCase('fr')
  return mission.statut === 'LIVREE' && mission.mode !== 'NON_AFFECTE' &&
    responsable !== '' && !['non affecté', 'non affecte', 'bénévole', 'benevole', 'esat', 'services comm', 'retrait'].includes(responsable)
}

function quantiteReellementLivree(
  commande: Commande,
  toutesLesCommandes: Commande[],
  sauvegarde: MissionsSauvegardees,
): number {
  if (commande.statut === 'ANNULEE') return 0
  const max = Math.max(0, Number(commande.quantite) || 0)
  if ((commande.livraisons?.length ?? 0) > 0) {
    // Chaque destination est comptée séparément, sans rendre la commande
    // entière « Livrée » à la première réception.
    const livrees = (commande.livraisons ?? []).reduce((total, livraison, index) => {
      const cle = `${commande.id}:${livraison.id || `index-${index}`}`
      const mission = sauvegarde.multis[cle]
      return total + (mission && mission.commandeId === commande.id &&
        estConfirmationReelle(mission) && livraison.dateLivraison
          ? Math.max(0, Number(livraison.quantite) || 0) : 0)
    }, 0)
    return Math.min(max, livrees)
  }

  const identite = empreinteCommande(commande)
  const mission = sauvegarde.simples.find(item => {
    if (item.commandeId !== commande.id) return false
    if (item.commandeCle) return item.commandeCle === identite
    // Héritage des anciennes missions : rapprochement prudent par date
    // et création de la commande. Ne jamais déduire la livraison de la
    // seule dateLivraison de l'enregistrement entreprise.
    const jourAttendu = commande.datePrevueLivraison || commande.dateLivraison
    const candidates = toutesLesCommandes.filter(c =>
      c.id === item.commandeId &&
      (c.datePrevueLivraison || c.dateLivraison) === item.date &&
      Boolean(c.dateCommande) &&
      typeof item.updatedAt === 'string' && item.updatedAt.slice(0, 10) >= c.dateCommande,
    )
    return !!jourAttendu && item.date === jourAttendu && candidates.length === 1 && candidates[0] === commande
  })
  return mission && estConfirmationReelle(mission) ? max : 0
}

function statutEntreprise(
  commandes: Commande[],
  livreesParCommande: Map<number, number>,
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

  const toutesLivrees = actives.every(commande =>
    Number(commande.quantite) > 0 &&
    (livreesParCommande.get(commande.id) ?? 0) >= Number(commande.quantite),
  )

  if (toutesLivrees) {
    return 'LIVREE'
  }

  if (
    actives.some(
      (commande) =>
        commande.statut === 'A_LIVRER' ||
        commande.statut === 'LIVREE' ||
        (livreesParCommande.get(commande.id) ?? 0) > 0,
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
  const { justificatifs } = useJustificatifs()

  const {
    donateurs,
    commandes,
    fichesCaisse,
    selectedCampagne,
    activeCampagne,
    setSelectedCampagneId,
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

  const campagneFilter = (selectedCampagne ?? activeCampagne)?.id ?? 'TOUTES'
  const setCampagneFilter = setSelectedCampagneId

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

  const paiementsParCommande = useMemo(
    () => rapprocherPaiements(commandes, fichesCaisse, justificatifs),
    [commandes, fichesCaisse, justificatifs],
  )

  // Le suivi relit les missions à l'ouverture et lors du retour sur cet onglet.
  // Aucune mutation de l'historique des commandes n'est effectuée ici.
  const [missionsSauvegardees, setMissionsSauvegardees] = useState(lireMissionsSauvegardees)
  useEffect(() => {
    const refresh = () => setMissionsSauvegardees(lireMissionsSauvegardees())
    window.addEventListener('focus', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])
  const livreesParCommande = useMemo(() => new Map(
    commandesCampagne.map(commande => [
      commande.id,
      quantiteReellementLivree(commande, commandes, missionsSauvegardees),
    ]),
  ), [commandesCampagne, commandes, missionsSauvegardees])

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

          const quantiteLivree = actives.reduce(
            (total, commande) => total + (livreesParCommande.get(commande.id) ?? 0),
            0,
          )

          const montantLivre = actives.reduce(
            (total, commande) => total + (livreesParCommande.get(commande.id) ?? 0) *
              Number(commande.prixUnitaire || 0),
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

          const nbPayees = actives.filter(commande => paiementsParCommande.get(commande.id)?.etat === 'PAYEE').length
          const aUnReglement = actives.some(commande => {
            const etat = paiementsParCommande.get(commande.id)?.etat
            return etat === 'PAYEE' || etat === 'PARTIELLE'
          })
          const paiement: EntrepriseSuivi['paiement'] =
            actives.length > 0 && nbPayees === actives.length ? 'PAYEE'
            : aUnReglement ? 'PARTIELLE' : 'A_CONFIRMER'

          return {
            paiement,
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
                livreesParCommande,
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
    paiementsParCommande,
    livreesParCommande,
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
      'Paiement',
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
        item.paiement === 'PAYEE' ? 'Payée' : item.paiement === 'PARTIELLE' ? 'Partiellement payée' : 'À confirmer',
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
            {campagneFilter !== 'TOUTES' && !campagnes.includes(campagneFilter) && (
              <option value={campagneFilter}>{campagneFilter} · aucune commande</option>
            )}
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
                <th>Statut livraison</th>
                <th>Règlement</th>
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

                    <td><PaiementBadge etat={item.paiement} /></td>

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

                  <div className="sge-payment-detail"><span>État de paiement</span><PaiementBadge etat={selected.paiement} /></div>
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

                          <div className="sge-order-badges">
                            <span className={`sge-order-status status-${commande.statut.toLowerCase()}`}>
                              {statutCommandeLabel(commande.statut)}
                            </span>
                            <PaiementBadge etat={paiementsParCommande.get(commande.id)?.etat ?? 'A_CONFIRMER'} />
                            {(paiementsParCommande.get(commande.id)?.fiches.length ?? 0) > 0 && (
                              <small title={paiementsParCommande.get(commande.id)?.fiches.join(', ')}>
                                Fiches de caisse : {formatMoney(paiementsParCommande.get(commande.id)?.montantEncaisse ?? 0)}
                              </small>
                            )}
                          </div>
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
