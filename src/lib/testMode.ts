/** La simulation de comptes est exclue des builds Vite de production. */
export const TEST_MODE_AVAILABLE = import.meta.env.DEV
const TEST_KEY = 'ob2026-dev-test-mode-v1'
export const TEST_MODE_EVENT = 'ob2026-test-mode-change'
export function testModeEnabled(): boolean {
  if (!TEST_MODE_AVAILABLE) return false
  try { return localStorage.getItem(TEST_KEY) === 'true' } catch { return false }
}
export function setTestModeEnabled(enabled: boolean): void {
  if (!TEST_MODE_AVAILABLE) return
  try { localStorage.setItem(TEST_KEY, String(enabled)) } catch { /* mode non persistant */ }
  window.dispatchEvent(new Event(TEST_MODE_EVENT))
}
