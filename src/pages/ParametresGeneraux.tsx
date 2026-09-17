import {
  useState,
  type FormEvent,
} from 'react'

import { Link } from 'react-router-dom'

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  FileText,
  Info,
  Mail,
  MapPin,
  Phone,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'

import {
  DEFAULT_SETTINGS,
  useGeneralSettings,
  type GeneralSettings,
} from '../contexts/GeneralSettingsContext'

import {
  useObData,
} from '../contexts/ObDataContext'

import {
  useUsers,
} from '../contexts/UsersContext'

import './ParametresGeneraux.css'

/* =========================================================
   PAGE
   ========================================================= */

function ParametresGeneraux() {
  /* =======================================================
     CONTEXTES EXISTANTS
     ======================================================= */

  const {
    settings,
    saveSettings,
    resetSettings,
  } = useGeneralSettings()

  const {
    campagnes,
    activeCampagne,
  } = useObData()

  const {
    users,
  } = useUsers()

  /* =======================================================
     FORMULAIRE
     ======================================================= */

  const [form, setForm] =
    useState<GeneralSettings>({
      ...settings,
    })

  const [success, setSuccess] =
    useState('')

  const [error, setError] =
    useState('')

  /* =======================================================
     MODIFICATIONS NON ENREGISTRÉES
     ======================================================= */

  const hasChanges =
    JSON.stringify(form) !==
    JSON.stringify(settings)

  /* =======================================================
     UTILISATEURS ACTIFS
     ======================================================= */

  const activeUsersCount = users.filter(
    (user) =>
      user.status === 'actif',
  ).length

  /* =======================================================
     MODIFICATION D'UN CHAMP
     ======================================================= */

  function updateField(
    field: keyof GeneralSettings,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))

    setSuccess('')
    setError('')
  }

  /* =======================================================
     ENREGISTRER
     ======================================================= */

  function handleSave(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!form.applicationName.trim()) {
      setError(
        "Le nom de l'application est obligatoire.",
      )

      return
    }

    const cleaned: GeneralSettings = {
      applicationName:
        form.applicationName.trim(),

      organizationName:
        form.organizationName.trim(),

      email:
        form.email.trim(),

      phone:
        form.phone.trim(),

      address:
        form.address.trim(),

      postalCode:
        form.postalCode.trim(),

      city:
        form.city.trim(),

      documentFooter:
        form.documentFooter.trim(),
    }

    try {
      saveSettings(cleaned)

      setForm(cleaned)

      setError('')

      setSuccess(
        'Les paramètres généraux ont été enregistrés.',
      )
    } catch {
      setSuccess('')

      setError(
        'Impossible de sauvegarder les paramètres dans ce navigateur.',
      )
    }
  }

  /* =======================================================
     ANNULER LES MODIFICATIONS
     ======================================================= */

  function handleCancel() {
    setForm({ ...settings })

    setError('')
    setSuccess('')
  }

  /* =======================================================
     RÉINITIALISER

     Ne touche pas aux utilisateurs, campagnes,
     commandes ou fiches de caisse.
     ======================================================= */

  function handleReset() {
    const confirmed = window.confirm(
      'Réinitialiser uniquement les paramètres généraux ? Les utilisateurs, campagnes, commandes et fiches de caisse seront conservés.',
    )

    if (!confirmed) {
      return
    }

    try {
      resetSettings()

      setForm({
        ...DEFAULT_SETTINGS,
      })

      setError('')

      setSuccess(
        'Les paramètres généraux ont été réinitialisés.',
      )
    } catch {
      setSuccess('')

      setError(
        'Impossible de réinitialiser les paramètres.',
      )
    }
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <div className="gs-page">

      {/* ===================================================
          LIEN RETOUR
      =================================================== */}

      <Link
        to="/administration"
        className="gs-back"
      >
        <ArrowLeft size={16} />
        Administration
      </Link>

      {/* ===================================================
          EN-TÊTE
      =================================================== */}

      <header className="gs-header">

        <div className="gs-header-left">

          <div className="gs-header-icon">
            <Settings size={27} />
          </div>

          <div>

            <span className="gs-eyebrow">
              ADMINISTRATION
            </span>

            <h1>
              Paramètres généraux
            </h1>

            <p>
              Configurez les paramètres communs
              à l'application.
            </p>

          </div>

        </div>

        <div className="gs-header-actions">

          <button
            type="button"
            className="gs-button gs-button-reset"
            onClick={handleReset}
          >
            <RotateCcw size={16} />
            Réinitialiser
          </button>

          <button
            type="submit"
            form="gs-settings-form"
            className="gs-button gs-button-primary"
            disabled={!hasChanges}
          >
            <Save size={17} />
            Enregistrer
          </button>

        </div>

      </header>

      {/* ===================================================
          INFORMATION
      =================================================== */}

      <div className="gs-info-banner">

        <Info size={18} />

        <span>
          Ces paramètres sont communs à toutes
          les campagnes. Les prix, dates et objectifs
          de chaque édition se configurent dans
          le module Campagnes.
        </span>

      </div>

      {/* ===================================================
          MESSAGES
      =================================================== */}

      {success && (

        <div
          className="gs-message gs-message-success"
          role="status"
        >
          <CheckCircle2 size={18} />
          {success}
        </div>

      )}

      {error && (

        <div
          className="gs-message gs-message-error"
          role="alert"
        >
          <Info size={18} />
          {error}
        </div>

      )}

      {/* ===================================================
          INDICATEURS RÉELS
      =================================================== */}

      <div className="gs-stats">

        {/* CAMPAGNE ACTIVE */}

        <div className="gs-stat">

          <div className="gs-stat-icon orange">
            <CalendarDays size={23} />
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

        {/* CAMPAGNES */}

        <div className="gs-stat">

          <div className="gs-stat-icon blue">
            <CalendarDays size={23} />
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

        {/* UTILISATEURS */}

        <div className="gs-stat">

          <div className="gs-stat-icon green">
            <Users size={23} />
          </div>

          <div>
            <span>
              Utilisateurs actifs
            </span>

            <strong>
              {activeUsersCount}
            </strong>
          </div>

        </div>

        {/* STOCKAGE */}

        <div className="gs-stat">

          <div className="gs-stat-icon purple">
            <Database size={23} />
          </div>

          <div>
            <span>
              Stockage actuel
            </span>

            <strong className="gs-stat-text">
              Navigateur
            </strong>
          </div>

        </div>

      </div>

      {/* ===================================================
          FORMULAIRE ET COLONNE LATÉRALE
      =================================================== */}

      <div className="gs-layout">

        {/* ================================================
            COLONNE PRINCIPALE
        ================================================ */}

        <form
          id="gs-settings-form"
          className="gs-main"
          onSubmit={handleSave}
        >

          {/* ==============================================
              APPLICATION
          ============================================== */}

          <section className="gs-card">

            <div className="gs-card-header">

              <div className="gs-card-icon">
                <Settings size={22} />
              </div>

              <div>

                <h2>
                  Application
                </h2>

                <p>
                  Identité générale du logiciel
                </p>

              </div>

            </div>

            <div className="gs-fields">

              <label className="gs-field wide">

                <span>
                  Nom de l'application
                  <b> *</b>
                </span>

                <input
                  required
                  type="text"
                  maxLength={100}
                  value={form.applicationName}
                  onChange={(event) =>
                    updateField(
                      'applicationName',
                      event.target.value,
                    )
                  }
                />

              </label>

            </div>

          </section>

          {/* ==============================================
              ORGANISATION
          ============================================== */}

          <section className="gs-card">

            <div className="gs-card-header">

              <div className="gs-card-icon">
                <Building2 size={22} />
              </div>

              <div>

                <h2>
                  Organisation
                </h2>

                <p>
                  Informations de l'organisme
                </p>

              </div>

            </div>

            <div className="gs-fields">

              <label className="gs-field wide">

                <span>
                  Nom de l'organisation
                </span>

                <input
                  type="text"
                  maxLength={150}
                  value={form.organizationName}
                  onChange={(event) =>
                    updateField(
                      'organizationName',
                      event.target.value,
                    )
                  }
                />

              </label>

              <label className="gs-field">

                <span>
                  Adresse e-mail
                </span>

                <input
                  type="email"
                  maxLength={254}
                  placeholder="Adresse à renseigner"
                  value={form.email}
                  onChange={(event) =>
                    updateField(
                      'email',
                      event.target.value,
                    )
                  }
                />

              </label>

              <label className="gs-field">

                <span>
                  Téléphone
                </span>

                <input
                  type="tel"
                  maxLength={40}
                  placeholder="Numéro à renseigner"
                  value={form.phone}
                  onChange={(event) =>
                    updateField(
                      'phone',
                      event.target.value,
                    )
                  }
                />

              </label>

              <label className="gs-field wide">

                <span>
                  Adresse
                </span>

                <input
                  type="text"
                  maxLength={200}
                  placeholder="Adresse de l'organisme"
                  value={form.address}
                  onChange={(event) =>
                    updateField(
                      'address',
                      event.target.value,
                    )
                  }
                />

              </label>

              <label className="gs-field">

                <span>
                  Code postal
                </span>

                <input
                  type="text"
                  maxLength={20}
                  value={form.postalCode}
                  onChange={(event) =>
                    updateField(
                      'postalCode',
                      event.target.value,
                    )
                  }
                />

              </label>

              <label className="gs-field">

                <span>
                  Ville
                </span>

                <input
                  type="text"
                  maxLength={100}
                  value={form.city}
                  onChange={(event) =>
                    updateField(
                      'city',
                      event.target.value,
                    )
                  }
                />

              </label>

            </div>

          </section>

          {/* ==============================================
              DOCUMENTS
          ============================================== */}

          <section className="gs-card">

            <div className="gs-card-header">

              <div className="gs-card-icon">
                <FileText size={22} />
              </div>

              <div>

                <h2>
                  Documents
                </h2>

                <p>
                  Informations destinées aux futurs
                  modèles documentaires
                </p>

              </div>

            </div>

            <div className="gs-fields">

              <label className="gs-field wide">

                <span>
                  Pied de page générique
                </span>

                <textarea
                  rows={4}
                  maxLength={1000}
                  placeholder="Texte à utiliser dans les futurs documents..."
                  value={form.documentFooter}
                  onChange={(event) =>
                    updateField(
                      'documentFooter',
                      event.target.value,
                    )
                  }
                />

                <small>
                  {form.documentFooter.length}
                  {' / 1000 caractères'}
                </small>

              </label>

            </div>

            <div className="gs-card-note">

              <Info size={16} />

              <span>
                Ce texte est sauvegardé, mais
                il n'est pas encore intégré
                aux exports PDF existants.
              </span>

            </div>

          </section>

          {/* ==============================================
              ACTIONS DU FORMULAIRE
          ============================================== */}

          <div className="gs-form-actions">

            <button
              type="button"
              className="gs-button gs-button-outline"
              onClick={handleCancel}
              disabled={!hasChanges}
            >
              Annuler les modifications
            </button>

            <button
              type="submit"
              className="gs-button gs-button-primary"
              disabled={!hasChanges}
            >
              <Save size={17} />
              Enregistrer les paramètres
            </button>

          </div>

          {hasChanges && (

            <p className="gs-unsaved">
              Des modifications ne sont pas
              encore enregistrées.
            </p>

          )}

        </form>

        {/* ================================================
            COLONNE DROITE
        ================================================ */}

        <aside className="gs-aside">

          {/* ==============================================
              APERÇU DYNAMIQUE
          ============================================== */}

          <section className="gs-card">

            <div className="gs-card-header">

              <div className="gs-card-icon">
                <Building2 size={22} />
              </div>

              <div>

                <h2>
                  Aperçu
                </h2>

                <p>
                  Résultat de la configuration saisie
                </p>

              </div>

            </div>

            <div className="gs-preview">

              <div className="gs-preview-logo">
                OB
              </div>

              <h3>
                {form.applicationName ||
                  "Nom de l'application"}
              </h3>

              <strong>
                {form.organizationName ||
                  'Organisation non renseignée'}
              </strong>

              <div className="gs-preview-divider" />

              {form.address && (

                <div className="gs-preview-line">

                  <MapPin size={15} />

                  <span>
                    {form.address}
                  </span>

                </div>

              )}

              {(form.postalCode ||
                form.city) && (

                <div className="gs-preview-line">

                  <MapPin size={15} />

                  <span>
                    {[
                      form.postalCode,
                      form.city,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </span>

                </div>

              )}

              {form.phone && (

                <div className="gs-preview-line">

                  <Phone size={15} />

                  <span>
                    {form.phone}
                  </span>

                </div>

              )}

              {form.email && (

                <div className="gs-preview-line">

                  <Mail size={15} />

                  <span>
                    {form.email}
                  </span>

                </div>

              )}

              {form.documentFooter && (

                <div className="gs-preview-footer">

                  {form.documentFooter}

                </div>

              )}

              {!form.address &&
                !form.phone &&
                !form.email &&
                !form.city && (

                  <p className="gs-preview-empty">
                    Renseignez les coordonnées
                    pour compléter l'aperçu.
                  </p>

                )}

            </div>

            <p className="gs-preview-hint">
              L'aperçu se met à jour pendant
              la saisie. Cliquez sur Enregistrer
              pour conserver les valeurs.
            </p>

          </section>

          {/* ==============================================
              STOCKAGE ET SÉCURITÉ
          ============================================== */}

          <section className="gs-card">

            <div className="gs-card-header">

              <div className="gs-card-icon">
                <ShieldCheck size={22} />
              </div>

              <div>

                <h2>
                  Stockage et sécurité
                </h2>

                <p>
                  Informations sur le prototype
                </p>

              </div>

            </div>

            <span className="gs-local-badge">
              Prototype local
            </span>

            <div className="gs-security-content">

              <p>
                Les paramètres sont stockés
                dans ce navigateur.
              </p>

              <p>
                Ils ne sont pas encore
                synchronisés entre plusieurs
                utilisateurs ou ordinateurs.
              </p>

              <p>
                Les contrôles d'accès devront
                être appliqués côté serveur
                avant le déploiement.
              </p>

            </div>

          </section>

          {/* ==============================================
              CAMPAGNES
          ============================================== */}

          <section className="gs-card">

            <div className="gs-card-header">

              <div className="gs-card-icon">
                <CalendarDays size={22} />
              </div>

              <div>

                <h2>
                  Paramètres des campagnes
                </h2>

                <p>
                  Configuration par édition
                </p>

              </div>

            </div>

            <div className="gs-campaign-info">

              <span>
                Campagne actuellement active
              </span>

              <strong>
                {activeCampagne?.id ??
                  'Aucune campagne active'}
              </strong>

            </div>

            <p className="gs-card-description">
              Les prix, dates et objectifs
              sont gérés indépendamment
              pour chaque campagne.
            </p>

            <Link
              to="/administration/campagnes"
              className="gs-campaign-link"
            >
              Gérer les campagnes
              <ArrowLeft size={16} />
            </Link>

          </section>

        </aside>

      </div>

    </div>
  )
}

export default ParametresGeneraux