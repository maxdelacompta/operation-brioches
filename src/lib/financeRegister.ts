/** Registres déclaratifs du mécénat et des écarts, conservés par campagne.
 * Les clés existantes sont conservées : aucune donnée historique n'est supprimée.
 */
export type FinanceKind = 'mecenat' | 'ecarts'

export type FinanceRow = {
  id: string
  campagne: string
  date: string
  partenaire?: string
  donateurId?: string
  nature?: string
  description?: string
  valeur?: string
  etablissement?: string
  reference?: string
  statut?: string
  origine?: string
  motif?: string
  quantite?: string
  createdAt?: string
  updatedAt?: string
}

export const FINANCE_STORAGE_KEYS: Record<FinanceKind, string> = {
  mecenat: 'ob-mecenat-table-v1',
  ecarts: 'ob-pertes-ecarts-table-v1',
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export function readFinanceRows(kind: FinanceKind): FinanceRow[] {
  try {
    const raw = localStorage.getItem(FINANCE_STORAGE_KEYS[kind])
    const parsed: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isObject).filter(v => typeof v.id === 'string').map(v => {
      // Les anciens registres ne portaient pas de campagne. Ne pas leur
      // attribuer une année arbitrairement : l'admin pourra les rattacher.
      const row: Record<string, string> = {}
      for (const [key, value] of Object.entries(v)) {
        if (typeof value === 'string' || typeof value === 'number') row[key] = String(value)
      }
      return { ...row, id: String(v.id), campagne: typeof v.campagne === 'string' ? v.campagne : '', date: row.date || '' } as FinanceRow
    })
  } catch {
    return []
  }
}

export function persistFinanceRows(kind: FinanceKind, rows: FinanceRow[]): void {
  localStorage.setItem(FINANCE_STORAGE_KEYS[kind], JSON.stringify(rows))
}

/** Accepte les écritures françaises comme 1 234,56 et les nombres signés. */
export function parseEuro(value: string): number | null {
  const normal = value.replace(/[\u00a0\u202f\s]/g, '').replace(',', '.')
  if (!normal || !/^[+-]?(?:\d+)(?:\.\d{1,2})?$/.test(normal)) return null
  const number = Number(normal)
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null
}

export function totalEuro(rows: FinanceRow[], absolute = false): number {
  const cents = rows.reduce((sum, row) => {
    const value = parseEuro(row.valeur || '') ?? 0
    return sum + Math.round((absolute ? Math.abs(value) : value) * 100)
  }, 0)
  return cents / 100
}

export function financeCsv(rows: FinanceRow[], keys: Array<keyof FinanceRow>, headings: string[]): string {
  const cell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const data = [headings, ...rows.map(row => keys.map(key => row[key] || ''))]
  return '\uFEFF' + data.map(line => line.map(cell).join(';')).join('\r\n')
}

export function createFinanceId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `finance-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
