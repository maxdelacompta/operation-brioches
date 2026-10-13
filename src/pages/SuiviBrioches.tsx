import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Gift, HandCoins, ClipboardList, Plus, Search, Trash2, PackageCheck, Building2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useUsers } from '../contexts/UsersContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import './SuiviBrioches.css'
import { STOCK_CHANGED, STOCK_KEY, DONS_KEY, stockFor, loadStockMovements, publishBriochesChange } from '../lib/briochesStock'

type Don = {
  id: string
  donateur: string
  quantite: number
  montant: number
  mode: string
  date: string
  etablissementId?: string
  type?: 'avec' | 'sans'
}
const KEY = 'ob2026-demo-dons-contrepartie-v1'
const money = (v: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v)

function loadDons(): Don[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value.filter((d): d is Don =>
      typeof d === 'object' && d !== null && typeof d.id === 'string' &&
      typeof d.donateur === 'string' && typeof d.quantite === 'number' &&
      typeof d.montant === 'number' && typeof d.mode === 'string' && typeof d.date === 'string' &&
      (d.etablissementId === undefined || typeof d.etablissementId === 'string') &&
      (d.type === undefined || d.type === 'avec' || d.type === 'sans'))
  } catch { return [] }
}

export default function SuiviBrioches() {
  const { currentUser } = useUsers()
  const { etablissements } = useEtablissements()
  const globalAccess = currentUser?.role === 'administrateur' || currentUser?.tousEtablissements === true
  const allowed = useMemo(() => {
    if (!currentUser || currentUser.status !== 'actif') return []
    const ids = currentUser.etablissementIds?.length ? currentUser.etablissementIds : (currentUser.etablissementId ? [currentUser.etablissementId] : [])
    return globalAccess ? etablissements : etablissements.filter(e => ids.includes(e.id))
  }, [currentUser, etablissements, globalAccess])

  const [selectedId, setSelectedId] = useState('')
  const effectiveId = allowed.some(e => e.id === selectedId) ? selectedId : (allowed[0]?.id || '')
  const [dons, setDons] = useState<Don[]>(loadDons)
  const [mouvements, setMouvements] = useState(loadStockMovements)
  useEffect(() => {
    const refresh = () => { setDons(loadDons()); setMouvements(loadStockMovements()) }
    const onStorage = (e: StorageEvent) => { if (e.key === STOCK_KEY || e.key === DONS_KEY) refresh() }
    window.addEventListener(STOCK_CHANGED, refresh)
    window.addEventListener('storage', onStorage)
    return () => { window.removeEventListener(STOCK_CHANGED, refresh); window.removeEventListener('storage', onStorage) }
  }, [])
  const stockDisponible = effectiveId ? stockFor(effectiveId, mouvements, dons) : 0
  const [typeDon, setTypeDon] = useState<'avec' | 'sans'>('avec')
  const [donateur, setDonateur] = useState('')
  const [quantite, setQuantite] = useState('1')
  const [montant, setMontant] = useState('6')
  const [mode, setMode] = useState('Espèces')
  const [recherche, setRecherche] = useState('')
  const [erreur, setErreur] = useState('')
  const [showLegacy, setShowLegacy] = useState(false)

  const scopedDons = useMemo(() => dons.filter(d => d.etablissementId === effectiveId), [dons, effectiveId])
  const legacyDons = useMemo(() => dons.filter(d => !d.etablissementId), [dons])
  const affiches = showLegacy && globalAccess ? legacyDons : scopedDons
  const sums = useMemo(() => affiches.reduce((a, d) => ({ brioches: a.brioches + (d.type === 'sans' ? 0 : d.quantite), montant: a.montant + d.montant }), { brioches: 0, montant: 0 }), [affiches])
  const search = recherche.trim().toLocaleLowerCase('fr-FR')
  const visibles = affiches.filter(d => `${d.donateur} ${d.mode} ${d.date} ${d.montant} ${d.type === 'sans' ? 'sans contrepartie' : 'avec contrepartie'}`.toLocaleLowerCase('fr-FR').includes(search))
  const save = (next: Don[]) => {
    try { localStorage.setItem(KEY, JSON.stringify(next)); setDons(next); publishBriochesChange(); setErreur('') }
    catch { setErreur("Impossible d'enregistrer les dons dans ce navigateur.") }
  }
  function enregistrer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!effectiveId || !allowed.some(et => et.id === effectiveId)) { setErreur('Aucun établissement autorisé sélectionné.'); return }
    const q = typeDon === 'sans' ? 0 : Number(quantite)
    const m = Number(montant)
    if ((typeDon === 'avec' && (!Number.isInteger(q) || q < 1)) || !Number.isFinite(m) || m <= 0) {
      setErreur('Indiquez un montant positif et, si nécessaire, une quantité entière de brioches.'); return
    }
    if (typeDon === 'avec' && stockDisponible < q) { setErreur(`Stock insuffisant : ${stockDisponible} brioche(s) disponible(s) pour cet établissement.`); return }
    save([{ id: crypto.randomUUID(), etablissementId: effectiveId, type: typeDon, donateur: donateur.trim() || 'Donateur anonyme', quantite: q, montant: Math.round(m * 100) / 100, mode, date: new Date().toISOString() }, ...dons])
    setDonateur(''); setQuantite('1'); setMontant('6')
  }
  const title = allowed.find(e => e.id === effectiveId)?.nom

  return <main className="sb-page">
    <PageHeader eyebrow="ÉTABLISSEMENTS / SUIVI BRIOCHES" title="Suivi Brioches" description="Enregistrement et suivi des dons avec ou sans contrepartie" illustration />
    <div className="sb-demo-note">Mode démonstration : les dons sont enregistrés uniquement dans ce navigateur et sont synchronisés avec les stocks de ce navigateur.</div>
    <section className="sb-panel sb-selector" aria-label="Choisir un établissement">
      <label htmlFor="sb-etablissement"><Building2 size={18}/> Établissement consulté</label>
      <select id="sb-etablissement" value={effectiveId} onChange={e => { setSelectedId(e.target.value); setShowLegacy(false); setErreur('') }} disabled={!allowed.length}>
        {!allowed.length && <option value="">Aucun établissement autorisé</option>}
        {allowed.map(et => <option key={et.id} value={et.id}>{et.nom}</option>)}
      </select>
      <small>{globalAccess ? 'Accès à tous les établissements' : `${allowed.length} établissement(s) autorisé(s)`} — les chiffres et l'historique correspondent à l'établissement sélectionné.</small>
    </section>
    {globalAccess && legacyDons.length > 0 && <div className="sb-demo-note">
      {legacyDons.length} ancien(s) don(s) sans établissement associé. <button type="button" className="sb-legacy-button" onClick={() => setShowLegacy(v => !v)}>{showLegacy ? `Revenir à ${title || 'l’établissement'}` : 'Consulter les dons non attribués'}</button>
    </div>}
    <section className="sb-kpis" aria-label="Indicateurs des dons">
      <article className="sb-kpi"><span className="sb-kpi-icon sb-orange"><Gift size={24}/></span><div><span>Brioches remises</span><strong>{sums.brioches}</strong></div></article>
      <article className="sb-kpi"><span className="sb-kpi-icon sb-blue"><HandCoins size={24}/></span><div><span>Dons collectés</span><strong>{money(sums.montant)}</strong></div></article>
      <article className="sb-kpi"><span className="sb-kpi-icon sb-green"><ClipboardList size={24}/></span><div><span>Dons enregistrés</span><strong>{affiches.length}</strong></div></article>
    </section>
    <div className="sb-columns">
      <section className="sb-panel"><h2><Plus size={20}/> Enregistrer un don</h2>
        <form className="sb-form" onSubmit={enregistrer}>
          <fieldset className="sb-types"><legend>Type de don</legend>
            <label><input type="radio" name="type-don" checked={typeDon === 'avec'} onChange={() => setTypeDon('avec')}/> Avec contrepartie</label>
            <label><input type="radio" name="type-don" checked={typeDon === 'sans'} onChange={() => setTypeDon('sans')}/> Sans contrepartie</label>
          </fieldset>
          <label>Donateur (facultatif)<input value={donateur} onChange={e => setDonateur(e.target.value)} placeholder="Donateur anonyme" maxLength={120}/></label>
          <div className="sb-field-grid">
            {typeDon === 'avec' && <label>Nombre de brioches remises<input type="number" min="1" step="1" required value={quantite} onChange={e => setQuantite(e.target.value)}/></label>}
            <label>Montant du don (€)<input type="number" min="0.01" step="0.01" required value={montant} onChange={e => setMontant(e.target.value)}/></label>
          </div>
          {typeDon === 'avec' && <p className="sb-help">Stock disponible pour cet établissement : <strong>{stockDisponible}</strong> brioche(s).</p>}
          {typeDon === 'sans' && <p className="sb-help">Aucune brioche n'est remise : la quantité enregistrée est de 0.</p>}
          <label>Mode de règlement<select value={mode} onChange={e => setMode(e.target.value)}><option>Espèces</option><option>Carte bancaire</option><option>Chèque</option><option>Virement</option><option>Autre</option></select></label>
          {erreur && <p className="sb-error" role="alert">{erreur}</p>}
          <button className="sb-primary" type="submit" disabled={!effectiveId || showLegacy}><Plus size={18}/> Enregistrer le don</button>
        </form>
      </section>
      <section className="sb-panel"><h2><PackageCheck size={20}/> Résumé des dons</h2><dl className="sb-summary">
        <div><dt>Brioches remises</dt><dd>{sums.brioches}</dd></div><div><dt>Montant total des dons</dt><dd>{money(sums.montant)}</dd></div><div><dt>Montant moyen par don</dt><dd>{money(affiches.length ? sums.montant / affiches.length : 0)}</dd></div><div><dt>Dernier enregistrement</dt><dd>{affiches.length ? new Date([...affiches].sort((a,b) => b.date.localeCompare(a.date))[0].date).toLocaleString('fr-FR') : 'Aucun don'}</dd></div>
      </dl></section>
    </div>
    <section className="sb-panel sb-history"><div className="sb-history-head"><h2><ClipboardList size={20}/> Historique des dons {showLegacy ? 'non attribués' : `— ${title ?? ''}`}</h2><label className="sb-search"><Search size={18}/><input aria-label="Rechercher dans les dons" placeholder="Rechercher..." value={recherche} onChange={e => setRecherche(e.target.value)}/></label></div>
      <div className="sb-table-scroll"><table><thead><tr><th>Date / Heure</th><th>Donateur</th><th>Type</th><th>Brioches remises</th><th>Montant du don</th><th>Règlement</th><th>Action</th></tr></thead><tbody>{visibles.map(d => <tr key={d.id}><td>{new Date(d.date).toLocaleString('fr-FR')}</td><td>{d.donateur}</td><td>{d.type === 'sans' ? 'Sans contrepartie' : 'Avec contrepartie'}</td><td>{d.type === 'sans' ? 0 : d.quantite}</td><td>{money(d.montant)}</td><td>{d.mode}</td><td><button type="button" className="sb-delete" aria-label={`Supprimer le don de ${d.donateur}`} title="Supprimer le don" onClick={() => { if (window.confirm('Supprimer cet enregistrement de démonstration ?')) save(dons.filter(item => item.id !== d.id)) }}><Trash2 size={17}/></button></td></tr>)}</tbody></table>{visibles.length === 0 && <p className="sb-empty">Aucun don à afficher.</p>}</div>
    </section>
  </main>
}
