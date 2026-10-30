import type { Commande, Donateur, FicheCaisse } from '../types/ob'
import type { JustificatifDon, JustificatifType } from '../types/justificatifs'

export type DemandeJustificatif = {
  commande: Commande
  donateur?: Donateur
  type: JustificatifType
  motif: string
  chorus: boolean
  rapprochement: 'LIE' | 'NON_LIE'
  existant?: JustificatifDon
}

function normalise(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLocaleUpperCase('fr')
}

function oui(value: unknown) {
  return ['OUI', 'YES', 'TRUE', '1'].includes(normalise(value))
}

function memeCampagne(a: string, b: string) {
  if (normalise(a) === normalise(b)) return true
  // Ne jamais réunir une campagne spécimen et une campagne réelle de même année.
  if (/^TEST[-_ ]/.test(normalise(a)) || /^TEST[-_ ]/.test(normalise(b))) return false
  const anneeA = a.match(/(?:19|20)\d{2}/)?.[0]
  const anneeB = b.match(/(?:19|20)\d{2}/)?.[0]
  return Boolean(anneeA && anneeB && anneeA === anneeB)
}

function dateEcheance(date: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const dep = Date.parse(`${date}T12:00:00Z`)
  const maintenant = Date.parse(`${today}T12:00:00Z`)
  return Number.isFinite(dep) && Number.isFinite(maintenant) &&
    maintenant - dep >= 15 * 86_400_000
}

/** Tableau des actions à réaliser, sans création automatique de documents financiers. */
export function calculerDemandesJustificatifs(
  commandes: Commande[],
  donateurs: Donateur[],
  fiches: FicheCaisse[],
  justificatifs: JustificatifDon[],
  campagneSelectionnee: string,
  aujourdHui: string,
): DemandeJustificatif[] {
  const resultat: DemandeJustificatif[] = []

  for (const commande of commandes) {
    if (commande.statut === 'ANNULEE' || commande.statut === 'BROUILLON') continue
    if (!memeCampagne(commande.campagne, campagneSelectionnee)) continue
    const donateur = donateurs.find(d => d.id === commande.donateurId)
    const montantFicheLiee = fiches.some(f =>
      f.commandeId === commande.id && memeCampagne(f.campagne, commande.campagne),
    )
    const justificatifLie = (type: JustificatifType) => justificatifs.find(j =>
      j.type === type && memeCampagne(j.campagne, commande.campagne) &&
      (j.commandeId === String(commande.id) || j.commandeNumero === commande.numero),
    )
    const chorus = /MANDAT|CHORUS/.test(normalise(commande.modeReglement))
    const surJustificatif = /SUR\s+JUSTIFICATIF/.test(normalise(commande.conditionReglement))
    const demandeExplicite = oui(commande.jdi)
    const retardSansFiche = !montantFicheLiee && dateEcheance(commande.dateCommande, aujourdHui)
    const motifs: string[] = []
    if (demandeExplicite) motifs.push('JDI demandé sur la commande')
    if (surJustificatif) motifs.push('Règlement sur justificatif')
    if (chorus) motifs.push('Mandat administratif / Chorus')
    if (!motifs.length && retardSansFiche) motifs.push('Après 15 jours : aucune fiche de caisse liée (à vérifier)')

    if (motifs.length) {
      resultat.push({
        commande, donateur, type: 'JDI', motif: motifs.join(' · '), chorus,
        rapprochement: montantFicheLiee ? 'LIE' : 'NON_LIE',
        existant: justificatifLie('JDI'),
      })
    }

    if (oui(commande.jdp) && montantFicheLiee) {
      resultat.push({
        commande, donateur, type: 'JDP', motif: 'JDP demandé · fiche de caisse liée (règlement à vérifier)',
        chorus, rapprochement: 'LIE', existant: justificatifLie('JDP'),
      })
    }
  }
  return resultat.sort((a,b) => b.commande.dateCommande.localeCompare(a.commande.dateCommande))
}

/** Brouillon seulement : un mailto n'envoie pas d'e-mail automatiquement. */
export function composerDemandeChorus(commande: Commande, donateur?: Donateur) {
  const annee = commande.campagne.match(/(?:19|20)\d{2}/)?.[0] ?? commande.campagne
  return {
    destinataire: donateur?.email ?? '',
    objet: `Informations Chorus Pro – Opération Brioche ${annee} – ${commande.numero}`,
    corps: `Bonjour,\n\nDans le cadre de la commande ${commande.numero} pour l'Opération Brioche ${annee}, pouvez-vous nous communiquer le numéro d'engagement / d'action et le code service destinataire nécessaires au dépôt du justificatif sur Chorus Pro ?\n\nNous vous remercions par avance.\n\nBien cordialement,\nAEIM 54 – Opération Brioche`,
  }
}
