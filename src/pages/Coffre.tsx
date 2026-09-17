import {
  useMemo,
  useState,
} from 'react'

import {
  Link,
} from 'react-router-dom'

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Coins,
  FileText,
  Landmark,
  Scale,
  Wallet,
} from 'lucide-react'

import {
  useObData,
} from '../contexts/ObDataContext'

import {
  calculerCoffre,
  formatEuro,
  formatKg,
  type LigneCoffre,
} from '../services/coffre'

import './Coffre.css'

/* =========================================================
   TABLEAU RÉUTILISABLE

   Affiche les pièces ou les billets.
   ========================================================= */

type TableauCoffreProps = {
  titre: string
  lignes: LigneCoffre[]
  avecPoids?: boolean
}

function TableauCoffre({
  titre,
  lignes,
  avecPoids = false,
}: TableauCoffreProps) {

  const totalQuantite =
    lignes.reduce(
      (total, ligne) =>
        total + ligne.quantite,
      0,
    )

  const totalMontant =
    lignes.reduce(
      (total, ligne) =>
        total + ligne.montantCentimes,
      0,
    )

  const totalPoids =
    lignes.reduce(
      (total, ligne) =>
        total +
        (ligne.poidsGrammes ?? 0),
      0,
    )

  return (
    <section className="coffre-card">

      <h2>
        {avecPoids ? (
          <Coins size={21} />
        ) : (
          <Banknote size={21} />
        )}

        {titre}
      </h2>

      <div className="coffre-table-scroll">

        <table className="coffre-table">

          <thead>

            <tr>

              <th>Valeur</th>

              <th>Quantité</th>

              <th>Montant</th>

              {avecPoids && (
                <>
                  <th>Poids / pièce</th>
                  <th>Poids total</th>
                </>
              )}

            </tr>

          </thead>

          <tbody>

            {lignes.map(
              ligne => (

                <tr key={ligne.key}>

                  <td>
                    <strong>
                      {ligne.label}
                    </strong>
                  </td>

                  <td>
                    {ligne.quantite}
                  </td>

                  <td>
                    {formatEuro(
                      ligne.montantCentimes,
                    )}
                  </td>

                  {avecPoids && (
                    <>

                      <td>
                        {(
                          ligne.poidsUnitaireGrammes ??
                          0
                        ).toLocaleString(
                          'fr-FR',
                        )}
                        {' g'}
                      </td>

                      <td>
                        {formatKg(
                          ligne.poidsGrammes ?? 0,
                        )}
                      </td>

                    </>
                  )}

                </tr>

              ),
            )}

          </tbody>

          <tfoot>

            <tr>

              <td>
                Total
              </td>

              <td>
                {totalQuantite}
              </td>

              <td>
                {formatEuro(
                  totalMontant,
                )}
              </td>

              {avecPoids && (
                <>

                  <td>—</td>

                  <td>
                    {formatKg(
                      totalPoids,
                    )}
                  </td>

                </>
              )}

            </tr>

          </tfoot>

        </table>

      </div>

    </section>
  )
}

/* =========================================================
   PAGE PRINCIPALE : COFFRE
   ========================================================= */

function Coffre() {

  /* =======================================================
     DONNÉES PARTAGÉES

     Ces données viennent du contexte :
     - fiches de caisse ;
     - dépôts bancaires ;
     - campagnes.

     Aucune donnée fictive n'est ajoutée.
     ======================================================= */

  const {
    fichesCaisse,
    depotsBanque,
    campagnes,
    activeCampagne,
  } = useObData()

  /* =======================================================
     SÉLECTION DE LA CAMPAGNE
     ======================================================= */

  const [
    campagneSelection,
    setCampagneSelection,
  ] = useState('')

  const campagne =
    campagneSelection ||
    activeCampagne?.id ||
    campagnes[0]?.id ||
    ''

  /* =======================================================
     CALCUL AUTOMATIQUE

     Le coffre est recalculé lorsque :
     - la campagne change ;
     - une fiche est contrôlée ;
     - un dépôt est enregistré ou annulé.

     Une erreur bloque l'affichage du solde.
     ======================================================= */

  const calcul = useMemo(() => {

    if (!campagne) {
      return {
        resultat: null,
        erreur:
          'Aucune campagne disponible.',
      }
    }

    try {

      const resultat =
        calculerCoffre(
          campagne,
          fichesCaisse,
          depotsBanque,
        )

      return {
        resultat,
        erreur: '',
      }

    } catch (error) {

      return {
        resultat: null,

        erreur:
          error instanceof Error
            ? error.message
            : 'Erreur de calcul du coffre.',
      }

    }

  }, [
    campagne,
    fichesCaisse,
    depotsBanque,
  ])

  const coffre = calcul.resultat

  /* =======================================================
     AFFICHAGE
     ======================================================= */

  return (
    <div className="coffre-page">

      {/* ===================================================
          EN-TÊTE
          =================================================== */}

      <header className="coffre-heading">

        <div className="coffre-title-icon">

          <Wallet size={29} />

        </div>

        <div>

          <span className="coffre-eyebrow">
            DONS PERÇUS
          </span>

          <h1>
            Coffre
          </h1>

          <p>
            Situation théorique du coffre
            à partir des fiches de caisse
            et des dépôts bancaires.
          </p>

        </div>

      </header>

      {/* ===================================================
          BARRE D'ACTIONS
          =================================================== */}

      <section className="coffre-toolbar">

        <label>

          Campagne

          <select
            value={campagne}
            onChange={
              event =>
                setCampagneSelection(
                  event.target.value,
                )
            }
            disabled={
              campagnes.length === 0
            }
          >

            {campagnes.map(
              item => (

                <option
                  key={item.id}
                  value={item.id}
                >

                  {item.nom}

                </option>

              ),
            )}

          </select>

        </label>

        <div className="coffre-actions">

          <Link
            to="/encaissements/fiches-caisse"
          >

            <FileText size={17} />

            Fiches de caisse

          </Link>

          <Link
            to="/encaissements/suivi-banque"
          >

            <Landmark size={17} />

            Suivi banque

            <ArrowRight size={15} />

          </Link>

        </div>

      </section>

      {/* ===================================================
          AVERTISSEMENT INVENTAIRE INITIAL

          Le contexte actuel ne contient pas
          encore d'inventaire de départ.
          =================================================== */}

      <div className="coffre-alert">

        <AlertTriangle size={19} />

        <span>

          <strong>
            Solde théorique :
          </strong>

          {' '}

          le calcul suppose que le coffre
          était vide au démarrage de la campagne.

          Un inventaire initial devra être
          ajouté si des fonds étaient déjà présents.

        </span>

      </div>

      {/* ===================================================
          ERREUR DE CALCUL
          =================================================== */}

      {calcul.erreur && (

        <div
          className="coffre-error"
          role="alert"
        >

          <AlertTriangle size={20} />

          <div>

            <strong>
              Impossible de calculer le coffre
            </strong>

            <p>
              {calcul.erreur}
            </p>

          </div>

        </div>

      )}

      {/* ===================================================
          RÉSULTAT

          Aucun chiffre n'est présenté si
          le calcul a échoué.
          =================================================== */}

      {coffre && (

        <>

          {/* ===============================================
              FICHES EN ATTENTE
              =============================================== */}

          {coffre.nbFichesAControler > 0 && (

            <div className="coffre-alert">

              <FileText size={19} />

              <span>

                <strong>
                  {coffre.nbFichesAControler}
                  {' fiche(s) à contrôler.'}
                </strong>

                {' '}

                Leur contenu n'est pas encore
                pris en compte dans le coffre.

              </span>

            </div>

          )}

          {/* ===============================================
              INDICATEURS PRINCIPAUX
              =============================================== */}

          <section className="coffre-kpis">

            {/* TOTAL GÉNÉRAL */}

            <article className="coffre-kpi principal">

              <Wallet size={25} />

              <span>
                Total dans le coffre
              </span>

              <strong>
                {formatEuro(
                  coffre.totalGeneral,
                )}
              </strong>

              <small>
                Espèces + chèques
              </small>

            </article>

            {/* PIÈCES */}

            <article className="coffre-kpi">

              <Coins size={25} />

              <span>
                Pièces
              </span>

              <strong>
                {formatEuro(
                  coffre.montantPieces,
                )}
              </strong>

              <small>

                {coffre.totalPieces}
                {' pièces'}

                {' · '}

                {formatKg(
                  coffre.poidsPiecesGrammes,
                )}

              </small>

            </article>

            {/* BILLETS */}

            <article className="coffre-kpi">

              <Banknote size={25} />

              <span>
                Billets
              </span>

              <strong>
                {formatEuro(
                  coffre.montantBillets,
                )}
              </strong>

              <small>

                {coffre.totalBillets}
                {' billets'}

              </small>

            </article>

            {/* CHÈQUES */}

            <article className="coffre-kpi">

              <FileText size={25} />

              <span>
                Chèques
              </span>

              <strong>
                {formatEuro(
                  coffre.montantCheques,
                )}
              </strong>

              <small>

                {coffre.totalCheques}
                {' chèque(s) non déposé(s)'}

              </small>

            </article>

          </section>

          {/* ===============================================
              TOTAL DES ESPÈCES
              =============================================== */}

          <section className="coffre-card">

            <h2>

              <Banknote size={21} />

              Situation des espèces

            </h2>

            <div className="coffre-cheques">

              <div>

                <span>
                  Pièces + billets
                </span>

                <strong>

                  {formatEuro(
                    coffre.totalEspeces,
                  )}

                </strong>

              </div>

              <div>

                <span>
                  Poids théorique des pièces
                </span>

                <strong>

                  {formatKg(
                    coffre.poidsPiecesGrammes,
                  )}

                </strong>

              </div>

            </div>

          </section>

          {/* ===============================================
              TABLEAUX DÉTAILLÉS
              =============================================== */}

          <div className="coffre-grid">

            <TableauCoffre
              titre="Détail des pièces"
              lignes={coffre.pieces}
              avecPoids
            />

            <TableauCoffre
              titre="Détail des billets"
              lignes={coffre.billets}
            />

          </div>

          {/* ===============================================
              CHÈQUES
              =============================================== */}

          <section className="coffre-card">

            <h2>

              <FileText size={21} />

              Chèques présents dans le coffre

            </h2>

            <div className="coffre-cheques">

              <div>

                <span>
                  Nombre de chèques
                </span>

                <strong>

                  {coffre.totalCheques}

                </strong>

              </div>

              <div>

                <span>
                  Montant des chèques
                </span>

                <strong>

                  {formatEuro(
                    coffre.montantCheques,
                  )}

                </strong>

              </div>

            </div>

            <p className="coffre-note">

              Les chèques déposés en banque
              sont soustraits du nombre et
              du montant affichés.

              Le détail individuel des chèques
              sera disponible lorsqu'ils
              disposeront chacun d'un identifiant.

            </p>

          </section>

          {/* ===============================================
              ORIGINE DES DONNÉES
              =============================================== */}

          <section className="coffre-card coffre-bottom">

            <h2>

              <Scale size={21} />

              Origine du solde

            </h2>

            <div className="coffre-source">

              <CheckCircle2 size={18} />

              <span>

                <strong>

                  {coffre.nbFichesControlees}

                </strong>

                {' fiches de caisse contrôlées'}

              </span>

            </div>

            <div className="coffre-source">

              <Landmark size={18} />

              <span>

                <strong>

                  {coffre.nbDepots}

                </strong>

                {' dépôts bancaires enregistrés et déduits'}

              </span>

            </div>

            <div className="coffre-source">

              <Coins size={18} />

              <span>

                <strong>

                  {coffre.totalPieces}

                </strong>

                {' pièces en stock'}

              </span>

            </div>

            <div className="coffre-source">

              <Banknote size={18} />

              <span>

                <strong>

                  {coffre.totalBillets}

                </strong>

                {' billets en stock'}

              </span>

            </div>

            <p className="coffre-note">

              Le coffre ne comptabilise
              pas les paiements TPE,
              les virements ou les indicateurs
              de dons comme de l'argent
              physiquement présent.

              Le solde change dès que
              les données partagées sont
              mises à jour dans l'application.

            </p>

          </section>

        </>

      )}

    </div>
  )
}

export default Coffre