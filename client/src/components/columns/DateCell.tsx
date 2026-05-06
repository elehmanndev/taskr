import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface DateCellProps {
  value?: string | null
  onChange: (value: string | null) => void
  readOnly?: boolean
}

function formatDisplay(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')
}

export default function DateCell({ value, onChange, readOnly }: DateCellProps) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [draft, setDraft] = useState(value ?? '')
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setDraft(value ?? '') }, [value])

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
  }, [open, draft])

  const commit = () => {
    setOpen(false)
    const next = draft || null
    if (next !== (value ?? null)) onChange(next)
  }

  const clear = () => {
    setDraft('')
    onChange(null)
    setOpen(false)
  }

  return (
    <div className="relative w-full h-full">
      <button
        ref={btnRef}
        disabled={readOnly}
        onClick={() => setOpen((o) => !o)}
        className="w-full h-full text-xs text-text-primary px-2 text-center hover:bg-surface-hover"
      >
        {formatDisplay(value) || <span className="text-text-muted">—</span>}
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="fixed z-[100] w-60 rounded-2xl overflow-hidden p-4"
          style={{
            top: pos.top,
            left: pos.left,
            backgroundColor: 'var(--popover-bg)',
            border: '1px solid var(--popover-border)',
            boxShadow: 'var(--popover-shadow)',
          }}
        >
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted mb-3">
            Fecha
          </div>
          <input
            type="date"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') { setDraft(value ?? ''); setOpen(false) }
            }}
            className="w-full h-9 px-2.5 text-sm rounded-lg outline-none transition focus:ring-2 focus:ring-accent/40 mb-4"
            style={{
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              color: 'var(--text-primary)',
              colorScheme: 'dark',
            }}
          />
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
