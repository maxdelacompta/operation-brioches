import { useMemo, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Coins,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Heart,
  Landmark,
  RotateCcw,
  Scale,
  Wallet,
} from 'lucide-react'

import { useObData } from '../contexts/ObDataContext'

import type {
  DepotBanque,
  FicheCaisse,
  TypeFicheCaisse,
} from '../types/ob'

import {
  BILLETS,
  PIECES,
  calculerCoffre,
  formatEuro,
} from '../services/coffre'

import './RecapitulatifGlobal.css'

/* =========================================================
   CONFIGURATION ET FORMATS
   ========================================================= */

// Les calculs financiers sont effectués en centimes.

const cents = (euros: number) =>
  Math.round((Number(euros) || 0) * 100)

const nombre = (value: number) =>
  new Intl.NumberFormat('fr-FR').format(value)

function dateFr(date: string): string {
  if (!date) return '—'

  return new Date(
    `${date.slice(0, 10)}T12:00:00`,
  ).toLocaleDateString('fr-FR')
}

const types: {
  value: TypeFicheCaisse
  label: string
}[] = [
  { value: 'ENTREPRISE', label: 'Entreprises' },
  { value: 'MAIRIE', label: 'Mairies' },
  { value: 'ETABLISSEMENT', label: 'Établissements' },
  { value: 'STAND', label: 'Stands' },
  { value: 'AUTRE', label: 'Autres' },
]

const canaux = [
  {
    key: 'especes',
    label: 'Espèces',
    couleur: '#ff871a',
  },
  {
    key: 'cheques',
    label: 'Chèques',
    couleur: '#347de3',
  },
  {
    key: 'tpe',
    label: 'TPE',
    couleur: '#32ac72',
  },
  {
    key: 'virements',
    label: 'Virements',
    couleur: '#9254d8',
  },
] as const

type Canaux = Record<
  (typeof canaux)[number]['key'],
  number
>

/* =========================================================
   CALCULS DES FICHES DE CAISSE
   ========================================================= */

function encaissements(
  fiche: FicheCaisse,
): Canaux {
  const especes = [
    ...BILLETS,
    ...PIECES,
  ].reduce(
    (total, coupure) =>
      total +
      fiche[coupure.key] *
        coupure.valeurCentimes,
    0,
  )

  return {
    especes,
    cheques: cents(fiche.montantCheques),
    tpe: cents(fiche.montantTpe),
    virements: cents(fiche.montantVirement),
  }
}

function dons(
  fiche: FicheCaisse,
): number {
  return (
    fiche.nbDons5 * 500 +
    fiche.nbDons3 * 300 +
    cents(fiche.montantDonsAutres)
  )
}

function totalCanaux(
  valeurs: Canaux,
): number {
  return (
    valeurs.especes +
    valeurs.cheques +
    valeurs.tpe +
    valeurs.virements
  )
}

/* =========================================================
   CALCUL DES REMISES BANCAIRES
   ========================================================= */

function montantRemise(
  remise: DepotBanque,
): number {
  return [
    ...BILLETS,
    ...PIECES,
  ].reduce(
    (total, coupure) =>
      total +
      remise[coupure.key] *
        coupure.valeurCentimes,
    cents(remise.montantCheques),
  )
}

/* =========================================================
   EXPORT CSV COMPATIBLE EXCEL
   ========================================================= */

function csvCell(
  value: string | number,
): string {
  return `"${String(value).replace(/"/g, '""')}"`
}

/* =========================================================
   PAGE PRINCIPALE
   ========================================================= */

export default function RecapitulatifGlobal() {
  const {
    campagnes,
    activeCampagne,
    fichesCaisse,
    depotsBanque,
  } = useObData()

  /* =======================================================
     FILTRES
     ======================================================= */

  const [
    campagneChoisie,
    setCampagneChoisie,
  ] = useState('')

  const [debut, setDebut] = useState('')
  const [fin, setFin] = useState('')

  const [
    secteur,
    setSecteur,
  ] = useState('TOUS')

  const [
    typeFiche,
    setTypeFiche,
  ] = useState('TOUS')

  const campagne =
    campagneChoisie ||
    activeCampagne?.id ||
    campagnes[0]?.id ||
    ''

  const periodeInvalide = Boolean(
    debut &&
    fin &&
    debut > fin,
  )

  /* =======================================================
     FICHES DE LA CAMPAGNE
     ======================================================= */

  const fichesCampagne = useMemo(
    () =>
      fichesCaisse.filter(
        fiche =>
          fiche.campagne === campagne,
      ),
    [
      fichesCaisse,
      campagne,
    ],
  )

  const secteurs = useMemo(
    () =>
      Array.from(
        new Set(
          fichesCampagne.map(
            fiche =>
              fiche.secteur?.trim() ||
              'Non renseigné',
          ),
        ),
      ).sort(
        (a, b) =>
          a.localeCompare(b, 'fr'),
      ),
    [fichesCampagne],
  )

  /* =======================================================
     FILTRAGE DES FICHES
     ======================================================= */

  const fiches = useMemo(
    () =>
      fichesCampagne.filter(fiche => {
        const date = fiche.date.slice(0, 10)

        return (
          !periodeInvalide &&

          (!debut || date >= debut) &&

          (!fin || date <= fin) &&

          (
            secteur === 'TOUS' ||
            (
              fiche.secteur?.trim() ||
              'Non renseigné'
            ) === secteur
          ) &&

          (
            typeFiche === 'TOUS' ||
            fiche.type === typeFiche
          )
        )
      }),
    [
      fichesCampagne,
      debut,
      fin,
      secteur,
      typeFiche,
      periodeInvalide,
    ],
  )

  /* =======================================================
     BILAN GLOBAL DES ENCAISSEMENTS
     ======================================================= */

  const bilan = useMemo(
    () =>
      fiches.reduce(
        (resultat, fiche) => {
          const valeurs = encaissements(fiche)

          resultat.especes += valeurs.especes
          resultat.cheques += valeurs.cheques
          resultat.tpe += valeurs.tpe
          resultat.virements += valeurs.virements

          resultat.dons += dons(fiche)

          resultat.nbCheques += fiche.nbCheques

          return resultat
        },
        {
          especes: 0,
          cheques: 0,
          tpe: 0,
          virements: 0,
          dons: 0,
          nbCheques: 0,
        },
      ),
    [fiches],
  )

  // Les dons constituent un indicateur complémentaire.
  // Ils ne sont pas ajoutés une deuxième fois aux
  // règlements, afin d'éviter un double comptage.

  const totalEncaisse =
    bilan.especes +
    bilan.cheques +
    bilan.tpe +
    bilan.virements

  /* =======================================================
     REMISES BANCAIRES
     ======================================================= */

  const toutesRemises = useMemo(
    () =>
      depotsBanque.filter(
        remise =>
          remise.campagne === campagne,
      ),
    [
      depotsBanque,
      campagne,
    ],
  )

  const remisesPeriode = useMemo(
    () =>
      toutesRemises
        .filter(remise => {
          const date =
            remise.date.slice(0, 10)

          return (
            !periodeInvalide &&
            (!debut || date >= debut) &&
            (!fin || date <= fin)
          )
        })
        .sort(
          (a, b) =>
            b.date.localeCompare(a.date),
        ),
    [
      toutesRemises,
      debut,
      fin,
      periodeInvalide,
    ],
  )

  const remisesActives =
    remisesPeriode.filter(
      remise =>
        remise.statut === 'ENREGISTRE',
    )

  const totalRemis = remisesActives.reduce(
    (somme, remise) =>
      somme + montantRemise(remise),
    0,
  )

  const remisesAnnulees =
    remisesPeriode.filter(
      remise =>
        remise.statut === 'ANNULE',
    ).length

  /* =======================================================
     COFFRE

     Lecture seule.
     Solde actuel de toute la campagne.
     ======================================================= */

  const coffre = useMemo(() => {
    if (!campagne) {
      return {
        resultat: null,
        erreur: '',
      }
    }

    try {
      return {
        resultat: calculerCoffre(
          campagne,
          fichesCaisse,
          depotsBanque,
        ),
        erreur: '',
      }
    } catch (erreur) {
      return {
        resultat: null,
        erreur:
          erreur instanceof Error
            ? erreur.message
            : 'Solde du coffre indisponible.',
      }
    }
  }, [
    campagne,
    fichesCaisse,
    depotsBanque,
  ])

  /* =======================================================
     GRAPHIQUE CIRCULAIRE
     ======================================================= */

  const repartition = canaux.map(item => ({
    ...item,

    montant: bilan[item.key],

    pourcentage: totalEncaisse
      ? (
          bilan[item.key] /
          totalEncaisse
        ) * 100
      : 0,
  }))

  let angle = 0

  const parts = repartition.map(item => {
    const depart = angle

    angle += item.pourcentage

    return (
      `${item.couleur} ${depart}% ${angle}%`
    )
  })

  const cercle = totalEncaisse
    ? `conic-gradient(${parts.join(', ')})`
    : 'conic-gradient(#e9eef5 0% 100%)'

  /* =======================================================
     GRAPHIQUE D'ÉVOLUTION

     14 dernières dates avec des fiches.
     ======================================================= */

  const evolution = useMemo(() => {
    const jours = new Map<
      string,
      {
        date: string
        especes: number
        autres: number
      }
    >()

    for (const fiche of fiches) {
      const date =
        fiche.date.slice(0, 10)

      const precedent =
        jours.get(date) || {
          date,
          especes: 0,
          autres: 0,
        }

      const valeurs =
        encaissements(fiche)

      precedent.especes += valeurs.especes

      precedent.autres +=
        valeurs.cheques +
        valeurs.tpe +
        valeurs.virements

      jours.set(
        date,
        precedent,
      )
    }

    return Array.from(
      jours.values(),
    )
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date),
      )
      .slice(-14)
  }, [fiches])

  const maxJour = Math.max(
    1,
    ...evolution.map(
      jour =>
        jour.especes +
        jour.autres,
    ),
  )

  /* =======================================================
     RÉPARTITION PAR SECTEUR
     ======================================================= */

  const secteursBilan = useMemo(() => {
    const lignes = new Map<
      string,
      {
        secteur: string
        fiches: number
        montant: number
      }
    >()

    for (const fiche of fiches) {
      const nom =
        fiche.secteur?.trim() ||
        'Non renseigné'

      const ligne =
        lignes.get(nom) || {
          secteur: nom,
          fiches: 0,
          montant: 0,
        }

      ligne.fiches += 1

      ligne.montant +=
        totalCanaux(
          encaissements(fiche),
        )

      lignes.set(
        nom,
        ligne,
      )
    }

    return Array.from(
      lignes.values(),
    ).sort(
      (a, b) =>
        b.montant - a.montant,
    )
  }, [fiches])

  /* =======================================================
     POINTS DE VIGILANCE
     ======================================================= */

  const sansSecteur =
    fiches.filter(
      fiche =>
        !fiche.secteur?.trim(),
    ).length

  const chequesIncoherents =
    fiches.filter(
      fiche =>
        (
          fiche.nbCheques === 0
        ) !== (
          cents(
            fiche.montantCheques,
          ) === 0
        ),
    ).length

  const alertes = [
    ...(
      sansSecteur
        ? [
            `${sansSecteur} fiche(s) sans secteur renseigné.`,
          ]
        : []
    ),

    ...(
      chequesIncoherents
        ? [
            `${chequesIncoherents} fiche(s) avec nombre et montant de chèques incohérents.`,
          ]
        : []
    ),

    ...(
      remisesAnnulees
        ? [
            `${remisesAnnulees} remise(s) annulée(s) sur la période.`,
          ]
        : []
    ),

    ...(
      coffre.erreur
        ? [
            `Coffre : ${coffre.erreur}`,
          ]
        : []
    ),
  ]

  /* =======================================================
     EXPORT EXCEL — CSV
     ======================================================= */

  function exporterCsv() {
    const entetes = [
      'N° fiche',
      'Date',
      'Type',
      'Structure',
      'Ville',
      'Secteur',
      'Espèces (€)',
      'Chèques (€)',
      'TPE (€)',
      'Virements (€)',
      'Dons déclarés (€)',
      'Total encaissé (€)',
    ]

    const lignes = fiches.map(fiche => {
      const montants =
        encaissements(fiche)

      return [
        fiche.numero,
        fiche.date,
        fiche.type,
        fiche.libelle,
        fiche.ville || '',
        fiche.secteur || '',

        montants.especes / 100,
        montants.cheques / 100,
        montants.tpe / 100,
        montants.virements / 100,

        dons(fiche) / 100,

        totalCanaux(montants) / 100,
      ]
    })

    const contenu =
      '\uFEFF' +
      [
        entetes,
        ...lignes,
      ]
        .map(
          ligne =>
            ligne
              .map(csvCell)
              .join(';'),
        )
        .join('\r\n')

    const url = URL.createObjectURL(
      new Blob(
        [contenu],
        {
          type: 'text/csv;charset=utf-8;',
        },
      ),
    )

    const lien =
      document.createElement('a')

    lien.href = url

    lien.download =
      `recapitulatif-${
        campagne.replace(/\s+/g, '-') ||
        'OB'
      }.csv`

    lien.click()

    setTimeout(
      () =>
        URL.revokeObjectURL(url),
      1000,
    )
  }

  /* =======================================================
     RÉINITIALISATION DES FILTRES
     ======================================================= */

  function reinitialiser() {
    setDebut('')
    setFin('')
    setSecteur('TOUS')
    setTypeFiche('TOUS')
  }

  /* =======================================================
     AFFICHAGE PRINCIPAL
     ======================================================= */

  return (
    <main className="recap-page">

      {/* ===============================================
          EN-TÊTE
      =============================================== */}

      <header className="recap-header">

        <div>

          <span className="recap-eyebrow">
            DONS PERÇUS
          </span>

          <h1>
            Récapitulatif global
          </h1>

          <p>
            Vue consolidée des encaissements,
            du coffre et des remises bancaires.
          </p>

        </div>

        <span className="recap-update">

          <CalendarDays size={15} />

          Données calculées à partir des
          saisies enregistrées

        </span>

      </header>

      {/* ===============================================
          FILTRES
      =============================================== */}

      <section
        className="recap-filters"
        aria-label="Filtres du récapitulatif"
      >

        <label>

          Campagne

          <select
            value={campagne}
            onChange={(
              event: ChangeEvent<HTMLSelectElement>,
            ) => {

              setCampagneChoisie(
                event.target.value,
              )

              setSecteur('TOUS')

            }}
          >

            {campagnes.length === 0 && (
              <option value="">
                Aucune campagne
              </option>
            )}

            {campagnes.map(item => (

              <option
                key={item.id}
                value={item.id}
              >

                {item.id} — {item.nom}

              </option>

            ))}

          </select>

        </label>

        <label>

          Du

          <input
            type="date"
            value={debut}
            onChange={(
              event: ChangeEvent<HTMLInputElement>,
            ) =>
              setDebut(event.target.value)
            }
          />

        </label>

        <label>

          Au

          <input
            type="date"
            value={fin}
            onChange={(
              event: ChangeEvent<HTMLInputElement>,
            ) =>
              setFin(event.target.value)
            }
          />

        </label>

        <label>

          Secteur

          <select
            value={secteur}
            onChange={(
              event: ChangeEvent<HTMLSelectElement>,
            ) =>
              setSecteur(event.target.value)
            }
          >

            <option value="TOUS">
              Tous les secteurs
            </option>

            {secteurs.map(item => (

              <option
                key={item}
                value={item}
              >
                {item}
              </option>

            ))}

          </select>

        </label>

        <label>

          Type de fiche

          <select
            value={typeFiche}
            onChange={(
              event: ChangeEvent<HTMLSelectElement>,
            ) =>
              setTypeFiche(event.target.value)
            }
          >

            <option value="TOUS">
              Tous les types
            </option>

            {types.map(item => (

              <option
                key={item.value}
                value={item.value}
              >

                {item.label}

              </option>

            ))}

          </select>

        </label>

        <button
          type="button"
          className="recap-reset"
          onClick={reinitialiser}
        >

          <RotateCcw size={16} />

          Réinitialiser

        </button>

      </section>

      {/* ===============================================
          INFORMATIONS SUR LES FILTRES
      =============================================== */}

      {periodeInvalide && (

        <div
          className="recap-warning"
          role="alert"
        >

          <AlertTriangle size={17} />

          La date de début doit précéder
          la date de fin.

        </div>

      )}

      <div className="recap-scope">

        Encaissements : {nombre(fiches.length)}
        {' fiche(s) filtrée(s). '}

        Coffre : solde actuel de toute la campagne.
        {' '}

        Banque : remises de la campagne sur la
        période, sans filtre secteur/type.

      </div>

      {/* ===============================================
          SIX INDICATEURS
      =============================================== */}

      <section
        className="recap-kpis"
        aria-label="Chiffres clés"
      >

        <article className="recap-kpi recap-kpi-main">

          <span className="recap-kpi-icon">
            <Coins size={23} />
          </span>

          <div>

            <span>
              Total encaissé
            </span>

            <strong>
              {formatEuro(totalEncaisse)}
            </strong>

            <small>
              Hors double comptage des dons
            </small>

          </div>

        </article>

        <article className="recap-kpi">

          <span className="recap-kpi-icon">
            <Banknote size={23} />
          </span>

          <div>

            <span>
              Espèces
            </span>

            <strong>
              {formatEuro(bilan.especes)}
            </strong>

            <small>

              {totalEncaisse
                ? Math.round(
                    bilan.especes /
                      totalEncaisse *
                      100,
                  )
                : 0}
              {' % des encaissements'}

            </small>

          </div>

        </article>

        <article className="recap-kpi">

          <span className="recap-kpi-icon">
            <FileText size={23} />
          </span>

          <div>

            <span>
              Chèques
            </span>

            <strong>
              {formatEuro(bilan.cheques)}
            </strong>

            <small>

              {nombre(bilan.nbCheques)}
              {' chèque(s)'}

            </small>

          </div>

        </article>

        <article className="recap-kpi">

          <span className="recap-kpi-icon">
            <CreditCard size={23} />
          </span>

          <div>

            <span>
              TPE
            </span>

            <strong>
              {formatEuro(bilan.tpe)}
            </strong>

            <small>
              Montants des fiches
            </small>

          </div>

        </article>

        <article className="recap-kpi">

          <span className="recap-kpi-icon">
            <Landmark size={23} />
          </span>

          <div>

            <span>
              Virements
            </span>

            <strong>
              {formatEuro(bilan.virements)}
            </strong>

            <small>
              Montants déclarés
            </small>

          </div>

        </article>

        <article className="recap-kpi">

          <span className="recap-kpi-icon">
            <Heart size={23} />
          </span>

          <div>

            <span>
              Dons déclarés
            </span>

            <strong>
              {formatEuro(bilan.dons)}
            </strong>

            <small>
              Indicateur complémentaire
            </small>

          </div>

        </article>

      </section>

      {/* ===============================================
          TROIS CARTES PRINCIPALES
      =============================================== */}

      <section className="recap-three-cols">

        {/* FICHES DE CAISSE */}

        <article className="recap-card">

          <h2>

            <span className="recap-title-icon">
              <ClipboardList size={20} />
            </span>

            Fiches de caisse

          </h2>

          <div className="recap-feature">

            <strong>
              {nombre(fiches.length)}
            </strong>

            <span>
              fiches enregistrées
            </span>

          </div>

          <div className="recap-detail-row">
            <span>Espèces</span>
            <strong>{formatEuro(bilan.especes)}</strong>
          </div>

          <div className="recap-detail-row">
            <span>Chèques</span>
            <strong>{formatEuro(bilan.cheques)}</strong>
          </div>

          <div className="recap-detail-row">
            <span>TPE</span>
            <strong>{formatEuro(bilan.tpe)}</strong>
          </div>

          <div className="recap-detail-row">
            <span>Virements</span>
            <strong>{formatEuro(bilan.virements)}</strong>
          </div>

          <Link
            className="recap-card-link"
            to="/encaissements/fiches-caisse"
          >

            Voir les fiches

            <ArrowRight size={15} />

          </Link>

        </article>

        {/* COFFRE */}

        <article className="recap-card">

          <h2>

            <span className="recap-title-icon">
              <Wallet size={20} />
            </span>

            Situation du coffre

          </h2>

          {coffre.resultat ? (

            <>

              <div className="recap-detail-row">

                <span>
                  Espèces disponibles
                </span>

                <strong>
                  {formatEuro(
                    coffre.resultat.totalEspeces,
                  )}
                </strong>

              </div>

              <div className="recap-detail-row">

                <span>
                  Chèques disponibles
                </span>

                <strong>
                  {formatEuro(
                    coffre.resultat.montantCheques,
                  )}
                </strong>

              </div>

              <div className="recap-detail-row">

                <span>
                  Poids des pièces
                </span>

                <strong>

                  {(
                    coffre.resultat.poidsPiecesGrammes /
                    1000
                  ).toLocaleString(
                    'fr-FR',
                    {
                      maximumFractionDigits: 2,
                    },
                  )}

                  {' kg'}

                </strong>

              </div>

              <div className="recap-highlight">

                <span>
                  Total restant au coffre
                </span>

                <strong>

                  {formatEuro(
                    coffre.resultat.totalGeneral,
                  )}

                </strong>

              </div>

            </>

          ) : (

            <p className="recap-error">

              {coffre.erreur ||
                'Aucune campagne sélectionnée.'}

            </p>

          )}

          <small className="recap-muted">

            Solde actuel de la campagne entière,
            après remises actives.

          </small>

        </article>

        {/* SUIVI BANQUE */}

        <article className="recap-card">

          <h2>

            <span className="recap-title-icon">
              <Landmark size={20} />
            </span>

            Suivi banque

          </h2>

          <div className="recap-detail-row">

            <span>
              Nombre de remises
            </span>

            <strong>
              {nombre(remisesActives.length)}
            </strong>

          </div>

          <div className="recap-detail-row">

            <span>
              Total remis sur la période
            </span>

            <strong>
              {formatEuro(totalRemis)}
            </strong>

          </div>

          <div className="recap-detail-row">

            <span>
              Dernière remise
            </span>

            <strong>

              {remisesActives[0]
                ? dateFr(
                    remisesActives[0].date,
                  )
                : '—'}

            </strong>

          </div>

          <div className="recap-detail-row">

            <span>
              Remises annulées
            </span>

            <strong>
              {nombre(remisesAnnulees)}
            </strong>

          </div>

          <Link
            className="recap-card-link"
            to="/encaissements/suivi-banque"
          >

            Voir toutes les remises

            <ArrowRight size={15} />

          </Link>

        </article>

      </section>

      {/* ===============================================
          ANALYSES ET GRAPHIQUES
      =============================================== */}

      <section className="recap-analytics">

        {/* GRAPHIQUE CIRCULAIRE */}

        <article className="recap-card">

          <h2>

            <span className="recap-title-icon">
              <Coins size={20} />
            </span>

            Répartition des encaissements

          </h2>

          <div className="recap-donut-layout">

            <div
              className="recap-donut"
              style={{
                background: cercle,
              }}
              role="img"
              aria-label="Répartition par moyen de paiement"
            >

              <div className="recap-donut-center">

                <strong>
                  {formatEuro(totalEncaisse)}
                </strong>

                <span>
                  Total encaissé
                </span>

              </div>

            </div>

            <div className="recap-legend">

              {repartition.map(item => (

                <div
                  className="recap-legend-row"
                  key={item.key}
                >

                  <i
                    style={{
                      backgroundColor:
                        item.couleur,
                    }}
                  />

                  <span>
                    {item.label}
                  </span>

                  <strong>
                    {formatEuro(item.montant)}
                  </strong>

                  <small>

                    {Math.round(
                      item.pourcentage,
                    )}

                    {' %'}

                  </small>

                </div>

              ))}

            </div>

          </div>

          <p className="recap-footnote">

            Les dons déclarés ne sont pas
            ajoutés une deuxième fois
            aux règlements.

          </p>

        </article>

        {/* ÉVOLUTION */}

        <article className="recap-card">

          <h2>

            <span className="recap-title-icon">
              <CalendarDays size={20} />
            </span>

            Évolution des encaissements

          </h2>

          <p className="recap-muted">

            14 dernières dates avec des fiches
            parmi la sélection.

          </p>

          <div className="recap-chart-key">

            <span>

              <i className="recap-dot-orange" />

              Espèces

            </span>

            <span>

              <i className="recap-dot-blue" />

              Autres règlements

            </span>

          </div>

          {evolution.length ? (

            <div
              className="recap-chart"
              role="img"
              aria-label="Histogramme des encaissements par date"
            >

              {evolution.map(jour => (

                <div
                  className="recap-chart-column"
                  key={jour.date}
                  title={
                    `${dateFr(jour.date)} : ` +
                    formatEuro(
                      jour.especes +
                      jour.autres,
                    )
                  }
                >

                  <div className="recap-chart-bar">

                    <div
                      className="recap-chart-stack"
                      style={{
                        height: `${
                          (
                            jour.especes +
                            jour.autres
                          ) / maxJour * 100
                        }%`,
                      }}
                    >

                      <div
                        className="recap-chart-blue"
                        style={{
                          flex: jour.autres,
                        }}
                      />

                      <div
                        className="recap-chart-orange"
                        style={{
                          flex: jour.especes,
                        }}
                      />

                    </div>

                  </div>

                  <span>

                    {jour.date.slice(8, 10)}

                    /

                    {jour.date.slice(5, 7)}

                  </span>

                </div>

              ))}

            </div>

          ) : (

            <p className="recap-empty">

              Aucune donnée à afficher pour
              cette sélection.

            </p>

          )}

        </article>

        {/* POINTS DE VIGILANCE */}

        <article className="recap-card">

          <h2>

            <span className="recap-title-icon">
              <AlertTriangle size={20} />
            </span>

            Points de vigilance

          </h2>

          {alertes.length ? (

            <div className="recap-alerts">

              {alertes.map(
                (texte, index) => (

                  <div
                    className="recap-alert"
                    key={index}
                  >

                    <AlertTriangle size={17} />

                    <span>
                      {texte}
                    </span>

                  </div>

                ),
              )}

            </div>

          ) : (

            <div className="recap-ok">

              <CheckCircle2 size={22} />

              <span>

                Aucun point de vigilance détecté
                par les contrôles disponibles.

              </span>

            </div>

          )}

          <p className="recap-footnote">

            Le rapprochement avec le relevé
            bancaire n'est pas encore disponible.

          </p>

        </article>

      </section>

      {/* ===============================================
          TABLEAU PAR SECTEUR ET ACTIONS RAPIDES
      =============================================== */}

      <section className="recap-bottom">

        {/* RÉPARTITION PAR SECTEUR */}

        <article className="recap-card">

          <h2>

            <span className="recap-title-icon">
              <Scale size={20} />
            </span>

            Répartition par secteur

          </h2>

          <div className="recap-table-scroll">

            <table className="recap-table">

              <thead>

                <tr>

                  <th>Secteur</th>
                  <th>Fiches</th>
                  <th>Encaissements</th>
                  <th>Part</th>

                </tr>

              </thead>

              <tbody>

                {secteursBilan.map(ligne => (

                  <tr key={ligne.secteur}>

                    <td>
                      {ligne.secteur}
                    </td>

                    <td>
                      {nombre(ligne.fiches)}
                    </td>

                    <td>
                      {formatEuro(ligne.montant)}
                    </td>

                    <td>

                      {totalEncaisse
                        ? Math.round(
                            ligne.montant /
                              totalEncaisse *
                              100,
                          )
                        : 0}

                      {' %'}

                    </td>

                  </tr>

                ))}

                {!secteursBilan.length && (

                  <tr>

                    <td colSpan={4}>

                      Aucune fiche sur
                      cette sélection.

                    </td>

                  </tr>

                )}

              </tbody>

              <tfoot>

                <tr>

                  <th>
                    Total
                  </th>

                  <th>
                    {nombre(fiches.length)}
                  </th>

                  <th>
                    {formatEuro(totalEncaisse)}
                  </th>

                  <th>

                    {totalEncaisse
                      ? '100 %'
                      : '—'}

                  </th>

                </tr>

              </tfoot>

            </table>

          </div>

          <p className="recap-footnote">

            Impossible d'attribuer les remises
            bancaires à un secteur sans
            une liaison dédiée.

          </p>

        </article>

        {/* ACTIONS RAPIDES */}

        <article className="recap-card recap-actions">

          <h2>

            <span className="recap-title-icon">
              <Download size={20} />
            </span>

            Actions rapides

          </h2>

          <div className="recap-action-grid">

            <button
              type="button"
              onClick={exporterCsv}
            >

              <FileSpreadsheet size={21} />

              <span>

                <strong>
                  Export Excel (CSV)
                </strong>

                <small>
                  Toutes les fiches filtrées
                </small>

              </span>

            </button>

            <button
              type="button"
              onClick={() =>
                window.print()
              }
            >

              <FileText size={21} />

              <span>

                <strong>
                  Imprimer / PDF
                </strong>

                <small>

                  Enregistrer en PDF depuis
                  le navigateur

                </small>

              </span>

            </button>

            <Link to="/encaissements/fiches-caisse">

              <ClipboardList size={21} />

              <span>

                <strong>
                  Voir les fiches
                </strong>

                <small>
                  Accéder à la liste
                </small>

              </span>

            </Link>

            <Link to="/encaissements/coffre">

              <Wallet size={21} />

              <span>

                <strong>
                  Voir le coffre
                </strong>

                <small>
                  Détail des espèces et chèques
                </small>

              </span>

            </Link>

          </div>

        </article>

      </section>

    </main>
  )
}