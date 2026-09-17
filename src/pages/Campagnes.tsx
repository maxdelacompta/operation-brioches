import {
  useState,
  type FormEvent,
} from 'react'

import { Link } from 'react-router-dom'

import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Copy,
  Euro,
  FileText,
  FolderKanban,
  Info,
  Package,
  Pencil,
  Plus,
  Search,
  Settings,
  Target,
  Users,
  X,
} from 'lucide-react'

import {
  useObData,
} from '../contexts/ObDataContext'

import {
  useUsers,
} from '../contexts/UsersContext'

import {
  recordActivity,
  type ActivityAction,
} from '../services/activityLog'

import type {
  Campagne,
  CampagneDetails,
  NouvelleCampagne,
  StatutCampagne,
} from '../types/ob'

import './Campagnes.css'

/* =========================================================
   TYPES
   ========================================================= */

type Tab =
  | 'general'
  | 'tarifs'
  | 'organisation'
  | 'documents'

/* =========================================================
   STATUTS
   ========================================================= */

const STATUS: Record<
  StatutCampagne,
  {
    label: string
    description: string
  }
> = {
  A_CONFIGURER: {
    label: 'À configurer',
    description: 'Configuration à compléter',
  },

  PREPARATION: {
    label: 'En préparation',
    description: 'Campagne non active',
  },

  ACTIVE: {
    label: 'Active',
    description: 'Campagne utilisée pour les nouvelles opérations',
  },

  TERMINEE: {
    label: 'Terminée',
    description: 'Édition clôturée',
  },
}

/* =========================================================
   FORMULAIRES
   ========================================================= */

function getDetails(
  campagne: Campagne,
): CampagneDetails {
  return {
    nom: campagne.nom,
    description: campagne.description,
    dateDebut: campagne.dateDebut,
    dateFin: campagne.dateFin,
    prixUnitaire: campagne.prixUnitaire,
    objectifBrioches: campagne.objectifBrioches,
    objectifDonateurs: campagne.objectifDonateurs,
    budgetPrevisionnel: campagne.budgetPrevisionnel,
  }
}

function emptyDetails(): CampagneDetails {
  return {
    nom: 'Opération Brioches',
    description: '',
    dateDebut: '',
    dateFin: '',
    prixUnitaire: null,
    objectifBrioches: null,
    objectifDonateurs: null,
    budgetPrevisionnel: null,
  }
}

/* =========================================================
   FORMATS
   ========================================================= */

const moneyFormatter = new Intl.NumberFormat(
  'fr-FR',
  {
    style: 'currency',
    currency: 'EUR',
  },
)

const numberFormatter = new Intl.NumberFormat(
  'fr-FR',
)

function money(
  value: number | null,
): string {
  return value === null
    ? 'Non renseigné'
    : moneyFormatter.format(value)
}

function number(
  value: number | null,
): string {
  return value === null
    ? 'Non renseigné'
    : numberFormatter.format(value)
}

function dateLabel(
  value: string,
): string {
  if (!value) {
    return 'Non renseignée'
  }

  const [year, month, day] =
    value.split('-')

  return `${day}/${month}/${year}`
}

function optionalNumber(
  value: string,
): number | null {
  if (value.trim() === '') {
    return null
  }

  return Number(value)
}

/* =========================================================
   VALIDATION
   ========================================================= */

function validateDetails(
  details: CampagneDetails,
): string | null {
  if (!details.nom.trim()) {
    return 'Le nom de la campagne est obligatoire.'
  }

  if (
    details.dateDebut &&
    details.dateFin &&
    details.dateFin < details.dateDebut
  ) {
    return 'La date de fin doit être postérieure ou égale à la date de début.'
  }

  const values = [
    details.prixUnitaire,
    details.objectifBrioches,
    details.objectifDonateurs,
    details.budgetPrevisionnel,
  ]

  if (
    values.some(
      (value) =>
        value !== null &&
        (
          !Number.isFinite(value) ||
          value < 0
        ),
    )
  ) {
    return 'Les montants et objectifs doivent être des nombres positifs ou nuls.'
  }

  if (
    details.objectifBrioches !== null &&
    !Number.isInteger(
      details.objectifBrioches,
    )
  ) {
    return "L'objectif de brioches doit être un nombre entier."
  }

  if (
    details.objectifDonateurs !== null &&
    !Number.isInteger(
      details.objectifDonateurs,
    )
  ) {
    return "L'objectif de donateurs doit être un nombre entier."
  }

  return null
}

/* =========================================================
   CHAMP RÉUTILISABLE
   ========================================================= */

function Field({
  label,
  children,
  wide = false,
}: {
  label: string
  children: React.ReactNode
  wide?: boolean
}) {
  return (
    <label
      className={`campagnes-field ${
        wide ? 'wide' : ''
      }`}
    >
      <span>{label}</span>

      {children}
    </label>
  )
}

/* =========================================================
   PAGE
   ========================================================= */

function Campagnes() {
  /* =======================================================
     DONNÉES
     ======================================================= */

  const {
    campagnes,
    activeCampagne,

    getCommandesByCampagne,
    getFichesByCampagne,

    createCampagne,
    updateCampagne,
    duplicateCampagne,
    activateCampagne,
    finishCampagne,
  } = useObData()

  const {
    currentUser,
  } = useUsers()

  /* =======================================================
     AUTORISATION D'INTERFACE

     À renforcer côté serveur avant déploiement.
     ======================================================= */

  const canManage =
    currentUser?.role === 'administrateur'

  /* =======================================================
     ÉTATS
     ======================================================= */

  const [
    selectedId,
    setSelectedId,
  ] = useState(
    activeCampagne?.id ??
    campagnes[0]?.id ??
    '',
  )

  const [
    search,
    setSearch,
  ] = useState('')

  const [
    activeTab,
    setActiveTab,
  ] = useState<Tab>('general')

  const [
    editing,
    setEditing,
  ] = useState(false)

  const [
    draft,
    setDraft,
  ] = useState<CampagneDetails>(
    emptyDetails,
  )

  const [
    creating,
    setCreating,
  ] = useState(false)

  const [
    newYear,
    setNewYear,
  ] = useState(
    String(
      (
        activeCampagne?.annee ??
        new Date().getFullYear()
      ) + 1,
    ),
  )

  const [
    newDetails,
    setNewDetails,
  ] = useState<CampagneDetails>(
    emptyDetails,
  )

  const [
    notice,
    setNotice,
  ] = useState('')

  const [
    error,
    setError,
  ] = useState('')

  /* =======================================================
     CAMPAGNE SÉLECTIONNÉE
     ======================================================= */

  const selected =
    campagnes.find(
      (campagne) =>
        campagne.id === selectedId,
    ) ??
    campagnes[0]

  /* =======================================================
     LISTE FILTRÉE
     ======================================================= */

  const filteredCampagnes =
    campagnes.filter(
      (campagne) => {
        const query =
          search.trim().toLowerCase()

        return [
          campagne.id,
          campagne.nom,
          campagne.description,
          STATUS[campagne.statut].label,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query)
      },
    )

  /* =======================================================
     DONNÉES ASSOCIÉES

     On utilise l'ID de la campagne, pas l'année
     courante du navigateur.
     ======================================================= */

  const commandes = selected
    ? getCommandesByCampagne(
        selected.id,
      )
    : []

  const fiches = selected
    ? getFichesByCampagne(
        selected.id,
      )
    : []

  const commandesRetenues =
    commandes.filter(
      (commande) =>
        commande.statut !== 'ANNULEE' &&
        commande.statut !== 'BROUILLON',
    )

  const quantiteCommandee =
    commandesRetenues.reduce(
      (total, commande) =>
        total + commande.quantite,
      0,
    )

  const montantCommandes =
    commandesRetenues.reduce(
      (total, commande) =>
        total +
        commande.quantite *
          commande.prixUnitaire,
      0,
    )

  const donateursCount =
    new Set(
      commandesRetenues.map(
        (commande) =>
          commande.donateurId,
      ),
    ).size

  const progression =
    selected?.objectifBrioches &&
    selected.objectifBrioches > 0
      ? (
          quantiteCommandee /
          selected.objectifBrioches
        ) * 100
      : null

  /* =======================================================
     MISE À JOUR DU FORMULAIRE
     ======================================================= */

  function updateDraft<K extends keyof CampagneDetails>(
    key: K,
    value: CampagneDetails[K],
  ) {
    setDraft(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )

    setError('')
    setNotice('')
  }

  function updateNewDetails<
    K extends keyof CampagneDetails
  >(
    key: K,
    value: CampagneDetails[K],
  ) {
    setNewDetails(
      (current) => ({
        ...current,
        [key]: value,
      }),
    )

    setError('')
  }

  /* =======================================================
     JOURNALISATION

     L'appel est effectué APRÈS l'action réussie.
     ======================================================= */

  function logCampagne(
    action: ActivityAction,
    target: string,
    message: string,
  ): boolean {
    return recordActivity({
      actorId:
        currentUser?.id ?? null,

      actorName:
        currentUser?.name ??
        'Utilisateur non identifié',

      category: 'campagnes',

      action,
      target,
      message,
    })
  }

  function showSuccess(
    message: string,
    logSuccessful: boolean,
  ) {
    setError('')

    setNotice(
      logSuccessful
        ? message
        : `${message} Attention : l'action n'a pas pu être inscrite au journal local.`,
    )
  }

  /* =======================================================
     SÉLECTION
     ======================================================= */

  function selectCampagne(
    campagne: Campagne,
  ) {
    if (
      editing &&
      selected &&
      JSON.stringify(draft) !==
        JSON.stringify(
          getDetails(selected),
        )
    ) {
      const confirmed = window.confirm(
        'Des modifications ne sont pas enregistrées. Changer de campagne et les abandonner ?',
      )

      if (!confirmed) {
        return
      }
    }

    setSelectedId(
      campagne.id,
    )

    setEditing(false)

    setActiveTab('general')

    setNotice('')
    setError('')
  }

  /* =======================================================
     MODIFICATION
     ======================================================= */

  function startEditing() {
    if (
      !canManage ||
      !selected ||
      selected.statut === 'TERMINEE'
    ) {
      return
    }

    setDraft(
      getDetails(selected),
    )

    setEditing(true)

    setNotice('')
    setError('')
  }

  function cancelEditing() {
    setEditing(false)

    setNotice('')
    setError('')
  }

  /* =======================================================
     ENREGISTRER LES PARAMÈTRES
     ======================================================= */

  function saveDetails(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (
      !canManage ||
      !selected ||
      selected.statut === 'TERMINEE'
    ) {
      return
    }

    const cleaned: CampagneDetails = {
      ...draft,

      nom: draft.nom.trim(),

      description:
        draft.description.trim(),
    }

    const validationError =
      validateDetails(cleaned)

    if (validationError) {
      setError(validationError)
      return
    }

    if (
      JSON.stringify(cleaned) ===
      JSON.stringify(
        getDetails(selected),
      )
    ) {
      setEditing(false)

      setNotice(
        'Aucune modification à enregistrer.',
      )

      return
    }

    try {
      updateCampagne(
        selected.id,
        cleaned,
      )

      setEditing(false)

      const logged = logCampagne(
        'modification',
        selected.id,
        'Configuration de la campagne modifiée.',
      )

      showSuccess(
        'Campagne enregistrée.',
        logged,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d'enregistrer la campagne.",
      )
    }
  }

  /* =======================================================
     NOUVELLE CAMPAGNE
     ======================================================= */

  function openCreate() {
    if (!canManage) {
      return
    }

    setNewYear(
      String(
        (
          activeCampagne?.annee ??
          new Date().getFullYear()
        ) + 1,
      ),
    )

    setNewDetails(
      emptyDetails(),
    )

    setCreating(true)

    setNotice('')
    setError('')
  }

  function handleCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!canManage) {
      return
    }

    const year =
      Number(newYear)

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      setError(
        'Saisissez une année comprise entre 2000 et 2100.',
      )

      return
    }

    const cleaned: CampagneDetails = {
      ...newDetails,

      nom:
        newDetails.nom.trim(),

      description:
        newDetails.description.trim(),
    }

    const validationError =
      validateDetails(cleaned)

    if (validationError) {
      setError(validationError)
      return
    }

    const input: NouvelleCampagne = {
      ...cleaned,

      annee: year,
    }

    try {
      const id =
        createCampagne(input)

      setSelectedId(id)

      setActiveTab('general')

      setCreating(false)
      setEditing(false)

      const logged = logCampagne(
        'creation',
        id,
        'Nouvelle campagne créée en préparation.',
      )

      showSuccess(
        `Campagne ${id} créée.`,
        logged,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de créer la campagne.',
      )
    }
  }

  /* =======================================================
     DUPLIQUER
     ======================================================= */

  function handleDuplicate() {
    if (
      !canManage ||
      !selected
    ) {
      return
    }

    const confirmed = window.confirm(
      `Dupliquer ${selected.id} ? Seuls les paramètres seront copiés. Les commandes, donateurs associés à des commandes et fiches de caisse ne seront pas dupliqués.`,
    )

    if (!confirmed) {
      return
    }

    try {
      const sourceId =
        selected.id

      const id =
        duplicateCampagne(sourceId)

      setSelectedId(id)

      setActiveTab('general')

      setEditing(false)

      const logged = logCampagne(
        'duplication',
        id,
        `Campagne créée à partir des paramètres de ${sourceId}, sans copie des opérations.`,
      )

      showSuccess(
        `Campagne ${id} créée par duplication.`,
        logged,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de dupliquer la campagne.',
      )
    }
  }

  /* =======================================================
     ACTIVER
     ======================================================= */

  function handleActivate() {
    if (
      !canManage ||
      !selected ||
      selected.statut === 'ACTIVE' ||
      selected.statut === 'TERMINEE'
    ) {
      return
    }

    if (
      selected.prixUnitaire === null ||
      selected.prixUnitaire <= 0
    ) {
      setError(
        "Renseignez un prix unitaire supérieur à zéro avant d'activer la campagne.",
      )

      setActiveTab('tarifs')

      return
    }

    const previousActive =
      activeCampagne?.id

    const message = previousActive
      ? `Activer ${selected.id} ? La campagne ${previousActive} ne sera plus active.`
      : `Activer ${selected.id} ?`

    if (!window.confirm(message)) {
      return
    }

    try {
      const id =
        selected.id

      activateCampagne(id)

      const logged = logCampagne(
        'activation',
        id,
        previousActive
          ? `Campagne activée en remplacement de ${previousActive}.`
          : 'Campagne activée.',
      )

      showSuccess(
        `${id} est désormais la campagne active.`,
        logged,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Impossible d'activer la campagne.",
      )
    }
  }

  /* =======================================================
     TERMINER
     ======================================================= */

  function handleFinish() {
    if (
      !canManage ||
      !selected ||
      selected.statut === 'TERMINEE'
    ) {
      return
    }

    const id =
      selected.id

    const confirmed = window.confirm(
      `Terminer ${id} ? La campagne ne pourra plus être modifiée depuis cette page. Ses commandes et fiches de caisse seront conservées.`,
    )

    if (!confirmed) {
      return
    }

    try {
      finishCampagne(id)

      setEditing(false)

      const logged = logCampagne(
        'cloture',
        id,
        'Campagne marquée comme terminée.',
      )

      showSuccess(
        `Campagne ${id} terminée.`,
        logged,
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Impossible de terminer la campagne.',
      )
    }
  }

  /* =======================================================
     AUCUNE CAMPAGNE
     ======================================================= */

  if (!selected) {
    return (
      <div className="campagnes-page">

        <Link
          to="/administration"
          className="campagnes-back"
        >
          <ArrowLeft size={16} />
          Administration
        </Link>

        <div className="campagnes-empty-page">

          <FolderKanban size={40} />

          <h1>
            Aucune campagne
          </h1>

          <p>
            Créez une première édition
            pour commencer.
          </p>

          {canManage && (

            <button
              type="button"
              className="campagnes-primary"
              onClick={openCreate}
            >
              <Plus size={17} />

              Nouvelle campagne
            </button>

          )}

        </div>

        {creating && renderCreateModal()}

      </div>
    )
  }

  /* =======================================================
     MODALE DE CRÉATION

     Fonction locale pour partager la modale entre
     l'affichage normal et l'état sans campagne.
     ======================================================= */

  function renderCreateModal() {
    if (!creating) {
      return null
    }

    return (
      <div
        className="campagnes-modal-overlay"
        role="presentation"
      >

        <div
          className="campagnes-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="campagnes-modal-title"
        >

          <div className="campagnes-modal-header">

            <div>

              <span className="campagnes-eyebrow">
                ADMINISTRATION
              </span>

              <h2 id="campagnes-modal-title">
                Nouvelle campagne
              </h2>

              <p>
                Créez une nouvelle édition
                sans reprendre les opérations
                des années précédentes.
              </p>

            </div>

            <button
              type="button"
              className="campagnes-icon-button"
              onClick={() => {
                setCreating(false)
                setError('')
              }}
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

          </div>

          <form onSubmit={handleCreate}>

            <div className="campagnes-modal-content">

              <div className="campagnes-fields">

                <Field label="Année *">

                  <input
                    required
                    type="number"
                    min={2000}
                    max={2100}
                    step={1}
                    value={newYear}
                    onChange={(event) =>
                      setNewYear(
                        event.target.value,
                      )
                    }
                  />

                </Field>

                <Field label="Nom de la campagne *">

                  <input
                    required
                    type="text"
                    maxLength={150}
                    value={newDetails.nom}
                    onChange={(event) =>
                      updateNewDetails(
                        'nom',
                        event.target.value,
                      )
                    }
                  />

                </Field>

                <Field label="Date de début">

                  <input
                    type="date"
                    value={newDetails.dateDebut}
                    onChange={(event) =>
                      updateNewDetails(
                        'dateDebut',
                        event.target.value,
                      )
                    }
                  />

                </Field>

                <Field label="Date de fin">

                  <input
                    type="date"
                    value={newDetails.dateFin}
                    onChange={(event) =>
                      updateNewDetails(
                        'dateFin',
                        event.target.value,
                      )
                    }
                  />

                </Field>

                <Field label="Prix unitaire (€)">

                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="À définir"
                    value={
                      newDetails.prixUnitaire ??
                      ''
                    }
                    onChange={(event) =>
                      updateNewDetails(
                        'prixUnitaire',
                        optionalNumber(
                          event.target.value,
                        ),
                      )
                    }
                  />

                </Field>

                <Field label="Objectif brioches">

                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="À définir"
                    value={
                      newDetails.objectifBrioches ??
                      ''
                    }
                    onChange={(event) =>
                      updateNewDetails(
                        'objectifBrioches',
                        optionalNumber(
                          event.target.value,
                        ),
                      )
                    }
                  />

                </Field>

                <Field
                  label="Description"
                  wide
                >

                  <textarea
                    rows={3}
                    maxLength={1000}
                    value={
                      newDetails.description
                    }
                    onChange={(event) =>
                      updateNewDetails(
                        'description',
                        event.target.value,
                      )
                    }
                  />

                </Field>

              </div>

              {error && (

                <div
                  className="campagnes-message error"
                  role="alert"
                >
                  <CircleAlert size={17} />

                  {error}
                </div>

              )}

              <div className="campagnes-modal-note">

                <Info size={17} />

                <span>
                  La campagne sera créée
                  en préparation. Vous pourrez
                  ensuite compléter ses objectifs,
                  puis l'activer.
                </span>

              </div>

            </div>

            <div className="campagnes-modal-actions">

              <button
                type="button"
                className="campagnes-secondary"
                onClick={() => {
                  setCreating(false)
                  setError('')
                }}
              >
                Annuler
              </button>

              <button
                type="submit"
                className="campagnes-primary"
              >
                <Plus size={17} />

                Créer la campagne
              </button>

            </div>

          </form>

        </div>

      </div>
    )
  }

  /* =======================================================
     AFFICHAGE PRINCIPAL
     ======================================================= */

  return (
    <div className="campagnes-page">

      {/* RETOUR */}

      <Link
        to="/administration"
        className="campagnes-back"
      >
        <ArrowLeft size={16} />

        Administration
      </Link>

      {/* ===================================================
          EN-TÊTE
      =================================================== */}

      <header className="campagnes-header">

        <div className="campagnes-header-left">

          <div className="campagnes-header-icon">
            <CalendarDays size={27} />
          </div>

          <div>

            <span className="campagnes-eyebrow">
              ADMINISTRATION
            </span>

            <h1>
              Gestion des campagnes
            </h1>

            <p>
              Configurez vos éditions et
              consultez leurs données associées.
            </p>

          </div>

        </div>

        {canManage && (

          <button
            type="button"
            className="campagnes-primary"
            onClick={openCreate}
          >
            <Plus size={18} />

            Nouvelle campagne
          </button>

        )}

      </header>

      {/* INFORMATION */}

      <div className="campagnes-info">

        <Info size={18} />

        <span>
          Les commandes et les fiches de caisse
          restent rattachées à leur campagne
          d'origine. La duplication ne copie
          que les paramètres de configuration.
        </span>

      </div>

      {/* MESSAGES */}

      {notice && (

        <div
          className="campagnes-message success"
          role="status"
        >
          <CheckCircle2 size={18} />

          {notice}
        </div>

      )}

      {error && !creating && (

        <div
          className="campagnes-message error"
          role="alert"
        >
          <CircleAlert size={18} />

          {error}
        </div>

      )}

      {/* ===================================================
          INDICATEURS GLOBAUX
      =================================================== */}

      <div className="campagnes-global-stats">

        <div className="campagnes-global-stat">

          <div className="campagnes-stat-icon orange">
            <CalendarDays size={21} />
          </div>

          <div>

            <span>
              Campagne active
            </span>

            <strong>
              {activeCampagne?.id ??
                'Aucune'}
            </strong>

          </div>

        </div>

        <div className="campagnes-global-stat">

          <div className="campagnes-stat-icon blue">
            <FolderKanban size={21} />
          </div>

          <div>

            <span>
              Campagnes enregistrées
            </span>

            <strong>
              {campagnes.length}
            </strong>

          </div>

        </div>

        <div className="campagnes-global-stat">

          <div className="campagnes-stat-icon green">
            <CheckCircle2 size={21} />
          </div>

          <div>

            <span>
              Campagnes terminées
            </span>

            <strong>
              {
                campagnes.filter(
                  (campagne) =>
                    campagne.statut ===
                    'TERMINEE',
                ).length
              }
            </strong>

          </div>

        </div>

      </div>

      {/* ===================================================
          LAYOUT
      =================================================== */}

      <div className="campagnes-layout">

        {/* ================================================
            LISTE À GAUCHE
        ================================================ */}

        <aside className="campagnes-sidebar">

          <div className="campagnes-sidebar-heading">

            <h2>
              Campagnes
            </h2>

            <span>
              {campagnes.length}
            </span>

          </div>

          <div className="campagnes-search">

            <Search size={18} />

            <input
              type="search"
              placeholder="Rechercher une campagne..."
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
            />

          </div>

          <div className="campagnes-list">

            {filteredCampagnes.length === 0 && (

              <p className="campagnes-list-empty">
                Aucune campagne trouvée.
              </p>

            )}

            {filteredCampagnes.map(
              (campagne) => (

                <button
                  key={campagne.id}
                  type="button"
                  className={`campagnes-list-item ${
                    selected.id === campagne.id
                      ? 'selected'
                      : ''
                  }`}
                  aria-pressed={
                    selected.id === campagne.id
                  }
                  onClick={() =>
                    selectCampagne(campagne)
                  }
                >

                  <div className="campagnes-list-icon">
                    <CalendarDays size={21} />
                  </div>

                  <div className="campagnes-list-text">

                    <strong>
                      {campagne.id}
                    </strong>

                    <span>
                      {campagne.nom}
                    </span>

                    <span
                      className={`campagnes-status status-${campagne.statut.toLowerCase()}`}
                    >
                      {
                        STATUS[
                          campagne.statut
                        ].label
                      }
                    </span>

                  </div>

                  <ArrowRight size={16} />

                </button>

              ),
            )}

          </div>

        </aside>

        {/* ================================================
            FICHE À DROITE
        ================================================ */}

        <main className="campagnes-main">

          {/* ==============================================
              ENTÊTE DE LA CAMPAGNE
          ============================================== */}

          <section className="campagnes-card">

            <div className="campagnes-detail-header">

              <div className="campagnes-detail-title">

                <div className="campagnes-detail-icon">
                  <FolderKanban size={25} />
                </div>

                <div>

                  <span className="campagnes-eyebrow">
                    CAMPAGNE SÉLECTIONNÉE
                  </span>

                  <h2>
                    {selected.id}
                  </h2>

                  <p>
                    {selected.nom}
                  </p>

                </div>

              </div>

              <span
                className={`campagnes-status status-${selected.statut.toLowerCase()}`}
              >
                {
                  STATUS[
                    selected.statut
                  ].label
                }
              </span>

            </div>

            {/* BARRE D'ACTIONS */}

            <div className="campagnes-actions">

              {canManage &&
                selected.statut !==
                  'TERMINEE' &&
                !editing && (

                  <button
                    type="button"
                    className="campagnes-secondary"
                    onClick={startEditing}
                  >
                    <Pencil size={16} />

                    Modifier
                  </button>

                )}

              {canManage && (

                <button
                  type="button"
                  className="campagnes-secondary"
                  onClick={handleDuplicate}
                >
                  <Copy size={16} />

                  Dupliquer
                </button>

              )}

              {canManage &&
                selected.statut !== 'ACTIVE' &&
                selected.statut !== 'TERMINEE' && (

                  <button
                    type="button"
                    className="campagnes-primary"
                    onClick={handleActivate}
                    disabled={editing}
                    title={
                      editing
                        ? 'Enregistrez ou annulez les modifications avant activation.'
                        : undefined
                    }
                  >
                    <Check size={17} />

                    Activer
                  </button>

                )}

              {canManage &&
                selected.statut !== 'TERMINEE' && (

                  <button
                    type="button"
                    className="campagnes-danger"
                    onClick={handleFinish}
                    disabled={editing}
                  >
                    Terminer
                  </button>

                )}

            </div>

            {selected.statut === 'TERMINEE' && (

              <div className="campagnes-closed-note">

                <CheckCircle2 size={18} />

                Cette campagne est terminée.
                Sa configuration n'est plus modifiable
                depuis cette page.
              </div>

            )}

            {editing && (

              <div className="campagnes-edit-note">

                <Pencil size={16} />

                Mode modification activé.
                Vous pouvez passer d'un onglet
                à l'autre sans perdre les valeurs
                saisies.

              </div>

            )}

          </section>

          {/* ==============================================
              INDICATEURS DE LA CAMPAGNE
          ============================================== */}

          <div className="campagnes-kpis">

            <div className="campagnes-kpi">

              <div className="campagnes-kpi-icon orange">
                <Package size={21} />
              </div>

              <span>
                Brioches commandées
              </span>

              <strong>
                {numberFormatter.format(
                  quantiteCommandee,
                )}
              </strong>

              <small>
                Hors brouillons et annulations
              </small>

            </div>

            <div className="campagnes-kpi">

              <div className="campagnes-kpi-icon blue">
                <Euro size={21} />
              </div>

              <span>
                Montant des commandes
              </span>

              <strong>
                {moneyFormatter.format(
                  montantCommandes,
                )}
              </strong>

              <small>
                Calculé avec les prix
                enregistrés sur les commandes
              </small>

            </div>

            <div className="campagnes-kpi">

              <div className="campagnes-kpi-icon green">
                <Users size={21} />
              </div>

              <span>
                Donateurs concernés
              </span>

              <strong>
                {donateursCount}
              </strong>

              <small>
                Donateurs distincts
                des commandes retenues
              </small>

            </div>

            <div className="campagnes-kpi">

              <div className="campagnes-kpi-icon purple">
                <ClipboardList size={21} />
              </div>

              <span>
                Fiches de caisse
              </span>

              <strong>
                {fiches.length}
              </strong>

              <small>
                Rattachées à cette édition
              </small>

            </div>

          </div>

          {/* ==============================================
              PROGRESSION
          ============================================== */}

          <section className="campagnes-card">

            <div className="campagnes-section-heading">

              <div>

                <h3>
                  Avancement
                </h3>

                <p>
                  Progression par rapport
                  à l'objectif de brioches
                </p>

              </div>

              <strong>
                {progression === null
                  ? 'Objectif non défini'
                  : `${Math.round(progression)} %`}
              </strong>

            </div>

            <div className="campagnes-progress-track">

              <div
                className="campagnes-progress-bar"
                style={{
                  width: `${
                    progression === null
                      ? 0
                      : Math.min(
                          100,
                          Math.max(
                            0,
                            progression,
                          ),
                        )
                  }%`,
                }}
              />

            </div>

            <p className="campagnes-progress-caption">

              {numberFormatter.format(
                quantiteCommandee,
              )}
              {' brioches sur '}

              {number(
                selected.objectifBrioches,
              )}

              {' prévues'}

            </p>

          </section>

          {/* ==============================================
              ONGLETS
          ============================================== */}

          <section className="campagnes-card">

            <div className="campagnes-tabs">

              <button
                type="button"
                className={
                  activeTab === 'general'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setActiveTab('general')
                }
              >
                <Settings size={16} />

                Général
              </button>

              <button
                type="button"
                className={
                  activeTab === 'tarifs'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setActiveTab('tarifs')
                }
              >
                <Target size={16} />

                Tarifs et objectifs
              </button>

              <button
                type="button"
                className={
                  activeTab === 'organisation'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setActiveTab(
                    'organisation',
                  )
                }
              >
                <Users size={16} />

                Organisation
              </button>

              <button
                type="button"
                className={
                  activeTab === 'documents'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setActiveTab(
                    'documents',
                  )
                }
              >
                <FileText size={16} />

                Documents
              </button>

            </div>

            {/* FORMULAIRE COMMUN AUX DEUX ONGLETS */}

            <form onSubmit={saveDetails}>

              {/* ==========================================
                  GÉNÉRAL
              ========================================== */}

              {activeTab === 'general' && (

                <div className="campagnes-tab-content">

                  <div className="campagnes-section-heading">

                    <div>

                      <h3>
                        Informations générales
                      </h3>

                      <p>
                        Identification et calendrier
                        de l'édition
                      </p>

                    </div>

                  </div>

                  {editing ? (

                    <div className="campagnes-fields">

                      <Field
                        label="Nom de la campagne"
                        wide
                      >

                        <input
                          required
                          maxLength={150}
                          value={draft.nom}
                          onChange={(event) =>
                            updateDraft(
                              'nom',
                              event.target.value,
                            )
                          }
                        />

                      </Field>

                      <Field label="Date de début">

                        <input
                          type="date"
                          value={
                            draft.dateDebut
                          }
                          onChange={(event) =>
                            updateDraft(
                              'dateDebut',
                              event.target.value,
                            )
                          }
                        />

                      </Field>

                      <Field label="Date de fin">

                        <input
                          type="date"
                          value={
                            draft.dateFin
                          }
                          onChange={(event) =>
                            updateDraft(
                              'dateFin',
                              event.target.value,
                            )
                          }
                        />

                      </Field>

                      <Field
                        label="Description"
                        wide
                      >

                        <textarea
                          rows={4}
                          maxLength={1000}
                          value={
                            draft.description
                          }
                          onChange={(event) =>
                            updateDraft(
                              'description',
                              event.target.value,
                            )
                          }
                        />

                      </Field>

                    </div>

                  ) : (

                    <div className="campagnes-info-grid">

                      <div>

                        <span>
                          Identifiant
                        </span>

                        <strong>
                          {selected.id}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Année
                        </span>

                        <strong>
                          {selected.annee ??
                            'Non renseignée'}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Date de début
                        </span>

                        <strong>
                          {dateLabel(
                            selected.dateDebut,
                          )}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Date de fin
                        </span>

                        <strong>
                          {dateLabel(
                            selected.dateFin,
                          )}
                        </strong>

                      </div>

                      <div className="wide">

                        <span>
                          Description
                        </span>

                        <strong>
                          {selected.description ||
                            'Aucune description'}
                        </strong>

                      </div>

                    </div>

                  )}

                </div>

              )}

              {/* ==========================================
                  TARIFS ET OBJECTIFS
              ========================================== */}

              {activeTab === 'tarifs' && (

                <div className="campagnes-tab-content">

                  <div className="campagnes-section-heading">

                    <div>

                      <h3>
                        Tarifs et objectifs
                      </h3>

                      <p>
                        Configuration propre
                        à cette campagne
                      </p>

                    </div>

                  </div>

                  {editing ? (

                    <div className="campagnes-fields">

                      <Field label="Prix unitaire (€)">

                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Non renseigné"
                          value={
                            draft.prixUnitaire ??
                            ''
                          }
                          onChange={(event) =>
                            updateDraft(
                              'prixUnitaire',
                              optionalNumber(
                                event.target.value,
                              ),
                            )
                          }
                        />

                      </Field>

                      <Field label="Objectif brioches">

                        <input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="Non renseigné"
                          value={
                            draft.objectifBrioches ??
                            ''
                          }
                          onChange={(event) =>
                            updateDraft(
                              'objectifBrioches',
                              optionalNumber(
                                event.target.value,
                              ),
                            )
                          }
                        />

                      </Field>

                      <Field label="Objectif donateurs">

                        <input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="Non renseigné"
                          value={
                            draft.objectifDonateurs ??
                            ''
                          }
                          onChange={(event) =>
                            updateDraft(
                              'objectifDonateurs',
                              optionalNumber(
                                event.target.value,
                              ),
                            )
                          }
                        />

                      </Field>

                      <Field label="Budget prévisionnel (€)">

                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Non renseigné"
                          value={
                            draft.budgetPrevisionnel ??
                            ''
                          }
                          onChange={(event) =>
                            updateDraft(
                              'budgetPrevisionnel',
                              optionalNumber(
                                event.target.value,
                              ),
                            )
                          }
                        />

                      </Field>

                    </div>

                  ) : (

                    <div className="campagnes-info-grid">

                      <div>

                        <span>
                          Prix unitaire
                        </span>

                        <strong>
                          {money(
                            selected.prixUnitaire,
                          )}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Objectif brioches
                        </span>

                        <strong>
                          {number(
                            selected.objectifBrioches,
                          )}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Objectif donateurs
                        </span>

                        <strong>
                          {number(
                            selected.objectifDonateurs,
                          )}
                        </strong>

                      </div>

                      <div>

                        <span>
                          Budget prévisionnel
                        </span>

                        <strong>
                          {money(
                            selected.budgetPrevisionnel,
                          )}
                        </strong>

                      </div>

                    </div>

                  )}

                  <div className="campagnes-tab-note">

                    <Info size={16} />

                    Modifier le prix de cette campagne
                    ne modifie pas les prix déjà
                    enregistrés sur les commandes.

                  </div>

                </div>

              )}

              {/* ==========================================
                  ORGANISATION
              ========================================== */}

              {activeTab === 'organisation' && (

                <div className="campagnes-placeholder">

                  <Users size={34} />

                  <h3>
                    Organisation de la campagne
                  </h3>

                  <p>
                    Cette rubrique accueillera
                    les établissements, secteurs,
                    responsables et affectations
                    propres à chaque édition.
                  </p>

                  <span>
                    Module à développer
                  </span>

                </div>

              )}

              {/* ==========================================
                  DOCUMENTS
              ========================================== */}

              {activeTab === 'documents' && (

                <div className="campagnes-placeholder">

                  <FileText size={34} />

                  <h3>
                    Documents de la campagne
                  </h3>

                  <p>
                    Les modèles documentaires,
                    justificatifs et paramètres
                    d'édition seront reliés
                    à cette campagne ici.
                  </p>

                  <span>
                    Module à développer
                  </span>

                </div>

              )}

              {/* ==========================================
                  ACTIONS D'ÉDITION
              ========================================== */}

              {editing && (

                <div className="campagnes-edit-actions">

                  <button
                    type="button"
                    className="campagnes-secondary"
                    onClick={cancelEditing}
                  >
                    <X size={16} />

                    Annuler
                  </button>

                  <button
                    type="submit"
                    className="campagnes-primary"
                  >
                    <Check size={17} />

                    Enregistrer
                  </button>

                </div>

              )}

            </form>

          </section>

          {/* ==============================================
              DONNÉES ASSOCIÉES
          ============================================== */}

          <section className="campagnes-card">

            <div className="campagnes-section-heading">

              <div>

                <h3>
                  Données associées
                </h3>

                <p>
                  Les opérations ci-dessous
                  restent rattachées à {selected.id}.
                </p>

              </div>

            </div>

            <div className="campagnes-linked-grid">

              <Link to="/commandes">

                <Package size={20} />

                <div>

                  <strong>
                    {commandes.length}
                    {' commandes'}
                  </strong>

                  <span>
                    Consulter les commandes
                  </span>

                </div>

                <ArrowRight size={17} />

              </Link>

              <Link to="/encaissements/fiches-caisse">

                <ClipboardList size={20} />

                <div>

                  <strong>
                    {fiches.length}
                    {' fiches de caisse'}
                  </strong>

                  <span>
                    Consulter les encaissements
                  </span>

                </div>

                <ArrowRight size={17} />

              </Link>

            </div>

            <p className="campagnes-linked-note">
              Ces liens ouvrent les modules
              correspondants. Leur filtrage automatique
              sur la campagne sélectionnée
              reste à raccorder.
            </p>

          </section>

        </main>

      </div>

      {/* ===================================================
          MODALE NOUVELLE CAMPAGNE
      =================================================== */}

      {renderCreateModal()}

    </div>
  )
}

export default Campagnes