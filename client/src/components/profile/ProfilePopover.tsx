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
}

// Click a user's avatar → lightweight profile card anchored under it.
// Data is lazy-loaded on first open and cached for the instance.
export default function ProfilePopover({ userId, name, avatarUrl, size = 'sm' }: ProfilePopoverProps) {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  useEffect(() => {
    if (!open || user || loading) return
    setLoading(true)
    api.get<User>(`/api/users/${userId}`)
      .then((u) => setUser(u))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, userId, user, loading])

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className="inline-flex"
        title={name}
      >
        <Avatar name={name} src={avatarUrl} size={size} />
      </button>

      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-72 bg-surface border border-border rounded-lg shadow-xl p-4">
          {loading && <div className="text-xs text-text-secondary">Loading…</div>}
          {!loading && user && (
            <>
              <div className="flex items-start gap-3">
                <Avatar name={user.name} src={user.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{user.name}</div>
                  {user.title && <div className="text-xs text-text-secondary truncate">{user.title}</div>}
                  {user.department && (
                    <div className="text-[11px] text-text-secondary truncate">{user.department}</div>
                  )}
                </div>
              </div>

              {user.bio && (
                <p className="mt-3 text-xs text-text-primary line-clamp-4 whitespace-pre-wrap">
                  {user.bio}
                </p>
              )}

              {(user.skills?.length ?? 0) > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-1">Skills</div>
                  <div className="flex flex-wrap gap-1">
                    {user.skills!.slice(0, 8).map((s) => (
                      <span key={s} className="bg-accent-soft text-accent px-1.5 py-0.5 rounded text-[11px]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {(user.expertise?.length ?? 0) > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-text-secondary mb-1">Knows</div>
                  <div className="flex flex-wrap gap-1">
                    {user.expertise!.slice(0, 8).map((s) => (
                      <span key={s} className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[11px]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs">
                <a href={`mailto:${user.email}`} className="text-accent hover:underline truncate">{user.email}</a>
                <Link
                  to={`/users/${user.id}`}
                  onClick={() => setOpen(false)}
                  className="text-text-secondary hover:text-text-primary shrink-0 ml-2"
                >
                  View profile →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
