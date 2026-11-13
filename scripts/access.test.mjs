import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(path.join(root, 'package.json'))
const cache = new Map()
// Transpile the actual TypeScript modules; no duplicated permission implementation.
function load(relative) {
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file)) file = ['.ts', '.tsx'].map(ext => file + ext).find(fs.existsSync)
  if (!file) throw new Error(`Module introuvable : ${relative}`)
  if (cache.has(file)) return cache.get(file).exports
  if (file.endsWith('.css')) return {}
  const module = { exports: {} }; cache.set(file, module)
  const source = fs.readFileSync(file, 'utf8')
  // Vite fournit import.meta.env.DEV ; le chargeur CommonJS de ce test le simule.
  const testSource = file.endsWith(path.join('src', 'lib', 'testMode.ts'))
    ? source.replaceAll('import.meta.env.DEV', 'true')
    : source
  const output = ts.transpileModule(testSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText
  const run = vm.runInThisContext(`(function(require,module,exports){${output}\n})`, { filename: file })
  run(name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : requirePackage(name), module, module.exports)
  return module.exports
}
const { PERMISSION_MODULES } = load('src/security/permissionCatalog.ts')
const { canAccessPath, permissionModuleForPath } = load('src/security/accessPolicy.ts')
const user = { role: 'terrain', status: 'actif' }
const grantOnly = key => (_role, module, action) => module === key && action === 'consulter'

test('Chaque route concrète possède un module, sans héritage implicite', () => {
  const app = fs.readFileSync(path.join(root, 'src/App.tsx'), 'utf8')
  const routes = [...app.matchAll(/path="([^"]+)"/g)].map(match => match[1])
  // Les routes publiques et les vues utilitaires ne font pas partie du catalogue métier.
  // Inversement, toutes les permissions déclarées doivent pointer sur une vraie route.
  for (const module of PERMISSION_MODULES) assert.ok(routes.includes(module.path), module.path)
  assert.equal(canAccessPath(user, '/administration/utilisateurs', grantOnly('administration')), false)
  assert.equal(canAccessPath(user, '/commandes/mairies-rs', grantOnly('commandes')), false)
})
test('Le droit Voir autorise uniquement le module demandé', () => {
  for (const module of PERMISSION_MODULES) {
    assert.equal(canAccessPath(user, module.path, grantOnly(module.key)), true, module.path)
    assert.equal(canAccessPath(user, module.path, () => false), false, module.path)
  }
})
test('Compte inactif, absent ou route inconnue : accès refusé', () => {
  assert.equal(canAccessPath({ ...user, status: 'inactif' }, '/', () => true), false)
  assert.equal(canAccessPath(null, '/', () => true), false)
  assert.equal(canAccessPath(user, '/administration/inconnue', () => true), false)
  assert.equal(canAccessPath(user, '/commandes-inconnues', () => true), false)
})
test('Alias et slash final utilisent la permission exacte', () => {
  assert.equal(permissionModuleForPath('/geographie/carte'), 'geo_carte')
  assert.equal(permissionModuleForPath('/geographie/secteurs'), 'geo_secteurs')
  assert.equal(permissionModuleForPath('/geographie/comparaison'), 'geo_comparaison')
  assert.equal(permissionModuleForPath('/geographie/couverture'), 'geo_couverture')
  assert.equal(permissionModuleForPath('/commandes-achats/artisans/fournisseurs'), 'fournisseurs')
  assert.equal(permissionModuleForPath('/bdd/donateurs/'), 'donateurs')
  assert.equal(permissionModuleForPath('/gestion/stands-brioches/stand-01/compteur'), 'stands_brioches')
  // Un lien direct doit respecter le même droit que la navigation latérale.
  assert.equal(canAccessPath(user, '/gestion/stands-brioches/stand-01/compteur', () => false), false)
})

test('Le garde de permissions est intégré au layout des routes métier', () => {
  const layout = fs.readFileSync(path.join(root, 'src/layouts/AppLayout.tsx'), 'utf8')
  assert.match(layout, /<PermissionGate><Outlet/)
})

const React = requirePackage('react')
const { renderToStaticMarkup } = requirePackage('react-dom/server')
const { MemoryRouter } = requirePackage('react-router-dom')
const { UsersProvider } = load('src/contexts/UsersProvider.tsx')
const { PermissionsProvider } = load('src/contexts/PermissionsProvider.tsx')
const { Context: AuthContext } = load('src/contexts/AuthContext.tsx')
const Gate = load('src/components/PermissionGate.tsx').default
const Panel = load('src/components/UserTestPanel.tsx').default
const { selectableTestUsers } = load('src/lib/testUserSelection.ts')
function render(component, pathname, values = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: key => values[key] ?? null } })
  try {
    return renderToStaticMarkup(React.createElement(UsersProvider, null,
      React.createElement(AuthContext.Provider, { value: { authenticated: true, userId: 'demo-admin' } },
        React.createElement(PermissionsProvider, null,
          React.createElement(MemoryRouter, { initialEntries: [pathname] }, component)))))
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous)
    else delete globalThis.localStorage
  }
}
test('Administrateur : toutes les pages restent accessibles', () => {
  for (const module of PERMISSION_MODULES) {
    assert.match(render(React.createElement(Gate, null, React.createElement('p', null, 'PAGE_AUTORISEE')), module.path), /PAGE_AUTORISEE/)
  }
})
test('Le garde ne rend pas le contenu d’une page refusée', () => {
  const html = render(React.createElement(Gate, null, React.createElement('p', null, 'CONTENU_CONFIDENTIEL')), '/inconnue')
  assert.match(html, /Accès non autorisé/)
  assert.doesNotMatch(html, /CONTENU_CONFIDENTIEL/)
})
test('Le sélecteur propose les comptes actifs uniquement', () => {
  const base = { email: '', poste: '', perimetre: '', role: 'terrain' }
  const comptes = [{ ...base, id: 'a', name: 'ACTIF_TEST', status: 'actif' }, { ...base, id: 'b', name: 'INACTIF_TEST', status: 'inactif' }]
  assert.deepEqual(selectableTestUsers(comptes).map(compte => compte.name), ['ACTIF_TEST'])
  const html = render(React.createElement(Panel), '/', { 'ob-users-v1': JSON.stringify(comptes) })
  // Par défaut, le sélecteur reste replié : aucun nom de compte n'est exposé.
  assert.match(html, /Mode test désactivé/)
  assert.doesNotMatch(html, /ACTIF_TEST/)
  assert.doesNotMatch(html, /INACTIF_TEST/)
})
test('Ancienne matrice : droits conservés et nouveaux modules refusés par défaut', () => {
  function Snapshot() {
    const { hasPermission } = load('src/contexts/permissionsState.ts').usePermissions()
    return React.createElement('p', null, JSON.stringify([hasPermission('terrain', 'dashboard', 'consulter'), hasPermission('terrain', 'geographie', 'consulter')]))
  }
  const html = render(React.createElement(Snapshot), '/', { 'ob-role-permissions-v1': JSON.stringify({ terrain: { dashboard: ['consulter'] } }) })
  assert.match(html, /\[true,false\]/)
})
