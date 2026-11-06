/**
 * Sources de la synthèse : pas de double comptage entre commandes, dons déclarés,
 * fiches de caisse, factures et règlements fournisseurs.
 */
import type { CommandeArtisan } from '../types/artisans'
import { montantCommande } from '../types/artisans'
import type { FicheCaisse } from '../types/ob'
import type { FinanceRow } from './financeRegister'
import { parseEuro } from './financeRegister'
import { BILLETS, PIECES } from '../services/coffre'

const cents = (amount: number): number => Number.isFinite(amount) ? Math.round(amount * 100) : 0
const euros = (centimes: number): number => centimes / 100
const cleanAmount = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0

export type CashChannels = { especes: number; cheques: number; tpe: number; virements: number }

/** Les compteurs « Dons » d'une fiche ventilent des montants, ils ne constituent pas un cinquième moyen de paiement. */
export function cashChannels(fiche: FicheCaisse): CashChannels {
  const cashCents = BILLETS.reduce((sum, b) => sum + cleanAmount(fiche[b.key]) * b.valeurCentimes, 0) +
    PIECES.reduce((sum, p) => sum + cleanAmount(fiche[p.key]) * p.valeurCentimes, 0)
  return {
    especes: euros(Math.round(cashCents)),
    cheques: euros(cents(cleanAmount(fiche.montantCheques))),
    tpe: euros(cents(cleanAmount(fiche.montantTpe))),
    virements: euros(cents(cleanAmount(fiche.montantVirement))),
  }
}

export const sumChannels = (channels: CashChannels): number =>
  euros(cents(channels.especes) + cents(channels.cheques) + cents(channels.tpe) + cents(channels.virements))

export function sumFiches(fiches: readonly FicheCaisse[]): CashChannels {
  const result = { especes: 0, cheques: 0, tpe: 0, virements: 0 }
  for (const fiche of fiches) {
    const p = cashChannels(fiche)
    result.especes += cents(p.especes)
    result.cheques += cents(p.cheques)
    result.tpe += cents(p.tpe)
    result.virements += cents(p.virements)
  }
  return { especes: euros(result.especes), cheques: euros(result.cheques), tpe: euros(result.tpe), virements: euros(result.virements) }
}

/** Une ancienne commande stockée par année est compatible uniquement avec une campagne OB officielle. */
export function samePurchaseCampaign(value: string, campaignId: string): boolean {
  const normalized = (v: string) => v.replace(/[^a-z0-9]/gi, '').toUpperCase()
  if (normalized(value) === normalized(campaignId) && !!campaignId) return true
  const official = normalized(campaignId).match(/^OB(20\d{2})$/)
  return !!official && normalized(value) === official[1]
}

export function purchaseSummary(commandes: readonly CommandeArtisan[], campaignId: string) {
  const lignes = commandes.filter(c => samePurchaseCampaign(c.campagne, campaignId) && c.statut !== 'ANNULEE')
  return {
    lignes,
    quantite: lignes.reduce((sum, c) => sum + Math.max(0, cleanAmount(c.quantiteCommandee)), 0),
    estime: euros(lignes.reduce((sum, c) => sum + cents(montantCommande(c)), 0)),
  }
}

export type InvoiceRecord = {
  id: string
  campagne: string
  numero: string
  montantTtc: number
  categorie: string
  fournisseurNom?: string
}
export type SupplierPayment = {
  factureId: string
  montant: number
  confirme: boolean
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readArray(key: string): unknown[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

export function readDashboardInvoices(): InvoiceRecord[] {
  return readArray('ob2026-factures-paiements-v1').filter(record).filter(
    value => typeof value.id === 'string' && typeof value.campagne === 'string' &&
      typeof value.numero === 'string' && typeof value.montantTtc === 'number' && Number.isFinite(value.montantTtc),
  ).map(value => ({
    id: value.id as string,
    campagne: value.campagne as string,
    numero: value.numero as string,
    montantTtc: value.montantTtc as number,
    categorie: typeof value.categorie === 'string' ? value.categorie : 'AUTRE',
    fournisseurNom: typeof value.fournisseurNom === 'string' ? value.fournisseurNom : '',
  }))
}

export function readDashboardPayments(): SupplierPayment[] {
  return readArray('ob2026-reglements-factures-v1').filter(record).filter(
    value => typeof value.factureId === 'string' && typeof value.montant === 'number' &&
      Number.isFinite(value.montant) && value.montant > 0 && value.confirme === true,
  ).map(value => ({ factureId: value.factureId as string, montant: value.montant as number, confirme: true }))
}

export function invoiceSummary(invoices: readonly InvoiceRecord[], payments: readonly SupplierPayment[], campaignId: string) {
  const lines = invoices.filter(f => f.campagne === campaignId)
  const byId = new Map(lines.map(f => [f.id, f]))
  const amount = euros(lines.reduce((total, f) => total + cents(f.montantTtc), 0))
  const paidByInvoice = new Map<string, number>()
  for (const p of payments) {
    if (!p.confirme || !byId.has(p.factureId)) continue
    paidByInvoice.set(p.factureId, (paidByInvoice.get(p.factureId) || 0) + cents(p.montant))
  }
  // Un règlement sur une facture ne doit pas être comptabilisé sur une autre campagne.
  const paid = euros([...paidByInvoice.values()].reduce((a, b) => a + b, 0))
  const outstanding = euros(lines.reduce((sum, f) => sum + Math.max(0, cents(f.montantTtc) - (paidByInvoice.get(f.id) || 0)), 0))
  return { lines, amount, paid, outstanding, unpaidCount: lines.filter(f => cents(f.montantTtc) - (paidByInvoice.get(f.id) || 0) > 0).length }
}

export function financeSummary(mecenat: readonly FinanceRow[], ecarts: readonly FinanceRow[], campaignId: string) {
  const contributions = mecenat.filter(row => row.campagne === campaignId)
  const losses = ecarts.filter(row => row.campagne === campaignId)
  const confirmed = contributions.filter(row => ['Confirmé', 'Clôturé'].includes(row.statut || ''))
  const finance = contributions.filter(row => row.nature === 'Financier')
  const inKind = contributions.filter(row => row.nature !== 'Financier')
  const sum = (rows: readonly FinanceRow[], absolute = false) => euros(rows.reduce((n, row) => {
    const amount = parseEuro(row.valeur || '') ?? 0
    return n + cents(absolute ? Math.abs(amount) : amount)
  }, 0))
  const pendingLosses = losses.filter(row => row.statut !== 'Résolu')
  return {
    mecenatCount: contributions.length,
    confirmedCount: confirmed.length,
    pendingMecenat: contributions.filter(row => row.statut === 'À confirmer').length,
    financialDeclared: sum(finance),
    financialConfirmed: sum(confirmed.filter(row => row.nature === 'Financier')),
    inKindDeclared: sum(inKind),
    lossCount: losses.length,
    pendingLossesCount: pendingLosses.length,
    pendingLossAmount: sum(pendingLosses, true),
    resolvedLossCount: losses.filter(row => row.statut === 'Résolu').length,
  }
}

/**
 * Ventilation des dons sans remise de brioche saisis dans les fiches de caisse.
 * Ces sommes appartiennent déjà aux encaissements (espèces, chèques, TPE,
 * virements) : ne JAMAIS les additionner une deuxième fois au total caisse.
 * Les valeurs anciennes absentes ne sont pas estimées à partir du nombre de dons.
 */
export function donsSansContrepartieCaisse(
  fiches: readonly FicheCaisse[],
): { amount: number; controlledAmount: number; count: number; fichesRenseignees: number; fichesInconnues: number } {
  let amountCents = 0
  let controlledCents = 0
  let count = 0
  let fichesRenseignees = 0
  let fichesInconnues = 0
  for (const fiche of fiches) {
    const montant = Math.max(0, cleanAmount(fiche.montantDonsSansContrepartie))
    const countKnown = !fiche.donsSansContrepartieInconnu &&
      typeof fiche.nbDonsSansContrepartie === 'number' &&
      Number.isFinite(fiche.nbDonsSansContrepartie)
    const nombre = countKnown ? Math.max(0, Math.floor(fiche.nbDonsSansContrepartie ?? 0)) : 0
    const amountForFiche = cents(montant)
    amountCents += amountForFiche
    if (fiche.statutCoffre === 'CONTROLEE') controlledCents += amountForFiche
    count += nombre
    if (nombre > 0 || amountForFiche > 0 || fiche.donsSansContrepartieInconnu) fichesRenseignees += 1
    if (fiche.donsSansContrepartieInconnu) fichesInconnues += 1
  }
  return { amount: euros(amountCents), controlledAmount: euros(controlledCents), count, fichesRenseignees, fichesInconnues }
}
