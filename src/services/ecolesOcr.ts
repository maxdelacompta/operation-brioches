import type { School } from './ecolesStore'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

export type ScannedOrderDraft = {
  id: string; filename: string; page: number; schoolId: string; classId: string;
  studentName: string; quantity: number; rawText: string; preview: string;
  confidence: 'À vérifier' | 'Identifiant reconnu'
}
const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
function findId(text: string, prefix: 'ECO' | 'CLA'): string {
  const result = normalize(text).match(new RegExp(`${prefix}[\\s:—-]*([A-Z0-9]{8,12})`))
  return result ? `${prefix}-${result[1]}` : ''
}
function extractNamesAndQuantities(text: string): { studentName: string; quantity: number }[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const output: { studentName: string; quantity: number }[] = []
  for (const line of lines) {
    // Feuille par classe : « 1  Jean Martin   3   12,00 ».
    const match = line.match(/^\s*(?:\d{1,2}[).\s|-]+)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’ .-]{3,55}?)\s+[|\s]+(\d{1,3})(?:\s|$)/)
    if (match) {
      const name = match[1].replace(/[|_\.]{2,}/g, ' ').trim()
      const quantity = Number(match[2])
      if (name.length >= 4 && quantity > 0 && quantity <= 500 && !/NOM|PRENOM|TOTAL|MONTANT/i.test(name)) {
        output.push({ studentName: name, quantity })
      }
    }
  }
  if (output.length) return output
  // Bon individuel : le libellé et la valeur sont généralement sur la même ligne.
  const name = text.match(/nom\s*(?:et|&)\s*pr[eé]nom\s*(?:de\s*l['’]?\s*[eé]l[eè]ve)?\s*[:\-]\s*([^\n]+)/i)?.[1]
  const quantity = text.match(/(?:nombre|quantit[eé])\s*(?:de\s*brioches(?:\s*command[eé]es)?)?\s*[:\-]\s*(\d{1,3})\b/i)?.[1]
  const cleanName = (name || '').replace(/[_|.]{2,}.*/, '').trim()
  return cleanName.length >= 4 && !/_{2,}|=/.test(cleanName) && quantity
    ? [{ studentName: cleanName, quantity: Number(quantity) }]
    : []
}
function parsePage(text: string, schools: School[], file: string, page: number, preview: string): ScannedOrderDraft[] {
  const schoolCode = findId(text, 'ECO')
  const classCode = findId(text, 'CLA')
  const school = schools.find(s => s.id === schoolCode) ?? null
  const matchedClass = school?.classes.find(cls => cls.id === classCode)
  const suggestions = extractNamesAndQuantities(text)
  // Si le formulaire est vierge ou manuscrit illisible, fournir une ligne de revue manuelle.
  const rows = suggestions.length ? suggestions : [{ studentName: '', quantity: 0 }]
  return rows.map((row, index) => ({
    id: `${file}-${page}-${index}-${Math.random().toString(36).slice(2)}`,
    filename: file, page, schoolId: school?.id ?? '', classId: matchedClass?.id ?? '',
    studentName: row.studentName, quantity: row.quantity,
    rawText: text.slice(0, 12000), preview,
    confidence: school && matchedClass ? 'Identifiant reconnu' : 'À vérifier',
  }))
}
function textFromLayer(items: Array<unknown>): string {
  const rows = new Map<number, { x: number; text: string }[]>()
  for (const item of items) {
    if (!item || typeof item !== 'object' || !('str' in item) || !('transform' in item)) continue
    const obj = item as { str: string; transform: number[] }
    const y = Math.round(obj.transform[5] / 3) * 3
    const row = rows.get(y) || []
    row.push({ x: obj.transform[4], text: obj.str })
    rows.set(y, row)
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, row]) => row.sort((a, b) => a.x - b.x).map(r => r.text).join(' ')).join('\n')
}
/** OCR 100 % côté navigateur ; les propositions ne sont JAMAIS enregistrées automatiquement. */
export async function scanSchoolFiles(files: File[], schools: School[], onProgress: (message: string) => void): Promise<ScannedOrderDraft[]> {
  if (!files.length) return []
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  let worker: Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>> | null = null
  async function ocrCanvas(canvas: HTMLCanvasElement): Promise<string> {
    if (!worker) {
      const { createWorker } = await import('tesseract.js')
      worker = await createWorker('fra')
    }
    return (await worker.recognize(canvas)).data.text
  }
  const drafts: ScannedOrderDraft[] = []
  try {
    for (const file of files) {
      if (file.size > 30 * 1024 * 1024) throw new Error(`${file.name} : fichier de plus de 30 Mo.`)
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
        try {
          const pdf = await loading.promise
          if (pdf.numPages > 40) throw new Error(`${file.name} : limite de 40 pages par PDF.`)
          for (let i = 1; i <= pdf.numPages; i++) {
            onProgress(`${file.name} · page ${i}/${pdf.numPages}`)
            const page = await pdf.getPage(i)
            const layer = textFromLayer((await page.getTextContent()).items)
            const viewport = page.getViewport({ scale: 1.65 })
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height)
            const context = canvas.getContext('2d')
            if (!context) throw new Error('Impossible de créer la zone de lecture OCR.')
            await page.render({ canvas, canvasContext: context, viewport }).promise
            const preview = canvas.toDataURL('image/jpeg', 0.68)
            // Documents remplis sur ordinateur : texte sélectionnable. Scans : Tesseract.
            const raw = layer.length > 110 ? layer : await ocrCanvas(canvas)
            drafts.push(...parsePage(raw, schools, file.name, i, preview))
          }
        } finally { await loading.destroy() }
      } else if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
        onProgress(`${file.name} · lecture OCR`)
        const source = URL.createObjectURL(file)
        try {
          const image = new Image()
          image.src = source
          await image.decode()
          const canvas = document.createElement('canvas')
          const max = 2600
          const ratio = Math.min(1, max / Math.max(image.naturalWidth, image.naturalHeight))
          canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio)
          const context = canvas.getContext('2d')
          if (!context) throw new Error('Image illisible.')
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          const raw = await ocrCanvas(canvas)
          drafts.push(...parsePage(raw, schools, file.name, 1, canvas.toDataURL('image/jpeg', 0.68)))
        } finally { URL.revokeObjectURL(source) }
      } else throw new Error(`Format de fichier non pris en charge : ${file.name}`)
    }
    return drafts
  } finally { if (worker) await worker.terminate() }
}
