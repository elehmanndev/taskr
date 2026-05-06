import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colorHex, darkenForContrast } from './colors'
import type { StatusLabel } from '../../lib/types'

interface StatusPillProps {
  value?: number | null
  labels: StatusLabel[]
  onChange: (id: number | null) => void
  readOnly?: boolean
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
  const rawHex = selected ? colorHex(selected.color) : null
  const pillBg = rawHex ? darkenForContrast(rawHex) : null

  return (
    <div className="relative w-full h-full flex items-center justify-center px-2">
      <button
        ref={btnRef}
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        className="min-w-[75%] max-w-full px-3.5 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wide truncate text-center transition hover:opacity-90"
        style={
          pillBg
            ? { backgroundColor: pillBg, color: '#ffffff' }
            : { color: 'var(--text-muted)' }
        }
      >
        {selected?.label ?? '—'}
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100] rounded-2xl p-3 space-y-2 overflow-hidden"
          style={{
            top: pos.top,
            left: pos.left,
            width: Math.max(pos.width, 200),
            backgroundColor: 'var(--popover-bg)',
            border: '1px solid var(--popover-border)',
            boxShadow: 'var(--popover-shadow)',
          }}
        >
          {labels.map((l) => {
            const hex = darkenForContrast(colorHex(l.color))
            return (
              <button
                key={l.id}
                onClick={() => { onChange(l.id); setOpen(false) }}
                className="w-full text-left px-4 py-2 text-[11px] font-medium uppercase tracking-wide rounded-full hover:opacity-90 text-white transition"
                style={{ backgroundColor: hex }}
              >
                {l.label}
              </button>
            )
          })}
          {selected && (
            <>
              <div className="h-px mx-2" style={{ backgroundColor: 'rgba(255,255,255,0.10)' }} />
              <button
                onClick={() => { onChange(null); setOpen(false) }}
                className="w-full text-left px-4 py-2 text-xs text-text-muted hover:text-text-primary hover:bg-white/5 rounded-lg transition"
              >
                Clear
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
