import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import Avatar from '../ui/Avatar'

export default function Navbar() {
  const { user, logout, currentOrgId, setCurrentOrg } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  const currentOrg = user?.orgs.find((o) => o.orgId === currentOrgId)?.org

  return (
    <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-600 rounded-md flex items-center justify-center text-white font-bold text-sm">T</div>
          <span className="font-semibold text-lg">Taskr</span>
        </Link>
        {user && user.orgs.length > 0 && (
          <select
            value={currentOrgId ?? ''}
            onChange={(e) => setCurrentOrg(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
          >
            {user.orgs.map((m) => (
              <option key={m.orgId} value={m.orgId}>{m.org.name}</option>
            ))}
          </select>
        )}
        {currentOrg && (
          <span className="text-xs text-gray-500 hidden md:inline">{currentOrg.slug}</span>
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100"
        >
          <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg py-1 text-sm">
            <div className="px-3 py-2 border-b border-gray-100">
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs text-gray-500 truncate">{user?.email}</div>
            </div>
            <button
              onClick={() => { setMenuOpen(false); navigate('/profile') }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50"
            >
              Your profile
            </button>
            <button
              onClick={() => logout()}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-red-600"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
