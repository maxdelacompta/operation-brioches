import {
  useId,
  useMemo,
  useState,
  type FormEvent,
} from 'react'

import { Link } from 'react-router-dom'

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Coins,
  FileCheck2,
  Landmark,
  Plus,
  RotateCcw,
  Wallet,
  X,
} from 'lucide-react'

import { useObData } from '../contexts/ObDataContext'

import type { DepotBanque } from '../types/ob'

import {
  BILLETS,
  PIECES,
  calculerCoffre,
  eurosVersCentimes,
  formatEuro,
  type CoupureKey,
} from '../services/coffre'

import './SuiviBanque.css'

/* =========================================================
   TYPES ET CONFIGURATION
   ========================================================= */

type SaisieRemise = Omit<
  DepotBanque,
  'id' | 'date' | 'statut'
>

const COUPURES = [
  ...BILLETS,
  ...PIECES,
] as const

function formulaireVide(
  campagne: string,
): SaisieRemise {
  return {
    campagne,
    reference: '',
    remarque: '',

    billets100: 0,
    billets50: 0,
    billets20: 0,
    billets10: 0,
    billets5: 0,

    pieces2: 0,
    pieces1: 0,
    pieces050: 0,
    pieces020: 0,
    pieces010: 0,
    pieces005: 0,
    pieces002: 0,
    pieces001: 0,

    nbCheques: 0,
    montantCheques: 0,
  }
}

/* =========================================================
   CALCULS
   ========================================================= */

function montantEspeces(
  depot: SaisieRemise,
): number {
  return COUPURES.reduce(
    (total, coupure) =>
      total +
      depot[coupure.key] *
        coupure.valeurCentimes,
    0,
  )
}

function montantTotal(
  depot: SaisieRemise,
): number {
  return (
    montantEspeces(depot) +
    Math.round(
      depot.montantCheques * 100,
    )
  )
}

function dateFr(
  date: string,
): string {
  const valeur = new Date(date)

  return Number.isNaN(
    valeur.getTime(),
  )
    ? date
    : valeur.toLocaleDateString(
        'fr-FR',
      )
}

/* =========================================================
   COMPOSANT PRINCIPAL
   ========================================================= */

export default function SuiviBanque() {
  const {
    campagnes,
    activeCampagne,
    fichesCaisse,
    depotsBanque,
    creerDepotBanque,
    annulerDepotBanque,
  } = useObData()

  const panelId = useId()

  /* =======================================================
     CAMPAGNE
     ======================================================= */

  const [
    campagneChoisie,
    setCampagneChoisie,
  ] = useState('')

  const campagne =
    campagneChoisie ||
    activeCampagne?.id ||
    campagnes[0]?.id ||
    ''

  /* =======================================================
     FORMULAIRE REPLIABLE

     Fermé par défaut.
     ======================================================= */

  const [
    formOuvert,
    setFormOuvert,
  ] = useState(false)

  const [
    form,
    setForm,
  ] = useState<SaisieRemise>(
    () => formulaireVide(campagne),
  )

  const [
    erreurForm,
    setErreurForm,
  ] = useState('')

  const [
    erreurPage,
    setErreurPage,
  ] = useState('')

  const [
    succes,
    setSucces,
  ] = useState('')

  const [
    enregistrement,
    setEnregistrement,
  ] = useState(false)

  /* =======================================================
     SITUATION DU COFFRE

     Simple lecture.
     Aucune action effectuée dans la page Coffre.
     ======================================================= */

  const calcul = useMemo(() => {
    if (!campagne) {
      return {
        solde: null,
        erreur:
          'Aucune campagne disponible.',
      }
    }

    try {
      return {
        solde: calculerCoffre(
          campagne,
          fichesCaisse,
          depotsBanque,
        ),
        erreur: '',
      }
    } catch (cause) {
      return {
        solde: null,
        erreur:
          cause instanceof Error
            ? cause.message
            : 'Calcul du coffre impossible.',
      }
    }
  }, [
    campagne,
    fichesCaisse,
    depotsBanque,
  ])

  /* =======================================================
     HISTORIQUE DES DÉPÔTS
     ======================================================= */

  const depots = useMemo(
    () =>
      depotsBanque
        .filter(
          (depot) =>
            depot.campagne === campagne,
        )
        .slice()
        .reverse(),
    [
      campagne,
      depotsBanque,
    ],
  )

  const depotsActifs = depots.filter(
    (depot) =>
      depot.statut === 'ENREGISTRE',
  )

  const totalRemis =
    depotsActifs.reduce(
      (total, depot) =>
        total + montantTotal(depot),
      0,
    )

  const totalSaisi =
    montantTotal(form)

  const saisieValide =
    Number.isSafeInteger(
      totalSaisi,
    ) &&
    totalSaisi > 0

  /* =======================================================
     CHANGER DE CAMPAGNE
     ======================================================= */

  function changerCampagne(
    id: string,
  ) {
    setCampagneChoisie(id)

    setForm(
      formulaireVide(id),
    )

    setFormOuvert(false)
    setErreurForm('')
    setErreurPage('')
    setSucces('')
  }

  /* =======================================================
     OUVRIR / FERMER LE FORMULAIRE
     ======================================================= */

  function basculerFormulaire() {
    if (
      enregistrement ||
      !campagne ||
      !calcul.solde
    ) {
      return
    }

    if (!formOuvert) {
      setForm(
        formulaireVide(campagne),
      )

      setErreurForm('')
      setErreurPage('')
      setSucces('')
    }

    setFormOuvert(
      (actuel) => !actuel,
    )
  }

  /* =======================================================
     MODIFIER UNE COUPURE
     ======================================================= */

  function changerCoupure(
    key: CoupureKey,
    saisie: string,
  ) {
    setForm(
      (actuel) => ({
        ...actuel,

        [key]:
          saisie === ''
            ? 0
            : Number(saisie),
      }),
    )

    setErreurForm('')
  }

  /* =======================================================
     VÉRIFIER LE DÉPÔT
     ======================================================= */

  function verifierSaisie() {
    if (
      !campagne ||
      !calcul.solde
    ) {
      throw new Error(
        'Solde du coffre indisponible.',
      )
    }

    if (
      !form.reference.trim()
    ) {
      throw new Error(
        'Renseigne la référence du bordereau.',
      )
    }

    for (
      const coupure of COUPURES
    ) {
      if (
        !Number.isSafeInteger(
          form[coupure.key],
        ) ||
        form[coupure.key] < 0
      ) {
        throw new Error(
          `Quantité invalide pour ${coupure.label}.`,
        )
      }
    }

    if (
      !Number.isSafeInteger(
        form.nbCheques,
      ) ||
      form.nbCheques < 0
    ) {
      throw new Error(
        'Le nombre de chèques doit être un entier positif ou nul.',
      )
    }

    const chequesCentimes =
      eurosVersCentimes(
        form.montantCheques,
      )

    if (
      (form.nbCheques === 0) !==
      (chequesCentimes === 0)
    ) {
      throw new Error(
        'Le nombre et le montant des chèques sont incohérents.',
      )
    }

    if (!saisieValide) {
      throw new Error(
        'Saisis au moins une somme positive.',
      )
    }

    /* Simulation pour vérifier que le dépôt
       ne dépasse pas les disponibilités. */

    const simulation: DepotBanque = {
      ...form,

      campagne,

      reference:
        form.reference.trim(),

      id:
        `simulation-${Date.now()}`,

      date:
        new Date().toISOString(),

      statut: 'ENREGISTRE',
    }

    calculerCoffre(
      campagne,
      fichesCaisse,
      [
        ...depotsBanque,
        simulation,
      ],
    )
  }

  /* =======================================================
     ENREGISTRER UN DÉPÔT
     ======================================================= */

  function enregistrerDepot(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (enregistrement) {
      return
    }

    setErreurForm('')

    try {
      verifierSaisie()

      const reference =
        form.reference.trim()

      const confirmation =
        window.confirm(
          `Confirmer la remise « ${reference} » de ${formatEuro(totalSaisi)} ?\n\n` +
          'Elle apparaîtra dans l’historique et sera déduite du coffre.',
        )

      if (!confirmation) {
        return
      }

      setEnregistrement(true)

      creerDepotBanque({
        ...form,
        campagne,
        reference,
      })

      /* Replier automatiquement le formulaire
         après enregistrement. */

      setFormOuvert(false)

      setForm(
        formulaireVide(campagne),
      )

      setErreurPage('')

      setSucces(
        `Remise « ${reference} » enregistrée dans l’historique.`,
      )
    } catch (cause) {
      setErreurForm(
        cause instanceof Error
          ? cause.message
          : 'Enregistrement impossible.',
      )
    } finally {
      setEnregistrement(false)
    }
  }

  /* =======================================================
     ANNULER UN DÉPÔT

     Le dépôt reste dans l'historique.
     ======================================================= */

  function annulerDepot(
    depot: DepotBanque,
  ) {
    if (
      depot.statut !== 'ENREGISTRE'
    ) {
      return
    }

    const confirmation =
      window.confirm(
        `Annuler la remise « ${depot.reference} » ?\n\n` +
        'Elle restera dans l’historique et ses fonds seront réintégrés au coffre.',
      )

    if (!confirmation) {
      return
    }

    try {
      annulerDepotBanque(
        depot.id,
      )

      setErreurPage('')

      setSucces(
        `Remise « ${depot.reference} » annulée. Elle reste dans l’historique.`,
      )
    } catch (cause) {
      setSucces('')

      setErreurPage(
        cause instanceof Error
          ? cause.message
          : 'Annulation impossible.',
      )
    }
  }

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <div className="suivib-page">

      {/* RETOUR */}

      <Link
        className="suivib-back"
        to="/encaissements/coffre"
      >
        <ArrowLeft size={16} />

        Retour au coffre
      </Link>

      {/* ===================================================
          EN-TÊTE
         =================================================== */}

      <header className="suivib-header">

        <div className="suivib-heading">

          <span className="suivib-heading-icon">
            <Landmark size={27} />
          </span>

          <div>

            <span className="suivib-eyebrow">
              DONS PERÇUS
            </span>

            <h1>
              Suivi banque
            </h1>

            <p>
              Historique des remises bancaires.
            </p>

          </div>

        </div>

      </header>

      {/* ===================================================
          SÉLECTION CAMPAGNE
         =================================================== */}

      <div className="suivib-toolbar">

        <label htmlFor="suivib-campagne">
          Campagne
        </label>

        <select
          id="suivib-campagne"
          value={campagne}
          disabled={
            campagnes.length === 0 ||
            enregistrement
          }
          onChange={(event) =>
            changerCampagne(
              event.target.value,
            )
          }
        >

          {campagnes.length === 0 && (
            <option value="">
              Aucune campagne
            </option>
          )}

          {campagnes.map((item) => (
            <option
              key={item.id}
              value={item.id}
            >
              {item.id} — {item.nom}
            </option>
          ))}

        </select>

        <Link to="/encaissements/coffre">
          <Wallet size={16} />

          Consulter le coffre
        </Link>

      </div>

      {/* ===================================================
          MESSAGES
         =================================================== */}

      {calcul.erreur && (

        <div
          className="suivib-error"
          role="alert"
        >
          <AlertTriangle size={18} />

          {calcul.erreur}
        </div>

      )}

      {erreurPage && (

        <div
          className="suivib-error"
          role="alert"
        >
          <AlertTriangle size={18} />

          {erreurPage}
        </div>

      )}

      {succes && (

        <div
          className="suivib-success"
          role="status"
        >
          <CheckCircle2 size={18} />

          {succes}
        </div>

      )}

      {/* ===================================================
          HISTORIQUE
          TOUJOURS AFFICHÉ EN PREMIER
         =================================================== */}

      <section className="suivib-history-card">

        <div className="suivib-history-heading">

          <div>

            <span className="suivib-eyebrow">
              TRAÇABILITÉ
            </span>

            <h2>
              Historique des dépôts bancaires
            </h2>

            <p>
              {depots.length} dépôt(s) pour{' '}
              {campagne ||
                'la campagne sélectionnée'}
            </p>

          </div>

          {/* BOUTON QUI DÉROULE LE FORMULAIRE */}

          <button
            type="button"
            className="suivib-primary"
            aria-expanded={formOuvert}
            aria-controls={panelId}
            disabled={
              !campagne ||
              !calcul.solde ||
              enregistrement
            }
            onClick={basculerFormulaire}
          >

            {formOuvert ? (
              <X size={18} />
            ) : (
              <Plus size={18} />
            )}

            {formOuvert
              ? 'Fermer le formulaire'
              : 'Dépôt banque'}

          </button>

        </div>

        {/* TABLEAU OU ÉTAT VIDE */}

        {depots.length === 0 ? (

          <div className="suivib-empty">

            <Landmark size={35} />

            <strong>
              Aucun dépôt bancaire enregistré
            </strong>

            <span>
              Appuie sur « + Dépôt banque »
              pour créer la première remise.
            </span>

          </div>

        ) : (

          <div className="suivib-table-scroll">

            <table className="suivib-table">

              <thead>

                <tr>

                  <th scope="col">
                    Date
                  </th>

                  <th scope="col">
                    Référence
                  </th>

                  <th
                    scope="col"
                    className="suivib-number"
                  >
                    Billets
                  </th>

                  <th
                    scope="col"
                    className="suivib-number"
                  >
                    Pièces
                  </th>

                  <th
                    scope="col"
                    className="suivib-number"
                  >
                    Chèques
                  </th>

                  <th
                    scope="col"
                    className="suivib-number"
                  >
                    Total
                  </th>

                  <th scope="col">
                    Statut
                  </th>

                  <th scope="col">
                    Actions
                  </th>

                </tr>

              </thead>

              <tbody>

                {depots.map((depot) => {

                  const billets =
                    BILLETS.reduce(
                      (total, coupure) =>
                        total +
                        depot[coupure.key] *
                          coupure.valeurCentimes,
                      0,
                    )

                  const pieces =
                    PIECES.reduce(
                      (total, coupure) =>
                        total +
                        depot[coupure.key] *
                          coupure.valeurCentimes,
                      0,
                    )

                  return (

                    <tr
                      key={depot.id}
                      className={
                        depot.statut === 'ANNULE'
                          ? 'suivib-row-cancelled'
                          : ''
                      }
                    >

                      <td>

                        <span className="suivib-date">

                          <CalendarDays size={14} />

                          {dateFr(depot.date)}

                        </span>

                      </td>

                      <td>

                        <strong>
                          {depot.reference}
                        </strong>

                        {depot.remarque && (

                          <small className="suivib-row-note">
                            {depot.remarque}
                          </small>

                        )}

                      </td>

                      <td className="suivib-number">
                        {formatEuro(billets)}
                      </td>

                      <td className="suivib-number">
                        {formatEuro(pieces)}
                      </td>

                      <td className="suivib-number">

                        {formatEuro(
                          eurosVersCentimes(
                            depot.montantCheques,
                          ),
                        )}

                        <small className="suivib-row-note">
                          {depot.nbCheques} chèque(s)
                        </small>

                      </td>

                      <td className="suivib-number suivib-total">

                        {formatEuro(
                          montantTotal(depot),
                        )}

                      </td>

                      <td>

                        <span
                          className={`suivib-status ${
                            depot.statut === 'ANNULE'
                              ? 'cancelled'
                              : 'recorded'
                          }`}
                        >

                          {depot.statut === 'ANNULE'
                            ? 'Annulée'
                            : 'Enregistrée'}

                        </span>

                      </td>

                      <td>

                        {depot.statut ===
                        'ENREGISTRE' ? (

                          <button
                            type="button"
                            className="suivib-cancel"
                            onClick={() =>
                              annulerDepot(depot)
                            }
                          >

                            <RotateCcw size={14} />

                            Annuler

                          </button>

                        ) : (

                          <span className="suivib-muted">
                            —
                          </span>

                        )}

                      </td>

                    </tr>

                  )
                })}

              </tbody>

            </table>

          </div>

        )}

      </section>

      {/* ===================================================
          FORMULAIRE DÉROULANT

          Caché par défaut.
          Apparaît SOUS l'historique.
         =================================================== */}

      {formOuvert && (

        <section
          className="suivib-history-card"
          id={panelId}
          aria-label="Formulaire de dépôt bancaire"
          style={{
            marginTop: 20,
          }}
        >

          {/* EN-TÊTE DU FORMULAIRE */}

          <div className="suivib-modal-header">

            <div>

              <span className="suivib-eyebrow">
                NOUVELLE REMISE
              </span>

              <h2>
                Dépôt banque
              </h2>

              <p>
                Campagne {campagne} ·
                date d’enregistrement automatique
              </p>

            </div>

            <button
              type="button"
              className="suivib-close"
              aria-label="Replier le formulaire"
              disabled={enregistrement}
              onClick={basculerFormulaire}
            >
              <X size={20} />
            </button>

          </div>

          {/* FORMULAIRE */}

          <form
            onSubmit={enregistrerDepot}
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >

            <div
              className="suivib-modal-body"
              style={{
                flex: 'none',
                overflow: 'visible',
              }}
            >

              {/* RÉFÉRENCE */}

              <label className="suivib-field">

                Référence du bordereau *

                <input
                  autoFocus
                  required
                  maxLength={100}
                  placeholder="Ex. REM-2027-001"
                  value={form.reference}
                  onChange={(event) => {

                    setForm(
                      (actuel) => ({
                        ...actuel,

                        reference:
                          event.target.value,
                      }),
                    )

                    setErreurForm('')

                  }}
                />

              </label>

              {/* BILLETS */}

              <fieldset className="suivib-fieldset">

                <legend>

                  <Banknote size={17} />

                  Billets déposés

                </legend>

                <div className="suivib-denominations">

                  {BILLETS.map((coupure) => {

                    const disponible =
                      calcul.solde?.billets.find(
                        (ligne) =>
                          ligne.key === coupure.key,
                      )?.quantite ?? 0

                    return (

                      <label
                        key={coupure.key}
                        className="suivib-denomination"
                      >

                        <span>

                          <strong>
                            {coupure.label}
                          </strong>

                          <small>
                            Disponible : {disponible}
                          </small>

                        </span>

                        <input
                          type="number"
                          min={0}
                          max={disponible}
                          step={1}
                          aria-label={`Nombre de billets de ${coupure.label}`}
                          value={form[coupure.key]}
                          onChange={(event) =>
                            changerCoupure(
                              coupure.key,
                              event.target.value,
                            )
                          }
                        />

                      </label>

                    )
                  })}

                </div>

              </fieldset>

              {/* PIÈCES */}

              <fieldset className="suivib-fieldset">

                <legend>

                  <Coins size={17} />

                  Pièces déposées

                </legend>

                <div className="suivib-denominations">

                  {PIECES.map((coupure) => {

                    const disponible =
                      calcul.solde?.pieces.find(
                        (ligne) =>
                          ligne.key === coupure.key,
                      )?.quantite ?? 0

                    return (

                      <label
                        key={coupure.key}
                        className="suivib-denomination"
                      >

                        <span>

                          <strong>
                            {coupure.label}
                          </strong>

                          <small>
                            Disponible : {disponible}
                          </small>

                        </span>

                        <input
                          type="number"
                          min={0}
                          max={disponible}
                          step={1}
                          aria-label={`Nombre de pièces de ${coupure.label}`}
                          value={form[coupure.key]}
                          onChange={(event) =>
                            changerCoupure(
                              coupure.key,
                              event.target.value,
                            )
                          }
                        />

                      </label>

                    )
                  })}

                </div>

              </fieldset>

              {/* CHÈQUES */}

              <fieldset className="suivib-fieldset">

                <legend>

                  <FileCheck2 size={17} />

                  Chèques déposés

                </legend>

                <div className="suivib-checks">

                  <label className="suivib-field">

                    Nombre de chèques

                    <input
                      type="number"
                      min={0}
                      max={
                        calcul.solde?.totalCheques ??
                        0
                      }
                      step={1}
                      value={form.nbCheques}
                      onChange={(event) => {

                        setForm(
                          (actuel) => ({
                            ...actuel,

                            nbCheques:
                              Number(
                                event.target.value,
                              ),
                          }),
                        )

                        setErreurForm('')

                      }}
                    />

                    <small>
                      Disponibles :{' '}
                      {calcul.solde?.totalCheques ??
                        0}
                    </small>

                  </label>

                  <label className="suivib-field">

                    Montant des chèques (€)

                    <input
                      type="number"
                      min={0}
                      max={
                        (calcul.solde?.montantCheques ??
                          0) / 100
                      }
                      step="0.01"
                      value={form.montantCheques}
                      onChange={(event) => {

                        setForm(
                          (actuel) => ({
                            ...actuel,

                            montantCheques:
                              Number(
                                event.target.value,
                              ),
                          }),
                        )

                        setErreurForm('')

                      }}
                    />

                    <small>

                      Disponible :{' '}

                      {formatEuro(
                        calcul.solde?.montantCheques ??
                          0,
                      )}

                    </small>

                  </label>

                </div>

              </fieldset>

              {/* REMARQUE */}

              <label className="suivib-field">

                Remarque (facultative)

                <textarea
                  rows={2}
                  maxLength={250}
                  value={form.remarque ?? ''}
                  onChange={(event) =>
                    setForm(
                      (actuel) => ({
                        ...actuel,

                        remarque:
                          event.target.value,
                      }),
                    )
                  }
                />

              </label>

              {/* RÉCAPITULATIF */}

              <div className="suivib-recap">

                <div>

                  <span>
                    Espèces
                  </span>

                  <strong>

                    {Number.isSafeInteger(
                      montantEspeces(form),
                    )
                      ? formatEuro(
                          montantEspeces(form),
                        )
                      : '—'}

                  </strong>

                </div>

                <div>

                  <span>
                    Chèques
                  </span>

                  <strong>

                    {Number.isFinite(
                      form.montantCheques,
                    )
                      ? formatEuro(
                          Math.round(
                            form.montantCheques *
                              100,
                          ),
                        )
                      : '—'}

                  </strong>

                </div>

                <div className="suivib-recap-total">

                  <span>
                    Total de la remise
                  </span>

                  <strong>

                    {Number.isSafeInteger(
                      totalSaisi,
                    )
                      ? formatEuro(totalSaisi)
                      : '—'}

                  </strong>

                </div>

              </div>

              {/* ERREUR FORMULAIRE */}

              {erreurForm && (

                <div
                  className="suivib-error"
                  role="alert"
                >

                  <AlertTriangle size={17} />

                  {erreurForm}

                </div>

              )}

              <p className="suivib-modal-hint">

                La remise sera ajoutée à
                l’historique. Ses pièces,
                billets et chèques seront
                déduits du coffre.

              </p>

            </div>

            {/* ACTIONS DU FORMULAIRE */}

            <div className="suivib-modal-footer">

              <button
                type="button"
                className="suivib-secondary"
                disabled={enregistrement}
                onClick={basculerFormulaire}
              >
                Fermer
              </button>

              <button
                type="submit"
                className="suivib-primary"
                disabled={
                  enregistrement ||
                  !saisieValide
                }
              >

                <CheckCircle2 size={17} />

                {enregistrement
                  ? 'Enregistrement…'
                  : 'Enregistrer le dépôt'}

              </button>

            </div>

          </form>

        </section>

      )}

      {/* ===================================================
          INDICATEURS
         =================================================== */}

      <section
        className="suivib-stats"
        aria-label="Indicateurs des remises"
        style={{
          marginTop: 22,
        }}
      >

        <div className="suivib-stat suivib-stat-featured">

          <Wallet size={21} />

          <span>
            Disponible au coffre
          </span>

          <strong>

            {calcul.solde
              ? formatEuro(
                  calcul.solde.totalGeneral,
                )
              : '—'}

          </strong>

          <small>
            Solde physique théorique
            de la campagne
          </small>

        </div>

        <div className="suivib-stat">

          <Banknote size={21} />

          <span>
            Total des remises actives
          </span>

          <strong>
            {formatEuro(totalRemis)}
          </strong>

          <small>
            Espèces et chèques déjà sortis
          </small>

        </div>

        <div className="suivib-stat">

          <FileCheck2 size={21} />

          <span>
            Remises enregistrées
          </span>

          <strong>
            {depotsActifs.length}
          </strong>

          <small>
            Hors remises annulées
          </small>

        </div>

        <div className="suivib-stat">

          <RotateCcw size={21} />

          <span>
            Remises annulées
          </span>

          <strong>

            {depots.length -
              depotsActifs.length}

          </strong>

          <small>
            Conservées dans l’historique
          </small>

        </div>

      </section>

    </div>
  )
}