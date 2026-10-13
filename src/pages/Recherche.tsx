import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search, ArrowUpRight, Database, LayoutGrid, ShieldCheck } from 'lucide-react'
import { PERMISSION_MODULES } from '../lib/permissionCatalog'
import { useAccess } from '../lib/useAccess'
import { useObData } from '../contexts/ObDataContext'
import { useMairies } from '../contexts/MairiesContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import './Recherche.css'

type Item = { id:string; title:string; sub:string; path:string; category:string; fields:string[]; code?:string; isPage?:boolean; amounts?:Array<{label:string;value:number}>; details?:string }
const categories = ['Tout','Fiches de caisse','Commandes','Donateurs','Mairies','Bénévoles','Établissements','Pages']
const aliases: Record<string,string> = {'/geographie':'/geographie/carte'}
const normalize = (s:string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g,' ').trim()
const stringify = (v:unknown) => v == null ? '' : String(v)
function volunteers(): Array<Record<string,unknown>> {
  try { const parsed:unknown=JSON.parse(localStorage.getItem('ob-bdd-benevoles-v1')||'[]');return Array.isArray(parsed)?parsed.filter(x=>x&&typeof x==='object'):[] } catch { return [] }
}
function money(value:number){return value.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}
function flatten(record:unknown, prefix='', depth=0):string[]{
  if(record==null || depth>4)return []
  if(typeof record==='string'||typeof record==='number'||typeof record==='boolean')return [prefix ? `${prefix} ${record}`:String(record)]
  if(Array.isArray(record))return record.slice(0,100).flatMap((v,i)=>flatten(v,prefix+' '+i,depth+1))
  if(typeof record==='object')return Object.entries(record as Record<string,unknown>).flatMap(([key,value])=>flatten(value,prefix+' '+key,depth+1))
  return []
}
function normalizedNumber(input:string): number|null {
  const raw=input.replace(/[\s\u00a0\u202f€]/g,'').replace(',','.')
  if(!/^[-+]?\d+(?:\.\d{1,2})?$/.test(raw))return null
  const number=Number(raw)
  return Number.isFinite(number)?number:null
}
function rank(item:Item,query:string):{score:number;reason:string}{
  const q=normalize(query);if(!q)return {score:item.isPage?20:30,reason:''}
  const numeric=normalizedNumber(query)
  const onlyMoney=/€|euros?\b/i.test(query)
  if(numeric!==null && item.amounts?.length){
    const exact=item.amounts.find(m=>Math.abs(m.value-numeric)<0.005)
    if(exact)return {score:1300,reason:`${exact.label} : ${money(exact.value)} · montant exact`}
  }
  if(onlyMoney)return {score:-1,reason:''}
  const code=normalize(item.code||'');const title=normalize(item.title)
  if(code===q)return {score:1100,reason:'Référence exacte'}
  if(title===q)return {score:1050,reason:'Titre exact'}
  if(numeric!==null && code && code.split(' ').some(token=>/^\d+$/.test(token)&&Number(token)===numeric))return {score:1020,reason:'Numéro de référence'}
  if(code.startsWith(q)&&code)return {score:850,reason:'Référence commençant par la recherche'}
  if(title.startsWith(q))return {score:800,reason:'Nom correspondant'}
  const tokens=q.split(' ').filter(Boolean)
  const searchable=normalize(item.fields.join(' '))
  const words=searchable.split(' ')
  if(tokens.every(t=>words.includes(t)))return {score:660,reason:'Champ correspondant'}
  if(tokens.every(t=>words.some(w=>w.startsWith(t))))return {score:500,reason:'Correspondance partielle'}
  if(tokens.every(t=>searchable.includes(t)))return {score:360,reason:'Texte correspondant'}
  return {score:-1,reason:''}
}
export default function Recherche() {
  const [params,setParams]=useSearchParams()
  const [query,setQuery]=useState(params.get('q')||'')
  const [category,setCategory]=useState('Tout')
  const input=useRef<HTMLInputElement>(null)
  const {canVisit}=useAccess()
  const {fichesCaisse,commandes,donateurs}=useObData()
  const {mairies}=useMairies()
  const {etablissements}=useEtablissements()
  const [vols,setVols]=useState(volunteers)
  useEffect(()=>{input.current?.focus();const update=()=>setVols(volunteers());window.addEventListener('focus',update);window.addEventListener('storage',update);return()=>{window.removeEventListener('focus',update);window.removeEventListener('storage',update)}},[])
  useEffect(()=>{const timer=window.setTimeout(()=>{const next=new URLSearchParams();if(query.trim())next.set('q',query.trim());setParams(next,{replace:true})},220);return()=>window.clearTimeout(timer)},[query,setParams])
  const items=useMemo(()=>{
    const all:Item[]=[]
    const add=(path:string,category:string,id:string,title:string,sub:string,fields:unknown[],code?:unknown,amounts?:Array<{label:string;value:number}>)=>{
      if(canVisit(path.split('?')[0])) all.push({path,category,id,title,sub,fields:fields.flatMap(f=>typeof f==='object'?flatten(f):[stringify(f)]),code:stringify(code),amounts})
    }
    fichesCaisse.forEach(f=>{
      const billets=(f.billets100||0)*100+(f.billets50||0)*50+(f.billets20||0)*20+(f.billets10||0)*10+(f.billets5||0)*5
      const pieces=(f.pieces2||0)*2+(f.pieces1||0)+(f.pieces050||0)*0.5+(f.pieces020||0)*0.2+(f.pieces010||0)*0.1+(f.pieces005||0)*0.05+(f.pieces002||0)*0.02+(f.pieces001||0)*0.01
      const especes=Math.round((billets+pieces)*100)/100
      const dons=(f.nbDons5||0)*5+(f.nbDons3||0)*3+(f.montantDonsAutres||0)
      const total=Math.round((especes+(f.montantCheques||0)+(f.montantTpe||0)+(f.montantVirement||0)+dons)*100)/100
      const amounts=[{label:'Total de la fiche',value:total},{label:'Espèces',value:especes},{label:'Billets',value:billets},{label:'Pièces',value:pieces},{label:'Dons',value:dons},{label:'Chèques',value:f.montantCheques||0},{label:'TPE',value:f.montantTpe||0},{label:'Virements',value:f.montantVirement||0},{label:'Autres dons',value:f.montantDonsAutres||0}]
      add('/encaissements/fiches-caisse?fiche='+encodeURIComponent(String(f.id)),'Fiches de caisse','f-'+f.id,'Fiche de caisse n° '+f.numero,[f.libelle,f.ville,`Total ${money(total)}`].filter(Boolean).join(' • '),[f],f.numero,amounts)
    })
    commandes.forEach(c=>add('/commandes?recherche='+encodeURIComponent(c.numero),'Commandes','c-'+c.id,'Commande '+c.numero,[c.campagne,c.statut].join(' • '),[c],c.numero,[{label:'Montant de la commande',value:c.quantite*c.prixUnitaire},{label:'Prix unitaire',value:c.prixUnitaire}]))
    donateurs.forEach(d=>add('/bdd/donateurs?recherche='+encodeURIComponent(d.code),'Donateurs','d-'+d.id,d.nom,d.code+' • '+(d.ville||''),[d],d.code))
    mairies.forEach(m=>add('/bdd/mairies?recherche='+encodeURIComponent(m.code),'Mairies','m-'+m.id,m.nomAffiche,m.code+' • '+m.commune,[m],m.code))
    etablissements.forEach(e=>add('/administration/etablissements?recherche='+encodeURIComponent(e.code),'Établissements','e-'+e.id,e.nom,e.code+' • '+e.ville,[e],e.code))
    vols.forEach(b=>add('/bdd/benevoles?recherche='+encodeURIComponent(stringify(b.nom)),'Bénévoles','b-'+stringify(b.id),[b.prenom,b.nom].map(stringify).join(' '),[b.commune,b.mission].map(stringify).join(' • '),[b,...(Array.isArray(b.mairieIds)?b.mairieIds.map(id=>mairies.find(m=>m.id===id)?.nomAffiche||''):[])],b.id))
    PERMISSION_MODULES.forEach(m=>{const path=aliases[m.path]||m.path;if(canVisit(path))all.push({id:'p-'+m.key,title:m.label,sub:m.path,path,category:'Pages',fields:[m.label,m.path],isPage:true})})
    return all
  },[fichesCaisse,commandes,donateurs,mairies,etablissements,vols,canVisit])
  const matches=useMemo(()=>items.map(item=>({item,...rank(item,query)})).filter(r=>r.score>=0&&(category==='Tout'||r.item.category===category)).sort((a,b)=>b.score-a.score||a.item.title.localeCompare(b.item.title,'fr')).map(r=>({...r.item,details:r.reason})),[items,query,category])
  return <div className="ob-search-page">
    <div className="ob-search-heading"><div className="ob-search-heading-icon"><Search size={28}/></div><div><span>RECHERCHE GLOBALE</span><h1>Rechercher dans OB2026</h1><p>Montants, références, dates, noms, commentaires et données accessibles.</p></div></div>
    <section className="ob-search-panel"><label className="ob-search-field"><Search size={23}/><input ref={input} aria-label="Recherche" placeholder="Montant, numéro, date, nom, remarque, ville..." value={query} onChange={e=>setQuery(e.target.value)}/></label>
      <div className="ob-search-tabs" role="group" aria-label="Filtrer les résultats">{categories.map(c=><button type="button" key={c} className={category===c?'active':''} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
      <div className="ob-search-results-heading"><strong>Résultats dans les données réelles</strong><span>{matches.length} résultat{matches.length>1?'s':''}</span></div>
      <div className="ob-search-results">{matches.slice(0,100).map(m=><Link className="ob-search-result" key={m.id} to={m.path}><div className="ob-search-result-icon">{m.isPage?<LayoutGrid size={20}/>:<Database size={20}/>}</div><div><strong>{m.title}</strong><span>{m.category} • {m.sub}{m.details ? ` • ${m.details}` : ""}</span></div><ArrowUpRight className="ob-search-result-arrow" size={18}/></Link>)}
        {!matches.length&&<div className="ob-search-empty"><ShieldCheck size={27}/><strong>Aucune correspondance accessible</strong><p>Essayez un autre numéro, nom ou référence. Aucune fiche fictive n'est ajoutée.</p></div>}</div>
      {matches.length>100&&<p className="ob-search-footnote">100 premiers résultats affichés. Précisez votre recherche pour affiner.</p>}
    </section>
    <p className="ob-search-footnote">Les données sont locales à cette session ; les restrictions par établissement et la sécurité serveur restent à intégrer. Les liens des BDD et commandes ouvrent actuellement leur module ; seule la fiche de caisse dispose d'une ouverture directe.</p>
  </div>
}
