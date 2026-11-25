import type { SponsoringBenefit, SponsoringDeal } from '../types/sponsoring'

const STORAGE_KEY = 'ob-sponsoring-v1'

export const DEFAULT_BENEFITS = [
  'Logo sur les affiches',
  'Logo sur les kakémonos',
  'Publication Facebook',
  'Publication LinkedIn',
  'Présence sur le site internet',
  'Remerciement officiel',
  'Logo sur les supports de communication',
]

export function sponsorId() {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `sponsor-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function makeBenefit(label: string): SponsoringBenefit {
  return { id: sponsorId(), label, planned: false, done: false, doneAt: '', comment: '', proof: null }
}

export function createSponsoringDeal(campagneId: string): SponsoringDeal {
  const now = new Date().toISOString()
  return {
    id: sponsorId(), campagneId, donateurId: null, entreprise: '', contact: '', adresse: '',
    montant: 0, statut: 'brouillon', date: now.slice(0, 10), notes: '', signedConvention: null,
    benefits: DEFAULT_BENEFITS.map(makeBenefit), createdAt: now, updatedAt: now,
  }
}

export function readSponsoring(): SponsoringDeal[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((deal): deal is SponsoringDeal => Boolean(deal && typeof deal === 'object' &&
      typeof deal.id === 'string' && typeof deal.campagneId === 'string' && Array.isArray(deal.benefits)))
  } catch {
    return []
  }
}

export function persistSponsoring(deals: SponsoringDeal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals))
}
