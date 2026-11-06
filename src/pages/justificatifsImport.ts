import type { JustificatifDon, JustificatifType, PaiementStatut } from '../types/justificatifs'
import { lireCSV } from './ficheCaisseImport'

/** Import des métadonnées : aucun PDF ni état d'envoi n'est importé implicitement. */
export type JustificatifAImporter = Pick<
  JustificatifDon,
  'numero' | 'type' | 'campagne' | 'donateurNom' | 'dateEmission' | 'nbBrioches' | 'prixUnitaire'
> & Pick<JustificatifDon, 'paiementStatut'> & Partial<Pick<
  JustificatifDon,
  'donateurCode' | 'donateurVille' | 'donateurEmail' | 'donateurTelephone' |
  'donateurAdresse' | 'commandeNumero' | 'datePaiement' | 'referencePaiement' | 'remarque'
>>

export type AnalyseJustificatifsImport = {
  documents: JustificatifAImporter[]
  erreurs: string[]
  ignores: number
}

export { lireCSV }

const colonnes = [
  'numero', 'type', 'campagne', 'donateurNom', 'donateurCode', 'donateurVille',
  'donateurEmail', 'donateurTelephone', 'donateurAdresse', 'commandeNumero',
  'dateEmission', 'nbBrioches', 'prixUnitaire', 'montant', 'paiementStatut',
  'datePaiement', 'referencePaiement', 'remarque',
] as const

type Colonne = typeof colonnes[number]
const normaliser = (texte: string) => texte.toLocaleLowerCase('fr').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
const alias: Record<string, Colonne> = {}
for (const colonne of colonnes) alias[normaliser(colonne)] = colonne
for (const [titre, colonne] of Object.entries({
  'N° justificatif': 'numero', 'N° JD': 'numero', 'Nº JD': 'numero',
  'Numéro': 'numero', 'N°': 'numero',
  'Donateur': 'donateurNom', 'Nom donateur': 'donateurNom',
  'Code donateur': 'donateurCode', 'Ville': 'donateurVille',
  'E-mail': 'donateurEmail', 'Email': 'donateurEmail',
  'Commande': 'commandeNumero', 'N° commande': 'commandeNumero',
  'Date émission': 'dateEmission', 'Date d’émission': 'dateEmission', 'Date': 'dateEmission',
  'Nb brioches': 'nbBrioches', 'Quantité': 'nbBrioches', 'Prix unitaire': 'prixUnitaire',
  'Paiement': 'paiementStatut', 'Date paiement': 'datePaiement',
  'Référence paiement': 'referencePaiement',
} as Record<string, Colonne>)) alias[normaliser(titre)] = colonne

function valeurMontant(brut: string): number | null {
  const original = brut.trim().replace(/[\s\u00a0\u202f€]/g, '')
  if (!original) return null
  let valeur = original
  if (valeur.includes(',')) valeur = valeur.replace(/\./g, '').replace(',', '.')
  if (!/^\d+(?:\.\d+)?$/.test(valeur)) return null
  const nombre = Number(valeur)
  return Number.isFinite(nombre) && nombre >= 0 ? nombre : null
}

function dateISO(texte: string): string | null {
  const value = texte.trim()
  const francaise = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  const iso = francaise
    ? `${francaise[3]}-${francaise[2].padStart(2, '0')}-${francaise[1].padStart(2, '0')}`
    : value
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const date = new Date(iso + 'T12:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null
}

function typeJustificatif(brut: string): JustificatifType | null {
  const value = normaliser(brut)
  if (value === 'jdi') return 'JDI'
  if (value === 'jdp') return 'JDP'
  return null
}

function statutPaiement(brut: string): PaiementStatut | null {
  if (!brut.trim()) return 'EN_ATTENTE'
  const value = normaliser(brut)
  if (value === 'enattente' || value === 'attente') return 'EN_ATTENTE'
  if (value === 'paye' || value === 'regle' || value === 'payee') return 'PAYE'
  if (value === 'nonapplicable' || value === 'sansobjet') return 'NON_APPLICABLE'
  return null
}

const cleNumero = (campagne: string, numero: string) => `${normaliser(campagne)}|${normaliser(numero)}`
const annee = (id: string) => id.match(/(?:19|20)\d{2}/)?.[0] ?? ''

/** Compare OB2025, OB 2025 ou l'identifiant strictement identique, jamais deux années différentes. */
function memeCampagne(valeur: string, selection: string): boolean {
  if (normaliser(valeur) === normaliser(selection)) return true
  const a = annee(valeur), b = annee(selection)
  return Boolean(a && b && a === b && /^ob(?:19|20)\d{2}$/.test(normaliser(valeur)) && /^ob(?:19|20)\d{2}$/.test(normaliser(selection)))
}

export function analyserImportJustificatifs(
  lignes: string[][],
  campagneSelectionnee: string,
  existants: JustificatifDon[],
): AnalyseJustificatifsImport {
  if (!campagneSelectionnee) return { documents: [], erreurs: ['Sélectionne une campagne dans la Topbar.'], ignores: 0 }
  if (lignes.length < 2) return { documents: [], erreurs: ['Le fichier ne contient aucune donnée.'], ignores: 0 }

  const entetes = lignes[0].map(titre => alias[normaliser(titre)] ?? null)
  const obligatoires: Colonne[] = ['type', 'donateurNom', 'dateEmission', 'nbBrioches', 'prixUnitaire']
  const manquantes = obligatoires.filter(col => !entetes.includes(col))
  if (manquantes.length) return { documents: [], erreurs: [`Colonnes obligatoires manquantes : ${manquantes.join(', ')}`], ignores: 0 }

  const documents: JustificatifAImporter[] = []
  const erreurs: string[] = []
  let ignores = 0
  const numeros = new Set(existants.map(j => cleNumero(j.campagne, j.numero)))
  const compteurs = new Map<string, number>()
  for (const j of existants) {
    const correspond = new RegExp(`^${j.type}-(\\d{4})-(\\d+)$`).exec(j.numero)
    if (!correspond) continue
    const cle = `${j.type}-${correspond[1]}`
    compteurs.set(cle, Math.max(compteurs.get(cle) ?? 0, Number(correspond[2])))
  }

  for (const [index, cases] of lignes.slice(1).entries()) {
    const ligneNo = index + 2
    if (!cases.some(cell => String(cell ?? '').trim())) { ignores++; continue }
    const champs: Record<string, string> = {}
    entetes.forEach((col, pos) => { if (col) champs[col] = String(cases[pos] ?? '').trim() })
    const erreur = (message: string) => erreurs.push(`Ligne ${ligneNo} : ${message}`)

    if (champs.campagne && !memeCampagne(champs.campagne, campagneSelectionnee)) {
      erreur(`campagne ${champs.campagne} différente de ${campagneSelectionnee}`); continue
    }
    const type = typeJustificatif(champs.type || '')
    const dateEmission = dateISO(champs.dateEmission || '')
    const nbBrioches = valeurMontant(champs.nbBrioches || '')
    const prixUnitaire = valeurMontant(champs.prixUnitaire || '')
    // Un JDP atteste par définition un don payé : inutile de renseigner
    // séparément « Payé » dans le fichier importé, même s'il est vide.
    const paiementStatut = type === 'JDP' ? 'PAYE' : statutPaiement(champs.paiementStatut || '')
    if (!type) { erreur('type invalide : JDI ou JDP attendu'); continue }
    if (!champs.donateurNom) { erreur('nom du donateur obligatoire'); continue }
    if (!dateEmission) { erreur('date invalide : AAAA-MM-JJ ou JJ/MM/AAAA'); continue }
    if (nbBrioches === null || !Number.isInteger(nbBrioches)) { erreur('quantité entière positive obligatoire'); continue }
    if (prixUnitaire === null) { erreur('prix unitaire positif obligatoire'); continue }
    if (!paiementStatut) { erreur('statut de paiement non reconnu'); continue }
    const total = Math.round(nbBrioches * prixUnitaire * 100) / 100
    if (champs.montant) {
      const attendu = valeurMontant(champs.montant)
      if (attendu === null || Math.abs(attendu - total) > 0.01) {
        erreur(`montant incohérent avec ${nbBrioches} brioches × ${prixUnitaire} €`); continue
      }
    }
    const datePaiement = champs.datePaiement ? dateISO(champs.datePaiement) : undefined
    if (champs.datePaiement && !datePaiement) { erreur('date de paiement incorrecte'); continue }
    let numero = (champs.numero || '').trim()
    if (!numero) {
      const cle = `${type}-${annee(campagneSelectionnee) || dateEmission.slice(0, 4)}`
      let indexSuivant = compteurs.get(cle) ?? 0
      do { indexSuivant++ ; numero = `${cle}-${String(indexSuivant).padStart(3, '0')}` }
      while (numeros.has(cleNumero(campagneSelectionnee, numero)))
      compteurs.set(cle, indexSuivant)
    }
    const cle = cleNumero(campagneSelectionnee, numero)
    if (numeros.has(cle)) { erreur(`numéro déjà enregistré ou présent dans le fichier : ${numero}`); continue }
    numeros.add(cle)
    documents.push({
      numero, type, campagne: campagneSelectionnee,
      donateurNom: champs.donateurNom.trim(),
      dateEmission, nbBrioches, prixUnitaire, paiementStatut,
      donateurCode: champs.donateurCode || undefined,
      donateurVille: champs.donateurVille || undefined,
      donateurEmail: champs.donateurEmail || undefined,
      donateurTelephone: champs.donateurTelephone || undefined,
      donateurAdresse: champs.donateurAdresse || undefined,
      commandeNumero: champs.commandeNumero || undefined,
      datePaiement,
      referencePaiement: champs.referencePaiement || undefined,
      remarque: champs.remarque || undefined,
    })
  }
  return { documents, erreurs, ignores }
}

export function modeleImportJustificatifs(campagne: string): string {
  const champs = colonnes.map(col => col === 'campagne' ? campagne : '')
  const cellules = (ligne: readonly string[]) => ligne.map(value => `"${value.replace(/"/g, '""')}"`).join(';')
  return '\uFEFF' + cellules(colonnes) + '\r\n' + cellules(champs) + '\r\n'
}
