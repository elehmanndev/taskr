import { useEffect, useRef, useState } from 'react'

interface EmailCellProps {
  value?: string | null
  onChange: (value: string) => void
  readOnly?: boolean
}

export default function EmailCell({ value, onChange, readOnly }: EmailCellProps) {
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
        type="email"
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
      <div className="w-full h-full flex items-center px-2 gap-1">
        <a
          href={`mailto:${value}`}
          className="flex-1 truncate text-xs text-accent hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {value}
        </a>
        {!readOnly && (
          <button
            onClick={() => setEditing(true)}
            className="text-text-muted hover:text-text-secondary text-xs opacity-0 hover:opacity-100 group-hover:opacity-100"
            title="Edit"
          >✎</button>
        )}
      </div>
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
