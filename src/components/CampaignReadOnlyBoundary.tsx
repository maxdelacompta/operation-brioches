import {
  useState,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type DragEvent as ReactDragEvent,
} from 'react'
import { LockKeyhole } from 'lucide-react'
import './CampaignReadOnlyBoundary.css'

type Props = {
  children: ReactNode
  campaignName: string
}

/* En consultation, seuls les contrôles d'affichage, de navigation et d'export
   sont activables. Les actions non identifiées sont bloquées par prudence.
   Un module particulier peut identifier une action de lecture via
   data-campaign-readonly-allow="true" (jamais pour une écriture). */
function isAllowed(control: HTMLElement): boolean {
  if (control.closest('[data-campaign-readonly-allow="true"]')) return true
  if (control.closest('[data-campaign-readonly-write="true"]')) return false
  if (control.closest('a[href]')) return true
  if (control.getAttribute('role') === 'tab' || control.closest('[role="tablist"]')) return true

  const label = [
    control.getAttribute('aria-label'),
    control.getAttribute('title'),
    control.textContent,
  ].filter(Boolean).join(' ').trim().toLocaleLowerCase('fr')

  if (control.matches('button, [role="button"]')) {
    // Les verbes susceptibles de déclencher une opération passent avant la liste blanche.
    if (/\b(ajouter|créer|nouveau|modifier|éditer|enregistrer|valider|confirmer|supprimer|retirer|annuler la|clôturer|terminer le|affecter|attribuer|réattribuer|déposer|payer|envoyer|générer|décompter|réinitialiser|réouvrir|rouvrir|déplacer|monter l'arrêt|descendre l'arrêt)\b/i.test(label)) return false
    // Les onglets, les filtres et la pagination ne changent pas les données.
    if (control.closest('[class*="tabs"], [class*="pagination"], [class*="filter"], [class*="pager"]')) return true
    if (control.getAttribute('aria-expanded') !== null) return true
    return /\b(voir|consulter|détails?|afficher|masquer|recherche|filtrer|trier|onglet|précédent|suivant|retour à|fermer|imprimer|télécharger|exporter|zoom|carte|liste|tableau|semaine précédente|semaine suivante|jour précédent|jour suivant)\b/i.test(label)
  }
  if (control.matches('input')) {
    const input = control as HTMLInputElement
    if (input.type === 'search') return true
    const hint = [input.placeholder, input.getAttribute('aria-label'), input.closest('[class*="filter"]')?.className].join(' ').toLowerCase()
    return /recherch|filtr|search|trier/.test(hint)
  }
  if (control.matches('select')) {
    const select = control as HTMLSelectElement
    const hint = [select.getAttribute('aria-label'), select.id, select.name, select.closest('[class*="filter"]')?.className].join(' ').toLowerCase()
    return /filtr|search|recherch|tri|sort|vue|affich|période/.test(hint)
  }
  return false
}

/** Protection immédiate de l'interface ; les services doivent également
 *  vérifier les droits côté serveur avant une vraie mise en production. */
export default function CampaignReadOnlyBoundary({ children, campaignName }: Props) {
  const [notice, setNotice] = useState(false)
  function block(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault()
    event.stopPropagation()
    setNotice(true)
  }
  function onClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element)) return
    const control = target.closest<HTMLElement>('button, [role="button"], [role="switch"], input, textarea, select, [contenteditable="true"], label')
    if (!control) return
    if (control.matches('label')) {
      const input = control.querySelector<HTMLElement>('input, select, textarea')
      if (input && !isAllowed(input)) block(event)
      return
    }
    if (!isAllowed(control)) block(event)
  }
  function onChange(event: ReactFormEvent<HTMLDivElement>) {
    const target = event.target
    if (target instanceof HTMLElement && target.matches('input,select,textarea') && !isAllowed(target)) block(event)
  }
  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (target instanceof HTMLElement && target.matches('button,[role="button"],[role="switch"]') && !isAllowed(target)) block(event)
  }
  function onSubmit(event: ReactFormEvent<HTMLDivElement>) { block(event) }
  function onDrag(event: ReactDragEvent<HTMLDivElement>) { block(event) }
  return (
    <section className="ob-campaign-readonly" aria-label="Consultation d'une campagne inactive">
      <div className="ob-campaign-readonly-banner" role="status">
        <LockKeyhole size={18} aria-hidden="true" />
        <span><strong>Consultation seule · {campaignName}</strong> — Cette campagne n'est pas active. Les modifications sont réservées aux administrateurs.</span>
        {notice && <button type="button" onClick={() => setNotice(false)} aria-label="Masquer ce rappel">Compris</button>}
      </div>
      <div
        className="ob-campaign-readonly-content"
        onClickCapture={onClick}
        onChangeCapture={onChange}
        onKeyDownCapture={onKeyDown}
        onSubmitCapture={onSubmit}
        onDragStartCapture={onDrag}
        onDropCapture={onDrag}
        onBeforeInputCapture={event => {
          if ((event.target as HTMLElement).isContentEditable) block(event)
        }}
      >
        {children}
      </div>
    </section>
  )
}
