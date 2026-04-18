import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore, type Theme } from '../../stores/themeStore'
import Avatar from '../ui/Avatar'

const THEMES: { id: Theme; label: string }[] = [
  { id: 'night', label: 'Night' },
  { id: 'light', label: 'Light' },
  { id: 'black', label: 'Black' },
]

export default function Navbar() {
  const { user, logout, currentOrgId, setCurrentOrg } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
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
    <header className="h-14 bg-surface border-b border-border px-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-6">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-accent rounded-md flex items-center justify-center text-text-on-accent font-bold text-sm">T</div>
          <span className="font-semibold text-lg text-text-primary">Taskr</span>
        </Link>
        {user && user.orgs.length > 0 && (
          <select
            value={currentOrgId ?? ''}
            onChange={(e) => setCurrentOrg(e.target.value)}
            className="text-sm border border-border rounded-md px-2 py-1 bg-surface text-text-primary"
          >
            {user.orgs.map((m) => (
              <option key={m.orgId} value={m.orgId}>{m.org.name}</option>
            ))}
          </select>
        )}
        {currentOrg && (
          <span className="text-xs text-text-muted hidden md:inline">{currentOrg.slug}</span>
        )}
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-surface-hover"
        >
          <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          <span className="text-sm font-medium text-text-primary hidden sm:inline">{user?.name}</span>
        </button>
        {menuOpen && (
          <div className="absolute right-0 mt-1 w-56 bg-surface-raised border border-border rounded-md shadow-card py-1 text-sm text-text-primary">
            <div className="px-3 py-2 border-b border-border">
              <div className="font-medium">{user?.name}</div>
              <div className="text-xs text-text-muted truncate">{user?.email}</div>
            </div>
            <button
              onClick={() => { setMenuOpen(false); navigate('/profile') }}
              className="w-full text-left px-3 py-2 hover:bg-surface-hover"
            >
              Your profile
            </button>

            <div className="border-t border-border mt-1 pt-1">
              <div className="px-3 py-1 text-xs uppercase tracking-wide text-text-muted">Theme</div>
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-surface-hover flex items-center justify-between ${theme === t.id ? 'text-accent' : ''}`}
                >
                  <span>{t.label}</span>
                  {theme === t.id && <span>✓</span>}
                </button>
              ))}
            </div>

            <button
              onClick={() => logout()}
              className="w-full text-left px-3 py-2 hover:bg-surface-hover text-danger border-t border-border mt-1"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
