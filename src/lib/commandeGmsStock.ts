import type { CommandeArtisan } from '../types/artisans'
import type { EtablissementAEIM } from '../types/etablissements'
import { stockFor, loadStockDons, publishBriochesChange, STOCK_KEY, stockKeyForCampaign } from './briochesStock'

type Destination = { id: string; type: 'ETABLISSEMENT' | 'MAIRIE' | 'STAND'; referenceId: string; quantite: number; livre: boolean }
type CommandeGms = CommandeArtisan & { destinations?: Destination[]; etablissementId?: string; destinationId?: string; destinationType?: Destination['type']; livre?: boolean }
type Mouvement = { id:string;date:string;type:string;etablissementId:string;quantite:number;commentaire:string }
function mouvements(campagne: string): Mouvement[] { try { const raw: unknown=JSON.parse(localStorage.getItem(stockKeyForCampaign(campagne))||'[]'); return Array.isArray(raw)? raw as Mouvement[]:[] } catch{return []} }
const confirme=(c:CommandeArtisan)=>['CONFIRMEE','RETRAIT_PREVU','TERMINEE'].includes(c.statut)
/** Une réception idempotente par destination AEIM livrée ; aucun mouvement pour une mairie ou un stand. */
export function synchroniserReceptionGms(commande:CommandeGms, ancienneCommande:CommandeArtisan|undefined, etablissements:EtablissementAEIM[]):{ok:boolean;erreur?:string}{
 const key = stockKeyForCampaign(commande.campagne)
 // Anciennes versions : toutes les campagnes écrivaient par erreur dans le stock 2026.
 // Ne pas recréer une réception dans sa vraie campagne si une ancienne entrée
 // du même bon est encore présente dans le stock 2026.
 if (key !== STOCK_KEY && mouvements('OB 2026').some(m => m.id === `achat-gms-${commande.id}` || m.id.startsWith(`achat-gms-${commande.id}-`))) {
   return {ok:false,erreur:'Une réception historique de ce bon est enregistrée dans le stock 2026. Rapprochez cette écriture avant de modifier le bon, pour éviter un double comptage.'}
 }
 // Une commande déjà livrée ne peut changer de campagne sans annuler son stock
 // dans la campagne d'origine (opération à rapprocher manuellement).
 if (ancienneCommande && stockKeyForCampaign(ancienneCommande.campagne) !== key) {
   const anciennesCampagne = mouvements(ancienneCommande.campagne)
   const oldPrefix = `achat-gms-${commande.id}-`
   const oldId = `achat-gms-${commande.id}`
   if (anciennesCampagne.some(m => m.id === oldId || m.id.startsWith(oldPrefix))) {
     return {ok:false,erreur:'Une commande livrée ne peut pas changer de campagne : rapproche le stock de la campagne d’origine avant toute correction.'}
   }
 }
 const anciennes=mouvements(commande.campagne);const prefix=`achat-gms-${commande.id}-`;const ancienId=`achat-gms-${commande.id}`
 const reste=anciennes.filter(m=>!m.id.startsWith(prefix)&&m.id!==ancienId)
 const dest=commande.destinations?.length?commande.destinations:commande.etablissementId||commande.destinationId?[{id:'legacy',type:commande.destinationType||'ETABLISSEMENT',referenceId:commande.destinationId||commande.etablissementId||'',quantite:commande.quantiteCommandee,livre:!!commande.livre}]:[]
 const receptions:Mouvement[]=[]
 if(confirme(commande)) for(const d of dest){
   if(!d.livre||d.type!=='ETABLISSEMENT')continue
   if(!etablissements.some(e=>e.id===d.referenceId&&e.statut==='ACTIF'))return{ok:false,erreur:'Établissement de livraison inconnu ou inactif.'}
   if(!Number.isInteger(d.quantite)||d.quantite<=0)return{ok:false,erreur:'Quantité de livraison invalide.'}
   const previous=anciennes.find(m=>m.id===prefix+d.id && m.etablissementId===d.referenceId && m.quantite===d.quantite)
   receptions.push({id:prefix+d.id,date:previous?.date ?? new Date().toISOString(),type:'reception',etablissementId:d.referenceId,quantite:d.quantite,commentaire:`Commande GMS ${commande.numero} · livraison ${d.id}`})
 }
 const suivants=[...reste,...receptions]
 const touches=new Set([...anciennes.filter(m=>m.id===ancienId||m.id.startsWith(prefix)).map(m=>m.etablissementId),...receptions.map(m=>m.etablissementId)])
 if([...touches].some(id=>stockFor(id,suivants,loadStockDons(commande.campagne))<0))return{ok:false,erreur:'Stock insuffisant pour réduire ou annuler une livraison déjà consommée.'}
 try{localStorage.setItem(key,JSON.stringify(suivants));publishBriochesChange();return{ok:true}}catch{return{ok:false,erreur:'Impossible de sauvegarder le stock.'}}
}
