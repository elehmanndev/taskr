import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import type { Board } from '../../lib/types'

const COLLAPSED_KEY = 'taskr.sidebar.collapsed'

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
      className={`bg-surface border-r border-border flex flex-col shrink-0 transition-[width] duration-150 ${collapsed ? 'w-14' : 'w-60'}`}
    >
      <div className="h-10 flex items-center justify-between px-2 border-b border-border">
        {!collapsed && (
          <Link to="/dashboard" className="text-xs font-semibold uppercase text-text-secondary tracking-wide pl-1">
            Boards
          </Link>
        )}
        <button
          onClick={toggleCollapsed}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-surface-hover text-text-secondary"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </div>

      {!collapsed && (
        <div className="px-2 pt-2 pb-1 flex justify-between items-center">
          <span className="text-[10px] uppercase tracking-wider text-text-secondary">All boards</span>
          <button
            onClick={() => setModalOpen(true)}
            className="w-6 h-6 rounded flex items-center justify-center text-text-secondary hover:bg-surface-hover hover:text-accent text-lg leading-none"
            title="New Board"
          >+</button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {loading && !collapsed && <div className="px-2 py-1 text-xs text-text-muted">Loading…</div>}
        {!loading && boards.length === 0 && !collapsed && (
          <div className="px-2 py-1 text-xs text-text-muted">No boards yet</div>
        )}
        {boards.map((b) => (
          <NavLink
            key={b.id}
            to={`/board/${b.id}`}
            title={collapsed ? b.name : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2 my-0.5 px-2 py-1.5 text-sm rounded-md truncate ${
                isActive
                  ? 'bg-accent-soft text-accent font-medium'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`
            }
          >
            <span className="shrink-0 w-4 text-center text-xs opacity-70">▦</span>
            {!collapsed && <span className="truncate">{b.name}</span>}
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
