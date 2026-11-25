/**
 * Lecture seule du suivi des flux de brioches.
 * Ne crée ni ne déduit JAMAIS un mouvement de stock : les sources de données
 * existantes restent responsables de leurs écritures.
 *
 * Les événements 'indicatif' (compteurs / prévisions de stands) ne doivent
 * jamais être additionnés aux événements 'comptabilisé'.
 */
export type StatutFlux = 'comptabilise' | 'indicatif'
export type NatureFlux = 'reception' | 'sortie' | 'retour' | 'transfert' | 'ajustement' | 'distribution-stand' | 'affectation-stand'

export type FluxBrioche = {
  id: string
  date: string
  nature: NatureFlux
  origine: string
  destination: string
  quantite: number
  reference: string
  source: string
  statut: StatutFlux
  commentaire: string
}

export type MouvementFlux = {
  id: string
  date: string
  type: 'reception' | 'sortie' | 'retour' | 'ajustement' | 'transfert'
  etablissementId: string
  destinationId?: string
  quantite: number
  commentaire: string
}
export type DonFlux = {
  id?: string
  date?: string
  type?: string
  quantite: number
  etablissementId?: string
  donateur?: string
}
export type StandFlux = {
  id: string
  nom: string
  date: string
  /** Départ initial, hors transferts reçus d'autres stands. */
  base: number
  remises: number
  origine: string
}
export type TransfertFlux = { id: string; from: string; to: string; qty: number; at: string }

export const NATURES_FLUX: Record<NatureFlux,string> = {
  reception: 'Réception',
  sortie: 'Sortie',
  retour: 'Retour',
  transfert: 'Transfert',
  ajustement: 'Ajustement',
  'distribution-stand': 'Distribution stand',
  'affectation-stand': 'Affectation stand',
}

export function composerFluxBrioches({
  mouvements, dons, nomsEtablissements, stands, transferts,
}: {
  mouvements: MouvementFlux[]
  dons: DonFlux[]
  nomsEtablissements: Map<string, string>
  stands: StandFlux[]
  transferts: TransfertFlux[]
}): FluxBrioche[] {
  const events: FluxBrioche[] = []
  const nom = (id: string) => nomsEtablissements.get(id) || 'Établissement non identifié'
  const standsMap = new Map(stands.map(s => [s.id, s.nom]))

  for (const m of mouvements) {
    const q = Number(m.quantite)
    if (!Number.isInteger(q) || q === 0) continue
    let origine = nom(m.etablissementId)
    let destination = 'Extérieur / bénéficiaire'
    if (m.type === 'reception') { origine = m.id.startsWith('mecenat-reception-') ? 'Boulangerie mécène' : 'Fournisseur / autre origine'; destination = nom(m.etablissementId) }
    if (m.type === 'retour') { origine = 'Retour physique'; destination = nom(m.etablissementId) }
    if (m.type === 'transfert') destination = m.destinationId ? nom(m.destinationId) : 'Non renseigné'
    if (m.type === 'ajustement') { origine = q > 0 ? 'Correction d’inventaire' : nom(m.etablissementId); destination = q > 0 ? nom(m.etablissementId) : 'Correction d’inventaire' }
    const refCommande = m.commentaire.match(/Livraison achat\s+(\S+)/i)?.[1]
    events.push({
      id: `stock-${m.id}`, date: m.date, nature: m.type, origine, destination,
      quantite: Math.abs(q), reference: refCommande ? `Achat ${refCommande}` : m.id.startsWith('mecenat-reception-') ? 'Don en nature' : '—',
      source: m.id.startsWith('mecenat-reception-') ? 'Réception mécénat' : m.id.startsWith('achat-reception-') ? 'Commande achat livrée' : 'Mouvement enregistré',
      statut: 'comptabilise', commentaire: m.commentaire,
    })
  }

  // Le don avec contrepartie est déjà déduit par stockFor. On le rend visible
  // sans enregistrer une seconde sortie. Un don sans contrepartie financière
  // n'emporte aucune brioche, donc aucun événement de flux physique.
  for (const [index, don] of dons.entries()) {
    if (don.type === 'sans' || !don.etablissementId || !(don.quantite > 0)) continue
    events.push({
      id: `don-${don.id || index}`, date: don.date || '', nature: 'sortie',
      origine: nom(don.etablissementId), destination: 'Donateur / bénéficiaire',
      quantite: don.quantite, reference: 'Don avec contrepartie',
      source: 'Suivi brioches', statut: 'comptabilise',
      commentaire: don.donateur || 'Don avec contrepartie',
    })
  }

  // Les compteurs sont des bilans d'un stand, PAS des opérations de stock
  // imputées aux établissements. Ils restent identifiés comme indicatifs.
  for (const stand of stands) {
    if (stand.base > 0) events.push({
      id: `stand-base-${stand.id}`, date: stand.date, nature: 'affectation-stand',
      origine: stand.origine === 'Livraison fournisseur' ? 'Fournisseur (déclaré)' : 'Origine à confirmer',
      destination: stand.nom, quantite: stand.base, reference: 'Mise à disposition',
      source: 'Suivi des stands', statut: 'indicatif',
      commentaire: stand.origine === 'Livraison fournisseur' ? 'Livraison indiquée sur le stand' : 'Prévision de mise à disposition',
    })
    if (stand.remises > 0) events.push({
      id: `stand-remises-${stand.id}`, date: stand.date, nature: 'distribution-stand',
      origine: stand.nom, destination: 'Public / bénéficiaires',
      quantite: stand.remises, reference: 'Compteur / clôture / fiche',
      source: 'Compteur stand', statut: 'indicatif',
      commentaire: 'Décompte consolidé : compteur, clôture et fiche de caisse ne sont pas additionnés.',
    })
  }
  for (const transfert of transferts) {
    if (!standsMap.has(transfert.from) || !standsMap.has(transfert.to)) continue
    events.push({
      id: `stand-transfert-${transfert.id}`, date: transfert.at, nature: 'transfert',
      origine: standsMap.get(transfert.from) || 'Stand',
      destination: standsMap.get(transfert.to) || 'Stand', quantite: transfert.qty,
      reference: 'Transfert entre stands', source: 'Gestion des stands',
      statut: 'indicatif', commentaire: 'N’affecte pas le stock global des établissements.',
    })
  }

  return events.sort((a, b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id))
}

/** Une colonne de flux ne peut jamais servir à recalculer le stock. */
export function bilanFluxComptabilises(flux: FluxBrioche[]) {
  return flux.filter(f => f.statut === 'comptabilise').reduce((acc, f) => {
    if (f.nature === 'reception' || f.nature === 'retour') acc.entrees += f.quantite
    else if (f.nature === 'sortie') acc.sorties += f.quantite
    else if (f.nature === 'ajustement') acc.ajustements += f.origine === 'Correction d’inventaire' ? f.quantite : -f.quantite
    acc.transferts += Number(f.nature === 'transfert')
    return acc
  }, { entrees: 0, sorties: 0, ajustements: 0, transferts: 0 })
}

export function fluxEnCsv(flux: FluxBrioche[]): string {
  const escape = (s: string | number): string => `"${String(s).replace(/"/g, '""')}"`
  const rows = [
    ['Date','Flux','Origine','Destination','Quantité','Référence','Source','Statut','Commentaire'],
    ...flux.map(f => [f.date, NATURES_FLUX[f.nature], f.origine, f.destination, f.quantite, f.reference, f.source, f.statut === 'indicatif' ? 'Indicatif' : 'Comptabilisé', f.commentaire]),
  ]
  return '\uFEFF' + rows.map(r => r.map(escape).join(';')).join('\r\n')
}
