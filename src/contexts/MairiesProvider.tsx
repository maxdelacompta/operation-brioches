import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { type Mairie } from '../types/mairies'
import { STORAGE_KEY, seedMairies, type MairiesContextValue, MairiesContext, createId } from "./MairiesContext"

export function MairiesProvider({ children }: { children: ReactNode }) {
  const [mairies, setMairies] = useState<Mairie[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return seedMairies
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : seedMairies
    } catch {
      return seedMairies
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mairies))
  }, [mairies])

  const value = useMemo<MairiesContextValue>(() => ({
    mairies,
    createMairie(input) {
      const now = new Date().toISOString()
      const item: Mairie = {
        ...input,
        id: createId(),
        historique: [
          { id: createId(), date: now.slice(0, 10), libelle: 'Fiche mairie créée' },
        ],
        createdAt: now,
        updatedAt: now,
      }
      setMairies((current) => [item, ...current])
      return item
    },
    updateMairie(id, patch) {
      const now = new Date().toISOString()
      setMairies((current) => current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              updatedAt: now,
              historique: [
                { id: createId(), date: now.slice(0, 10), libelle: 'Fiche mairie modifiée' },
                ...item.historique,
              ],
            }
          : item,
      ))
    },
    importMairies(rows) {
      const now = new Date().toISOString()
      setMairies(current => {
        const result = [...current]
        for (const row of rows) {
          const index = row.existingId ? result.findIndex(m => m.id === row.existingId) : -1
          if (index >= 0) {
            const previous = result[index]
            result[index] = {
              ...previous, ...row.value,
              // Preserve historical records and attached documents.
              participations: previous.participations,
              documents: previous.documents,
              updatedAt: now,
              historique: [{ id: createId(), date: now.slice(0, 10), libelle: 'Fiche mise à jour par import Excel' }, ...previous.historique],
            }
          } else {
            result.push({ ...row.value, id: createId(), createdAt: now, updatedAt: now,
              historique: [{ id: createId(), date: now.slice(0, 10), libelle: 'Fiche créée par import Excel' }] })
          }
        }
        return result
      })
    },
    archiveMairie(id) {
      setMairies((current) => current.map((item) =>
        item.id === id ? { ...item, statut: 'ARCHIVEE', updatedAt: new Date().toISOString() } : item,
      ))
    },
    restoreMairie(id) {
      setMairies((current) => current.map((item) =>
        item.id === id ? { ...item, statut: 'ACTIVE', updatedAt: new Date().toISOString() } : item,
      ))
    },
  }), [mairies])

  return <MairiesContext.Provider value={value}>{children}</MairiesContext.Provider>
}
