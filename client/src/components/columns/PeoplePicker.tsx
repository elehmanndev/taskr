import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import ProfilePopover from '../profile/ProfilePopover'
import { api } from '../../lib/api'
import { useAuthStore } from '../../stores/authStore'
import { useBoardStore } from '../../stores/boardStore'
import type { Item, ItemAssignee, User } from '../../lib/types'

interface PeoplePickerProps {
  itemId: string
  assignees: ItemAssignee[]
}

const MAX_VISIBLE = 2

function Avatar({ user, size = 24 }: { user: { name?: string | null; email?: string; avatarUrl?: string | null }; size?: number }) {
  const initial = (user.name || user.email)?.[0]?.toUpperCase() ?? '?'
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: 'var(--brand-gradient)',
      }}
    >
      {initial}
    </div>
  )
}

export default function PeoplePicker({ itemId, assignees }: PeoplePickerProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [busy, setBusy] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { currentOrgId } = useAuthStore()
  const { upsertItem } = useBoardStore()

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const r = triggerRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (triggerRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    window.addEventListener('mousedown', onClick)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open || !currentOrgId) { setResults([]); return }
    const t = setTimeout(() => {
      const params = new URLSearchParams({ orgId: currentOrgId, limit: '8' })
      if (query) params.set('q', query)
      api.get<User[]>(`/api/users?${params}`).then(setResults).catch(() => setResults([]))
    }, 80)
    return () => clearTimeout(t)
  }, [open, query, currentOrgId])

  const assignedIds = new Set(assignees.map((a) => a.userId))

  const add = async (userId: string) => {
    if (busy || assignedIds.has(userId)) return
    setBusy(true)
    try {
      const item = await api.post<Item>(`/api/items/${itemId}/assignees`, { userId })
      upsertItem(item)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (userId: string) => {
    if (busy) return
    setBusy(true)
    try {
      await api.delete(`/api/items/${itemId}/assignees/${userId}`)
      upsertItem({
        ...({} as Item),
        id: itemId,
        // Optimistic: filter out via assignees prop on next render. We don't
        // have a full Item here so refetch is safer for the list — easiest is
        // to drop the assignee via store helper.
      } as Item)
      // Local removal — the socket event will catch up too.
      useBoardStore.setState((state) => {
        if (!state.board) return state
        return {
          board: {
            ...state.board,
            groups: state.board.groups.map((g) => ({
              ...g,
              items: g.items?.map((i) =>
                i.id === itemId
                  ? { ...i, assignees: i.assignees.filter((a) => a.userId !== userId) }
                  : i,
              ),
            })),
          },
        }
      })
    } finally {
      setBusy(false)
    }
  }

  const visible = assignees.slice(0, MAX_VISIBLE)
  const overflow = assignees.length - visible.length
  const overflowTitle = overflow > 0
    ? assignees.slice(MAX_VISIBLE).map((a) => a.user.name).join(', ')
    : undefined

  return (
    <div className="relative w-full h-full group/people flex items-center justify-center">
      {/* Empty state — dashed circle, whole cell click opens picker */}
      {assignees.length === 0 ? (
        <button
          ref={triggerRef}
          onClick={() => setOpen((o) => !o)}
          className="w-full h-full flex items-center justify-center hover:bg-surface-hover transition"
          title="Asignar persona"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-text-muted">
            <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
          </svg>
        </button>
      ) : (
        <div className="w-full h-full flex items-center justify-center gap-0.5 px-1 relative">
          {visible.map((a) => (
            <ProfilePopover
              key={a.id}
              userId={a.userId}
              name={a.user.name}
              avatarUrl={a.user.avatarUrl}
              size="sm"
              onClick={() => setOpen((o) => !o)}
            />
          ))}
          {overflow > 0 && (
            <span
              title={overflowTitle}
              className="w-6 h-6 rounded-full bg-surface-sunken border border-border-strong flex items-center justify-center text-[10px] font-semibold text-text-secondary"
            >
              +{overflow}
            </span>
          )}
          {/* "+" trigger — hover-revealed, opens picker to add another */}
          <button
            ref={triggerRef}
            onClick={() => setOpen((o) => !o)}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-surface-raised border border-border-strong text-text-secondary text-xs flex items-center justify-center opacity-0 group-hover/people:opacity-100 transition hover:text-accent hover:border-accent"
            title="Añadir persona"
          >
            +
          </button>
        </div>
      )}

      {open && pos && createPortal(
        <div
          ref={popRef}
          className="fixed z-[100] w-72 rounded-2xl overflow-hidden p-2"
          style={{
            top: pos.top,
            left: pos.left,
            backgroundColor: 'var(--popover-bg)',
            border: '1px solid var(--popover-border)',
            boxShadow: 'var(--popover-shadow)',
          }}
        >
          <div className="p-1">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar persona…"
              className="w-full h-8 px-3 text-sm rounded-lg outline-none transition focus:ring-2 focus:ring-accent/40"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          {assignees.length > 0 && (
            <div className="px-1 pt-1.5 pb-1">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted px-2 pb-1">
                Asignados
              </div>
              {assignees.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg group/row hover:bg-white/5"
                >
                  <Avatar user={a.user} size={26} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-text-primary truncate">{a.user.name || a.user.email}</div>
                  </div>
                  <button
                    onClick={() => remove(a.userId)}
                    disabled={busy}
                    className="w-5 h-5 rounded-full text-text-muted hover:text-danger hover:bg-white/10 flex items-center justify-center text-xs opacity-0 group-hover/row:opacity-100 transition"
                    title="Quitar"
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <div className="px-1 pt-1 pb-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted px-2 pb-1">
              Sugerencias
            </div>
            <div className="max-h-56 overflow-y-auto scrollbar-thin">
              {results.filter((u) => !assignedIds.has(u.id)).length === 0 ? (
                <div className="px-2 py-2 text-xs text-text-muted">Sin coincidencias</div>
              ) : (
                results
                  .filter((u) => !assignedIds.has(u.id))
                  .map((u) => (
                    <button
                      key={u.id}
                      onClick={() => add(u.id)}
                      disabled={busy}
                      className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left text-sm transition hover:bg-white/5 disabled:opacity-50"
                    >
                      <Avatar user={u} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="text-text-primary truncate">{u.name || u.email}</div>
                        {u.name && <div className="text-[11px] text-text-muted truncate">{u.email}</div>}
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
