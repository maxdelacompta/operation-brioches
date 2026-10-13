import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Archive, ArrowLeft, Download, Eye, History, Mail, Pencil, Phone, Plus, Search, Users, X } from 'lucide-react'
import './Benevoles.css'

const SECTEURS = ['Lunéville', 'Baccarat', 'Briey', 'Toul', 'Liverdun', 'Vosges', 'Autres'] as const
const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const CRENEAUX = JOURS.flatMap(jour => [`${jour} matin`, `${jour} après-midi`])

type Benevole = { id: string; nom: string; prenom: string; email: string; telephone: string; commune: string; mairieIds: string[]; mission: string; secteur: string; secteurAutre: string; disponibilites: string; statut: 'Actif' | 'Inactif'; notes: string; createdAt: string }
type FormData = Omit<Benevole, 'id'|'createdAt'>
const KEY = 'ob-bdd-benevoles-v1'
const HISTORY_KEY = 'ob-bdd-benevoles-history-v1'
type HistoryEntry = { id: string; benevoleId: string; date: string; action: string; detail: string }
function loadHistory(): HistoryEntry[] { try { const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); return Array.isArray(value) ? value : [] } catch { return [] } }
const empty: FormData = { nom:'', prenom:'', email:'', telephone:'', commune:'', mairieIds:[], mission:'', secteur:'', secteurAutre:'', disponibilites:'', statut:'Actif', notes:'' }
function load(): Benevole[] { try { const raw = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(raw) ? raw.filter((x: Benevole) => x && typeof x.id === 'string' && typeof x.nom === 'string').map((x: Benevole) => ({...x, mairieIds: Array.isArray(x.mairieIds)?x.mairieIds:[], secteur:x.secteur || '', secteurAutre:x.secteurAutre || '', disponibilites:x.disponibilites || ''})) : [] } catch { return [] } }
function csvCell(value: string) { return '"' + value.replace(/"/g,'""') + '"' }
export default function Benevoles() {
  const [items,setItems] = useState<Benevole[]>(load)
  const [query,setQuery] = useState('')
  const [filter,setFilter] = useState('Tous')
  const [editId,setEditId] = useState<string|null>(null)
  const [open,setOpen] = useState(false)
  const [form,setForm] = useState<FormData>(empty)
  const [error,setError] = useState('')
  const [selectedId,setSelectedId] = useState<string|null>(null)
  const [history,setHistory] = useState<HistoryEntry[]>(loadHistory)
  const selected = items.find(b=>b.id===selectedId)
  const log = (benevoleId:string,action:string,detail:string) => setHistory(old=>[{id:crypto.randomUUID(),benevoleId,date:new Date().toISOString(),action,detail},...old])
  useEffect(()=>{ try { localStorage.setItem(KEY,JSON.stringify(items)) } catch { /* données locales */ } },[items])
  useEffect(()=>{ try { localStorage.setItem(HISTORY_KEY,JSON.stringify(history)) } catch { /* données locales */ } },[history])
  const filtered = useMemo(()=>items.filter(b=> (filter==='Tous'||b.statut===filter) && [b.nom,b.prenom,b.commune,b.mission].join(' ').toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))).sort((a,b)=>a.nom.localeCompare(b.nom,'fr')), [items,filter,query])
  const startNew=()=>{setEditId(null);setForm({...empty,mairieIds:[]});setError('');setOpen(true)}
  const startEdit=(b:Benevole)=>{setEditId(b.id);setForm({nom:b.nom,prenom:b.prenom,email:b.email,telephone:b.telephone,commune:b.commune,mairieIds:[...b.mairieIds],mission:b.mission,secteur:b.secteur||'',secteurAutre:b.secteurAutre||'',disponibilites:b.disponibilites||'',statut:b.statut,notes:b.notes});setError('');setOpen(true)}
  const save=(e:FormEvent)=>{
    e.preventDefault()
    if(!form.nom.trim()||!form.prenom.trim()){setError('Le nom et le prénom sont obligatoires.');return}
    const clean={...form,secteurAutre:form.secteur==='Autres'?form.secteurAutre.trim():'',nom:form.nom.trim(),prenom:form.prenom.trim()}
    if(editId){
      setItems(old=>old.map(b=>b.id===editId?{...b,...clean}:b))
      log(editId,'Fiche modifiée','Informations du bénévole mises à jour')
    }else{
      const id=crypto.randomUUID()
      setItems(old=>[{...clean,id,createdAt:new Date().toISOString()},...old])
      log(id,'Fiche créée','Création de la fiche bénévole')
      setSelectedId(id)
    }
    setOpen(false)
  }
  const toggleStatus=(b:Benevole)=>{
    const statut=b.statut==='Actif'?'Inactif':'Actif'
    setItems(old=>old.map(x=>x.id===b.id?{...x,statut}:x))
    log(b.id,'Statut modifié',`Statut passé à ${statut}`)
  }
  const exportCsv=()=>{const rows=[['Nom','Prénom','E-mail','Téléphone','Commune','Mission','Secteur','Disponibilités','Statut'],...filtered.map(b=>[b.nom,b.prenom,b.email,b.telephone,b.commune,b.mission,b.secteur==='Autres'?(b.secteurAutre||'Autres'):b.secteur,b.disponibilites,b.statut])];const blob=new Blob(['\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='ob2026-benevoles.csv';a.click();URL.revokeObjectURL(url)}
  return <div className="bv-page">
    <header className="bv-header"><div><span className="bv-eyebrow">BASE DE DONNÉES</span><h1>Bénévoles</h1><p>Consultez, recherchez et gérez les fiches des bénévoles de l’Opération Brioches.</p></div><button className="bv-primary" onClick={startNew}><Plus size={17}/> Ajouter un bénévole</button></header>

    <section className="bv-card"><div className="bv-tools"><span className="bv-results"><strong>{filtered.length}</strong> résultat(s)</span><div className="bv-search"><Search size={18}/><input aria-label="Rechercher un bénévole" placeholder="Rechercher un nom, une commune..." value={query} onChange={e=>setQuery(e.target.value)}/></div><select aria-label="Filtrer par statut" value={filter} onChange={e=>setFilter(e.target.value)}><option>Tous</option><option>Actif</option><option>Inactif</option></select><button className="bv-outline" onClick={exportCsv}><Download size={16}/> Export CSV</button></div><div className="bv-scroll"><table className="bv-donateurs-table"><thead><tr><th>Bénévole</th><th>Contact</th><th>Commune</th><th>Mission</th><th>Statut</th><th>Actions</th></tr></thead><tbody>{filtered.map(b=><tr key={b.id}><td><button className="bv-name-link" onClick={()=>setSelectedId(b.id)}>{b.prenom} {b.nom}</button></td><td><div className="bv-contact">{b.email&&<span><Mail size={13}/>{b.email}</span>}{b.telephone&&<span><Phone size={13}/>{b.telephone}</span>}</div></td><td>{b.commune||'—'}</td><td>{b.mission||'—'}</td><td><span className={'bv-status '+(b.statut==='Actif'?'active':'inactive')}>{b.statut}</span></td><td><button className="bv-icon" title="Voir la fiche" aria-label={'Voir la fiche de '+b.prenom+' '+b.nom} onClick={()=>setSelectedId(b.id)}><Eye size={17}/></button><button className="bv-icon" title="Modifier" aria-label={'Modifier '+b.prenom+' '+b.nom} onClick={()=>startEdit(b)}><Pencil size={17}/></button><button className="bv-icon" title={b.statut==='Actif'?'Désactiver':'Réactiver'} aria-label={'Modifier le statut de '+b.prenom+' '+b.nom} onClick={()=>toggleStatus(b)}><Archive size={17}/></button></td></tr>)}</tbody></table>{filtered.length===0&&<div className="bv-empty">Aucun bénévole trouvé. Utilisez « Ajouter un bénévole » pour créer une fiche.</div>}</div><footer className="bv-footer">{filtered.length} bénévole(s) affiché(s) • Données de démonstration enregistrées sur ce navigateur</footer></section>
    {selected&&<div className="bv-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedId(null)}}><div className="bv-modal bv-detail-modal" role="dialog" aria-modal="true" aria-label={'Fiche de '+selected.prenom+' '+selected.nom}>
      <header><div><span className="bv-eyebrow">BASE DE DONNÉES · BÉNÉVOLES</span><h2>{selected.prenom} {selected.nom}</h2></div><button className="bv-icon" onClick={()=>setSelectedId(null)} aria-label="Fermer"><X/></button></header>
      <div className="bv-detail-body">
        <div className="bv-detail-top"><span className={'bv-status '+(selected.statut==='Actif'?'active':'inactive')}>{selected.statut}</span><button className="bv-outline" onClick={()=>{startEdit(selected);setSelectedId(null)}}><Pencil size={15}/> Modifier la fiche</button></div>
        <div className="bv-detail-grid">
          <div><small>E-mail</small><strong>{selected.email||'—'}</strong></div><div><small>Téléphone</small><strong>{selected.telephone||'—'}</strong></div>
          <div><small>Commune</small><strong>{selected.commune||'—'}</strong></div><div><small>Mission</small><strong>{selected.mission||'—'}</strong></div>
          <div><small>Secteur</small><strong>{selected.secteur==='Autres'?(selected.secteurAutre||'Autres'):(selected.secteur||'—')}</strong></div><div><small>Disponibilités</small><strong>{selected.disponibilites||'—'}</strong></div>
        </div>
        {selected.notes&&<div className="bv-detail-notes"><small>Notes</small><p>{selected.notes}</p></div>}
        <div className="bv-history-heading"><History size={19}/><h3>Historique du bénévole</h3></div>
        <div className="bv-timeline">
          {history.filter(h=>h.benevoleId===selected.id).sort((a,b)=>b.date.localeCompare(a.date)).map(h=><div className="bv-event" key={h.id}><span className="bv-event-dot"/><div><strong>{h.action}</strong><small>{new Date(h.date).toLocaleString('fr-FR')}</small><p>{h.detail}</p></div></div>)}
          <div className="bv-event"><span className="bv-event-dot"/><div><strong>Fiche bénévole créée</strong><small>{selected.createdAt?new Date(selected.createdAt).toLocaleString('fr-FR'):'Date inconnue'}</small><p>Enregistrement initial dans la BDD Bénévoles.</p></div></div>
        </div>
        <p className="bv-history-note">L'historique reprend les actions enregistrées dans ce navigateur. Les affectations aux stands et aux campagnes seront affichées lorsqu'elles seront reliées à cette fiche.</p>
      </div>
    </div></div>}
    {open&&<div className="bv-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><div className="bv-modal" role="dialog" aria-modal="true" aria-label={editId?'Modifier un bénévole':'Ajouter un bénévole'}><header><div><span className="bv-eyebrow">FICHE BÉNÉVOLE</span><h2>{editId?'Modifier un bénévole':'Nouveau bénévole'}</h2></div><button className="bv-icon" onClick={()=>setOpen(false)} aria-label="Fermer"><X/></button></header><form onSubmit={save}><div className="bv-fields"><label>Nom *<input required value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></label><label>Prénom *<input required value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value}))}/></label><label>E-mail<input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></label><label>Téléphone<input value={form.telephone} onChange={e=>setForm(f=>({...f,telephone:e.target.value}))}/></label><label>Commune<input value={form.commune} onChange={e=>setForm(f=>({...f,commune:e.target.value}))}/></label><label>Statut<select value={form.statut} onChange={e=>setForm(f=>({...f,statut:e.target.value as FormData['statut']}))}><option>Actif</option><option>Inactif</option></select></label><label>Mission principale<input placeholder="Distribution, collecte, logistique..." value={form.mission} onChange={e=>setForm(f=>({...f,mission:e.target.value}))}/></label><label>Secteur géographique<select value={form.secteur} onChange={e=>setForm(f=>({...f,secteur:e.target.value,secteurAutre:e.target.value==='Autres'?f.secteurAutre:''}))}><option value="">Sélectionner un secteur</option>{SECTEURS.map(secteur=><option key={secteur} value={secteur}>{secteur}</option>)}</select></label>{form.secteur==='Autres'&&<label>Préciser le secteur<input placeholder="Nom du secteur" value={form.secteurAutre} onChange={e=>setForm(f=>({...f,secteurAutre:e.target.value}))}/></label>}<label>Disponibilités<details className="bv-availability" style={{position:'relative'}}><summary style={{cursor:'pointer',border:'1px solid #d4dfec',borderRadius:10,padding:'12px 14px',background:'#fff',fontWeight:500}}>{form.disponibilites?`${form.disponibilites.split(',').filter(Boolean).length} créneau(x) sélectionné(s)`:'Choisir les disponibilités ▾'}</summary><div style={{maxHeight:220,overflowY:'auto',border:'1px solid #d4dfec',borderRadius:10,padding:12,marginTop:5,background:'#fff'}}>{CRENEAUX.map(creneau=><label key={creneau} style={{display:'flex',flexDirection:'row',alignItems:'center',gap:10,marginBottom:8,fontWeight:400}}><input type="checkbox" style={{width:16,height:16,margin:0}} checked={form.disponibilites.split(',').map(s=>s.trim()).includes(creneau)} onChange={e=>setForm(f=>{const values=f.disponibilites.split(',').map(s=>s.trim()).filter(Boolean);return {...f,disponibilites:(e.target.checked?[...values,creneau]:values.filter(v=>v!==creneau)).join(', ')}})}/>{creneau}</label>)}</div></details></label></div><label className="bv-notes">Notes<textarea rows={3} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></label>{error&&<p role="alert" className="bv-error">{error}</p>}<div className="bv-actions"><button type="button" className="bv-outline" onClick={()=>setOpen(false)}><ArrowLeft size={16}/> Annuler</button><button type="submit" className="bv-primary">{editId?'Enregistrer les modifications':'Créer la fiche'}</button></div></form></div></div>}
  </div>
}
