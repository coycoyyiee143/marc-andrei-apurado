import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { adminUid, auth, isFirebaseConfigured } from './firebase'
import AdminDashboard from './components/AdminDashboard'
import AdminLogin from './components/AdminLogin'
import PortfolioView from './components/PortfolioView'
import './App.css'
import './cms.css'

function App() {
  const [isAdminRoute, setIsAdminRoute] = useState(window.location.hash === '#admin')
  const [user, setUser] = useState(null)

  useEffect(() => {
    const updateRoute = () => setIsAdminRoute(window.location.hash === '#admin')
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  useEffect(() => {
    if (!auth) return undefined
    return onAuthStateChanged(auth, setUser)
  }, [])

  if (!isAdminRoute) return <PortfolioView />
  if (!isFirebaseConfigured || !adminUid || !user || user.uid !== adminUid) {
    return <AdminLogin isConfigured={isFirebaseConfigured} hasAdminUid={Boolean(adminUid)} user={user} />
  }
  return <AdminDashboard user={user} />
}

export default App