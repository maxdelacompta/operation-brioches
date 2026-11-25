import { useEffect } from 'react'
import { useUsers } from '../contexts/UsersContext'
import { useObData } from '../contexts/ObDataContext'
import { useEtablissements } from '../contexts/EtablissementsContext'
import { loadStockMovements,loadStockDons,STOCK_CHANGED } from '../lib/briochesStock'
import { lireLots, LOTS_CHANGED } from '../lib/stocksBriochesLots'
import { lireStandsEstimes } from '../lib/stocksBriochesStands'
import { genererAlertesStocks } from '../lib/stocksBriochesSurveillance'
import {
  estDestinataireAlertesStocks, nettoyerAlertesStocksNonDestinataires, synchroniserAlertesStocks,
} from '../services/userAlerts'

/** Lance la surveillance à l'ouverture de la session, au changement des sources et au retour sur l'onglet.
 * Ne crée pas de second système de notifications : écrit uniquement dans userAlerts.
 */
export default function StocksBriochesAlertsBridge() {
  const { currentUser, users } = useUsers()
  const { selectedCampagne,activeCampagne,fichesCaisse } = useObData()
  const { etablissements } = useEtablissements()
  const campagne = (selectedCampagne ?? activeCampagne)?.id ?? 'OB 2026'
  useEffect(() => {
    // Nettoyer les alertes de stocks créées par les anciennes versions pour
    // des profils hors Communication, même si leur rôle a changé depuis.
    nettoyerAlertesStocksNonDestinataires(users)
    if (!currentUser || currentUser.status !== 'actif' || !estDestinataireAlertesStocks(currentUser.role)) return
    const destinataires = users.filter(user =>
      user.status === 'actif' && estDestinataireAlertesStocks(user.role))
    if (!destinataires.length) return
    // La Communication supervise les stocks de l'ensemble de la campagne :
    // les alertes sont calculées à partir de TOUS les établissements.
    const sites = etablissements.map(e=>({id:e.id,nom:e.nom}))
    const sitesIds = new Set(sites.map(s=>s.id))
    const refresh=()=>{
      try {
        const mouvements=loadStockMovements(campagne).filter(m=>sitesIds.has(m.etablissementId))
          .map((m,i)=>({id:(m as typeof m & {id?:string}).id||`ancien-${i}`,date:(m as typeof m & {date?:string}).date||'',
            type:m.type,etablissementId:m.etablissementId,destinationId:m.destinationId,
            quantite:m.quantite,commentaire:(m as typeof m & {commentaire?:string}).commentaire||''}))
        const dons=loadStockDons(campagne).filter(d=>!d.etablissementId || sitesIds.has(d.etablissementId))
        const stands=lireStandsEstimes(campagne,fichesCaisse)
        const date=new Date()
        const aujourdHui=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
        const alerts=genererAlertesStocks({aujourdHui,etablissements:sites,mouvements,dons,lots:lireLots(campagne),stands})
        for (const destinataire of destinataires) {
          synchroniserAlertesStocks({
            campagneId:campagne,assigneeId:destinataire.id,assigneeRole:destinataire.role,alerts,
          })
        }
      } catch (error) { console.warn('Surveillance stocks brioches indisponible',error) }
    }
    refresh()
    window.addEventListener(STOCK_CHANGED,refresh)
    window.addEventListener(LOTS_CHANGED,refresh)
    window.addEventListener('focus',refresh)
    window.addEventListener('storage',refresh)
    const schedule=window.setInterval(refresh,300000)
    return ()=>{
      window.removeEventListener(STOCK_CHANGED,refresh)
      window.removeEventListener(LOTS_CHANGED,refresh)
      window.removeEventListener('focus',refresh)
      window.removeEventListener('storage',refresh)
      window.clearInterval(schedule)
    }
  },[currentUser,users,campagne,etablissements,fichesCaisse])
  return null
}
