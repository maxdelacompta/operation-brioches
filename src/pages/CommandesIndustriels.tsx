import CompactStatCard from '../components/ui/CompactStatCard'
import { useMemo, useState } from 'react'
import {
  CalendarDays,
  Euro,
  Package,
  Search,
  Store,
} from 'lucide-react'

import { useArtisans } from '../contexts/ArtisansContext'
import type {
  CommandeArtisan,
  Fournisseur,
  StatutCommandeArtisan,
} from '../types/artisans'
import {
  argent,
  categoriesFournisseur,
  dateLisible,
  montantCommande,
} from '../types/artisans'

import './CommandesIndustriels.css'

type StatutFiltre = 'TOUS' | StatutCommandeArtisan

const STATUT_LABELS: Record<StatutCommandeArtisan, string> = {
  A_VERIFIER: 'À vérifier',
  BROUILLON: 'Brouillon',
  CONFIRMEE: 'Confirmée',
  RETRAIT_PREVU: 'Retrait prévu',
  TERMINEE: 'Terminée',
  ANNULEE: 'Annulée',
}

function nomIndustriel(
  fournisseurId: string,
  fournisseurs: Array<{ id: string; nom: string }>,
) {
  return (
    fournisseurs.find((item) => item.id === fournisseurId)?.nom ||
    fournisseurId ||
    '—'
  )
}

function estIndustriel(fournisseur: Fournisseur) {
  return categoriesFournisseur(fournisseur).includes('INDUSTRIEL')
}

export default function CommandesIndustriels() {
  const { commandesArtisans, fournisseurs } = useArtisans()

  const [recherche, setRecherche] = useState('')
  const [campagne, setCampagne] = useState('TOUTES')
  const [statut, setStatut] = useState<StatutFiltre>('TOUS')

  const fournisseursIndustriels = useMemo(
    () => fournisseurs.filter(estIndustriel),
    [fournisseurs],
  )

  const idsIndustriels = useMemo(
    () => new Set(fournisseursIndustriels.map((item) => item.id)),
    [fournisseursIndustriels],
  )

  const commandesIndustriels = useMemo(
    () =>
      commandesArtisans.filter((commande) =>
        idsIndustriels.has(commande.artisanId),
      ),
    [commandesArtisans, idsIndustriels],
  )

  const campagnes = useMemo(
    () =>
      [...new Set(commandesIndustriels.map((item) => item.campagne))]
        .filter(Boolean)
        .sort((a, b) =>
          b.localeCompare(a, 'fr', { numeric: true }),
        ),
    [commandesIndustriels],
  )

  const resultats = useMemo(() => {
    const motif = recherche.trim().toLocaleLowerCase('fr')

    return commandesIndustriels.filter((commande) => {
      const industriel = nomIndustriel(
        commande.artisanId,
        fournisseursIndustriels,
      )

      const correspondRecherche =
        !motif ||
        [
          commande.numero,
          industriel,
          commande.secteur,
          commande.responsableSecteur,
          commande.personneRetrait,
          commande.campagne,
        ]
          .join(' ')
          .toLocaleLowerCase('fr')
          .includes(motif)

      const correspondCampagne =
        campagne === 'TOUTES' ||
        commande.campagne === campagne

      const correspondStatut =
        statut === 'TOUS' ||
        commande.statut === statut

      return (
        correspondRecherche &&
        correspondCampagne &&
        correspondStatut
      )
    })
  }, [
    commandesIndustriels,
    fournisseursIndustriels,
    recherche,
    campagne,
    statut,
  ])

  const totalQuantite = useMemo(
    () =>
      resultats.reduce(
        (total, commande) =>
          total + commande.quantiteCommandee,
        0,
      ),
    [resultats],
  )

  const totalMontant = useMemo(
    () =>
      resultats.reduce(
        (total, commande) =>
          total + montantCommande(commande),
        0,
      ),
    [resultats],
  )

  return (
    <main className="ind-page">
      <header className="ind-header">
        <div>
          <span className="ind-eyebrow">
            COMMANDES ACHATS
          </span>

          <h1>Industriels</h1>

          <p>
            Suivi des commandes de brioches auprès des
            fournisseurs industriels.
          </p>
        </div>
      </header>

      <section className="ind-stats">
        <CompactStatCard className="ind-stat"
          icon={<Package size={21} />}
          label="Commandes"
          value={String(resultats.length)}
        />

        <CompactStatCard className="ind-stat"
          icon={<Store size={21} />}
          label="Brioches commandées"
          value={new Intl.NumberFormat('fr-FR').format(
            totalQuantite,
          )}
        />

        <CompactStatCard className="ind-stat"
          icon={<Euro size={21} />}
          label="Montant estimé"
          value={argent(totalMontant)}
        />
      </section>

      <section className="ind-card">
        <div className="ind-toolbar">
          <label className="ind-search">
            <Search size={18} />

            <input
              type="search"
              placeholder="Rechercher une commande, un industriel, un secteur…"
              value={recherche}
              onChange={(event) =>
                setRecherche(event.target.value)
              }
            />
          </label>

          <select
            value={campagne}
            onChange={(event) =>
              setCampagne(event.target.value)
            }
            aria-label="Filtrer par campagne"
          >
            <option value="TOUTES">
              Toutes les campagnes
            </option>

            {campagnes.map((value) => (
              <option
                key={value}
                value={value}
              >
                {value}
              </option>
            ))}
          </select>

          <select
            value={statut}
            onChange={(event) =>
              setStatut(
                event.target.value as StatutFiltre,
              )
            }
            aria-label="Filtrer par statut"
          >
            <option value="TOUS">
              Tous les statuts
            </option>

            {(
              Object.keys(
                STATUT_LABELS,
              ) as StatutCommandeArtisan[]
            ).map((value) => (
              <option
                key={value}
                value={value}
              >
                {STATUT_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="ind-results">
          <strong>
            {resultats.length} commande
            {resultats.length > 1 ? 's' : ''}
          </strong>

          <span>
            {fournisseursIndustriels.length} fournisseur
            {fournisseursIndustriels.length > 1 ? 's industriels' : ' industriel'}
            dans la base fournisseurs
          </span>
        </div>

        <div className="ind-table-wrap">
          <table className="ind-table">
            <thead>
              <tr>
                <th>N° commande</th>
                <th>Industriel</th>
                <th>Campagne</th>
                <th>Date commande</th>
                <th>Date retrait</th>
                <th>Secteur</th>
                <th>Quantité</th>
                <th>Prix unitaire</th>
                <th>Montant</th>
                <th>Statut</th>
              </tr>
            </thead>

            <tbody>
              {resultats.map(
                (commande: CommandeArtisan) => (
                  <tr key={commande.id}>
                    <td className="ind-code">
                      {commande.numero || '—'}
                    </td>

                    <td>
                      {nomIndustriel(
                        commande.artisanId,
                        fournisseursIndustriels,
                      )}
                    </td>

                    <td>
                      {commande.campagne || '—'}
                    </td>

                    <td>
                      <span className="ind-date">
                        <CalendarDays size={14} />
                        {dateLisible(
                          commande.dateCommande,
                        )}
                      </span>
                    </td>

                    <td>
                      {dateLisible(
                        commande.dateRetrait,
                      )}
                    </td>

                    <td>
                      {commande.secteur || '—'}
                    </td>

                    <td>
                      {new Intl.NumberFormat(
                        'fr-FR',
                      ).format(
                        commande.quantiteCommandee,
                      )}
                    </td>

                    <td>
                      {argent(
                        commande.prixUnitaire,
                      )}
                    </td>

                    <td>
                      {argent(
                        montantCommande(
                          commande,
                        ),
                      )}
                    </td>

                    <td>
                      <span
                        className={`ind-status ind-status--${commande.statut.toLowerCase()}`}
                      >
                        {
                          STATUT_LABELS[
                            commande.statut
                          ]
                        }
                      </span>
                    </td>
                  </tr>
                ),
              )}

              {!resultats.length && (
                <tr>
                  <td
                    className="ind-empty"
                    colSpan={10}
                  >
                    Aucune commande industrielle ne correspond aux
                    filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

