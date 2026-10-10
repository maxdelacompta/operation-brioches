import { useState, type CSSProperties } from 'react'
import { useUsers, ROLE_LABELS, DEMO_CURRENT_USER_ID } from '../contexts/UsersContext'

type Props = { placement?: 'status' }

/** Panneau de simulation : ouverture au survol des 15 derniers pixels de l'écran. */
export default function UserTestPanel({ placement }: Props) {
  const { users, currentUser, currentUserId, setCurrentUserId } = useUsers()
  const [open, setOpen] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const activeUsers = users.filter(user => user.status === 'actif')

  if (placement !== 'status') {
    return <div style={{ padding: '10px 14px', borderRadius: 12, background: '#FFF9F3', border: '1px solid #E8DCCF', color: '#263B60', fontSize: 13 }}>
      🧪 Le mode test des permissions s'ouvre en approchant la souris du bas de l'écran (15 px).
    </div>
  }

  const button: CSSProperties = {
    border: '1px solid #F2B17F', background: '#FFF1E4', color: '#AA5416',
    borderRadius: 9, padding: '8px 12px', cursor: 'pointer', fontWeight: 700,
  }

  return (
    <aside
      aria-label="Mode test des permissions"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        height: open ? 'auto' : 15,
        minHeight: open ? 64 : 15,
        background: open ? '#FFF9F3' : 'transparent',
        borderTop: open ? '1px solid #E8DCCF' : 'none',
        boxShadow: open ? '0 -4px 22px rgba(38,59,96,.12)' : 'none',
        boxSizing: 'border-box', color: '#263B60', fontSize: 13,
      }}
    >
      {!open && (
        <button
          type="button"
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          aria-label="Ouvrir le mode test des permissions"
          title="Ouvrir le mode test des permissions"
          style={{ position: 'absolute', inset: 0, width: '100%', height: 15, border: 'none',
            padding: 0, background: 'transparent', cursor: 'pointer' }}
        />
      )}
      {open && (
        <div style={{ padding: '12px 18px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <strong style={{ whiteSpace: 'nowrap' }}>🧪 Mode test des permissions</strong>
          <label htmlFor="ob-user-test-footer">Utilisateur :</label>
          <select
            id="ob-user-test-footer"
            value={currentUserId}
            onChange={event => setCurrentUserId(event.target.value)}
            style={{ minWidth: 180, maxWidth: '100%', padding: '7px 10px',
              background: '#fff', color: '#263B60', border: '1px solid #C9D4E0', borderRadius: 8 }}
          >
            {activeUsers.map(user => (
              <option key={user.id} value={user.id}>{user.name} — {ROLE_LABELS[user.role]}</option>
            ))}
          </select>
          <span style={{ opacity: .8 }}>Profil : <strong>{currentUser ? ROLE_LABELS[currentUser.role] : 'Aucun'}</strong></span>
          {currentUserId !== DEMO_CURRENT_USER_ID && (
            <button type="button" onClick={() => setCurrentUserId(DEMO_CURRENT_USER_ID)} style={button}>
              ↩ Retour administrateur
            </button>
          )}
          <button type="button" onClick={() => setShowInfo(value => !value)}
            aria-expanded={showInfo} style={{ ...button, marginLeft: 'auto' }}>
            {showInfo ? 'Masquer les infos −' : 'Infos +'}
          </button>
          <button type="button" onClick={() => setOpen(false)} style={button} aria-label="Fermer le panneau de test">
            ✕
          </button>
          {showInfo && <p style={{ flexBasis: '100%', margin: 0, fontSize: 12, opacity: .8 }}>
            Simulation locale seulement : aucune authentification réelle.
            {activeUsers.length < 2 ? ' Crée un autre utilisateur actif pour tester ses droits.' : ''}
          </p>}
        </div>
      )}
    </aside>
  )
}
