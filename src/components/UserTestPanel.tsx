import { useLocation, useNavigate } from 'react-router-dom'
import { DEMO_CURRENT_USER_ID, ROLE_LABELS, useUsers } from '../contexts/UsersContext'
import { usePermissions } from '../contexts/PermissionsContext'
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from '../security/permissionCatalog'
import { permissionModuleForPath } from '../security/accessPolicy'
import './UserTestPanel.css'

export default function UserTestPanel({ placement = 'permissions' }: { placement?: 'permissions' | 'status' }) {
  const { users, currentUser, currentUserId, canTestUsers, isTestingUser, testUser, stopTestingUser } = useUsers()
  const { hasPermission } = usePermissions()
  const location = useLocation()
  const navigate = useNavigate()
  if (!canTestUsers || (placement === 'status' && !isTestingUser) || (placement === 'permissions' && isTestingUser)) return null
  const moduleKey = permissionModuleForPath(location.pathname)
  const module = PERMISSION_MODULES.find(item => item.key === moduleKey)
  const candidates = users.filter(user => user.status === 'actif')
  return (
    <aside className={`ob-user-test ${placement === 'permissions' ? 'ob-user-test--permissions' : ''} ${isTestingUser ? 'ob-user-test--active' : ''}`} aria-label="Test des utilisateurs">
      <div className="ob-user-test__controls">
        {placement === 'permissions' && <>
        <label htmlFor="ob-test-user">{isTestingUser ? 'Test en cours' : 'Tester un utilisateur'}</label>
        <select id="ob-test-user" value={currentUserId} onChange={event => {
          const selected = candidates.find(user => user.id === event.target.value)
          if (!selected || !testUser(selected.id)) return
          const firstPage = PERMISSION_MODULES.find(item => hasPermission(selected.role, item.key, 'consulter'))
          navigate(firstPage?.path ?? '/')
        }}>
          {candidates.map(user => <option key={user.id} value={user.id}>{user.name} — {ROLE_LABELS[user.role]}{user.id === DEMO_CURRENT_USER_ID ? ' (compte de départ)' : ''}</option>)}
        </select>
        </>}
        {isTestingUser && <button type="button" onClick={() => { stopTestingUser(); navigate('/administration/roles') }}>Revenir à l’administrateur</button>}
        {!isTestingUser && <button type="button" onClick={() => navigate('/administration/utilisateurs')}>Gérer les utilisateurs</button>}
      </div>
      {candidates.length === 1 && <p>Crée un utilisateur actif, attribue-lui un rôle et configure ses droits pour commencer le test.</p>}
      {isTestingUser && <>
        <p role="status">Tu testes <strong>{currentUser?.name}</strong> · {currentUser && ROLE_LABELS[currentUser.role]}. Les menus et l’accès aux pages suivent ce rôle.</p>
        <p>Simulation locale, sans connexion réelle. Les modifications éventuelles utilisent les données de ce navigateur. Actualiser la page termine le test.</p>
      </>}
      <details>
        <summary>Droits de cette page et limites du test</summary>
        <p><strong>{module?.label ?? 'Page non répertoriée'}</strong> — l’accès « Voir » est contrôlé, y compris par adresse directe.</p>
        {moduleKey && currentUser && <ul className="ob-user-test__rights">{PERMISSION_ACTIONS.map(action => {
          const supported = module?.actions.some(available => available === action.key)
          return <li key={action.key}>{action.label} : <strong>{supported ? (hasPermission(currentUser.role, moduleKey, action.key) ? 'accordé' : 'non accordé') : 'non configuré'}</strong></li>
        })}</ul>}
        <p>Les autres droits affichés correspondent à la configuration. Les boutons de création, modification, validation, suppression et export ne les appliquent pas encore partout. Le périmètre de données n’est pas filtré. Ce mode ne valide donc pas encore ces restrictions.</p>
      </details>
    </aside>
  )
}
