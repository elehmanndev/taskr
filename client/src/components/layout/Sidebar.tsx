import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import type { Board } from '../../lib/types'

export default function Sidebar() {
  const { currentOrgId } = useAuthStore()
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

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
    <aside className="w-60 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="p-3 flex items-center justify-between">
        <Link to="/dashboard" className="text-xs font-semibold uppercase text-gray-500 tracking-wide">Boards</Link>
        <button
          onClick={() => setModalOpen(true)}
          className="text-gray-500 hover:text-indigo-600 text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"
          title="New Board"
        >+</button>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 pb-3">
        {loading && <div className="px-2 py-1 text-xs text-gray-400">Loading…</div>}
        {!loading && boards.length === 0 && (
          <div className="px-2 py-1 text-xs text-gray-400">No boards yet</div>
        )}
        {boards.map((b) => (
          <NavLink
            key={b.id}
            to={`/board/${b.id}`}
            className={({ isActive }) =>
              `block px-2 py-1.5 text-sm rounded-md truncate ${
                isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            {b.name}
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
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
