// Consultation des stands pour l'affectation des livraisons fournisseurs.
// Le stand est identifié par son ID, jamais uniquement par son nom.
export type StandAffectable = { id:string; nom:string; date:string; lieu?:string; adresse?:string; campagne?:string; statut?:string }
const read = (key:string):unknown => { try { return JSON.parse(localStorage.getItem(key) || 'null') as unknown } catch { return null } }
export const anneeCampagneStand = (s:string) => s.match(/(?:19|20)\d{2}/)?.[0] ?? ''
export function standsPourCampagne(campagne:string): StandAffectable[] {
  const data=read('ob-stands-brioches-v1')
  if(!Array.isArray(data)) return []
  return data.filter((s):s is StandAffectable=>Boolean(s && typeof s.id==='string' && typeof s.nom==='string' && typeof s.date==='string'))
    .filter(s=> {
      if(s.campagne) return s.campagne===campagne || Boolean(anneeCampagneStand(s.campagne) && anneeCampagneStand(s.campagne)===anneeCampagneStand(campagne))
      return s.date.slice(0,4)===anneeCampagneStand(campagne)
    }).sort((a,b)=>a.date.localeCompare(b.date)||a.nom.localeCompare(b.nom,'fr'))
}
export function livraisonsStands(campagne:string):Record<string,number> {
  const sums:Record<string,number>={}
  for(const key of ['ob-commandes-artisans-v1','ob-commandes-gms-v1']){
    const raw=read(key)
    if(!Array.isArray(raw)) continue
    for(const c of raw){
      if(!c || typeof c!=='object')continue
      if(anneeCampagneStand(String(c.campagne??''))!==anneeCampagneStand(campagne))continue
      if(!Array.isArray(c.destinations))continue
      for(const dest of c.destinations){
        if(dest?.type!=='STAND' || !dest.livre || !dest.referenceId || !(Number(dest.quantite)>0))continue
        const qty=Number(dest.quantite)
        sums[dest.referenceId]=(sums[dest.referenceId]||0)+qty
      }
    }
  }
  return sums
}
