import { useState, useEffect, useRef } from 'react'

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
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocal(value ?? '') }, [value])

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = local || null
    if (next !== (value ?? null)) onChange(next)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="date"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setLocal(value ?? ''); setEditing(false) }
        }}
        className="w-full h-full px-2 text-xs bg-surface outline-none"
      />
    )
  }

  return (
    <button
      disabled={readOnly}
      onClick={() => setEditing(true)}
      className="w-full h-full text-xs text-text-primary px-2 text-center hover:bg-surface-hover"
    >
      {formatDisplay(value) || <span className="text-text-muted">—</span>}
    </button>
  )
}
