import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { darkenForContrast } from './colors'

export interface TimelineValue {
  from?: string | null
  to?: string | null
}

interface TimelineCellProps {
  value?: TimelineValue | null
  onChange: (value: TimelineValue | null) => void
  readOnly?: boolean
  groupColor?: string
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

export default function TimelineCell({ value, onChange, readOnly, groupColor }: TimelineCellProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [from, setFrom] = useState(value?.from ?? '')
  const [to, setTo] = useState(value?.to ?? '')
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFrom(value?.from ?? '')
    setTo(value?.to ?? '')
  }, [value?.from, value?.to])

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || popRef.current?.contains(t)) return
      commit()
    }
    const onScroll = () => commit()
    window.addEventListener('mousedown', onClick)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('scroll', onScroll, true)
    }
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

  // Bar color: group color if available, else fall back to status-derived color.
  const fallbackStatusColor =
    progress?.status === 'past' ? '#00c875' :
    progress?.status === 'upcoming' ? '#8e94b8' :
    '#579bfc'
  const barColor = groupColor || fallbackStatusColor

  const tooltip = progress
    ? `${progress.totalDays} día${progress.totalDays === 1 ? '' : 's'} · ${progress.elapsedDays} transcurrido${progress.elapsedDays === 1 ? '' : 's'} · ${progress.remainingDays} restante${progress.remainingDays === 1 ? '' : 's'}`
    : label

  return (
    <div className="relative w-full h-full">
      <button
        ref={btnRef}
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        title={tooltip}
        className="w-full h-full flex items-center justify-center px-2 hover:bg-surface-hover"
      >
        {progress ? (
          progress.status === 'upcoming' ? (
            // Not started — outlined pill so it visibly differs from in-progress.
            <div
              className="relative min-w-[75%] max-w-full h-6 rounded-full flex items-center justify-center text-[11px] font-medium tracking-wide truncate"
              style={{
                border: `1.5px dashed ${darkenForContrast(barColor)}`,
                color: 'var(--text-secondary)',
              }}
            >
              <span className="px-2 truncate">{label}</span>
            </div>
          ) : (
            // Active or past — dark pill with bright progress fill from the left.
            <div
              className="relative min-w-[75%] max-w-full h-6 rounded-full overflow-hidden flex items-center justify-center text-[11px] font-medium tracking-wide truncate"
              style={{ backgroundColor: darkenForContrast(barColor), color: '#ffffff' }}
            >
              <div
                aria-hidden
                className="absolute inset-y-0 left-0"
                style={{ width: `${progress.pct}%`, backgroundColor: 'rgba(255,255,255,0.40)' }}
              />
              <span className="relative px-2 truncate">{label}</span>
            </div>
          )
        ) : (
          <span className="text-xs text-text-primary truncate">
            {label || <span className="text-text-muted">—</span>}
          </span>
        )}
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="fixed z-[100] w-72 rounded-2xl overflow-hidden p-4"
          style={{
            top: pos.top,
            left: pos.left,
            backgroundColor: 'var(--popover-bg)',
            border: '1px solid var(--popover-border)',
            boxShadow: 'var(--popover-shadow)',
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-3">
            Cronograma
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <label className="block">
              <span className="text-[11px] font-medium text-text-secondary block mb-1.5">Desde</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full h-9 px-2.5 text-sm rounded-lg outline-none transition focus:ring-2 focus:ring-accent/40"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-text-secondary block mb-1.5">Hasta</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full h-9 px-2.5 text-sm rounded-lg outline-none transition focus:ring-2 focus:ring-accent/40"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: 'var(--text-primary)',
                  colorScheme: 'dark',
                }}
              />
            </label>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={clear}
              className="text-xs text-text-muted hover:text-danger transition"
            >
              Vaciar
            </button>
            <button
              onClick={commit}
              className="text-xs px-3.5 py-1.5 rounded-lg font-medium text-white hover:opacity-95 transition"
              style={{ background: 'var(--brand-gradient)' }}
            >
              Aplicar
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
