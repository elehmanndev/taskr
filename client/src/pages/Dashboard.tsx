import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import type { Board } from '../lib/types'

export default function Dashboard() {
  const { currentOrgId, user } = useAuthStore()
  const [boards, setBoards] = useState<Board[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)

  const refresh = async () => {
    if (!currentOrgId) { setLoading(false); return }
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

  if (!currentOrgId) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-2">No organization</h1>
        <p className="text-sm text-gray-500">
          {user?.name}, you aren't a member of any organization yet. Ask an admin to invite you, or create one via the API.
        </p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Boards</h1>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? 'Loading…' : `${boards.length} board${boards.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New Board</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {boards.map((b) => (
          <Link
            key={b.id}
            to={`/board/${b.id}`}
            className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-indigo-300 transition"
          >
            <div className="h-16 -mx-4 -mt-4 mb-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-t-lg" />
            <h3 className="font-semibold truncate">{b.name}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {b._count?.items ?? 0} items · {b.kind.toLowerCase()}
            </p>
          </Link>
        ))}

        <button
          onClick={() => setModalOpen(true)}
          className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-4 hover:border-indigo-400 hover:bg-indigo-50 text-gray-500 hover:text-indigo-600 transition flex flex-col items-center justify-center min-h-[120px]"
        >
          <div className="text-3xl leading-none">+</div>
          <div className="text-sm mt-1">Create Board</div>
        </button>
      </div>

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
    </div>
  )
}
