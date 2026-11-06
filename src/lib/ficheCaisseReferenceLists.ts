import type { Campagne } from '../types/ob'

const STANDS_STORAGE_KEY = 'ob-stands-brioches-v1'
const CLOTURE_PREFIX = 'ob-stand-cloture-v1-'

export type StandCloturePourCaisse = {
  id: string
  campagne?: string
  nom: string
  lieu: string
  date: string
  statut?: string
  briochesCompteur?: number
  briochesFiche?: number
  briochesTotal?: number
  donsSansBrioche?: number
  montantDonsSansBrioche?: number
}

type ClotureStand = {
  closedAt: string
  briochesCompteur?: number
  briochesFiche?: number
  briochesTotal?: number
  donsSansBrioche?: number
  montantDonsSansBrioche?: number
}

const toNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined

export function lireClotureStand(id: string): ClotureStand | null {
  try {
    const raw = localStorage.getItem(`${CLOTURE_PREFIX}${id}`)
    if (!raw) return null
    const cloture: unknown = JSON.parse(raw)
    if (!cloture || typeof cloture !== 'object') return null
    const candidate = cloture as Record<string, unknown>
    if (typeof candidate.closedAt !== 'string') return null
    return {
      closedAt: candidate.closedAt,
      briochesCompteur: toNumber(candidate.briochesCompteur),
      briochesFiche: toNumber(candidate.briochesFiche),
      briochesTotal: toNumber(candidate.briochesTotal),
      donsSansBrioche: toNumber(candidate.donsSansBrioche),
      montantDonsSansBrioche: toNumber(candidate.montantDonsSansBrioche),
    }
  } catch {
    return null
  }
}

/**
 * La page StandsBrioches considère un stand comme fermé dès lors qu'un
 * décompte a été figé dans ob-stand-cloture-v1-<id>.
 * On utilise le même indicateur : « Terminé » seul n'est pas un décompte.
 */
export function lireStandsClotures(): StandCloturePourCaisse[] {
  try {
    const brut = localStorage.getItem(STANDS_STORAGE_KEY)
    const parsed: unknown = JSON.parse(brut || '[]')
    if (!Array.isArray(parsed)) return []

    return parsed.filter((stand): stand is StandCloturePourCaisse => {
      if (!stand || typeof stand !== 'object') return false
      const candidat = stand as Partial<StandCloturePourCaisse>
      if (typeof candidat.id !== 'string' ||
          typeof candidat.nom !== 'string' ||
          typeof candidat.date !== 'string') return false
      try {
        const cloture = lireClotureStand(candidat.id)
        if (!cloture) return false
        Object.assign(candidat, {
          briochesCompteur: cloture.briochesCompteur,
          briochesFiche: cloture.briochesFiche,
          briochesTotal: cloture.briochesTotal,
          donsSansBrioche: cloture.donsSansBrioche,
          montantDonsSansBrioche: cloture.montantDonsSansBrioche,
        })
        return true
      } catch {
        return false
      }
    })
  } catch {
    return []
  }
}

/** Aligné sur l'attribution de campagne dans StandsBrioches.tsx. */
export function campagneDuStandPourCaisse(
  stand: StandCloturePourCaisse,
  campagnes: Campagne[],
): string {
  const jour = stand.date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jour)) return stand.campagne || ''

  const candidates = campagnes.filter(campagne =>
    !campagne.id.toUpperCase().startsWith('TEST-') &&
    campagne.dateDebut && campagne.dateFin &&
    campagne.dateDebut <= jour && jour <= campagne.dateFin,
  )
  if (candidates.length === 1) return candidates[0].id
  if (candidates.length > 1) return stand.campagne || ''

  const annee = Number(jour.slice(0, 4))
  const parAnnee = campagnes.filter(campagne =>
    !campagne.id.toUpperCase().startsWith('TEST-') &&
    (campagne.annee === annee || new RegExp(`\\b${annee}\\b`).test(campagne.id)),
  )
  if (parAnnee.length === 1) return parAnnee[0].id
  return stand.campagne || ''
}

export function standsCloturesDeCampagne(
  stands: StandCloturePourCaisse[],
  campagnes: Campagne[],
  campagneId: string,
): StandCloturePourCaisse[] {
  return stands
    .filter(stand => campagneDuStandPourCaisse(stand, campagnes) === campagneId)
    .sort((a, b) => a.date.localeCompare(b.date) || a.nom.localeCompare(b.nom, 'fr'))
}
