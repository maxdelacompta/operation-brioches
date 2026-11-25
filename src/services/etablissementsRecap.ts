/**
 * Consolidation du récapitulatif Établissements – Opération Brioche.
 * Un don direct n'est jamais un règlement de commande.
 * Les remises de commande alimentent le stock central ; on ne les retire jamais une deuxième fois.
 * Les flux suivent la période demandée. Les soldes (stock, reste dû, restant à remettre)
 * représentent toujours l'état actuel de la campagne entière.
 */
import { stockFor } from '../lib/briochesStock'
import {
  type CommandeEtablissement,
  resteAregler,
  resteAremettre,
} from './etablissementsCommandesStore'
import type { EtablissementAEIM } from '../types/etablissements'

export type RecapDon = {
  id: string
  date: string
  donateur: string
  montant: number
  quantite: number
  mode: string
  etablissementId?: string
  type?: 'avec' | 'sans'
}

export type RecapMouvement = {
  id?: string
  date?: string
  type: string
  etablissementId: string
  destinationId?: string
  quantite: number
}

export type RecapLigne = {
  id: string
  nom: string
  actif: boolean
  attribue: boolean
  stock: number | null
  receptions: number
  donsNombre: number
  donsBrioches: number
  donsCentimes: number
  commandesNombre: number
  remisesCommandes: number
  reglementsCommandesCentimes: number
  commandesReglees: number
  commandesTerminees: number
  commandesARegler: number
  commandesARemettre: number
  briochesARemettre: number
  resteCentimes: number
  remisesTotal: number
  totalEncaisseCentimes: number
}

export type RecapConsolide = {
  lignes: RecapLigne[]
  total: RecapLigne
  nonAttribues: RecapLigne | null
}

const euroEnCentimes = (amount: number) => Math.round(amount * 100)
const dansPeriode = (date: string | undefined, debut: string, fin: string) => {
  if (!date) return false
  const jour = date.slice(0, 10)
  return (!debut || jour >= debut) && (!fin || jour <= fin)
}

function synthese(
  id: string,
  nom: string,
  actif: boolean,
  attribue: boolean,
  mouvements: readonly RecapMouvement[],
  dons: readonly RecapDon[],
  commandes: readonly CommandeEtablissement[],
  debut: string,
  fin: string,
): RecapLigne {
  const donsPeriode = dons.filter(d => dansPeriode(d.date, debut, fin))
  const donsBrioches = donsPeriode.reduce((n, d) => n + (d.type === 'sans' ? 0 : d.quantite), 0)
  const donsCentimes = donsPeriode.reduce((n, d) => n + euroEnCentimes(d.montant), 0)
  const remisesCommandes = commandes.reduce((n, c) => n + c.remises.filter(r => dansPeriode(r.date, debut, fin)).reduce((total, r) => total + r.quantite, 0), 0)
  const reglementsCommandesCentimes = commandes.reduce((n, c) => n + c.reglements.filter(r => dansPeriode(r.date, debut, fin)).reduce((total, r) => total + r.centimes, 0), 0)
  const mouvementsPeriode = mouvements.filter(m => dansPeriode(m.date, debut, fin))
  const receptions = mouvementsPeriode.filter(m => m.type === 'reception').reduce((n, m) => n + m.quantite, 0)
  const briochesARemettre = commandes.reduce((n, c) => n + resteAremettre(c), 0)
  const resteCentimes = commandes.reduce((n, c) => n + resteAregler(c), 0)
  return {
    id, nom, actif, attribue,
    stock: attribue ? stockFor(id, [...mouvements], [...dons]) : null,
    receptions, donsNombre: donsPeriode.length, donsBrioches, donsCentimes,
    commandesNombre: commandes.length,
    remisesCommandes, reglementsCommandesCentimes,
    commandesReglees: commandes.filter(c => resteAregler(c) === 0).length,
    commandesTerminees: commandes.filter(c => resteAregler(c) === 0 && resteAremettre(c) === 0).length,
    commandesARegler: commandes.filter(c => resteAregler(c) > 0).length,
    commandesARemettre: commandes.filter(c => resteAremettre(c) > 0).length,
    briochesARemettre, resteCentimes,
    remisesTotal: donsBrioches + remisesCommandes,
    totalEncaisseCentimes: donsCentimes + reglementsCommandesCentimes,
  }
}

export function consoliderEtablissements(
  etablissements: readonly EtablissementAEIM[],
  mouvements: readonly RecapMouvement[],
  dons: readonly RecapDon[],
  commandes: readonly CommandeEtablissement[],
  debut = '',
  fin = '',
): RecapConsolide {
  const ids = new Set(etablissements.map(e => e.id))
  const lignes = etablissements.map(e => synthese(
    e.id, e.nom, e.statut === 'ACTIF', true,
    mouvements.filter(m => m.etablissementId === e.id || m.destinationId === e.id),
    dons.filter(d => d.etablissementId === e.id),
    commandes.filter(c => c.etablissementId === e.id),
    debut, fin,
  ))
  const donsNonAttribues = dons.filter(d => !d.etablissementId || !ids.has(d.etablissementId))
  const commandesNonAttribuees = commandes.filter(c => !ids.has(c.etablissementId))
  const nonAttribues = donsNonAttribues.length || commandesNonAttribuees.length
    ? synthese('__non_attribue__', 'Non attribués', false, false, [], donsNonAttribues, commandesNonAttribuees, debut, fin)
    : null
  const base = nonAttribues ? [...lignes, nonAttribues] : lignes
  const total = base.reduce<RecapLigne>((out, r) => ({
    ...out,
    stock: (out.stock ?? 0) + (r.stock ?? 0),
    receptions: out.receptions + r.receptions,
    donsNombre: out.donsNombre + r.donsNombre,
    donsBrioches: out.donsBrioches + r.donsBrioches,
    donsCentimes: out.donsCentimes + r.donsCentimes,
    commandesNombre: out.commandesNombre + r.commandesNombre,
    remisesCommandes: out.remisesCommandes + r.remisesCommandes,
    reglementsCommandesCentimes: out.reglementsCommandesCentimes + r.reglementsCommandesCentimes,
    commandesReglees: out.commandesReglees + r.commandesReglees,
    commandesTerminees: out.commandesTerminees + r.commandesTerminees,
    commandesARegler: out.commandesARegler + r.commandesARegler,
    commandesARemettre: out.commandesARemettre + r.commandesARemettre,
    briochesARemettre: out.briochesARemettre + r.briochesARemettre,
    resteCentimes: out.resteCentimes + r.resteCentimes,
    remisesTotal: out.remisesTotal + r.remisesTotal,
    totalEncaisseCentimes: out.totalEncaisseCentimes + r.totalEncaisseCentimes,
  }), {
    id: '__total__', nom: 'TOTAL GLOBAL', actif: false, attribue: true,
    stock: 0, receptions: 0, donsNombre: 0, donsBrioches: 0, donsCentimes: 0,
    commandesNombre: 0, remisesCommandes: 0, reglementsCommandesCentimes: 0,
    commandesReglees: 0, commandesTerminees: 0, commandesARegler: 0, commandesARemettre: 0,
    briochesARemettre: 0, resteCentimes: 0, remisesTotal: 0, totalEncaisseCentimes: 0,
  })
  return { lignes, total, nonAttribues }
}
