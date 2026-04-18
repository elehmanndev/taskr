import { useEffect, useRef, useState } from 'react'
import { colorHex } from './colors'
import type { StatusLabel } from '../../lib/types'

interface StatusPillProps {
  value?: number | null
  labels: StatusLabel[]
  onChange: (id: number | null) => void
  readOnly?: boolean
}

export default function StatusPill({ value, labels, onChange, readOnly }: StatusPillProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [open])

  const selected = labels.find((l) => l.id === value)
  const bg = selected ? colorHex(selected.color) : 'transparent'

  return (
    <div className="relative w-full h-full" ref={ref}>
      <button
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-full flex items-center justify-center text-[11px] font-bold uppercase tracking-wide truncate transition-opacity hover:opacity-90"
        style={{ backgroundColor: bg, color: selected ? '#fff' : 'var(--text-muted)' }}
      >
        {selected?.label ?? ''}
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-48 bg-surface-raised border border-border rounded-md shadow-card py-1 p-1">
          {labels.map((l) => (
            <button
              key={l.id}
              onClick={() => { onChange(l.id); setOpen(false) }}
              className="w-full text-left px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-white rounded mb-0.5 hover:opacity-90"
              style={{ backgroundColor: colorHex(l.color) }}
            >
              {l.label}
            </button>
          ))}
          {selected && (
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left px-2 py-1.5 text-xs text-text-muted hover:bg-surface-hover border-t border-border mt-1 rounded-none"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
