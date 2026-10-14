import { useMemo, useState, type ChangeEvent } from 'react'
import ExcelJS from 'exceljs'
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react'
import type { Mairie, NouvelleMairie, ParticipationMairie } from '../types/mairies'
import './ImportMairiesExcel.css'

const HEADERS = ['Code mairie', 'Commune', "Nom d'affichage", 'Code INSEE', 'Secteur', 'Numéro de voie', 'Adresse', 'Code postal', 'Ville', 'Prénom contact', 'Nom contact', 'Fonction contact', 'Email', 'Téléphone', 'Participation', 'Brioches N-1', 'Mode de règlement', 'Lieu / informations', 'Notes', 'Statut']
type Preview = { line: number; value: NouvelleMairie; action: 'Créer' | 'Mettre à jour' | 'Erreur'; error?: string; existingId?: string }
const normalize = (s: unknown) => String(s ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const text = (cell: ExcelJS.Cell) => {
  const v = cell.value
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    if ('text' in v) return String(v.text ?? '').trim()
    if ('result' in v) return String(v.result ?? '').trim()
    if ('richText' in v) return v.richText.map(item => item.text).join('').trim()
  }
  return String(v).trim()
}
const typeParticipation = (v: string): ParticipationMairie => {
  const n = normalize(v)
  if (['oui','o','yes','participante'].includes(n)) return 'OUI'
  if (['non','n','no'].includes(n)) return 'NON'
  return 'A_CONTACTER'
}
function dl(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function blank(code: string): NouvelleMairie {
  return {code, statut:'ACTIVE',commune:'',nomAffiche:'',codeInsee:'',secteur:'',numeroVoie:'',adresse:'',cp:'',ville:'',contactNom:'',contactPrenom:'',contactFonction:'',email:'',telephone:'',participation:'A_CONTACTER',nombreBriochesN1:null,modeReglement:'',lieuInfos:'',notes:'',participations:[],documents:[]}
}
function rowToMairie(row: ExcelJS.Row): NouvelleMairie {
  const col = (n: number) => text(row.getCell(n))
  const quantity = col(16)
  const base = blank(col(1))
  return {...base, commune:col(2), nomAffiche:col(3), codeInsee:col(4), secteur:col(5), numeroVoie:col(6), adresse:col(7), cp:col(8), ville:col(9), contactPrenom:col(10), contactNom:col(11),contactFonction:col(12),email:col(13),telephone:col(14),participation:typeParticipation(col(15)),nombreBriochesN1:quantity === ''?null:Number(quantity.replace(',','.')),modeReglement:col(17),lieuInfos:col(18),notes:col(19),statut:normalize(col(20)) === 'archivee' ? 'ARCHIVEE':'ACTIVE'}
}
export default function ImportMairiesExcel({mairies,onCommit,onClose}:{mairies:Mairie[];onCommit:(rows: {value:NouvelleMairie;existingId?:string}[])=>void;onClose:()=>void}) {
  const [rows,setRows] = useState<Preview[]>([])
  const [error,setError] = useState('')
  const [loading,setLoading] = useState(false)
  const [filename,setFilename] = useState('')
  const valid=useMemo(()=>rows.filter(r=>r.action!=='Erreur'),[rows])
  async function template() {
    const wb=new ExcelJS.Workbook(); const sheet=wb.addWorksheet('Mairies'); sheet.addRow(HEADERS)
    sheet.columns=HEADERS.map((h,i)=>({header:h,key:String(i),width:Math.max(17,Math.min(26,h.length+5))}))
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}};sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF123B79'}}
    sheet.views=[{state:'frozen',ySplit:1}]
    const buffer=await wb.xlsx.writeBuffer();dl('modele-import-mairies-OB2026.xlsx',new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
  }
  async function read(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0]; if(!file)return
    setLoading(true);setRows([]);setError('');setFilename(file.name)
    try {
      if(!/\.xlsx$/i.test(file.name))throw new Error('Sélectionne un fichier Excel .xlsx.')
      const wb=new ExcelJS.Workbook();await wb.xlsx.load(await file.arrayBuffer())
      const sheet=wb.getWorksheet('Mairies')??wb.worksheets[0]
      if(!sheet)throw new Error('Le classeur ne contient aucune feuille.')
      if(normalize(text(sheet.getRow(1).getCell(1)))!==normalize(HEADERS[0]) || normalize(text(sheet.getRow(1).getCell(2)))!==normalize(HEADERS[1])) throw new Error('En-têtes non reconnus. Télécharge et utilise le modèle Mairies.')
      const seen=new Set<string>();const prepared:Preview[]=[]
      sheet.eachRow((row,index)=>{
        if(index===1 || !row.hasValues)return
        const value=rowToMairie(row)
        const key=normalize(value.code);const insee=normalize(value.codeInsee)
        const byCode=mairies.find(m=>normalize(m.code)===key)
        const byInsee=insee?mairies.find(m=>normalize(m.codeInsee)===insee):undefined
        let reason=''
        if(!key || !value.commune.trim() || !value.nomAffiche.trim())reason='Code, commune et nom obligatoires.'
        else if(seen.has(key))reason='Code en double dans le fichier.'
        else if(value.nombreBriochesN1!==null && (!Number.isFinite(value.nombreBriochesN1)||value.nombreBriochesN1<0))reason='Quantité de brioches invalide.'
        else if(byCode && byInsee && byCode.id!==byInsee.id)reason='Conflit entre code mairie et code INSEE.'
        else if(!byCode && byInsee)reason='Code INSEE déjà associé à une autre fiche : vérification manuelle nécessaire.'
        seen.add(key)
        prepared.push({line:index,value,action:reason?'Erreur':byCode?'Mettre à jour':'Créer',error:reason,existingId:byCode?.id})
      })
      if(!prepared.length)throw new Error('Aucune mairie à importer.')
      setRows(prepared)
    } catch(e){setError(e instanceof Error?e.message:'Impossible de lire le fichier Excel.')} finally{setLoading(false);event.target.value=''}
  }
  function commit() {
    if(rows.some(r=>r.action==='Erreur')){setError('Corrige les lignes en erreur avant de valider.');return}
    if(!valid.length)return
    dl(`sauvegarde-mairies-avant-import-${new Date().toISOString().slice(0,10)}.json`,new Blob([JSON.stringify(mairies,null,2)],{type:'application/json'}))
    if(!window.confirm(`La sauvegarde JSON vient d'être téléchargée. Confirmer l'import de ${valid.length} mairie(s) ?`))return
    onCommit(valid.map(({value,existingId})=>({value,existingId})));onClose()
  }
  return <div className="mi-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="mi-dialog" role="dialog" aria-modal="true" aria-label="Import Excel Mairies">
    <header className="mi-header"><div><strong><FileSpreadsheet size={20}/> Import Excel — BDD Mairies</strong><p>Réservé à l'administrateur · création ou mise à jour par code mairie</p></div><button type="button" onClick={onClose} aria-label="Fermer"><X size={20}/></button></header>
    <div className="mi-body"><div className="mi-actions"><button type="button" onClick={template}><Download size={16}/> Télécharger le modèle</button><label className="mi-primary"><Upload size={16}/> Choisir un fichier .xlsx<input hidden type="file" accept=".xlsx" onChange={read}/></label></div>
    {filename&&<p className="mi-muted">Fichier : {filename}{loading?' · Lecture en cours…':''}</p>}
    {error&&<p className="mi-error" role="alert">{error}</p>}
    {rows.length>0&&<><div className="mi-counts"><strong>{rows.length} ligne(s)</strong><span>{rows.filter(r=>r.action==='Créer').length} création(s)</span><span>{rows.filter(r=>r.action==='Mettre à jour').length} mise(s) à jour</span><span>{rows.filter(r=>r.action==='Erreur').length} erreur(s)</span></div><div className="mi-scroll"><table><thead><tr><th>Ligne</th><th>Code</th><th>Commune</th><th>INSEE</th><th>Action / contrôle</th></tr></thead><tbody>{rows.map(r=><tr key={r.line}><td>{r.line}</td><td>{r.value.code}</td><td>{r.value.commune}</td><td>{r.value.codeInsee||'—'}</td><td className={r.action==='Erreur'?'mi-danger':''}>{r.error||r.action}</td></tr>)}</tbody></table></div></>}
    <p className="mi-muted">Les fiches déjà présentes sont conservées et mises à jour par leur code. Les documents et participations historiques ne sont pas supprimés.</p></div>
    <footer className="mi-footer"><button type="button" onClick={onClose}>Annuler</button><button className="mi-primary" type="button" disabled={!valid.length||rows.some(r=>r.action==='Erreur')||loading} onClick={commit}>Importer {valid.length} mairie(s)</button></footer>
  </section></div>
}
