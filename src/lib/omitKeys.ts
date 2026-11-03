/** Copie un objet de formulaire sans ses champs techniques.
 * Les objets sources restent inchangés.
 */
export function omitKeys<T extends object, K extends keyof T>(
  source: T,
  ...keys: K[]
): Omit<T, K> {
  const result = { ...source }
  for (const key of keys) {
    delete (result as Partial<T>)[key]
  }
  return result
}
