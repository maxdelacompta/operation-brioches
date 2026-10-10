import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
const source = fs.readFileSync(new URL('../src/services/chatStore.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { createChatStore, conversationsForUser, CHAT_STORAGE_PREFIX } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'))
function memoryStorage() {
  const entries = new Map()
  return { get length() { return entries.size }, key: n => [...entries.keys()][n] ?? null, getItem: key => entries.get(key) ?? null, setItem: (key, value) => { entries.set(key, value) } }
}
function unread(store, recipient, sender) {
  return (conversationsForUser(store.getSnapshot(), recipient)[sender] ?? []).filter(item => item.recipientId === recipient && !item.read).length
}
test('Comptabilité → Admin : même conversation, message entrant non lu', () => {
  const storage = memoryStorage(); const store = createChatStore(() => storage)
  assert.equal(store.send('compta', 'admin', ' Bonjour admin '), true)
  const outgoing = conversationsForUser(store.getSnapshot(), 'compta').admin
  const incoming = conversationsForUser(store.getSnapshot(), 'admin').compta
  assert.equal(outgoing[0].id, incoming[0].id)
  assert.equal(incoming[0].text, 'Bonjour admin')
  assert.equal(unread(store, 'admin', 'compta'), 1)
  assert.equal(unread(store, 'compta', 'admin'), 0)
})
test('Retour au profil, lecture, réponse et rechargement conservent l’historique', () => {
  const storage = memoryStorage(); let store = createChatStore(() => storage)
  store.send('compta', 'admin', 'Question')
  store = createChatStore(() => storage)
  assert.equal(unread(store, 'admin', 'compta'), 1)
  store.markRead('admin', 'compta')
  store.send('admin', 'compta', 'Réponse')
  store = createChatStore(() => storage)
  assert.equal(unread(store, 'admin', 'compta'), 0)
  assert.equal(unread(store, 'compta', 'admin'), 1)
  assert.deepEqual(conversationsForUser(store.getSnapshot(), 'compta').admin.map(m => m.text), ['Question', 'Réponse'])
  store.markRead('compta', 'admin')
  assert.equal(unread(store, 'compta', 'admin'), 0)
})
test('Un troisième profil ne voit pas les conversations des autres', () => {
  const store = createChatStore(() => memory)
  const memory = memoryStorage()
  store.send('compta', 'admin', 'Privé')
  store.send('terrain', 'admin', 'Autre conversation')
  assert.equal(conversationsForUser(store.getSnapshot(), 'terrain').compta, undefined)
  assert.equal(Object.keys(conversationsForUser(store.getSnapshot(), 'externe')).length, 0)
  store.markRead('admin', 'terrain')
  assert.equal(unread(store, 'admin', 'compta'), 1)
})
test('L’expéditeur ne peut pas marquer son envoi comme reçu et lu', () => {
  const memory = memoryStorage(); const store = createChatStore(() => memory)
  store.send('compta', 'admin', 'Bonjour')
  store.markRead('compta', 'admin')
  assert.equal(unread(store, 'admin', 'compta'), 1)
})
test('Deux instances écrivent sans remplacer les messages précédents', () => {
  const memory = memoryStorage(); const a = createChatStore(() => memory); const b = createChatStore(() => memory)
  a.getSnapshot(); b.getSnapshot()
  a.send('compta', 'admin', 'Un'); b.send('admin', 'compta', 'Deux')
  a.refresh(); b.refresh()
  assert.equal(a.getSnapshot().length, 2)
  assert.deepEqual(a.getSnapshot(), b.getSnapshot())
})
test('Stockage indisponible : pas de fausse confirmation d’envoi', () => {
  const store = createChatStore(() => { throw new Error('Stockage refusé') })
  assert.equal(store.getSnapshot().length, 0)
  assert.throws(() => store.send('compta', 'admin', 'Bonjour'), /Stockage refusé/)
})
test('Stockage plein : le message n’apparaît pas comme envoyé', () => {
  const storage = memoryStorage()
  storage.setItem = () => { throw new Error('Quota') }
  const store = createChatStore(() => storage)
  assert.throws(() => store.send('compta', 'admin', 'Bonjour'), /Quota/)
  assert.equal(store.getSnapshot().length, 0)
})
test('Les entrées corrompues sont ignorées et les envois invalides refusés', () => {
  const memory = memoryStorage()
  memory.setItem(CHAT_STORAGE_PREFIX + 'bad', '{')
  memory.setItem(CHAT_STORAGE_PREFIX + 'invalid', JSON.stringify({ text: 'Incomplet' }))
  const store = createChatStore(() => memory)
  assert.equal(store.getSnapshot().length, 0)
  assert.equal(store.send('admin', 'admin', 'Test'), false)
  assert.equal(store.send('compta', 'admin', '   '), false)
  assert.equal(store.send('', 'admin', 'Test'), false)
})
test('Les abonnés sont notifiés et la lecture déjà faite ne boucle pas', () => {
  const memory = memoryStorage(); const store = createChatStore(() => memory)
  let changes = 0
  const unsubscribe = store.subscribe(() => { changes++ })
  store.getSnapshot(); store.send('compta', 'admin', 'Test')
  store.markRead('admin', 'compta'); store.markRead('admin', 'compta')
  assert.equal(changes, 2)
  unsubscribe(); store.send('compta', 'admin', 'Autre')
  assert.equal(changes, 2)
})
