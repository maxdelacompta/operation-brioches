/** Stock partagé entre Stock Brioches et Suivi Brioches (prototype local). */
export const STOCK_KEY = 'ob2026-stock-brioches-demo-v1'
export const DONS_KEY = 'ob2026-demo-dons-contrepartie-v1'
export const STOCK_CHANGED = 'ob2026:brioches-changed'

type StockRecord = { type: string; etablissementId: string; destinationId?: string; quantite: number }
type DonRecord = { etablissementId?: string; type?: string; quantite: number }
function rows(key: string): unknown[] {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(parsed) ? parsed : [] } catch { return [] }
}
export function loadStockMovements(): StockRecord[] {
  return rows(STOCK_KEY).filter((v): v is StockRecord => {
    if (!v || typeof v !== 'object') return false
    const r = v as Record<string, unknown>
    return typeof r.type === 'string' && typeof r.etablissementId === 'string' && typeof r.quantite === 'number' && Number.isInteger(r.quantite)
  })
}
export function loadStockDons(): DonRecord[] {
  return rows(DONS_KEY).filter((v): v is DonRecord => {
    if (!v || typeof v !== 'object') return false
    const r = v as Record<string, unknown>
    return typeof r.quantite === 'number' && Number.isInteger(r.quantite) && r.quantite >= 0 && (r.etablissementId === undefined || typeof r.etablissementId === 'string')
  })
}
export function donBrioches(etablissementId: string, dons = loadStockDons()): number {
  return dons.reduce((n, d) => n + (d.etablissementId === etablissementId && d.type !== 'sans' ? d.quantite : 0), 0)
}
export function stockFor(etablissementId: string, mouvements = loadStockMovements(), dons = loadStockDons()): number {
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
