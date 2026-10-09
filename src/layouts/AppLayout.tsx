import { useUsers } from '../contexts/UsersContext'
import UserTestPanel from '../components/UserTestPanel'
import PermissionGate from '../components/PermissionGate'
import { useState } from 'react'
import { Outlet } from 'react-router-dom'

import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import Chat from '../components/Chat'

function AppLayout() {
  const { currentUserId } = useUsers()
  const [chatOpen, setChatOpen] = useState(false)

  const [unreadCount, setUnreadCount] = useState(0)

  const [topbarVisible, setTopbarVisible] = useState(true)

  function toggleChat() {
    setChatOpen((current) => !current)
  }

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

        <UserTestPanel placement="status" />
        <PermissionGate>
          <Outlet key={currentUserId} />
        </PermissionGate>

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