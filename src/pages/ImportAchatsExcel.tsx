import { useState, type ChangeEvent } from 'react'
import { Upload, X, Download } from 'lucide-react'
import { useArtisans } from '../contexts/ArtisansContext'
import type { CommandeArtisan, Fournisseur, TypeFournisseur } from '../types/artisans'
import './ImportAchatsExcel.css'

type Props = { campagne: string; onClose: () => void }
type ImportRow = { line: number; reference: string; fournisseur: string; type: TypeFournisseur | null; date: string; retrait: string; quantite: number; prix: number; secteur: string; statut: CommandeArtisan['statut']; raison?: string }
const text = (v: unknown) => String(v ?? '').trim()
const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
const typeOf = (v: string): TypeFournisseur | null => {
  const n = norm(v)
  return ['artisan','artisans','boulanger','boulangerie'].includes(n) ? 'ARTISAN' : n === 'gms' || n === 'supermarche' || n === 'grandesurface' ? 'GMS' : ['industriel','industriels','industrie'].includes(n) ? 'INDUSTRIEL' : null
}
const year = (s: string) => text(s).match(/(?:19|20)\d{2}/)?.[0] ?? ''
const asNumber = (v: unknown) => {
  const n = Number(text(v).replace(/\s/g, '').replace('€', '').replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}
function excelDate(value: unknown): string {
  if (value instanceof Date) return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`
  if (typeof value === 'number' && value > 20000 && value < 90000) {
    const d = new Date(Date.UTC(1899, 11, 30) + value * 86400000)
    return d.toISOString().slice(0,10)
  }
  const s=text(value)
  if (/^\d{4}-\d\d-\d\d$/.test(s)) return s
  const fr=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  return fr ? `${fr[3]}-${fr[2].padStart(2,'0')}-${fr[1].padStart(2,'0')}` : ''
}
const columns = ['Reference','Type','Fournisseur','Date commande','Date retrait','Quantite','Prix unitaire TTC','Secteur','Statut']
function downloadTemplate() {
  const raw='\ufeff'+[columns.join(';'), 'OB/BOUL-1;Artisan;Boulangerie exemple;2025-10-01;;100;2,50;Lunéville;BROUILLON'].join('\r\n')
  const url=URL.createObjectURL(new Blob([raw],{type:'text/csv;charset=utf-8'}))
  const a=document.createElement('a'); a.href=url;a.download='modele-import-achats.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
function parseCSV(input: string): string[][] {
  const separator=input.split(/\r?\n/)[0]?.includes(';') ? ';' : ','
  const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false
  for(let i=0;i<input.length;i++){
    const ch=input[i]
    if(ch==='"') { if(quoted && input[i+1]==='"'){cell+='"';i++}else quoted=!quoted }
    else if(ch===separator && !quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(Boolean))rows.push(row);row=[];cell=''}
    else cell+=ch
  }
  row.push(cell);if(row.some(Boolean))rows.push(row)
  return rows
}
export default function ImportAchatsExcel({ campagne, onClose }: Props) {
  const { fournisseurs, commandesArtisans, setFournisseurs, setCommandesArtisans }=useArtisans()
  const [rows,setRows]=useState<ImportRow[]>([])
  const [error,setError]=useState('')
  const [filename,setFilename]=useState('')
  const [done,setDone]=useState(false)
  const existing=new Set(commandesArtisans.filter(c=>year(c.campagne)===year(campagne)).map(c=>norm(c.numero)))
  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];if(!file)return
    setError('');setRows([]);setDone(false);setFilename(file.name)
    try {
      let cells:unknown[][]
      if(/\.csv$/i.test(file.name))cells=parseCSV((await file.text()).replace(/^\ufeff/,''))
      else if(/\.xlsx$/i.test(file.name)){
        const module=await import('exceljs');const ExcelJS=module.default
        const workbook=new ExcelJS.Workbook()
        await workbook.xlsx.load(await file.arrayBuffer())
        const worksheet=workbook.worksheets[0];if(!worksheet)throw new Error('Aucun onglet trouvé dans le fichier.')
        cells=[];worksheet.eachRow((r)=>{cells.push((r.values as unknown[]).slice(1).map(v=>typeof v==='object'&&v!==null&&'text' in v ? (v as {text:string}).text : v))})
      } else throw new Error('Sélectionne un fichier .csv ou .xlsx.')
      if(cells.length<2)throw new Error('Fichier vide.')
      const headers=cells[0].map(v=>norm(text(v)))
      const ix=(...names:string[])=>headers.findIndex(h=>names.some(n=>h===norm(n)))
      const at=(row:unknown[],...names:string[])=>{const i=ix(...names);return i<0?'':row[i]}
      if(ix('Fournisseur','Nom fournisseur')<0 || ix('Quantite','Qte')<0 || ix('Prix unitaire TTC','Prix unitaire')<0)throw new Error('Colonnes obligatoires : Fournisseur, Quantite, Prix unitaire TTC. Télécharge le modèle.')
      const parsed:ImportRow[]=cells.slice(1).map((r,i)=>{
        const fournisseur=text(at(r,'Fournisseur','Nom fournisseur'))
        const known=fournisseurs.find(f=>norm(f.nom)===norm(fournisseur))
        const given=typeOf(text(at(r,'Type','Categorie')))
        const category=known?.type ?? given
        const reference=text(at(r,'Reference','Numero','Numéro'))
        const quantite=asNumber(at(r,'Quantite','Qte'))
        const prix=asNumber(at(r,'Prix unitaire TTC','Prix unitaire'))
        const date=excelDate(at(r,'Date commande','Date'))
        const retrait=excelDate(at(r,'Date retrait','Livraison'))
        const rawStatut=norm(text(at(r,'Statut')))
        const statut:CommandeArtisan['statut']=rawStatut==='confirmee'?'CONFIRMEE':rawStatut==='retraitprevu'?'RETRAIT_PREVU':'BROUILLON'
        const issues=[]
        if(!fournisseur)issues.push('Fournisseur absent')
        if(!category)issues.push('Type inconnu')
        if(known&&given&&known.type!==given)issues.push('Catégorie différente de la BDD fournisseur')
        if(!reference)issues.push('Référence manquante')
        if(reference&&existing.has(norm(reference)))issues.push('Doublon dans cette campagne')
        if(!Number.isInteger(quantite)||quantite<0)issues.push('Quantité invalide')
        if(!Number.isFinite(prix)||prix<0)issues.push('Prix invalide')
        if(!date)issues.push('Date de commande invalide')
        if(rawStatut && !['brouillon','confirmee','retraitprevu'].includes(rawStatut))issues.push('Statut non compatible avec import sécurisé')
        return {line:i+2,reference,fournisseur,type:category,date,retrait,quantite,prix,secteur:text(at(r,'Secteur')),statut,raison:issues.join(' · ')}
      })
      const refs=new Set<string>();parsed.forEach(r=>{const key=norm(r.reference);if(key&&refs.has(key))r.raison=[r.raison,'Référence répétée dans le fichier'].filter(Boolean).join(' · ');refs.add(key)})
      setRows(parsed)
    } catch(err){setError(err instanceof Error?err.message:'Impossible de lire le fichier.')}
    e.target.value=''
  }
  const valid=rows.filter(r=>!r.raison)
  function confirm() {
    if(!valid.length||done)return
    // Sauvegarde avant écriture pour permettre une restauration sans écraser le stock.
    const backup={date:new Date().toISOString(),fournisseurs,commandes:commandesArtisans}
    try {localStorage.setItem(`ob-import-achats-backup-${Date.now()}`,JSON.stringify(backup))} catch {setError('Impossible de créer la sauvegarde. Import annulé.');return}
    const newFournisseurs:Fournisseur[]=[]
    const newCommandes:CommandeArtisan[]=[]
    for(const r of valid){
      let f=fournisseurs.find(x=>norm(x.nom)===norm(r.fournisseur)) ?? newFournisseurs.find(x=>norm(x.nom)===norm(r.fournisseur))
      if(!f){
        const fid=`import-fournisseur-${crypto.randomUUID()}`
        f={id:fid,nom:r.fournisseur,type:r.type!,categories:[r.type!],responsable:'',responsableSecteur:'',adresse:'',telephone:'',email:'',tarif2026:null,tarif2025:null,commentaires:'Créé depuis import achats',statut:'A_VERIFIER'}
        newFournisseurs.push(f)
      }
      newCommandes.push({id:crypto.randomUUID(),numero:r.reference,artisanId:f.id,campagne,dateCommande:r.date,dateRetrait:r.retrait,repartitionJours:'',secteur:r.secteur,responsableSecteur:'',adresseResponsable:'',telephoneResponsable:'',personneRetrait:'',quantiteCommandee:r.quantite,quantiteFabriquee:null,prixUnitaire:r.prix,statut:r.statut,etiquettesConsignes:'',bdcEnvoyeLe:'',etiquettesEnvoyeesLe:'',fondsEstimes:null,fondsRecus:null,factureNumero:'',factureRecueLe:'',factureScanneeLe:'',factureTransmiseLe:'',remarque:'Import global : vérifier avant confirmation',remarqueFacture:''})
    }
    setFournisseurs(prev=>[...prev,...newFournisseurs])
    setCommandesArtisans(prev=>[...prev,...newCommandes])
    setDone(true)
  }
  return <div className="sga-import-overlay" role="presentation"><section className="sga-import-modal" role="dialog" aria-modal="true" aria-label="Importer les achats">
    <header><div><h2>Importer des commandes achats</h2><p>Campagne {campagne} · Dispatch automatique vers Artisans, GMS, Industriels</p></div><button onClick={onClose} aria-label="Fermer"><X size={20}/></button></header>
    <div className="sga-import-content"><div className="sga-import-actions"><button onClick={downloadTemplate}><Download size={16}/> Modèle CSV</button><label><Upload size={16}/> Choisir CSV / XLSX<input type="file" accept=".csv,.xlsx" onChange={pick} hidden/></label></div>
    <p>Catégorie d'abord déterminée par le fournisseur existant, sinon par la colonne « Type ». Les lignes incomplètes ou en doublon sont exclues. Les nouvelles commandes sont rattachées à la campagne affichée, sans mouvement de stock automatique.</p>
    {filename&&<p><strong>Fichier :</strong> {filename}</p>}{error&&<p className="sga-import-error" role="alert">{error}</p>}
    {rows.length>0&&<><p><strong>{valid.length} ligne(s) importable(s)</strong> · {rows.length-valid.length} à corriger · {rows.length} au total</p><div className="sga-import-scroll"><table><thead><tr><th>Ligne</th><th>Référence</th><th>Fournisseur</th><th>Type</th><th>Quantité</th><th>Prix</th><th>Contrôle</th></tr></thead><tbody>{rows.map(r=><tr key={r.line}><td>{r.line}</td><td>{r.reference}</td><td>{r.fournisseur}</td><td>{r.type??'—'}</td><td>{r.quantite}</td><td>{r.prix}</td><td className={r.raison?'sga-import-error':'sga-import-ok'}>{r.raison||'Prêt'}</td></tr>)}</tbody></table></div></>}
    {done&&<p className="sga-import-ok">{valid.length} commande(s) enregistrée(s). Ferme cette fenêtre pour voir le suivi actualisé.</p>}</div>
    <footer><button onClick={onClose}>Fermer</button><button disabled={!valid.length||done} onClick={confirm}>Importer {valid.length} commande(s)</button></footer>
  </section></div>
}
