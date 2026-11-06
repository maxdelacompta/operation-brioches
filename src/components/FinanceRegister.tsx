import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  AlertCircle, CheckCircle2, Download, FileSpreadsheet, LockKeyhole,
  Pencil, Plus, Search, Trash2, X,
} from 'lucide-react'
import { useObData } from '../contexts/ObDataContext'
import { getUserDisplayName, useUsers } from '../contexts/UsersContext'
import { useCampaignWriteAccess } from '../lib/useCampaignWriteAccess'
import {
  createFinanceId, financeCsv, FINANCE_STORAGE_KEYS, parseEuro,
  persistFinanceRows, readFinanceRows, totalEuro,
  type FinanceKind, type FinanceRow,
} from '../lib/financeRegister'
import { recordActivity } from '../services/activityLog'

const euros = (amount: number) => new Intl.NumberFormat('fr-FR', {
  style: 'currency', currency: 'EUR',
}).format(amount)

const OPTIONS = {
  mecenat: {
    title: 'Mécénat',
    intro: 'Suivez les soutiens financiers, matériels et en compétences apportés à la campagne.',
    label: 'Contribution',
    types: ['Financier', 'En nature', 'Compétences', 'Autre'],
    statuses: ['À confirmer', 'Confirmé', 'Clôturé'],
    final: 'Clôturé',
    initial: 'À confirmer',
    category: 'mecenat' as const,
  },
  ecarts: {
    title: 'Pertes / Écarts',
    intro: 'Déclarez, documentez et résolvez les anomalies de brioches et d’encaissements.',
    label: 'Écart',
    types: ['Brioches', 'Caisse', 'TPE', 'Chèques', 'Stocks', 'Autre'],
    statuses: ['À examiner', 'Justifié', 'Résolu'],
    final: 'Résolu',
    initial: 'À examiner',
    category: 'ecarts' as const,
  },
}

type Field = { key: keyof FinanceRow; label: string }
const EXPORT_COLS: Record<FinanceKind, Field[]> = {
  mecenat: [
    { key: 'campagne', label: 'Campagne' }, { key: 'date', label: 'Date' },
    { key: 'partenaire', label: 'Mécène / partenaire' }, { key: 'donateurId', label: 'ID donateur' },
    { key: 'nature', label: 'Nature' }, { key: 'description', label: 'Description' },
    { key: 'valeur', label: 'Valorisation (€)' }, { key: 'etablissement', label: 'Établissement / secteur' },
    { key: 'reference', label: 'Référence' }, { key: 'statut', label: 'Statut' },
  ],
  ecarts: [
    { key: 'campagne', label: 'Campagne' }, { key: 'date', label: 'Date' },
    { key: 'etablissement', label: 'Établissement / stand' }, { key: 'origine', label: 'Origine' },
    { key: 'motif', label: 'Motif / observation' }, { key: 'quantite', label: 'Quantité' },
    { key: 'valeur', label: 'Montant signé (€)' }, { key: 'reference', label: 'Référence' },
    { key: 'statut', label: 'Statut' },
  ],
}

const today = () => {
  const d = new Date()
  const adjusted = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return adjusted.toISOString().slice(0, 10)
}

function validate(row: FinanceRow, kind: FinanceKind): string | null {
  if (!row.campagne) return 'Choisissez une campagne pour cette ligne.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date || '') || Number.isNaN(Date.parse(row.date))) {
    return 'La date est obligatoire et doit être valide.'
  }
  if (kind === 'mecenat') {
    if (!row.partenaire?.trim()) return 'Renseignez le mécène ou partenaire.'
    if (!row.nature) return 'Choisissez la nature du mécénat.'
  } else {
    if (!row.etablissement?.trim()) return 'Indiquez le stand ou établissement concerné.'
    if (!row.origine) return 'Choisissez l’origine de l’écart.'
    if (!row.motif?.trim()) return 'Précisez le motif de l’écart.'
    if (row.quantite && (!/^\d+$/.test(row.quantite) || Number(row.quantite) > 10000000)) {
      return 'La quantité doit être un entier positif.'
    }
  }
  if (!row.statut) return 'Choisissez un statut.'
  const value = parseEuro(row.valeur || '')
  if (value === null || (kind === 'mecenat' && value < 0)) {
    return kind === 'mecenat'
      ? 'Saisissez une valorisation positive ou zéro (maximum deux décimales).'
      : 'Saisissez un montant signé valide (maximum deux décimales).'
  }
  return null
}

export function FinanceRegister({ kind }: { kind: FinanceKind }) {
  const config = OPTIONS[kind]
  const { selectedCampagne, campagnes, donateurs } = useObData()
  const { currentUser } = useUsers()
  const campaignWritable = useCampaignWriteAccess()
  const admin = currentUser?.role === 'administrateur'
  const campaignId = selectedCampagne?.id ?? ''
  const canEdit = campaignWritable && !!campaignId
  const [allRows, setAllRows] = useState<FinanceRow[]>(() => readFinanceRows(kind))
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [showOrphans, setShowOrphans] = useState(false)
  const [editing, setEditing] = useState<FinanceRow | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === FINANCE_STORAGE_KEYS[kind]) setAllRows(readFinanceRows(kind))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [kind])

  const orphans = useMemo(() => allRows.filter(row => !row.campagne), [allRows])
  const campaignRows = useMemo(
    () => allRows.filter(row => row.campagne === campaignId),
    [allRows, campaignId],
  )
  const visibleBase = showOrphans && admin ? orphans : campaignRows
  const filtered = useMemo(() => visibleBase.filter(row => {
    if (status && row.statut !== status) return false
    const type = kind === 'mecenat' ? row.nature : row.origine
    if (category && type !== category) return false
    const query = search.trim().toLocaleLowerCase('fr')
    return !query || EXPORT_COLS[kind].some(field => (row[field.key] || '').toLocaleLowerCase('fr').includes(query))
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [visibleBase, status, category, search, kind])

  const pending = campaignRows.filter(row => row.statut !== config.final)
  const confirmed = campaignRows.filter(row => row.statut === config.final)
  const financial = campaignRows.filter(row => row.nature === 'Financier')
  const nonFinancial = campaignRows.filter(row => row.nature && row.nature !== 'Financier')
  const stats = kind === 'mecenat' ? [
    { label: 'Contributions', value: String(campaignRows.length) },
    { label: 'Mécénat financier déclaré', value: euros(totalEuro(financial)) },
    { label: 'Valorisation non financière', value: euros(totalEuro(nonFinancial)) },
    { label: 'À confirmer', value: String(campaignRows.filter(row => row.statut === 'À confirmer').length) },
  ] : [
    { label: 'Écarts déclarés', value: String(campaignRows.length) },
    { label: 'Écarts à traiter', value: String(pending.length) },
    { label: 'Montant absolu à traiter', value: euros(totalEuro(pending, true)) },
    { label: 'Résolus', value: String(confirmed.length) },
  ]

  function store(rows: FinanceRow[], action: 'creation' | 'modification' | 'suppression', target: FinanceRow): boolean {
    if (!campaignWritable || !campaignId) return false
    // Refuser les écritures dans une autre campagne pour les non-administrateurs.
    if (!admin && target.campagne !== campaignId) return false
    try {
      persistFinanceRows(kind, rows)
      setAllRows(rows)
      recordActivity({
        actorId: currentUser?.id ?? null,
        actorName: currentUser ? getUserDisplayName(currentUser) : 'Session non identifiée',
        category: config.category,
        action,
        target: `${config.label} ${target.reference?.trim() || target.id}`,
        message: `${action === 'creation' ? 'Création' : action === 'modification' ? 'Modification' : 'Suppression'} dans ${config.title} · campagne ${target.campagne || 'non affectée'}`,
        source: 'metier',
      })
      setError('')
      setNotice('Enregistrement effectué dans le navigateur.')
      return true
    } catch {
      setError('Enregistrement impossible. Vérifiez l’espace de stockage disponible.')
      return false
    }
  }

  function startCreate() {
    if (!canEdit) return
    setError('')
    setEditing({
      id: createFinanceId(), campagne: campaignId, date: today(),
      statut: config.initial, valeur: '0',
      ...(kind === 'mecenat' ? { nature: 'Financier' } : { origine: 'Brioches' }),
    })
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !canEdit) return
    const validation = validate(editing, kind)
    if (validation) { setError(validation); return }
    if (!campagnes.some(c => c.id === editing.campagne)) {
      setError('La campagne sélectionnée est inconnue.'); return
    }
    const amount = parseEuro(editing.valeur || '')
    if (amount === null) return
    const previous = allRows.find(row => row.id === editing.id)
    const next = {
      ...editing,
      valeur: amount.toFixed(2),
      partenaire: editing.partenaire?.trim(),
      etablissement: editing.etablissement?.trim(),
      motif: editing.motif?.trim(),
      description: editing.description?.trim(),
      reference: editing.reference?.trim(),
      updatedAt: new Date().toISOString(),
      createdAt: previous?.createdAt || new Date().toISOString(),
    }
    const update = previous
      ? allRows.map(row => row.id === next.id ? next : row)
      : [...allRows, next]
    if (store(update, previous ? 'modification' : 'creation', next)) setEditing(null)
  }

  function remove(row: FinanceRow) {
    if (!canEdit || (!admin && row.campagne !== campaignId)) return
    if (!window.confirm(`Supprimer cet élément « ${row.reference || row.partenaire || row.motif || row.id} » ?`)) return
    store(allRows.filter(item => item.id !== row.id), 'suppression', row)
  }

  function advance(row: FinanceRow) {
    if (!canEdit || (!admin && row.campagne !== campaignId)) return
    const next = { ...row, statut: config.final, updatedAt: new Date().toISOString() }
    store(allRows.map(item => item.id === next.id ? next : item), 'modification', next)
  }

  function exportCsv() {
    const columns = EXPORT_COLS[kind]
    const content = financeCsv(filtered, columns.map(col => col.key), columns.map(col => col.label))
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `operation-brioche-${kind}-${campaignId.replace(/[^\w-]/g, '-') || 'sans-campagne'}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const visibleType = (row: FinanceRow) => kind === 'mecenat' ? row.nature : row.origine
  const visibleName = (row: FinanceRow) => kind === 'mecenat' ? row.partenaire : row.etablissement
  const visibleDescription = (row: FinanceRow) => kind === 'mecenat' ? row.description : row.motif

  return (
    <main className="ob-extra ob-finance-registry">
      <header className="ob-extra-header ob-finance-header">
        <div>
          <span className="ob-extra-eyebrow">DOCUMENTS · OPÉRATION BRIOCHE</span>
          <h1>{config.title}</h1>
          <p>{config.intro}</p>
          <div className="ob-finance-campaign"><FileSpreadsheet size={15} /> {selectedCampagne?.nom || 'Aucune campagne sélectionnée'}</div>
        </div>
        {!canEdit && <span className="ob-finance-lock"><LockKeyhole size={16}/> Consultation seule</span>}
      </header>

      {!campaignId && <p className="ob-finance-warning" role="status"><AlertCircle size={17}/> Sélectionne une campagne dans la Topbar pour accéder à ce registre.</p>}
      {kind === 'mecenat' && <p className="ob-finance-info">Les valorisations sont déclaratives : elles ne sont pas ajoutées aux encaissements ni à la comptabilité tant qu'un rapprochement n'a pas été validé.</p>}
      {kind === 'ecarts' && <p className="ob-finance-info">Ce registre documente les écarts. Il ne décrémente pas automatiquement les stocks, le coffre ou les comptes bancaires.</p>}

      <section className="ob-finance-stats" aria-label="Synthèse de la campagne">
        {stats.map(s => <div className="ob-finance-stat" key={s.label}><small>{s.label}</small><strong>{s.value}</strong></div>)}
      </section>

      <div className="ob-extra-toolbar ob-finance-toolbar">
        <label className="ob-extra-search" data-campaign-readonly-allow="true">
          <Search size={17}/><input type="search" aria-label="Rechercher les opérations" placeholder="Rechercher un partenaire, une référence…" value={search} onChange={e => setSearch(e.target.value)} />
        </label>
        <label className="ob-finance-select" data-campaign-readonly-allow="true">
          <span>Type</span><select aria-label="Filtrer par type" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">Tous</option>{config.types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="ob-finance-select" data-campaign-readonly-allow="true">
          <span>Statut</span><select aria-label="Filtrer par statut" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Tous</option>{config.statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <span className="ob-extra-count">{filtered.length} ligne(s)</span>
        <button type="button" className="ob-extra-btn secondary" data-campaign-readonly-allow="true" onClick={exportCsv}><Download size={17}/> Export CSV</button>
        {canEdit && !showOrphans && <button type="button" className="ob-extra-btn primary" onClick={startCreate}><Plus size={17}/> Ajouter</button>}
      </div>

      {admin && orphans.length > 0 && <div className="ob-finance-legacy" data-campaign-readonly-allow="true">
        <AlertCircle size={17} /><span>{orphans.length} ancienne(s) ligne(s) sans campagne. Leur rattachement doit être vérifié.</span>
        <button type="button" className="ob-extra-btn secondary" onClick={() => { setShowOrphans(!showOrphans); setStatus(''); setCategory('') }}>
          {showOrphans ? 'Retour à la campagne' : 'Voir les lignes à rattacher'}
        </button>
      </div>}

      {notice && <div className="ob-finance-success" role="status"><CheckCircle2 size={17}/>{notice}<button type="button" aria-label="Masquer le message" onClick={() => setNotice('')}><X size={15}/></button></div>}
      {error && <div className="ob-finance-error" role="alert"><AlertCircle size={17}/>{error}</div>}

      <div className="ob-extra-tablewrap">
        <table className="ob-finance-table"><thead><tr>
          <th>Date</th><th>{kind === 'mecenat' ? 'Mécène / partenaire' : 'Établissement / stand'}</th>
          <th>Type</th><th>{kind === 'mecenat' ? 'Contribution' : 'Motif'}</th>
          {kind === 'ecarts' && <th>Qté</th>}<th>Montant</th><th>Référence</th><th>Statut</th><th>Actions</th>
        </tr></thead><tbody>
          {filtered.length === 0 ? <tr><td colSpan={kind === 'ecarts' ? 9 : 8} className="ob-extra-empty">Aucun enregistrement pour ces critères.</td></tr> :
            filtered.map(row => <tr key={row.id}>
              <td>{row.date || '—'}</td>
              <td><strong>{visibleName(row) || '—'}</strong>{showOrphans && <small className="ob-finance-subline">Sans campagne</small>}</td>
              <td>{visibleType(row) || '—'}</td>
              <td className="ob-finance-description" title={visibleDescription(row) || ''}>{visibleDescription(row) || '—'}</td>
              {kind === 'ecarts' && <td>{row.quantite || '—'}</td>}
              <td className="ob-finance-money">{euros(parseEuro(row.valeur || '') ?? 0)}</td>
              <td>{row.reference || '—'}</td>
              <td><span className={`ob-finance-status ${row.statut === config.final ? 'done' : 'pending'}`}>{row.statut || '—'}</span></td>
              <td><div className="ob-extra-actions">
                {canEdit && <>
                  <button type="button" title="Modifier" aria-label={`Modifier ${row.reference || row.id}`} onClick={() => { setError(''); setEditing({...row}) }}><Pencil size={16}/></button>
                  {row.statut !== config.final && <button type="button" title={`Marquer ${config.final.toLowerCase()}`} aria-label={`Marquer ${config.final.toLowerCase()}`} onClick={() => advance(row)}><CheckCircle2 size={16}/></button>}
                  <button type="button" title="Supprimer" aria-label={`Supprimer ${row.reference || row.id}`} onClick={() => remove(row)}><Trash2 size={16}/></button>
                </>}
                {!canEdit && <span className="ob-finance-muted">Lecture seule</span>}
              </div></td>
            </tr>)}
        </tbody></table>
      </div>
      <p className="ob-extra-note">Stockage local dans ce navigateur. Historique des modifications enregistré dans le Journal d'activité du prototype ; aucune synchronisation multi-poste ni écriture comptable automatique.</p>

      {editing && <div className="ob-extra-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditing(null) }}>
        <form className="ob-extra-modal ob-finance-modal" role="dialog" aria-modal="true" aria-label={`Saisie ${config.title}`} onSubmit={save}>
          <div className="ob-extra-modalhead"><div><small>{config.title.toUpperCase()}</small><h2>{allRows.some(row => row.id === editing.id) ? 'Modifier un élément' : 'Nouvel élément'}</h2></div>
            <button type="button" onClick={() => setEditing(null)} aria-label="Fermer"><X size={20}/></button></div>
          <div className="ob-extra-form">
            <label><span>Campagne *</span><select required value={editing.campagne} disabled={!admin && !!editing.campagne} onChange={e => setEditing({...editing, campagne:e.target.value})}>
              <option value="">Sélectionner…</option>{campagnes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select></label>
            <label><span>Date *</span><input type="date" required value={editing.date} onChange={e => setEditing({...editing, date:e.target.value})}/></label>
            {kind === 'mecenat' ? <>
              <label><span>Donateur référencé (optionnel)</span><select value={editing.donateurId || ''} onChange={e => {
                const donor = donateurs.find(d => String(d.id) === e.target.value)
                setEditing({...editing, donateurId:e.target.value, partenaire: donor?.nom || editing.partenaire || ''})
              }}><option value="">Aucun lien</option>{donateurs.filter(d => !d.archive).map(d => <option key={d.id} value={String(d.id)}>{d.nom}</option>)}</select></label>
              <label><span>Mécène / partenaire *</span><input required value={editing.partenaire || ''} onChange={e => setEditing({...editing, partenaire:e.target.value})}/></label>
              <label><span>Nature du mécénat *</span><select required value={editing.nature || ''} onChange={e => setEditing({...editing, nature:e.target.value})}>{config.types.map(t => <option key={t}>{t}</option>)}</select></label>
              <label className="ob-finance-wide"><span>Description de la contribution</span><textarea rows={3} value={editing.description || ''} onChange={e => setEditing({...editing, description:e.target.value})}/></label>
            </> : <>
              <label><span>Établissement / stand *</span><input required value={editing.etablissement || ''} onChange={e => setEditing({...editing, etablissement:e.target.value})}/></label>
              <label><span>Origine *</span><select required value={editing.origine || ''} onChange={e => setEditing({...editing, origine:e.target.value})}>{config.types.map(t => <option key={t}>{t}</option>)}</select></label>
              <label className="ob-finance-wide"><span>Motif / observation *</span><textarea required rows={3} value={editing.motif || ''} onChange={e => setEditing({...editing, motif:e.target.value})}/></label>
              <label><span>Quantité de brioches (si concernée)</span><input type="number" min="0" step="1" value={editing.quantite || ''} onChange={e => setEditing({...editing, quantite:e.target.value})}/></label>
            </>}
            <label><span>{kind === 'mecenat' ? 'Valeur estimée (€) *' : 'Montant signé de l’écart (€) *'}</span>
              <input required inputMode="decimal" placeholder={kind === 'mecenat' ? '0,00' : '-25,00 ou 25,00'} value={editing.valeur || ''} onChange={e => setEditing({...editing, valeur:e.target.value})}/></label>
            {kind === 'mecenat' && <label><span>Établissement / secteur</span><input value={editing.etablissement || ''} onChange={e => setEditing({...editing, etablissement:e.target.value})}/></label>}
            <label><span>Référence source</span><input placeholder="N° pièce, justificatif, stand…" value={editing.reference || ''} onChange={e => setEditing({...editing, reference:e.target.value})}/></label>
            <label><span>Statut *</span><select required value={editing.statut || ''} onChange={e => setEditing({...editing, statut:e.target.value})}>{config.statuses.map(t => <option key={t}>{t}</option>)}</select></label>
          </div>
          {error && <p className="ob-finance-error" role="alert"><AlertCircle size={17}/>{error}</p>}
          <div className="ob-extra-footer"><button type="button" className="ob-extra-btn secondary" onClick={() => setEditing(null)}>Annuler</button><button type="submit" className="ob-extra-btn primary">Enregistrer</button></div>
        </form>
      </div>}
    </main>
  )
}
