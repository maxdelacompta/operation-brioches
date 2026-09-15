import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type {
  Commande,
  Donateur,
} from '../types/ob'

import {
  initialDonateurs,
} from '../data/initialDonateurs'

import {
  initialCommandes,
} from '../data/initialCommandes'

type ObDataContextValue = {
  donateurs: Donateur[]
  commandes: Commande[]

  setDonateurs:
    React.Dispatch<
      React.SetStateAction<
        Donateur[]
      >
    >

  setCommandes:
    React.Dispatch<
      React.SetStateAction<
        Commande[]
      >
    >

  getDonateurById: (
    id: number,
  ) =>
    Donateur | undefined

  getCommandesByDonateurId: (
    donateurId: number,
  ) => Commande[]
}

const ObDataContext =
  createContext<
    ObDataContextValue | undefined
  >(undefined)

export function ObDataProvider({
  children,
}: {
  children: ReactNode
}) {
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

  useEffect(() => {
    localStorage.setItem(
      'ob-donateurs',
      JSON.stringify(
        donateurs,
      ),
    )
  }, [donateurs])

  useEffect(() => {
    localStorage.setItem(
      'ob-commandes',
      JSON.stringify(
        commandes,
      ),
    )
  }, [commandes])

  const value =
    useMemo<
      ObDataContextValue
    >(
      () => ({
        donateurs,

        commandes,

        setDonateurs,

        setCommandes,

        getDonateurById: (
          id,
        ) =>
          donateurs.find(
            (donateur) =>
              donateur.id === id,
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
      }),
      [
        donateurs,
        commandes,
      ],
    )

  return (
    <ObDataContext.Provider
      value={value}
    >
      {children}
    </ObDataContext.Provider>
  )
}

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