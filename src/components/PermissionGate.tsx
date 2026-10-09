import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useUsers, ROLE_LABELS } from '../contexts/UsersContext'
import { PERMISSION_MODULES } from '../security/permissionCatalog'
import { permissionModuleForPath } from '../security/accessPolicy'
import { useAccess } from '../security/useAccess'

export default function PermissionGate({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const { currentUser } = useUsers()
  const { canVisit } = useAccess()
  if (canVisit(pathname)) return <>{children}</>
  const moduleKey = permissionModuleForPath(pathname)
  const module = PERMISSION_MODULES.find(item => item.key === moduleKey)
  const accessible = PERMISSION_MODULES.filter(item => canVisit(item.path))
  return (
    <section className="ob-access-denied" role="status">
      <h1>Accès non autorisé</h1>
      <p>{currentUser?.name ?? 'Cet utilisateur'} ne peut pas consulter {module?.label ?? 'cette page'}.</p>
      {currentUser && <p>Rôle : <strong>{ROLE_LABELS[currentUser.role]}</strong>. Le droit « Voir » doit être accordé dans Rôles et permissions.</p>}
      {accessible.length ? <><h2>Pages accessibles</h2><ul>{accessible.map(item => <li key={item.key}><Link to={item.path}>{item.label}</Link></li>)}</ul></> : <p>Aucune page n’est autorisée pour ce rôle. Reviens à l’administrateur pour configurer ses droits.</p>}
    </section>
  )
}
