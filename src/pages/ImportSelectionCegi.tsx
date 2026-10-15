import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { FileUp, X, ArrowRight, ArrowLeft, Check, AlertTriangle } from 'lucide-react'
import type { CommandeArtisan, Fournisseur } from '../types/artisans'
import { argent, montantCommande } from '../types/artisans'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import './ImportSelectionCegi.css'
import { conserverCegi } from '../lib/cegiDocuments'

export type CegiOperation = {
  id: string
  source: string
  beneficiaire: string
  compte: string
  piece: string
  libelle: string
  datePiece: string
  echeance: string
  montant: number
  mode: string
  referenceListe: string
  categorie: 'ACHAT_BRIOCHES' | 'TRANSPORT' | 'COMMUNICATION' | 'MATERIEL' | 'AUTRE'
  fournisseurId: string
  commandeIds: string[]
  traitement: 'a_verifier' | 'ignoree'
}

type Props = {
  fournisseurs: Fournisseur[]
  commandes: CommandeArtisan[]
  onClose: () => void
  onSave: (operation: CegiOperation) => string | null
  onArchived?: () => void
}
const cat: Record<CegiOperation['categorie'], string> = { ACHAT_BRIOCHES: 'Achats de brioches', TRANSPORT: 'Transport / logistique', COMMUNICATION: 'Communication', MATERIEL: 'Matériel', AUTRE: 'Autre dépense' }
const norm = (v:string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const amount = (v:string) => Number(v.replace(/\s/g,'').replace(',','.'))
const toISO = (v:string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); return m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
const opId = (source:string, row:string) => `${source}:${row}`
const somme = (items:CegiOperation[]) => Math.round(items.reduce((v,o)=>v+o.montant,0)*100)/100
const formatMoney = (v:number) => new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(v)

// Recherche ciblée sur les sélections de virement CEGI. Chaque ligne est revalidée par l'utilisateur.
export function analyserSelectionCegi(text:string, source:string): CegiOperation[] {
  const lines=text.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean)
  const joined=lines.join('\n')
  const ref=/Pi[eè]ce\s*n[°o]?\s*([\w\-/]+)/i.exec(joined)?.[1] ?? ''
  const operations:CegiOperation[]=[]
  let dernierBeneficiaire=''
  let dernierCompte=''
  for(let i=0;i<lines.length;i++) {
    const line=lines[i]
    const identity=/^([A-Z]?\d{6,})\s+(.{3,})$/.exec(line)
    if(identity && !/\bTOTAL\b|\bBANQUE\b/i.test(identity[2])) { dernierCompte=identity[1]; dernierBeneficiaire=identity[2]; continue }
    // Date pièce, pièce comptable, libellé, référence, date d'échéance, dossier et crédit.
    const match=/^(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(.+?)\s+(\d{2}-[A-Z0-9-]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2})\s+([\d\s.,]+)$/.exec(line)
    if(!match) continue
    const valeur=amount(match[7]); if(!Number.isFinite(valeur)||valeur<=0) continue
    operations.push({id:opId(source,`${i}-${match[2]}-${valeur}`),source,beneficiaire:dernierBeneficiaire||'Bénéficiaire à renseigner',compte:dernierCompte,piece:match[2],libelle:match[3],datePiece:toISO(match[1]),echeance:toISO(match[5]),montant:valeur,mode:'Virement',referenceListe:ref,categorie:'AUTRE',fournisseurId:'',commandeIds:[],traitement:'a_verifier'})
  }
  return operations
}

export default function ImportSelectionCegi({fournisseurs,commandes,onClose,onSave,onArchived}:Props){
 const [files,setFiles]=useState<File[]>([])
 const [operations,setOperations]=useState<CegiOperation[]>([])
 const [idx,setIdx]=useState(0)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [done,setDone]=useState<string[]>([])
 const [drag,setDrag]=useState(false)
 const [checks,setChecks]=useState<string[]>([])
 const input=useRef<HTMLInputElement>(null)
 const current=operations[idx]
 const supplier = current?.fournisseurId
 const choices=commandes.filter(c=>supplier && c.artisanId===supplier)
 function update(partial:Partial<CegiOperation>){setOperations(old=>old.map((op,i)=>i===idx?{...op,...partial}:op))}
 async function importFiles(uploaded:File[]){
  const pdfs=uploaded.filter(f=>f.name.toLowerCase().endsWith('.pdf'))
  if(!pdfs.length){setError('Sélectionne un ou plusieurs PDF CEGI.');return}
  setBusy(true);setError('')
  try {
   // Installer pdfjs-dist pour lire les PDF textuels directement dans le navigateur.
   const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs')
   pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl
   const next:CegiOperation[]=[]
   const warnings:string[]=[]
   for(const file of pdfs){
    const loadingTask=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true,disableFontFace:true})
    const pdfDocument=await loadingTask.promise
    let content=''
    for(let p=1;p<=pdfDocument.numPages;p++){
     const page=await pdfDocument.getPage(p)
     const text=await page.getTextContent()
     const rows=new Map<number,{x:number;text:string}[]>()
     for(const item of text.items){if(!('str' in item))continue;const y=Math.round(item.transform[5]/3)*3;const row=rows.get(y)||[];row.push({x:item.transform[4],text:item.str});rows.set(y,row)}
     content += [...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,row])=>row.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ')).join('\n')+'\n'
    }
    const found=analyserSelectionCegi(content,file.name)
    const totalGeneral=/TOTAL\s+GENERAL\s+([\d\s]+,\d{2})/i.exec(content)?.[1]
    const totalAttendu=totalGeneral ? amount(totalGeneral) : null
    const montantLu=somme(found)
    if(totalAttendu!==null && Math.abs(totalAttendu-montantLu)>0.01) warnings.push(`${file.name} : montant de la liste ${formatMoney(totalAttendu)}, mais ${formatMoney(montantLu)} extrait sur ${found.length} opération(s). Contrôle les lignes absentes avant de valider.`)
    // Conserver le PDF source, même si aucune correspondance fournisseur n’est trouvée.
    await conserverCegi(file, found.length, montantLu)
    onArchived?.()
    next.push(...found.map(row=>{
      const f=fournisseurs.find(f=>norm(row.beneficiaire).includes(norm(f.nom))||norm(f.nom).includes(norm(row.beneficiaire)))
      return {...row,fournisseurId:f?.id||'',categorie:f?'ACHAT_BRIOCHES' as const:'AUTRE' as const}
    }))
    // La méthode destroy appartient à la tâche de chargement pdfjs-dist.
    // Selon la version, elle peut être absente sur l'objet document PDF.
    if (typeof loadingTask.destroy === 'function') await loadingTask.destroy()
   }
   if(!next.length)throw new Error('Aucune opération reconnue. Vérifie que le PDF contient du texte sélectionnable et une liste CEGI standard. Aucune donnée n’a été enregistrée.')
   const seen=new Set(operations.map(o=>o.id)); const unique=next.filter(o=>!seen.has(o.id)&&!!seen.add(o.id))
   setOperations(old=>[...old,...unique]);setFiles(old=>[...old,...pdfs]);setChecks(old=>[...old,...warnings]);setIdx(0)
  }catch(e){setError(e instanceof Error?e.message:'Lecture du PDF impossible.')}finally{setBusy(false)}
 }
 const upload=(e:ChangeEvent<HTMLInputElement>)=>{void importFiles([...e.target.files||[]]);e.target.value=''}
 const drop=(e:DragEvent)=>{e.preventDefault();setDrag(false);void importFiles([...e.dataTransfer.files])}
 const saved=done.includes(current?.id||'')
 const duplicate=operations.filter(o=>o.piece===current?.piece&&o.beneficiaire===current?.beneficiaire).length>1
 const totalSelection=current?.commandeIds.reduce((s,id)=>s+montantCommande(commandes.find(c=>c.id===id)!),0)||0
 return <div className="cegi-overlay"><section className="cegi-modal" role="dialog" aria-modal="true" aria-label="Importer une liste CEGI"><header><div><h2>Importer une sélection CEGI</h2><p>Dépose des listes de virement, puis valide chaque opération.</p></div><button onClick={onClose} aria-label="Fermer"><X size={20}/></button></header>
 <div className={`cegi-drop ${drag?'drag':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={drop} onClick={()=>input.current?.click()} role="button" tabIndex={0} onKeyDown={e=>e.key==='Enter'&&input.current?.click()}><FileUp size={25}/><b>Glisser-déposer des listes PDF CEGI</b><span>ou cliquer pour choisir un ou plusieurs fichiers</span><input ref={input} type="file" accept="application/pdf,.pdf" multiple hidden onChange={upload}/></div>
 {busy&&<p>Lecture des documents en cours…</p>}{error&&<p className="cegi-error" role="alert">{error}</p>}
 {files.length>0&&<p className="cegi-small">Documents lus : {files.map(f=>f.name).join(', ')} · {operations.length} opération(s) détectée(s) · {done.length} enregistrée(s) · Total détecté : {formatMoney(somme(operations))}</p>}
 {checks.map((message,i)=><p key={i} className="cegi-warning cegi-check"><AlertTriangle size={16}/>{message}</p>)}
 {operations.length>0&&<div className="cegi-operations"><strong>Opérations détectées — clique pour vérifier chacune</strong><div className="cegi-operations-list">{operations.map((op,i)=><button type="button" key={op.id} className={i===idx?'active':''} onClick={()=>{setIdx(i);setError('')}}><span>{done.includes(op.id)?'✓ ':''}{i+1}. {op.beneficiaire} · {op.piece}</span><b>{formatMoney(op.montant)}</b><small>{done.includes(op.id)?'Enregistrée':'À contrôler'}</small></button>)}</div></div>}
 {current&&<div className="cegi-review"><h3>Opération {idx+1} sur {operations.length} {saved&&<span className="cegi-saved"><Check size={14}/> Enregistrée</span>}</h3><div className="cegi-facts"><div><small>Bénéficiaire extrait</small><strong>{current.beneficiaire}</strong></div><div><small>Montant extrait</small><strong>{argent(current.montant)}</strong></div><div><small>Pièce / échéance</small><strong>{current.piece} · {current.echeance||'—'}</strong></div><div><small>Liste CEGI</small><strong>{current.referenceListe||current.source}</strong></div></div>{duplicate&&<p className="cegi-warning"><AlertTriangle size={15}/> Une référence semblable apparaît plusieurs fois : contrôle avant enregistrement.</p>}
 <div className="cegi-fields"><label>Bénéficiaire (corrigeable)<input value={current.beneficiaire} disabled={saved} onChange={e=>update({beneficiaire:e.target.value})}/></label><label>Fournisseur à rapprocher<select disabled={saved} value={current.fournisseurId} onChange={e=>update({fournisseurId:e.target.value,commandeIds:[]})}><option value="">Autre bénéficiaire / non trouvé</option>{fournisseurs.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}</select></label><label>Catégorie de dépense<select disabled={saved} value={current.categorie} onChange={e=>update({categorie:e.target.value as CegiOperation['categorie']})}>{Object.entries(cat).map(([v,label])=><option key={v} value={v}>{label}</option>)}</select></label><label>Montant TTC<input disabled={saved} type="number" min="0.01" step="0.01" value={current.montant} onChange={e=>update({montant:Number(e.target.value)})}/></label></div>
 <fieldset><legend>Commandes associées (facultatif)</legend>{!choices.length?<p className="cegi-small">Sélectionne un fournisseur pour voir ses commandes. Si aucune ne correspond, l'opération peut être enregistrée sans commande.</p>:<div className="cegi-orders">{choices.map(c=><label key={c.id}><input type="checkbox" checked={current.commandeIds.includes(c.id)} disabled={saved} onChange={e=>update({commandeIds:e.target.checked?[...current.commandeIds,c.id]:current.commandeIds.filter(x=>x!==c.id)})}/>{c.numero} — {argent(montantCommande(c))}</label>)}</div>}{current.commandeIds.length>0&&<p className="cegi-small">Commandes sélectionnées : {argent(totalSelection)} — à rapprocher avec le montant de la sélection avant validation.</p>}</fieldset>
 <p className="cegi-warning"><AlertTriangle size={15}/> Règle OB2026 : en validant cette opération, tu la déclares payée sur la base de la sélection CEGI. Le rapprochement bancaire reste une vérification distincte.</p>
 <footer><button className="cegi-secondary" disabled={idx===0} onClick={()=>setIdx(i=>i-1)}><ArrowLeft size={16}/> Précédent</button><button className="cegi-primary" disabled={saved||!current.beneficiaire.trim()||current.montant<=0} onClick={()=>{const problem=onSave(current);if(problem)setError(problem);else{setError('');setDone(old=>[...old,current.id]);if(idx<operations.length-1)setIdx(i=>i+1)}}}><Check size={16}/> {saved?'Enregistrée':'Déclarer payée et enregistrer'}</button><button className="cegi-secondary" disabled={idx===operations.length-1} onClick={()=>{setError('');setIdx(i=>i+1)}}>Suivant <ArrowRight size={16}/></button></footer>
 </div>}
 </section></div>
}
