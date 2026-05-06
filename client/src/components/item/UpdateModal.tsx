import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { Item, User } from '../../lib/types'
import { useBoardStore } from '../../stores/boardStore'
import { useAuthStore } from '../../stores/authStore'

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

interface MentionRef {
  userId: string
  name: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d >= 1) return `hace ${d} d`
  const h = Math.floor(diff / 3_600_000)
  if (h >= 1) return `hace ${h} h`
  const m = Math.floor(diff / 60_000)
  if (m >= 1) return `hace ${m} min`
  return 'ahora'
}

function Avatar({ user, size = 36 }: { user: { name?: string | null; email?: string; avatarUrl?: string | null }; size?: number }) {
  const initial = (user.name || user.email)?.[0]?.toUpperCase() ?? '?'
  return user.avatarUrl ? (
    <img src={user.avatarUrl} alt="" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shrink-0"
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

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M18.5 4.5h-13a2 2 0 00-2 2v9a2 2 0 002 2h2.5L7 20.5l4.5-3h7a2 2 0 002-2v-9a2 2 0 00-2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]}'"])/g
const MENTION_RE = /@([\p{L}\p{N}._-]+(?:\s+[\p{L}\p{N}._-]+){0,2})/gu

/** Render a comment body as React nodes — linkify URLs and style @mentions. */
function renderBody(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  // First pass: split on URLs
  const tokens: Array<{ kind: 'text' | 'url'; value: string }> = []
  let lastIdx = 0
  text.replace(URL_RE, (m, _g, idx) => {
    if (idx > lastIdx) tokens.push({ kind: 'text', value: text.slice(lastIdx, idx) })
    tokens.push({ kind: 'url', value: m })
    lastIdx = idx + m.length
    return m
  })
  if (lastIdx < text.length) tokens.push({ kind: 'text', value: text.slice(lastIdx) })

  // Second pass on text segments: pull out @mentions
  let key = 0
  for (const tok of tokens) {
    if (tok.kind === 'url') {
      out.push(
        <a
          key={key++}
          href={tok.value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline decoration-accent/40 hover:decoration-accent break-all"
        >
          {tok.value}
        </a>
      )
      continue
    }
    let last = 0
    const seg = tok.value
    seg.replace(MENTION_RE, (m, name, idx) => {
      if (idx > last) out.push(<span key={key++}>{seg.slice(last, idx)}</span>)
      out.push(
        <span
          key={key++}
          className="px-1 py-0.5 rounded font-medium"
          style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }}
        >
          @{name}
        </span>
      )
      last = idx + m.length
      return m
    })
    if (last < seg.length) out.push(<span key={key++}>{seg.slice(last)}</span>)
  }
  return out
}

/** Find an active @mention being typed: scan back from caret to the nearest @ that's word-start. */
function activeMention(text: string, caret: number): { anchor: number; query: string } | null {
  let i = caret - 1
  while (i >= 0) {
    const ch = text[i]
    if (ch === '@') {
      // Must be at start or preceded by whitespace
      if (i === 0 || /\s/.test(text[i - 1])) {
        return { anchor: i, query: text.slice(i + 1, caret) }
      }
      return null
    }
    if (/\s/.test(ch)) return null
    i--
  }
  return null
}

export default function UpdateModal({ item, open, onClose }: UpdateModalProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [mentions, setMentions] = useState<MentionRef[]>([])
  const [mentionState, setMentionState] = useState<{ anchor: number; query: string } | null>(null)
  const [mentionResults, setMentionResults] = useState<User[]>([])
  const [mentionIdx, setMentionIdx] = useState(0)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const { board } = useBoardStore()
  const { currentOrgId } = useAuthStore()

  useEffect(() => {
    if (!open) return
    setBody('')
    setMentions([])
    setMentionState(null)
    setLoading(true)
    api.get<Comment[]>(`/api/items/${item.id}/comments`)
      .then(setComments)
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [open, item.id])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Fetch user matches whenever the @mention query changes
  useEffect(() => {
    if (!mentionState || !currentOrgId) { setMentionResults([]); return }
    const t = setTimeout(() => {
      const params = new URLSearchParams({ orgId: currentOrgId, limit: '8' })
      if (mentionState.query) params.set('q', mentionState.query)
      api.get<User[]>(`/api/users?${params}`).then(setMentionResults).catch(() => setMentionResults([]))
    }, 80)
    return () => clearTimeout(t)
  }, [mentionState?.query, currentOrgId, mentionState])

  useEffect(() => { setMentionIdx(0) }, [mentionState?.query])

  const updateBodyAndCaret = (next: string, caret: number) => {
    setBody(next)
    setMentionState(activeMention(next, caret))
  }

  const onTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value
    const caret = e.target.selectionStart ?? next.length
    updateBodyAndCaret(next, caret)
  }

  const onSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget
    setMentionState(activeMention(ta.value, ta.selectionStart ?? ta.value.length))
  }

  const insertMention = (user: User) => {
    if (!mentionState || !taRef.current) return
    const ta = taRef.current
    const caret = ta.selectionStart ?? body.length
    const before = body.slice(0, mentionState.anchor)
    const after = body.slice(caret)
    const insert = `@${user.name || user.email} `
    const next = `${before}${insert}${after}`
    setBody(next)
    setMentions((m) => [...m, { userId: user.id, name: user.name || user.email }])
    setMentionState(null)
    // Restore caret right after the inserted mention
    const newCaret = (before + insert).length
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(newCaret, newCaret)
    })
  }

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionState && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx((i) => (i + 1) % mentionResults.length); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx((i) => (i - 1 + mentionResults.length) % mentionResults.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(mentionResults[mentionIdx])
        return
      }
      if (e.key === 'Escape') { e.preventDefault(); setMentionState(null); return }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  const submit = async () => {
    const text = body.trim()
    if (!text || posting) return
    // Only send mentions still present in the body text
    const usedMentions = mentions.filter((m) => text.includes(`@${m.name}`))
    setPosting(true)
    try {
      const created = await api.post<Comment>(`/api/items/${item.id}/comments`, {
        body: text,
        mentions: usedMentions,
      })
      setComments((cs) => [...cs, created])
      setBody('')
      setMentions([])
      setMentionState(null)
      if (board) {
        useBoardStore.setState((state) => {
          if (!state.board) return state
          return {
            board: {
              ...state.board,
              groups: state.board.groups.map((g) => ({
                ...g,
                items: g.items?.map((i) =>
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

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8, 10, 22, 0.55)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] overflow-hidden rounded-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: 'var(--popover-bg)',
          border: '1px solid var(--popover-border)',
          boxShadow: 'var(--popover-shadow)',
        }}
      >
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-text-muted mb-1.5 text-xs font-medium uppercase tracking-[0.12em]">
              <MessageIcon className="w-3.5 h-3.5" />
              Actualizaciones
              <span
                className="ml-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ color: 'var(--accent)', backgroundColor: 'var(--accent-soft)' }}
              >
                {comments.length}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-text-primary truncate">{item.name || 'Sin título'}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-hover transition"
            title="Cerrar"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Compose */}
        <div className="px-6 pb-4">
          <div
            className="relative rounded-xl overflow-visible focus-within:ring-2 focus-within:ring-accent/30 transition"
            style={{
              backgroundColor: 'var(--surface-sunken)',
              border: '1px solid var(--border-soft)',
            }}
          >
            <textarea
              ref={taRef}
              value={body}
              onChange={onTextChange}
              onSelect={onSelect}
              onKeyDown={onKey}
              placeholder="Escribe una actualización… usa @ para mencionar"
              rows={3}
              className="w-full bg-transparent outline-none resize-none text-sm text-text-primary placeholder:text-text-muted px-4 pt-3 pb-2 rounded-xl"
              autoFocus
            />
            <div className="flex items-center justify-end px-3 pb-2 pt-1">
              <button
                onClick={submit}
                disabled={!body.trim() || posting}
                className="px-3.5 py-1.5 text-sm rounded-lg font-medium text-white disabled:opacity-50 transition hover:opacity-95"
                style={{
                  background: body.trim() ? 'var(--brand-gradient)' : 'var(--surface-hover)',
                  color: body.trim() ? '#ffffff' : 'var(--text-muted)',
                }}
              >
                {posting ? 'Publicando…' : 'Publicar'}
              </button>
            </div>

            {/* @mention popover */}
            {mentionState && mentionResults.length > 0 && (
              <div
                className="absolute left-3 right-3 -bottom-2 translate-y-full z-10 rounded-xl overflow-hidden p-1"
                style={{
                  backgroundColor: 'var(--popover-bg)',
                  border: '1px solid var(--popover-border)',
                  boxShadow: 'var(--popover-shadow)',
                }}
              >
                {mentionResults.map((u, idx) => (
                  <button
                    key={u.id}
                    onMouseDown={(e) => { e.preventDefault(); insertMention(u) }}
                    onMouseEnter={() => setMentionIdx(idx)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-sm transition ${
                      idx === mentionIdx ? 'bg-white/10' : ''
                    }`}
                  >
                    <Avatar user={u} size={26} />
                    <div className="flex-1 min-w-0">
                      <div className="text-text-primary truncate">{u.name || u.email}</div>
                      {u.name && <div className="text-[11px] text-text-muted truncate">{u.email}</div>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Comments scroll area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 pb-6">
          {loading ? (
            <div className="text-text-muted text-sm py-6 text-center">Cargando…</div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center text-text-muted py-10">
              <MessageIcon className="w-10 h-10 mb-3 opacity-40" />
              <div className="text-sm">Aún no hay actualizaciones.</div>
              <div className="text-xs text-text-muted mt-1">Sé el primero en escribir una.</div>
            </div>
          ) : (
            <div className="space-y-1">
              {comments.map((c, idx) => (
                <div
                  key={c.id}
                  className={`flex gap-3 py-4 ${idx > 0 ? 'border-t' : ''}`}
                  style={idx > 0 ? { borderColor: 'var(--border-strong)' } : undefined}
                >
                  <Avatar user={c.user} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold text-text-primary truncate">
                        {c.user.name || c.user.email}
                      </span>
                      <span className="text-[11px] text-text-muted shrink-0">{relativeTime(c.createdAt)}</span>
                    </div>
                    <div className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed break-words">
                      {renderBody(c.body)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
