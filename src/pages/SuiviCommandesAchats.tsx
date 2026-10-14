import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Search, ShoppingBasket, Package, Euro, ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react'
import { useArtisans } from '../contexts/ArtisansContext'
import { argent, categoriesFournisseur, dateLisible, montantCommande, type CommandeArtisan, type TypeFournisseur } from '../types/artisans'
import './SuiviCommandesAchats.css'

type Destination = { id?: string; nom?: string; quantite?: number; livre?: boolean; type?: string }
type CommandeEtendue = CommandeArtisan & { destinations?: Destination[]; destinationNom?: string; paye?: boolean; livre?: boolean }
type Filtre = 'TOUS' | TypeFournisseur
type Etape = 'CREES' | 'CONFIRMES' | 'LIVRES' | 'PAYES'
const LIBELLES: Record<TypeFournisseur, string> = { ARTISAN:'Artisans', GMS:'GMS', INDUSTRIEL:'Industriels' }
const URLS: Record<TypeFournisseur, string> = { ARTISAN:'/commandes-achats/artisans', GMS:'/commandes-achats/gms', INDUSTRIEL:'/commandes-achats/industriels' }
const LABELS: Record<Etape,string> = { CREES:'Bon créé', CONFIRMES:'Bon confirmé', LIVRES:'Livré', PAYES:'Payé' }
const fmt = (n:number) => new Intl.NumberFormat('fr-FR').format(n)

function etape(c: CommandeEtendue): Etape {
  if (c.paye) return 'PAYES'
  const ds = c.destinations ?? []
  if (ds.length > 0 && ds.every(d=>d.livre)) return 'LIVRES'
  if (c.livre) return 'LIVRES'
  if (c.statut === 'TERMINEE') return 'LIVRES'
  if (['CONFIRMEE','RETRAIT_PREVU'].includes(c.statut)) return 'CONFIRMES'
  return 'CREES'
}
function destinations(c:CommandeEtendue):Destination[] {
  if (Array.isArray(c.destinations) && c.destinations.length) return c.destinations
  return c.destinationNom ? [{id:'legacy', nom:c.destinationNom, quantite:c.quantiteCommandee, livre:c.livre}] : []
}
function exporterCsv(lignes: {c:CommandeEtendue; type:TypeFournisseur; fournisseur:string}[]) {
  const rows = [['Référence','Catégorie','Fournisseur','Campagne','Date commande','Date livraison/retrait','Destinations','Quantité','TTC','Statut'], ...lignes.map(({c,type,fournisseur})=>[
    c.numero,LIBELLES[type],fournisseur,c.campagne,c.dateCommande,c.dateRetrait,
    destinations(c).map(d=>`${d.nom || 'Destination'} : ${d.quantite ?? 0} (${d.livre ? 'livré' : 'à livrer'})`).join(' | '),
    String(c.quantiteCommandee),montantCommande(c).toFixed(2),LABELS[etape(c)],
  ])]
  const cellule=(s:string)=>`"${(/^[\s]*[=+@-]/.test(s) ? "'"+s : s).replace(/"/g,'""')}"`
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cellule).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='suivi-global-commandes-achats.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export default function SuiviCommandesAchats() {
  const { fournisseurs, commandesArtisans } = useArtisans()
  const [categorie,setCategorie]=useState<Filtre>('TOUS')
  const [statut,setStatut]=useState<'TOUS'|Etape>('TOUS')
  const [recherche,setRecherche]=useState('')
  const [campagne,setCampagne]=useState('TOUTES')
  const [ouverts,setOuverts]=useState<string[]>([])
  const commandes=useMemo(()=>commandesArtisans.map(c=>{
    const f=fournisseurs.find(x=>x.id===c.artisanId)
    // Un bon n'apparaît qu'une seule fois, même si le fournisseur cumule des activités.
    const type:TypeFournisseur=f?.type==='GMS'||f?.type==='INDUSTRIEL'?f.type:'ARTISAN'
    return {c:c as CommandeEtendue,type,fournisseur:f?.nom || c.artisanId || 'Fournisseur inconnu', categories:f?categoriesFournisseur(f):[]}
  }),[commandesArtisans,fournisseurs])
  const campagnes=useMemo(()=>[...new Set(commandes.map(x=>x.c.campagne).filter(Boolean))].sort((a,b)=>b.localeCompare(a,'fr',{numeric:true})),[commandes])
  const resultats=useMemo(()=>commandes.filter(x=>{
    const q=recherche.trim().toLocaleLowerCase('fr')
    return (categorie==='TOUS'||x.type===categorie) && (statut==='TOUS'||etape(x.c)===statut)
      && (campagne==='TOUTES'||x.c.campagne===campagne)
      && (!q || [x.c.numero,x.fournisseur,x.c.secteur,x.c.campagne,...destinations(x.c).map(d=>d.nom)].join(' ').toLocaleLowerCase('fr').includes(q))
  }).sort((a,b)=>b.c.dateCommande.localeCompare(a.c.dateCommande)||b.c.numero.localeCompare(a.c.numero,'fr',{numeric:true})),[commandes,categorie,statut,campagne,recherche])
  const qte=resultats.reduce((s,x)=>s+x.c.quantiteCommandee,0)
  const montant=resultats.reduce((s,x)=>s+montantCommande(x.c),0)
  const toggle=(id:string)=>setOuverts(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])
  return <main className="sga-page">
    <header className="sga-head"><div><span className="sga-eyebrow">COMMANDES ACHATS</span><h1>Suivi global des commandes</h1><p>Vision consolidée des commandes Artisans, GMS et Industriels — données actualisées depuis leur base commune.</p></div><button className="sga-export" onClick={()=>exporterCsv(resultats)} disabled={!resultats.length}><Download size={17}/> Exporter CSV / Excel</button></header>
    <nav className="sga-tabs" aria-label="Type d'achat">{(['TOUS','ARTISAN','GMS','INDUSTRIEL'] as Filtre[]).map(t=><button key={t} type="button" className={categorie===t?'active':''} onClick={()=>setCategorie(t)}>{t==='TOUS'?'Tous':LIBELLES[t]} ({commandes.filter(x=>t==='TOUS'||x.type===t).length})</button>)}</nav>
    <section className="sga-kpis"><article><Package size={21}/><div><small>Commandes</small><strong>{fmt(resultats.length)}</strong></div></article><article><ShoppingBasket size={21}/><div><small>Brioches commandées</small><strong>{fmt(qte)}</strong></div></article><article><Euro size={21}/><div><small>Total TTC</small><strong>{argent(montant)}</strong></div></article></section>
    <section className="sga-panel"><div className="sga-filters"><label className="sga-search"><Search size={17}/><input aria-label="Rechercher" placeholder="Commande, fournisseur, secteur, lieu de livraison…" value={recherche} onChange={e=>setRecherche(e.target.value)}/></label><select aria-label="Campagne" value={campagne} onChange={e=>setCampagne(e.target.value)}><option value="TOUTES">Toutes les campagnes</option>{campagnes.map(c=><option key={c}>{c}</option>)}</select><select aria-label="Statut" value={statut} onChange={e=>setStatut(e.target.value as 'TOUS'|Etape)}><option value="TOUS">Tous les statuts</option>{(Object.keys(LABELS) as Etape[]).map(t=><option key={t} value={t}>{LABELS[t]}</option>)}</select></div>
    <div className="sga-count">{resultats.length} commande{resultats.length!==1?'s':''} affichée{resultats.length!==1?'s':''}</div>
    <div className="sga-scroll"><table className="sga-table"><thead><tr><th>Commande</th><th>Type</th><th>Fournisseur</th><th>Campagne</th><th>Date</th><th>Livraison / retrait</th><th>Destinations</th><th>Qté</th><th>Total TTC</th><th>Statut</th><th>Accès</th></tr></thead><tbody>{resultats.map(({c,type,fournisseur})=>{const ds=destinations(c);const e=etape(c);const ouvert=ouverts.includes(c.id);return <Fragment key={c.id}>{/* une commande + sous-lignes */}<tr key={c.id} className={e==='PAYES'?'sga-paid':''}><td className="sga-code">{c.numero}</td><td><span className={`sga-type sga-${type.toLowerCase()}`}>{LIBELLES[type]}</span></td><td>{fournisseur}</td><td>{c.campagne}</td><td>{dateLisible(c.dateCommande)}</td><td>{dateLisible(c.dateRetrait)}</td><td>{ds.length?<button className="sga-expand" onClick={()=>toggle(c.id)} aria-expanded={ouvert}>{ouvert?<ChevronDown size={15}/>:<ChevronRight size={15}/>} {ds.length} lieu{ds.length>1?'x':''} · {ds.filter(d=>d.livre).length}/{ds.length} livré{ds.length>1?'s':''}</button>:<span className="sga-muted">Non renseigné</span>}</td><td className="sga-number">{fmt(c.quantiteCommandee)}</td><td className="sga-number">{argent(montantCommande(c))}</td><td><span className={`sga-state sga-state-${e.toLowerCase()}`}>{LABELS[e]}</span></td><td><Link to={URLS[type]} title={`Ouvrir ${LIBELLES[type]}`} className="sga-link"><ArrowUpRight size={16}/> Ouvrir</Link></td></tr>{ouvert&&ds.map((d,i)=><tr key={`${c.id}-dest-${d.id||i}`} className="sga-child"><td colSpan={6}></td><td>↳ {d.nom||'Lieu non renseigné'} · {d.type||'Destination'}</td><td className="sga-number">{fmt(d.quantite||0)}</td><td></td><td><span className={d.livre?'sga-delivered':'sga-muted'}>{d.livre?'Livré':'À livrer'}</span></td><td></td></tr>)}</Fragment>})}{resultats.length===0&&<tr><td className="sga-empty" colSpan={11}>Aucune commande ne correspond aux filtres.</td></tr>}</tbody></table></div></section>
    <p className="sga-note">Le suivi global est une vue de consultation. Pour créer, corriger ou confirmer une commande, ouvre son module d'origine. Les commandes utilisant un fournisseur multi-catégories sont classées selon son type principal, pour éviter un double comptage.</p>
  </main>
}
