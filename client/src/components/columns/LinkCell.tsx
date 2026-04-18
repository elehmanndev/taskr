import { useEffect, useRef, useState } from 'react'

interface LinkValue {
  url?: string
  label?: string
}

interface LinkCellProps {
  value?: LinkValue | string | null
  onChange: (value: LinkValue | null) => void
  readOnly?: boolean
}

function normalize(v: LinkCellProps['value']): LinkValue {
  if (!v) return {}
  if (typeof v === 'string') return { url: v }
  return v
}

export default function LinkCell({ value, onChange, readOnly }: LinkCellProps) {
  const [editing, setEditing] = useState(false)
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const urlRef = useRef<HTMLInputElement>(null)

  const v = normalize(value)

  useEffect(() => {
    setUrl(v.url ?? '')
    setLabel(v.label ?? '')
  }, [value])

  useEffect(() => { if (editing) urlRef.current?.focus() }, [editing])

  const commit = () => {
    setEditing(false)
    const trimmedUrl = url.trim()
    const trimmedLabel = label.trim()
    if (!trimmedUrl) {
      if (v.url) onChange(null)
      return
    }
    if (trimmedUrl !== (v.url ?? '') || trimmedLabel !== (v.label ?? '')) {
      onChange({ url: trimmedUrl, label: trimmedLabel || undefined })
    }
  }

  if (editing) {
    return (
      <div className="w-full h-full flex gap-1 px-1 bg-white">
        <input
          ref={urlRef}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="https://…"
          className="flex-1 text-xs outline-none"
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          placeholder="label"
          className="w-20 text-xs outline-none border-l border-gray-200 pl-1"
        />
      </div>
    )
  }

  if (v.url) {
    return (
      <a
        href={v.url}
        target="_blank"
        rel="noreferrer"
        className="w-full h-full flex items-center px-2 text-xs text-indigo-600 hover:underline truncate"
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => { e.preventDefault(); setEditing(true) }}
      >
        {v.label || v.url}
      </a>
    )
  }

  return (
    <button
      disabled={readOnly}
      onClick={() => setEditing(true)}
      className="w-full h-full text-xs text-gray-300 px-2 text-left hover:bg-gray-50"
    >—</button>
  )
}
