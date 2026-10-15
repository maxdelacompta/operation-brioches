import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Banknote, CheckCircle2, Download, FileText, Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Trash2, X, UploadCloud } from 'lucide-react'
import { useArtisans } from '../contexts/ArtisansContext'
import { argent, montantCommande, type CommandeArtisan } from '../types/artisans'
import ImportSelectionCegi, { type CegiOperation } from './ImportSelectionCegi'
import './FacturesPaiements.css'
import { listerCegi, ouvrirCegi, type CegiDocument } from '../lib/cegiDocuments'

type Categorie = 'ACHAT_BRIOCHES' | 'TRANSPORT' | 'COMMUNICATION' | 'MATERIEL' | 'AUTRE'
type Facture = { id:string; numero:string; fournisseurId:string; fournisseurNom:string; date:string; echeance:string; campagne:string; categorie:Categorie; commandeIds:string[]; montantTtc:number; note:string; pieceNom:string; creeLe:string }
type Reglement = { id:string; factureId:string; date:string; montant:number; mode:string; reference:string; confirme:boolean; creeLe:string }
const FACTURES_KEY = 'ob2026-factures-paiements-v1'
const REGLEMENTS_KEY = 'ob2026-reglements-factures-v1'
const labels: Record<Categorie,string> = { ACHAT_BRIOCHES:'Achats de brioches', TRANSPORT:'Transport / logistique', COMMUNICATION:'Communication', MATERIEL:'Matériel', AUTRE:'Autre dépense' }
function lire<T>(key:string):T[] { try { const value=JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value)?value:[] } catch { return [] } }
const iso = () => new Date().toISOString().slice(0,10)
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2,9)}`
const arrondi = (v:number) => Math.round((v+Number.EPSILON)*100)/100
function garderCSV(value:unknown) { let v=String(value ?? ''); if (/^\s*[=+@-]/.test(v)) v="'"+v; return `"${v.replace(/"/g,'""')}"` }
function exporter(factures:Facture[], reglements:Reglement[]) { const rows=[['Numéro de pièce','Fournisseur','Catégorie','Campagne','Commandes','Montant TTC','Payé confirmé','Solde','Échéance','Statut'],...factures.map(f=>{const paye=arrondi(reglements.filter(r=>r.factureId===f.id&&r.confirme).reduce((a,r)=>a+r.montant,0));return [f.numero,f.fournisseurNom,labels[f.categorie],f.campagne,f.commandeIds.join(' / '),f.montantTtc,paye,arrondi(f.montantTtc-paye),f.echeance,paye>=f.montantTtc-0.005?'Payée':paye>0?'Partielle':'À payer']})]; const csv='\ufeff'+rows.map(r=>r.map(garderCSV).join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='OB2026-factures-paiements.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000) }
export default function FacturesPaiements(){
 const {fournisseurs,commandesArtisans,setCommandesArtisans}=useArtisans()
 const [factures,setFactures]=useState<Facture[]>(()=>lire(FACTURES_KEY))
 const [reglements,setReglements]=useState<Reglement[]>(()=>lire(REGLEMENTS_KEY))
 const [archives,setArchives]=useState<CegiDocument[]>([])
 const [archiveErreur,setArchiveErreur]=useState('')
 const rafraichirArchives=()=>{void listerCegi().then(setArchives).catch(e=>setArchiveErreur(e instanceof Error?e.message:'Impossible de charger les PDF archivés.'))}
 useEffect(()=>{rafraichirArchives()},[])
 const [recherche,setRecherche]=useState(''); const [filtreCategorie,setFiltreCategorie]=useState<Categorie|'TOUTES'>('TOUTES'); const [triColonne,setTriColonne]=useState('date'); const [triSens,setTriSens]=useState<'asc'|'desc'>('desc');
 const changerTri=(col:string)=>{if(triColonne===col)setTriSens(v=>v==='asc'?'desc':'asc');else{setTriColonne(col);setTriSens(col==='date'?'desc':'asc')}};
 const [liaisonId,setLiaisonId]=useState<string|null>(null); const [liaisonFournisseur,setLiaisonFournisseur]=useState(''); const [liaisonCommandes,setLiaisonCommandes]=useState<string[]>([]); const [liaisonErreur,setLiaisonErreur]=useState('');
 const [cegiOpen,setCegiOpen]=useState(false); const [creation,setCreation]=useState(false); const [payementId,setPayementId]=useState<string|null>(null);const [erreur,setErreur]=useState('')
 const [numero,setNumero]=useState('');const [fournisseurId,setFournisseurId]=useState('');const [autreBeneficiaire,setAutreBeneficiaire]=useState('');const [date,setDate]=useState(iso());const [echeance,setEcheance]=useState('');const [categorie,setCategorie]=useState<Categorie>('ACHAT_BRIOCHES');const [commandeIds,setCommandeIds]=useState<string[]>([]);const [montantManuel,setMontantManuel]=useState('');const [note,setNote]=useState('');const [pieceNom,setPieceNom]=useState('')
 const [montantReglement,setMontantReglement]=useState('');const [dateReglement,setDateReglement]=useState(iso());const [mode,setMode]=useState('Virement');const [reference,setReference]=useState('');const [reglementConfirme,setReglementConfirme]=useState(false)
 const commandesFournisseur=useMemo(()=>commandesArtisans.filter(c=>c.artisanId===fournisseurId),[commandesArtisans,fournisseurId])
 const totalCommandes=arrondi(commandesArtisans.filter(c=>commandeIds.includes(c.id)).reduce((s,c)=>s+montantCommande(c),0))
 const montant=commandeIds.length?totalCommandes:Math.max(0,Number(montantManuel)||0)
 const facturePaiements=(id:string)=>arrondi(reglements.filter(r=>r.factureId===id&&r.confirme).reduce((sum,r)=>sum+r.montant,0))
 const dejaPayees=arrondi(factures.reduce((sum,f)=>sum+facturePaiements(f.id),0));const totalFacture=arrondi(factures.reduce((sum,f)=>sum+f.montantTtc,0))
 useEffect(()=>{localStorage.setItem(FACTURES_KEY,JSON.stringify(factures))},[factures]);useEffect(()=>{localStorage.setItem(REGLEMENTS_KEY,JSON.stringify(reglements))},[reglements])
 // Une commande n'est soldée automatiquement que si toutes les factures auxquelles elle est liée sont intégralement réglées.
 // Ne pas effacer un paiement déjà marqué manuellement dans les modules d'achats.
 useEffect(()=>{
  if(!factures.length) return
  setCommandesArtisans(prev=>{
   let change=false
   const next=prev.map(c=>{
    const assoc=factures.filter(f=>f.commandeIds.includes(c.id))
    if(!assoc.length)return c
    const full=assoc.every(f=>facturePaiements(f.id)>=f.montantTtc-.005)
    if(full&&!((c as CommandeArtisan & {paye?:boolean}).paye)){change=true;return {...c,paye:true}}
    return c
   })
   return change?next:prev
  })
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[factures,reglements,setCommandesArtisans])
 const facturesAffichees=useMemo(()=>{
   const term=recherche.trim().toLocaleLowerCase('fr');
   const paiements=new Map<string,number>();
   for(const r of reglements)if(r.confirme)paiements.set(r.factureId,arrondi((paiements.get(r.factureId)||0)+r.montant));
   const valeur=(f:Facture,col:string):string|number=>{
     const paye=paiements.get(f.id)||0;
     switch(col){
       case 'numero':return f.numero;
       case 'date':return f.date;
       case 'fournisseur':return f.fournisseurNom;
       case 'categorie':return labels[f.categorie]||f.categorie;
       case 'commandes':return f.commandeIds.map(id=>commandesArtisans.find(c=>c.id===id)?.numero||id).join(' ');
       case 'montant':return f.montantTtc;
       case 'paye':return paye;
       case 'solde':return f.montantTtc-paye;
       case 'etat':return f.montantTtc-paye<=.005?2:paye>0?1:0;
       default:return '';
     }
   };
   return factures.filter(f=>(filtreCategorie==='TOUTES'||f.categorie===filtreCategorie)&&(!term||[
     f.numero,f.fournisseurNom,labels[f.categorie]||f.categorie,f.date,f.pieceNom,f.note,f.campagne,
     ...f.commandeIds.map(id=>commandesArtisans.find(c=>c.id===id)?.numero||id),
     ...reglements.filter(r=>r.factureId===f.id).map(r=>r.reference)
   ].join(' ').toLocaleLowerCase('fr').includes(term))).sort((a,b)=>{
     const x=valeur(a,triColonne),y=valeur(b,triColonne);
     const comparaison=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'fr',{numeric:true,sensitivity:'base'});
     return (triSens==='asc'?comparaison:-comparaison)||a.numero.localeCompare(b.numero,'fr',{numeric:true});
   });
 },[factures,reglements,commandesArtisans,recherche,filtreCategorie,triColonne,triSens]);
 const enteteTri=(cle:string,libelle:string)=><button type="button" className="fpai-sort" onClick={()=>changerTri(cle)} aria-label={`Trier par ${libelle}`} aria-sort={undefined}>{libelle}{triColonne!==cle?<ArrowUpDown size={12}/>:triSens==='asc'?<ArrowUp size={12}/>:<ArrowDown size={12}/>}</button>;
 function creer(event:FormEvent){event.preventDefault();setErreur('');const nom=fournisseurId==='AUTRE' ? autreBeneficiaire.trim() : fournisseurs.find(f=>f.id===fournisseurId)?.nom ?? ''
  if(!numero.trim()||!nom){setErreur('Renseigne une référence et un fournisseur.');return}
  if(factures.some(f=>f.numero.trim().toLowerCase()===numero.trim().toLowerCase()&&f.fournisseurId===(fournisseurId==='AUTRE'?`AUTRE:${nom}`:fournisseurId))){setErreur('Cette référence existe déjà pour ce fournisseur.');return}
  if(!Number.isFinite(montant)||montant<=0){setErreur('Le montant TTC doit être supérieur à zéro.');return}
  if(commandeIds.some(id=>factures.some(f=>f.commandeIds.includes(id)))){setErreur('Une commande est déjà rattachée à une autre facture.');return}
  setFactures(old=>[...old,{id:uid(),numero:numero.trim(),fournisseurId:fournisseurId==='AUTRE'?`AUTRE:${nom}`:fournisseurId,fournisseurNom:nom,date,echeance,campagne:commandeIds.length?commandesArtisans.find(c=>c.id===commandeIds[0])?.campagne??'':'',categorie,commandeIds,montantTtc:arrondi(montant),note,pieceNom,creeLe:new Date().toISOString()}]);setCreation(false);setNumero('');setCommandeIds([]);setMontantManuel('');setPieceNom('');setNote('')
 }
 function ajouterReglement(event:FormEvent){event.preventDefault();setErreur('');const facture=factures.find(f=>f.id===payementId);if(!facture)return
  const n=arrondi(Number(montantReglement));const restant=arrondi(facture.montantTtc-facturePaiements(facture.id));if(!Number.isFinite(n)||n<=0||n>restant+.005){setErreur('Montant incorrect ou supérieur au solde de la facture.');return}
  if(!reference.trim()){setErreur('Saisis une référence de règlement ou de pièce.');return}
  setReglements(old=>[...old,{id:uid(),factureId:facture.id,date:dateReglement,montant:n,mode,reference:reference.trim(),confirme:reglementConfirme,creeLe:new Date().toISOString()}]);setPayementId(null);setMontantReglement('');setReference('');setReglementConfirme(false)
 }
 function importerOperation(op:CegiOperation):string|null {
  // Ne pas créer un doublon à la réimportation de la même liste.
  const piece=op.piece.trim()
  if(!piece || !op.beneficiaire.trim() || !Number.isFinite(op.montant) || op.montant<=0) return 'Référence, bénéficiaire ou montant invalide.'
  if(op.commandeIds.some(id=>factures.some(f=>f.commandeIds.includes(id)))) return 'Une de ces commandes est déjà rattachée à une facture : vérifie le rapprochement.'
  const totalAssoc=arrondi(commandesArtisans.filter(c=>op.commandeIds.includes(c.id)).reduce((sum,c)=>sum+montantCommande(c),0))
  if(op.commandeIds.length && Math.abs(totalAssoc-op.montant)>0.01) return `Le total des commandes (${argent(totalAssoc)}) diffère du montant de la pièce (${argent(op.montant)}). Corrige le rapprochement ou enregistre sans commande.`
  const nom=op.fournisseurId ? fournisseurs.find(f=>f.id===op.fournisseurId)?.nom??op.beneficiaire : op.beneficiaire
  const fournisseurKey=op.fournisseurId || `AUTRE:${nom}`
  if(factures.some(f=>f.numero.toLowerCase()===piece.toLowerCase() && f.fournisseurId===fournisseurKey)) return 'Cette pièce existe déjà pour ce bénéficiaire.'
  const signature=`CEGI:${op.referenceListe}:${op.source}:${op.piece}:${op.montant}`
  if(reglements.some(r=>r.reference===signature)) return 'Cette opération CEGI a déjà été importée.'
  const fid=uid()
  const facture:Facture={id:fid,numero:piece,fournisseurId:fournisseurKey,fournisseurNom:nom,date:op.datePiece||iso(),echeance:op.echeance,campagne:op.commandeIds.length?commandesArtisans.find(c=>c.id===op.commandeIds[0])?.campagne||'':'',categorie:op.categorie,commandeIds:op.commandeIds,montantTtc:arrondi(op.montant),note:`Pièce provisoire créée depuis une sélection CEGI. Paiement déclaré selon la règle interne OB2026 ; rapprochement bancaire à vérifier. Libellé : ${op.libelle}. Le document source ne remplace pas la facture du fournisseur.`,pieceNom:op.source,creeLe:new Date().toISOString()}
  const reglement:Reglement={id:uid(),factureId:fid,date:op.echeance||iso(),montant:arrondi(op.montant),mode:op.mode,reference:signature,confirme:true,creeLe:new Date().toISOString()}
  setFactures(old=>[...old,facture]);setReglements(old=>[...old,reglement]);return null
 }
 const factureALier=factures.find(f=>f.id===liaisonId)||null
 const commandesALier=commandesArtisans.filter(c=>c.artisanId===liaisonFournisseur)
 const totalLiaison=arrondi(commandesArtisans.filter(c=>liaisonCommandes.includes(c.id)).reduce((a,c)=>a+montantCommande(c),0))
 function ouvrirLiaison(f:Facture){
  const fournisseur=fournisseurs.find(item=>item.id===f.fournisseurId) || fournisseurs.find(item=>item.nom.trim().toLocaleLowerCase('fr')===f.fournisseurNom.trim().toLocaleLowerCase('fr'))
  setLiaisonId(f.id);setLiaisonFournisseur(fournisseur?.id||'');setLiaisonCommandes([...f.commandeIds]);setLiaisonErreur('')
 }
 function validerLiaison(){
  if(!factureALier)return
  if(!liaisonFournisseur){setLiaisonErreur('Sélectionne le fournisseur présent dans la BDD Fournisseurs. Si le fournisseur est absent, crée sa fiche d’abord.');return}
  if(!liaisonCommandes.length){setLiaisonErreur('Sélectionne au moins une commande. Si aucune commande n’existe, vérifie le module Commandes achats.');return}
  if(liaisonCommandes.some(id=>!commandesArtisans.some(c=>c.id===id&&c.artisanId===liaisonFournisseur))){setLiaisonErreur('Une commande ne correspond pas au fournisseur sélectionné.');return}
  if(liaisonCommandes.some(id=>factures.some(f=>f.id!==factureALier.id&&f.commandeIds.includes(id)))){setLiaisonErreur('Une commande est déjà liée à une autre facture.');return}
  if(Math.abs(totalLiaison-factureALier.montantTtc)>.01){setLiaisonErreur(`Écart de montants : commandes ${argent(totalLiaison)} / pièce ${argent(factureALier.montantTtc)}. Corrige le rapprochement avant validation.`);return}
  const nom=fournisseurs.find(f=>f.id===liaisonFournisseur)?.nom||factureALier.fournisseurNom
  setFactures(old=>old.map(f=>f.id===factureALier.id?{...f,fournisseurId:liaisonFournisseur,fournisseurNom:nom,commandeIds:[...liaisonCommandes],campagne:commandesArtisans.find(c=>c.id===liaisonCommandes[0])?.campagne||f.campagne}:f))
  setLiaisonId(null);setLiaisonErreur('')
 }
 function confirmerReglement(id:string){if(!window.confirm('Confirmer que ce paiement a réellement été exécuté ou constaté ?'))return;setReglements(prev=>prev.map(r=>r.id===id?{...r,confirme:true}:r))}
 function supprimerFacture(f:Facture){if(reglements.some(r=>r.factureId===f.id)){alert('Supprime d’abord les règlements associés après vérification comptable.');return}if(window.confirm(`Supprimer la facture ${f.numero} ?`))setFactures(v=>v.filter(x=>x.id!==f.id))}
 return <main className="fpai-page"><header className="fpai-header"><div><span className="fpai-eyebrow">DOCUMENTS · COMPTABILITÉ</span><h1>Factures & Paiements</h1><p>Rapprocher les factures, les commandes et les règlements, sans compter deux fois une dépense.</p></div><div className="fpai-actions"><button type="button" className="fpai-secondary" onClick={()=>exporter(factures,reglements)}><Download size={16}/> Export Excel (CSV)</button><button type="button" className="fpai-secondary" onClick={()=>setCegiOpen(true)}><UploadCloud size={16}/> Importer listes CEGI</button><button type="button" className="fpai-primary" onClick={()=>{setErreur('');setCreation(true)}}><Plus size={16}/> Nouvelle facture</button></div></header>
 <section className="fpai-kpis"><article><small>Factures TTC</small><strong>{argent(totalFacture)}</strong></article><article><small>Payé déclaré / confirmé</small><strong>{argent(dejaPayees)}</strong></article><article><small>Reste à payer</small><strong>{argent(Math.max(0,arrondi(totalFacture-dejaPayees)))}</strong></article><article><small>Factures</small><strong>{factures.length}</strong></article></section>
 <section className="fpai-card">
 <div className="fpai-filterbar"><label className="fpai-search"><Search size={17}/><input type="search" placeholder="Rechercher une pièce, un fournisseur, une commande, une référence…" value={recherche} onChange={e=>setRecherche(e.target.value)}/></label>
 <select aria-label="Filtrer par catégorie" value={filtreCategorie} onChange={e=>setFiltreCategorie(e.target.value as Categorie|'TOUTES')}><option value="TOUTES">Toutes les catégories</option>{Object.entries(labels).map(([id,libelle])=><option key={id} value={id}>{libelle}</option>)}</select>
 <span className="fpai-count">{facturesAffichees.length} pièce{facturesAffichees.length>1?'s':''}</span></div>
 <div className="fpai-scroll"><table><thead><tr><th>{enteteTri('numero','N° de pièce')}</th><th>{enteteTri('date','Date')}</th><th>{enteteTri('fournisseur','Fournisseur')}</th><th>{enteteTri('categorie','Catégorie')}</th><th>{enteteTri('commandes','Commandes liées')}</th><th>{enteteTri('montant','TTC')}</th><th>{enteteTri('paye','Payé')}</th><th>{enteteTri('solde','Solde')}</th><th>{enteteTri('etat','État')}</th><th>Actions</th></tr></thead><tbody>{facturesAffichees.map(f=>{const paye=facturePaiements(f.id);const reste=arrondi(f.montantTtc-paye);const etat=reste<=.005?'Payée':paye>0?'Partiellement payée':'À payer';const pending=reglements.filter(r=>r.factureId===f.id&&!r.confirme);const aRapprocher=f.categorie==='ACHAT_BRIOCHES'&&!f.commandeIds.length;return <tr key={f.id} className={reste<=.005?'fpai-paid':''}><td><b>{f.numero}</b>{f.pieceNom&&<small>{f.pieceNom}</small>}</td><td>{f.date}</td><td>{f.fournisseurNom}</td><td><span className="fpai-category">{labels[f.categorie]||f.categorie}</span></td><td>{f.commandeIds.map(id=>commandesArtisans.find(c=>c.id===id)?.numero??id).join(', ')|| (aRapprocher?<span className="fpai-anomaly">Commande absente — à rapprocher</span>:'—')}</td><td>{argent(f.montantTtc)}</td><td>{argent(paye)}</td><td>{argent(Math.max(0,reste))}</td><td><span className={reste<=.005?'fpai-pill paid':'fpai-pill'}>{etat}</span></td><td><div className="fpai-row-actions"><button type="button" className="fpai-link" onClick={()=>ouvrirLiaison(f)}>Lier les commandes</button><button type="button" className="fpai-link" onClick={()=>{setErreur('');setPayementId(f.id);setMontantReglement(String(Math.max(0,reste)))}} disabled={reste<=.005}><Banknote size={15}/> Règlement</button>{pending.map(r=><button key={r.id} type="button" className="fpai-link" title={`Confirmer le règlement ${r.reference}`} onClick={()=>confirmerReglement(r.id)}><CheckCircle2 size={15}/> Confirmer</button>)}<button type="button" className="fpai-icon" aria-label="Supprimer facture" onClick={()=>supprimerFacture(f)}><Trash2 size={15}/></button></div></td></tr>})}{!facturesAffichees.length&&<tr><td colSpan={10} className="fpai-empty">Aucune pièce ne correspond à la recherche ou aux filtres.</td></tr>}</tbody></table></div></section>
 <section className="fpai-card fpai-history"><h2><FileText size={18}/> Historique des listes CEGI déposées</h2>
 <p className="fpai-note" style={{padding:'0 18px'}}>PDF originaux conservés dans ce navigateur. Ils ne sont pas encore synchronisés entre utilisateurs ni sauvegardés sur un serveur. Exportez-les avant tout nettoyage des données du navigateur.</p>
 {archiveErreur&&<p role="alert" className="fpai-error">{archiveErreur}</p>}
 <div className="fpai-scroll"><table><thead><tr><th>Document</th><th>Déposé le</th><th>Opérations détectées</th><th>Montant extrait</th><th>Fichier</th></tr></thead><tbody>
 {archives.map(a=><tr key={a.id}><td><b>{a.nom}</b><small>Empreinte SHA-256 : {a.id.slice(0,16)}…</small></td><td>{new Date(a.dateDepot).toLocaleString('fr-FR')}</td><td>{a.operationsDetectees}</td><td>{argent(a.totalDetecte)}</td><td><button type="button" className="fpai-link" onClick={()=>ouvrirCegi(a)}><Download size={15}/> Retrouver le PDF</button></td></tr>)}
 {!archives.length&&<tr><td colSpan={5} className="fpai-empty">Aucune liste CEGI archivée sur ce navigateur. Dépose un PDF pour créer son historique.</td></tr>}</tbody></table></div></section>
 {cegiOpen&&<ImportSelectionCegi fournisseurs={fournisseurs} commandes={commandesArtisans} onClose={()=>setCegiOpen(false)} onSave={importerOperation} onArchived={rafraichirArchives}/>}
 {creation&&<div className="fpai-overlay"><section className="fpai-modal" role="dialog" aria-modal="true"><header><h2><FileText size={20}/> Nouvelle facture</h2><button type="button" onClick={()=>setCreation(false)}><X/></button></header><form onSubmit={creer}><div className="fpai-fields"><label>Numéro facture *<input required value={numero} onChange={e=>setNumero(e.target.value)}/></label><label>Fournisseur *<select required value={fournisseurId} onChange={e=>{setFournisseurId(e.target.value);setCommandeIds([])}}><option value="">Sélectionner</option><option value="AUTRE">Autre bénéficiaire (hors BDD Fournisseurs)</option>{fournisseurs.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}</select></label>{fournisseurId==='AUTRE'&&<label>Nom du bénéficiaire *<input required value={autreBeneficiaire} onChange={e=>setAutreBeneficiaire(e.target.value)}/></label>}<label>Date facture<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Date échéance<input type="date" value={echeance} onChange={e=>setEcheance(e.target.value)}/></label><label>Catégorie<select value={categorie} onChange={e=>setCategorie(e.target.value as Categorie)}>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Montant total TTC<input type="number" step="0.01" min="0" disabled={commandeIds.length>0} value={commandeIds.length?totalCommandes:montantManuel} onChange={e=>setMontantManuel(e.target.value)}/></label><fieldset className="fpai-wide"><legend>Commandes associées (facultatif, même fournisseur)</legend><p>Sélectionne plusieurs commandes pour calculer automatiquement le montant. Chaque commande ne peut être liée qu'à une seule facture dans cette version.</p><div className="fpai-options">{commandesFournisseur.map(c=><label key={c.id}><input type="checkbox" checked={commandeIds.includes(c.id)} disabled={factures.some(f=>f.commandeIds.includes(c.id))} onChange={e=>setCommandeIds(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/>{c.numero} — {argent(montantCommande(c))}</label>)}{!commandesFournisseur.length&&<span>Aucune commande pour ce fournisseur.</span>}</div></fieldset><label>Nom du justificatif / pièce<input value={pieceNom} onChange={e=>setPieceNom(e.target.value)} placeholder="Ex. facture-fournisseur.pdf"/></label><label className="fpai-wide">Observations<textarea value={note} onChange={e=>setNote(e.target.value)} rows={2}/></label></div><p className="fpai-note">Le nom de pièce est une référence documentaire : aucun fichier PDF n'est stocké dans cette version.</p>{erreur&&<p role="alert" className="fpai-error">{erreur}</p>}<footer><button type="button" className="fpai-secondary" onClick={()=>setCreation(false)}>Annuler</button><button type="submit" className="fpai-primary">Enregistrer la facture</button></footer></form></section></div>}
 {factureALier&&<div className="fpai-overlay"><section className="fpai-modal" role="dialog" aria-modal="true" aria-labelledby="fpai-liaison-title"><header><h2 id="fpai-liaison-title">Rapprocher la pièce {factureALier.numero}</h2><button type="button" aria-label="Fermer" onClick={()=>setLiaisonId(null)}><X size={20}/></button></header><div className="fpai-fields"><label className="fpai-wide">Fournisseur de la commande<select value={liaisonFournisseur} onChange={e=>{setLiaisonFournisseur(e.target.value);setLiaisonCommandes([]);setLiaisonErreur('')}}><option value="">Choisir un fournisseur...</option>{fournisseurs.map(f=><option key={f.id} value={f.id}>{f.nom}</option>)}</select></label><fieldset className="fpai-wide"><legend>Commandes d'achats du fournisseur</legend>{!liaisonFournisseur?<p>Choisis un fournisseur pour afficher ses commandes Artisans, GMS et Industriels.</p>:!commandesALier.length?<p className="fpai-anomaly">Aucune commande trouvée pour ce fournisseur. Vérifie le module Commandes achats : fournisseur absent, mauvaise affectation ou commande non créée.</p>:<div className="fpai-orders-link">{commandesALier.map(c=>{const deja=factures.find(f=>f.id!==factureALier.id&&f.commandeIds.includes(c.id));return <label key={c.id}><input type="checkbox" checked={liaisonCommandes.includes(c.id)} disabled={Boolean(deja)} onChange={e=>setLiaisonCommandes(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/><span><strong>{c.numero}</strong> · {c.campagne} · {argent(montantCommande(c))}{deja&&<small>Déjà liée à la pièce {deja.numero}</small>}</span></label>})}</div>}</fieldset><div className="fpai-wide fpai-link-totals"><span>Montant de la pièce : <strong>{argent(factureALier.montantTtc)}</strong></span><span>Commandes sélectionnées : <strong>{argent(totalLiaison)}</strong></span></div>{facturePaiements(factureALier.id)>=factureALier.montantTtc-.005&&<p className="fpai-wide fpai-link-notice">Cette pièce est déjà réglée : après rapprochement complet, les commandes sélectionnées seront marquées « Payé ».</p>}{liaisonErreur&&<p role="alert" className="fpai-error fpai-wide">{liaisonErreur}</p>}</div><footer><button type="button" className="fpai-secondary" onClick={()=>setLiaisonId(null)}>Annuler</button><button type="button" className="fpai-primary" onClick={validerLiaison}>Enregistrer le rapprochement</button></footer></section></div>}
 {payementId&&<div className="fpai-overlay"><section className="fpai-modal fpai-modal-small" role="dialog" aria-modal="true"><header><h2><Banknote size={20}/> Enregistrer un règlement</h2><button type="button" onClick={()=>setPayementId(null)}><X/></button></header><form onSubmit={ajouterReglement}><div className="fpai-fields"><label>Montant TTC *<input required type="number" min="0.01" step="0.01" value={montantReglement} onChange={e=>setMontantReglement(e.target.value)}/></label><label>Date règlement<input required type="date" value={dateReglement} onChange={e=>setDateReglement(e.target.value)}/></label><label>Mode<select value={mode} onChange={e=>setMode(e.target.value)}><option>Virement</option><option>Chèque</option><option>Carte bancaire</option><option>Espèces</option><option>Autre</option></select></label><label>Référence pièce / virement *<input required value={reference} onChange={e=>setReference(e.target.value)}/></label><label className="fpai-wide fpai-check"><input type="checkbox" checked={reglementConfirme} onChange={e=>setReglementConfirme(e.target.checked)}/> Je confirme que le paiement a été réellement exécuté ou constaté</label></div><p className="fpai-note">Une sélection de virement CEGI ne confirme pas à elle seule l'exécution bancaire. Un règlement non confirmé n'est pas comptabilisé comme payé.</p>{erreur&&<p role="alert" className="fpai-error">{erreur}</p>}<footer><button type="button" className="fpai-secondary" onClick={()=>setPayementId(null)}>Annuler</button><button type="submit" className="fpai-primary">Enregistrer</button></footer></form></section></div>}
 </main>
}
