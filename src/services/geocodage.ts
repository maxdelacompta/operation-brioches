import type { GeoCoordinate } from '../types/geographie'

const CACHE_KEY = 'ob-geographie-geocode-v1'

type GeoCache = Record<string, GeoCoordinate>

const KNOWN_CITIES: Record<string, GeoCoordinate> = {
  nancy: { longitude: 6.1844, latitude: 48.6921, label: 'Nancy' },
  laxou: { longitude: 6.1480, latitude: 48.6833, label: 'Laxou' },
  ludres: { longitude: 6.1677, latitude: 48.6209, label: 'Ludres' },
  'vandoeuvre les nancy': { longitude: 6.1687, latitude: 48.6561, label: 'Vandœuvre-lès-Nancy' },
  'villers les nancy': { longitude: 6.1531, latitude: 48.6731, label: 'Villers-lès-Nancy' },
  jarville: { longitude: 6.2061, latitude: 48.6681, label: 'Jarville-la-Malgrange' },
  'jarville la malgrange': { longitude: 6.2061, latitude: 48.6681, label: 'Jarville-la-Malgrange' },
  maxeville: { longitude: 6.1672, latitude: 48.7113, label: 'Maxéville' },
  essey: { longitude: 6.2270, latitude: 48.7050, label: 'Essey-lès-Nancy' },
  'essey les nancy': { longitude: 6.2270, latitude: 48.7050, label: 'Essey-lès-Nancy' },
  seichamps: { longitude: 6.2630, latitude: 48.7140, label: 'Seichamps' },
  tomblaine: { longitude: 6.2180, latitude: 48.6840, label: 'Tomblaine' },
  malzeville: { longitude: 6.1850, latitude: 48.7120, label: 'Malzéville' },

  toul: { longitude: 5.8912, latitude: 48.6747, label: 'Toul' },
  bruley: { longitude: 5.8513, latitude: 48.7048, label: 'Bruley' },
  chaligny: { longitude: 6.0838, latitude: 48.6234, label: 'Chaligny' },
  'neuves maisons': { longitude: 6.1032, latitude: 48.6178, label: 'Neuves-Maisons' },

  'pont a mousson': { longitude: 6.0548, latitude: 48.9045, label: 'Pont-à-Mousson' },
  'pont a mousson ': { longitude: 6.0548, latitude: 48.9045, label: 'Pont-à-Mousson' },
  dieulouard: { longitude: 6.0670, latitude: 48.8390, label: 'Dieulouard' },
  nomeny: { longitude: 6.2260, latitude: 48.8890, label: 'Nomeny' },
  blenod: { longitude: 6.0480, latitude: 48.8840, label: 'Blénod-lès-Pont-à-Mousson' },
  'blenod les pont a mousson': { longitude: 6.0480, latitude: 48.8840, label: 'Blénod-lès-Pont-à-Mousson' },

  luneville: { longitude: 6.4938, latitude: 48.5920, label: 'Lunéville' },
  baccarat: { longitude: 6.7391, latitude: 48.4499, label: 'Baccarat' },
  'saint nicolas de port': { longitude: 6.3024, latitude: 48.6307, label: 'Saint-Nicolas-de-Port' },
  dombasle: { longitude: 6.3491, latitude: 48.6236, label: 'Dombasle-sur-Meurthe' },
  'dombasle sur meurthe': { longitude: 6.3491, latitude: 48.6236, label: 'Dombasle-sur-Meurthe' },
  badonviller: { longitude: 6.8950, latitude: 48.5010, label: 'Badonviller' },
  blamont: { longitude: 6.8500, latitude: 48.5900, label: 'Blâmont' },

  briey: { longitude: 5.9395, latitude: 49.2488, label: 'Val de Briey' },
  'val de briey': { longitude: 5.9395, latitude: 49.2488, label: 'Val de Briey' },
  longwy: { longitude: 5.7606, latitude: 49.5217, label: 'Longwy' },
  jarny: { longitude: 5.8760, latitude: 49.1577, label: 'Jarny' },

  vezelise: { longitude: 6.0870, latitude: 48.4870, label: 'Vézelise' },
  'colombey les belles': { longitude: 5.8980, latitude: 48.5280, label: 'Colombey-les-Belles' },

  flavigny: { longitude: 6.1910, latitude: 48.5660, label: 'Flavigny-sur-Moselle' },
  'flavigny sur moselle': { longitude: 6.1910, latitude: 48.5660, label: 'Flavigny-sur-Moselle' },

  verdun: { longitude: 5.3830, latitude: 49.1590, label: 'Verdun' },
}

export function normalizeGeoText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/[-_/(),.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function loadCache(): GeoCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as GeoCache)
      : {}
  } catch {
    return {}
  }
}

function saveCache(cache: GeoCache) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
}

export function geoKey(input: {
  address?: string
  postalCode?: string
  city?: string
  label?: string
}) {
  return normalizeGeoText(
    [
      input.address || '',
      input.postalCode || '',
      input.city || '',
      input.label || '',
    ]
      .filter(Boolean)
      .join(' | '),
  )
}

export function knownCoordinate(
  ...values: Array<string | undefined>
): GeoCoordinate | null {
  const text = normalizeGeoText(
    values.filter(Boolean).join(' '),
  )

  if (!text) return null

  const entries = Object.entries(KNOWN_CITIES)
    .sort((a, b) => b[0].length - a[0].length)

  for (const [key, coordinate] of entries) {
    if (text.includes(key)) {
      return coordinate
    }
  }

  return null
}

export function cleanCommuneLabel(value: string) {
  return value
    .replace(/\bmairie\b/gi, ' ')
    .replace(/\bville\b/gi, ' ')
    .replace(/\bcommune\b/gi, ' ')
    .replace(/\bde\b/gi, ' ')
    .replace(/\bd['’]\b/gi, ' ')
    .replace(/\bpar\b.+$/i, ' ')
    .replace(/\bmr?\b\.?/gi, ' ')
    .replace(/\bmme\b\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function geocodeFrenchLocation(input: {
  address?: string
  postalCode?: string
  city?: string
  label?: string
}): Promise<GeoCoordinate | null> {
  const key = geoKey(input)

  if (!key) return null

  const cached = loadCache()[key]
  if (cached) return cached

  const known = knownCoordinate(
    input.city,
    input.label,
    input.address,
  )

  if (known) {
    const cache = loadCache()
    cache[key] = known
    saveCache(cache)
    return known
  }

  const communeCandidate = cleanCommuneLabel(
    input.city || input.label || '',
  )

  const query = [
    input.address,
    input.postalCode,
    communeCandidate,
    'Meurthe-et-Moselle',
    'France',
  ]
    .filter(Boolean)
    .join(' ')

  if (!query.trim()) return null

  try {
    const response = await fetch(
      `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(
        query,
      )}&limit=1`,
    )

    if (!response.ok) return null

    const payload = (await response.json()) as {
      features?: Array<{
        geometry?: {
          coordinates?: [number, number]
        }
        properties?: {
          label?: string
        }
      }>
    }

    const feature = payload.features?.[0]
    const coordinates = feature?.geometry?.coordinates

    if (
      !coordinates ||
      !Number.isFinite(coordinates[0]) ||
      !Number.isFinite(coordinates[1])
    ) {
      return null
    }

    const result: GeoCoordinate = {
      longitude: coordinates[0],
      latitude: coordinates[1],
      label: feature?.properties?.label,
    }

    const cache = loadCache()
    cache[key] = result
    saveCache(cache)

    return result
  } catch {
    return null
  }
}

export function getCachedCoordinate(input: {
  address?: string
  postalCode?: string
  city?: string
  label?: string
}): GeoCoordinate | null {
  const key = geoKey(input)
  const cached = loadCache()[key]

  return (
    cached ||
    knownCoordinate(input.city, input.label, input.address) ||
    null
  )
}
