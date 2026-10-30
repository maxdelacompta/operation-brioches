import { useMemo, useState, type ChangeEvent } from 'react'
import ExcelJS from 'exceljs'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import type { FicheCaisse, TypeFicheCaisse } from '../types/ob'
import './ImportMairiesExcel.css'

const NUMERIC = ['billets100', 'billets50', 'billets20', 'billets10', 'billets5', 'pieces2', 'pieces1', 'pieces050', 'pieces020', 'pieces010', 'pieces005', 'pieces002', 'pieces001', 'nbCheques', 'montantCheques', 'nbTpe', 'montantTpe', 'montantVirement', 'nbDons5', 'nbDons3', 'montantDonsAutres'] as const
const HEADERS = ['Numéro fiche','Campagne','Date (AAAA-MM-JJ)','Type','Libellé','Ville','Code postal','Secteur','ID donateur','ID commande',...NUMERIC,'Remarque']
type Preview = { line:number; value:FicheCaisse; action:'Créer'|'Mettre à jour'|'Erreur'; error?:string; existingId?:number }
const norm=(v:unknown)=>String(v??'').trim().toLocaleLowerCase('fr').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
function cellText(cell:ExcelJS.Cell): string {
  const v=cell.value
  if(v==null)return ''
  if(v instanceof Date)return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}-${String(v.getDate()).padStart(2,'0')}`
  if(typeof v==='object'){
    if('text' in v)return String(v.text??'').trim()
    if('result' in v)return String(v.result??'').trim()
    if('richText' in v)return v.richText.map(t=>t.text).join('').trim()
  }
  return String(v).trim()
}
function download(name:string,blob:Blob){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000)}
function parseNum(s:string){if(!s.trim())return 0;const n=Number(s.replace(/\s/g,'').replace(',','.'));return Number.isFinite(n)?n:NaN}
const TYPES:TypeFicheCaisse[]=['ENTREPRISE','MAIRIE','ETABLISSEMENT','STAND','AUTRE']
function parseRow(row:ExcelJS.Row): FicheCaisse {
  const c=(i:number)=>cellText(row.getCell(i))
  const rawType=c(4).toUpperCase()
  const fields=Object.fromEntries(NUMERIC.map((field,i)=>[field,parseNum(c(11+i))]))
  return {
    id:0, numero:c(1), campagne:c(2), date:c(3), type:(TYPES.includes(rawType as TypeFicheCaisse)?rawType:'AUTRE') as TypeFicheCaisse,
    libelle:c(5), ville:c(6), cp:c(7), secteur:c(8),
    ...(c(9)?{donateurId:parseNum(c(9))}:{}), ...(c(10)?{commandeId:parseNum(c(10))}:{}),
    ...fields,
    remarque:c(11+NUMERIC.length), statutCoffre:'A_CONTROLER',
  } as FicheCaisse
}
export default function ImportFichesCaisseExcel({fiches,onCommit,onClose}:{fiches:FicheCaisse[];onCommit:(rows:FicheCaisse[])=>void;onClose:()=>void}){
  const [rows,setRows]=useState<Preview[]>([])
  const [error,setError]=useState('')
  const [filename,setFilename]=useState('')
  const [loading,setLoading]=useState(false)
  const valid=useMemo(()=>rows.filter(r=>r.action!=='Erreur'),[rows])
  async function template(){
    const wb=new ExcelJS.Workbook();const sheet=wb.addWorksheet('FichesCaisse');sheet.addRow(HEADERS)
    sheet.columns=HEADERS.map(h=>({width:Math.max(15,Math.min(30,h.length+4))}))
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}
    sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123B79'}}
    sheet.views=[{state:'frozen',ySplit:1}]
    const buffer=await wb.xlsx.writeBuffer()
    download('modele-import-fiches-caisse.xlsx',new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
  }
  async function read(event:ChangeEvent<HTMLInputElement>){
    const file=event.target.files?.[0];if(!file)return
    setFilename(file.name);setRows([]);setError('');setLoading(true)
    try{
      if(!/\.xlsx$/i.test(file.name))throw new Error('Sélectionne un fichier .xlsx.')
      const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer())
      const sheet=wb.getWorksheet('FichesCaisse')??wb.worksheets[0]
      if(!sheet)throw new Error('Aucun onglet dans ce classeur.')
      const observed=HEADERS.map((_,i)=>norm(cellText(sheet.getRow(1).getCell(i+1))))
      if(!HEADERS.every((h,i)=>norm(h)===observed[i]))throw new Error('Colonnes non reconnues. Télécharge le modèle Fiches de caisse.')
      const seen=new Set<string>();const prepared:Preview[]=[]
      sheet.eachRow((row,index)=>{
        if(index===1||!row.hasValues)return
        const value=parseRow(row)
        const key=`${norm(value.campagne)}|${norm(value.numero)}`
        const existing=fiches.find(f=>`${norm(f.campagne)}|${norm(f.numero)}`===key)
        let reason=''
        if(!value.numero||!value.campagne||!/^\d{4}-\d{2}-\d{2}$/.test(value.date)||!value.libelle)reason='Numéro, campagne, date et libellé obligatoires.'
        else if(!TYPES.includes(cellText(row.getCell(4)).toUpperCase() as TypeFicheCaisse))reason='Type invalide (ENTREPRISE, MAIRIE, ETABLISSEMENT, STAND ou AUTRE).'
        else if(seen.has(key))reason='Numéro en doublon pour cette campagne dans le fichier.'
        else if(NUMERIC.some(field=>!Number.isFinite(value[field])||value[field]<0))reason='Montant ou quantité négative/invalide.'
        else if(NUMERIC.filter(field=>field.startsWith('billets')||field.startsWith('pieces')||field.startsWith('nb')).some(field=>!Number.isInteger(value[field])))reason='Quantité de billets, pièces ou dons non entière.'
        else if((value.donateurId!==undefined&&(!Number.isInteger(value.donateurId)||value.donateurId<=0))||(value.commandeId!==undefined&&(!Number.isInteger(value.commandeId)||value.commandeId<=0)))reason='Identifiant lié invalide.'
        seen.add(key)
        prepared.push({line:index,value,action:reason?'Erreur':existing?'Mettre à jour':'Créer',error:reason,existingId:existing?.id})
      })
      if(!prepared.length)throw new Error('Aucune fiche à importer.')
      setRows(prepared)
    }catch(e){setError(e instanceof Error?e.message:'Erreur de lecture Excel.')}finally{setLoading(false);event.target.value=''}
  }
  function commit(){
    if(!valid.length||rows.some(r=>r.action==='Erreur')||loading)return
    download(`sauvegarde-fiches-caisse-avant-import-${new Date().toISOString().slice(0,10)}.json`,new Blob([JSON.stringify(fiches,null,2)],{type:'application/json'}))
    if(!window.confirm(`Sauvegarde téléchargée. Importer ${valid.length} fiche(s) ? Attention : les fiches peuvent influer sur le suivi du coffre.`))return
    let nextId=fiches.reduce((m,f)=>Math.max(m,f.id),0)
    onCommit(valid.map(row=>row.existingId!==undefined?{...fiches.find(f=>f.id===row.existingId)!,...row.value,id:row.existingId}:{...row.value,id:++nextId}))
    onClose()
  }
  return <div className="mi-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="mi-dialog" role="dialog" aria-modal="true" aria-label="Import Excel Fiches de caisse">
    <header className="mi-header"><div><strong><FileSpreadsheet size={20}/> Import Excel — Fiches de caisse</strong><p>Administrateurs · import par numéro + campagne</p></div><button type="button" onClick={onClose} aria-label="Fermer"><X size={20}/></button></header>
    <div className="mi-body"><div className="mi-actions"><button type="button" onClick={template}><Download size={16}/> Télécharger le modèle</button><label className="mi-primary"><Upload size={16}/> Choisir un fichier .xlsx<input hidden type="file" accept=".xlsx" onChange={read}/></label></div>
      {filename&&<p className="mi-muted">Fichier : {filename}{loading?' · Lecture en cours…':''}</p>}
      {error&&<p className="mi-error" role="alert">{error}</p>}
      {rows.length>0&&<><div className="mi-counts"><strong>{rows.length} fiche(s)</strong><span>{rows.filter(r=>r.action==='Créer').length} création(s)</span><span>{rows.filter(r=>r.action==='Mettre à jour').length} mise(s) à jour</span><span>{rows.filter(r=>r.action==='Erreur').length} erreur(s)</span></div><div className="mi-scroll"><table><thead><tr><th>Ligne</th><th>Campagne</th><th>Numéro</th><th>Libellé</th><th>Action / contrôle</th></tr></thead><tbody>{rows.map(r=><tr key={r.line}><td>{r.line}</td><td>{r.value.campagne}</td><td>{r.value.numero}</td><td>{r.value.libelle}</td><td className={r.error?'mi-danger':''}>{r.error||r.action}</td></tr>)}</tbody></table></div></>}
      <p className="mi-muted">Les fiches absentes du fichier sont conservées. Les nouvelles fiches sont marquées « À contrôler ». Vérifie les montants et le coffre après import.</p>
    </div><footer className="mi-footer"><button type="button" onClick={onClose}>Annuler</button><button type="button" className="mi-primary" disabled={!valid.length||rows.some(r=>r.action==='Erreur')||loading} onClick={commit}>Importer {valid.length} fiche(s)</button></footer>
  </section></div>
}
