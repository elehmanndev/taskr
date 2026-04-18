import { useEffect, useRef, useState } from 'react'

interface TextCellProps {
  value?: string | null
  onChange: (value: string) => void
  readOnly?: boolean
  placeholder?: string
  align?: 'left' | 'center' | 'right'
  numeric?: boolean
}

export default function TextCell({
  value, onChange, readOnly, placeholder = '', align = 'left', numeric,
}: TextCellProps) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocal(value ?? '') }, [value])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commit = () => {
    setEditing(false)
    const next = local
    if (next !== (value ?? '')) onChange(next)
  }

  const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={numeric ? 'number' : 'text'}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setLocal(value ?? ''); setEditing(false) }
        }}
        className={`w-full h-full px-2 text-xs bg-surface outline-none ${alignClass}`}
      />
    )
  }

  return (
    <button
      disabled={readOnly}
      onClick={() => setEditing(true)}
      className={`w-full h-full text-xs text-text-primary px-2 hover:bg-surface-hover truncate ${alignClass}`}
    >
      {value || <span className="text-text-muted">{placeholder || '—'}</span>}
    </button>
  )
}
