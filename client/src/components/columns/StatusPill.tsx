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
  const bg = selected ? colorHex(selected.color) : '#E5E7EB'
  const text = selected ? 'text-white' : 'text-gray-500'

  return (
    <div className="relative w-full h-full" ref={ref}>
      <button
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-full px-2 text-xs font-medium truncate ${text}`}
        style={{ backgroundColor: bg }}
      >
        {selected?.label ?? ''}
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg py-1">
          {labels.map((l) => (
            <button
              key={l.id}
              onClick={() => { onChange(l.id); setOpen(false) }}
              className="w-full text-left px-2 py-1.5 text-xs font-medium text-white mx-1 my-0.5 rounded hover:opacity-90"
              style={{ backgroundColor: colorHex(l.color), width: 'calc(100% - 0.5rem)' }}
            >
              {l.label}
            </button>
          ))}
          {selected && (
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left px-2 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100 mt-1"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
