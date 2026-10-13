import { useState, type ChangeEvent } from 'react'
import { FileSpreadsheet, X, Download, Upload } from 'lucide-react'
import type { Fournisseur, TypeFournisseur } from '../types/artisans'
import './ImportFournisseursExcel.css'

type Preview = { row: number; code: string; name: string; kind: 'creation' | 'modification' | 'identique' | 'erreur'; message: string; data?: Fournisseur }
type Props = { fournisseurs: Fournisseur[]; onCommit: (next: Fournisseur[]) => void; onClose: () => void }
const HEADERS = ['Code','Type','Raison sociale','Responsable','Responsable secteur','Adresse','Code postal','Ville','Secteur','Téléphone','Email','SIRET','Tarif 2026','Tarif 2025','Conditions règlement','Commentaires','Statut']
const text = (v: unknown): string => {
  if (v == null) return ''
  if (typeof v === 'object') {
    const obj = v as { text?: string; result?: unknown; richText?: { text: string }[] }
    if (typeof obj.text === 'string') return obj.text.trim()
    if (Array.isArray(obj.richText)) return obj.richText.map(x => x.text).join('').trim()
    if (obj.result !== undefined) return text(obj.result)
  }
  return String(v).trim()
}
const normalize = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g,'')
const numeric = (v: string): number | null | 'error' => {
  if (!v) return null
  const n = Number(v.replace(/\s/g,'').replace(',','.').replace('€',''))
  return Number.isFinite(n) && n >= 0 ? n : 'error'
}
function download(blob: Blob, filename: string) {
  const u = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = u; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(u), 2000)
}
export default function ImportFournisseursExcel({ fournisseurs, onCommit, onClose }: Props) {
  const [preview, setPreview] = useState<Preview[]>([])
  const [error,setError] = useState('')
  const [busy,setBusy] = useState(false)
  async function template() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook(); const sh=wb.addWorksheet('Fournisseurs')
    sh.addRow(HEADERS); sh.getRow(1).font={bold:true}; sh.columns=HEADERS.map(h=>({width:Math.max(17,h.length+4)}))
    sh.addRow(['FRN-000001','ARTISAN','Exemple fournisseur','Contact','','','54000','Nancy','','','','','','','','','ACTIF'])
    download(new Blob([await wb.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'modele-import-fournisseurs.xlsx')
  }
  async function readFile(event: ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0]; if(!file) return
    setError(''); setPreview([]); setBusy(true)
    try {
      if(!/\.xlsx$/i.test(file.name)) throw Error('Utilise un fichier Excel .xlsx (sans macros).')
      if(file.size>8_000_000) throw Error('Fichier trop volumineux (maximum 8 Mo).')
      const ExcelJS=(await import('exceljs')).default
      const wb=new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer() as any)
      const sh=wb.worksheets[0]; if(!sh) throw Error('Le classeur ne contient aucune feuille.')
      const keys=new Map<string,number>(); sh.getRow(1).eachCell((cell,col)=>keys.set(normalize(text(cell.value)),col))
      for(const required of ['Code','Type','Raison sociale']) if(!keys.has(normalize(required))) throw Error(`Colonne obligatoire manquante : ${required}. Télécharge le modèle.`)
      const seen = new Set<string>(); const output:Preview[]=[]
      const existing=new Map(fournisseurs.map(f=>[f.id.toUpperCase(),f]))
      for(let i=2;i<=sh.rowCount;i++) {
        const row=sh.getRow(i)
        const val=(key:string)=>text(row.getCell(keys.get(normalize(key))||0).value)
        const code=val('Code'), name=val('Raison sociale'), type=val('Type').toUpperCase()
        if(!code&&!name&&!type) continue
        const invalid=(message:string)=>output.push({row:i,code,name,kind:'erreur',message})
        if(!code||!name||!['GMS','ARTISAN','INDUSTRIEL'].includes(type)) {invalid('Code, raison sociale ou type invalide');continue}
        if(seen.has(code.toUpperCase())) {invalid('Code présent plusieurs fois dans le fichier');continue}
        seen.add(code.toUpperCase())
        const old=existing.get(code.toUpperCase())
        // Empty cells never overwrite existing values.
        const field=(key:string, previous='')=>val(key)||previous
        const price26=numeric(val('Tarif 2026')),price25=numeric(val('Tarif 2025'))
        if(price26==='error'||price25==='error'){invalid('Tarif numérique invalide');continue}
        const statutValue=val('Statut').toUpperCase()
        if(statutValue && !['ACTIF','INACTIF','A_VERIFIER'].includes(statutValue)){invalid('Statut invalide');continue}
        if(!old && fournisseurs.some(f=>normalize(f.nom)===normalize(name))) {invalid('Nom déjà présent avec un autre code : vérification manuelle nécessaire');continue}
        const typed=type as TypeFournisseur
        const updated: Fournisseur={
          id:old?.id||code,type:typed,categories:[typed],nom:name,
          responsable:field('Responsable',old?.responsable),responsableSecteur:field('Responsable secteur',old?.responsableSecteur),
          adresse:field('Adresse',old?.adresse),codePostal:field('Code postal',old?.codePostal),ville:field('Ville',old?.ville),
          secteur:field('Secteur',old?.secteur),telephone:field('Téléphone',old?.telephone),email:field('Email',old?.email),siret:field('SIRET',old?.siret),
          tarif2026:price26===null?old?.tarif2026??null:price26,tarif2025:price25===null?old?.tarif2025??null:price25,
          conditionsReglement:field('Conditions règlement',old?.conditionsReglement),commentaires:field('Commentaires',old?.commentaires),
          statut:(statutValue || old?.statut || 'ACTIF') as Fournisseur['statut'],
        }
        if(old && !val('Type')) updated.type=old.type
        if(old && !val('Type')) updated.categories=old.categories
        const kind=!old?'creation':JSON.stringify(old)===JSON.stringify(updated)?'identique':'modification'
        output.push({row:i,code,name,kind,message:kind==='creation'?'Nouvelle fiche':kind==='modification'?'Fiche existante mise à jour':'Aucune modification',data:updated})
      }
      if(!output.length) throw Error('Aucune ligne exploitable dans ce fichier.')
      setPreview(output)
    } catch(e) {setError(e instanceof Error?e.message:'Impossible de lire ce fichier Excel.')}
    finally {setBusy(false);event.target.value=''}
  }
  function confirm() {
    if(preview.some(p=>p.kind==='erreur')) {setError('Corrige les lignes en erreur avant l’import. Aucune donnée n’a été modifiée.');return}
    const map=new Map(fournisseurs.map(f=>[f.id,f]))
    for(const p of preview) if(p.data) map.set(p.data.id,p.data)
    // Backup before changing local state.
    download(new Blob([JSON.stringify(fournisseurs,null,2)],{type:'application/json'}),`sauvegarde-fournisseurs-${new Date().toISOString().slice(0,10)}.json`)
    onCommit([...map.values()]); onClose()
  }
  return <div className="fi-overlay" role="presentation"><section className="fi-dialog" role="dialog" aria-modal="true" aria-label="Import Excel fournisseurs">
    <header className="fi-head"><h2><FileSpreadsheet size={22}/> Importer des fournisseurs</h2><button type="button" onClick={onClose} aria-label="Fermer"><X size={20}/></button></header>
    <p>Réservé à l’administrateur. Les codes identifient les fiches existantes ; les cellules vides n’effacent pas les valeurs enregistrées. Aucune suppression automatique.</p>
    <div className="fi-actions"><button onClick={template} type="button"><Download size={17}/> Télécharger le modèle</button><label className="fi-upload"><Upload size={17}/>{busy?'Lecture en cours…':'Choisir un fichier .xlsx'}<input type="file" accept=".xlsx" onChange={readFile} disabled={busy}/></label></div>
    {error&&<p role="alert" className="fi-error">{error}</p>}
    {preview.length>0&&<><div className="fi-counts">{(['creation','modification','identique','erreur'] as const).map(k=><span key={k}>{k}: <strong>{preview.filter(r=>r.kind===k).length}</strong></span>)}</div><div className="fi-table"><table><thead><tr><th>Ligne</th><th>Code</th><th>Fournisseur</th><th>Résultat</th></tr></thead><tbody>{preview.map(r=><tr key={r.row}><td>{r.row}</td><td>{r.code}</td><td>{r.name}</td><td className={'fi-'+r.kind}>{r.message}</td></tr>)}</tbody></table></div><button className="fi-confirm" type="button" disabled={preview.some(r=>r.kind==='erreur')||busy} onClick={confirm}>Confirmer l’import ({preview.filter(r=>r.kind==='creation'||r.kind==='modification').length} changements)</button></>}
  </section></div>
}
