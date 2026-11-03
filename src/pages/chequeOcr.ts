/** Lecture indicative locale des chèques. Les propositions doivent être vérifiées. */
import { createWorker } from 'tesseract.js'

export type ChequeSuggestion = {
  banque?: string; montant?: string; numero?: string; emetteur?: string
  departement?: string; date?: string; observations: string[]
}
type Region = {x:number;y:number;w:number;h:number}
const regions = {
  bank:{x:.005,y:.005,w:.60,h:.37},
  amount:{x:.69,y:.22,w:.305,h:.42},
  date:{x:.69,y:.37,w:.305,h:.43},
  number:{x:.015,y:.40,w:.75,h:.57},
  holder:{x:.29,y:.35,w:.57,h:.46},
  agency:{x:.015,y:.35,w:.49,h:.48},
} satisfies Record<string,Region>
function normalized(t:string){return t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()}
function crop(im:HTMLImageElement,r:Region,enhance=false){
  const cv=document.createElement('canvas'),x=Math.round(im.naturalWidth*r.x),y=Math.round(im.naturalHeight*r.y)
  cv.width=Math.max(1,Math.round(im.naturalWidth*r.w));cv.height=Math.max(1,Math.round(im.naturalHeight*r.h))
  const ctx=cv.getContext('2d');if(!ctx)throw new Error('Canvas indisponible')
  if(enhance)ctx.filter='grayscale(100%) contrast(145%)'
  ctx.drawImage(im,x,y,cv.width,cv.height,0,0,cv.width,cv.height)
  return cv
}
const imageFrom=(src:string)=>new Promise<HTMLImageElement>((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=src})
function bankFrom(t:string){
 const s=normalized(t).replace(/\s+/g,' ')
 if(/CREDIT\s*MUTUEL|\bCCM\b/.test(s))return 'Crédit Mutuel'
 if(/BANQUE\s*POSTALE|\bLA\s+POSTALE\b|\bPOSTALE\b/.test(s))return 'La Banque Postale'
 if(/CREDIT\s*AGRICOLE/.test(s))return 'Crédit Agricole'
 if(/CAISSE\s*D.?EPARGNE/.test(s))return "Caisse d'Épargne"
 if(/SOCIETE\s*GENERALE/.test(s))return 'Société Générale'
 if(/BNP\s*PARIBAS/.test(s))return 'BNP Paribas'
 if(/BANQUE\s*POPULAIRE/.test(s))return 'Banque Populaire'
 if(/\bCIC\b/.test(s))return 'CIC'
 if(/\bLCL\b/.test(s))return 'LCL'
 return undefined
}
function amountFrom(t:string){
 // N'accepter que les montants avec deux décimales dans la case en haut à droite.
 const cleaned=t.replace(/\s+/g,'').replace(/[oO]/g,'0')
 const results=[...cleaned.matchAll(/(?:^|[^\d])([0-9]{1,5})[,.]([0-9]{2})(?!\d)/g)]
   .map(m=>`${Number(m[1])},${m[2]}`).filter(s=>Number(s.replace(',','.'))>0)
 const distinct=[...new Set(results)]
 return distinct.length===1?distinct[0]:undefined
}
function dateFrom(t:string){
 const m=t.match(/\b([0-3]?\d)[/.-]([01]?\d)[/.-](20\d\d|\d\d)\b/)
 if(!m)return undefined
 const iso=`${m[3].length===2?'20'+m[3]:m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
 const d=new Date(`${iso}T12:00:00`)
 return !Number.isNaN(d.getTime())&&d.toISOString().startsWith(iso)?iso:undefined
}
function numberFrom(t:string){
 // Conserver la règle qui fonctionnait déjà ; ne pas confondre avec la ligne CMC7.
 const m=t.match(/(?:CH[EÈÉ]QUE|CHEQUE|CHQ)\s*(?:N[°O.]?\s*[:.]?\s*)?([\d\s]{6,12}[A-Z]?)/i)
 if(!m)return undefined
 const n=m[1].replace(/\s+/g,'').trim()
 return /^\d{6,10}[A-Z]?$/.test(n)?n:undefined
}
function holderFrom(t:string){
 const lines=normalized(t).split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim())
 const re=/^(?:MR|M\.|MME|MLLE|MLE|MONSIEUR|MADAME|M\s|MOU)\s+([A-Z][A-Z\s'-]{4,})$/
 const possibles=lines.map(s=>s.match(re)?.[1]?.trim()).filter((s):s is string=>!!s&&s.length<=55)
 return [...new Set(possibles)].length===1?possibles[0]:undefined
}
function deptFrom(t:string,bank?:string){
 const s=normalized(t)
 // Pour la Banque Postale, le numéro du centre contient parfois le département (64).
 if(bank==='La Banque Postale'){
  const center=s.match(/CENTRE\s+DE\s+[A-Z\s'-]{2,35}\s*\((\d{2})\)/)
  if(center)return center[1]
 }
 // Seulement la zone de l'agence (« Payable en France »), jamais l'adresse du titulaire.
 const postcode=[...s.matchAll(/\b(\d{2})\d{3}\b/g)].map(m=>m[1]).filter(x=>Number(x)>=1&&Number(x)<=95)
 const unique=[...new Set(postcode)]
 return unique.length===1?unique[0]:undefined
}
/** La signature n'est jamais déclarée valide automatiquement. */
export async function readChequesLocally(images:string[],progress:(current:number,total:number)=>void):Promise<ChequeSuggestion[]>{
 const worker=await createWorker('fra')
 try{
  const output:ChequeSuggestion[]=[]
  for(let index=0;index<images.length;index++){
   progress(index+1,images.length)
   const im=await imageFrom(images[index])
   const recognize=async(r:Region,enhance=false)=>(await worker.recognize(crop(im,r,enhance))).data.text
   // Les zones spécialisées évitent de confondre adresse bancaire et adresse du titulaire.
   const bankText=await recognize(regions.bank)
   const banque=bankFrom(bankText)
   // Un worker Tesseract unique : traitements séquentiels pour éviter les collisions de requêtes.
   const amountText=await recognize(regions.amount,true)
   const dateText=await recognize(regions.date,true)
   const numberText=await recognize(regions.number)
   const holderText=await recognize(regions.holder)
   const agencyText=await recognize(regions.agency)
   const montant=amountFrom(amountText)
   const numero=numberFrom(numberText)
   const emetteur=holderFrom(holderText)
   const departement=deptFrom(agencyText,banque)
   const date=dateFrom(dateText)
   const observations:string[]=[]
   for(const [label,value] of Object.entries({Banque:banque,Montant:montant,Numéro:numero,Titulaire:emetteur,Département:departement,Date:date})){
    if(!value)observations.push(`${label} : lecture incertaine, à renseigner ou confirmer`)
   }
   observations.push('Signature : contrôle visuel obligatoire')
   output.push({banque,montant,numero,emetteur,departement,date,observations})
  }
  return output
 }finally{await worker.terminate()}
}

export type SelectableChequeField = 'banque'|'montant'|'numero'|'emetteur'|'departement'|'date'
/** OCR d'une zone choisie par l'utilisateur. Jamais d'enregistrement automatique. */
export async function recognizeSelectedField(image:string,field:SelectableChequeField):Promise<{value:string;raw:string}>{
 const worker=await createWorker('fra')
 try{
  const result=await worker.recognize(image)
  const raw=result.data.text.trim()
  const plain=raw.replace(/\s+/g,' ').trim()
  let value=''
  if(field==='banque')value=bankFrom(raw)||plain
  else if(field==='montant'){
   value=amountFrom(raw)||''
   if(!value){
    const m=plain.replace(/[oO]/g,'0').match(/(?:^|\D)(\d{1,6})(?:[,.](\d{1,2}))?(?:\s*€|$)/)
    if(m)value=`${Number(m[1])},${(m[2]||'00').padEnd(2,'0')}`
   }
  }
  else if(field==='numero'){
   value=numberFrom(raw)||''
   if(!value){const m=plain.match(/\b\d{6,10}\s*[A-Z]?\b/);value=m?m[0].replace(/\s+/g,''):''}
  }
  else if(field==='departement'){
   const center=normalized(raw).match(/\((\d{2})\)/)
   const cp=normalized(raw).match(/\b(\d{2})\d{3}\b/)
   value=center?.[1]||cp?.[1]||(/^\d{2}$/.test(plain)?plain:'')
  }
  else if(field==='date') value=dateFrom(raw)||''
  else if(field==='emetteur') value=holderFrom(raw)||plain.split(/\s{2,}|\n/)[0].trim()
  return {value,raw}
 }finally{await worker.terminate()}
}
