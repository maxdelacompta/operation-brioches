import type { FicheCaisse, TypeFicheCaisse } from '../types/ob'

// A deliberate explicit column mapping: imported amounts are not inferred from the
// number of donations (they are already included in the payment-method amounts).
export const COLONNES_IMPORT_FICHES = [
  'numero', 'date', 'type', 'libelle', 'ville', 'cp', 'secteur',
  'billets100', 'billets50', 'billets20', 'billets10', 'billets5',
  'pieces2', 'pieces1', 'pieces050', 'pieces020', 'pieces010',
  'pieces005', 'pieces002', 'pieces001',
  'nbCheques', 'montantCheques', 'nbTpe', 'montantTpe',
  'montantVirement', 'nbDons5', 'nbDons3', 'montantDonsAutres',
  'nbBriochesDonnees', 'nbDonsSansContrepartie',
  'donsSansContrepartieInconnu', 'montantDonsSansContrepartie',
  'enveloppeRetourSiege', 'remarque', 'campagne',
] as const

type Champ = (typeof COLONNES_IMPORT_FICHES)[number]
type Ligne = Record<string, string>

const NB_CHAMPS: readonly Champ[] = [
  'billets100', 'billets50', 'billets20', 'billets10', 'billets5',
  'pieces2', 'pieces1', 'pieces050', 'pieces020', 'pieces010',
  'pieces005', 'pieces002', 'pieces001', 'nbCheques',
  'montantCheques', 'nbTpe', 'montantTpe', 'montantVirement',
  'nbDons5', 'nbDons3', 'montantDonsAutres', 'nbBriochesDonnees',
  'nbDonsSansContrepartie', 'montantDonsSansContrepartie',
]
const ENTIER: readonly Champ[] = [
  'billets100', 'billets50', 'billets20', 'billets10', 'billets5',
  'pieces2', 'pieces1', 'pieces050', 'pieces020', 'pieces010',
  'pieces005', 'pieces002', 'pieces001', 'nbCheques', 'nbTpe',
  'nbDons5', 'nbDons3', 'nbBriochesDonnees', 'nbDonsSansContrepartie',
]
const normaliser = (value: string) => value.toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
const enTete = new Map(COLONNES_IMPORT_FICHES.map(c => [normaliser(c), c]))
function euroOuNombre(value: string): number | null {
  const trimmed = value.replace(/[\s\u00a0€]/g, '').trim()
  if (!trimmed) return 0
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.') : trimmed
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null
  const result = Number(normalized)
  return Number.isFinite(result) && result >= 0 ? result : null
}
const vrai = (v: string) => ['1', 'oui', 'true', 'vrai', 'x'].includes(v.trim().toLowerCase())
function dateISO(value: string): string | null {
  const date = value.trim()
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date)
  const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(`${iso}T12:00:00Z`)
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso ? null : iso
}
function typeFiche(value: string): TypeFicheCaisse | null {
  const v = normaliser(value)
  if (v === 'entreprise') return 'ENTREPRISE'
  if (v === 'mairie' || v === 'mairiers' || v === 'rs') return 'MAIRIE'
  if (v === 'etablissement') return 'ETABLISSEMENT'
  if (v === 'stand') return 'STAND'
  if (v === 'autre') return 'AUTRE'
  return null
}

/** CSV RFC-style quoted fields, escaped quotes and CRLF. */
export function lireCSV(source: string): string[][] {
  const text = source.replace(/^\ufeff/, '')
  const first = text.split(/\r?\n/, 1)[0] || ''
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ','
  const rows: string[][] = []
  let row: string[] = [], field = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (c === sep && !quoted) { row.push(field); field = '' }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some(x => x.trim())) rows.push(row)
      row = []
    } else field += c
  }
  if (quoted) throw new Error('Le fichier CSV contient un champ entre guillemets non terminé.')
  row.push(field)
  if (row.some(x => x.trim())) rows.push(row)
  return rows
}

export type FichePreteImport = FicheCaisse & {
  sourceImport: 'CSV_XLSX'
  nbBriochesDonnees?: number
  nbDonsSansContrepartie?: number
  donsSansContrepartieInconnu?: boolean
  montantDonsSansContrepartie?: number
  enveloppeRetourSiege?: boolean
}
export type AnalyseImport = {
  fiches: FichePreteImport[]
  erreurs: string[]
  ignores: number
}
export function analyserFichesImport(
  rows: string[][],
  campagne: string,
  existantes: FicheCaisse[],
): AnalyseImport {
  if (!campagne) return { fiches: [], erreurs: ['Sélectionner une campagne.'], ignores: 0 }
  if (rows.length < 2) return { fiches: [], erreurs: ['Le fichier ne comporte aucune ligne de données.'], ignores: 0 }
  const colonnes = rows[0].map(v => enTete.get(normaliser(v)))
  const required: Champ[] = ['date', 'type', 'libelle']
  const manquantes = required.filter(c => !colonnes.includes(c))
  if (manquantes.length) return { fiches: [], erreurs: [`Colonnes obligatoires manquantes : ${manquantes.join(', ')}`], ignores: 0 }
  const fiches: FichePreteImport[] = []
  const erreurs: string[] = []
  let ignores = 0
  const numeros = new Set(existantes.map(f => `${f.campagne}|${f.numero.trim().toLowerCase()}`))
  let next = Math.max(0, ...existantes.map(f => f.id)) + 1
  for (const [i, cells] of rows.slice(1).entries()) {
    if (cells.every(c => !String(c ?? '').trim())) { ignores++; continue }
    const line: Ligne = {}
    for (let k = 0; k < colonnes.length; k++) {
      const col = colonnes[k]
      if (col) line[col] = String(cells[k] ?? '').trim()
    }
    const ligne = i + 2
    const fail = (reason: string) => erreurs.push(`Ligne ${ligne} : ${reason}`)
    if (line.campagne && normaliser(line.campagne) !== normaliser(campagne)) {
      fail(`campagne « ${line.campagne} » différente de « ${campagne} »`); continue
    }
    const date = dateISO(line.date || '')
    const type = typeFiche(line.type || '')
    if (!date) { fail('date invalide (AAAA-MM-JJ ou JJ/MM/AAAA)'); continue }
    if (!type) { fail('type invalide (Entreprise, Mairie/RS, Établissement, Stand ou Autre)'); continue }
    if (!line.libelle?.trim()) { fail('structure / nom obligatoire'); continue }
    const numeric: Record<string, number> = {}
    let bad = false
    for (const field of NB_CHAMPS) {
      const value = euroOuNombre(line[field] || '')
      if (value === null || (ENTIER.includes(field) && !Number.isInteger(value))) {
        fail(`valeur numérique incorrecte dans « ${field} »`); bad = true; break
      }
      numeric[field] = value
    }
    if (bad) continue
    const numero = (line.numero || `FC-IMP-${campagne.replace(/\W/g, '')}-${String(next).padStart(4, '0')}`).trim()
    const key = `${campagne}|${numero.toLowerCase()}`
    if (numeros.has(key)) { fail(`doublon n° ${numero}`); continue }
    numeros.add(key)
    const inconnu = vrai(line.donsSansContrepartieInconnu || '')
    fiches.push({
      id: next++, numero, campagne, date, type, libelle: line.libelle,
      ville: line.ville || '', cp: line.cp || '', secteur: line.secteur || '',
      billets100: numeric.billets100, billets50: numeric.billets50,
      billets20: numeric.billets20, billets10: numeric.billets10, billets5: numeric.billets5,
      pieces2: numeric.pieces2, pieces1: numeric.pieces1, pieces050: numeric.pieces050,
      pieces020: numeric.pieces020, pieces010: numeric.pieces010,
      pieces005: numeric.pieces005, pieces002: numeric.pieces002, pieces001: numeric.pieces001,
      nbCheques: numeric.nbCheques, montantCheques: numeric.montantCheques,
      nbTpe: numeric.nbTpe, montantTpe: numeric.montantTpe,
      montantVirement: numeric.montantVirement,
      nbDons5: numeric.nbDons5, nbDons3: numeric.nbDons3,
      montantDonsAutres: numeric.montantDonsAutres,
      nbBriochesDonnees: numeric.nbBriochesDonnees,
      nbDonsSansContrepartie: inconnu ? undefined : numeric.nbDonsSansContrepartie,
      donsSansContrepartieInconnu: inconnu,
      montantDonsSansContrepartie: numeric.montantDonsSansContrepartie,
      enveloppeRetourSiege: vrai(line.enveloppeRetourSiege || ''),
      remarque: line.remarque || '', sourceImport: 'CSV_XLSX', statutCoffre: 'CONTROLEE',
    })
  }
  return { fiches, erreurs, ignores }
}

export function modeleFichesCSV(campagne: string): string {
  const example: Record<string, string> = {
    campagne,
  }
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`
  return '\ufeff' + [
    COLONNES_IMPORT_FICHES.map(cell).join(';'),
    COLONNES_IMPORT_FICHES.map(c => cell(example[c] || '')).join(';'),
  ].join('\r\n')
}
