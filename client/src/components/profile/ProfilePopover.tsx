import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/api'
import Avatar from '../ui/Avatar'
import type { User } from '../../lib/types'

interface ProfilePopoverProps {
  userId: string
  name?: string
  avatarUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  /** Optional click handler — runs instead of opening the popover. */
  onClick?: (e: React.MouseEvent) => void
}

const HOVER_OPEN_DELAY = 250
const HOVER_CLOSE_DELAY = 200

/**
 * Hover the avatar to peek at a small profile card. Click does nothing by
 * default — pass `onClick` to handle clicks (e.g. open an assignee picker).
 */
export default function ProfilePopover({ userId, name, avatarUrl, size = 'sm', onClick }: ProfilePopoverProps) {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
  }

  const scheduleOpen = () => {
    cancelTimers()
    openTimer.current = setTimeout(() => setOpen(true), HOVER_OPEN_DELAY)
  }

  const scheduleClose = () => {
    cancelTimers()
    closeTimer.current = setTimeout(() => setOpen(false), HOVER_CLOSE_DELAY)
  }

  useEffect(() => () => cancelTimers(), [])

  useEffect(() => {
    if (!open || user || loading) return
    setLoading(true)
    api.get<User>(`/api/users/${userId}`)
      .then((u) => setUser(u))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, userId, user, loading])

  return (
    <div
      ref={wrapperRef}
      className="relative inline-flex"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        onClick={(e) => {
          if (onClick) {
            cancelTimers()
            setOpen(false)
            onClick(e)
          }
        }}
        className="inline-flex"
        title={name}
      >
        <Avatar name={name} src={avatarUrl} size={size} />
      </button>

      {open && (
        <div
          className="absolute z-30 top-full left-0 mt-2 w-72 rounded-2xl overflow-hidden p-4"
          style={{
            backgroundColor: 'var(--popover-bg)',
            border: '1px solid var(--popover-border)',
            boxShadow: 'var(--popover-shadow)',
          }}
          onMouseEnter={cancelTimers}
          onMouseLeave={scheduleClose}
        >
          {loading && <div className="text-xs text-text-muted">Cargando…</div>}
          {!loading && user && (
            <>
              <div className="flex items-center gap-3">
                <Avatar name={user.name} src={user.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-base text-white truncate">{user.name}</div>
                  {user.department && (
                    <div className="text-[13px] text-text-secondary truncate mt-0.5">
                      {user.department}
                      {user.group && <span className="text-text-muted"> · {user.group}</span>}
                    </div>
                  )}
                </div>
              </div>

              {user.claudeMd && (
                <p className="mt-3 text-xs text-text-primary/90 line-clamp-4 whitespace-pre-wrap leading-relaxed font-mono">
                  {user.claudeMd}
                </p>
              )}

              {(user.expertise?.length ?? 0) > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-1.5">
                    Knows
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {user.expertise!.slice(0, 8).map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
                        style={{ backgroundColor: 'rgba(0, 200, 117, 0.55)' }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div
                className="mt-4 pt-3 flex items-center justify-between text-[13px]"
                style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}
              >
                <a
                  href={`mailto:${user.email}`}
                  className="hover:underline truncate font-medium text-white"
                  onClick={(e) => e.stopPropagation()}
                >
                  {user.email}
                </a>
                <Link
                  to={`/users/${user.id}`}
                  onClick={() => setOpen(false)}
                  className="text-white hover:opacity-90 shrink-0 ml-3 font-semibold"
                >
                  Ver perfil →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
