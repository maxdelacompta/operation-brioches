import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { ROLE_LABELS, DEMO_CURRENT_USER_ID, useUsers } from '../contexts/UsersContext'
import { TEST_MODE_AVAILABLE, TEST_MODE_EVENT, testModeEnabled, setTestModeEnabled } from '../lib/testMode'

type Props = { placement?: 'status' }

/** Barre flottante de simulation, uniquement accessible à l'admin authentifié en développement. */
export default function UserTestPanel({ placement }: Props) {
  void placement
  const { users, currentUser, currentUserId, setCurrentUserId } = useUsers()
  const { userId } = useAuth()
  const [enabled, setEnabled] = useState(testModeEnabled)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const refresh = () => setEnabled(testModeEnabled())
    window.addEventListener(TEST_MODE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(TEST_MODE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  // Ne jamais afficher l'outil en production, ni à un utilisateur non-administrateur connecté.
  if (!TEST_MODE_AVAILABLE || userId !== DEMO_CURRENT_USER_ID) return null

  const activeUsers = users.filter(user => user.status === 'actif')
  const isOpen = enabled && expanded

  return (
    <aside aria-label="Mode test des utilisateurs" style={{
      position: 'fixed', bottom: 10, right: 14, zIndex: 950,
      width: 'min(440px, calc(100vw - 28px))',
      border: '1px solid #e5d5c4', borderRadius: 12,
      background: '#fffaf5', color: '#213c67',
      boxShadow: '0 8px 28px rgba(20, 45, 76, .17)', fontSize: 12,
      overflow: 'hidden',
    }}>
      <button type="button" onClick={() => setExpanded(open => !open)}
        aria-expanded={isOpen}
        title={!enabled ? 'Activer dans Administration → Utilisateurs' : isOpen ? 'Réduire le sélecteur' : 'Afficher le sélecteur'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 8, width: '100%', padding: '9px 13px', border: 0,
          background: 'transparent', color: 'inherit',
          textAlign: 'left', cursor: 'pointer', fontWeight: 750,
        }}>
        <span>🧪 Mode test {enabled ? `· ${currentUser?.name ?? 'Administrateur'}` : 'désactivé'}</span>
        <span style={{ color: '#b75c11', whiteSpace: 'nowrap' }}>
          {expanded ? '− Réduire' : '+ Profils'}
        </span>
      </button>
      {expanded && (
        <div style={{padding: '9px 13px', borderTop: '1px solid #eadfce'}}>
          <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:650}}>
            <input type="checkbox" checked={enabled} onChange={e => { setTestModeEnabled(e.target.checked); setEnabled(testModeEnabled()) }} />
            Autoriser la simulation des utilisateurs
          </label>
        </div>
      )}
      {isOpen && (
        <div style={{ padding: '0 13px 12px', display: 'grid', gap: 9 }}>
          <label htmlFor="ob-user-test-footer" style={{ fontWeight: 650 }}>Simuler un utilisateur actif</label>
          <select id="ob-user-test-footer" value={currentUserId}
            onChange={event => setCurrentUserId(event.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8,
              padding: '10px', background: '#fff', color: '#263b60',
              border: '1px solid #cbd6e3', fontSize: 13 }}>
            {activeUsers.map(user => (
              <option key={user.id} value={user.id}>{user.name} — {ROLE_LABELS[user.role]}</option>
            ))}
          </select>
          {currentUserId !== DEMO_CURRENT_USER_ID && (
            <button type="button" onClick={() => setCurrentUserId(DEMO_CURRENT_USER_ID)}
              style={{ borderRadius: 8, padding: '9px 12px', cursor: 'pointer',
                border: '1px solid #ebbc91', color: '#a25415', background: '#fff0e2', fontWeight: 750 }}>
              Revenir à l’administrateur
            </button>
          )}
          <span style={{ color: '#72849c', fontSize: 11 }}>Simulation locale, non disponible en production.</span>
        </div>
      )}
    </aside>
  )
}
