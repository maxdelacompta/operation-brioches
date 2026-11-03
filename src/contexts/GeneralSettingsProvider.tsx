import { useState, type ReactNode } from 'react'
import {
  DEFAULT_SETTINGS,
  GeneralSettingsContext,
  STORAGE_KEY,
  loadSettings,
  type GeneralSettings,
} from './GeneralSettingsContext'

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
