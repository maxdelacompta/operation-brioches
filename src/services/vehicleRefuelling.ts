/** Points de ravitaillement renseignés par l'équipe communication.
 * Ne constitue pas une source de disponibilités ni d'horaires en temps réel.
 */
export type RefuellingEnergy = 'essence' | 'diesel' | 'e85' | 'gpl' | 'gnv' | 'hydrogene' | 'electrique'

export type RefuellingPoint = {
  id: string
  name: string
  address: string
  energies: RefuellingEnergy[]
  access: string
  notes: string
  active: boolean
}

const KEY = 'ob-vehicules-ravitaillement-v1'

export const refuellingEnergyOptions: { value: RefuellingEnergy; label: string }[] = [
  { value: 'essence', label: 'Essence (SP95 / SP98 / E10)' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'e85', label: 'Superéthanol E85' },
  { value: 'gpl', label: 'GPL' },
  { value: 'gnv', label: 'GNV' },
  { value: 'hydrogene', label: 'Hydrogène' },
  { value: 'electrique', label: 'Recharge électrique' },
]
const allEnergies = new Set<RefuellingEnergy>(refuellingEnergyOptions.map(option => option.value))

export function readRefuellingPoints(): RefuellingPoint[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(stored)) return []
    return stored.filter((value): value is RefuellingPoint =>
      Boolean(value && typeof value === 'object' && typeof value.id === 'string' && typeof value.name === 'string' &&
        typeof value.address === 'string' && Array.isArray(value.energies)))
      .map(point => ({
        ...point,
        energies: point.energies.filter(energy => allEnergies.has(energy)),
        access: typeof point.access === 'string' ? point.access : '',
        notes: typeof point.notes === 'string' ? point.notes : '',
        active: point.active !== false,
      }))
  } catch { return [] }
}

export function writeRefuellingPoints(points: RefuellingPoint[]) {
  localStorage.setItem(KEY, JSON.stringify(points))
}

/** Aucune compatibilité n'est présumée pour les carburants spéciaux.
 * Les motorisations inconnues n'entraînent aucun filtrage.
 */
export function energiesForVehicle(fuelType?: string): RefuellingEnergy[] {
  switch (fuelType) {
    case 'sp95_e10': case 'sp95': case 'sp98': case 'hybride_essence': return ['essence']
    case 'diesel': case 'hybride_diesel': return ['diesel']
    case 'e85': return ['e85']
    case 'gpl': return ['gpl']
    case 'gnv': return ['gnv']
    case 'hydrogene': return ['hydrogene']
    case 'electrique': return ['electrique']
    case 'hybride_rechargeable': return ['essence', 'electrique']
    default: return []
  }
}

export function pointSupportsVehicle(point: RefuellingPoint, fuelType?: string): boolean {
  const required = energiesForVehicle(fuelType)
  return required.length === 0 || required.some(energy => point.energies.includes(energy))
}
