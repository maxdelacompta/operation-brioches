import type { CommandeMairieRs, NouvelleCommandeMairieRs, StatutCommandeMairieRs, TypeCommandeMairieRs } from '../types/commandesMairiesRs'

export const COMMANDES_MAIRIES_RS_HEADERS = [
  'Numero', 'Campagne', 'Type', 'Secteur', 'Sous-secteur', 'Qui passe la commande',
  'Responsable de secteur', 'Brioches commandees', 'Cartons', 'Date de recuperation',
  'Information recuperation', 'Qui recupere', 'Email', 'Telephone',
  'Lieu de recuperation', 'Livraison par', 'Remarque', 'Don prevu',
  'Brioches vendues', 'Personne rapportant les dons', 'Lieu de depot des dons',
  'Don recu', 'Ecart', 'Statut',
] as const

export type CommandeMairiesRsImportRow = {
  line: number
  sourceNumero: string
  value: NouvelleCommandeMairieRs
  problems: string[]
  duplicate: boolean
}

export type CommandeMairiesRsImportInput = {
  sourceNumero: string
  value: NouvelleCommandeMairieRs
}

export function normalizeImportText(value: unknown): string {
  return String(value ?? '').trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr')
    .replace(/[^a-z0-9]/g, '')
}

export function excelValueText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  if (typeof value === 'object') {
    if ('result' in value) return excelValueText(value.result)
    if ('text' in value) return excelValueText(value.text)
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((part: unknown) =>
        part && typeof part === 'object' && 'text' in part ? excelValueText(part.text) : '',
      ).join('')
    }
  }
  return String(value).trim()
}

export function parseCommandesMairiesRsCsv(input: string): string[][] {
  const source = input.replace(/^\ufeff/, '')
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const separator = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let current: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '"') {
      if (quoted && source[index + 1] === '"') { cell += '"'; index += 1 }
      else quoted = !quoted
    } else if (character === separator && !quoted) {
      current.push(cell); cell = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      current.push(cell)
      if (current.some(value => value.trim() !== '')) rows.push(current)
      current = []; cell = ''
    } else {
      cell += character
    }
  }
  if (quoted) throw new Error('Le fichier CSV contient une cellule entre guillemets non refermée.')
  current.push(cell)
  if (current.some(value => value.trim() !== '')) rows.push(current)
  return rows
}

function numberValue(value: unknown): number | null {
  const source = excelValueText(value)
  if (!source) return null
  const cleaned = source.replace(/[\s\u00a0\u202f€]/g, '').replace(',', '.')
  const numeric = Number(cleaned)
  return Number.isFinite(numeric) ? numeric : NaN
}

function dateValue(value: unknown): string {
  if (value instanceof Date) return excelValueText(value)
  if (typeof value === 'number' && value > 20000 && value < 90000) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000).toISOString().slice(0, 10)
  }
  const source = excelValueText(value)
  if (!source) return ''
  const match = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(source)
  const formatted = match
    ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
    : /^\d{4}-\d{2}-\d{2}$/.test(source) ? source : ''
  if (!formatted) return ''
  const date = new Date(`${formatted}T12:00:00`)
  return !Number.isNaN(date.valueOf()) && `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === formatted
    ? formatted : ''
}

function commandeType(value: unknown): TypeCommandeMairieRs | null {
  const normalized = normalizeImportText(value)
  if (!normalized || normalized === 'mairie' || normalized === 'mairies') return 'MAIRIE'
  if (['rs', 'responsabledesecteur', 'responsablesecteur'].includes(normalized)) return 'RS'
  return null
}

function commandeStatus(value: unknown): StatutCommandeMairieRs | null {
  const status: Record<string, StatutCommandeMairieRs> = {
    brouillon: 'BROUILLON', commandee: 'COMMANDEE', apreparer: 'A_PREPARER',
    arecuperer: 'A_RECUPERER', briochesremises: 'BRIOCHES_REMISES',
    donsarecuperer: 'DONS_A_RECUPERER', terminee: 'TERMINEE', annulee: 'ANNULEE',
  }
  const normalized = normalizeImportText(value)
  return normalized ? status[normalized] ?? null : 'BROUILLON'
}

export function parseCommandesMairiesRsRows(
  sourceRows: unknown[][],
  campagne: string,
  existing: CommandeMairieRs[],
): CommandeMairiesRsImportRow[] {
  if (sourceRows.length < 2) throw new Error('Le fichier ne contient aucune commande.')
  const headers = sourceRows[0].map(value => normalizeImportText(excelValueText(value)))
  const index = (...aliases: string[]) => headers.findIndex(header => aliases.some(alias => normalizeImportText(alias) === header))
  const at = (row: unknown[], ...aliases: string[]) => {
    const position = index(...aliases)
    return position < 0 ? '' : row[position]
  }
  if (index('Qui passe la commande', 'Mairie / RS', 'Mairie', 'Nom', 'Nom mairie') < 0 ||
      index('Secteur') < 0 || index('Brioches commandees', 'Quantité', 'Quantite', 'Qte') < 0) {
    throw new Error('Colonnes obligatoires : « Qui passe la commande », « Secteur » et « Brioches commandées ». Utilise le modèle proposé.')
  }
  if (sourceRows.length > 5001) throw new Error('Le fichier dépasse la limite de 5 000 commandes par import.')

  const existingNumbers = new Set(existing.filter(item => item.campagne === campagne).map(item => normalizeImportText(item.numero)))
  const seen = new Set<string>()
  return sourceRows.slice(1).filter(row => row.some(value => excelValueText(value) !== '')).map((row, indexRow) => {
    const problems: string[] = []
    const sourceNumero = excelValueText(at(row, 'Numero', 'Numéro', 'N°', 'Référence', 'Reference'))
    const sourceCampagne = excelValueText(at(row, 'Campagne'))
    const selectedType = commandeType(at(row, 'Type'))
    const selectedStatus = commandeStatus(at(row, 'Statut'))
    const name = excelValueText(at(row, 'Qui passe la commande', 'Mairie / RS', 'Mairie', 'Nom', 'Nom mairie'))
    const secteur = excelValueText(at(row, 'Secteur'))
    const quantity = numberValue(at(row, 'Brioches commandees', 'Quantité', 'Quantite', 'Qte'))
    const cartones = numberValue(at(row, 'Cartons', 'Nb cartons'))
    const prevu = numberValue(at(row, 'Don prevu', 'Dons prévus', 'Montant prévu'))
    const recu = numberValue(at(row, 'Don recu', 'Dons reçus', 'Montant reçu'))
    const vendues = numberValue(at(row, 'Brioches vendues', 'Nombre brioches vendues'))
    const enteredPrice = numberValue(at(row, 'Prix unitaire', 'Prix unitaire TTC'))
    const dateRaw = at(row, 'Date de recuperation', 'Récupération', 'Date récupération')
    const date = dateValue(dateRaw)
    if (!name) problems.push('Mairie ou RS manquant')
    if (!secteur) problems.push('Secteur manquant')
    if (quantity === null || !Number.isInteger(quantity) || quantity <= 0) problems.push('Quantité invalide')
    if (cartones !== null && (!Number.isFinite(cartones) || cartones < 0)) problems.push('Cartons invalides')
    if (prevu !== null && (!Number.isFinite(prevu) || prevu < 0)) problems.push('Don prévu invalide')
    if (recu !== null && (!Number.isFinite(recu) || recu < 0)) problems.push('Don reçu invalide')
    if (vendues !== null && (!Number.isInteger(vendues) || vendues < 0)) problems.push('Brioches vendues invalides')
    if (enteredPrice !== null && (!Number.isFinite(enteredPrice) || enteredPrice < 0)) problems.push('Prix unitaire invalide')
    if (excelValueText(dateRaw) && !date) problems.push('Date de récupération invalide')
    if (!selectedType) problems.push('Type inconnu')
    if (!selectedStatus) problems.push('Statut inconnu')
    if (sourceCampagne && normalizeImportText(sourceCampagne) !== normalizeImportText(campagne)) problems.push(`Campagne différente (${sourceCampagne})`)
    const key = normalizeImportText(sourceNumero)
    const duplicate = Boolean(key && existingNumbers.has(key))
    if (key && seen.has(key)) problems.push('Numéro répété dans le fichier')
    if (key) seen.add(key)
    const quantite = Number.isFinite(quantity) && quantity !== null ? quantity : 0
    const prixUnitaire = enteredPrice !== null && Number.isFinite(enteredPrice)
      ? enteredPrice
      : prevu !== null && Number.isFinite(prevu) && quantite > 0 ? Number((prevu / quantite).toFixed(4)) : 5
    const donPrevu = prevu !== null && Number.isFinite(prevu) ? prevu : Number((quantite * prixUnitaire).toFixed(2))
    return {
      line: indexRow + 2, sourceNumero, problems, duplicate,
      value: {
        campagne, type: selectedType ?? 'MAIRIE', mairieId: null,
        secteur, sousSecteur: excelValueText(at(row, 'Sous-secteur', 'Sous secteur')),
        quiPasseCommande: name, responsableSecteur: excelValueText(at(row, 'Responsable de secteur')),
        quantite, nbCartons: cartones ?? Number((quantite / 7).toFixed(2)),
        dateRecuperation: date, recuperationLibre: excelValueText(at(row, 'Information recuperation')),
        quiRecupere: excelValueText(at(row, 'Qui recupere')), email: excelValueText(at(row, 'Email')),
        telephone: excelValueText(at(row, 'Telephone')), lieuRecuperation: excelValueText(at(row, 'Lieu de recuperation')),
        livraisonPar: excelValueText(at(row, 'Livraison par')), remarque: excelValueText(at(row, 'Remarque')),
        prixUnitaire, donPrevu,
        nombreBriochesVendues: vendues !== null && Number.isFinite(vendues) ? vendues : null,
        personneRapportantDons: excelValueText(at(row, 'Personne rapportant les dons')),
        lieuDepotDons: excelValueText(at(row, 'Lieu de depot des dons')),
        donRecu: recu !== null && Number.isFinite(recu) ? recu : null,
        statut: selectedStatus ?? 'BROUILLON',
      },
    }
  })
}
