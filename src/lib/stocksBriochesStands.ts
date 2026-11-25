import { livraisonsStands } from './standsLivraisons'
import { bilanCompteurStand, lireTransfertsStands } from './compteurBrioches'

type Stand = { id:string; campagne?:string; nom:string; date:string; briochesPrevues?:number; briochesRemises?:number;stockFournisseur?:boolean }
export type StandStockEstime = {
  id:string;nom:string;date:string;base:number;prevues:number;remises:number;restantes:number;
  transferts:number;ecart:number;cloture:boolean;origine:string
}
const STANDS_KEY='ob-stands-brioches-v1'
const annee=(v:string)=>v.match(/(?:19|20)\d{2}/)?.[0] || ''
const campagneCompatible=(stand:Stand,campagne:string)=>stand.campagne ? (
  stand.campagne===campagne || (!/^(test|specimen)/i.test(stand.campagne) && !/^(test|specimen)/i.test(campagne) &&
  annee(stand.campagne)!=='' && annee(stand.campagne)===annee(campagne))
): /^\d{4}-\d{2}-\d{2}$/.test(stand.date) && stand.date.slice(0,4)===annee(campagne)
export function lireStandsEstimes(campagne:string, fiches: Array<{type?:string;standId?:string;campagne?:string;nbBriochesDonnees?:number}>):StandStockEstime[] {
  let records:unknown
  try { records=JSON.parse(localStorage.getItem(STANDS_KEY)||'null') } catch { return [] }
  if (!Array.isArray(records)) return []
  const livraisons=livraisonsStands(campagne)
  const transferts=lireTransfertsStands(campagne)
  return records.filter((s):s is Stand=>Boolean(s&&typeof s==='object'&&typeof s.id==='string'&&typeof s.nom==='string'&&typeof s.date==='string'))
    .filter(s=>campagneCompatible(s,campagne))
    .map(s=>{
      const b=bilanCompteurStand(s,campagne,{livraisons,transferts,fiches})
      return {id:s.id,nom:s.nom,date:s.date,base:b.base,prevues:b.base+b.entrees,
        remises:b.distribuees,restantes:b.restantes,transferts:b.transfertsSortants,
        ecart:b.ecart,cloture:b.cloture,origine:b.source==='fournisseur'?'Livraison fournisseur':'Prévision manuelle'}
    })
}
