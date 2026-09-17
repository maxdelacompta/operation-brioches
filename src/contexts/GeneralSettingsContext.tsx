import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react'

/* =========================================================
   TYPES
   ========================================================= */

export type GeneralSettings = {
  applicationName: string
  organizationName: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
  documentFooter: string
}

/* =========================================================
   PARAMÈTRES INITIAUX

   Pas de coordonnées inventées.
   L'utilisateur renseignera les informations AEIM.
   ========================================================= */

export const DEFAULT_SETTINGS: GeneralSettings = {
  applicationName: 'Opération Brioches',
  organizationName: 'AEIM',
  email: '',
  phone: '',
  address: '',
  postalCode: '',
  city: '',
  documentFooter: '',
}

const STORAGE_KEY = 'ob-general-settings-v1'

/* =========================================================
   CHARGEMENT
   ========================================================= */

function loadSettings(): GeneralSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (!raw) {
      return { ...DEFAULT_SETTINGS }
    }

    const parsed: unknown = JSON.parse(raw)

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ...DEFAULT_SETTINGS }
    }

    const stored = parsed as Record<string, unknown>

    const result: GeneralSettings = {
      ...DEFAULT_SETTINGS,
    }

    const keys = Object.keys(
      DEFAULT_SETTINGS,
    ) as (keyof GeneralSettings)[]

    for (const key of keys) {
      const value = stored[key]

      if (typeof value === 'string') {
        result[key] = value
      }
    }

    return result
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

/* =========================================================
   CONTEXTE
   ========================================================= */

type GeneralSettingsContextValue = {
  settings: GeneralSettings

  saveSettings: (
    nextSettings: GeneralSettings,
  ) => void

  resetSettings: () => void
}

const GeneralSettingsContext = createContext<
  GeneralSettingsContextValue | undefined
>(undefined)

/* =========================================================
   PROVIDER
   ========================================================= */

export function GeneralSettingsProvider({
  children,
}: {
  children: ReactNode
}) {
  const [settings, setSettings] =
    useState<GeneralSettings>(loadSettings)

  function saveSettings(
    nextSettings: GeneralSettings,
  ) {
    // On écrit d'abord dans le navigateur.
    // Si l'écriture échoue, on ne confirme pas
    // à tort une sauvegarde.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(nextSettings),
    )

    setSettings({ ...nextSettings })
  }

  function resetSettings() {
    localStorage.removeItem(STORAGE_KEY)

    setSettings({ ...DEFAULT_SETTINGS })
  }

  return (
    <GeneralSettingsContext.Provider
      value={{
        settings,
        saveSettings,
        resetSettings,
      }}
    >
      {children}
    </GeneralSettingsContext.Provider>
  )
}

/* =========================================================
   HOOK
   ========================================================= */

export function useGeneralSettings() {
  const context = useContext(
    GeneralSettingsContext,
  )

  if (!context) {
    throw new Error(
      'useGeneralSettings doit être utilisé dans GeneralSettingsProvider.',
    )
  }

  return context
}