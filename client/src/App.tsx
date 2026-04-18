import { useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import BoardPage from './pages/BoardPage'
import Profile from './pages/Profile'
import AppLayout from './components/layout/AppLayout'
import { useAuthStore } from './stores/authStore'

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuthStore()
  const location = useLocation()
  if (loading) return <div className="flex h-full items-center justify-center text-gray-500">Loading…</div>
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  return children
}

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe)
  useEffect(() => { fetchMe() }, [fetchMe])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <AppLayout />
          </Protected>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/board/:boardId" element={<BoardPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/users/:userId" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
