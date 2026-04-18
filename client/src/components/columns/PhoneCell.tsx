import { useEffect, useRef, useState } from 'react'

interface PhoneCellProps {
  value?: string | null
  onChange: (value: string) => void
  readOnly?: boolean
}

export default function PhoneCell({ value, onChange, readOnly }: PhoneCellProps) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setLocal(value ?? '') }, [value])
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select() } }, [editing])

  const commit = () => {
    setEditing(false)
    if (local !== (value ?? '')) onChange(local.trim())
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="tel"
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

  if (value) {
    return (
      <a
        href={`tel:${value.replace(/\s+/g, '')}`}
        className="w-full h-full flex items-center px-2 text-xs text-accent hover:underline truncate"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.preventDefault(); setEditing(true) }}
      >
        {value}
      </a>
    )
  }

  return (
    <button
      disabled={readOnly}
      onClick={() => setEditing(true)}
      className="w-full h-full text-xs text-text-muted px-2 text-left hover:bg-surface-hover"
    >—</button>
  )
}
