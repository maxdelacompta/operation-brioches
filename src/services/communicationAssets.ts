export type AssetKind = 'materiel' | 'vehicule'
export type Asset = {
  id: string
  kind: AssetKind
  name: string
  category: string
  quantity: number
  location: string
  condition: string
  registration: string
  capacity: string
  /** Énergie utilisée par un véhicule. Facultatif pour les anciennes fiches. */
  fuelType?: string
  /** Propriétaire du parc ; les anciennes fiches sont réputées AEIM. */
  fleetOwner?: 'AEIM' | 'ESAT'
  /** Identifiant de l'établissement ESAT propriétaire, si applicable. */
  esatId?: string
}
export type Reservation = {
  id: string
  assetId: string
  campaignId: string
  beneficiary: string
  /** Identifiant stable du stand, indépendant de son nom affiché. */
  standId?: string
  driver: string
  quantity: number
  dateFrom: string
  dateTo: string
  status: 'reserve' | 'sorti' | 'retourne'
  comment: string
}

const ASSETS_KEY = 'ob-communication-assets-v1'
const RESERVATIONS_KEY = 'ob-communication-asset-reservations-v1'

export function communicationId() {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function readList<T>(key: string): T[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : [] }
  catch { return [] }
}

export function readAssets(): Asset[] {
  return readList<Asset>(ASSETS_KEY).filter(row => Boolean(row && row.id && (row.kind === 'materiel' || row.kind === 'vehicule')))
}
export function readReservations(): Reservation[] {
  return readList<Reservation>(RESERVATIONS_KEY).filter(row => Boolean(row && row.id && row.assetId && row.campaignId))
}
export function writeAssets(rows: Asset[]) { localStorage.setItem(ASSETS_KEY, JSON.stringify(rows)) }
export function writeReservations(rows: Reservation[]) { localStorage.setItem(RESERVATIONS_KEY, JSON.stringify(rows)) }

export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd
}

/** Empêche les doubles réservations et les sorties dépassant le stock physique. */
export function reservationCapacityError(asset: Asset, requested: Reservation, existing: Reservation[]): string | null {
  const occupied = existing.filter(row => row.id !== requested.id && row.assetId === asset.id && row.status !== 'retourne' &&
    intervalsOverlap(row.dateFrom, row.dateTo, requested.dateFrom, requested.dateTo))
  // Calculer le maximum réellement simultané : deux réservations disjointes
  // ne doivent pas être additionnées simplement parce qu'elles croisent la demande.
  const starts = [requested.dateFrom, ...occupied.map(row => row.dateFrom > requested.dateFrom ? row.dateFrom : requested.dateFrom)]
  const peak = Math.max(0, ...starts.map(day => occupied.filter(row => row.dateFrom <= day && day <= row.dateTo)
    .reduce((sum, row) => sum + row.quantity, 0)))
  if (requested.quantity + peak > (asset.kind === 'vehicule' ? 1 : asset.quantity)) {
    return asset.kind === 'vehicule' ? 'Ce véhicule est déjà réservé sur cette période.' : 'Stock insuffisant sur la période choisie.'
  }
  return null
}
