import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  Archive,
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleMinus,
  Clock3,
  Download,
  Eye,
  FileCheck2,
  FileText,
  History,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Search,
  UsersRound,
  X,
} from 'lucide-react'

import { useMairies } from '../contexts/MairiesContext'
import type {
  Mairie,
  NouvelleMairie,
  ParticipationMairie,
} from '../types/mairies'
import './Mairies.css'

type FormMode = 'create' | 'edit'
type TabKey =
  | 'general'
  | 'coordonnees'
  | 'contacts'
  | 'participations'
  | 'documents'
  | 'historique'

const PARTICIPATION_LABELS: Record<ParticipationMairie, string> = {
  OUI: 'Oui',
  A_CONTACTER: 'À contacter',
  NON: 'Non',
}

function emptyMairie(nextCode: string): NouvelleMairie {
  return {
    code: nextCode,
    statut: 'ACTIVE',
    commune: '',
    nomAffiche: '',
    codeInsee: '',
    secteur: '',
    numeroVoie: '',
    adresse: '',
    cp: '',
    ville: '',
    contactNom: '',
    contactPrenom: '',
    contactFonction: '',
    email: '',
    telephone: '',
    participation: 'A_CONTACTER',
    nombreBriochesN1: null,
    modeReglement: '',
    lieuInfos: '',
    notes: '',
    participations: [],
    documents: [],
  }
}

function normalize(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function nextMairieCode(mairies: Mairie[]) {
  const max = mairies.reduce((current, mairie) => {
    const parsed = Number(mairie.code.replace(/\D/g, ''))
    return Number.isFinite(parsed) ? Math.max(current, parsed) : current
  }, 0)

  return `M-${String(max + 1).padStart(3, '0')}`
}

function formatDate(value: string) {
  if (!value) return '—'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return new Intl.DateTimeFormat('fr-FR').format(new Date(`${value}T12:00:00`))
}

function csvCell(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

export default function Mairies() {
  const {
    mairies,
    createMairie,
    updateMairie,
    archiveMairie,
    restoreMairie,
  } = useMairies()

  const [search, setSearch] = useState('')
  const [secteurFilter, setSecteurFilter] = useState('TOUS')
  const [participationFilter, setParticipationFilter] = useState<'TOUS' | ParticipationMairie>('TOUS')
  const [showArchived, setShowArchived] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [formMode, setFormMode] = useState<FormMode>('create')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<NouvelleMairie>(emptyMairie(nextMairieCode(mairies)))
  const [error, setError] = useState('')
  const [actionMenuId, setActionMenuId] = useState<string | null>(null)

  const activeMairies = useMemo(
    () => mairies.filter((item) => showArchived || item.statut === 'ACTIVE'),
    [mairies, showArchived],
  )

  const secteurs = useMemo(
    () => [
      'TOUS',
      ...Array.from(
        new Set(
          mairies
            .map((item) => item.secteur.trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, 'fr')),
    ],
    [mairies],
  )

  const filtered = useMemo(() => {
    const query = normalize(search)

    return activeMairies
      .filter((item) => secteurFilter === 'TOUS' || item.secteur === secteurFilter)
      .filter((item) => participationFilter === 'TOUS' || item.participation === participationFilter)
      .filter((item) => {
        if (!query) return true
        return normalize([
          item.code,
          item.commune,
          item.nomAffiche,
          item.codeInsee,
          item.cp,
          item.ville,
          item.secteur,
          item.contactNom,
          item.contactPrenom,
          item.contactFonction,
          item.email,
          item.telephone,
        ].join(' ')).includes(query)
      })
      .sort((a, b) => a.commune.localeCompare(b.commune, 'fr'))
  }, [activeMairies, search, secteurFilter, participationFilter])

  const stats = useMemo(() => {
    const items = mairies.filter((item) => item.statut === 'ACTIVE')
    const total = items.length
    const oui = items.filter((item) => item.participation === 'OUI').length
    const contact = items.filter((item) => item.participation === 'A_CONTACTER').length
    const non = items.filter((item) => item.participation === 'NON').length
    return { total, oui, contact, non }
  }, [mairies])

  const selected = selectedId ? mairies.find((item) => item.id === selectedId) ?? null : null

  function openCreate() {
    setFormMode('create')
    setEditingId(null)
    setForm(emptyMairie(nextMairieCode(mairies)))
    setError('')
    setModalOpen(true)
  }

  function openEdit(mairie: Mairie) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, historique: _historique, ...editable } = mairie
    setFormMode('edit')
    setEditingId(mairie.id)
    setForm(editable)
    setError('')
    setModalOpen(true)
    setActionMenuId(null)
  }

  function updateField<K extends keyof NouvelleMairie>(key: K, value: NouvelleMairie[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!form.code.trim()) {
      setError('Le code mairie est obligatoire.')
      return
    }
    if (!form.commune.trim()) {
      setError('La commune est obligatoire.')
      return
    }
    if (!form.nomAffiche.trim()) {
      setError("Le nom d'affichage est obligatoire.")
      return
    }

    const duplicate = mairies.some(
      (item) => item.code.trim().toLowerCase() === form.code.trim().toLowerCase() && item.id !== editingId,
    )
    if (duplicate) {
      setError('Ce code mairie existe déjà.')
      return
    }

    const normalized: NouvelleMairie = {
      ...form,
      code: form.code.trim(),
      commune: form.commune.trim(),
      nomAffiche: form.nomAffiche.trim(),
      codeInsee: form.codeInsee.trim(),
      secteur: form.secteur.trim(),
      numeroVoie: form.numeroVoie.trim(),
      adresse: form.adresse.trim(),
      cp: form.cp.trim(),
      ville: form.ville.trim() || form.commune.trim(),
      contactNom: form.contactNom.trim(),
      contactPrenom: form.contactPrenom.trim(),
      contactFonction: form.contactFonction.trim(),
      email: form.email.trim(),
      telephone: form.telephone.trim(),
      modeReglement: form.modeReglement.trim(),
      lieuInfos: form.lieuInfos.trim(),
      notes: form.notes.trim(),
    }

    if (formMode === 'edit' && editingId) {
      updateMairie(editingId, normalized)
    } else {
      const created = createMairie(normalized)
      setSelectedId(created.id)
    }

    setModalOpen(false)
    setEditingId(null)
  }

  function exportCsv() {
    const headers = [
      'Code',
      'Commune',
      'Nom',
      'Code INSEE',
      'CP',
      'Ville',
      'Secteur',
      'Contact',
      'Fonction',
      'Email',
      'Téléphone',
      'Participation',
      'Brioches N-1',
      'Mode règlement',
      'Lieu / infos',
    ]

    const rows = filtered.map((item) => [
      item.code,
      item.commune,
      item.nomAffiche,
      item.codeInsee,
      item.cp,
      item.ville,
      item.secteur,
      [item.contactPrenom, item.contactNom].filter(Boolean).join(' '),
      item.contactFonction,
      item.email,
      item.telephone,
      PARTICIPATION_LABELS[item.participation],
      item.nombreBriochesN1 ?? '',
      item.modeReglement,
      item.lieuInfos,
    ])

    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bdd-mairies.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (selected) {
    return (
      <MairieDetail
        mairie={selected}
        onBack={() => setSelectedId(null)}
        onEdit={() => openEdit(selected)}
        onArchive={() => {
          if (selected.statut === 'ACTIVE') archiveMairie(selected.id)
          else restoreMairie(selected.id)
        }}
      />
    )
  }

  return (
    <main className="mairies-page">
      <header className="mairies-header">
        <div>
          <span className="mairies-eyebrow">Base de données</span>
          <h1>BDD Mairies</h1>
          <p>Base de données des communes et mairies liées à l'Opération Brioches.</p>
        </div>

        <button type="button" className="mairies-primary-button" onClick={openCreate}>
          <Plus size={18} />
          Nouvelle mairie
        </button>
      </header>

      <section className="mairies-kpis">
        <Kpi icon={<Building2 size={22} />} tone="neutral" label="Total mairies" value={stats.total} />
        <Kpi icon={<UsersRound size={22} />} tone="green" label="Participantes" value={stats.oui} percent={stats.total ? Math.round((stats.oui / stats.total) * 100) : 0} />
        <Kpi icon={<Clock3 size={22} />} tone="orange" label="À contacter" value={stats.contact} percent={stats.total ? Math.round((stats.contact / stats.total) * 100) : 0} />
        <Kpi icon={<CircleMinus size={22} />} tone="red" label="Non participantes" value={stats.non} percent={stats.total ? Math.round((stats.non / stats.total) * 100) : 0} />
      </section>

      <section className="mairies-card">
        <div className="mairies-toolbar">
          <label className="mairies-search">
            <Search size={18} />
            <input
              type="text"
              placeholder="Rechercher une mairie, une commune, un contact..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label className="mairies-filter">
            <span>Secteur</span>
            <select value={secteurFilter} onChange={(event) => setSecteurFilter(event.target.value)}>
              {secteurs.map((secteur) => (
                <option key={secteur} value={secteur}>
                  {secteur === 'TOUS' ? 'Tous les secteurs' : secteur}
                </option>
              ))}
            </select>
          </label>

          <label className="mairies-filter">
            <span>Participation</span>
            <select
              value={participationFilter}
              onChange={(event) => setParticipationFilter(event.target.value as 'TOUS' | ParticipationMairie)}
            >
              <option value="TOUS">Tous</option>
              <option value="OUI">Oui</option>
              <option value="A_CONTACTER">À contacter</option>
              <option value="NON">Non</option>
            </select>
          </label>

          <button type="button" className="mairies-secondary-button" onClick={exportCsv}>
            <Download size={17} />
            Exporter
          </button>
        </div>

        <div className="mairies-subtoolbar">
          <strong>
            {filtered.length} mairie{filtered.length > 1 ? 's' : ''}
          </strong>
          <label>
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            Afficher les archivées
          </label>
          <span>Double-cliquez sur une ligne pour ouvrir la fiche</span>
        </div>

        <div className="mairies-table-wrapper">
          <table className="mairies-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Commune</th>
                <th>CP</th>
                <th>Secteur</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Participation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mairie) => (
                <tr
                  key={mairie.id}
                  className={mairie.statut === 'ARCHIVEE' ? 'archived' : ''}
                  onDoubleClick={() => setSelectedId(mairie.id)}
                >
                  <td className="mairie-code">{mairie.code}</td>
                  <td>
                    <strong>{mairie.nomAffiche}</strong>
                    <small>{mairie.commune}</small>
                  </td>
                  <td>{mairie.cp || '—'}</td>
                  <td>{mairie.secteur || '—'}</td>
                  <td>{[mairie.contactPrenom, mairie.contactNom].filter(Boolean).join(' ') || mairie.contactFonction || '—'}</td>
                  <td>{mairie.email || '—'}</td>
                  <td>{mairie.telephone || '—'}</td>
                  <td><ParticipationBadge value={mairie.participation} /></td>
                  <td>
                    <div className="mairies-actions">
                      <button type="button" title="Voir la fiche" onClick={() => setSelectedId(mairie.id)}>
                        <Eye size={16} />
                      </button>
                      <button type="button" title="Modifier" onClick={() => openEdit(mairie)}>
                        <Pencil size={16} />
                      </button>
                      <div className="mairies-action-menu-wrap">
                        <button type="button" title="Plus" onClick={() => setActionMenuId((current) => current === mairie.id ? null : mairie.id)}>
                          <MoreVertical size={16} />
                        </button>
                        {actionMenuId === mairie.id && (
                          <div className="mairies-action-menu">
                            <button
                              type="button"
                              onClick={() => {
                                if (mairie.statut === 'ACTIVE') archiveMairie(mairie.id)
                                else restoreMairie(mairie.id)
                                setActionMenuId(null)
                              }}
                            >
                              <Archive size={15} />
                              {mairie.statut === 'ACTIVE' ? 'Archiver' : 'Restaurer'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="mairies-empty">Aucune mairie ne correspond aux critères.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen && (
        <MairieFormModal
          mode={formMode}
          form={form}
          error={error}
          onClose={() => setModalOpen(false)}
          onSubmit={submit}
          onUpdate={updateField}
        />
      )}
    </main>
  )
}

function MairieDetail({
  mairie,
  onBack,
  onEdit,
  onArchive,
}: {
  mairie: Mairie
  onBack: () => void
  onEdit: () => void
  onArchive: () => void
}) {
  const [tab, setTab] = useState<TabKey>('general')

  return (
    <main className="mairies-page">
      <button type="button" className="mairies-back-button" onClick={onBack}>
        <ArrowLeft size={18} />
        Retour à la liste
      </button>

      <section className="mairie-profile">
        <div className="mairie-avatar"><Building2 size={30} /></div>
        <div className="mairie-profile-info">
          <span className="mairies-eyebrow">Mairie #{mairie.code}</span>
          <h1>{mairie.nomAffiche}</h1>
          <div className="mairie-profile-badges">
            <span>Commune</span>
            <span className={mairie.statut === 'ACTIVE' ? 'active' : 'archived'}>
              {mairie.statut === 'ACTIVE' ? 'Active' : 'Archivée'}
            </span>
            <ParticipationBadge value={mairie.participation} />
          </div>
        </div>

        <div className="mairie-profile-actions">
          <button type="button" className="mairies-secondary-button" onClick={onArchive}>
            <Archive size={16} />
            {mairie.statut === 'ACTIVE' ? 'Archiver' : 'Restaurer'}
          </button>
          <button type="button" className="mairies-primary-button" onClick={onEdit}>
            <Pencil size={17} />
            Modifier la fiche
          </button>
        </div>
      </section>

      <nav className="mairie-tabs">
        {[
          ['general', 'Vue générale'],
          ['coordonnees', 'Coordonnées'],
          ['contacts', 'Contacts'],
          ['participations', 'Participations OB'],
          ['documents', 'Documents'],
          ['historique', 'Historique'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key as TabKey)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === 'general' && <GeneralTab mairie={mairie} />}
      {tab === 'coordonnees' && <CoordonneesTab mairie={mairie} />}
      {tab === 'contacts' && <ContactsTab mairie={mairie} />}
      {tab === 'participations' && <ParticipationsTab mairie={mairie} />}
      {tab === 'documents' && <DocumentsTab mairie={mairie} />}
      {tab === 'historique' && <HistoriqueTab mairie={mairie} />}
    </main>
  )
}

function GeneralTab({ mairie }: { mairie: Mairie }) {
  return (
    <>
      <section className="mairie-detail-grid mairie-detail-grid-four">
        <DetailCard title="Identité" icon={<Building2 size={18} />}>
          <InfoRow label="Code mairie" value={mairie.code} />
          <InfoRow label="Commune" value={mairie.commune} />
          <InfoRow label="Code INSEE" value={mairie.codeInsee || '—'} />
          <InfoRow label="Secteur" value={mairie.secteur || '—'} />
        </DetailCard>

        <DetailCard title="Adresse" icon={<MapPin size={18} />}>
          <InfoRow label="Adresse" value={[mairie.numeroVoie, mairie.adresse].filter(Boolean).join(' ') || '—'} />
          <InfoRow label="Code postal" value={mairie.cp || '—'} />
          <InfoRow label="Ville" value={mairie.ville || '—'} />
          <div className="mairie-map-placeholder"><MapPin size={22} /><span>{mairie.commune}</span></div>
        </DetailCard>

        <DetailCard title="Contact" icon={<UsersRound size={18} />}>
          <InfoRow label="Contact" value={[mairie.contactPrenom, mairie.contactNom].filter(Boolean).join(' ') || '—'} />
          <InfoRow label="Fonction" value={mairie.contactFonction || '—'} />
          <InfoRow label="Email" value={mairie.email || '—'} icon={<Mail size={14} />} />
          <InfoRow label="Téléphone" value={mairie.telephone || '—'} icon={<Phone size={14} />} />
        </DetailCard>

        <DetailCard title="Opération Brioches" icon={<CheckCircle2 size={18} />}>
          <InfoRow label="Participation" value={PARTICIPATION_LABELS[mairie.participation]} />
          <InfoRow label="Nb brioches N-1" value={String(mairie.nombreBriochesN1 ?? '—')} />
          <InfoRow label="Mode de règlement" value={mairie.modeReglement || '—'} />
          <InfoRow label="Lieu / infos" value={mairie.lieuInfos || '—'} />
        </DetailCard>
      </section>

      <section className="mairie-bottom-grid">
        <DetailCard title="Documents et informations complémentaires" icon={<FileCheck2 size={18} />}>
          <div className="mairie-document-summary">
            <DocumentSummary label="Convention" document={mairie.documents.find((item) => item.type === 'CONVENTION')} />
            <DocumentSummary label="Autorisation" document={mairie.documents.find((item) => item.type === 'AUTORISATION')} />
            <div className="mairie-document-summary-item">
              <History size={16} />
              <div><strong>Historique</strong><small>{mairie.historique.length} événement(s)</small></div>
            </div>
          </div>
        </DetailCard>

        <DetailCard title="Notes" icon={<FileText size={18} />}>
          <p className="mairie-notes">{mairie.notes || 'Aucune note pour cette mairie.'}</p>
        </DetailCard>
      </section>
    </>
  )
}

function CoordonneesTab({ mairie }: { mairie: Mairie }) {
  return (
    <section className="mairie-detail-grid">
      <DetailCard title="Identité administrative" icon={<Building2 size={18} />}>
        <InfoRow label="Code mairie" value={mairie.code} />
        <InfoRow label="Nom" value={mairie.nomAffiche} />
        <InfoRow label="Commune" value={mairie.commune} />
        <InfoRow label="Code INSEE" value={mairie.codeInsee || '—'} />
        <InfoRow label="Secteur" value={mairie.secteur || '—'} />
      </DetailCard>
      <DetailCard title="Adresse" icon={<MapPin size={18} />}>
        <InfoRow label="N° de voie" value={mairie.numeroVoie || '—'} />
        <InfoRow label="Adresse" value={mairie.adresse || '—'} />
        <InfoRow label="Code postal" value={mairie.cp || '—'} />
        <InfoRow label="Ville" value={mairie.ville || '—'} />
      </DetailCard>
    </section>
  )
}

function ContactsTab({ mairie }: { mairie: Mairie }) {
  return (
    <section className="mairie-detail-grid">
      <DetailCard title="Contact principal" icon={<UsersRound size={18} />}>
        <InfoRow label="Nom" value={mairie.contactNom || '—'} />
        <InfoRow label="Prénom" value={mairie.contactPrenom || '—'} />
        <InfoRow label="Fonction" value={mairie.contactFonction || '—'} />
        <InfoRow label="Email" value={mairie.email || '—'} icon={<Mail size={14} />} />
        <InfoRow label="Téléphone" value={mairie.telephone || '—'} icon={<Phone size={14} />} />
      </DetailCard>
    </section>
  )
}

function ParticipationsTab({ mairie }: { mairie: Mairie }) {
  return (
    <section className="mairie-list-card">
      <header><h2>Participations Opération Brioches</h2><span>{mairie.participations.length} campagne(s)</span></header>
      {mairie.participations.length > 0 ? mairie.participations.map((item) => (
        <article key={item.id} className="mairie-list-row">
          <div><strong>{item.campagne}</strong><small>{item.lieuInfos || 'Lieu non renseigné'}</small></div>
          <ParticipationBadge value={item.statut} />
          <div><strong>{item.nombreBrioches ?? '—'}</strong><small>brioches</small></div>
          <div><strong>{item.modeReglement || '—'}</strong><small>règlement</small></div>
        </article>
      )) : <EmptySection text="Aucune participation historique enregistrée." />}
    </section>
  )
}

function DocumentsTab({ mairie }: { mairie: Mairie }) {
  return (
    <section className="mairie-list-card">
      <header><h2>Documents</h2><span>{mairie.documents.length} document(s)</span></header>
      {mairie.documents.length > 0 ? mairie.documents.map((item) => (
        <article key={item.id} className="mairie-list-row">
          <FileText size={18} />
          <div><strong>{item.libelle}</strong><small>{formatDate(item.date)}</small></div>
          <span className={`mairie-document-status ${item.statut === 'OUI' ? 'yes' : 'no'}`}>{item.statut === 'OUI' ? 'Reçu' : 'Manquant'}</span>
          <div><small>{item.remarque || '—'}</small></div>
        </article>
      )) : <EmptySection text="Aucun document enregistré." />}
    </section>
  )
}

function HistoriqueTab({ mairie }: { mairie: Mairie }) {
  return (
    <section className="mairie-list-card">
      <header><h2>Historique</h2><span>{mairie.historique.length} événement(s)</span></header>
      {mairie.historique.length > 0 ? mairie.historique.map((item) => (
        <article key={item.id} className="mairie-history-row">
          <History size={17} />
          <div><strong>{item.libelle}</strong><small>{formatDate(item.date)}</small></div>
        </article>
      )) : <EmptySection text="Aucun historique enregistré." />}
    </section>
  )
}

function MairieFormModal({
  mode,
  form,
  error,
  onClose,
  onSubmit,
  onUpdate,
}: {
  mode: FormMode
  form: NouvelleMairie
  error: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onUpdate: <K extends keyof NouvelleMairie>(key: K, value: NouvelleMairie[K]) => void
}) {
  return (
    <div className="mairies-overlay" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="mairies-modal">
        <header className="mairies-modal-header">
          <div>
            <span>BDD MAIRIES</span>
            <h2>{mode === 'create' ? 'Nouvelle mairie' : 'Modifier la fiche'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer"><X size={19} /></button>
        </header>

        <form onSubmit={onSubmit}>
          <div className="mairies-modal-body">
            <FormSection title="Identité" icon={<Building2 size={18} />}>
              <Field label="Code mairie *"><input value={form.code} onChange={(e) => onUpdate('code', e.target.value)} /></Field>
              <Field label="Commune *"><input value={form.commune} onChange={(e) => onUpdate('commune', e.target.value)} /></Field>
              <Field label="Nom d'affichage *" wide><input value={form.nomAffiche} onChange={(e) => onUpdate('nomAffiche', e.target.value)} placeholder="Ex. Ville de Toul" /></Field>
              <Field label="Code INSEE"><input value={form.codeInsee} onChange={(e) => onUpdate('codeInsee', e.target.value)} /></Field>
              <Field label="Secteur"><input value={form.secteur} onChange={(e) => onUpdate('secteur', e.target.value)} /></Field>
            </FormSection>

            <FormSection title="Adresse" icon={<MapPin size={18} />}>
              <Field label="N° de voie"><input value={form.numeroVoie} onChange={(e) => onUpdate('numeroVoie', e.target.value)} /></Field>
              <Field label="Adresse"><input value={form.adresse} onChange={(e) => onUpdate('adresse', e.target.value)} /></Field>
              <Field label="Code postal"><input value={form.cp} onChange={(e) => onUpdate('cp', e.target.value)} /></Field>
              <Field label="Ville"><input value={form.ville} onChange={(e) => onUpdate('ville', e.target.value)} /></Field>
            </FormSection>

            <FormSection title="Contact" icon={<UsersRound size={18} />}>
              <Field label="Prénom"><input value={form.contactPrenom} onChange={(e) => onUpdate('contactPrenom', e.target.value)} /></Field>
              <Field label="Nom"><input value={form.contactNom} onChange={(e) => onUpdate('contactNom', e.target.value)} /></Field>
              <Field label="Fonction" wide><input value={form.contactFonction} onChange={(e) => onUpdate('contactFonction', e.target.value)} /></Field>
              <Field label="Email"><input type="email" value={form.email} onChange={(e) => onUpdate('email', e.target.value)} /></Field>
              <Field label="Téléphone"><input value={form.telephone} onChange={(e) => onUpdate('telephone', e.target.value)} /></Field>
            </FormSection>

            <FormSection title="Opération Brioches" icon={<CheckCircle2 size={18} />}>
              <Field label="Participation">
                <select value={form.participation} onChange={(e) => onUpdate('participation', e.target.value as ParticipationMairie)}>
                  <option value="OUI">Oui</option>
                  <option value="A_CONTACTER">À contacter</option>
                  <option value="NON">Non</option>
                </select>
              </Field>
              <Field label="Brioches N-1"><input type="number" min="0" value={form.nombreBriochesN1 ?? ''} onChange={(e) => onUpdate('nombreBriochesN1', e.target.value === '' ? null : Number(e.target.value))} /></Field>
              <Field label="Mode de règlement"><input value={form.modeReglement} onChange={(e) => onUpdate('modeReglement', e.target.value)} placeholder="Ex. Mandat administratif" /></Field>
              <Field label="Lieu / informations"><input value={form.lieuInfos} onChange={(e) => onUpdate('lieuInfos', e.target.value)} /></Field>
              <Field label="Notes" wide><textarea rows={4} value={form.notes} onChange={(e) => onUpdate('notes', e.target.value)} /></Field>
            </FormSection>

            {error && <div className="mairies-error">{error}</div>}
          </div>

          <footer className="mairies-modal-footer">
            <button type="button" className="mairies-secondary-button" onClick={onClose}>Annuler</button>
            <button type="submit" className="mairies-primary-button"><CheckCircle2 size={17} />Enregistrer</button>
          </footer>
        </form>
      </section>
    </div>
  )
}

function Kpi({ icon, tone, label, value, percent }: { icon: ReactNode; tone: string; label: string; value: number; percent?: number }) {
  return (
    <article className="mairies-kpi">
      <span className={`mairies-kpi-icon ${tone}`}>{icon}</span>
      <div><small>{label}</small><strong>{value}</strong></div>
      {percent !== undefined && <em>{percent} %</em>}
    </article>
  )
}

function ParticipationBadge({ value }: { value: ParticipationMairie }) {
  return <span className={`mairie-participation participation-${value.toLowerCase()}`}>{PARTICIPATION_LABELS[value]}</span>
}

function DetailCard({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="mairie-detail-card">
      <h2>{icon}{title}</h2>
      {children}
    </section>
  )
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="mairie-info-row">
      <span>{label}</span>
      <strong>{icon}{value}</strong>
    </div>
  )
}

function DocumentSummary({ label, document }: { label: string; document?: Mairie['documents'][number] }) {
  const ok = document?.statut === 'OUI'
  return (
    <div className="mairie-document-summary-item">
      <CheckCircle2 size={16} className={ok ? 'ok' : 'missing'} />
      <div><strong>{label}</strong><small>{document ? `${ok ? 'Reçu' : 'Manquant'} ${document.date ? `le ${formatDate(document.date)}` : ''}` : 'Non renseigné'}</small></div>
    </div>
  )
}

function FormSection({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="mairies-form-section">
      <header>{icon}<h3>{title}</h3></header>
      <div className="mairies-form-grid">{children}</div>
    </section>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return <label className={wide ? 'wide' : ''}><span>{label}</span>{children}</label>
}

function EmptySection({ text }: { text: string }) {
  return <div className="mairies-empty-section">{text}</div>
}
