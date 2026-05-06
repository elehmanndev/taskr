import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import type { Board } from '../../lib/types'

const COLLAPSED_KEY = 'taskr.sidebar.collapsed'

function ChevronLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

function PlusIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export default function Sidebar() {
  const { currentOrgId } = useAuthStore()
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(() => localStorage.getItem(COLLAPSED_KEY) === '1')

  const refresh = async () => {
    if (!currentOrgId) return
    setLoading(true)
    try {
      const list = await api.get<Board[]>(`/api/boards?orgId=${currentOrgId}`)
      setBoards(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [currentOrgId])

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0')
      return next
    })
  }

  const createBoard = async () => {
    if (!newName.trim() || !currentOrgId) return
    setCreating(true)
    try {
      await api.post(`/api/boards?orgId=${currentOrgId}`, { name: newName.trim() })
      setNewName('')
      setModalOpen(false)
      await refresh()
    } finally {
      setCreating(false)
    }
  }

  return (
    <aside
      className={`flex flex-col shrink-0 transition-[width] duration-200 backdrop-blur-xl relative z-30 ${collapsed ? 'w-16' : 'w-64'}`}
      style={{
        backgroundColor: 'var(--surface-glass)',
        borderRight: '1px solid var(--border-soft)',
      }}
    >
      {/* Header row with collapse toggle */}
      <div className="h-12 flex items-center justify-between px-3">
        {!collapsed && (
          <Link
            to="/dashboard"
            className="text-[10px] font-semibold uppercase text-text-muted tracking-[0.18em] px-2"
          >
            Workspace
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      {!collapsed && (
        <div className="px-4 pt-2 pb-2 flex justify-between items-center">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Boards
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-text-muted hover:text-accent hover:bg-surface-hover transition"
            title="New Board"
          >
            <PlusIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3 space-y-0.5">
        {loading && !collapsed && <div className="px-3 py-2 text-xs text-text-muted">Loading…</div>}
        {!loading && boards.length === 0 && !collapsed && (
          <div className="px-3 py-2 text-xs text-text-muted">No boards yet</div>
        )}
        {boards.map((b) => (
          <NavLink
            key={b.id}
            to={`/board/${b.id}`}
            title={collapsed ? b.name : undefined}
            className={({ isActive }) =>
              `relative flex items-center gap-2.5 px-3 py-2 text-[15px] rounded-lg truncate transition group ${
                isActive
                  ? 'text-text-primary font-medium'
                  : 'text-text-secondary font-normal hover:text-text-primary hover:bg-surface-hover'
              }`
            }
            style={({ isActive }) =>
              isActive
                ? { backgroundColor: 'var(--accent-soft)' }
                : undefined
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full"
                    style={{ background: 'var(--brand-gradient)' }}
                  />
                )}
                <BoardIcon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-accent' : 'text-text-muted group-hover:text-text-secondary'
                  }`}
                />
                {!collapsed && <span className="truncate">{b.name}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Board">
        <div className="space-y-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createBoard() }}
            placeholder="Board name"
            className="w-full border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-accent focus:border-accent outline-none bg-surface text-text-primary"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={createBoard} disabled={creating || !newName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </aside>
  )
}
