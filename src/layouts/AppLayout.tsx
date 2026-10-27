import { useUsers } from '../contexts/UsersContext'
import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Outlet } from 'react-router-dom'

import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import Chat from '../components/Chat'
import UserTestPanel from '../components/UserTestPanel'

function AppLayout() {
  const { currentUserId } = useUsers()
  const { authenticated } = useAuth()
  const location = useLocation()
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

        <Outlet key={currentUserId} />
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