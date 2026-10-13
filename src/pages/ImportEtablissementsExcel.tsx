import { useMemo, useState, type ChangeEvent } from 'react'
import { Download, FileSpreadsheet, Upload, X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { EtablissementAEIM, NouvelEtablissementAEIM } from '../types/etablissements'
import { useEtablissements } from '../contexts/EtablissementsContext'
import './ImportEtablissementsExcel.css'

type Field = keyof NouvelEtablissementAEIM
const FIELDS: Field[] = [
  'code','nom','type','statut','adresse','codePostal','ville','telephone','email',
  'responsableNom','responsableTelephone','responsableEmail','secteur','pole',
  'participeOperationBrioches','peutEffectuerLivraisons','peutRecevoirStock',
  'peutVendreBrioches','roleOperationBrioches','commentaire'
]
const LABELS: Partial<Record<Field,string>> = {
  code:'Code établissement', nom:'Nom', type:'Type', statut:'Statut',adresse:'Adresse',
  codePostal:'Code postal',ville:'Ville',telephone:'Téléphone',email:'Email',
  responsableNom:'Responsable', responsableTelephone:'Téléphone responsable',
  responsableEmail:'Email responsable',secteur:'Secteur',pole:'Pôle',
  participeOperationBrioches:'Participe opération brioches',
  peutEffectuerLivraisons:'Peut effectuer livraisons',peutRecevoirStock:'Peut recevoir stock',
  peutVendreBrioches:'Peut remettre brioches',roleOperationBrioches:'Rôle opération',commentaire:'Commentaire'
}
const DEFAULT: NouvelEtablissementAEIM = {
  code:'',nom:'',type:'AUTRE',statut:'ACTIF',adresse:'',codePostal:'',ville:'',telephone:'',email:'',
  responsableNom:'',responsableTelephone:'',responsableEmail:'',secteur:'',pole:'',rattachementId:'',
  participeOperationBrioches:true,peutEffectuerLivraisons:false,peutRecevoirStock:false,
  peutVendreBrioches:false,roleOperationBrioches:'',commentaire:''
}
const BOOL_FIELDS = new Set<Field>(['participeOperationBrioches','peutEffectuerLivraisons','peutRecevoirStock','peutVendreBrioches'])
const TYPES = new Set(['SIEGE','ESAT','IME','MAS','FAM','FOYER','SAJ','SAVS','EAM','SESSAD','AUTRE'])
const norm = (s:string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')
const cellText = (value:unknown):string => {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim()
  if (typeof value === 'object') {
    const o = value as Record<string,unknown>
    if ('result' in o) return cellText(o.result)
    if ('text' in o) return cellText(o.text)
    if (Array.isArray(o.richText)) return o.richText.map((p:any)=>cellText(p.text)).join('')
  }
  return ''
}
function parseBoolean(value:string): boolean|null {
  const v = norm(value)
  if (['oui','o','true','vrai','1','yes'].includes(v)) return true
  if (['non','n','false','faux','0','no'].includes(v)) return false
  return null
}
type ImportRow = {line:number;code:string;nom:string;status:'creation'|'modification'|'inchange'|'erreur';reason:string;changes:Partial<NouvelEtablissementAEIM>;original?:EtablissementAEIM}
export default function ImportEtablissementsExcel({onClose}:{onClose:()=>void}) {
  const {etablissements,setEtablissements} = useEtablissements()
  const [rows,setRows] = useState<ImportRow[]>([])
  const [fileName,setFileName] = useState('')
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [complete,setComplete] = useState('')
  const counts = useMemo(()=>({creation:rows.filter(r=>r.status==='creation').length,modification:rows.filter(r=>r.status==='modification').length,inchange:rows.filter(r=>r.status==='inchange').length,erreur:rows.filter(r=>r.status==='erreur').length}),[rows])
  async function downloadTemplate() {
    const ExcelJS = (await import('exceljs')).default
    const book = new ExcelJS.Workbook()
    const sheet = book.addWorksheet('Établissements')
    sheet.addRow(FIELDS.map(k=>LABELS[k]||k))
    sheet.addRow(['ET001','ESAT Exemple','ESAT','ACTIF','1 rue Exemple','54000','Nancy','0383000000','contact@exemple.fr'])
    sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}
    sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF153F7B'}}
    sheet.columns.forEach(c=>{c.width=24})
    const binary=await book.xlsx.writeBuffer()
    const url=URL.createObjectURL(new Blob([binary],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}))
    const a=document.createElement('a');a.href=url;a.download='modele_etablissements_OB2026.xlsx';a.click();URL.revokeObjectURL(url)
  }
  async function onFile(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0]
    setError('');setComplete('');setRows([])
    if (!file) return
    setFileName(file.name)
    if (!/\.xlsx$/i.test(file.name)){setError('Utilise un fichier Excel .xlsx.');return}
    setBusy(true)
    try {
      const ExcelJS=(await import('exceljs')).default
      const book=new ExcelJS.Workbook()
      await book.xlsx.load(await file.arrayBuffer() as any)
      const sheet=book.worksheets[0]
      if (!sheet || sheet.rowCount<2) throw new Error('Feuille vide ou sans données.')
      const header=sheet.getRow(1)
      const fieldForColumn=new Map<number,Field>()
      header.eachCell((c,col)=>{
        const text=norm(cellText(c.value))
        const field=FIELDS.find(k=>norm(k)===text || norm(LABELS[k]||'')===text)
        if(field) fieldForColumn.set(col,field)
      })
      if (![...fieldForColumn.values()].includes('code') || ![...fieldForColumn.values()].includes('nom')) throw new Error('Colonnes obligatoires : Code établissement et Nom. Utilise le modèle fourni.')
      const existingCodes=new Map(etablissements.map(e=>[norm(e.code),e]))
      const seen=new Set<string>()
      const imported:ImportRow[]=[]
      sheet.eachRow((r,index)=>{
        if(index===1)return
        const raw:Partial<Record<Field,string>>={}
        fieldForColumn.forEach((field,col)=>{const c=r.getCell(col);const v=cellText(c.text || c.value);if(v!=='')raw[field]=v})
        if(!Object.keys(raw).length)return
        const code=(raw.code||'').trim();const nom=(raw.nom||'').trim()
        const row:ImportRow={line:index,code,nom,status:'erreur',reason:'',changes:{}}
        const key=norm(code)
        if(!code||!nom){row.reason='Code et nom obligatoires';imported.push(row);return}
        if(seen.has(key)){row.reason='Code dupliqué dans le fichier';imported.push(row);return}
        seen.add(key)
        const original=existingCodes.get(key)
        const changes:Partial<NouvelEtablissementAEIM>={}
        let invalid=''
        for(const field of FIELDS){
          const value=raw[field];if(value===undefined)continue
          if(BOOL_FIELDS.has(field)){
            const parsed=parseBoolean(value)
            if(parsed===null){invalid=`Valeur Oui/Non incorrecte : ${LABELS[field]}`;break}
            ;(changes as any)[field]=parsed
          } else if(field==='type') {
            if(!TYPES.has(value.toUpperCase())){invalid=`Type inconnu : ${value}`;break}
            changes.type=value.toUpperCase() as NouvelEtablissementAEIM['type']
          } else if(field==='statut') {
            if(!['ACTIF','INACTIF'].includes(value.toUpperCase())){invalid='Statut attendu : ACTIF ou INACTIF';break}
            changes.statut=value.toUpperCase() as NouvelEtablissementAEIM['statut']
          } else (changes as any)[field]=value
        }
        if(invalid){row.reason=invalid;imported.push(row);return}
        row.changes=changes;row.original=original
        if(!original)row.status='creation'
        else {
          const difference=Object.entries(changes).some(([k,v])=>String((original as any)[k])!==String(v))
          row.status=difference?'modification':'inchange'
        }
        row.reason=row.status==='creation'?'Nouvel établissement':row.status==='modification'?'Mise à jour par code':'Aucun changement'
        imported.push(row)
      })
      if(!imported.length)throw new Error('Aucune ligne exploitable dans le fichier.')
      setRows(imported)
    } catch(e){setError(e instanceof Error?e.message:'Impossible de lire le fichier Excel.')}
    finally{setBusy(false);event.target.value=''}
  }
  function apply() {
    if(counts.erreur){setError('Corrige les lignes en erreur avant de valider. Aucune donnée n’a été modifiée.');return}
    const now=new Date().toISOString()
    const updates=new Map(rows.filter(r=>r.status==='modification').map(r=>[r.original!.id,r.changes]))
    const creations=rows.filter(r=>r.status==='creation').map(r=>({
      ...DEFAULT,...r.changes,id:crypto.randomUUID(),createdAt:now,updatedAt:now
    }))
    // Met à jour les objets existants sans changer leur id ni leurs liens.
    setEtablissements(current=>[
      ...current.map(e=>updates.has(e.id)?{...e,...updates.get(e.id),updatedAt:now}:e),
      ...creations,
    ])
    setComplete(`${counts.creation} création(s), ${counts.modification} mise(s) à jour. Import terminé.`)
    setRows([])
  }
  return <div className="ex-overlay" role="presentation"><section className="ex-dialog" role="dialog" aria-modal="true" aria-label="Importer les établissements">
    <header className="ex-head"><div><h2>Importer des établissements</h2><p>Import Excel avec contrôle des doublons et aperçu préalable.</p></div><button className="ex-icon" onClick={onClose} aria-label="Fermer"><X size={20}/></button></header>
    <div className="ex-body">
      <div className="ex-actions"><label className="ex-upload"><Upload size={18}/> Sélectionner un fichier Excel<input type="file" accept=".xlsx" onChange={onFile}/></label><button className="ex-secondary" onClick={downloadTemplate}><Download size={18}/> Télécharger le modèle</button></div>
      <p className="ex-hint">Le rapprochement est effectué uniquement par <strong>code établissement</strong>. Les champs absents ou vides ne remplacent pas les valeurs existantes. Exporter une sauvegarde de ton référentiel avant tout import important.</p>
      {fileName&&<p className="ex-file"><FileSpreadsheet size={17}/> {fileName}</p>}
      {busy&&<p>Lecture du fichier en cours…</p>}
      {error&&<p className="ex-error"><AlertTriangle size={17}/> {error}</p>}
      {complete&&<p className="ex-success"><CheckCircle2 size={17}/> {complete}</p>}
      {rows.length>0&&<><div className="ex-summary"><span>À créer : <b>{counts.creation}</b></span><span>À mettre à jour : <b>{counts.modification}</b></span><span>Inchangés : <b>{counts.inchange}</b></span><span>Erreurs : <b>{counts.erreur}</b></span></div>
        <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>Ligne</th><th>Code</th><th>Établissement</th><th>Action</th><th>Observation</th></tr></thead><tbody>{rows.map(r=><tr key={r.line}><td>{r.line}</td><td>{r.code}</td><td>{r.nom}</td><td><span className={`ex-tag ex-${r.status}`}>{r.status}</span></td><td>{r.reason}</td></tr>)}</tbody></table></div>
      </>}
    </div><footer className="ex-foot"><button className="ex-secondary" onClick={onClose}>Fermer</button><button className="ex-confirm" disabled={busy||!rows.length||!!counts.erreur||(!counts.creation&&!counts.modification)} onClick={apply}><CheckCircle2 size={18}/> Confirmer l'import</button></footer>
  </section></div>
}
