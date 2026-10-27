import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { ChevronLeft, ChevronRight, Download, FileUp, ScanLine, X, RotateCcw } from 'lucide-react'
import { init, DEFAULT_PDFIUM_WASM_URL } from '@embedpdf/pdfium'
import { PdfiumNative, PdfEngine } from '@embedpdf/engines/pdfium'
import { browserImageDataToBlobConverter } from '@embedpdf/engines/converters'
import './ScanCheques.css'
import { readChequesLocally, recognizeSelectedField } from './chequeOcr'
import type { SelectableChequeField } from './chequeOcr'

export type ScanCheque = { numero:string; emetteur:string; banque:string; montant:number; date:string; departement:string; signature:'Oui'|'Non'|'À vérifier'; fichier:string; image?:string }
type Page = { image:string; source:string; page:number; parts:number; pdfUrl?:string }
type Draft = Omit<ScanCheque,'montant'> & { montant:string }
type ImageMode = 'original'|'color'|'gray'|'bw'
type Rect = {x:number;y:number;w:number;h:number}
const today=()=>new Date().toLocaleDateString('en-CA')
const blank=(source=''):Draft=>({numero:'',emetteur:'',banque:'',montant:'',date:today(),departement:'',signature:'À vérifier',fichier:source})
const isLocal=(dept:string)=>['54','55','57','88'].includes(dept.trim())
function cropRect(image:HTMLImageElement, rect:Rect):string{
 const canvas=document.createElement('canvas')
 const x=Math.round(rect.x*image.naturalWidth), y=Math.round(rect.y*image.naturalHeight)
 const w=Math.min(image.naturalWidth-x,Math.round(rect.w*image.naturalWidth))
 const h=Math.min(image.naturalHeight-y,Math.round(rect.h*image.naturalHeight))
 canvas.width=Math.max(1,w);canvas.height=Math.max(1,h)
 canvas.getContext('2d')?.drawImage(image,x,y,w,h,0,0,canvas.width,canvas.height)
 return canvas.toDataURL('image/png')
}
const loadImage=(src:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src})

// Détection géométrique locale (sans OCR) : recherche de longues bandes
// horizontales sombres séparant les chèques. Le résultat reste modifiable.
async function detectChequeRects(imageUrl:string, expected?:number):Promise<{rects:Rect[];strong:boolean}>{
 const image=await loadImage(imageUrl)
 const width=600, height=Math.max(180,Math.round(image.naturalHeight*width/image.naturalWidth))
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
 const ctx=canvas.getContext('2d',{willReadFrequently:true})
 if(!ctx)throw new Error('Analyse du scan impossible.')
 ctx.drawImage(image,0,0,width,height)
 const rgba=ctx.getImageData(0,0,width,height).data
 const left=Math.floor(width*.12),right=Math.ceil(width*.88),scores:number[]=[]
 for(let y=0;y<height;y++){
  let dark=0, count=0
  for(let x=left;x<right;x+=2){
   const k=(y*width+x)*4
   if((rgba[k]+rgba[k+1]+rgba[k+2])/3<155)dark++
   count++
  }
  scores.push(dark/count)
 }
 const bands:{start:number;end:number}[]=[]
 let start=-1
 for(let y=0;y<=height;y++){
  const active=y<height&&scores[y]>.70
  if(active&&start<0)start=y
  if(!active&&start>=0){if(y-start>=Math.max(3,Math.round(height*.005)))bands.push({start,end:y});start=-1}
 }
 // Fusion des bandes rapprochées, filtre des lignes trop fines.
 const merged:{start:number;end:number}[]=[]
 for(const b of bands){const last=merged[merged.length-1];if(last&&b.start-last.end<height*.012)last.end=b.end;else merged.push({...b})}
 const separated=merged.filter(b=>b.end-b.start>=height*.009)
 const separators=separated.filter(b=>b.start>height*.09&&b.end<height*.93)
 const spaced:{start:number;end:number}[]=[]
 for(const b of separators){const prev=spaced[spaced.length-1];if(!prev||b.start-prev.start>height*.13)spaced.push(b)}
 const credible=spaced.length>=1&&spaced.length<=7&&spaced.every((b,i)=>i===0||b.start-spaced[i-1].start>height*.13)
 const count=credible?spaced.length+1:Math.max(1,Math.min(8,expected||1))
 const cuts=credible?[0,...spaced.map(b=>Math.max(0,b.start-2)),height]:Array.from({length:count+1},(_,i)=>Math.round(height*i/count))
 const rects:Rect[]=[]
 for(let i=0;i<cuts.length-1;i++){
  const a=Math.max(0,cuts[i]-1),b=Math.min(height,cuts[i+1]+1)
  rects.push({x:.005,y:a/height,w:.99,h:(b-a)/height})
 }
 return {rects,strong:credible}
}


// PDFium WebAssembly restitue les caractères et masques noirs du PDF.
// Le fichier PDF reste local : seul le moteur WASM est téléchargé au premier usage.
type RenderEngine = InstanceType<typeof PdfEngine>
let enginePromise:Promise<RenderEngine>|null=null
function getPdfiumEngine():Promise<RenderEngine>{
 if(!enginePromise){
  enginePromise=(async()=>{
   const response=await fetch(DEFAULT_PDFIUM_WASM_URL)
   if(!response.ok)throw new Error(`Chargement de PDFium impossible (${response.status}). Vérifie la connexion internet.`)
   const wasmBinary=await response.arrayBuffer()
   const module=await init({wasmBinary})
   return new PdfEngine(new PdfiumNative(module),{imageConverter:browserImageDataToBlobConverter})
  })().catch(err=>{enginePromise=null;throw err})
 }
 return enginePromise
}

export default function ScanCheques({onClose,onSave}:{onClose:()=>void;onSave:(items:ScanCheque[])=>string[]}){
 const [pages,setPages]=useState<Page[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[active,setActive]=useState(0)
 const [drafts,setDrafts]=useState<Draft[]>([]),[photos,setPhotos]=useState<string[]>([]),[saved,setSaved]=useState<string[]>([])
 const [pdfSources,setPdfSources]=useState<(string|null)[]>([])
 const [pdfPageNumbers,setPdfPageNumbers]=useState<number[]>([])
 const [showNativePdf,setShowNativePdf]=useState(false)
 const [capturePage,setCapturePage]=useState(0)
 const [rectangles,setRectangles]=useState<Record<number,Rect[]>>({})
 const [drawing,setDrawing]=useState<Rect|null>(null)
 const [detecting,setDetecting]=useState(false)
 const [detectionNotes,setDetectionNotes]=useState<Record<number,string>>({})
 const drawingStart=useRef<{x:number;y:number}|null>(null)
 const captureRef=useRef<HTMLDivElement|null>(null)
 const [recognizing,setRecognizing]=useState(false)
 const [ocrStatus,setOcrStatus]=useState('')
 const [ocrNotes,setOcrNotes]=useState<Record<number,string[]>>({})
 const [selectionField,setSelectionField]=useState<SelectableChequeField|null>(null)
 const [selectionRect,setSelectionRect]=useState<Rect|null>(null)
 const [selectionBusy,setSelectionBusy]=useState(false)
 const [selectionMessage,setSelectionMessage]=useState('')
 const selectionStart=useRef<{x:number;y:number}|null>(null)
 const selectionImageRef=useRef<HTMLImageElement|null>(null)
 const selectedChequeIndex=useRef(0)
 function chooseField(field:SelectableChequeField){
  setSelectionField(previous=>previous===field?null:field)
  setSelectionRect(null);setSelectionMessage('')
 }
 function positionOnCheque(e:PointerEvent<HTMLDivElement>){
  const img=selectionImageRef.current
  if(!img)return null
  const r=img.getBoundingClientRect()
  return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}
 }
 function startFieldSelection(e:PointerEvent<HTMLDivElement>){
  if(!selectionField||selectionBusy)return
  const point=positionOnCheque(e);if(!point)return
  selectedChequeIndex.current=active
  selectionStart.current=point
  setSelectionRect({x:point.x,y:point.y,w:0,h:0})
  e.currentTarget.setPointerCapture(e.pointerId)
 }
 function moveFieldSelection(e:PointerEvent<HTMLDivElement>){
  if(!selectionStart.current)return
  const point=positionOnCheque(e);if(!point)return
  const start=selectionStart.current
  setSelectionRect({x:Math.min(start.x,point.x),y:Math.min(start.y,point.y),w:Math.abs(point.x-start.x),h:Math.abs(point.y-start.y)})
 }
 async function endFieldSelection(e:PointerEvent<HTMLDivElement>){
  if(!selectionStart.current||!selectionField)return
  const point=positionOnCheque(e),start=selectionStart.current
  selectionStart.current=null
  if(!point)return
  const rect={x:Math.min(start.x,point.x),y:Math.min(start.y,point.y),w:Math.abs(point.x-start.x),h:Math.abs(point.y-start.y)}
  if(rect.w<.015||rect.h<.018){setSelectionRect(null);setSelectionMessage('Encadre une zone assez grande pour lire le texte.');return}
  setSelectionRect(rect);setSelectionBusy(true);setSelectionMessage('Lecture de la zone sélectionnée…')
  const field=selectionField,index=selectedChequeIndex.current
  try{
   const image=await loadImage(photos[index])
   const cut=cropRect(image,rect)
   const suggestion=await recognizeSelectedField(cut,field)
   if(suggestion.value){
    // Éviter d'écraser une saisie changée pendant l'opération sur un autre chèque.
    setDrafts(old=>old.map((item,i)=>i===index?{...item,[field]:suggestion.value}:item))
    setSelectionMessage(`Proposition : ${suggestion.value}. Tu peux la corriger manuellement.`)
   }else setSelectionMessage('Lecture incertaine. Sélectionne une zone plus grande ou renseigne le champ à la main.')
  }catch(err){setSelectionMessage(`Lecture impossible : ${err instanceof Error?err.message:'Erreur OCR'}. La saisie manuelle reste disponible.`)}
  finally{setSelectionBusy(false);setSelectionField(null)}
 }
 function setActiveCheque(i:number){setActive(i);setSelectionField(null);setSelectionRect(null);setSelectionMessage('')}
 function fieldButton(field:SelectableChequeField){
  return <button type="button" className={`sc-field-picker ${selectionField===field?'selected':''}`} title={`Sélectionner ${field} sur le chèque`} aria-label={`Sélectionner ${field} sur le chèque`} disabled={selectionBusy} onClick={()=>chooseField(field)}><ScanLine size={16}/></button>
 }

 async function runOcr(images=photos){
  if(!images.length)return
  setRecognizing(true)
  setOcrStatus('Initialisation de la lecture OCR…')
  setError('')
  try{
   const suggestions=await readChequesLocally(images,(index,total)=>setOcrStatus(`Lecture du chèque ${index}/${total}…`))
   setDrafts(previous=>previous.map((item,index)=>{
    const suggestion=suggestions[index]
    if(!suggestion)return item
    // Ne pas écraser les champs déjà vérifiés / modifiés manuellement.
    return {...item,
     banque:item.banque||suggestion.banque||'',
     montant:item.montant||suggestion.montant||'',
     numero:item.numero||suggestion.numero||'',
     emetteur:item.emetteur||suggestion.emetteur||'',
     departement:item.departement||suggestion.departement||'',
     date:suggestion.date||item.date
    }
   }))
   setOcrNotes(Object.fromEntries(suggestions.map((item,index)=>[index,item.observations])))
   setOcrStatus('Lecture terminée — vérifie les propositions avant enregistrement.')
  }catch(cause){
   setOcrStatus('Lecture OCR indisponible. Tu peux renseigner les champs manuellement.')
   setError(cause instanceof Error?`OCR : ${cause.message}`:'La reconnaissance OCR a échoué.')
  }finally{setRecognizing(false)}
 }
 const [imageMode,setImageMode]=useState<ImageMode>('original')
 const [contrast,setContrast]=useState(100),[brightness,setBrightness]=useState(100),[zoom,setZoom]=useState(100)
 const current=drafts[active]
 const scanFilter=imageMode==='original'?'none':`grayscale(${imageMode==='color'?0:100}%) contrast(${contrast}%) brightness(${brightness}%)`
 function resetImage(){setImageMode('original');setContrast(100);setBrightness(100);setZoom(100)}
 function chooseMode(mode:ImageMode){setImageMode(mode);setContrast(mode==='bw'?165:mode==='color'?115:100);setBrightness(100)}
 async function downloadEnhanced(){const url=photos[active];if(!url)return;try{const image=await loadImage(url);const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');if(!ctx)return;ctx.filter=scanFilter;ctx.drawImage(image,0,0);const link=document.createElement('a');link.download=`cheque-${active+1}-ameliore.png`;link.href=canvas.toDataURL('image/png');link.click()}catch{setError('Impossible de télécharger le scan amélioré.')}}
 const sourceUrls=useRef<string[]>([])
  useEffect(()=>()=>{for(const url of sourceUrls.current)URL.revokeObjectURL(url)},[])
 async function filesSelected(files:FileList|null){if(!files?.length)return;setBusy(true);setError('');setSaved([])
  try{const result:Page[]=[]
   for(const f of Array.from(files)){
    if(f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf')){
     const engine=await getPdfiumEngine()
     const pdfUrl=URL.createObjectURL(f);sourceUrls.current.push(pdfUrl)
     const document=await engine.openDocumentBuffer({
      id:`cheques-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      content:await f.arrayBuffer()
     }).toPromise()
     for(const [index,page] of document.pages.entries()){
      // PNG sans compression destructive, restitution du rendu complet avec PDFium.
      const render=await engine.renderPage(document,page,{
       scaleFactor:2.5, dpr:1, imageType:'image/png',withAnnotations:true
      }).toPromise()
      const imageUrl=URL.createObjectURL(render)
      sourceUrls.current.push(imageUrl)
      result.push({image:imageUrl,source:f.name,page:index+1,parts:1,pdfUrl})
     }
    }else if(f.type.startsWith('image/')){const imageUrl=URL.createObjectURL(f);sourceUrls.current.push(imageUrl);result.push({image:imageUrl,source:f.name,page:1,parts:1})}
   }
   if(!result.length)throw new Error('Sélectionne un PDF ou des images de chèques.');setPages(result);setDrafts([]);setPhotos([]);setActive(0);setRectangles({});setCapturePage(0);setDrawing(null);setDetectionNotes({})
   // Détection immédiate sur les pages importées ; chaque proposition reste éditable.
   if(result.length){setDetecting(true);try{const detected=await Promise.all(result.map(p=>detectChequeRects(p.image,p.parts)));setRectangles(Object.fromEntries(detected.map((d,i)=>[i,d.rects])));setPages(result.map((p,i)=>({...p,parts:detected[i].rects.length})));setDetectionNotes(Object.fromEntries(detected.map((d,i)=>[i,d.strong?`${d.rects.length} chèque(s) détecté(s) : vérifie les cadres.`:`Séparations non trouvées : ${d.rects.length} zone(s) proposées, à ajuster.`])))}catch{setDetectionNotes({0:"Détection indisponible : trace les cadres manuellement."})}finally{setDetecting(false)}}
  }catch(e){setError(e instanceof Error?e.message:'Import impossible. Vérifie le format du fichier.')}finally{setBusy(false)}
 }
 async function autoDetectPage(pageIndex:number, inputPages=pages){
  const page=inputPages[pageIndex];if(!page)return
  setDetecting(true);setError('')
  try{
   const result=await detectChequeRects(page.image,page.parts)
   setRectangles(old=>({...old,[pageIndex]:result.rects}))
   setPages(old=>old.map((p,i)=>i===pageIndex?{...p,parts:result.rects.length}:p))
   setDetectionNotes(old=>({...old,[pageIndex]:result.strong
    ?`${result.rects.length} chèque(s) proposé(s) à partir des bordures détectées. Vérifie les rectangles.`
    :`Bordures non identifiées : ${result.rects.length} zone(s) répartie(s) à titre indicatif. Corrige-les manuellement.`}))
  }catch(e){setError(e instanceof Error?e.message:'Détection automatique impossible.')}
  finally{setDetecting(false)}
 }
 function pointerPosition(e:PointerEvent<HTMLDivElement>){
  const bounds=e.currentTarget.getBoundingClientRect()
  return {x:Math.max(0,Math.min(1,(e.clientX-bounds.left)/bounds.width)),y:Math.max(0,Math.min(1,(e.clientY-bounds.top)/bounds.height))}
 }
 function startCapture(e:PointerEvent<HTMLDivElement>){
  if((rectangles[capturePage]?.length||0)>=(pages[capturePage]?.parts||0))return
  const at=pointerPosition(e);drawingStart.current=at;setDrawing({x:at.x,y:at.y,w:0,h:0});e.currentTarget.setPointerCapture(e.pointerId)
 }
 function moveCapture(e:PointerEvent<HTMLDivElement>){
  if(!drawingStart.current)return
  const at=pointerPosition(e),start=drawingStart.current
  setDrawing({x:Math.min(start.x,at.x),y:Math.min(start.y,at.y),w:Math.abs(at.x-start.x),h:Math.abs(at.y-start.y)})
 }
 function endCapture(e:PointerEvent<HTMLDivElement>){
  if(!drawingStart.current)return
  const at=pointerPosition(e),start=drawingStart.current
  const box={x:Math.min(start.x,at.x),y:Math.min(start.y,at.y),w:Math.abs(at.x-start.x),h:Math.abs(at.y-start.y)}
  drawingStart.current=null;setDrawing(null)
  if(box.w<.05||box.h<.04){setError('Trace un rectangle suffisamment grand autour du chèque.');return}
  setError('');setRectangles(old=>({...old,[capturePage]:[...(old[capturePage]||[]),box]}))
 }
 async function prepare(){setBusy(true);setError('');try{
   const next:Draft[]=[],imgs:string[]=[],sources:(string|null)[]=[],pageNumbers:number[]=[]
   for(let index=0;index<pages.length;index++){
    const page=pages[index], boxes=rectangles[index]||[]
    if(boxes.length!==page.parts)throw new Error(`Page ${page.page} : sélectionne ${page.parts} chèque(s) avant de continuer.`)
    const img=await loadImage(page.image)
    for(let i=0;i<boxes.length;i++){
     const source=`${page.source} — page ${page.page}, chèque ${i+1}/${boxes.length}`
     next.push(blank(source));imgs.push(cropRect(img,boxes[i]));sources.push(page.pdfUrl||null);pageNumbers.push(page.page)
    }
   }
   setDrafts(next);setPhotos(imgs);setPdfSources(sources);setPdfPageNumbers(pageNumbers);setActive(0);resetImage();setOcrNotes({});setOcrStatus('');void runOcr(imgs)
  }catch(e){setError(e instanceof Error?e.message:'Impossible de capturer les chèques.')}finally{setBusy(false)}
 }
 function change(patch:Partial<Draft>){setDrafts(old=>old.map((item,i)=>i===active?{...item,...patch}:item))}
 const done=useMemo(()=>drafts.filter(d=>d.numero.trim()&&d.banque.trim()&&Number(d.montant.replace(',','.'))>0&&d.emetteur.trim()&&d.departement.trim().length===2&&d.signature==='Oui').length,[drafts])
 function validate(){setError('');const ready:ScanCheque[]=[],issues:string[]=[]
  for(let i=0;i<drafts.length;i++){const d=drafts[i];const amount=Number(d.montant.replace(',','.'))
   if(!d.numero.trim()||!d.emetteur.trim()||!d.banque.trim()||!Number.isFinite(amount)||amount<=0||!/^\d{2}$/.test(d.departement.trim())||d.signature!=='Oui'){issues.push(`Chèque ${i+1} : champs incomplets, département invalide ou signature non confirmée.`);continue}
   ready.push({...d,montant:Math.round(amount*100)/100,departement:d.departement.trim(),image:photos[i]})
  }
  if(issues.length){setError(issues[0]+' Tous les chèques doivent être vérifiés avant enregistrement.');return}
  const duplicates=onSave(ready);if(duplicates.length){setError(`Doublon détecté : ${duplicates.join(', ')}. Aucun chèque importé.`);return}setSaved(ready.map(x=>x.numero))
 }
 return <div className="sc-backdrop"><section className="sc-panel" role="dialog" aria-modal="true" aria-label="Importer des chèques"><header className="sc-head"><div><span>GESTION DES CHÈQUES</span><h2>Importer et contrôler un lot</h2><p>Un PDF peut contenir plusieurs chèques. Découpe les pages, puis vérifie chaque ligne à partir du scan.</p></div><button className="sc-close" onClick={onClose} aria-label="Fermer"><X size={22}/></button></header>
  {!drafts.length?<div className="sc-content"><label className="sc-drop"><FileUp size={28}/><strong>{busy?'Lecture du fichier…':'Sélectionner des PDF ou images'}</strong><small>PDF multipages, JPG, PNG et WebP. Aucun fichier n'est envoyé à un serveur.</small><input type="file" multiple accept="application/pdf,image/*" disabled={busy} onChange={e=>filesSelected(e.target.files)}/></label>
   {pages.length>0&&<div className="sc-capture-workflow">
    <div className="sc-capture-top"><strong>1. Vérifie les chèques détectés automatiquement</strong><small>Les cadres sont proposés automatiquement : tu peux les supprimer et les retracer. Images PNG sans filtre.</small></div>
    <div className="sc-page-tabs">{pages.map((page,i)=><button type="button" key={i} className={capturePage===i?'selected':''} onClick={()=>{setCapturePage(i);setDrawing(null)}}>Page {page.page} · {(rectangles[i]||[]).length}/{page.parts}</button>)}</div>
    {pages[capturePage]&&<>
     <div className="sc-capture-toolbar"><label>Nombre de chèques sur cette page <select value={pages[capturePage].parts} onChange={e=>{const value=Number(e.target.value);setPages(old=>old.map((p,i)=>i===capturePage?{...p,parts:value}:p));setRectangles(old=>({...old,[capturePage]:(old[capturePage]||[]).slice(0,value)}))}}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
     <button type="button" className="sc-secondary" disabled={busy||detecting} onClick={()=>autoDetectPage(capturePage)}>{detecting?'Analyse…':'↻ Détecter automatiquement'}</button>
     <span>{(rectangles[capturePage]||[]).length===pages[capturePage].parts?'Toutes les captures sont réalisées':`Trace le rectangle du chèque ${(rectangles[capturePage]||[]).length+1}`}</span>
     <button type="button" className="sc-secondary" disabled={!(rectangles[capturePage]||[]).length} onClick={()=>setRectangles(old=>({...old,[capturePage]:(old[capturePage]||[]).slice(0,-1)}))}>Annuler la dernière capture</button>
     {pages[capturePage].pdfUrl&&<button type="button" className="sc-secondary" onClick={()=>window.open(pages[capturePage].pdfUrl,'_blank','noopener,noreferrer')}>Voir le PDF source</button>}</div>
     {detectionNotes[capturePage]&&<p className="sc-auto-note">{detectionNotes[capturePage]}</p>}
     <div className="sc-capture-scroller"><div ref={captureRef} className="sc-capture-canvas" onPointerDown={startCapture} onPointerMove={moveCapture} onPointerUp={endCapture} onPointerCancel={()=>{drawingStart.current=null;setDrawing(null)}}>
      <img src={pages[capturePage].image} draggable={false} alt={`Page ${pages[capturePage].page}, sélection des chèques`}/>
      {(rectangles[capturePage]||[]).map((box,i)=><div key={i} className="sc-capture-box" style={{left:`${box.x*100}%`,top:`${box.y*100}%`,width:`${box.w*100}%`,height:`${box.h*100}%`}}><span>Chèque {i+1}</span></div>)}
      {drawing&&<div className="sc-capture-box sc-capture-drawing" style={{left:`${drawing.x*100}%`,top:`${drawing.y*100}%`,width:`${drawing.w*100}%`,height:`${drawing.h*100}%`}}/>}
     </div></div>
    </>}
    <p className="sc-info">Le PDF original reste accessible pour vérifier les petites écritures. La zone sélectionnée est capturée depuis le rendu de la page ; si le lecteur PDF dégrade certains détails, la capture ne pourra pas les reconstituer.</p>
   </div>}
   <div className="sc-actions"><button className="sc-secondary" onClick={onClose}>Annuler</button><button className="sc-primary" disabled={busy||detecting||!pages.length} onClick={prepare}><ScanLine size={17}/> Vérifier les captures</button></div></div>:<div className="sc-workspace"><aside className="sc-sidebar"><h3>Chèques du lot <span>{done}/{drafts.length} vérifiés</span></h3>{drafts.map((d,i)=><button key={i} className={i===active?'active':''} onClick={()=>setActiveCheque(i)}><span>{i+1}. {d.numero||'À renseigner'}</span><small>{d.banque||'Banque inconnue'} · {d.montant?`${d.montant} €`:'Montant à saisir'}</small></button>)}</aside><div className="sc-detail"><div className="sc-ocr-box"><div><strong>Lecture automatique (OCR)</strong><small>{ocrStatus||'Les propositions doivent être vérifiées sur le chèque original, en particulier le montant et le numéro.'}</small></div><button type="button" className="sc-secondary" disabled={recognizing} onClick={()=>void runOcr()}>{recognizing?'Lecture en cours…':'↻ Relancer la lecture'}</button>{!!ocrNotes[active]?.length&&<details><summary>Champs restant à vérifier</summary><ul>{ocrNotes[active].map((note,i)=><li key={i}>{note}</li>)}</ul></details>}</div><div className="sc-enhance" aria-label="Amélioration du scan"><div className="sc-enhance-top"><strong>Lisibilité du chèque</strong><span>Le scan original est conservé</span></div><div className="sc-mode-buttons" role="group" aria-label="Mode de lecture"><button type="button" className={imageMode==='original'?'selected':''} onClick={()=>chooseMode('original')}>Original (sans filtre)</button><button type="button" className={imageMode==='color'?'selected':''} onClick={()=>chooseMode('color')}>Couleur améliorée</button><button type="button" className={imageMode==='gray'?'selected':''} onClick={()=>chooseMode('gray')}>Niveaux de gris</button><button type="button" className={imageMode==='bw'?'selected':''} onClick={()=>chooseMode('bw')}>Noir et blanc</button></div><div className="sc-enhance-sliders"><label>Contraste <output>{contrast}%</output><input type="range" min="80" max="200" step="5" value={contrast} onChange={e=>setContrast(Number(e.target.value))}/></label><label>Luminosité <output>{brightness}%</output><input type="range" min="65" max="155" step="5" value={brightness} onChange={e=>setBrightness(Number(e.target.value))}/></label><label>Zoom <output>{zoom}%</output><input type="range" min="100" max="250" step="25" value={zoom} onChange={e=>setZoom(Number(e.target.value))}/></label></div><div className="sc-enhance-bottom"><button type="button" onClick={resetImage}><RotateCcw size={14}/> Réinitialiser</button><button type="button" onClick={downloadEnhanced}><Download size={14}/> Exporter ce chèque amélioré</button></div></div><div className="sc-native-choice"><strong>Lecture du document</strong>{pdfSources[active]&&<><a href={pdfSources[active]!} target="_blank" rel="noopener noreferrer" className="sc-open-pdf">Ouvrir le PDF original dans un nouvel onglet ↗</a><span className="sc-native-hint">Le lecteur PDF intégré ne fonctionne pas dans tous les navigateurs. L’image découpée reste disponible ci-dessous.</span></>}</div><div className={`sc-image ${selectionField?'sc-image-selecting':''}`}><div className="sc-select-area" style={{width:`${zoom}%`}} onPointerDown={startFieldSelection} onPointerMove={moveFieldSelection} onPointerUp={e=>void endFieldSelection(e)} onPointerCancel={()=>{selectionStart.current=null;setSelectionRect(null)}}><img ref={selectionImageRef} src={photos[active]} style={{filter:scanFilter,width:'100%',maxWidth:'none'}} draggable={false} alt={`Chèque ${active+1}, extrait du scan`}/>{selectionRect&&<div className="sc-field-selection-rect" style={{left:`${selectionRect.x*100}%`,top:`${selectionRect.y*100}%`,width:`${selectionRect.w*100}%`,height:`${selectionRect.h*100}%`}}/>}</div></div>{selectionField&&<p className="sc-select-instruction">Encadre sur le chèque la zone « {selectionField} ». <button type="button" onClick={()=>chooseField(selectionField)}>Annuler</button></p>}{selectionMessage&&<p className="sc-selection-message" role="status">{selectionMessage}</p>}<p className="sc-tip">Commence par le mode Original (sans filtre). Compare ensuite les autres modes pour lire le numéro, le montant et la signature. Les filtres sont uniquement visuels et ne remplacent pas la vérification du chèque original.</p><div className="sc-fields"><label>Banque *<span className="sc-input-with-pick"><input value={current.banque} onChange={e=>change({banque:e.target.value})} placeholder="Crédit Mutuel"/>{fieldButton('banque')}</span></label><label>Montant (€) *<span className="sc-input-with-pick"><input inputMode="decimal" value={current.montant} onChange={e=>change({montant:e.target.value})} placeholder="40,00"/>{fieldButton('montant')}</span></label><label>Numéro du chèque *<span className="sc-input-with-pick"><input value={current.numero} onChange={e=>change({numero:e.target.value})}/>{fieldButton('numero')}</span></label><label>Libellé / titulaire *<span className="sc-input-with-pick"><input value={current.emetteur} onChange={e=>change({emetteur:e.target.value})}/>{fieldButton('emetteur')}</span></label><label>Département de l'agence bancaire *<span className="sc-input-with-pick"><input maxLength={2} inputMode="numeric" value={current.departement} onChange={e=>change({departement:e.target.value.replace(/\D/g,'').slice(0,2)})} placeholder="54"/>{fieldButton('departement')}</span></label><label>Signature sur le chèque *<select value={current.signature} onChange={e=>change({signature:e.target.value as Draft['signature']})}><option>À vérifier</option><option>Oui</option><option>Non</option></select></label><label>Date du chèque<span className="sc-input-with-pick"><input type="date" value={current.date} onChange={e=>change({date:e.target.value})}/>{fieldButton('date')}</span></label><div className="sc-classification">{current.departement.length===2?isLocal(current.departement)?'SUR PLACE · 54 / 55 / 57 / 88':'HORS PLACE · autre département':'Sur place / Hors place : département à renseigner'}</div></div><div className="sc-actions"><button className="sc-secondary" disabled={active===0} onClick={()=>setActiveCheque(active-1)}><ChevronLeft size={16}/> Précédent</button><button className="sc-secondary" disabled={active===drafts.length-1} onClick={()=>setActiveCheque(active+1)}>Suivant <ChevronRight size={16}/></button></div></div></div>}
   {error&&<p className="sc-error" role="alert">{error}</p>}{saved.length>0&&<p className="sc-success">{saved.length} chèque(s) enregistré(s) dans le registre. Tu peux fermer cette fenêtre.</p>}
   {!!drafts.length&&<footer className="sc-footer"><small>Les images ne sont pas archivées. Seules les informations validées sont enregistrées localement.</small><button className="sc-secondary" onClick={onClose}>Fermer</button><button className="sc-primary" disabled={saved.length>0} onClick={validate}>Enregistrer les {drafts.length} chèques vérifiés</button></footer>}
 </section></div>
}
