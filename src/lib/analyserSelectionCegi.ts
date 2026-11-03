import type { CegiOperation } from '../pages/ImportSelectionCegi'

const amount = (v:string) => Number(v.replace(/\s/g,'').replace(',','.'))
const toISO = (v:string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v); return m ? `${m[3]}-${m[2]}-${m[1]}` : '' }
const opId = (source:string, row:string) => `${source}:${row}`

// Recherche ciblée sur les sélections de virement CEGI. Chaque ligne est revalidée par l'utilisateur.
export function analyserSelectionCegi(text:string, source:string): CegiOperation[] {
  const lines=text.split(/\r?\n/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean)
  const joined=lines.join('\n')
  const ref=/Pi[eè]ce\s*n[°o]?\s*([\w\-/]+)/i.exec(joined)?.[1] ?? ''
  const operations:CegiOperation[]=[]
  let dernierBeneficiaire=''
  let dernierCompte=''
  for(let i=0;i<lines.length;i++) {
    const line=lines[i]
    const identity=/^([A-Z]?\d{6,})\s+(.{3,})$/.exec(line)
    if(identity && !/\bTOTAL\b|\bBANQUE\b/i.test(identity[2])) { dernierCompte=identity[1]; dernierBeneficiaire=identity[2]; continue }
    // Date pièce, pièce comptable, libellé, référence, date d'échéance, dossier et crédit.
    const match=/^(\d{2}\/\d{2}\/\d{4})\s+(\S+)\s+(.+?)\s+(\d{2}-[A-Z0-9-]+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2})\s+([\d\s.,]+)$/.exec(line)
    if(!match) continue
    const valeur=amount(match[7]); if(!Number.isFinite(valeur)||valeur<=0) continue
    operations.push({id:opId(source,`${i}-${match[2]}-${valeur}`),source,beneficiaire:dernierBeneficiaire||'Bénéficiaire à renseigner',compte:dernierCompte,piece:match[2],libelle:match[3],datePiece:toISO(match[1]),echeance:toISO(match[5]),montant:valeur,mode:'Virement',referenceListe:ref,categorie:'AUTRE',fournisseurId:'',commandeIds:[],traitement:'a_verifier'})
  }
  return operations
}

