import { stockFor } from './briochesStock'
import { calculerReceptionsLots, joursAvantDateLimite, type LotBrioche, type MouvementStockLot } from './stocksBriochesLots'
import type { StandStockEstime } from './stocksBriochesStands'
import type { AlertPriority } from '../services/userAlerts'

export type PropositionAlerteStock = {
  key:string; title:string; description:string; priority:AlertPriority; dueDate:string
}
export type DonStock = {etablissementId?:string;quantite:number;type?:string}
export type EtablissementStock = {id:string;nom:string}
function frDate(s:string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s }
function addDays(day:string,n:number) { const d=new Date(`${day}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10) }
/** Suggestions automatiques, jamais des mouvements de stock. */
export function genererAlertesStocks(args:{
  aujourdHui:string; etablissements:EtablissementStock[]; mouvements:MouvementStockLot[];
  dons:DonStock[]; lots:Record<string,LotBrioche>; stands:StandStockEstime[];
}):PropositionAlerteStock[] {
  const {aujourdHui,etablissements,mouvements,dons,lots,stands}=args
  const nom=new Map(etablissements.map(e=>[e.id,e.nom]))
  const results:PropositionAlerteStock[]=[]
  const add=(a:PropositionAlerteStock)=>results.push(a)
  const receptions=calculerReceptionsLots(mouvements,lots,dons)
  for (const r of receptions) {
    if (r.quantiteRestanteEstimee<=0) continue
    const d=r.meta?.dateLimite||''
    const days=joursAvantDateLimite(d,aujourdHui)
    const etab=nom.get(r.etablissementId)||'Établissement inconnu'
    const ref=r.meta?.reference||r.commentaire||r.id
    if (days!==null && days<=2) {
      const ddm=r.meta?.natureLimite==='DDM'
      const label=days<0?'dépassée':days===0?"aujourd'hui":`dans ${days} jour${days>1?'s':''}`
      add({key:`lot-limite:${r.id}`,priority:days<=0&&!ddm?'haute':'normale',dueDate:d,
        title:`${ddm?'DDM à vérifier':'Limite de distribution'} : ${ref}`,
        description:`${etab} · ${r.quantiteRestanteEstimee} brioche(s) restantes ESTIMÉES par FEFO. Date ${label} (${frDate(d)}). ${ddm?'DDM : contrôler le produit et les consignes fournisseur, pas de destruction automatique.':'Vérifier le lot et suspendre son affectation s’il est hors limite.'} L’allocation aux lots n’est pas encore confirmée physiquement.`,
      })
    } else if (!r.meta?.dateLimite && r.date.slice(0,10)>=addDays(aujourdHui,-7) && r.date.slice(0,10)<=aujourdHui) {
      add({key:`lot-date-manquante:${r.id}`,priority:'normale',dueDate:aujourdHui,
        title:`Date limite à renseigner : ${ref}`,
        description:`${etab} · ${r.quantite} brioche(s) réceptionnées. Renseigner la date réelle et la nature DLC / DDM / limite interne dans Gestion → Tableau de bord → Suivi des brioches.`,
      })
    }
  }
  for(const e of etablissements) {
    const q=stockFor(e.id,mouvements,dons)
    if(q<0) add({key:`stock-negatif:${e.id}`,title:`Stock à rapprocher : ${e.nom}`,
      description:`Stock comptabilisé négatif (${q}). Vérifier les réceptions, commandes et sorties avant une nouvelle affectation.`,priority:'haute',dueDate:aujourdHui})
  }
  const actifsDuJour=stands.filter(s=>s.date===aujourdHui && !s.cloture)
  for (const s of actifsDuJour) {
    if(s.base<=0)continue
    const alerteSeuil=Math.max(5,Math.ceil(s.base*0.1))
    if(s.restantes<=alerteSeuil) {
      const surplus=actifsDuJour.filter(other=>other.id!==s.id && other.restantes>Math.max(20,other.base*0.4))
        .sort((a,b)=>b.restantes-a.restantes)[0]
      add({key:`stand-rupture:${s.id}:${s.date}`,priority:'haute',dueDate:aujourdHui,
        title:`Risque de rupture : ${s.nom}`,
        description:`Reste estimé : ${s.restantes} brioche(s) pour ${s.base} prévues. ${surplus?`Proposition de transfert À VALIDER : ${surplus.nom} indique ${surplus.restantes} invendues estimées, à vérifier sur place avant déplacement.`:'Demander un réapprovisionnement et confirmer le stock physique du stand.'} Données de stand indicatives, aucun transfert généré automatiquement.`,
      })
    }
  }
  const dernierJour=addDays(aujourdHui,-7)
  for(const s of stands.filter(s=>s.cloture && s.date>=dernierJour && s.date<=aujourdHui)) {
    if(s.ecart<0) add({key:`stand-ecart:${s.id}:${s.date}`,title:`Écart compteur : ${s.nom}`,
      description:`Le décompte dépasse le stock de ${-s.ecart} brioche(s). Rapprocher compteur, livraisons, transferts et fiche de caisse avant correction manuelle du stock. Aucun double décompte automatique.`,priority:'haute',dueDate:aujourdHui})
    if(s.restantes>20) add({key:`stand-invendus:${s.id}:${s.date}`,title:`Invendus à orienter : ${s.nom}`,
      description:`${s.restantes} brioche(s) restantes estimées à la clôture. Proposer un retour ou une réaffectation après vérification des lots et de leurs dates limites.`,priority:'normale',dueDate:aujourdHui})
  }
  // Les prévisions des stands peuvent inclure des livraisons directes ; ne jamais
  // les déduire du stock ni présenter cette comparaison comme une rupture certaine.
  const demain=addDays(aujourdHui,1)
  const previs=stands.filter(s=>s.date===demain && !s.cloture)
    .reduce((n,s)=>n+Math.max(0,s.base),0)
  const total=etablissements.reduce((n,e)=>n+Math.max(0,stockFor(e.id,mouvements,dons)),0)
  if(previs>total && previs>0) add({key:`previsions:${demain}`,title:'Préparer les besoins de demain',
    description:`${previs} brioche(s) prévues sur les stands contre ${total} en stock établissements. Comparaison indicative : vérifier les arrivages à venir et les livraisons directes GMS avant de conclure à un manque.`,priority:'normale',dueDate:aujourdHui})
  return results
}
