import { useLocation } from 'react-router-dom'
import { useObData } from '../contexts/ObDataContext'
import { useUsers } from '../contexts/UsersContext'
import { isCampaignReadOnly } from './campaignAccess'

/** Autorisation recalculée dès que la campagne, le rôle ou la page change. */
export function useCampaignWriteAccess(): boolean {
  const { selectedCampagne } = useObData()
  const { currentUser } = useUsers()
  const { pathname } = useLocation()
  return !isCampaignReadOnly(selectedCampagne, currentUser?.role, pathname)
}
