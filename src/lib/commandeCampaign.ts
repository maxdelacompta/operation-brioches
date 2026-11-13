import type { Commande } from '../types/ob'

/**
 * « OB2026 », « OB 2026 » et « 2026 » représentent la même campagne historique.
 * Les campagnes personnalisées et les campagnes TEST restent toujours isolées.
 */
export function memeCampagneCommande(valeur: string, selection: string): boolean {
  if (!selection) return true
  const compact = (id: string) => id.trim().toUpperCase().replace(/[\s_-]/g, '')
  const a = compact(valeur)
  const b = compact(selection)
  if (!a || !b) return false
  if (a === b) return true
  const officielle = /^(?:OB)?(?:19|20)\d{2}$/
  return officielle.test(a) && officielle.test(b) && a.slice(-4) === b.slice(-4)
}

export function campagneEstTest(campagne: string): boolean {
  return /^\s*(?:TEST|SPECIMEN)(?:[\s_-]|(?=(?:19|20)\d{2}$))/i.test(campagne)
}

/** Identité stable d'une ligne de livraison, y compris après un reset annuel. */
export function cleLivraisonMulti(commande: Pick<Commande, 'campagne' | 'id'>, ligneId: string): string {
  return `v2:${JSON.stringify([commande.campagne, commande.id, ligneId])}`
}

export function cleAlerteLivraison(commande: Pick<Commande, 'campagne' | 'id' | 'numero' | 'dateCommande' | 'donateurId'>): string {
  return `simple:${JSON.stringify([commande.campagne, commande.id, commande.numero, commande.dateCommande, commande.donateurId])}`
}

/**
 * Recopie les affectations historiques dont l'ancienne clé id:ligne est unique.
 * Les anciennes entrées sont conservées pour éviter toute suppression silencieuse.
 * Une référence ambiguë entre deux campagnes n'est jamais attribuée au hasard.
 */
export function conserverAffectationsMulti<T>(
  enregistrements: Record<string, T>,
  commandes: readonly Pick<Commande, 'campagne' | 'id' | 'livraisons'>[],
): Record<string, T> {
  const correspondances = new Map<string, string[]>()
  for (const commande of commandes) {
    for (const [index, ligne] of (commande.livraisons ?? []).entries()) {
      const ligneId = ligne.id || `index-${index}`
      // Un index n'identifie pas durablement une destination après réinitialisation.
      if (!ligne.id) continue
      const ancienneCle = `${commande.id}:${ligneId}`
      correspondances.set(ancienneCle, [
        ...(correspondances.get(ancienneCle) ?? []),
        cleLivraisonMulti(commande, ligneId),
      ])
    }
  }

  const resultat = { ...enregistrements }
  for (const [ancienneCle, nouvellesCles] of correspondances) {
    if (nouvellesCles.length !== 1 || !(ancienneCle in enregistrements)) continue
    const nouvelleCle = nouvellesCles[0]
    if (!(nouvelleCle in resultat)) resultat[nouvelleCle] = enregistrements[ancienneCle]
  }
  return resultat
}
