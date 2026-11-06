import { useUsers } from '../contexts/UsersContext'
import { useObData } from '../contexts/ObDataContext'
import { isCampaignReadOnly } from '../lib/campaignAccess'
import CampaignReadOnlyBoundary from '../components/CampaignReadOnlyBoundary'
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Outlet } from 'react-router-dom'

import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import Chat from '../components/Chat'
import UserTestPanel from '../components/UserTestPanel'

function AppLayout() {
  const { currentUserId, currentUser } = useUsers()
  const { selectedCampagne, selectedCampagneId } = useObData()
  const { authenticated } = useAuth()
  const location = useLocation()
  const readOnly = isCampaignReadOnly(selectedCampagne, currentUser?.role, location.pathname)
  const pageKey = `${currentUserId}:${selectedCampagneId}`
  const [chatOpen, setChatOpen] = useState(false)

  const [unreadCount, setUnreadCount] = useState(0)

  const [topbarVisible, setTopbarVisible] = useState(true)

  function toggleChat() {
    setChatOpen((current) => !current)
  }

  if (!authenticated) return <Navigate to="/connexion" state={{ from: location.pathname }} replace />

  return (
    <div className="app-layout">

      <Sidebar />

      <main className="main-content">

        <Topbar
          unreadCount={unreadCount}
          chatOpen={chatOpen}
          onChatClick={toggleChat}
          onVisibilityChange={setTopbarVisible}
        />

        {readOnly ? (
          <CampaignReadOnlyBoundary campaignName={selectedCampagne?.nom ?? selectedCampagne?.id ?? ''}>
            <Outlet key={pageKey} />
          </CampaignReadOnlyBoundary>
        ) : (
          <Outlet key={pageKey} />
        )}
        <UserTestPanel placement="status" />

      </main>

      <Chat
        key={currentUserId}
        isOpen={chatOpen}
        showFloating={!topbarVisible}
        onToggle={toggleChat}
        onClose={() => setChatOpen(false)}
        onUnreadChange={setUnreadCount}
      />

    </div>
  )
}

export default AppLayout