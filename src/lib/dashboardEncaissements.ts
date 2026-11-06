import type { FicheCaisse } from '../types/ob'
import { cashChannels, type CashChannels } from './dashboardMetrics'

export type PeriodGranularity = 'jour' | 'semaine' | 'mois'
export type PaymentKey = keyof CashChannels
export const PAYMENT_LABELS: Record<PaymentKey, string> = {
  especes: 'Espèces',
  cheques: 'Chèques',
  tpe: 'TPE',
  virements: 'Virements',
}

export type EncaissementPoint = CashChannels & {
  key: string
  label: string
  fullLabel: string
  declared: number
  controlled: number
  pending: number
  ficheCount: number
  controlledCount: number
}

type CentsPoint = Omit<EncaissementPoint, 'especes' | 'cheques' | 'tpe' | 'virements' | 'declared' | 'controlled' | 'pending'> & {
  especes: number
  cheques: number
  tpe: number
  virements: number
  declared: number
  controlled: number
  pending: number
}

const euroCent = (n: number) => Number.isFinite(n) ? Math.round(n * 100) : 0
const euro = (cent: number) => cent / 100

/** Strict ISO date. Undated / malformed fiches must not appear in date-bucket charts. */
export function isIsoDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const [y, m, d] = date.split('-').map(Number)
  const value = new Date(Date.UTC(y, m - 1, d))
  return value.getUTCFullYear() === y && value.getUTCMonth() + 1 === m && value.getUTCDate() === d
}

function weekKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date.toISOString().slice(0, 10)
}

function labelOf(key: string, granularity: PeriodGranularity): { label: string; fullLabel: string } {
  if (granularity === 'mois') {
    const [y, m] = key.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, 1))
    return {
      label: date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      fullLabel: date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    }
  }
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const short = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return granularity === 'semaine'
    ? { label: `S. ${short}`, fullLabel: `Semaine du ${date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}` }
    : { label: short, fullLabel: date.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' }) }
}

export function groupEncaissements(
  fiches: readonly FicheCaisse[],
  granularity: PeriodGranularity,
  from = '',
  to = '',
): EncaissementPoint[] {
  const groups = new Map<string, CentsPoint>()
  for (const fiche of fiches) {
    const day = fiche.date
    if (!isIsoDay(day) || (from && day < from) || (to && day > to)) continue
    const key = granularity === 'jour' ? day : granularity === 'semaine' ? weekKey(day) : day.slice(0, 7)
    let point = groups.get(key)
    if (!point) {
      const { label, fullLabel } = labelOf(key, granularity)
      point = { key, label, fullLabel, especes: 0, cheques: 0, tpe: 0, virements: 0, declared: 0, controlled: 0, pending: 0, ficheCount: 0, controlledCount: 0 }
      groups.set(key, point)
    }
    const amounts = cashChannels(fiche)
    const cents = {
      especes: euroCent(amounts.especes), cheques: euroCent(amounts.cheques),
      tpe: euroCent(amounts.tpe), virements: euroCent(amounts.virements),
    }
    const total = cents.especes + cents.cheques + cents.tpe + cents.virements
    point.especes += cents.especes
    point.cheques += cents.cheques
    point.tpe += cents.tpe
    point.virements += cents.virements
    point.declared += total
    point.ficheCount += 1
    if (fiche.statutCoffre === 'CONTROLEE') {
      point.controlled += total
      point.controlledCount += 1
    } else {
      point.pending += total
    }
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(item => ({
    ...item,
    especes: euro(item.especes), cheques: euro(item.cheques), tpe: euro(item.tpe), virements: euro(item.virements),
    declared: euro(item.declared), controlled: euro(item.controlled), pending: euro(item.pending),
  }))
}

export function summarizeEncaissements(rows: readonly EncaissementPoint[]) {
  const total = (field: 'declared' | 'controlled' | 'pending' | 'especes' | 'cheques' | 'tpe' | 'virements') =>
    euro(rows.reduce((sum, row) => sum + euroCent(row[field]), 0))
  return {
    declared: total('declared'), controlled: total('controlled'), pending: total('pending'),
    especes: total('especes'), cheques: total('cheques'), tpe: total('tpe'), virements: total('virements'),
    ficheCount: rows.reduce((sum, row) => sum + row.ficheCount, 0),
    controlledCount: rows.reduce((sum, row) => sum + row.controlledCount, 0),
  }
}

export function exportEncaissementsCsv(rows: readonly EncaissementPoint[]): string {
  const safe = (value: string | number) => {
    const raw = String(value)
    const escaped = typeof value === 'string' && /^[=+@-]/.test(raw) ? `'${raw}` : raw
    return `"${escaped.replace(/"/g, '""')}"`
  }
  const data = [
    ['Période', 'Nombre de fiches', 'Fiches contrôlées', 'Espèces (€)', 'Chèques (€)', 'TPE (€)', 'Virements (€)', 'Déclaré (€)', 'Contrôlé (€)', 'À contrôler (€)'],
    ...rows.map(row => [row.fullLabel, row.ficheCount, row.controlledCount, row.especes, row.cheques, row.tpe, row.virements, row.declared, row.controlled, row.pending]),
  ]
  return '\ufeff' + data.map(row => row.map(safe).join(';')).join('\r\n')
}
