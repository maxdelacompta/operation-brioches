/** Stock local par campagne. Les anciennes données sont conservées dans OB 2026. */
export const STOCK_KEY = 'ob2026-stock-brioches-demo-v1'
export const DONS_KEY = 'ob2026-demo-dons-contrepartie-v1'
export const STOCK_CHANGED = 'ob2026:brioches-changed'

export function stockCampaignYear(campagne: string): string {
  const match = campagne.match(/(?:19|20)\d{2}/)
  const test = /^\s*(?:test|specimen)[\s_-]*/i.test(campagne)
  if (test) return `test-${match?.[0] ?? 'sans-annee'}`
  return match?.[0] ?? (campagne.trim().replace(/[^a-z0-9_-]/gi, '_') || 'sans-campagne')
}

export function stockKeyForCampaign(campagne: string): string {
  const year = stockCampaignYear(campagne)
  return year === '2026' ? STOCK_KEY : `ob-${year}-stock-brioches-v1`
}

export function donsKeyForCampaign(campagne: string): string {
  const year = stockCampaignYear(campagne)
  return year === '2026' ? DONS_KEY : `ob-${year}-dons-contrepartie-v1`
}

type StockRecord = { type: string; etablissementId: string; destinationId?: string; quantite: number }
type DonRecord = { etablissementId?: string; type?: string; quantite: number }
function rows(key: string): unknown[] {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}
export function loadStockMovements(campagne = 'OB 2026'): StockRecord[] {
  return rows(stockKeyForCampaign(campagne)).filter((v): v is StockRecord => {
    if (!v || typeof v !== 'object') return false
    const r = v as Record<string, unknown>
    return typeof r.type === 'string' && typeof r.etablissementId === 'string' && typeof r.quantite === 'number' && Number.isInteger(r.quantite)
  })
}
export function loadStockDons(campagne = 'OB 2026'): DonRecord[] {
  return rows(donsKeyForCampaign(campagne)).filter((v): v is DonRecord => {
    if (!v || typeof v !== 'object') return false
    const r = v as Record<string, unknown>
    return typeof r.quantite === 'number' && Number.isInteger(r.quantite) && r.quantite >= 0 && (r.etablissementId === undefined || typeof r.etablissementId === 'string')
  })
}
export function donBrioches(etablissementId: string, dons: DonRecord[] = loadStockDons()): number {
  return dons.reduce((n, d) => n + (d.etablissementId === etablissementId && d.type !== 'sans' ? d.quantite : 0), 0)
}
export function stockFor(etablissementId: string, mouvements: StockRecord[] = loadStockMovements(), dons: DonRecord[] = loadStockDons()): number {
  const movementBalance = mouvements.reduce((n, m) => {
    if (m.type === 'transfert') return n + (m.etablissementId === etablissementId ? -m.quantite : m.destinationId === etablissementId ? m.quantite : 0)
    if (m.etablissementId !== etablissementId) return n
    return n + (m.type === 'sortie' ? -m.quantite : m.quantite)
  }, 0)
  return movementBalance - donBrioches(etablissementId, dons)
}
export function publishBriochesChange(): void {
  window.dispatchEvent(new Event(STOCK_CHANGED))
}
