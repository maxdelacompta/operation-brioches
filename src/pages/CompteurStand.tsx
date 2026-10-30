import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, HeartHandshake, PackageCheck, Pencil, Trash2, X } from 'lucide-react'
import './CompteurStand.css'

type Stand = {id:string;nom:string;lieu:string;date:string;briochesPrevues:number;briochesRemises:number;statut:string}
type Operation = {id:string;at:string;kind:'brioche'|'don';qty:number;amount:number;method?:string}
type AuditEntry = {id:string;at:string;operationId:string;action:'modification'|'suppression';before:Operation;after?:Operation}
const auditKey=(id:string)=>`ob-stand-operations-audit-v1-${id}`
const readAudit=(id:string):AuditEntry[]=>{try{const v:unknown=JSON.parse(localStorage.getItem(auditKey(id))||'[]');return Array.isArray(v)?v:[]}catch{return []}}
const STANDS_KEY='ob-stands-brioches-v1'
const closeKey=(id:string)=>`ob-stand-cloture-v1-${id}`
type StandClose={closedAt:string;briochesCompteur:number;briochesFiche:number;briochesTotal:number;donsSansBrioche:number;montantDonsSansBrioche:number}
const readClose=(id:string):StandClose|null=>{try{return JSON.parse(localStorage.getItem(closeKey(id))||'null') as StandClose|null}catch{return null}}
const createOperationId=()=>typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `operation-${Date.now()}-${Math.random().toString(36).slice(2)}`
export const operationsKey=(id:string)=>`ob-stand-operations-v1-${id}`
export function readOperations(id:string):Operation[]{try {const d:unknown=JSON.parse(localStorage.getItem(operationsKey(id))||'[]');return Array.isArray(d)?d.filter((o):o is Operation=>Boolean(o&&typeof o==='object'&&'kind'in o&&'id'in o)):[]}catch{return []}}
const readStand=(id:string):Stand|undefined=>{try{const d:unknown=JSON.parse(localStorage.getItem(STANDS_KEY)||'[]');return Array.isArray(d)?d.find((v:Stand)=>v.id===id):undefined}catch{return undefined}}
export default function CompteurStand(){
 const {id=''}=useParams()
 const [stand,setStand]=useState(()=>readStand(id))
 const [ops,setOps]=useState<Operation[]>(()=>readOperations(id))
 const [amount,setAmount]=useState('5')
 const [method,setMethod]=useState('Espèces')
 const [note,setNote]=useState('')
 const [editing,setEditing]=useState<string|null>(null)
 const [editQty,setEditQty]=useState('1')
 const [editAmount,setEditAmount]=useState('5')
 const [editMethod,setEditMethod]=useState('Espèces')
 const [editReason,setEditReason]=useState('Erreur de saisie')
 const [audit,setAudit]=useState<AuditEntry[]>(()=>readAudit(id))
 const [confirmDelete,setConfirmDelete]=useState<string|null>(null)
 const [closed,setClosed]=useState<StandClose|null>(()=>readClose(id))
 useEffect(()=>{const refresh=()=>{setStand(readStand(id));setOps(readOperations(id));setAudit(readAudit(id));setClosed(readClose(id))};refresh();window.addEventListener('storage',refresh);window.addEventListener('focus',refresh);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('focus',refresh)}},[id])
 const distributed=ops.filter(o=>o.kind==='brioche').reduce((n,o)=>n+o.qty,0)
 const gifts=ops.filter(o=>o.kind==='don')
 const totalGifts=gifts.reduce((n,o)=>n+o.amount,0)
 const estimatedStart=Number(stand?.briochesRemises)||0
 const planned=Number(stand?.briochesPrevues)||0
 const difference=planned-estimatedStart-distributed
 const available=Math.max(0,difference)
 const estimatedOnly=planned<=0
 const finishStand=()=>{
  if(!window.confirm('Terminer ce stand ? Le décompte sera figé et proposé lors de la création de la fiche de caisse.'))return
  const snapshot:StandClose={closedAt:new Date().toISOString(),briochesCompteur:distributed,briochesFiche:estimatedStart,briochesTotal:distributed+estimatedStart,donsSansBrioche:gifts.length,montantDonsSansBrioche:totalGifts}
  try{localStorage.setItem(closeKey(id),JSON.stringify(snapshot));setClosed(snapshot);setNote('Stand terminé : décompte figé pour la fiche de caisse.')}catch{setNote('Clôture impossible : stockage local indisponible.')}
 }
 const append=(kind:Operation['kind'],qty:number,don=0)=>{if(closed){setNote('Le stand est terminé : aucune nouvelle saisie possible.');return}if(kind==='brioche'&&(!Number.isSafeInteger(qty)||qty<1))return;const op:Operation={id:createOperationId(),at:new Date().toISOString(),kind,qty,amount:don,...(kind==='don'?{method}:{})};const next=[...ops,op];try {localStorage.setItem(operationsKey(id),JSON.stringify(next));setOps(next);setNote('Opération enregistrée sur cet appareil.')} catch {setNote('Impossible d’enregistrer : stockage local indisponible.')}}
 const startEdit=(o:Operation)=>{if(closed)return;setEditing(o.id);setConfirmDelete(null);setEditQty(String(o.qty));setEditAmount(String(o.amount));setEditMethod(o.method||'Espèces');setEditReason('Erreur de saisie');setNote('')}
 const recordChange=(before:Operation,after:Operation|undefined,action:AuditEntry['action'])=>{if(closed)return;
  const next=after?ops.map(o=>o.id===before.id?after:o):ops.filter(o=>o.id!==before.id)
  const entry:AuditEntry={id:createOperationId(),at:new Date().toISOString(),operationId:before.id,action,before,...(after?{after}:{})}
  const nextAudit=[...audit,{...entry,reason:editReason}]
  try{localStorage.setItem(operationsKey(id),JSON.stringify(next));localStorage.setItem(auditKey(id),JSON.stringify(nextAudit));setOps(next);setAudit(nextAudit);setEditing(null);setConfirmDelete(null);setNote(action==='suppression'?'Opération annulée. Trace conservée dans l’historique.':'Correction enregistrée. Totaux recalculés.')}catch{setNote('Enregistrement impossible : espace local indisponible.')}
 }
 const saveEdit=(o:Operation)=>{if(closed)return;
  let after:Operation
  if(o.kind==='brioche'){
   const qty=Number(editQty)
   if(!Number.isSafeInteger(qty)||qty<1){setNote('Indique un nombre de brioches valide.');return}
   after={...o,qty}
  }else{
   const amountValue=Number(editAmount)
   if(!Number.isFinite(amountValue)||amountValue<=0||Math.round(amountValue*100)/100<=0){setNote('Indique un montant de don valide.');return}
   after={...o,amount:Math.round(amountValue*100)/100,method:editMethod}
  }
  if(JSON.stringify(after)===JSON.stringify(o)){setEditing(null);return}
  recordChange(o,after,'modification')
 }
 if(!stand)return <main className="ob-counter"><h1>Stand introuvable</h1><p>Ce stand n’est pas présent sur cet appareil. L’application ne dispose pas encore d’une synchronisation serveur.</p><Link to="/gestion/stands-brioches">Retour aux stands</Link></main>
 return <main className="ob-counter"><Link to="/gestion/stands-brioches" className="ob-counter-back"><ArrowLeft size={17}/> Retour aux stands</Link><header><small>OPÉRATION BRIOCHE · COMPTEUR</small><h1>{stand.nom}</h1><p>{stand.lieu} · {stand.date}</p></header>
 <div className="ob-counter-warning">Prototype local : ce compteur est enregistré uniquement dans le navigateur de cet appareil. Il n'est pas partagé entre bénévoles et ne modifie ni les caisses, ni les TPE, ni les stocks comptables.</div>
 <div className="ob-counter-stats"><div><span>Brioches distribuées (compteur)</span><strong>{distributed}</strong></div><div><span>Restantes estimées</span><strong>{estimatedOnly?'Non estimées':available}</strong></div><div><span>Dons sans brioche</span><strong>{gifts.length}</strong></div><div><span>Montant des dons sans brioche</span><strong>{totalGifts.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</strong></div></div>
 {closed&&<div className="ob-counter-warning"><strong>Stand terminé le {new Date(closed.closedAt).toLocaleString('fr-FR')}</strong><p>Décompte figé : {closed.briochesTotal} brioches remises (dont {closed.briochesCompteur} au compteur). Ce résultat est disponible dans les fiches de caisse du même navigateur.</p></div>}
 <section><h2><PackageCheck size={20}/> Brioches distribuées</h2><p>Appuie à chaque distribution. Les brioches déjà déclarées sur la fiche du stand ({estimatedStart}) sont prises en compte dans le reste.</p>{(estimatedOnly||difference<0)&&<p className="ob-counter-warning">{estimatedOnly?'Aucune quantité initiale estimée : le compteur reste utilisable.':'Le décompte dépasse l’estimation initiale : vérifie la quantité mise à disposition dans la fiche du stand.'}</p>}<button className="ob-counter-primary" disabled={Boolean(closed)} onClick={()=>append('brioche',1)}><Plus/> 1 brioche</button><div className="ob-counter-buttons"><button disabled={Boolean(closed)} onClick={()=>append('brioche',5)}>+ 5 brioches</button><button disabled={Boolean(closed)} onClick={()=>append('brioche',10)}>+ 10 brioches</button></div></section>
 <section><h2><HeartHandshake size={20}/> Don sans brioche</h2><div className="ob-counter-fields"><label>Montant du don (€)<input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Mode de règlement<select value={method} onChange={e=>setMethod(e.target.value)}><option>Espèces</option><option>Carte bancaire</option><option>Chèque</option></select></label></div><button className="ob-counter-primary" disabled={Boolean(closed)||!Number.isFinite(Number(amount))||Number(amount)<=0} onClick={()=>append('don',0,Math.round(Number(amount)*100)/100)}>Enregistrer le don</button></section>
 <section><div className="ob-counter-history"><h2>Dernières opérations</h2><span className="ob-counter-hint">Modifier ou annuler une saisie</span></div>
 {ops.length?<ul className="ob-counter-operations">{[...ops].reverse().map(o=><li key={o.id}>
 <div className="ob-counter-operation-row"><span>{new Date(o.at).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})} · {o.kind==='brioche'?`${o.qty} brioche(s)`:`Don sans brioche · ${o.amount.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})} · ${o.method||'Non précisé'}`}</span><div className="ob-counter-operation-actions">{!closed&&<><button type="button" onClick={()=>startEdit(o)} aria-label="Modifier cette opération"><Pencil size={15}/> Modifier</button><button type="button" onClick={()=>{setEditing(null);setConfirmDelete(o.id)}} aria-label="Annuler cette opération"><Trash2 size={15}/> Annuler</button></>}</div></div>
 {editing===o.id&&<div className="ob-counter-edit"><strong>Corriger cette opération</strong>{o.kind==='brioche'?<label>Nombre de brioches<input type="number" min="1" step="1" value={editQty} onChange={e=>setEditQty(e.target.value)}/></label>:<div className="ob-counter-fields"><label>Montant (€)<input type="number" min="0.01" step="0.01" value={editAmount} onChange={e=>setEditAmount(e.target.value)}/></label><label>Mode de règlement<select value={editMethod} onChange={e=>setEditMethod(e.target.value)}><option>Espèces</option><option>Carte bancaire</option><option>Chèque</option></select></label></div>}<label>Motif de correction<select value={editReason} onChange={e=>setEditReason(e.target.value)}><option>Erreur de saisie</option><option>Double comptage</option><option>Correction après vérification</option></select></label><div className="ob-counter-edit-actions"><button type="button" onClick={()=>setEditing(null)}><X size={15}/> Fermer</button><button type="button" className="ob-counter-save" onClick={()=>saveEdit(o)}>Enregistrer la correction</button></div></div>}
 {confirmDelete===o.id&&<div className="ob-counter-confirm"><p>Annuler cette opération ? Elle sera retirée des totaux, mais sa trace sera conservée.</p><div className="ob-counter-edit-actions"><button type="button" onClick={()=>setConfirmDelete(null)}>Conserver</button><button type="button" className="ob-counter-danger" onClick={()=>recordChange(o,undefined,'suppression')}>Confirmer l'annulation</button></div></div>}
 </li>)}</ul>:<p>Aucune opération pour le moment.</p>}
 {audit.length>0&&<details className="ob-counter-audit"><summary>Historique des corrections ({audit.length})</summary><ul>{[...audit].reverse().map(a=><li key={a.id}>{new Date(a.at).toLocaleString('fr-FR')} · {a.action==='suppression'?'Annulation':'Modification'} · {a.before.kind==='brioche'?`${a.before.qty} brioche(s)${a.after?` → ${a.after.qty}`:''}`:`${a.before.amount.toFixed(2)} € (${a.before.method||'—'})${a.after?` → ${a.after.amount.toFixed(2)} € (${a.after.method||'—'})`:''}`}</li>)}</ul></details>}
 </section>
 <section className="ob-counter-close-section"><h2><PackageCheck size={20}/> Clôture du stand</h2>{closed?<p>Stand terminé. Les données sont figées en lecture seule.</p>:<><p>À la fin de la journée, valide le décompte. Le stand sera ensuite proposé dans une fiche de caisse de type « Stand ».</p><button type="button" className="ob-counter-primary" onClick={finishStand}>Terminer le stand</button></>}</section>
 {note&&<p role="status" className="ob-counter-feedback">{note}</p>}
 </main>
}
