import { jsPDF } from 'jspdf'
import type { CommandeEtablissement } from './etablissementsCommandesStore'
import { montantCommande, montantRegle, quantiteRemise, resteAregler, resteAremettre } from './etablissementsCommandesStore'

const fmt = (cents: number) => `${(cents / 100).toFixed(2).replace('.', ',')} €`
const dateFr = (value: string) => new Date(value).toLocaleDateString('fr-FR')
const navy: [number, number, number] = [23, 49, 78]
const orange: [number, number, number] = [241, 111, 19]
const text: [number, number, number] = [44, 70, 92]
const light: [number, number, number] = [246, 249, 252]
const safe = (s: string) => s.replace(/[\r\n\t]/g, ' ').trim()

/** PDF A4 à imprimer. Le bon reste distinct d'un reçu fiscal et d'un justificatif d'encaissement. */
export function exporterBonCommandeEtablissement(commande: CommandeEtablissement, nomEtablissement: string, nomCampagne: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const label = (s: string, x: number, y: number, size = 10, bold = false, color = text) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal')
    pdf.setFontSize(size)
    pdf.setTextColor(...color)
    pdf.text(safe(s), x, y)
  }
  const multiline = (s: string, x: number, y: number, width: number, maxLines = 4) => {
    const lines = pdf.splitTextToSize(safe(s), width) as string[]
    lines.slice(0, maxLines).forEach((line, i) => label(line, x, y + i * 5, 10))
  }
  pdf.setFillColor(...navy); pdf.rect(0, 0, 210, 38, 'F')
  pdf.setFillColor(...orange); pdf.rect(0, 38, 210, 3, 'F')
  label('AEIM  |  OPÉRATION BRIOCHE', 15, 15, 12, true, [255, 255, 255])
  label('BON DE COMMANDE', 15, 29, 19, true, [255, 255, 255])
  label(commande.numero, 155, 29, 10, true, [255, 240, 225])
  pdf.setFillColor(...light); pdf.roundedRect(13, 51, 184, 47, 3, 3, 'F')
  label('CAMPAGNE', 19, 60, 8, true, orange)
  multiline(nomCampagne || commande.campagne, 19, 67, 80, 2)
  label('ÉTABLISSEMENT AEIM', 111, 60, 8, true, orange)
  multiline(nomEtablissement, 111, 67, 78, 3)
  label('Référence : ' + commande.numero, 19, 89, 9, true)
  label('Date : ' + dateFr(commande.date), 113, 89, 9)
  label('DEMANDEUR', 15, 111, 9, true, orange)
  label(commande.demandeur, 15, 119, 12, true, navy)
  if (commande.contact) multiline(commande.contact, 15, 127, 175, 2)
  pdf.setFillColor(...navy); pdf.roundedRect(13, 140, 184, 10, 2, 2, 'F')
  label('DÉSIGNATION', 18, 146.7, 9, true, [255, 255, 255])
  label('QTE', 125, 146.7, 9, true, [255, 255, 255])
  label('PRIX UNIT.', 147, 146.7, 9, true, [255, 255, 255])
  label('TOTAL', 180, 146.7, 9, true, [255, 255, 255])
  label("Brioches de l'amitié", 18, 162)
  label(String(commande.quantite), 125, 162, 10, true)
  label(fmt(commande.prixUnitaireCentimes), 147, 162)
  label(fmt(montantCommande(commande)), 176, 162, 10, true)
  pdf.setDrawColor(219, 227, 235);pdf.line(14, 169, 196, 169)
  label('TOTAL DE LA COMMANDE', 95, 182, 10, true, navy)
  label(fmt(montantCommande(commande)), 173, 182, 11, true, orange)
  pdf.setFillColor(...light);pdf.roundedRect(13, 191, 184, 27, 3, 3, 'F')
  label('SUIVI DES REMISES ET RÈGLEMENTS', 19, 199, 9, true, navy)
  label(`Remises : ${quantiteRemise(commande)} / ${commande.quantite}  |  À remettre : ${resteAremettre(commande)}`, 19, 206, 9)
  label(`Réglé : ${fmt(montantRegle(commande))}  |  Reste à régler : ${fmt(resteAregler(commande))}`, 19, 213, 9)
  if (commande.commentaire) {label('OBSERVATIONS', 15, 228, 9, true, orange); multiline(commande.commentaire, 15, 235, 178, 3)}
  pdf.setDrawColor(174, 189, 205);pdf.setLineDashPattern([2, 2], 0);pdf.line(14, 252, 196, 252);pdf.setLineDashPattern([], 0)
  label('SOUCHE / CONFIRMATION DE REMISE', 15, 260, 9, true, navy)
  label(`${commande.numero}  -  ${commande.demandeur}`, 15, 267, 9)
  label('Date de remise : ____ / ____ / ______     Quantité remise : __________', 15, 275, 9)
  label('Signature : _________________________________________________', 15, 283, 9)
  label('Document de suivi – ne constitue pas un reçu fiscal ni une facture.', 15, 293, 8, false, [110, 130, 150])
  pdf.save(`Bon_de_commande_${commande.numero.replace(/[^a-zA-Z0-9_-]/g, '')}.pdf`)
}
