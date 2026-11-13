import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const src = path.join(root, 'src')
const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.css', '.svg', '.png', '.jpg', '.webp']
const errors = []
let checked = 0

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return files(full)
    return /\.(ts|tsx|js|jsx)$/.test(entry.name) ? [full] : []
  })
}

function existsImportedFile(base) {
  return extensions.some(ext => fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) ||
    extensions.slice(1).some(ext => fs.existsSync(path.join(base, `index${ext}`)))
}

for (const file of files(src)) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  function check(specifier, position) {
    if (!specifier.startsWith('.')) return
    checked++
    const relative = specifier.split('?')[0].split('#')[0]
    if (!existsImportedFile(path.resolve(path.dirname(file), relative))) {
      const line = source.getLineAndCharacterOfPosition(position).line + 1
      errors.push(`${path.relative(root, file)}:${line} — ${specifier}`)
    }
  }
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      check(node.moduleSpecifier.text, node.moduleSpecifier.pos)
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      check(node.arguments[0].text, node.arguments[0].pos)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
}

if (errors.length) {
  console.error(`${errors.length} import(s) local(aux) introuvable(s) :\n${errors.join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`${checked} import(s) local(aux) vérifié(s) : aucun fichier manquant.`)
}
