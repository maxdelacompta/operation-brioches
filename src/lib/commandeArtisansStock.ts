import type { CommandeArtisan } from '../types/artisans'
import type { EtablissementAEIM } from '../types/etablissements'
import { stockFor, publishBriochesChange, STOCK_KEY } from './briochesStock'

type Destination = { id: string; type: 'ETABLISSEMENT' | 'MAIRIE' | 'STAND'; referenceId: string; quantite: number; livre: boolean }
type CommandeArtisans = CommandeArtisan & { destinations?: Destination[]; etablissementId?: string; destinationId?: string; destinationType?: Destination['type']; livre?: boolean }
type Mouvement = { id:string;date:string;type:string;etablissementId:string;quantite:number;commentaire:string }
function mouvements(): Mouvement[] { try { const raw: unknown=JSON.parse(localStorage.getItem(STOCK_KEY)||'[]'); return Array.isArray(raw)? raw as Mouvement[]:[] } catch{return []} }
const confirme=(c:CommandeArtisan)=>['CONFIRMEE','RETRAIT_PREVU','TERMINEE'].includes(c.statut)
/** Une réception idempotente par destination AEIM livrée ; aucun mouvement pour une mairie ou un stand. */
export function synchroniserReceptionArtisans(commande:CommandeArtisans, _ancienne:CommandeArtisan|undefined, etablissements:EtablissementAEIM[]):{ok:boolean;erreur?:string}{
 const anciennes=mouvements();const prefix=`achat-artisans-${commande.id}-`;const ancienId=`achat-artisans-${commande.id}`
 const reste=anciennes.filter(m=>!m.id.startsWith(prefix)&&m.id!==ancienId)
 const dest=commande.destinations?.length?commande.destinations:commande.etablissementId||commande.destinationId?[{id:'legacy',type:commande.destinationType||'ETABLISSEMENT',referenceId:commande.destinationId||commande.etablissementId||'',quantite:commande.quantiteCommandee,livre:!!commande.livre}]:[]
 const receptions:Mouvement[]=[]
 if(confirme(commande)) for(const d of dest){
   if(!d.livre||d.type!=='ETABLISSEMENT')continue
   if(!etablissements.some(e=>e.id===d.referenceId&&e.statut==='ACTIF'))return{ok:false,erreur:'Établissement de livraison inconnu ou inactif.'}
   if(!Number.isInteger(d.quantite)||d.quantite<=0)return{ok:false,erreur:'Quantité de livraison invalide.'}
   receptions.push({id:prefix+d.id,date:new Date().toISOString(),type:'reception',etablissementId:d.referenceId,quantite:d.quantite,commentaire:`Commande Artisan ${commande.numero} · livraison ${d.id}`})
 }
 const suivants=[...reste,...receptions]
 const touches=new Set([...anciennes.filter(m=>m.id===ancienId||m.id.startsWith(prefix)).map(m=>m.etablissementId),...receptions.map(m=>m.etablissementId)])
 if([...touches].some(id=>stockFor(id,suivants)<0))return{ok:false,erreur:'Stock insuffisant pour réduire ou annuler une livraison déjà consommée.'}
 try{localStorage.setItem(STOCK_KEY,JSON.stringify(suivants));publishBriochesChange();return{ok:true}}catch{return{ok:false,erreur:'Impossible de sauvegarder le stock.'}}
}
