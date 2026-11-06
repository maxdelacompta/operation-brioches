import { useCallback, useEffect, useMemo, useState, type ReactNode, type Dispatch, type SetStateAction } from 'react'
import { useUsers } from './UsersContext'
import { useLocation } from 'react-router-dom'
import { assertCampaignWritable, isCampaignReadOnly } from '../lib/campaignAccess'
import { type Campagne, type CampagneDetails, type Commande, type Donateur, type DepotBanque, type FicheCaisse, type NouvelleCampagne } from '../types/ob'
import { initialDonateurs } from '../data/initialDonateurs'
import { initialCommandes } from '../data/initialCommandes'
import { initialFichesCaisse } from '../data/initialFichesCaisse'
import { BILLETS, PIECES, calculerCoffre } from '../services/coffre'
import { persistAuditedCollection } from '../services/auditPersistence'
import { DONATEURS_KEY, COMMANDES_KEY, FICHES_KEY, CAMPAGNES_KEY, DEPOTS_KEY, loadArray, loadCampagnes, getLocalDate, createDepotId, type NouveauDepotBanque, type ObDataContextValue, ObDataContext } from "./ObDataContext"

export function ObDataProvider({
  children,
}: {
  children: ReactNode
}) {

  const { currentUser } = useUsers()
  const location = useLocation()

  /* =======================================================
     1. DONATEURS
     ======================================================= */

  const [
    donateurs,
    setDonateursState,
  ] = useState<Donateur[]>(
    () =>
      loadArray(
        DONATEURS_KEY,
        initialDonateurs,
      ),
  )

  /* =======================================================
     2. COMMANDES
     ======================================================= */

  const [
    commandes,
    setCommandesState,
  ] = useState<Commande[]>(
    () =>
      loadArray(
        COMMANDES_KEY,
        initialCommandes,
      ),
  )

  /* =======================================================
     3. FICHES DE CAISSE
     ======================================================= */

  const [
    fichesCaisse,
    setFichesCaisseState,
  ] = useState<FicheCaisse[]>(
    () =>
      loadArray(
        FICHES_KEY,
        initialFichesCaisse,
      ),
  )

  /* =======================================================
     4. CAMPAGNES
     ======================================================= */

  const [
    campagnes,
    setCampagnes,
  ] = useState<Campagne[]>(
    () =>
      loadCampagnes(
        commandes,
        fichesCaisse,
      ),
  )

  /* Sélection de travail conservée dans ce navigateur. */
  const [selectedCampagneId, setSelectedCampagneIdState] = useState<string>(() => {
    try { return localStorage.getItem('ob-campagne-selection-v1') || '' } catch { return '' }
  })

  function setSelectedCampagneId(id: string) {
    setSelectedCampagneIdState(id)
    try {
      if (id) localStorage.setItem('ob-campagne-selection-v1', id)
      else localStorage.removeItem('ob-campagne-selection-v1')
    } catch { /* Stockage indisponible : état conservé jusqu'au rechargement. */ }
  }

  /* =======================================================
     5. DÉPÔTS BANCAIRES

     NOUVEAU

     Aucun dépôt fictif n'est créé.
     ======================================================= */

  const [
    depotsBanque,
    setDepotsBanque,
  ] = useState<DepotBanque[]>(
    () =>
      loadArray(
        DEPOTS_KEY,
        [],
      ),
  )

  /* =======================================================
     CAMPAGNE ACTIVE
     ======================================================= */

  const activeCampagne = useMemo(
    () =>
      campagnes.find(
        campagne =>
          campagne.statut === 'ACTIVE',
      ) ?? null,

    [campagnes],
  )

  const selectedCampagne = useMemo(
    () => campagnes.find(c => c.id === selectedCampagneId) ?? activeCampagne,
    [campagnes, selectedCampagneId, activeCampagne],
  )

  // Cette deuxième protection couvre les écritures passant par ObData,
  // même si une action est déclenchée autrement que par un bouton.
  const canWriteOperations = !isCampaignReadOnly(
    selectedCampagne,
    currentUser?.role,
    location.pathname,
  )
  const setDonateurs = useCallback<Dispatch<SetStateAction<Donateur[]>>>(next => {
    if (!canWriteOperations) return
    setDonateursState(next)
  }, [canWriteOperations])
  const setCommandes = useCallback<Dispatch<SetStateAction<Commande[]>>>(next => {
    if (!canWriteOperations) return
    setCommandesState(next)
  }, [canWriteOperations])
  const setFichesCaisse = useCallback<Dispatch<SetStateAction<FicheCaisse[]>>>(next => {
    if (!canWriteOperations) return
    setFichesCaisseState(next)
  }, [canWriteOperations])

  /* =======================================================
     SAUVEGARDE DES DONATEURS
     ======================================================= */

  useEffect(() => {
    persistAuditedCollection(DONATEURS_KEY, donateurs, 'donateurs', 'Donateur', false)
  }, [donateurs])

  /* =======================================================
     SAUVEGARDE DES COMMANDES
     ======================================================= */

  useEffect(() => {
    persistAuditedCollection(COMMANDES_KEY, commandes, 'commandes', 'Commande')
  }, [commandes])

  /* =======================================================
     SAUVEGARDE DES FICHES DE CAISSE
     ======================================================= */

  useEffect(() => {
    persistAuditedCollection(FICHES_KEY, fichesCaisse, 'encaissements', 'Fiche de caisse')
  }, [fichesCaisse])

  /* =======================================================
     SAUVEGARDE DES CAMPAGNES
     ======================================================= */

  useEffect(() => {
    try {
      persistAuditedCollection(CAMPAGNES_KEY, campagnes, 'campagnes', 'Campagne', false)
    } catch {
      console.warn(
        'Sauvegarde locale des campagnes indisponible.',
      )
    }
  }, [campagnes])

  /* =======================================================
     6. CRÉER UN DÉPÔT BANCAIRE

     RÈGLES :

     - campagne existante ;
     - référence obligatoire et unique ;
     - dépôt non vide ;
     - validation par le moteur du coffre ;
     - sauvegarde avant modification de l'état.

     Le calcul refuse un dépôt qui rendrait
     le stock négatif.
     ======================================================= */

  function creerDepotBanque(
    entree: NouveauDepotBanque,
  ): string {
    assertCampaignWritable(selectedCampagne, currentUser?.role, location.pathname)

    /* CAMPAGNE */

    const campagne = entree.campagne.trim()

    if (
      !campagne ||
      !campagnes.some(
        item =>
          item.id === campagne,
      )
    ) {
      throw new Error(
        'Campagne inconnue pour ce dépôt.',
      )
    }

    /* RÉFÉRENCE */

    const reference =
      entree.reference.trim()

    if (!reference) {
      throw new Error(
        'La référence du bordereau est obligatoire.',
      )
    }

    const referenceExiste =
      depotsBanque.some(
        depot =>
          depot.campagne === campagne &&
          depot.reference
            .trim()
            .toLowerCase() ===
          reference.toLowerCase(),
      )

    if (referenceExiste) {
      throw new Error(
        'Cette référence de dépôt existe déjà pour cette campagne.',
      )
    }

    /* LE DÉPÔT DOIT CONTENIR DES FONDS */

    const contientPieces =
      PIECES.some(
        piece =>
          entree[piece.key] > 0,
      )

    const contientBillets =
      BILLETS.some(
        billet =>
          entree[billet.key] > 0,
      )

    const contientCheques =
      entree.nbCheques > 0 ||
      entree.montantCheques > 0

    if (
      !contientPieces &&
      !contientBillets &&
      !contientCheques
    ) {
      throw new Error(
        'Le dépôt est vide. Indiquez les espèces ou les chèques déposés.',
      )
    }

    /* CRÉATION DU DÉPÔT */

    const id = createDepotId()

    const depot: DepotBanque = {
      ...entree,

      id,

      campagne,

      reference,

      date: getLocalDate(),

      statut: 'ENREGISTRE',
    }

    /* =====================================================
       VALIDATION AVANT ENREGISTREMENT

       On simule le dépôt dans le moteur.

       Si un montant ou une quantité devient
       négatif, calculerCoffre déclenche
       une erreur.

       Rien n'est enregistré dans ce cas.
       ===================================================== */

    const prochainsDepots = [
      ...depotsBanque,
      depot,
    ]

    calculerCoffre(
      campagne,
      fichesCaisse,
      prochainsDepots,
    )

    /* =====================================================
       SAUVEGARDE

       Si localStorage échoue, le dépôt n'est
       pas ajouté à l'état React.
       ===================================================== */

    localStorage.setItem(
      DEPOTS_KEY,
      JSON.stringify(
        prochainsDepots,
      ),
    )

    setDepotsBanque(
      prochainsDepots,
    )

    return id
  }

  /* =======================================================
     7. ANNULER UN DÉPÔT BANCAIRE

     On ne supprime pas l'enregistrement.

     Son statut passe à ANNULE, ce qui permet
     au coffre de réintégrer les sommes.
     ======================================================= */

  function annulerDepotBanque(
    id: string,
  ): void {
    assertCampaignWritable(selectedCampagne, currentUser?.role, location.pathname)
    const depot = depotsBanque.find(
      item =>
        item.id === id,
    )

    if (!depot) {
      throw new Error(
        'Dépôt bancaire introuvable.',
      )
    }

    if (depot.statut !== 'ENREGISTRE') {
      throw new Error(
        'Ce dépôt est déjà annulé.',
      )
    }

    const prochainsDepots: DepotBanque[] =
      depotsBanque.map(
        item =>
          item.id === id
            ? {
                ...item,

                statut: 'ANNULE',

                dateAnnulation:
                  new Date().toISOString(),
              }
            : item,
      )

    /* SAUVEGARDE */

    localStorage.setItem(
      DEPOTS_KEY,
      JSON.stringify(
        prochainsDepots,
      ),
    )

    setDepotsBanque(
      prochainsDepots,
    )
  }

  /* =======================================================
     8. CRÉER UNE CAMPAGNE
     ======================================================= */

  function createCampagne(
    input: NouvelleCampagne,
  ): string {
    const annee = input.annee

    const id = `OB ${annee}`

    if (
      !Number.isInteger(annee) ||
      annee < 2000 ||
      annee > 2100
    ) {
      throw new Error(
        "L'année de campagne est invalide.",
      )
    }

    if (
      campagnes.some(
        campagne =>
          campagne.id === id ||
          campagne.annee === annee,
      )
    ) {
      throw new Error(
        `La campagne ${annee} existe déjà.`,
      )
    }

    if (
      input.dateDebut &&
      input.dateFin &&
      input.dateFin < input.dateDebut
    ) {
      throw new Error(
        'La date de fin précède la date de début.',
      )
    }

    const nouvelle: Campagne = {
      ...input,

      id,

      nom:
        input.nom.trim() ||
        `Opération Brioches ${annee}`,

      statut: 'PREPARATION',
    }

    setCampagnes(
      current => [
        ...current,
        nouvelle,
      ],
    )

    return id
  }

  /* =======================================================
     9. MODIFIER UNE CAMPAGNE
     ======================================================= */

  function updateCampagne(
    id: string,
    details: CampagneDetails,
  ): void {
    const target = campagnes.find(
      campagne =>
        campagne.id === id,
    )

    if (!target) {
      throw new Error(
        'Campagne introuvable.',
      )
    }

    if (currentUser?.role !== 'administrateur') {
      throw new Error('Seul un administrateur peut modifier les paramètres de campagne.')
    }

    // Une campagne terminée est figée, sauf ses objectifs prévisionnels.
    // On compare les champs de gestion pour empêcher tout changement silencieux
    // du prix, des dates ou du statut depuis l'éditeur des objectifs.
    if (target.statut === 'TERMINEE') {
      const unchanged =
        details.nom === target.nom &&
        details.description === target.description &&
        details.dateDebut === target.dateDebut &&
        details.dateFin === target.dateFin &&
        details.prixUnitaire === target.prixUnitaire
      if (!unchanged) {
        throw new Error('Une campagne terminée autorise uniquement la correction des objectifs.')
      }
    }

    const goals = [details.objectifBrioches, details.objectifDonateurs, details.budgetPrevisionnel]
    if (goals.some(value => value !== null && (!Number.isFinite(value) || value < 0)) ||
      (details.objectifBrioches !== null && !Number.isInteger(details.objectifBrioches)) ||
      (details.objectifDonateurs !== null && !Number.isInteger(details.objectifDonateurs))) {
      throw new Error('Les objectifs doivent être positifs ; les quantités sont des nombres entiers.')
    }

    if (
      details.dateDebut &&
      details.dateFin &&
      details.dateFin < details.dateDebut
    ) {
      throw new Error(
        'La date de fin précède la date de début.',
      )
    }

    setCampagnes(
      current =>
        current.map(
          campagne =>
            campagne.id === id
              ? {
                  ...campagne,

                  ...details,

                  nom:
                    details.nom.trim(),

                  statut:
                    campagne.statut ===
                    'A_CONFIGURER'
                      ? 'PREPARATION'
                      : campagne.statut,
                }
              : campagne,
        ),
    )
  }

  /* =======================================================
     10. DUPLIQUER UNE CAMPAGNE

     Les commandes, fiches et dépôts bancaires
     ne sont jamais dupliqués.
     ======================================================= */

  function duplicateCampagne(
    id: string,
  ): string {
    const source = campagnes.find(
      campagne =>
        campagne.id === id,
    )

    if (
      !source ||
      source.annee === null
    ) {
      throw new Error(
        'Cette campagne ne peut pas être dupliquée.',
      )
    }

    let year =
      source.annee + 1

    while (
      campagnes.some(
        campagne =>
          campagne.annee === year ||
          campagne.id ===
            `OB ${year}`,
      )
    ) {
      year += 1
    }

    return createCampagne({
      annee: year,

      nom:
        `Opération Brioches ${year}`,

      description: '',

      // Dates à revalider chaque année.

      dateDebut: '',
      dateFin: '',

      prixUnitaire:
        source.prixUnitaire,

      objectifBrioches:
        source.objectifBrioches,

      objectifDonateurs:
        source.objectifDonateurs,

      budgetPrevisionnel:
        source.budgetPrevisionnel,
    })
  }

  /* =======================================================
     11. ACTIVER UNE CAMPAGNE
     ======================================================= */

  function activateCampagne(
    id: string,
  ): void {
    const target = campagnes.find(
      campagne =>
        campagne.id === id,
    )

    if (!target) {
      throw new Error(
        'Campagne introuvable.',
      )
    }

    if (target.statut === 'TERMINEE') {
      throw new Error(
        'Une campagne terminée ne peut pas être réactivée.',
      )
    }

    if (
      target.prixUnitaire === null ||
      target.prixUnitaire <= 0
    ) {
      throw new Error(
        'Renseigne un prix unitaire valide avant activation.',
      )
    }

    setCampagnes(
      current =>
        current.map(
          campagne => {
            if (campagne.id === id) {
              return {
                ...campagne,

                statut: 'ACTIVE',
              }
            }

            if (
              campagne.statut ===
              'ACTIVE'
            ) {
              return {
                ...campagne,

                statut: 'PREPARATION',
              }
            }

            return campagne
          },
        ),
    )
  }

  /* =======================================================
     12. TERMINER UNE CAMPAGNE
     ======================================================= */

  function finishCampagne(
    id: string,
  ): void {
    const target = campagnes.find(
      campagne =>
        campagne.id === id,
    )

    if (!target) {
      throw new Error(
        'Campagne introuvable.',
      )
    }

    setCampagnes(
      current =>
        current.map(
          campagne =>
            campagne.id === id
              ? {
                  ...campagne,

                  statut: 'TERMINEE',
                }
              : campagne,
        ),
    )
  }

  /* =======================================================
     13. VALEURS PARTAGÉES
     ======================================================= */

  const value: ObDataContextValue = {

    /* DONATEURS */

    donateurs,
    setDonateurs,

    /* COMMANDES */

    commandes,
    setCommandes,

    /* FICHES DE CAISSE */

    fichesCaisse,
    setFichesCaisse,

    /* CAMPAGNES */

    campagnes,
    activeCampagne,
    selectedCampagne,
    selectedCampagneId,
    setSelectedCampagneId,

    /* DÉPÔTS BANCAIRES */

    depotsBanque,

    creerDepotBanque,

    annulerDepotBanque,

    /* RECHERCHES */

    getDonateurById: id =>
      donateurs.find(
        donateur =>
          donateur.id === id,
      ),

    getCommandesByDonateurId:
      donateurId =>
        commandes.filter(
          commande =>
            commande.donateurId ===
            donateurId,
        ),

    getFicheCaisseById: id =>
      fichesCaisse.find(
        fiche =>
          fiche.id === id,
      ),

    getCommandesByCampagne: id =>
      commandes.filter(
        commande =>
          commande.campagne === id,
      ),

    getFichesByCampagne: id =>
      fichesCaisse.filter(
        fiche =>
          fiche.campagne === id,
      ),

    getDepotsByCampagne: id =>
      depotsBanque.filter(
        depot =>
          depot.campagne === id,
      ),

    /* ACTIONS CAMPAGNES */

    createCampagne,

    updateCampagne,

    duplicateCampagne,

    activateCampagne,

    finishCampagne,
  }

  /* =======================================================
     PROVIDER
     ======================================================= */

  return (
    <ObDataContext.Provider
      value={value}
    >
      {children}
    </ObDataContext.Provider>
  )
}
