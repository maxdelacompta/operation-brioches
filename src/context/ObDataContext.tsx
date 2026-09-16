import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

import type {
  Commande,
  Donateur,
  FicheCaisse,
} from '../types/ob'

import {
  initialDonateurs,
} from '../data/initialDonateurs'

import {
  initialCommandes,
} from '../data/initialCommandes'

import {
  initialFichesCaisse,
} from '../data/initialFichesCaisse'

/* =========================================================
   TYPE DU CONTEXTE
   ========================================================= */

type ObDataContextValue = {
  donateurs:
    Donateur[]

  commandes:
    Commande[]

  fichesCaisse:
    FicheCaisse[]

  setDonateurs:
    Dispatch<
      SetStateAction<
        Donateur[]
      >
    >

  setCommandes:
    Dispatch<
      SetStateAction<
        Commande[]
      >
    >

  setFichesCaisse:
    Dispatch<
      SetStateAction<
        FicheCaisse[]
      >
    >

  getDonateurById:
    (
      id: number,
    ) =>
      Donateur | undefined

  getCommandesByDonateurId:
    (
      donateurId:
        number,
    ) =>
      Commande[]

  getFicheCaisseById:
    (
      id: number,
    ) =>
      FicheCaisse | undefined
}

/* =========================================================
   CONTEXTE
   ========================================================= */

const ObDataContext =
  createContext<
    ObDataContextValue | undefined
  >(undefined)

/* =========================================================
   PROVIDER
   ========================================================= */

export function ObDataProvider({
  children,
}: {
  children:
    ReactNode
}) {
  /* =======================================================
     DONATEURS
     ======================================================= */

  const [
    donateurs,
    setDonateurs,
  ] =
    useState<Donateur[]>(
      () => {
        const saved =
          localStorage.getItem(
            'ob-donateurs',
          )

        if (!saved) {
          return initialDonateurs
        }

        try {
          return JSON.parse(
            saved,
          ) as Donateur[]
        } catch {
          return initialDonateurs
        }
      },
    )

  /* =======================================================
     COMMANDES
     ======================================================= */

  const [
    commandes,
    setCommandes,
  ] =
    useState<Commande[]>(
      () => {
        const saved =
          localStorage.getItem(
            'ob-commandes',
          )

        if (!saved) {
          return initialCommandes
        }

        try {
          return JSON.parse(
            saved,
          ) as Commande[]
        } catch {
          return initialCommandes
        }
      },
    )

  /* =======================================================
     FICHES DE CAISSE
     ======================================================= */

  const [
    fichesCaisse,
    setFichesCaisse,
  ] =
    useState<FicheCaisse[]>(
      () => {
        const saved =
          localStorage.getItem(
            'ob-fiches-caisse',
          )

        if (!saved) {
          return initialFichesCaisse
        }

        try {
          return JSON.parse(
            saved,
          ) as FicheCaisse[]
        } catch {
          return initialFichesCaisse
        }
      },
    )

  /* =======================================================
     SAUVEGARDE DONATEURS
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      'ob-donateurs',
      JSON.stringify(
        donateurs,
      ),
    )
  }, [
    donateurs,
  ])

  /* =======================================================
     SAUVEGARDE COMMANDES
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      'ob-commandes',
      JSON.stringify(
        commandes,
      ),
    )
  }, [
    commandes,
  ])

  /* =======================================================
     SAUVEGARDE FICHES DE CAISSE
     ======================================================= */

  useEffect(() => {
    localStorage.setItem(
      'ob-fiches-caisse',
      JSON.stringify(
        fichesCaisse,
      ),
    )
  }, [
    fichesCaisse,
  ])

  /* =======================================================
     VALEUR
     ======================================================= */

  const value =
    useMemo<
      ObDataContextValue
    >(
      () => ({
        donateurs,

        commandes,

        fichesCaisse,

        setDonateurs,

        setCommandes,

        setFichesCaisse,

        getDonateurById:
          (
            id,
          ) =>
            donateurs.find(
              (donateur) =>
                donateur.id ===
                id,
            ),

        getCommandesByDonateurId:
          (
            donateurId,
          ) =>
            commandes.filter(
              (commande) =>
                commande.donateurId ===
                donateurId,
            ),

        getFicheCaisseById:
          (
            id,
          ) =>
            fichesCaisse.find(
              (fiche) =>
                fiche.id ===
                id,
            ),
      }),
      [
        donateurs,
        commandes,
        fichesCaisse,
      ],
    )

  return (
    <ObDataContext.Provider
      value={
        value
      }
    >
      {children}
    </ObDataContext.Provider>
  )
}

/* =========================================================
   HOOK
   ========================================================= */

export function useObData() {
  const context =
    useContext(
      ObDataContext,
    )

  if (!context) {
    throw new Error(
      'useObData doit être utilisé dans ObDataProvider',
    )
  }

  return context
}