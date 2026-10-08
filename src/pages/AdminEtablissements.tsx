import {
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  Building2,
  Check,
  ChevronDown,
  CircleOff,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Truck,
  UsersRound,
  Warehouse,
  X,
} from 'lucide-react'

import {
  useEtablissements,
} from '../contexts/EtablissementsContext'

import type {
  EtablissementAEIM,
  NouvelEtablissementAEIM,
  TypeEtablissementAEIM,
} from '../types/etablissements'

import './AdminEtablissements.css'

type DetailTab =
  | 'GENERAL'
  | 'CONTACTS'
  | 'LOGISTIQUE'
  | 'OPERATION'

type FormMode =
  | 'create'
  | 'edit'

type FormState =
  NouvelEtablissementAEIM

const TYPE_LABELS: Record<
  TypeEtablissementAEIM,
  string
> = {
  SIEGE: 'Siège',
  ESAT: 'ESAT',
  IME: 'IME',
  MAS: 'MAS',
  FAM: 'FAM',
  FOYER: 'Foyer',
  SAJ: 'SAJ',
  SAVS: 'SAVS',
  EAM: 'EAM',
  SESSAD: 'SESSAD',
  AUTRE: 'Autre',
}

function emptyForm(): FormState {
  return {
    code: '',
    nom: '',
    type: 'AUTRE',
    statut: 'ACTIF',

    adresse: '',
    codePostal: '',
    ville: '',
    telephone: '',
    email: '',

    responsableNom: '',
    responsableTelephone: '',
    responsableEmail: '',

    secteur: '',
    pole: '',
    rattachementId: '',

    participeOperationBrioches: true,
    peutEffectuerLivraisons: false,
    peutRecevoirStock: false,
    peutVendreBrioches: false,

    roleOperationBrioches: '',
    commentaire: '',
  }
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function codeFromName(value: string) {
  return value
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export default function AdminEtablissements() {
  const {
    etablissements,
    createEtablissement,
    updateEtablissement,
    toggleEtablissementActif,
  } = useEtablissements()

  const [search, setSearch] =
    useState('')

  const [typeFilter, setTypeFilter] =
    useState<
      'TOUS' | TypeEtablissementAEIM
    >('TOUS')

  const [statusFilter, setStatusFilter] =
    useState<'ACTIFS' | 'TOUS' | 'INACTIFS'>(
      'ACTIFS',
    )

  const [selectedId, setSelectedId] =
    useState<string | null>(
      etablissements[0]?.id ?? null,
    )

  const [detailTab, setDetailTab] =
    useState<DetailTab>('GENERAL')

  const [modalOpen, setModalOpen] =
    useState(false)

  const [formMode, setFormMode] =
    useState<FormMode>('create')

  const [editingId, setEditingId] =
    useState<string | null>(null)

  const [form, setForm] =
    useState<FormState>(emptyForm)

  const [error, setError] =
    useState('')

  const selected =
    etablissements.find(
      (etablissement) =>
        etablissement.id === selectedId,
    ) ??
    etablissements[0] ??
    null

  const filtered = useMemo(() => {
    const query = normalize(search)

    return [...etablissements]
      .filter((etablissement) => {
        if (
          typeFilter !== 'TOUS' &&
          etablissement.type !== typeFilter
        ) {
          return false
        }

        if (
          statusFilter === 'ACTIFS' &&
          etablissement.statut !== 'ACTIF'
        ) {
          return false
        }

        if (
          statusFilter === 'INACTIFS' &&
          etablissement.statut !== 'INACTIF'
        ) {
          return false
        }

        if (!query) return true

        return normalize(
          [
            etablissement.nom,
            etablissement.code,
            TYPE_LABELS[
              etablissement.type
            ],
            etablissement.ville,
            etablissement.secteur,
            etablissement.pole,
          ].join(' '),
        ).includes(query)
      })
      .sort((a, b) =>
        a.nom.localeCompare(b.nom, 'fr'),
      )
  }, [
    etablissements,
    search,
    typeFilter,
    statusFilter,
  ])

  const activeCount =
    etablissements.filter(
      (item) => item.statut === 'ACTIF',
    ).length

  const operationCount =
    etablissements.filter(
      (item) =>
        item.participeOperationBrioches,
    ).length

  const deliveryCount =
    etablissements.filter(
      (item) =>
        item.statut === 'ACTIF' &&
        item.peutEffectuerLivraisons,
    ).length

  function update<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function openCreate() {
    setFormMode('create')
    setEditingId(null)
    setForm(emptyForm())
    setError('')
    setModalOpen(true)
  }

  function openEdit(
    etablissement: EtablissementAEIM,
  ) {
    setFormMode('edit')
    setEditingId(etablissement.id)

    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...editable
    } = etablissement

    setForm(editable)
    setError('')
    setModalOpen(true)
  }

  function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError('')

    const nom = form.nom.trim()

    if (!nom) {
      setError(
        "Le nom de l'établissement est obligatoire.",
      )
      return
    }

    const code =
      form.code.trim() ||
      codeFromName(nom)

    if (!code) {
      setError(
        "Le code de l'établissement est obligatoire.",
      )
      return
    }

    const duplicate = etablissements.find(
      (item) =>
        normalize(item.code) ===
          normalize(code) &&
        item.id !== editingId,
    )

    if (duplicate) {
      setError(
        `Le code ${code} est déjà utilisé.`,
      )
      return
    }

    const input: FormState = {
      ...form,
      code,
      nom,
      adresse: form.adresse.trim(),
      codePostal:
        form.codePostal.trim(),
      ville: form.ville.trim(),
      telephone:
        form.telephone.trim(),
      email: form.email.trim(),
      responsableNom:
        form.responsableNom.trim(),
      responsableTelephone:
        form.responsableTelephone.trim(),
      responsableEmail:
        form.responsableEmail.trim(),
      secteur: form.secteur.trim(),
      pole: form.pole.trim(),
      rattachementId:
        form.rattachementId.trim(),
      roleOperationBrioches:
        form.roleOperationBrioches.trim(),
      commentaire:
        form.commentaire.trim(),
    }

    if (
      formMode === 'edit' &&
      editingId
    ) {
      updateEtablissement(
        editingId,
        input,
      )
      setSelectedId(editingId)
    } else {
      const id =
        createEtablissement(input)

      setSelectedId(id)
    }

    setModalOpen(false)
  }

  return (
    <main className="ea-page">
      <header className="ea-header">
        <div>
          <span className="ea-eyebrow">
            Administration
          </span>
          <h1>Établissements AEIM</h1>
          <p>
            Gérez le référentiel unique des
            établissements utilisé dans toute
            l'application.
          </p>
        </div>

        <button
          type="button"
          className="ea-primary"
          onClick={openCreate}
        >
          <Plus size={18} />
          Nouvel établissement
        </button>
      </header>

      <section className="ea-kpis">
        <MiniKpi
          label="Établissements"
          value={etablissements.length}
          icon={<Building2 size={20} />}
        />
        <MiniKpi
          label="Actifs"
          value={activeCount}
          icon={<Check size={20} />}
        />
        <MiniKpi
          label="Opération Brioches"
          value={operationCount}
          icon={<Warehouse size={20} />}
        />
        <MiniKpi
          label="Peuvent livrer"
          value={deliveryCount}
          icon={<Truck size={20} />}
        />
      </section>

      <div className="ea-layout">
        <section className="ea-card ea-list-card">
          <div className="ea-toolbar">
            <label className="ea-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Rechercher un établissement..."
              />
            </label>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target
                    .value as
                    | 'TOUS'
                    | TypeEtablissementAEIM,
                )
              }
            >
              <option value="TOUS">
                Tous les types
              </option>
              {(
                Object.keys(
                  TYPE_LABELS,
                ) as TypeEtablissementAEIM[]
              ).map((type) => (
                <option
                  key={type}
                  value={type}
                >
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target
                    .value as
                    | 'ACTIFS'
                    | 'TOUS'
                    | 'INACTIFS',
                )
              }
            >
              <option value="ACTIFS">
                Actifs uniquement
              </option>
              <option value="TOUS">
                Tous les statuts
              </option>
              <option value="INACTIFS">
                Inactifs uniquement
              </option>
            </select>
          </div>

          <div className="ea-table-wrap">
            <table className="ea-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Type</th>
                  <th>Ville</th>
                  <th>Secteur</th>
                  <th>Statut</th>
                  <th>Opération Brioches</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (etablissement) => (
                    <tr
                      key={etablissement.id}
                      className={
                        selected?.id ===
                        etablissement.id
                          ? 'selected'
                          : ''
                      }
                      onClick={() => {
                        setSelectedId(
                          etablissement.id,
                        )
                        setDetailTab(
                          'GENERAL',
                        )
                      }}
                    >
                      <td>
                        <div className="ea-name-cell">
                          <span
                            className={`ea-building-icon type-${etablissement.type.toLowerCase()}`}
                          >
                            <Building2
                              size={18}
                            />
                          </span>
                          <strong>
                            {etablissement.nom}
                          </strong>
                        </div>
                      </td>
                      <td>
                        {
                          TYPE_LABELS[
                            etablissement.type
                          ]
                        }
                      </td>
                      <td>
                        {etablissement.ville ||
                          '—'}
                      </td>
                      <td>
                        {etablissement.secteur ||
                          '—'}
                      </td>
                      <td>
                        <StatusBadge
                          active={
                            etablissement.statut ===
                            'ACTIF'
                          }
                        />
                      </td>
                      <td>
                        <BooleanBadge
                          value={
                            etablissement
                              .participeOperationBrioches
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ea-icon-button"
                          onClick={(
                            event,
                          ) => {
                            event.stopPropagation()
                            openEdit(
                              etablissement,
                            )
                          }}
                          aria-label={`Modifier ${etablissement.nom}`}
                        >
                          <MoreHorizontal
                            size={18}
                          />
                        </button>
                      </td>
                    </tr>
                  ),
                )}

                {filtered.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="ea-empty"
                    >
                      {etablissements.length ===
                      0
                        ? "Aucun établissement enregistré. Utilise « Nouvel établissement » pour créer le référentiel."
                        : 'Aucun établissement ne correspond aux filtres.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <footer className="ea-list-footer">
            <strong>
              {filtered.length}{' '}
              établissement
              {filtered.length > 1
                ? 's'
                : ''}
            </strong>
            <span>
              Référentiel :
              ob-etablissements-aeim-v1
            </span>
          </footer>
        </section>

        <aside className="ea-card ea-detail-card">
          {selected ? (
            <>
              <div className="ea-profile-head">
                <span className="ea-profile-icon">
                  <Building2 size={27} />
                </span>

                <div className="ea-profile-title">
                  <h2>{selected.nom}</h2>
                  <div>
                    <span>
                      {
                        TYPE_LABELS[
                          selected.type
                        ]
                      }
                    </span>
                    <StatusBadge
                      active={
                        selected.statut ===
                        'ACTIF'
                      }
                    />
                  </div>
                </div>

                <div className="ea-profile-actions">
                  <button
                    type="button"
                    className="ea-secondary"
                    onClick={() =>
                      openEdit(selected)
                    }
                  >
                    <Pencil size={15} />
                    Modifier
                  </button>

                  <button
                    type="button"
                    className="ea-secondary ea-action-toggle"
                    onClick={() =>
                      toggleEtablissementActif(
                        selected.id,
                      )
                    }
                  >
                    <ChevronDown
                      size={15}
                    />
                    {selected.statut ===
                    'ACTIF'
                      ? 'Désactiver'
                      : 'Réactiver'}
                  </button>
                </div>
              </div>

              <nav className="ea-detail-tabs">
                <DetailTabButton
                  active={
                    detailTab ===
                    'GENERAL'
                  }
                  onClick={() =>
                    setDetailTab(
                      'GENERAL',
                    )
                  }
                >
                  Général
                </DetailTabButton>

                <DetailTabButton
                  active={
                    detailTab ===
                    'CONTACTS'
                  }
                  onClick={() =>
                    setDetailTab(
                      'CONTACTS',
                    )
                  }
                >
                  Contacts
                </DetailTabButton>

                <DetailTabButton
                  active={
                    detailTab ===
                    'LOGISTIQUE'
                  }
                  onClick={() =>
                    setDetailTab(
                      'LOGISTIQUE',
                    )
                  }
                >
                  Logistique
                </DetailTabButton>

                <DetailTabButton
                  active={
                    detailTab ===
                    'OPERATION'
                  }
                  onClick={() =>
                    setDetailTab(
                      'OPERATION',
                    )
                  }
                >
                  Opération Brioches
                </DetailTabButton>
              </nav>

              <div className="ea-detail-body">
                {detailTab ===
                  'GENERAL' && (
                  <>
                    <InfoSection
                      icon={
                        <Building2
                          size={18}
                        />
                      }
                      title="Informations générales"
                    >
                      <InfoLine
                        label="Code établissement"
                        value={
                          selected.code
                        }
                      />
                      <InfoLine
                        label="Nom"
                        value={
                          selected.nom
                        }
                      />
                      <InfoLine
                        label="Type"
                        value={
                          TYPE_LABELS[
                            selected.type
                          ]
                        }
                      />
                      <InfoLine
                        label="Statut"
                        value={
                          selected.statut ===
                          'ACTIF'
                            ? 'Actif'
                            : 'Inactif'
                        }
                      />
                    </InfoSection>

                    <InfoSection
                      icon={
                        <MapPin
                          size={18}
                        />
                      }
                      title="Coordonnées"
                    >
                      <InfoLine
                        label="Adresse"
                        value={
                          selected.adresse
                        }
                      />
                      <InfoLine
                        label="Code postal"
                        value={
                          selected.codePostal
                        }
                      />
                      <InfoLine
                        label="Ville"
                        value={
                          selected.ville
                        }
                      />
                      <InfoLine
                        label="Téléphone"
                        value={
                          selected.telephone
                        }
                      />
                      <InfoLine
                        label="E-mail"
                        value={
                          selected.email
                        }
                      />
                    </InfoSection>

                    <InfoSection
                      icon={
                        <UsersRound
                          size={18}
                        />
                      }
                      title="Organisation"
                    >
                      <InfoLine
                        label="Secteur"
                        value={
                          selected.secteur
                        }
                      />
                      <InfoLine
                        label="Pôle"
                        value={
                          selected.pole
                        }
                      />
                      <InfoLine
                        label="Établissement de rattachement"
                        value={
                          etablissements.find(
                            (item) =>
                              item.id ===
                              selected.rattachementId,
                          )?.nom || '—'
                        }
                      />
                    </InfoSection>
                  </>
                )}

                {detailTab ===
                  'CONTACTS' && (
                  <InfoSection
                    icon={
                      <UsersRound
                        size={18}
                      />
                    }
                    title="Contact principal"
                  >
                    <InfoLine
                      label="Responsable"
                      value={
                        selected.responsableNom
                      }
                    />
                    <InfoLine
                      label="Téléphone"
                      value={
                        selected.responsableTelephone
                      }
                    />
                    <InfoLine
                      label="E-mail"
                      value={
                        selected.responsableEmail
                      }
                    />
                    <InfoLine
                      label="Téléphone établissement"
                      value={
                        selected.telephone
                      }
                    />
                    <InfoLine
                      label="E-mail établissement"
                      value={
                        selected.email
                      }
                    />
                  </InfoSection>
                )}

                {detailTab ===
                  'LOGISTIQUE' && (
                  <InfoSection
                    icon={
                      <Truck size={18} />
                    }
                    title="Paramètres logistiques"
                  >
                    <BooleanLine
                      label="Peut effectuer des livraisons"
                      value={
                        selected.peutEffectuerLivraisons
                      }
                    />
                    <BooleanLine
                      label="Peut recevoir du stock"
                      value={
                        selected.peutRecevoirStock
                      }
                    />
                    <BooleanLine
                      label="Peut vendre des brioches"
                      value={
                        selected.peutVendreBrioches
                      }
                    />
                  </InfoSection>
                )}

                {detailTab ===
                  'OPERATION' && (
                  <InfoSection
                    icon={
                      <Warehouse
                        size={18}
                      />
                    }
                    title="Participation à l'Opération Brioches"
                  >
                    <BooleanLine
                      label="Participe à l'opération"
                      value={
                        selected.participeOperationBrioches
                      }
                    />
                    <InfoLine
                      label="Rôle principal"
                      value={
                        selected.roleOperationBrioches
                      }
                    />
                    <InfoLine
                      label="Commentaires"
                      value={
                        selected.commentaire
                      }
                    />
                  </InfoSection>
                )}
              </div>
            </>
          ) : (
            <div className="ea-no-selection">
              <Building2 size={34} />
              <h2>
                Aucun établissement
              </h2>
              <p>
                Crée le premier
                établissement AEIM pour
                alimenter le référentiel.
              </p>
              <button
                type="button"
                className="ea-primary"
                onClick={openCreate}
              >
                <Plus size={17} />
                Nouvel établissement
              </button>
            </div>
          )}
        </aside>
      </div>

      {modalOpen && (
        <div
          className="ea-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setModalOpen(false)
            }
          }}
        >
          <section
            className="ea-modal"
            role="dialog"
            aria-modal="true"
          >
            <header className="ea-modal-header">
              <div>
                <span>
                  ADMINISTRATION
                </span>
                <h2>
                  {formMode ===
                  'create'
                    ? 'Nouvel établissement'
                    : "Modifier l'établissement"}
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalOpen(false)
                }
                aria-label="Fermer"
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={submit}>
              <div className="ea-modal-body">
                <FormSection
                  title="Informations générales"
                  icon={
                    <Building2
                      size={18}
                    />
                  }
                >
                  <Field label="Nom *">
                    <input
                      value={form.nom}
                      onChange={(event) => {
                        const nom =
                          event.target
                            .value

                        setForm(
                          (current) => ({
                            ...current,
                            nom,
                            code:
                              current.code ||
                              codeFromName(
                                nom,
                              ),
                          }),
                        )
                      }}
                      placeholder="Ex. ESAT de Flavigny"
                    />
                  </Field>

                  <Field label="Code établissement *">
                    <input
                      value={form.code}
                      onChange={(event) =>
                        update(
                          'code',
                          event.target
                            .value.toUpperCase(),
                        )
                      }
                      placeholder="ESAT-FLAVIGNY"
                    />
                  </Field>

                  <Field label="Type">
                    <select
                      value={form.type}
                      onChange={(event) =>
                        update(
                          'type',
                          event.target
                            .value as TypeEtablissementAEIM,
                        )
                      }
                    >
                      {(
                        Object.keys(
                          TYPE_LABELS,
                        ) as TypeEtablissementAEIM[]
                      ).map((type) => (
                        <option
                          key={type}
                          value={type}
                        >
                          {
                            TYPE_LABELS[
                              type
                            ]
                          }
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Statut">
                    <select
                      value={
                        form.statut
                      }
                      onChange={(event) =>
                        update(
                          'statut',
                          event.target
                            .value as
                            | 'ACTIF'
                            | 'INACTIF',
                        )
                      }
                    >
                      <option value="ACTIF">
                        Actif
                      </option>
                      <option value="INACTIF">
                        Inactif
                      </option>
                    </select>
                  </Field>
                </FormSection>

                <FormSection
                  title="Coordonnées"
                  icon={
                    <MapPin size={18} />
                  }
                >
                  <Field
                    label="Adresse"
                    wide
                  >
                    <input
                      value={
                        form.adresse
                      }
                      onChange={(event) =>
                        update(
                          'adresse',
                          event.target
                            .value,
                        )
                      }
                      placeholder="Adresse"
                    />
                  </Field>

                  <Field label="Code postal">
                    <input
                      value={
                        form.codePostal
                      }
                      onChange={(event) =>
                        update(
                          'codePostal',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Ville">
                    <input
                      value={form.ville}
                      onChange={(event) =>
                        update(
                          'ville',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Téléphone">
                    <input
                      value={
                        form.telephone
                      }
                      onChange={(event) =>
                        update(
                          'telephone',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="E-mail">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) =>
                        update(
                          'email',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>
                </FormSection>

                <FormSection
                  title="Contact principal"
                  icon={
                    <UsersRound
                      size={18}
                    />
                  }
                >
                  <Field label="Responsable">
                    <input
                      value={
                        form.responsableNom
                      }
                      onChange={(event) =>
                        update(
                          'responsableNom',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Téléphone">
                    <input
                      value={
                        form.responsableTelephone
                      }
                      onChange={(event) =>
                        update(
                          'responsableTelephone',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="E-mail"
                    wide
                  >
                    <input
                      type="email"
                      value={
                        form.responsableEmail
                      }
                      onChange={(event) =>
                        update(
                          'responsableEmail',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>
                </FormSection>

                <FormSection
                  title="Organisation"
                  icon={
                    <UsersRound
                      size={18}
                    />
                  }
                >
                  <Field label="Secteur">
                    <input
                      value={
                        form.secteur
                      }
                      onChange={(event) =>
                        update(
                          'secteur',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field label="Pôle">
                    <input
                      value={form.pole}
                      onChange={(event) =>
                        update(
                          'pole',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>

                  <Field
                    label="Établissement de rattachement"
                    wide
                  >
                    <select
                      value={
                        form.rattachementId
                      }
                      onChange={(event) =>
                        update(
                          'rattachementId',
                          event.target
                            .value,
                        )
                      }
                    >
                      <option value="">
                        Aucun
                      </option>
                      {etablissements
                        .filter(
                          (item) =>
                            item.id !==
                            editingId,
                        )
                        .map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.nom}
                          </option>
                        ))}
                    </select>
                  </Field>
                </FormSection>

                <FormSection
                  title="Logistique & Opération Brioches"
                  icon={
                    <Truck size={18} />
                  }
                >
                  <div className="ea-check-grid">
                    <CheckField
                      label="Participe à l'Opération Brioches"
                      checked={
                        form.participeOperationBrioches
                      }
                      onChange={(value) =>
                        update(
                          'participeOperationBrioches',
                          value,
                        )
                      }
                    />

                    <CheckField
                      label="Peut effectuer des livraisons"
                      checked={
                        form.peutEffectuerLivraisons
                      }
                      onChange={(value) =>
                        update(
                          'peutEffectuerLivraisons',
                          value,
                        )
                      }
                    />

                    <CheckField
                      label="Peut recevoir du stock"
                      checked={
                        form.peutRecevoirStock
                      }
                      onChange={(value) =>
                        update(
                          'peutRecevoirStock',
                          value,
                        )
                      }
                    />

                    <CheckField
                      label="Peut vendre des brioches"
                      checked={
                        form.peutVendreBrioches
                      }
                      onChange={(value) =>
                        update(
                          'peutVendreBrioches',
                          value,
                        )
                      }
                    />
                  </div>

                  <Field
                    label="Rôle principal dans l'opération"
                    wide
                  >
                    <input
                      value={
                        form.roleOperationBrioches
                      }
                      onChange={(event) =>
                        update(
                          'roleOperationBrioches',
                          event.target
                            .value,
                        )
                      }
                      placeholder="Ex. Livraisons et ventes"
                    />
                  </Field>

                  <Field
                    label="Commentaires"
                    wide
                  >
                    <textarea
                      rows={3}
                      value={
                        form.commentaire
                      }
                      onChange={(event) =>
                        update(
                          'commentaire',
                          event.target
                            .value,
                        )
                      }
                    />
                  </Field>
                </FormSection>

                {error && (
                  <p className="ea-error">
                    {error}
                  </p>
                )}
              </div>

              <footer className="ea-modal-footer">
                <button
                  type="button"
                  className="ea-secondary"
                  onClick={() =>
                    setModalOpen(false)
                  }
                >
                  Annuler
                </button>

                <button
                  type="submit"
                  className="ea-primary"
                >
                  <Check size={17} />
                  {formMode ===
                  'create'
                    ? 'Créer l’établissement'
                    : 'Enregistrer'}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

function MiniKpi({
  label,
  value,
  icon,
}: {
  label: string
  value: number
  icon: ReactNode
}) {
  return (
    <article className="ea-kpi">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

function StatusBadge({
  active,
}: {
  active: boolean
}) {
  return (
    <span
      className={`ea-badge ${
        active
          ? 'ea-badge-green'
          : 'ea-badge-grey'
      }`}
    >
      <i />
      {active ? 'Actif' : 'Inactif'}
    </span>
  )
}

function BooleanBadge({
  value,
}: {
  value: boolean
}) {
  return (
    <span
      className={`ea-badge ${
        value
          ? 'ea-badge-green'
          : 'ea-badge-red'
      }`}
    >
      <i />
      {value ? 'Oui' : 'Non'}
    </span>
  )
}

function DetailTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={
        active ? 'active' : ''
      }
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function InfoSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="ea-info-section">
      <header>
        {icon}
        <h3>{title}</h3>
      </header>
      <div>{children}</div>
    </section>
  )
}

function InfoLine({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="ea-info-line">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}

function BooleanLine({
  label,
  value,
}: {
  label: string
  value: boolean
}) {
  return (
    <div className="ea-info-line">
      <span>{label}</span>
      <strong
        className={
          value
            ? 'ea-yes'
            : 'ea-no'
        }
      >
        {value ? (
          <>
            <Check size={14} />
            Oui
          </>
        ) : (
          <>
            <CircleOff size={14} />
            Non
          </>
        )}
      </strong>
    </div>
  )
}

function FormSection({
  title,
  icon,
  children,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="ea-form-section">
      <header>
        {icon}
        <h3>{title}</h3>
      </header>
      <div className="ea-form-grid">
        {children}
      </div>
    </section>
  )
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string
  wide?: boolean
  children: ReactNode
}) {
  return (
    <label
      className={
        wide ? 'ea-field-wide' : ''
      }
    >
      <span>{label}</span>
      {children}
    </label>
  )
}

function CheckField({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (
    value: boolean,
  ) => void
}) {
  return (
    <label className="ea-check-field">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked,
          )
        }
      />
      <span>
        <strong>{label}</strong>
        <small>
          {checked
            ? 'Activé'
            : 'Désactivé'}
        </small>
      </span>
    </label>
  )
}
