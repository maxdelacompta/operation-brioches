import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PDFDocument, rgb } from 'pdf-lib'
import { readSchoolTemplate } from './ecolesTemplate'
import type { School, SchoolClass, SchoolOrder, SchoolFlyerSettings } from './ecolesStore'

type Context = { campaignName: string; campaignId: string; price: number; flyer?: SchoolFlyerSettings }
const euro = (amount: number) => `${amount.toFixed(2).replace('.', ',')} €`
const TEAL: [number, number, number] = [12, 96, 101]
const DARK: [number, number, number] = [14, 53, 88]
const PINK: [number, number, number] = [183, 42, 123]
const LIGHT: [number, number, number] = [245, 249, 248]
const INK: [number, number, number] = [35, 56, 69]

function save(pdf: jsPDF, filename: string) { pdf.save(filename.replace(/[^\w.-]+/g, '_')) }
function text(pdf: jsPDF, content: string, x: number, y: number, fontSize = 10, color: [number, number, number] = INK, bold = false) {
  pdf.setFont('helvetica', bold ? 'bold' : 'normal')
  pdf.setFontSize(fontSize)
  pdf.setTextColor(...color)
  pdf.text(content, x, y)
}
function paragraph(pdf: jsPDF, content: string, x: number, y: number, width: number, fontSize: number, leading: number, maxLines: number, color: [number, number, number] = INK) {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(fontSize)
  pdf.setTextColor(...color)
  const lines = pdf.splitTextToSize(content.trim(), width) as string[]
  lines.slice(0, maxLines).forEach((line, index) => pdf.text(line, x, y + index * leading))
  return y + Math.min(lines.length, maxLines) * leading
}
function formRule(pdf: jsPDF, label: string, x: number, y: number, width: number, labelWidth: number) {
  text(pdf, label, x, y, 10, DARK, true)
  pdf.setDrawColor(135, 162, 165)
  pdf.setLineWidth(0.22)
  pdf.line(x + labelWidth, y + 1.1, x + width, y + 1.1)
}
function prettyDate(date: string | undefined) {
  if (!date) return ''
  const [year, month, day] = date.split('-').map(Number)
  if (!year || !month || !day) return date
  const result = new Date(year, month - 1, day)
  return Number.isNaN(result.valueOf()) ? date : result.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
function brochureCover(pdf: jsPDF, school: School, ctx: Context) {
  // RECTO : livret explicatif d'inspiration 2026, sans reprendre les images d'une campagne passée.
  pdf.setFillColor(...LIGHT); pdf.rect(0, 0, 297, 210, 'F')
  pdf.setFillColor(...TEAL); pdf.rect(0, 0, 297, 19, 'F')
  text(pdf, 'AEIM  /  OPÉRATION BRIOCHES DE L’AMITIÉ', 12, 12.4, 14, [255, 255, 255], true)
  text(pdf, 'UNE ÉCOLE SOLIDAIRE', 236, 12.4, 9, [255, 255, 255], true)
  // Page de gauche : sensibilisation et présentation
  pdf.setFillColor(255, 255, 255); pdf.roundedRect(10, 27, 132, 173, 5, 5, 'F')
  text(pdf, 'ET SI UNE BRIOCHE', 19, 46, 25, TEAL, true)
  text(pdf, 'POUVAIT CHANGER', 19, 59, 25, TEAL, true)
  text(pdf, 'DES VIES ?', 19, 72, 25, PINK, true)
  pdf.setDrawColor(...PINK); pdf.setLineWidth(1.3); pdf.line(19, 78, 76, 78)
  text(pdf, 'POURQUOI CETTE OPÉRATION ?', 19, 94, 12, DARK, true)
  paragraph(pdf,
    'Depuis près de 50 ans, l’AEIM organise l’Opération Brioches de l’Amitié en Meurthe-et-Moselle et dans les Vosges. Cette action soutient des projets en faveur des personnes en situation de handicap intellectuel.',
    19, 104, 112, 10.4, 6, 9)
  pdf.setFillColor(235, 246, 244); pdf.roundedRect(18, 151, 116, 27, 4, 4, 'F')
  text(pdf, 'SOUTENIR  •  SENSIBILISER  •  PARTAGER', 24, 161, 10, TEAL, true)
  paragraph(pdf, 'L’AEIM, association familiale créée en 1957, agit pour une société plus inclusive et plus solidaire.', 24, 169, 105, 9, 4.7, 2)
  text(pdf, 'www.aeim.eu', 19, 191, 10, TEAL, true)

  // Page de droite : couverture de l'opération et personnalisation école / campagne.
  pdf.setFillColor(...TEAL); pdf.roundedRect(150, 27, 137, 173, 5, 5, 'F')
  pdf.setFillColor(23, 112, 115); pdf.circle(219, 104, 47, 'F')
  pdf.setFillColor(246, 190, 88); pdf.ellipse(220, 107, 34, 24, 'F')
  pdf.setFillColor(255, 224, 149); pdf.ellipse(219, 102, 31, 17, 'F')
  pdf.setDrawColor(212, 152, 76); pdf.setLineWidth(1.3)
  pdf.line(204, 101, 212, 110); pdf.line(216, 93, 228, 113); pdf.line(234, 99, 240, 109)
  pdf.setFillColor(252, 220, 239); pdf.circle(165, 90, 4.5, 'F'); pdf.circle(275, 91, 3.6, 'F')
  text(pdf, 'OPÉRATION', 162, 44, 23, [255, 255, 255], true)
  text(pdf, 'BRIOCHES', 162, 58, 31, [255, 255, 255], true)
  const cName = ctx.campaignName || 'Campagne à préciser'
  paragraph(pdf, cName, 163, 69, 113, 13, 6, 2, [255, 235, 193])
  text(pdf, 'UNE ACTION SOLIDAIRE', 164, 143, 16, [255, 255, 255], true)
  text(pdf, 'AVEC VOTRE ÉCOLE', 164, 153, 16, [255, 255, 255], true)
  paragraph(pdf, school.name, 164, 166, 112, 11, 6, 2, [255, 235, 193])
  pdf.setFillColor(255, 255, 255); pdf.roundedRect(163, 182, 112, 11, 3, 3, 'F')
  text(pdf, 'MERCI POUR VOTRE SOLIDARITÉ !', 169, 189.4, 10.7, TEAL, true)
  pdf.setProperties({ title: `Opération Brioches - bon individuel - ${school.name}`, subject: ctx.campaignName, author: 'AEIM - Module Écoles' })
}
function brochureInside(pdf: jsPDF, school: School, cls: SchoolClass, ctx: Context) {
  const settings = ctx.flyer
  const dates = settings?.operationDates?.trim() || 'Dates communiquées par l’école'
  const purpose = settings?.fundedProject?.trim() || 'Des projets en faveur des personnes en situation de handicap intellectuel.'
  const deadline = prettyDate(school.orderReturnDate)
  const delivery = school.deliveryInfo?.trim() || 'Les brioches seront livrées à l’école, à une date convenue avec l’établissement.'
  const donation = ctx.price > 0 ? `un don de ${euro(ctx.price)} minimum par brioche` : 'un don dont le montant sera précisé par l’école'
  pdf.addPage('a4', 'landscape')
  pdf.setFillColor(255, 255, 255); pdf.rect(0, 0, 297, 210, 'F')
  pdf.setFillColor(...TEAL); pdf.rect(0, 0, 297, 17, 'F')
  text(pdf, 'POURQUOI L’OPÉRATION BRIOCHES ?', 12, 11.2, 18, [255, 255, 255], true)
  text(pdf, 'UNE ACTION DE SOLIDARITÉ LOCALE', 222, 11.2, 10, [255, 255, 255], true)
  // Encart d'information au-dessus du coupon détachable
  text(pdf, 'Un petit geste, un grand soutien', 12, 29, 17, DARK, true)
  paragraph(pdf,
    settings?.familyMessage?.trim() || `Votre école participe à l’Opération Brioches de l’Amitié. Les familles peuvent, si elles le souhaitent, faire ${donation} pour soutenir les actions de l’AEIM. Les commandes sont regroupées par l’école.`,
    12, 39, 169, 10.7, 6, 4)
  pdf.setFillColor(239, 248, 246); pdf.roundedRect(190, 24, 95, 41, 3, 3, 'F')
  text(pdf, 'CETTE ANNÉE, VOTRE DON SOUTIENT :', 197, 33, 9.5, TEAL, true)
  paragraph(pdf, purpose, 197, 43, 78, 10.3, 5.7, 3, DARK)
  text(pdf, 'COMMENT PARTICIPER ?', 12, 72, 11.5, DARK, true)
  const steps = [
    '1   Complétez le bon de commande détachable ci-dessous.',
    `2   Remettez-le à l’école${deadline ? ` avant le ${deadline}` : ' avant la date indiquée par l’établissement'}, avec le règlement sous enveloppe fermée.`,
    '3   Les brioches seront distribuées par l’école à votre enfant.',
  ]
  steps.forEach((s, i) => text(pdf, s, 14, 81 + i * 7.5, 9.7, INK))
  text(pdf, `Période : ${dates}`, 191, 75, 10, TEAL, true)
  paragraph(pdf, delivery, 191, 84, 88, 9.2, 5.4, 3)
  // Ligne de découpe : le coupon a une moitié basse autonome pour OCR, même détachée.
  pdf.setDrawColor(...TEAL); pdf.setLineDashPattern([3, 2], 0); pdf.setLineWidth(0.5); pdf.line(8, 105, 289, 105)
  pdf.setLineDashPattern([], 0)
  pdf.setFillColor(242, 248, 247); pdf.rect(0, 109, 297, 101, 'F')
  text(pdf, 'DÉTACHEZ LE BON DE COMMANDE SUR LES POINTILLÉS', 12, 111, 9.7, TEAL, true)

  text(pdf, 'BON DE COMMANDE', 12, 119, 19, TEAL, true)
  text(pdf, 'ENSEMBLE POUR LA SOLIDARITÉ', 12, 126, 9.7, PINK, true)
  const returnText = deadline ? `À retourner à l’école avant le ${deadline}` : 'Date limite de retour : à confirmer avec l’école'
  text(pdf, returnText, 157, 119, 10.4, DARK, true)
  text(pdf, `Campagne : ${ctx.campaignName}`.slice(0, 65), 157, 126, 9.2, INK)
  // Les codes apparaissent en clair ; la lecture OCR pourra rattacher ce coupon à l'école / la classe.
  pdf.setFillColor(255, 255, 255); pdf.roundedRect(11, 131, 275, 18, 2.5, 2.5, 'F')
  text(pdf, `ÉCOLE : ${school.name}`.slice(0, 78), 16, 138, 10, DARK, true)
  text(pdf, `CLASSE : ${cls.name}${cls.level ? ` (${cls.level})` : ''}`.slice(0, 58), 157, 138, 10, DARK, true)
  text(pdf, `ID ÉCOLE : ${school.id}`, 16, 145, 8.8, TEAL, true)
  text(pdf, `ID CLASSE : ${cls.id}`, 157, 145, 8.8, TEAL, true)
  formRule(pdf, 'Nom et prénom du parent :', 14, 158, 268, 55)
  formRule(pdf, 'Nom et prénom de votre enfant :', 14, 171, 268, 70)
  formRule(pdf, 'Téléphone :', 14, 184, 122, 30)
  formRule(pdf, 'Adresse mail :', 155, 184, 127, 36)
  formRule(pdf, 'Nombre de brioches commandées :', 14, 194, 113, 72)
  formRule(pdf, 'Montant total :', 159, 194, 123, 38)
  text(pdf, ctx.price > 0 ? `Don minimum : ${euro(ctx.price)} / brioche` : 'Montant du don : voir l’école', 14, 201, 8.6, TEAL)
  text(pdf, 'Je règle par :   [ ] Espèces     [ ] Chèque', 156, 201, 10, DARK, true)
  // Texte imprimé dans le coupon même : scannable isolément.
  text(pdf, 'Merci ! Bon et règlement à remettre dans une enveloppe fermée.', 14, 206, 7.6, INK)
  text(pdf, `ID CAMPAGNE : ${ctx.campaignId}`.slice(0, 65), 157, 206, 7.3, INK)
  // Dans la notice principale, la participation reste facultative, conformément au modèle 2026.
  // “don minimum” est conditionné par le prix configuré, qui reste à confirmer par la communication.
}
function header(pdf: jsPDF, school: School, cls: SchoolClass, ctx: Context, title: string) {
  pdf.setFillColor(...DARK); pdf.rect(0, 0, 210, 28, 'F')
  text(pdf, 'OPÉRATION BRIOCHES', 15, 12, 19, [255, 255, 255], true)
  text(pdf, title, 15, 21, 10, [255, 255, 255], true)
  text(pdf, `École : ${school.name}`.slice(0, 90), 15, 40, 12, DARK)
  text(pdf, `Classe : ${cls.name}${cls.level ? ` (${cls.level})` : ''}`.slice(0, 90), 15, 47, 12, DARK)
  text(pdf, `ID ÉCOLE : ${school.id}`, 15, 56, 9)
  text(pdf, `ID CLASSE : ${cls.id}`, 15, 62, 9)
  text(pdf, `ID CAMPAGNE : ${ctx.campaignId}`, 15, 68, 9)
  text(pdf, `Campagne : ${ctx.campaignName}`.slice(0, 110), 15, 74, 9)
  text(pdf, `Prix indicatif d'une brioche : ${euro(ctx.price)}`, 15, 80, 9)
  pdf.setDrawColor(235, 125, 28); pdf.line(15, 85, 195, 85)
}
/** Récapitulatif réel par classe : seules les commandes validées sont imprimées. */
export function exportClassSheet(school: School, cls: SchoolClass, ctx: Context, orders: SchoolOrder[]) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const scoped = orders
    .filter(order => order.campaignId === ctx.campaignId && order.schoolId === school.id && order.classId === cls.id)
    .sort((a, b) => a.studentName.localeCompare(b.studentName, 'fr', { sensitivity: 'base' }))
  const totalQuantity = scoped.reduce((sum, order) => sum + order.quantity, 0)
  const totalAmount = totalQuantity * ctx.price

  header(pdf, school, cls, ctx, 'RÉCAPITULATIF DES COMMANDES PAR CLASSE')
  text(pdf, `Enseignant(e) : ${cls.teacher || 'Non renseigné'}`.slice(0, 95), 15, 94, 10)
  text(pdf, `${scoped.length} élève(s) avec commande  -  ${totalQuantity} brioche(s)  -  ${euro(totalAmount)}`, 15, 102, 10, DARK, true)

  if (scoped.length === 0) {
    pdf.setFillColor(...LIGHT)
    pdf.roundedRect(15, 112, 180, 25, 3, 3, 'F')
    text(pdf, 'Aucune commande enregistrée pour cette classe sur cette campagne.', 20, 127, 11, INK)
  } else {
    const rows = scoped.map((order, index) => [
      String(index + 1),
      order.studentName,
      String(order.quantity),
      euro(order.quantity * ctx.price),
    ])
    autoTable(pdf, {
      startY: 110,
      head: [['N°', 'Nom et prénom de l’élève', 'Brioches', 'Montant estimé']],
      body: rows,
      foot: [['', 'TOTAL CLASSE', String(totalQuantity), euro(totalAmount)]],
      showFoot: 'lastPage',
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3, minCellHeight: 9, overflow: 'linebreak' },
      headStyles: { fillColor: [18, 61, 115], fontStyle: 'bold', textColor: [255, 255, 255] },
      footStyles: { fillColor: [235, 246, 244], fontStyle: 'bold', textColor: [14, 53, 88] },
      alternateRowStyles: { fillColor: [247, 250, 250] },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        1: { cellWidth: 85 },
        2: { cellWidth: 31, halign: 'center' },
        3: { cellWidth: 49, halign: 'right' },
      },
      margin: { left: 15, right: 15, top: 27, bottom: 22 },
      didDrawPage: () => {
        const page = pdf.getCurrentPageInfo().pageNumber
        if (page > 1) {
          pdf.setFillColor(...DARK); pdf.rect(0, 0, 210, 18, 'F')
          text(pdf, `${ctx.campaignName} - ${school.name} / ${cls.name}`.slice(0, 105), 12, 11.5, 10, [255, 255, 255], true)
        }
      },
    })
  }
  const pageCount = pdf.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page)
    pdf.setDrawColor(211, 224, 223)
    pdf.line(15, 279, 195, 279)
    text(pdf, 'Liste des commandes enregistrées - les montants ne prouvent pas le paiement.', 15, 285, 8, [102, 118, 141])
    text(pdf, `Page ${page}/${pageCount}`, 178, 290, 8, [102, 118, 141])
  }
  save(pdf, `Recap_classe_${school.id}_${cls.id}_${ctx.campaignId}.pdf`)
}
/** Un A4 paysage recto-verso : partie personnalisée + bon détachable protégé.
 * Si un fond PDF est enregistré pour la campagne, les 107 mm inférieurs du verso
 * sont remplacés par le coupon généré automatiquement, ce qui rend sa lecture OCR stable.
 */
export async function exportIndividualOrder(school: School, cls: SchoolClass, ctx: Context): Promise<void> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  brochureCover(pdf, school, ctx)
  brochureInside(pdf, school, cls, ctx)
  const filename = `Bon_individuel_detachable_${school.id}_${cls.id}.pdf`
  const template = await readSchoolTemplate(ctx.campaignId)
  if (!template) { save(pdf, filename); return }

  const generated = await PDFDocument.load(pdf.output('arraybuffer'))
  const custom = await PDFDocument.load(await template.pdf.arrayBuffer())
  // Validation défensive : stockage local potentiellement hérité ou remplacé.
  if (custom.getPageCount() !== 2) throw new Error('Modèle Écoles invalide : il faut 2 pages.')
  const pages = custom.getPages()
  if (pages.some(page => {
    const { width, height } = page.getSize()
    return Math.abs(width - 841.89) > 14 || Math.abs(height - 595.28) > 14
  })) throw new Error('Modèle Écoles invalide : seules 2 pages A4 paysage sont acceptées.')

  const source = generated.getPage(1)
  const target = pages[1]
  const fixedHeight = source.getHeight() * (107 / 210)
  const originalWidth = source.getWidth()
  const [protectedCoupon] = await custom.embedPages([source], [
    { left: 0, bottom: 0, right: originalWidth, top: fixedHeight },
  ])
  // Efface intégralement le contenu du PDF importé sur la zone réservée.
  target.drawRectangle({ x: 0, y: 0, width: target.getWidth(), height: target.getHeight() * 107 / 210, color: rgb(1, 1, 1) })
  target.drawPage(protectedCoupon, { x: 0, y: 0, width: target.getWidth(), height: target.getHeight() * 107 / 210 })

  const result = await custom.save()
  const blob = new Blob([new Uint8Array(result)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
export function exportSchoolRecapPdf(school: School, orders: SchoolOrder[], ctx: Context) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  text(pdf, 'Récapitulatif des commandes scolaires', 14, 20, 18, DARK, true)
  text(pdf, `${school.name} — ${ctx.campaignName}`, 14, 31, 11, DARK, true)
  const body = school.classes.map(cls => {
    const scoped = orders.filter(order => order.schoolId === school.id && order.classId === cls.id && order.campaignId === ctx.campaignId)
    const count = scoped.reduce((n, order) => n + order.quantity, 0)
    return [cls.name, String(scoped.length), String(count), euro(count * ctx.price)]
  })
  autoTable(pdf, { startY: 40, head: [['Classe', 'Élèves', 'Brioches', 'Montant estimé']], body,
    headStyles: { fillColor: [18, 61, 115] }, styles: { fontSize: 10 } })
  const qty = orders.filter(o => o.schoolId === school.id && o.campaignId === ctx.campaignId).reduce((n, o) => n + o.quantity, 0)
  const y = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 50
  text(pdf, `TOTAL ÉCOLE : ${qty} brioches — ${euro(qty * ctx.price)}`, 14, Math.min(282, y + 13), 11, DARK, true)
  save(pdf, `Recap_ecole_${school.id}_${ctx.campaignId}.pdf`)
}
