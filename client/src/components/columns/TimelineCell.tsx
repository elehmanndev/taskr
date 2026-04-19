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

  return (
    <div ref={ref} className="relative w-full h-full">
      <button
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-full text-xs text-text-primary px-2 flex items-center justify-center hover:bg-surface-hover truncate"
      >
        {label || <span className="text-text-muted">—</span>}
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
