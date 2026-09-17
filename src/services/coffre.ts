import type { DepotBanque, FicheCaisse } from '../types/ob'

/** Toutes les sommes calculées par ce service sont en centimes. */
export const PIECES = [
  { key: 'pieces2', label: '2 €', valeurCentimes: 200, poidsGrammes: 8.5 },
  { key: 'pieces1', label: '1 €', valeurCentimes: 100, poidsGrammes: 7.5 },
  { key: 'pieces050', label: '0,50 €', valeurCentimes: 50, poidsGrammes: 7.8 },
  { key: 'pieces020', label: '0,20 €', valeurCentimes: 20, poidsGrammes: 5.74 },
  { key: 'pieces010', label: '0,10 €', valeurCentimes: 10, poidsGrammes: 4.1 },
  { key: 'pieces005', label: '0,05 €', valeurCentimes: 5, poidsGrammes: 3.92 },
  { key: 'pieces002', label: '0,02 €', valeurCentimes: 2, poidsGrammes: 3.06 },
  { key: 'pieces001', label: '0,01 €', valeurCentimes: 1, poidsGrammes: 2.3 },
] as const

export const BILLETS = [
  { key: 'billets100', label: '100 €', valeurCentimes: 10000 },
  { key: 'billets50', label: '50 €', valeurCentimes: 5000 },
  { key: 'billets20', label: '20 €', valeurCentimes: 2000 },
  { key: 'billets10', label: '10 €', valeurCentimes: 1000 },
  { key: 'billets5', label: '5 €', valeurCentimes: 500 },
] as const

export type CoupureKey =
  | (typeof PIECES)[number]['key']
  | (typeof BILLETS)[number]['key']

export type ContenuCoffre = Pick<
  FicheCaisse,
  CoupureKey | 'nbCheques' | 'montantCheques'
>

export type LigneCoffre = {
  key: CoupureKey
  label: string
  valeurCentimes: number
  quantite: number
  montantCentimes: number
  poidsUnitaireGrammes?: number
  poidsGrammes?: number
}

export type ResultatCoffre = {
  campagne: string
  dateCalcul: string
  pieces: LigneCoffre[]
  billets: LigneCoffre[]
  totalPieces: number
  montantPieces: number
  poidsPiecesGrammes: number
  totalBillets: number
  montantBillets: number
  totalCheques: number
  montantCheques: number
  totalEspeces: number
  totalGeneral: number
  nbFichesControlees: number
  nbFichesAControler: number
  nbDepots: number
  inventaireInitialRenseigne: boolean
}

const COUPURES = [...PIECES, ...BILLETS] as const

export function eurosVersCentimes(montant: number): number {
  const centimes = Math.round(montant * 100)

  if (
    !Number.isFinite(montant) ||
    montant < 0 ||
    !Number.isSafeInteger(centimes) ||
    Math.abs(montant * 100 - centimes) > 0.000001
  ) {
    throw new Error(`Montant invalide : ${montant}. Deux décimales maximum.`)
  }

  return centimes
}

function validerContenu(
  contenu: ContenuCoffre,
  source: string,
): void {
  for (const coupure of COUPURES) {
    const quantite = contenu[coupure.key]

    if (!Number.isSafeInteger(quantite) || quantite < 0) {
      throw new Error(`${source} : quantité invalide pour ${coupure.label}.`)
    }
  }

  if (!Number.isSafeInteger(contenu.nbCheques) || contenu.nbCheques < 0) {
    throw new Error(`${source} : nombre de chèques invalide.`)
  }

  const montant = eurosVersCentimes(contenu.montantCheques)

  if ((contenu.nbCheques === 0) !== (montant === 0)) {
    throw new Error(`${source} : nombre et montant des chèques incohérents.`)
  }
}

function verifierIdentifiants<T extends { id: string | number }>(
  elements: T[],
  nom: string,
): void {
  const identifiants = new Set<string>()

  for (const element of elements) {
    const id = String(element.id)

    if (!id.trim() || identifiants.has(id)) {
      throw new Error(`${nom} : identifiant absent ou dupliqué (${id}).`)
    }

    identifiants.add(id)
  }
}

/**
 * Calcul automatique en lecture seule :
 * inventaire initial éventuel + TOUTES les fiches enregistrées
 * - remises bancaires enregistrées (les remises annulées sont ignorées).
 * Le statut manuel « CONTROLEE » n'intervient plus dans le calcul.
 */
export function calculerCoffre(
  campagne: string,
  fichesCaisse: FicheCaisse[],
  depotsBanque: DepotBanque[],
  soldeInitial?: ContenuCoffre,
): ResultatCoffre {
  if (!campagne.trim()) {
    throw new Error('Sélectionne une campagne.')
  }

  verifierIdentifiants(fichesCaisse, 'Fiches de caisse')
  verifierIdentifiants(depotsBanque, 'Dépôts bancaires')

  // Chaque fiche enregistrée contribue une seule fois au solde, même
  // si son ancien statut est « A_CONTROLER » ou absent.
  const fiches = fichesCaisse.filter(
    fiche => fiche.campagne === campagne,
  )

  const depots = depotsBanque.filter(
    depot => depot.campagne === campagne && depot.statut === 'ENREGISTRE',
  )

  fiches.forEach(fiche => validerContenu(fiche, `Fiche ${fiche.numero}`))
  depots.forEach(depot => validerContenu(depot, `Remise ${depot.reference}`))

  if (soldeInitial) {
    validerContenu(soldeInitial, 'Inventaire initial')
  }

  function construireLigne(coupure: (typeof COUPURES)[number]): LigneCoffre {
    const initial = soldeInitial?.[coupure.key] ?? 0
    const entrees = fiches.reduce(
      (total, fiche) => total + fiche[coupure.key],
      0,
    )
    const sorties = depots.reduce(
      (total, depot) => total + depot[coupure.key],
      0,
    )

    const quantite = initial + entrees - sorties

    if (!Number.isSafeInteger(quantite) || quantite < 0) {
      throw new Error(
        `Stock incohérent pour ${coupure.label} : ${sorties} remis, ` +
        `${initial + entrees} disponibles.`,
      )
    }

    const montantCentimes = quantite * coupure.valeurCentimes

    if (!Number.isSafeInteger(montantCentimes)) {
      throw new Error(`Montant trop élevé pour ${coupure.label}.`)
    }

    if ('poidsGrammes' in coupure) {
      return {
        key: coupure.key,
        label: coupure.label,
        valeurCentimes: coupure.valeurCentimes,
        quantite,
        montantCentimes,
        poidsUnitaireGrammes: coupure.poidsGrammes,
        poidsGrammes: quantite * coupure.poidsGrammes,
      }
    }

    return {
      key: coupure.key,
      label: coupure.label,
      valeurCentimes: coupure.valeurCentimes,
      quantite,
      montantCentimes,
    }
  }

  const pieces = PIECES.map(construireLigne)
  const billets = BILLETS.map(construireLigne)

  const nombreChequesEntres =
    (soldeInitial?.nbCheques ?? 0) +
    fiches.reduce((total, fiche) => total + fiche.nbCheques, 0)

  const nombreChequesSortis = depots.reduce(
    (total, depot) => total + depot.nbCheques,
    0,
  )

  const montantChequesEntres =
    eurosVersCentimes(soldeInitial?.montantCheques ?? 0) +
    fiches.reduce(
      (total, fiche) => total + eurosVersCentimes(fiche.montantCheques),
      0,
    )

  const montantChequesSortis = depots.reduce(
    (total, depot) => total + eurosVersCentimes(depot.montantCheques),
    0,
  )

  const totalCheques = nombreChequesEntres - nombreChequesSortis
  const montantCheques = montantChequesEntres - montantChequesSortis

  if (
    !Number.isSafeInteger(totalCheques) ||
    !Number.isSafeInteger(montantCheques) ||
    totalCheques < 0 ||
    montantCheques < 0 ||
    (totalCheques === 0) !== (montantCheques === 0)
  ) {
    throw new Error('Remises de chèques incohérentes avec le stock disponible.')
  }

  const totalPieces = pieces.reduce((somme, ligne) => somme + ligne.quantite, 0)
  const montantPieces = pieces.reduce((somme, ligne) => somme + ligne.montantCentimes, 0)
  const poidsPiecesGrammes = pieces.reduce(
    (somme, ligne) => somme + (ligne.poidsGrammes ?? 0),
    0,
  )
  const totalBillets = billets.reduce((somme, ligne) => somme + ligne.quantite, 0)
  const montantBillets = billets.reduce((somme, ligne) => somme + ligne.montantCentimes, 0)
  const totalEspeces = montantPieces + montantBillets
  const totalGeneral = totalEspeces + montantCheques

  if (!Number.isSafeInteger(totalGeneral)) {
    throw new Error('Le montant total du coffre dépasse la limite de calcul.')
  }

  return {
    campagne,
    dateCalcul: new Date().toISOString(),
    pieces,
    billets,
    totalPieces,
    montantPieces,
    poidsPiecesGrammes,
    totalBillets,
    montantBillets,
    totalCheques,
    montantCheques,
    totalEspeces,
    totalGeneral,
    // Champ conservé pour ne pas modifier Coffre.tsx : désormais,
    // toutes les fiches enregistrées sont automatiquement intégrées.
    nbFichesControlees: fiches.length,
    nbFichesAControler: 0,
    nbDepots: depots.length,
    inventaireInitialRenseigne: soldeInitial !== undefined,
  }
}

export function formatEuro(centimes: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(centimes / 100)
}

export function formatKg(grammes: number): string {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(grammes / 1000) + ' kg'
}
