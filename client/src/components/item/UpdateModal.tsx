import { useEffect, useState } from 'react'
import Modal from '../ui/Modal'
import { api } from '../../lib/api'
import type { Item } from '../../lib/types'
import { useBoardStore } from '../../stores/boardStore'

interface UpdateModalProps {
  item: Item
  open: boolean
  onClose: () => void
}

interface CommentUser {
  id: string
  name: string | null
  email: string
  avatarUrl?: string | null
}

interface Comment {
  id: string
  body: string
  createdAt: string
  user: CommentUser
  replies?: Comment[]
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d >= 1) return `${d} d`
  const h = Math.floor(diff / 3_600_000)
  if (h >= 1) return `${h} h`
  const m = Math.floor(diff / 60_000)
  if (m >= 1) return `${m} min`
  return 'ahora'
}

function Avatar({ user, size = 32 }: { user: CommentUser; size?: number }) {
  const initial = (user.name || user.email)?.[0]?.toUpperCase() ?? '?'
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div
      className="rounded-full bg-accent text-text-on-accent flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  )
}

export default function UpdateModal({ item, open, onClose }: UpdateModalProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const { board } = useBoardStore()

  useEffect(() => {
    if (!open) return
    setBody('')
    setLoading(true)
    api.get<Comment[]>(`/api/items/${item.id}/comments`)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [open, item.id])

  const submit = async () => {
    const text = body.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      const created = await api.post<Comment>(`/api/items/${item.id}/comments`, { body: text })
      setComments((cs) => [...cs, created])
      setBody('')
      // Bump the count locally so the badge updates without a full reload.
      if (board) {
        useBoardStore.setState((state) => {
          if (!state.board) return state
          return {
            board: {
              ...state.board,
              groups: state.board.groups.map((g) => ({
                ...g,
                items: g.items.map((i) =>
                  i.id === item.id
                    ? { ...i, _count: { ...(i._count ?? {}), comments: ((i._count?.comments ?? 0) + 1) } }
                    : i,
                ),
              })),
            },
          }
        })
      }
    } finally {
      setPosting(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-2xl" title={item.name || 'Sin título'}>
      <div className="flex items-center gap-3 border-b border-border pb-3 mb-4 text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">Actualizaciones</span>
        <span className="text-text-muted">/ {comments.length}</span>
      </div>

      <div className="border border-border rounded-md bg-surface-sunken p-3 mb-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe una actualización y menciona a otros con @"
          rows={3}
          className="w-full bg-transparent outline-none resize-none text-sm text-text-primary placeholder:text-text-muted"
          autoFocus
        />
        <div className="flex items-center justify-between pt-2 border-t border-border mt-2">
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <span className="opacity-60">@ · GIF · 😊</span>
          </div>
          <button
            onClick={submit}
            disabled={!body.trim() || posting}
            className="px-4 py-1.5 text-sm rounded bg-accent text-text-on-accent font-semibold disabled:opacity-50 hover:bg-accent-hover"
          >
            {posting ? 'Publicando…' : 'Actualizar'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-text-muted text-sm">Cargando…</div>
      ) : comments.length === 0 ? (
        <div className="text-text-muted text-sm text-center py-4">Aún no hay actualizaciones.</div>
      ) : (
        <div className="space-y-4">
          {comments.map((c) => (
            <div key={c.id} className="border border-border rounded-md p-3 bg-surface">
              <div className="flex items-center gap-2 mb-2">
                <Avatar user={c.user} />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-text-primary">{c.user.name || c.user.email}</div>
                  <div className="text-[11px] text-text-muted">{relativeTime(c.createdAt)}</div>
                </div>
              </div>
              <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">{c.body}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
