import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colorHex } from './colors'
import type { StatusLabel } from '../../lib/types'

interface StatusPillProps {
  value?: number | null
  labels: StatusLabel[]
  onChange: (id: number | null) => void
  readOnly?: boolean
}

function idealTextColor(hex: string): string {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return '#fff'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const L = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return L > 0.62 ? '#1f2340' : '#fff'
}

export default function StatusPill({ value, labels, onChange, readOnly }: StatusPillProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const r = btnRef.current.getBoundingClientRect()
    setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 192) })
  }, [open])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return
      setOpen(false)
    }
    const onScroll = () => setOpen(false)
    window.addEventListener('mousedown', onClick)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const selected = labels.find((l) => l.id === value)
  const bg = selected ? colorHex(selected.color) : 'transparent'
  const fg = selected ? idealTextColor(bg) : 'var(--text-muted)'

  return (
    <div className="relative w-full h-full">
      <button
        ref={btnRef}
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-full flex items-center justify-center text-[11px] font-bold uppercase tracking-wide truncate transition-opacity hover:opacity-90"
        style={{ backgroundColor: bg, color: fg }}
      >
        {selected?.label ?? ''}
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] bg-surface-raised border border-border rounded-md shadow-card py-1 p-1"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          {labels.map((l) => {
            const hex = colorHex(l.color)
            return (
              <button
                key={l.id}
                onClick={() => { onChange(l.id); setOpen(false) }}
                className="w-full text-left px-2 py-1.5 text-xs font-bold uppercase tracking-wide rounded mb-0.5 hover:opacity-90"
                style={{ backgroundColor: hex, color: idealTextColor(hex) }}
              >
                {l.label}
              </button>
            )
          })}
          {selected && (
            <button
              onClick={() => { onChange(null); setOpen(false) }}
              className="w-full text-left px-2 py-1.5 text-xs text-text-muted hover:bg-surface-hover border-t border-border mt-1 rounded-none"
            >
              Clear
            </button>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
