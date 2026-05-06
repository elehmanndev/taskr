import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useMatch, useNavigate } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import Avatar from '../ui/Avatar'
import Wordmark from '../ui/Wordmark'
import type { Board } from '../../lib/types'

function HomeIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 11.5L12 4l8 7.5V20a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1v-8.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-text-muted">
      <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function BoardIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9h17M9 9v10.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

export default function Navbar() {
  const { user, logout, currentOrgId } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [boardMenuOpen, setBoardMenuOpen] = useState(false)
  const [boards, setBoards] = useState<Board[]>([])
  const menuRef = useRef<HTMLDivElement>(null)
  const boardMenuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const boardMatch = useMatch('/board/:boardId')
  const currentBoardId = boardMatch?.params.boardId ?? null

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (boardMenuRef.current && !boardMenuRef.current.contains(e.target as Node)) setBoardMenuOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    if (!currentOrgId) return
    api.get<Board[]>(`/api/boards?orgId=${currentOrgId}`).then(setBoards).catch(() => {})
  }, [currentOrgId])

  const currentBoard = boards.find((b) => b.id === currentBoardId)
  const selectorLabel = currentBoard?.name ?? 'Selecciona un board'

  return (
    <header
      className="h-14 px-4 flex items-center justify-between shrink-0 backdrop-blur-xl relative z-40"
      style={{
        backgroundColor: 'var(--surface-glass)',
        borderBottom: '1px solid var(--border-soft)',
      }}
    >
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center mr-2">
          <Wordmark size="sm" />
        </Link>

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `w-9 h-9 flex items-center justify-center rounded-lg transition ${
              isActive ? 'text-accent bg-accent-soft' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            }`
          }
          title="Workspace · todos los boards"
          end
        >
          <HomeIcon />
        </NavLink>

        <div className="relative" ref={boardMenuRef}>
          <button
            onClick={() => setBoardMenuOpen((o) => !o)}
            className="flex items-center gap-2 text-sm rounded-full pl-3 pr-3.5 py-1.5 transition hover:opacity-90"
            style={{
              backgroundColor: 'var(--surface-glass-strong)',
              border: '1px solid var(--border-soft)',
              color: 'var(--text-primary)',
            }}
          >
            <BoardIcon className="w-3.5 h-3.5 text-text-muted" />
            <span className="font-medium max-w-[260px] truncate">{selectorLabel}</span>
            <ChevronDownIcon />
          </button>
          {boardMenuOpen && (
            <div
              className="absolute left-0 mt-2 w-72 rounded-2xl py-1.5 text-sm overflow-hidden z-50"
              style={{
                backgroundColor: 'var(--popover-bg)',
                border: '1px solid var(--popover-border)',
                boxShadow: 'var(--popover-shadow)',
              }}
            >
              <div className="px-2">
                {boards.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-text-muted">Sin boards</div>
                ) : (
                  boards.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => { setBoardMenuOpen(false); navigate(`/board/${b.id}`) }}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2.5 hover:bg-surface-hover ${
                        b.id === currentBoardId ? 'text-accent font-medium' : 'text-text-primary'
                      }`}
                    >
                      <BoardIcon
                        className={`w-4 h-4 shrink-0 ${b.id === currentBoardId ? 'text-accent' : 'text-text-muted'}`}
                      />
                      <span className="flex-1 truncate">{b.name}</span>
                      {b.id === currentBoardId && <span>✓</span>}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition hover:bg-surface-hover"
          style={{ border: '1px solid transparent' }}
        >
          <Avatar name={user?.name} src={user?.avatarUrl} size="sm" />
          <span className="text-sm font-medium text-text-primary hidden sm:inline">{user?.name}</span>
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 mt-2 w-64 rounded-2xl py-1.5 text-sm text-text-primary overflow-hidden z-50"
            style={{
              backgroundColor: 'var(--popover-bg)',
              border: '1px solid var(--popover-border)',
              boxShadow: 'var(--popover-shadow)',
            }}
          >
            <div className="px-4 py-3">
              <div className="font-semibold">{user?.name}</div>
              <div className="text-xs text-text-muted truncate">{user?.email}</div>
            </div>
            <div className="mx-3 h-px" style={{ backgroundColor: 'var(--border-soft)' }} />
            <div className="p-2">
              <button
                onClick={() => { setMenuOpen(false); navigate('/profile') }}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-hover"
              >
                Your profile
              </button>
            </div>
            <div className="mx-3 h-px" style={{ backgroundColor: 'var(--border-soft)' }} />
            <div className="p-2">
              <button
                onClick={() => logout()}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-hover text-danger"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
