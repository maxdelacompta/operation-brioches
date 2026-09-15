import { Outlet } from 'react-router-dom'

import Sidebar from '../components/Sidebar'
import Chat from '../components/Chat'

function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <main className="main-content">
        <Outlet />
      </main>

      <Chat />
    </div>
  )
}

export default AppLayout