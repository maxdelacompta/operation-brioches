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

// Les tests exécutent les vrais modules métier, sans maintenir une copie des règles.
function load(relative) {
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file)) file = ['.ts', '.tsx'].map(ext => file + ext).find(fs.existsSync)
  if (!file) throw new Error(`Module introuvable : ${relative}`)
  if (cache.has(file)) return cache.get(file).exports
  const module = { exports: {} }
  cache.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const run = vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })
  run(name => name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : requirePackage(name), module, module.exports)
  return module.exports
}

const { analyserImportJustificatifs } = load('src/lib/justificatifsImport.ts')
const { donsSansContrepartieCaisse, sumFiches } = load('src/lib/dashboardMetrics.ts')
const { memeCampagneCommande, cleLivraisonMulti, cleAlerteLivraison, conserverAffectationsMulti } = load('src/lib/commandeCampaign.ts')
const headers = ['type', 'campagne', 'donateurNom', 'dateEmission', 'nbBrioches', 'prixUnitaire', 'paiementStatut']

test('JDP importé : paiement implicite sans date inventée', () => {
  const { documents, erreurs } = analyserImportJustificatifs([
    headers,
    ['JDP', 'OB2026', 'Exemple fictif', '2026-11-13', '2', '5,00', ''],
  ], 'OB2026', [])
  assert.deepEqual(erreurs, [])
  assert.equal(documents.length, 1)
  assert.equal(documents[0].paiementStatut, 'PAYE')
  assert.equal(documents[0].datePaiement, undefined)
  assert.match(documents[0].numero, /^JDP-2026-\d{3}$/)
})

test('Les justificatifs de 2025 ne sont jamais importés dans la campagne 2026', () => {
  const { documents, erreurs } = analyserImportJustificatifs([
    headers,
    ['JDI', 'OB2025', 'Exemple fictif', '2025-11-13', '1', '5', ''],
  ], 'OB2026', [])
  assert.equal(documents.length, 0)
  assert.match(erreurs[0], /campagne.*différente/)
})

test('Le montant des dons sans brioche reste compris dans les encaissements', () => {
  const fiche = {
    billets100: 1, billets50: 0, billets20: 0, billets10: 0, billets5: 0,
    pieces2: 0, pieces1: 0, pieces050: 0, pieces020: 0,
    pieces010: 0, pieces005: 0, pieces002: 0, pieces001: 0,
    nbCheques: 0, montantCheques: 0, montantTpe: 0, montantVirement: 0,
    nbDonsSansContrepartie: 3, montantDonsSansContrepartie: 35,
    statutCoffre: 'CONTROLEE', donsSansContrepartieInconnu: false,
  }
  assert.equal(sumFiches([fiche]).especes, 100)
  assert.deepEqual(donsSansContrepartieCaisse([fiche]), {
    amount: 35, controlledAmount: 35, count: 3, fichesRenseignees: 1, fichesInconnues: 0,
  })
})

test('Une fiche inconnue ne crée pas de montant estimé', () => {
  const result = donsSansContrepartieCaisse([{ donsSansContrepartieInconnu: true }])
  assert.equal(result.amount, 0)
  assert.equal(result.count, 0)
  assert.equal(result.fichesInconnues, 1)
})

test('Les livraisons distinguent OB2026, TEST-2026 et les campagnes personnalisées', () => {
  assert.equal(memeCampagneCommande('OB2026', 'OB 2026'), true)
  assert.equal(memeCampagneCommande('2026', 'OB2026'), true)
  assert.equal(memeCampagneCommande('OB2026', 'test-2026'), false)
  assert.equal(memeCampagneCommande('TEST-2026', 'OB 2026'), false)
  assert.equal(memeCampagneCommande('Campagne-A-2026', 'Campagne-B-2026'), false)
  assert.equal(memeCampagneCommande('OB2025', 'OB2026'), false)
})

test('Même identifiant de commande : affectation et alerte indépendantes par campagne', () => {
  const officielle = { campagne: 'OB2026', id: 1, numero: 'OB2026-001', dateCommande: '2026-11-13', donateurId: 10 }
  const testCampagne = { ...officielle, campagne: 'TEST-2026' }
  assert.notEqual(cleLivraisonMulti(officielle, 'destination-1'), cleLivraisonMulti(testCampagne, 'destination-1'))
  assert.notEqual(cleAlerteLivraison(officielle), cleAlerteLivraison(testCampagne))
})

test('Ancienne affectation unique conservée sans supprimer les données historiques', () => {
  const commande = { campagne: 'OB2025', id: 10, livraisons: [{ id: 'site-1' }] }
  const ancienneCle = '10:site-1'
  const valeur = { statut: 'PLANIFIEE', responsable: 'Exemple fictif' }
  const sauvegarde = { [ancienneCle]: valeur }
  const resultat = conserverAffectationsMulti(sauvegarde, [commande])
  assert.deepEqual(resultat[ancienneCle], valeur)
  assert.deepEqual(resultat[cleLivraisonMulti(commande, 'site-1')], valeur)
  assert.deepEqual(sauvegarde, { [ancienneCle]: valeur })
})

test('Ancienne référence ambiguë : aucune attribution automatique à deux campagnes', () => {
  const ancienneCle = '10:index-0'
  const commandes = [
    { campagne: 'OB2026', id: 10, livraisons: [{ id: '' }] },
    { campagne: 'TEST-2026', id: 10, livraisons: [{ id: '' }] },
  ]
  const resultat = conserverAffectationsMulti({ [ancienneCle]: { statut: 'LIVREE' } }, commandes)
  assert.equal(resultat[cleLivraisonMulti(commandes[0], 'index-0')], undefined)
  assert.equal(resultat[cleLivraisonMulti(commandes[1], 'index-0')], undefined)
  assert.deepEqual(resultat[ancienneCle], { statut: 'LIVREE' })
})

test('Un ancien index de livraison ne retrouve pas automatiquement une commande après reset', () => {
  const commande = { campagne: 'OB2026', id: 10, livraisons: [{ id: '' }] }
  const ancien = { '10:index-0': { statut: 'PLANIFIEE' } }
  const resultat = conserverAffectationsMulti(ancien, [commande])
  assert.equal(resultat[cleLivraisonMulti(commande, 'index-0')], undefined)
  assert.deepEqual(resultat['10:index-0'], ancien['10:index-0'])
})
