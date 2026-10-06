import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFPage,
  type PDFFont,
} from 'pdf-lib'

import type { JustificatifDon } from '../types/justificatifs'
import {
  getCampagneJustificatifsSettings,
  getCampagneTemplatePdf,
  type CampagneJustificatifsSettings,
  type JustificatifTemplateType,
  type PdfFieldPositions,
} from './campagneJustificatifs'
import {
  findDonateurForJustificatif,
  getMissingChorusFields,
  type DonateurDocumentData,
} from './donateurReglement'

export class ChorusIncompleteError extends Error {
  missing: string[]
  donateur: DonateurDocumentData

  constructor(
    missing: string[],
    donateur: DonateurDocumentData,
  ) {
    super('Informations Chorus incomplètes.')
    this.name = 'ChorusIncompleteError'
    this.missing = missing
    this.donateur = donateur
  }
}

export class TemplateNotConfiguredError extends Error {
  constructor(type: string, campagne: string) {
    super(
      `Aucun modèle PDF ${type} n'est configuré dans la campagne ${campagne}.`,
    )
    this.name = 'TemplateNotConfiguredError'
  }
}

export class PaymentModeMissingError extends Error {
  donateur: DonateurDocumentData

  constructor(donateur: DonateurDocumentData) {
    super(
      `Le mode de règlement de ${donateur.nom} n'est pas renseigné ou reconnu.`,
    )
    this.name = 'PaymentModeMissingError'
    this.donateur = donateur
  }
}

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('fr-FR').format(date)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function getYear(campagne: string) {
  return (
    campagne.match(/(20\d{2})/)?.[1] ||
    String(new Date().getFullYear())
  )
}

function drawCentered(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color = rgb(0.08, 0.08, 0.08),
) {
  const width = font.widthOfTextAtSize(text, size)

  page.drawText(text, {
    x: x - width / 2,
    y,
    size,
    font,
    color,
  })
}

function fitText(
  font: PDFFont,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize = 7,
) {
  let size = maxSize

  while (
    size > minSize &&
    font.widthOfTextAtSize(text, size) > maxWidth
  ) {
    size -= 0.5
  }

  return size
}

function drawLeft(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  maxWidth = 240,
  maxSize = 9,
  color = rgb(0.06, 0.06, 0.06),
) {
  const size = fitText(
    font,
    text,
    maxWidth,
    maxSize,
  )

  page.drawText(text, {
    x,
    y,
    size,
    font,
    color,
  })
}

function clearArea(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
  })
}

function clearDynamicAreas(
  page: PDFPage,
  fields: PdfFieldPositions,
) {
  clearArea(
    page,
    fields.date.x - 5,
    fields.date.y - 4,
    230,
    16,
  )

  clearArea(
    page,
    fields.raisonSociale.x - 5,
    fields.ville.y - 7,
    250,
    fields.raisonSociale.y - fields.ville.y + 25,
  )

  clearArea(
    page,
    fields.email.x - 5,
    fields.email.y - 5,
    250,
    17,
  )

  clearArea(
    page,
    fields.numero.x - 120,
    fields.numero.y - 5,
    240,
    20,
  )

  clearArea(
    page,
    fields.montant.x - 130,
    fields.montant.y - 6,
    260,
    22,
  )

  clearArea(
    page,
    fields.quantitePrix.x - 150,
    fields.quantitePrix.y - 6,
    300,
    22,
  )

  // Cette zone supprime les anciennes options de règlement du modèle
  // afin de n'afficher que le mode choisi dans la BDD Donateurs.
  clearArea(
    page,
    fields.reglement.x - 5,
    Math.max(35, fields.reglement.y - 90),
    500,
    125,
  )
}

function drawPaymentBlock(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  donor: DonateurDocumentData,
  settings: CampagneJustificatifsSettings,
  x: number,
  y: number,
) {
  const line = 12
  let cursor = y

  drawLeft(
    page,
    bold,
    'Règlement :',
    x,
    cursor,
    470,
    8.6,
  )

  cursor -= line + 1

  if (donor.modeReglement === 'CHEQUE') {
    drawLeft(
      page,
      regular,
      `- par chèque, à l'ordre de ${settings.cheque.ordre},`,
      x,
      cursor,
      470,
      8.3,
    )
    return
  }

  if (donor.modeReglement === 'VIREMENT') {
    drawLeft(
      page,
      regular,
      '- par virement, coordonnées bancaires ci-dessous :',
      x,
      cursor,
      470,
      8.3,
    )

    cursor -= line
    drawLeft(
      page,
      regular,
      `IBAN : ${settings.virement.iban}`,
      x + 8,
      cursor,
      470,
      8.1,
    )

    cursor -= line
    drawLeft(
      page,
      regular,
      `BIC : ${settings.virement.bic}`,
      x + 8,
      cursor,
      470,
      8.1,
    )

    cursor -= line
    drawLeft(
      page,
      regular,
      `BANQUE : ${settings.virement.banque}`,
      x + 8,
      cursor,
      470,
      8.1,
    )

    return
  }

  if (donor.modeReglement === 'CHORUS') {
    drawLeft(
      page,
      bold,
      '- par CHORUS PRO :',
      x,
      cursor,
      470,
      8.3,
    )

    // Ces informations sont celles DU DONATEUR / CLIENT PUBLIC.
    // L'AEIM ne possède pas de compte Chorus à configurer ici.
    cursor -= line
    drawLeft(
      page,
      regular,
      `SIRET destinataire : ${donor.siret}`,
      x + 8,
      cursor,
      470,
      8.1,
    )

    cursor -= line
    drawLeft(
      page,
      regular,
      `N° d'engagement : ${donor.chorusNumeroEngagement}`,
      x + 8,
      cursor,
      470,
      8.1,
    )

    cursor -= line
    drawLeft(
      page,
      regular,
      `Code service : ${donor.chorusCodeService}`,
      x + 8,
      cursor,
      470,
      8.1,
    )
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  window.setTimeout(
    () => URL.revokeObjectURL(url),
    1500,
  )
}

export async function generateJustificatifPdf(
  item: JustificatifDon,
) {
  const type = item.type as JustificatifTemplateType
  const year = Number(getYear(item.campagne))

  const settings =
    getCampagneJustificatifsSettings(
      item.campagne,
      Number.isFinite(year) ? year : null,
    )

  const templateMeta = settings.templates[type]

  if (!templateMeta) {
    throw new TemplateNotConfiguredError(
      item.type,
      item.campagne,
    )
  }

  const templateBlob = await getCampagneTemplatePdf(
    item.campagne,
    type,
  )

  if (!templateBlob) {
    throw new TemplateNotConfiguredError(
      item.type,
      item.campagne,
    )
  }

  const donor = findDonateurForJustificatif(
    item.donateurId,
    item.donateurCode,
    item.donateurNom,
  )

  if (!donor) {
    throw new Error(
      `Le donateur « ${item.donateurNom} » est introuvable dans la BDD Donateurs.`,
    )
  }

  if (donor.modeReglement === 'INCONNU') {
    throw new PaymentModeMissingError(donor)
  }

  const missing = getMissingChorusFields(donor)

  if (missing.length > 0) {
    throw new ChorusIncompleteError(
      missing,
      donor,
    )
  }

  const templateBytes = await templateBlob.arrayBuffer()
  const pdf = await PDFDocument.load(templateBytes)
  const page = pdf.getPages()[0]

  if (!page) {
    throw new Error(
      'Le modèle PDF ne contient aucune page.',
    )
  }

  const fields = settings.fields[type]

  clearDynamicAreas(page, fields)

  const regular = await pdf.embedFont(
    StandardFonts.Helvetica,
  )

  const bold = await pdf.embedFont(
    StandardFonts.HelveticaBold,
  )

  const teal = rgb(0.10, 0.47, 0.56)
  const red = rgb(0.75, 0.05, 0.03)
  const black = rgb(0.06, 0.06, 0.06)

  const contact = [
    donor.contactNom,
    donor.contactPrenom,
  ]
    .filter(Boolean)
    .join(' ')

  const adresse = [
    donor.numeroVoie,
    donor.adresse,
  ]
    .filter(Boolean)
    .join(' ')

  const ville = [
    donor.cp,
    donor.ville,
  ]
    .filter(Boolean)
    .join(' - ')

  const yearLabel = getYear(item.campagne)

  drawLeft(
    page,
    regular,
    `Villers-lès-Nancy, le ${formatDate(item.dateEmission)}`,
    fields.date.x,
    fields.date.y,
    230,
    8.5,
    black,
  )

  drawLeft(
    page,
    bold,
    donor.nom,
    fields.raisonSociale.x,
    fields.raisonSociale.y,
    240,
    8.5,
    black,
  )

  if (contact) {
    drawLeft(
      page,
      bold,
      contact,
      fields.contact.x,
      fields.contact.y,
      240,
      8,
      black,
    )
  }

  if (adresse) {
    drawLeft(
      page,
      bold,
      adresse,
      fields.adresse.x,
      fields.adresse.y,
      240,
      8,
      black,
    )
  }

  if (ville) {
    drawLeft(
      page,
      bold,
      ville,
      fields.ville.x,
      fields.ville.y,
      240,
      8,
      black,
    )
  }

  if (donor.email) {
    drawLeft(
      page,
      regular,
      donor.email,
      fields.email.x,
      fields.email.y,
      230,
      7.5,
      black,
    )
  }

  drawCentered(
    page,
    bold,
    `N° ${item.numero.replace(`${item.type}-${yearLabel}-`, '')} / ${yearLabel}`,
    fields.numero.x,
    fields.numero.y,
    11,
    red,
  )

  drawCentered(
    page,
    bold,
    `${formatMoney(item.montant)} €`,
    fields.montant.x,
    fields.montant.y,
    11,
    red,
  )

  drawCentered(
    page,
    bold,
    `${item.nbBrioches} X ${formatMoney(item.prixUnitaire)} €`,
    fields.quantitePrix.x,
    fields.quantitePrix.y,
    10.5,
    teal,
  )

  drawPaymentBlock(
    page,
    regular,
    bold,
    donor,
    settings,
    fields.reglement.x,
    fields.reglement.y,
  )

  pdf.setTitle(
    `${item.numero} - ${item.donateurNom}`,
  )
  pdf.setSubject(
    `Justificatif de don ${item.type} - ${item.campagne}`,
  )
  pdf.setCreator('Opération Brioches')
  pdf.setProducer('Opération Brioches / pdf-lib')

  const bytes = await pdf.save()

  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer

const blob = new Blob([buffer], { type: 'application/pdf' })

  const filename = `${item.numero}_${item.donateurNom
    .replace(/[^a-z0-9_-]+/gi, '_')
    .replace(/^_+|_+$/g, '')}.pdf`

  return {
    blob,
    filename,
    donor,
    settings,
    template: templateMeta,
  }
}

export async function generateAndDownloadJustificatifPdf(
  item: JustificatifDon,
) {
  const result = await generateJustificatifPdf(item)
  downloadBlob(result.blob, result.filename)
  return result
}
