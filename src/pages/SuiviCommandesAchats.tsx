import { Fragment, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Upload, Search, ShoppingBasket, Package, Euro, ArrowUpRight, ChevronDown, ChevronRight } from 'lucide-react'
import { useArtisans } from '../contexts/ArtisansContext'
import { useUsers } from '../contexts/UsersContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import ImportAchatsExcel from './ImportAchatsExcel'
import { useObData } from '../contexts/ObDataContext'
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

// Les achats historiques enregistrent souvent « 2025 » alors que le module
// Campagnes utilise « OB 2025 ». Comparer les années sans modifier les données.
function memeCampagne(commande: string | undefined, selection: string): boolean {
  const texteCommande = String(commande ?? '').trim().toUpperCase()
  const texteSelection = selection.trim().toUpperCase()
  if (!texteSelection || !texteCommande) return false
  if (texteCommande === texteSelection) return true
  const anneeCommande = texteCommande.match(/^(?:OB\s*[- ]?\s*)?(20\d{2})$/)?.[1]
  const anneeSelection = texteSelection.match(/^(?:OB\s*[- ]?\s*)?(20\d{2})$/)?.[1]
  return Boolean(anneeCommande && anneeSelection && anneeCommande === anneeSelection)
}

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
function livraisonRetrait(c: CommandeEtendue): string {
  const noms = destinations(c).map(d => d.nom || '').filter(Boolean)
  const lieu = noms.length ? [...new Set(noms)].join(' / ') : ''
  // Le lieu est prioritaire ; la date reste disponible lorsqu'elle est renseignée.
  return [lieu, c.dateRetrait ? dateLisible(c.dateRetrait) : ''].filter(Boolean).join(' · ') || 'Non renseigné'
}

function exporterCsv(lignes: {c:CommandeEtendue; type:TypeFournisseur; fournisseur:string}[]) {
  const rows = [['Référence','Catégorie','Fournisseur','Campagne','Date commande','Lieu / date livraison-retrait','Destinations','Quantité','TTC','Statut'], ...lignes.map(({c,type,fournisseur})=>[
    c.numero,LIBELLES[type],fournisseur,c.campagne,c.dateCommande,livraisonRetrait(c),
    destinations(c).map(d=>`${d.nom || 'Destination'} : ${d.quantite ?? 0} (${d.livre ? 'livré' : 'à livrer'})`).join(' | '),
    String(c.quantiteCommandee),montantCommande(c).toFixed(2),LABELS[etape(c)],
  ])]
  const cellule=(s:string)=>`"${(/^[\s]*[=+@-]/.test(s) ? "'"+s : s).replace(/"/g,'""')}"`
  const blob=new Blob(['\ufeff'+rows.map(r=>r.map(cellule).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='suivi-global-commandes-achats.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}

export default function SuiviCommandesAchats() {
  const { fournisseurs, commandesArtisans, setCommandesArtisans } = useArtisans()
  const { etablissements } = useEtablissements()
  const { currentUser } = useUsers()
  const [importOpen,setImportOpen] = useState(false)
  const [bilan2025Message,setBilan2025Message] = useState('')
  const { selectedCampagne, activeCampagne } = useObData()
  const campagneActive = selectedCampagne ?? activeCampagne
  const campagneId = campagneActive?.id ?? ''
  const canImport = currentUser?.role === 'administrateur' && campagneId.length > 0
  const isAdmin2025 = currentUser?.role === 'administrateur' && /^(?:OB\s*[- ]?\s*)?2025$/i.test(campagneId.trim())
  const siege = etablissements.find(e => e.code?.trim().toUpperCase() === 'SIEGE')
    ?? etablissements.find(e => /^(?:AEIM\s*[–-]\s*)?SI[EÈ]GE$/i.test(e.nom.trim()))

  function finaliserAchats2025() {
    if (!isAdmin2025) return
    if (!siege) {
      setBilan2025Message('Le Siège est introuvable dans Administration → Liste des établissements. Ajoute-le avant de lancer la mise à jour.')
      return
    }
    const cible = commandesArtisans.filter(c => memeCampagne(c.campagne, 'OB 2025'))
    if (!cible.length) {
      setBilan2025Message('Aucune commande d’achat OB 2025 à modifier.')
      return
    }
    const ok = window.confirm(`Mettre les ${cible.length} commandes achats OB 2025 au Siège et les marquer « Payé » ?\n\nLes destinations existantes seront remplacées. Toutes les livraisons/retraits seront affectés au Siège et marqués comme effectués. Aucun stock ne sera créé. Cette opération n’atteste pas d’un rapprochement bancaire.`)
    if (!ok) return
    try {
      const key = `ob-achats-2025-sauvegarde-avant-siege-paye-${Date.now()}`
      localStorage.setItem(key, JSON.stringify(commandesArtisans))
    } catch {
      setBilan2025Message('Sauvegarde locale impossible : opération annulée pour protéger tes données.')
      return
    }
    setCommandesArtisans(current => current.map(c => {
      if (!memeCampagne(c.campagne, 'OB 2025')) return c
      return {
        ...c,
        etablissementId: siege.id,
        destinationId: siege.id,
        destinationType: 'ETABLISSEMENT',
        destinationNom: siege.nom,
        destinations: [{
          id: `siege-2025-${c.id}`,
          type: 'ETABLISSEMENT',
          referenceId: siege.id,
          nom: siege.nom,
          adresse: [siege.adresse, siege.codePostal, siege.ville].filter(Boolean).join(' '),
          quantite: c.quantiteCommandee,
          livre: true,
        }],
        livre: true,
        paye: true,
      }
    }))
    setBilan2025Message(`${cible.length} commande(s) OB 2025 affectée(s) au Siège et marquée(s) « Payé ». Livraisons / retraits marqués effectués au Siège. Sauvegarde créée. Aucun mouvement de stock déclenché.`)
  }

  const [categorie,setCategorie]=useState<Filtre>('TOUS')
  const [statut,setStatut]=useState<'TOUS'|Etape>('TOUS')
  const [recherche,setRecherche]=useState('')
  const [ouverts,setOuverts]=useState<string[]>([])
  const commandes=useMemo(()=>commandesArtisans.map(c=>{
    const f=fournisseurs.find(x=>x.id===c.artisanId)
    // Un bon n'apparaît qu'une seule fois, même si le fournisseur cumule des activités.
    const type:TypeFournisseur=f?.type==='GMS'||f?.type==='INDUSTRIEL'?f.type:'ARTISAN'
    return {c:c as CommandeEtendue,type,fournisseur:f?.nom || c.artisanId || 'Fournisseur inconnu', categories:f?categoriesFournisseur(f):[]}
  }),[commandesArtisans,fournisseurs])
  // Filtre central : aucune commande d'une autre campagne n'est incluse dans les indicateurs.
  const commandesCampagne=useMemo(()=>commandes.filter(x=>memeCampagne(x.c.campagne, campagneId)),[commandes,campagneId])
  const resultats=useMemo(()=>commandesCampagne.filter(x=>{
    const q=recherche.trim().toLocaleLowerCase('fr')
    return (categorie==='TOUS'||x.type===categorie) && (statut==='TOUS'||etape(x.c)===statut)
      && (!q || [x.c.numero,x.fournisseur,x.c.secteur,x.c.campagne,...destinations(x.c).map(d=>d.nom)].join(' ').toLocaleLowerCase('fr').includes(q))
  }).sort((a,b)=>b.c.dateCommande.localeCompare(a.c.dateCommande)||b.c.numero.localeCompare(a.c.numero,'fr',{numeric:true})),[commandesCampagne,categorie,statut,recherche])
  const qte=resultats.reduce((s,x)=>s+x.c.quantiteCommandee,0)
  const montant=resultats.reduce((s,x)=>s+montantCommande(x.c),0)
  const toggle=(id:string)=>setOuverts(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])
  return <main className="sga-page">
    <header className="sga-head"><div><span className="sga-eyebrow">COMMANDES ACHATS</span><h1>Suivi global des commandes</h1><p>Vision consolidée des commandes Artisans, GMS et Industriels — campagne {campagneActive?.nom ?? "non sélectionnée"}. Données actualisées depuis leur base commune.</p></div>{canImport && <button className="sga-export" onClick={()=>setImportOpen(true)}><Upload size={17}/> Import Excel</button>}{isAdmin2025 && <button className="sga-export" type="button" onClick={finaliserAchats2025} title="Sauvegarder puis attribuer les commandes 2025 au Siège et les marquer payées">Finaliser achats 2025</button>}<button className="sga-export" onClick={()=>exporterCsv(resultats)} disabled={!resultats.length}><Download size={17}/> Exporter CSV / Excel</button></header>
    {bilan2025Message && <p role="status" style={{padding:"12px 16px", background:"#fff7ea", border:"1px solid #f4ce99", borderRadius:10, color:"#784b12"}}>{bilan2025Message}</p>}
    <nav className="sga-tabs" aria-label="Type d'achat">{(['TOUS','ARTISAN','GMS','INDUSTRIEL'] as Filtre[]).map(t=><button key={t} type="button" className={categorie===t?'active':''} onClick={()=>setCategorie(t)}>{t==='TOUS'?'Tous':LIBELLES[t]} ({commandesCampagne.filter(x=>t==='TOUS'||x.type===t).length})</button>)}</nav>
    <section className="sga-kpis"><article><Package size={21}/><div><small>Commandes</small><strong>{fmt(resultats.length)}</strong></div></article><article><ShoppingBasket size={21}/><div><small>Brioches commandées</small><strong>{fmt(qte)}</strong></div></article><article><Euro size={21}/><div><small>Total TTC</small><strong>{argent(montant)}</strong></div></article></section>
    <section className="sga-panel"><div className="sga-filters"><label className="sga-search"><Search size={17}/><input aria-label="Rechercher" placeholder="Commande, fournisseur, secteur, lieu de livraison…" value={recherche} onChange={e=>setRecherche(e.target.value)}/></label><select aria-label="Campagne" value={campagneId} disabled title="Changer la campagne dans la Topbar"><option value={campagneId}>{campagneActive?.nom ?? (campagneId || "Aucune campagne")}</option></select><select aria-label="Statut" value={statut} onChange={e=>setStatut(e.target.value as 'TOUS'|Etape)}><option value="TOUS">Tous les statuts</option>{(Object.keys(LABELS) as Etape[]).map(t=><option key={t} value={t}>{LABELS[t]}</option>)}</select></div>
    <div className="sga-count">{resultats.length} commande{resultats.length!==1?'s':''} affichée{resultats.length!==1?'s':''}</div>
    <div className="sga-scroll"><table className="sga-table"><thead><tr><th>Commande</th><th>Type</th><th>Fournisseur</th><th>Campagne</th><th>Date</th><th>Livraison / retrait</th><th>Destinations</th><th>Qté</th><th>Total TTC</th><th>Statut</th><th>Accès</th></tr></thead><tbody>{resultats.map(({c,type,fournisseur})=>{const ds=destinations(c);const e=etape(c);const ouvert=ouverts.includes(c.id);return <Fragment key={c.id}>{/* une commande + sous-lignes */}<tr key={c.id} className={e==='PAYES'?'sga-paid':''}><td className="sga-code">{c.numero}</td><td><span className={`sga-type sga-${type.toLowerCase()}`}>{LIBELLES[type]}</span></td><td>{fournisseur}</td><td>{c.campagne}</td><td>{dateLisible(c.dateCommande)}</td><td>{livraisonRetrait(c)}</td><td>{ds.length?<button className="sga-expand" onClick={()=>toggle(c.id)} aria-expanded={ouvert}>{ouvert?<ChevronDown size={15}/>:<ChevronRight size={15}/>} {ds.length} lieu{ds.length>1?'x':''} · {ds.filter(d=>d.livre).length}/{ds.length} livré{ds.length>1?'s':''}</button>:<span className="sga-muted">Non renseigné</span>}</td><td className="sga-number">{fmt(c.quantiteCommandee)}</td><td className="sga-number">{argent(montantCommande(c))}</td><td><span className={`sga-state sga-state-${e.toLowerCase()}`}>{LABELS[e]}</span></td><td><Link to={URLS[type]} title={`Ouvrir ${LIBELLES[type]}`} className="sga-link"><ArrowUpRight size={16}/> Ouvrir</Link></td></tr>{ouvert&&ds.map((d,i)=><tr key={`${c.id}-dest-${d.id||i}`} className="sga-child"><td colSpan={6}></td><td>↳ {d.nom||'Lieu non renseigné'} · {d.type||'Destination'}</td><td className="sga-number">{fmt(d.quantite||0)}</td><td></td><td><span className={d.livre?'sga-delivered':'sga-muted'}>{d.livre?'Livré':'À livrer'}</span></td><td></td></tr>)}</Fragment>})}{resultats.length===0&&<tr><td className="sga-empty" colSpan={11}>Aucune commande ne correspond aux filtres.</td></tr>}</tbody></table></div></section>
    <p className="sga-note">Le suivi global est une vue de consultation. Pour créer, corriger ou confirmer une commande, ouvre son module d'origine. Les commandes utilisant un fournisseur multi-catégories sont classées selon son type principal, pour éviter un double comptage.</p>
    {importOpen && <ImportAchatsExcel campagne={campagneId} onClose={()=>setImportOpen(false)}/>}
  </main>
}
