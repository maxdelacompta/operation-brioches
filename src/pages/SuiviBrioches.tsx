import { useMemo, useState } from 'react'
import { Gift, HandCoins, ClipboardList, Plus, Search, Trash2, PackageCheck } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import './SuiviBrioches.css'

type Don = { id: string; donateur: string; quantite: number; montant: number; mode: string; date: string }
const KEY = 'ob2026-demo-dons-contrepartie-v1'
function initialDons(): Don[] {
  try { const saved = localStorage.getItem(KEY); const data: unknown = saved ? JSON.parse(saved) : []; return Array.isArray(data) ? data.filter((d): d is Don => typeof d === 'object' && d !== null && typeof d.id === 'string' && typeof d.montant === 'number' && typeof d.quantite === 'number' && typeof d.donateur === 'string' && typeof d.mode === 'string' && typeof d.date === 'string') : [] } catch { return [] }
}
const money = (value: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
export default function SuiviBrioches() {
  const [dons, setDons] = useState<Don[]>(initialDons)
  const [donateur, setDonateur] = useState('')
  const [quantite, setQuantite] = useState('1')
  const [montant, setMontant] = useState('6')
  const [mode, setMode] = useState('Espèces')
  const [recherche, setRecherche] = useState('')
  const [erreur, setErreur] = useState('')
  const sommes = useMemo(() => dons.reduce((acc, don) => ({ quantite: acc.quantite + don.quantite, montant: acc.montant + don.montant }), { quantite: 0, montant: 0 }), [dons])
  const visibles = dons.filter(d => `${d.donateur} ${d.mode} ${d.date}`.toLocaleLowerCase('fr').includes(recherche.toLocaleLowerCase('fr')))
  const maj = (next: Don[]) => { setDons(next); try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { setErreur('Stockage local indisponible : les modifications risquent de ne pas être conservées.') } }
  function enregistrer(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = Number(quantite), m = Number(montant)
    if (!Number.isInteger(q) || q < 1 || !Number.isFinite(m) || m < 0) { setErreur('Saisissez une quantité entière positive et un montant valide.'); return }
    const don: Don = { id: crypto.randomUUID(), donateur: donateur.trim() || 'Donateur anonyme', quantite: q, montant: Math.round(m * 100) / 100, mode, date: new Date().toISOString() }
    maj([don, ...dons]); setDonateur(''); setQuantite('1'); setMontant('6'); setErreur('')
  }
  return <main className="sb-page">
    <PageHeader eyebrow="ÉTABLISSEMENTS / SUIVI BRIOCHES" title="Suivi Brioches" description="Enregistrement et suivi des dons avec contrepartie" illustration />
    <div className="sb-demo-note">Mode démonstration · Les dons sont conservés uniquement dans ce navigateur, sans synchronisation avec les autres utilisateurs.</div>
    <section className="sb-kpis" aria-label="Indicateurs des dons">
      <article className="sb-kpi"><span className="sb-kpi-icon sb-orange"><Gift size={24}/></span><div><span>Brioches remises</span><strong>{sommes.quantite}</strong></div></article>
      <article className="sb-kpi"><span className="sb-kpi-icon sb-blue"><HandCoins size={24}/></span><div><span>Dons collectés</span><strong>{money(sommes.montant)}</strong></div></article>
      <article className="sb-kpi"><span className="sb-kpi-icon sb-green"><ClipboardList size={24}/></span><div><span>Dons enregistrés</span><strong>{dons.length}</strong></div></article>
    </section>
    <div className="sb-columns">
      <section className="sb-panel"><h2><Plus size={20}/> Enregistrer un don avec contrepartie</h2>
        <form className="sb-form" onSubmit={enregistrer}>
          <label>Donateur (facultatif)<input value={donateur} onChange={e => setDonateur(e.target.value)} placeholder="Donateur anonyme" maxLength={120}/></label>
          <div className="sb-field-grid"><label>Nombre de brioches remises<input type="number" min="1" step="1" required value={quantite} onChange={e => setQuantite(e.target.value)}/></label><label>Montant du don (€)<input type="number" min="0" step="0.01" required value={montant} onChange={e => setMontant(e.target.value)}/></label></div>
          <label>Mode de règlement<select value={mode} onChange={e => setMode(e.target.value)}><option>Espèces</option><option>Carte bancaire</option><option>Chèque</option><option>Virement</option><option>Autre</option></select></label>
          {erreur && <p className="sb-error" role="alert">{erreur}</p>}
          <button className="sb-primary" type="submit"><Plus size={18}/> Enregistrer le don</button>
        </form>
      </section>
      <section className="sb-panel"><h2><PackageCheck size={20}/> Résumé des dons</h2><dl className="sb-summary"><div><dt>Brioches remises</dt><dd>{sommes.quantite}</dd></div><div><dt>Montant total des dons</dt><dd>{money(sommes.montant)}</dd></div><div><dt>Montant moyen par don</dt><dd>{money(dons.length ? sommes.montant / dons.length : 0)}</dd></div><div><dt>Dernier enregistrement</dt><dd>{dons.length ? new Date(dons[0].date).toLocaleString('fr-FR') : 'Aucun don'}</dd></div></dl></section>
    </div>
    <section className="sb-panel sb-history"><div className="sb-history-head"><h2><ClipboardList size={20}/> Historique des dons avec contrepartie</h2><label className="sb-search"><Search size={18}/><input aria-label="Rechercher dans les dons" placeholder="Rechercher..." value={recherche} onChange={e => setRecherche(e.target.value)}/></label></div>
      <div className="sb-table-scroll"><table><thead><tr><th>Date / Heure</th><th>Donateur</th><th>Brioches remises</th><th>Montant du don</th><th>Mode de règlement</th><th>Action</th></tr></thead><tbody>{visibles.map(d => <tr key={d.id}><td>{new Date(d.date).toLocaleString('fr-FR')}</td><td>{d.donateur}</td><td>{d.quantite}</td><td>{money(d.montant)}</td><td>{d.mode}</td><td><button type="button" className="sb-delete" aria-label={`Supprimer le don de ${d.donateur}`} title="Supprimer le don" onClick={() => { if (window.confirm('Supprimer cet enregistrement de démonstration ?')) maj(dons.filter(item => item.id !== d.id)) }}><Trash2 size={17}/></button></td></tr>)}</tbody></table>{visibles.length === 0 && <p className="sb-empty">Aucun don à afficher.</p>}</div>
    </section>
  </main>
}
