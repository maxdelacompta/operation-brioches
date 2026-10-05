import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Archive, ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Check,
  ChevronLeft, ChevronRight, Download, Eye,
  MoreVertical, Pencil, Plus, RotateCcw, Search, Store, X,
} from 'lucide-react'
import { useArtisans } from '../contexts/ArtisansContext'
import type { Fournisseur, StatutArtisan, TypeFournisseur } from '../types/artisans'
import { argent, categoriesFournisseur } from '../types/artisans'
import './Fournisseurs.css'

const TYPES: TypeFournisseur[] = ['GMS', 'ARTISAN', 'INDUSTRIEL']
const PAR_PAGE = 10

type FiltreType = 'TOUS' | TypeFournisseur
type FiltreStatut = 'TOUS' | StatutArtisan
type TriCle = 'id' | 'type' | 'nom' | 'ville' | 'responsable' | 'telephone' | 'email'

type ColonneTri = { cle: TriCle; titre: string }
const COLONNES: ColonneTri[] = [
  { cle: 'id', titre: 'Code' },
  { cle: 'type', titre: 'Type' },
  { cle: 'nom', titre: 'Fournisseur / raison sociale' },
  { cle: 'ville', titre: 'Ville' },
  { cle: 'responsable', titre: 'Contact' },
  { cle: 'telephone', titre: 'Téléphone' },
  { cle: 'email', titre: 'Email' },
]

const libelleType = (type: TypeFournisseur) =>
  type === 'ARTISAN' ? 'Artisan' : type === 'INDUSTRIEL' ? 'Industriel' : 'GMS'

const libelleStatut = (statut: StatutArtisan) =>
  statut === 'ACTIF' ? 'Actif' : statut === 'INACTIF' ? 'Inactif' : 'À vérifier'

function genererCode(fournisseurs: Fournisseur[]): string {
  // Ne renumérote surtout pas les anciens ARTISxx, référencés par les commandes.
  const numeros = fournisseurs.map(f => Number(/^FRN-(\d+)$/.exec(f.id)?.[1] ?? 0))
  return `FRN-${String(Math.max(0, ...numeros) + 1).padStart(6, '0')}`
}

function formulaireVierge(fournisseurs: Fournisseur[]): Fournisseur {
  return {
    id: genererCode(fournisseurs),
    type: 'ARTISAN',
    categories: ['ARTISAN'],
    nom: '', responsable: '', responsableSecteur: '',
    adresse: '', codePostal: '', ville: '', secteur: '',
    telephone: '', email: '', siret: '',
    tarif2026: null, tarif2025: null,
    conditionsReglement: '', commentaires: '', statut: 'ACTIF',
  }
}

function secteursFournisseur(f: Fournisseur, commandes: { artisanId: string; secteur: string }[]): string[] {
  const secteurs = [f.secteur ?? '', ...commandes.filter(c => c.artisanId === f.id).map(c => c.secteur)]
  return [...new Set(secteurs.map(s => s.trim()).filter(Boolean))]
}

function exporterCsv(fournisseurs: Fournisseur[]) {
  const colonnes = [
    'Code', 'Type', 'GMS', 'Artisan', 'Industriel', 'Raison sociale',
    'Ville', 'Code postal', 'Adresse', 'Secteur', 'Contact', 'Téléphone',
    'Email', 'SIRET', 'Statut', 'Tarif 2026', 'Tarif 2025',
    'Conditions de règlement', 'Commentaires',
  ]
  const lignes: (string | number)[][] = [
    colonnes,
    ...fournisseurs.map(f => {
      const categories = categoriesFournisseur(f)
      return [
        f.id, categories.length > 1 ? 'MULTI' : libelleType(f.type),
        ...TYPES.map(type => categories.includes(type) ? 'OUI' : 'NON'),
        f.nom, f.ville ?? '', f.codePostal ?? '', f.adresse, f.secteur ?? '',
        f.responsable, f.telephone, f.email, f.siret ?? '', libelleStatut(f.statut),
        f.tarif2026 ?? '', f.tarif2025 ?? '', f.conditionsReglement ?? '', f.commentaires,
      ]
    }),
  ]
  const cellule = (value: string | number) => {
    let texte = String(value)
    // Ne pas exécuter de formules provenant de champs saisis dans un tableur.
    if (typeof value === 'string' && /^\s*[=+@-]/.test(texte)) texte = `'${texte}`
    return `"${texte.replace(/"/g, '""')}"`
  }
  const contenu = '\ufeff' + lignes.map(row => row.map(cellule).join(';')).join('\r\n')
  const url = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }))
  const lien = document.createElement('a')
  lien.href = url
  lien.download = 'base-fournisseurs-operation-brioches.csv'
  document.body.appendChild(lien)
  lien.click()
  lien.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function TypeBadge({ fournisseur }: { fournisseur: Fournisseur }) {
  const categories = categoriesFournisseur(fournisseur)
  const classe = categories.length > 1 ? 'multi' : fournisseur.type.toLowerCase()
  return (
    <span className={`fp-type fp-type--${classe}`}>
      {categories.length > 1 ? 'MULTI' : libelleType(fournisseur.type).toUpperCase()}
    </span>
  )
}

function BooleanBadge({ oui }: { oui: boolean }) {
  return <span className={`fp-boolean ${oui ? 'fp-boolean--oui' : ''}`}>{oui ? 'OUI' : 'NON'}</span>
}

function ChampDetail({ titre, valeur }: { titre: string; valeur?: string | number | null }) {
  return (
    <div className="fp-detail-field">
      <span>{titre}</span>
      <strong>{valeur === null || valeur === undefined || valeur === '' ? '—' : valeur}</strong>
    </div>
  )
}

export default function Fournisseurs() {
  const { fournisseurs, setFournisseurs, commandesArtisans } = useArtisans()
  const [recherche, setRecherche] = useState('')
  const [typeFiltre, setTypeFiltre] = useState<FiltreType>('TOUS')
  const [secteurFiltre, setSecteurFiltre] = useState('TOUS')
  const [statutFiltre, setStatutFiltre] = useState<FiltreStatut>('TOUS')
  const [tri, setTri] = useState<TriCle>('id')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [menuId, setMenuId] = useState<string | null>(null)
  const [edition, setEdition] = useState<Fournisseur | null>(null)
  const [originalId, setOriginalId] = useState<string | null>(null)
  const [erreur, setErreur] = useState('')

  const secteurs = useMemo(() => {
    const noms = fournisseurs.flatMap(f => secteursFournisseur(f, commandesArtisans))
    return [...new Set(noms)].sort((a, b) => a.localeCompare(b, 'fr'))
  }, [fournisseurs, commandesArtisans])

  const resultats = useMemo(() => {
    const motif = recherche.trim().toLocaleLowerCase('fr')
    return fournisseurs.filter(f => {
      const secteursFiche = secteursFournisseur(f, commandesArtisans)
      const champs = [f.id, f.nom, f.responsable, f.responsableSecteur, f.adresse,
        f.codePostal, f.ville, f.telephone, f.email, f.siret, ...secteursFiche]
      return (typeFiltre === 'TOUS' || categoriesFournisseur(f).includes(typeFiltre))
        && (secteurFiltre === 'TOUS' || secteursFiche.includes(secteurFiltre))
        && (statutFiltre === 'TOUS' || f.statut === statutFiltre)
        && champs.join(' ').toLocaleLowerCase('fr').includes(motif)
    }).sort((a, b) => {
      const valeur = (f: Fournisseur) => tri === 'type'
        ? (categoriesFournisseur(f).length > 1 ? 'MULTI' : f.type)
        : String(f[tri] ?? '')
      const comparaison = valeur(a).localeCompare(valeur(b), 'fr', { numeric: true, sensitivity: 'base' })
      return (direction === 'asc' ? comparaison : -comparaison)
        || a.id.localeCompare(b.id, 'fr', { numeric: true })
    })
  }, [fournisseurs, commandesArtisans, recherche, typeFiltre, secteurFiltre, statutFiltre, tri, direction])

  const totalPages = Math.max(1, Math.ceil(resultats.length / PAR_PAGE))
  const pageVisible = Math.min(page, totalPages)
  const debut = (pageVisible - 1) * PAR_PAGE
  const lignes = resultats.slice(debut, debut + PAR_PAGE)
  const detail = detailId ? fournisseurs.find(f => f.id === detailId) ?? null : null
  const commandesDuFournisseur = detail
    ? commandesArtisans.filter(c => c.artisanId === detail.id)
    : []

  useEffect(() => {
    if (!edition) return
    function echap(event: KeyboardEvent) {
      if (event.key === 'Escape') { setEdition(null); setErreur('') }
    }
    window.addEventListener('keydown', echap)
    return () => window.removeEventListener('keydown', echap)
  }, [edition])

  function changerTri(cle: TriCle) {
    if (tri === cle) setDirection(v => v === 'asc' ? 'desc' : 'asc')
    else { setTri(cle); setDirection('asc') }
    setPage(1)
  }

  function ouvrirCreation() {
    setEdition(formulaireVierge(fournisseurs))
    setOriginalId(null)
    setErreur('')
    setMenuId(null)
  }

  function ouvrirModification(f: Fournisseur) {
    setEdition({ ...f, categories: [...categoriesFournisseur(f)] })
    setOriginalId(f.id)
    setErreur('')
    setMenuId(null)
  }

  function fermerEdition() {
    setEdition(null)
    setOriginalId(null)
    setErreur('')
  }

  function modifierChamp<K extends keyof Fournisseur>(champ: K, valeur: Fournisseur[K]) {
    setEdition(courant => courant ? { ...courant, [champ]: valeur } : null)
  }

  function changerTypePrincipal(type: TypeFournisseur) {
    if (originalId) return
    setEdition(courant => {
      if (!courant) return null
      const anciennes = categoriesFournisseur(courant)
      const categories = anciennes.length === 1
        ? [type]
        : [...new Set([type, ...anciennes.filter(c => c !== courant.type)])]
      return { ...courant, type, categories }
    })
  }

  function changerCategorie(type: TypeFournisseur, coche: boolean) {
    setEdition(courant => {
      if (!courant || (type === courant.type && !coche)) return courant
      const anciennes = categoriesFournisseur(courant)
      const categories = coche
        ? [...new Set([...anciennes, type])]
        : anciennes.filter(c => c !== type)
      return { ...courant, categories }
    })
  }

  function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!edition) return
    const nom = edition.nom.trim()
    const categories = categoriesFournisseur(edition)
    if (!nom) { setErreur('Le nom ou la raison sociale est obligatoire.'); return }
    if (originalId && (edition.id !== originalId
      || edition.type !== fournisseurs.find(f => f.id === originalId)?.type)) {
      setErreur('Le code et le type principal sont permanents pour préserver les commandes.'); return
    }
    if (fournisseurs.some(f => f.id === edition.id && f.id !== originalId)) {
      setErreur('Ce code fournisseur existe déjà.'); return
    }
    if ([edition.tarif2025, edition.tarif2026].some(v => v !== null && (!Number.isFinite(v) || v < 0))) {
      setErreur('Les tarifs doivent être positifs ou laissés vides.'); return
    }
    const fiche: Fournisseur = { ...edition, nom, categories }
    setFournisseurs(anciens => originalId
      ? anciens.map(f => f.id === originalId ? fiche : f)
      : [...anciens, fiche])
    fermerEdition()
    setPage(1)
    setDetailId(fiche.id)
  }

  function basculerStatut(f: Fournisseur) {
    const devientInactif = f.statut !== 'INACTIF'
    if (devientInactif && !window.confirm(
      `Archiver « ${f.nom} » ? Sa fiche et ses anciennes commandes seront conservées.`,
    )) return
    setFournisseurs(anciens => anciens.map(item => item.id === f.id
      ? { ...item, statut: devientInactif ? 'INACTIF' : 'ACTIF' }
      : item))
    setMenuId(null)
  }

  if (detail) {
    return (
      <main className="fp-page fp-page--detail">
        <button type="button" className="fp-back" onClick={() => setDetailId(null)}>
          <ArrowLeft size={18} /> Retour à la base fournisseurs
        </button>
        <div className="fp-profile">
          <div className="fp-profile-icon"><Store size={28} /></div>
          <div className="fp-profile-titles">
            <span className="fp-eyebrow">FOURNISSEUR {detail.id}</span>
            <h1>{detail.nom}</h1>
            <div className="fp-profile-badges"><TypeBadge fournisseur={detail} />
              <span className={`fp-status fp-status--${detail.statut}`}>{libelleStatut(detail.statut)}</span>
            </div>
          </div>
          <button className="fp-primary" type="button" onClick={() => ouvrirModification(detail)}>
            <Pencil size={17} /> Modifier la fiche
          </button>
        </div>
        <div className="fp-detail-grid">
          <section className="fp-detail-card">
            <h2>Identité et coordonnées</h2>
            <ChampDetail titre="Code fournisseur" valeur={detail.id} />
            <ChampDetail titre="Nom / raison sociale" valeur={detail.nom} />
            <ChampDetail titre="SIRET" valeur={detail.siret} />
            <ChampDetail titre="Adresse" valeur={detail.adresse} />
            <ChampDetail titre="Code postal" valeur={detail.codePostal} />
            <ChampDetail titre="Ville" valeur={detail.ville} />
            <ChampDetail titre="Secteur" valeur={secteursFournisseur(detail, commandesArtisans).join(', ')} />
          </section>
          <section className="fp-detail-card">
            <h2>Contact et conditions</h2>
            <ChampDetail titre="Contact" valeur={detail.responsable} />
            <ChampDetail titre="Responsable de secteur" valeur={detail.responsableSecteur} />
            <ChampDetail titre="Téléphone" valeur={detail.telephone} />
            <ChampDetail titre="Email" valeur={detail.email} />
            <ChampDetail titre="Tarif 2026" valeur={detail.tarif2026 === null ? null : argent(detail.tarif2026)} />
            <ChampDetail titre="Tarif 2025" valeur={detail.tarif2025 === null ? null : argent(detail.tarif2025)} />
            <ChampDetail titre="Conditions de règlement" valeur={detail.conditionsReglement} />
          </section>
          <section className="fp-detail-card fp-detail-card--wide">
            <h2>Catégories du fournisseur</h2>
            <div className="fp-categories">
              {TYPES.map(type => <span className="fp-category" key={type}>
                <BooleanBadge oui={categoriesFournisseur(detail).includes(type)} /> {libelleType(type)}
              </span>)}
            </div>
            <h2 className="fp-subtitle">Commandes Artisans enregistrées ({commandesDuFournisseur.length})</h2>
            {commandesDuFournisseur.length ? (
              <div className="fp-orders-scroll"><table className="fp-orders">
                <thead><tr><th>N°</th><th>Campagne</th><th>Quantité</th><th>Montant estimé</th><th>Statut</th></tr></thead>
                <tbody>{commandesDuFournisseur.map(c => <tr key={c.id}>
                  <td>{c.numero}</td><td>{c.campagne}</td><td>{c.quantiteCommandee}</td>
                  <td>{argent(c.prixUnitaire * c.quantiteCommandee)}</td><td>{c.statut}</td>
                </tr>)}</tbody>
              </table></div>
            ) : <p className="fp-muted">Aucune commande Artisan liée à cette fiche.</p>}
            {detail.commentaires && <><h2 className="fp-subtitle">Commentaires</h2><p className="fp-notes">{detail.commentaires}</p></>}
          </section>
        </div>
        {edition && rendreModal()}
      </main>
    )
  }

  function rendreModal() {
    if (!edition) return null
    return (
      <div className="fp-overlay" onMouseDown={e => { if (e.target === e.currentTarget) fermerEdition() }}>
        <section className="fp-modal" role="dialog" aria-modal="true" aria-labelledby="fp-modal-titre">
          <header className="fp-modal-header">
            <div><span className="fp-eyebrow">BASE FOURNISSEURS</span>
              <h2 id="fp-modal-titre">{originalId ? 'Modifier le fournisseur' : 'Nouveau fournisseur'}</h2></div>
            <button type="button" className="fp-icon" onClick={fermerEdition} aria-label="Fermer"><X size={19}/></button>
          </header>
          <form onSubmit={enregistrer}>
            <div className="fp-form-grid">
              <label>Code fournisseur<input value={edition.id} readOnly aria-readonly="true" /></label>
              <label>Type principal
                <select value={edition.type} disabled={Boolean(originalId)} onChange={e => changerTypePrincipal(e.target.value as TypeFournisseur)}>
                  {TYPES.map(type => <option key={type} value={type}>{libelleType(type)}</option>)}
                </select>
              </label>
              <fieldset className="fp-field-wide fp-category-fieldset"><legend>Activités du fournisseur</legend>
                <div className="fp-category-checks">{TYPES.map(type => <label key={type}>
                  <input type="checkbox" checked={categoriesFournisseur(edition).includes(type)}
                    disabled={edition.type === type} onChange={e => changerCategorie(type, e.target.checked)} />
                  {libelleType(type)}
                </label>)}</div>
                <small>Le type principal est conservé pour les commandes déjà associées.</small>
              </fieldset>
              <label className="fp-field-wide">Nom / raison sociale *
                <input required maxLength={180} autoFocus value={edition.nom} onChange={e => modifierChamp('nom', e.target.value)} />
              </label>
              <label>Ville<input value={edition.ville ?? ''} onChange={e => modifierChamp('ville', e.target.value)} /></label>
              <label>Code postal<input value={edition.codePostal ?? ''} onChange={e => modifierChamp('codePostal', e.target.value)} /></label>
              <label className="fp-field-wide">Adresse<textarea rows={2} value={edition.adresse} onChange={e => modifierChamp('adresse', e.target.value)} /></label>
              <label>Secteur<input value={edition.secteur ?? ''} onChange={e => modifierChamp('secteur', e.target.value)} /></label>
              <label>Responsable de secteur<input value={edition.responsableSecteur} onChange={e => modifierChamp('responsableSecteur', e.target.value)} /></label>
              <label>Contact<input value={edition.responsable} onChange={e => modifierChamp('responsable', e.target.value)} /></label>
              <label>Téléphone<input type="tel" value={edition.telephone} onChange={e => modifierChamp('telephone', e.target.value)} /></label>
              <label>Email<input type="text" value={edition.email} onChange={e => modifierChamp('email', e.target.value)} /></label>
              <label>SIRET<input inputMode="numeric" value={edition.siret ?? ''} onChange={e => modifierChamp('siret', e.target.value)} /></label>
              <label>Tarif 2026 (€)<input type="number" min="0" step="0.01" value={edition.tarif2026 ?? ''}
                onChange={e => modifierChamp('tarif2026', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label>Tarif 2025 (€)<input type="number" min="0" step="0.01" value={edition.tarif2025 ?? ''}
                onChange={e => modifierChamp('tarif2025', e.target.value === '' ? null : Number(e.target.value))} /></label>
              <label>Statut<select value={edition.statut} onChange={e => modifierChamp('statut', e.target.value as StatutArtisan)}>
                <option value="ACTIF">Actif</option><option value="A_VERIFIER">À vérifier</option><option value="INACTIF">Inactif</option>
              </select></label>
              <label className="fp-field-wide">Conditions de règlement<textarea rows={2} value={edition.conditionsReglement ?? ''}
                onChange={e => modifierChamp('conditionsReglement', e.target.value)} /></label>
              <label className="fp-field-wide">Commentaires<textarea rows={3} value={edition.commentaires}
                onChange={e => modifierChamp('commentaires', e.target.value)} /></label>
              <p className="fp-helper fp-field-wide">Modifier le tarif fournisseur ne modifie pas le prix des anciennes commandes.</p>
              {erreur && <p className="fp-error fp-field-wide" role="alert">{erreur}</p>}
            </div>
            <footer className="fp-modal-footer">
              <button type="button" className="fp-secondary" onClick={fermerEdition}>Annuler</button>
              <button type="submit" className="fp-primary"><Check size={17} /> Enregistrer</button>
            </footer>
          </form>
        </section>
      </div>
    )
  }

  return (
    <main className="fp-page">
      <header className="fp-header">
        <div>
          <span className="fp-eyebrow">COMMANDE ACHAT</span>
          <h1>Fournisseurs</h1>
          <p>Base commune des fournisseurs utilisés pour les achats GMS, artisans et industriels.</p>
        </div>
        <div className="fp-header-actions">
          <button type="button" className="fp-secondary" onClick={() => exporterCsv(resultats)} disabled={!resultats.length}>
            <Download size={17} /> Exporter
          </button>
          <button type="button" className="fp-primary" onClick={ouvrirCreation}>
            <Plus size={19} /> Nouveau fournisseur
          </button>
        </div>
      </header>

      <section className="fp-card" aria-label="Base fournisseurs">
        <div className="fp-toolbar">
          <label className="fp-search"><Search size={19} />
            <span className="fp-sr">Rechercher un fournisseur</span>
            <input type="search" placeholder="Rechercher un fournisseur, une ville, un contact…"
              value={recherche} onChange={e => { setRecherche(e.target.value); setPage(1) }} />
          </label>
          <label className="fp-select-wrap"><span className="fp-sr">Type</span>
            <select value={typeFiltre} onChange={e => { setTypeFiltre(e.target.value as FiltreType); setPage(1) }}>
              <option value="TOUS">Tous les types</option>
              <option value="GMS">GMS</option><option value="ARTISAN">Artisans</option>
              <option value="INDUSTRIEL">Industriels</option>
            </select>
          </label>
          <label className="fp-select-wrap"><span className="fp-sr">Secteur</span>
            <select value={secteurFiltre} onChange={e => { setSecteurFiltre(e.target.value); setPage(1) }}>
              <option value="TOUS">Tous les secteurs</option>
              {secteurs.map(secteur => <option key={secteur} value={secteur}>{secteur}</option>)}
            </select>
          </label>
          <label className="fp-select-wrap"><span className="fp-sr">Statut</span>
            <select value={statutFiltre} onChange={e => { setStatutFiltre(e.target.value as FiltreStatut); setPage(1) }}>
              <option value="TOUS">Tous les statuts</option>
              <option value="ACTIF">Actifs</option><option value="A_VERIFIER">À vérifier</option>
              <option value="INACTIF">Inactifs</option>
            </select>
          </label>
        </div>

        <div className="fp-results"><strong>{resultats.length} fournisseur{resultats.length > 1 ? 's' : ''}</strong>
          <span>Clique sur un en-tête pour trier · reclique pour inverser</span>
        </div>
        <div className="fp-table-scroll">
          <table className="fp-table">
            <thead><tr>
              {COLONNES.map(colonne => <th key={colonne.cle} aria-sort={tri === colonne.cle ? direction === 'asc' ? 'ascending' : 'descending' : 'none'}>
                <button type="button" className="fp-sort" onClick={() => changerTri(colonne.cle)}
                  aria-label={`Trier par ${colonne.titre}`}>
                  {colonne.titre}
                  {tri !== colonne.cle ? <ArrowUpDown size={12}/> : direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>}
                </button>
              </th>)}
              {TYPES.map(type => <th key={type} className="fp-center">{libelleType(type).toUpperCase()}</th>)}
              <th className="fp-center">Actions</th>
            </tr></thead>
            <tbody>
              {lignes.map(f => <tr key={f.id}>
                <td className="fp-code">{f.id}</td>
                <td><TypeBadge fournisseur={f}/></td>
                <td className="fp-nom"><button type="button" onClick={() => { setDetailId(f.id); setMenuId(null) }}>{f.nom}</button>{f.statut !== 'ACTIF' && <span className={`fp-inline-status fp-inline-status--${f.statut}`}>{libelleStatut(f.statut)}</span>}</td>
                <td>{f.ville || '—'}</td><td>{f.responsable || '—'}</td>
                <td>{f.telephone || '—'}</td><td>{f.email || '—'}</td>
                {TYPES.map(type => <td key={type} className="fp-center"><BooleanBadge oui={categoriesFournisseur(f).includes(type)}/></td>)}
                <td className="fp-row-actions"><div className="fp-action-group">
                  <button type="button" className="fp-icon" title="Voir la fiche" aria-label={`Voir ${f.nom}`}
                    onClick={() => { setDetailId(f.id); setMenuId(null) }}><Eye size={17}/></button>
                  <button type="button" className="fp-icon" title="Modifier" aria-label={`Modifier ${f.nom}`}
                    onClick={() => ouvrirModification(f)}><Pencil size={17}/></button>
                  <div className="fp-more-wrap">
                    <button type="button" className="fp-icon" title="Autres actions" aria-label={`Autres actions pour ${f.nom}`}
                      aria-expanded={menuId === f.id} onClick={() => setMenuId(m => m === f.id ? null : f.id)}><MoreVertical size={18}/></button>
                    {menuId === f.id && <div className="fp-more-menu">
                      <button type="button" onClick={() => basculerStatut(f)}>
                        {f.statut === 'INACTIF' ? <RotateCcw size={15}/> : <Archive size={15}/>}
                        {f.statut === 'INACTIF' ? 'Réactiver' : 'Archiver sans supprimer'}
                      </button>
                    </div>}
                  </div>
                </div></td>
              </tr>)}
              {!lignes.length && <tr><td colSpan={11} className="fp-empty">
                Aucun fournisseur trouvé. Essaye un autre filtre ou ajoute un fournisseur.
              </td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="fp-table-footer">
          <span>{resultats.length ? `Affichage de ${debut + 1} à ${debut + lignes.length} sur ${resultats.length} fournisseurs` : 'Aucun fournisseur affiché'}</span>
          <div className="fp-pages">
            <button type="button" aria-label="Page précédente" disabled={pageVisible === 1} onClick={() => { setPage(p => Math.max(1, p - 1)); setMenuId(null) }}><ChevronLeft size={17}/></button>
            <span>{pageVisible} / {totalPages}</span>
            <button type="button" aria-label="Page suivante" disabled={pageVisible === totalPages} onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setMenuId(null) }}><ChevronRight size={17}/></button>
          </div>
        </footer>
      </section>
      <p className="fp-storage-note">Données enregistrées dans ce navigateur : pas encore de synchronisation entre plusieurs utilisateurs.</p>
      {edition && rendreModal()}
    </main>
  )
}
