import { useEffect, useRef, useState } from 'react'

export interface TimelineValue {
  from?: string | null
  to?: string | null
}

interface TimelineCellProps {
  value?: TimelineValue | null
  onChange: (value: TimelineValue | null) => void
  readOnly?: boolean
}

function formatShort(iso?: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

function formatRange(value?: TimelineValue | null): string {
  const from = formatShort(value?.from)
  const to = formatShort(value?.to)
  if (from && to) return `${from} – ${to}`
  if (from) return from
  if (to) return to
  return ''
}

function dayStart(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

interface ProgressInfo {
  pct: number
  totalDays: number
  elapsedDays: number
  remainingDays: number
  status: 'upcoming' | 'active' | 'past'
}

function computeProgress(value?: TimelineValue | null): ProgressInfo | null {
  const from = value?.from ? new Date(value.from) : null
  const to = value?.to ? new Date(value.to) : null
  if (!from || !to || isNaN(from.getTime()) || isNaN(to.getTime())) return null
  const fromMs = dayStart(from)
  const toMs = dayStart(to)
  const todayMs = dayStart(new Date())
  const totalMs = Math.max(toMs - fromMs, 86400000)
  const totalDays = Math.max(1, Math.round((toMs - fromMs) / 86400000) + 1)
  let status: ProgressInfo['status'] = 'active'
  let pct = 0
  if (todayMs < fromMs) { status = 'upcoming'; pct = 0 }
  else if (todayMs > toMs) { status = 'past'; pct = 100 }
  else { pct = Math.round(((todayMs - fromMs) / totalMs) * 100) }
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((todayMs - fromMs) / 86400000) + (status === 'past' ? 1 : (status === 'active' ? 1 : 0))))
  const remainingDays = Math.max(0, totalDays - elapsedDays)
  return { pct, totalDays, elapsedDays, remainingDays, status }
}

export default function TimelineCell({ value, onChange, readOnly }: TimelineCellProps) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(value?.from ?? '')
  const [to, setTo] = useState(value?.to ?? '')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFrom(value?.from ?? '')
    setTo(value?.to ?? '')
  }, [value?.from, value?.to])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) commit()
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, from, to])

  const commit = () => {
    setOpen(false)
    const next: TimelineValue | null = from || to ? { from: from || null, to: to || null } : null
    const same = (next?.from ?? null) === (value?.from ?? null) && (next?.to ?? null) === (value?.to ?? null)
    if (!same) onChange(next)
  }

  const clear = () => {
    setFrom(''); setTo('')
    onChange(null)
    setOpen(false)
  }

  const label = formatRange(value)
  const progress = computeProgress(value)

  const statusColor = progress?.status === 'past' ? '#00c875' : progress?.status === 'upcoming' ? '#8e94b8' : '#579bfc'
  const tooltip = progress
    ? `${progress.totalDays} día${progress.totalDays === 1 ? '' : 's'} · ${progress.elapsedDays} transcurrido${progress.elapsedDays === 1 ? '' : 's'} · ${progress.remainingDays} restante${progress.remainingDays === 1 ? '' : 's'}`
    : label

  return (
    <div ref={ref} className="relative w-full h-full">
      <button
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        title={tooltip}
        className="w-full h-full flex items-center justify-center px-2 hover:bg-surface-hover"
      >
        {progress ? (
          <div
            className="relative w-full h-6 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-semibold truncate"
            style={{ backgroundColor: `${statusColor}33`, color: 'var(--text-primary)' }}
          >
            <div
              className="absolute inset-y-0 left-0"
              style={{ width: `${progress.pct}%`, backgroundColor: `${statusColor}66` }}
            />
            <span className="relative px-2 truncate">{label}</span>
          </div>
        ) : (
          <span className="text-xs text-text-primary truncate">
            {label || <span className="text-text-muted">—</span>}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-64 bg-surface-raised border border-border rounded-md shadow-card p-3 space-y-2">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Desde
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full h-8 px-2 text-xs bg-surface border border-border rounded outline-none text-text-primary focus:border-accent"
            />
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
            Hasta
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full h-8 px-2 text-xs bg-surface border border-border rounded outline-none text-text-primary focus:border-accent"
            />
          </label>
          <div className="flex justify-between pt-1">
            <button
              onClick={clear}
              className="text-xs text-text-muted hover:text-danger"
            >Clear</button>
            <button
              onClick={commit}
              className="text-xs px-3 py-1 bg-accent text-text-on-accent rounded hover:bg-accent-hover"
            >Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
