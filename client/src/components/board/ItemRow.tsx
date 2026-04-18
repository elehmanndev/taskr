import { useState, useEffect, useRef } from 'react'
import type { Column, Item } from '../../lib/types'
import ColumnCell from '../columns/ColumnCell'
import { useBoardStore } from '../../stores/boardStore'

interface ItemRowProps {
  item: Item
  columns: Column[]
  nameWidth: number
  colWidth: number
}

const ROW_HEIGHT = 36

export default function ItemRow({ item, columns, nameWidth, colWidth }: ItemRowProps) {
  const { updateItem, deleteItem } = useBoardStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setName(item.name) }, [item.name])
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select() } }, [editing])

  const commitName = () => {
    setEditing(false)
    if (name.trim() && name !== item.name) {
      updateItem(item.id, { name: name.trim() }).catch(() => setName(item.name))
    } else {
      setName(item.name)
    }
  }

  const changeColumnValue = (columnId: string, value: any) => {
    const columnValues = { ...(item.columnValues ?? {}), [columnId]: value }
    updateItem(item.id, { columnValues }).catch(() => {})
  }

  return (
    <div
      className="flex border-b border-border last:border-b-0 bg-surface hover:bg-surface-hover group"
      style={{ height: ROW_HEIGHT }}
    >
      {/* Name cell */}
      <div
        className="shrink-0 flex items-center border-r border-border pl-3"
        style={{ width: nameWidth, height: ROW_HEIGHT }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') { setName(item.name); setEditing(false) }
            }}
            className="flex-1 h-full px-2 text-sm outline-none bg-surface text-text-primary"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 h-full px-2 text-sm text-left truncate text-text-primary"
          >
            {item.name || <span className="text-text-muted italic">Untitled</span>}
          </button>
        )}
        <button
          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-accent hover:bg-surface"
          title="Write an update"
        >
          <span className="text-base leading-none">💬</span>
        </button>
        {item._count?.comments ? (
          <span className="text-xs text-text-muted px-1" title={`${item._count.comments} comments`}>
            {item._count.comments}
          </span>
        ) : null}
        <button
          onClick={() => {
            if (confirm('Delete this item?')) deleteItem(item.id).catch(() => {})
          }}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center text-text-muted hover:text-danger"
          title="Delete item"
        >×</button>
      </div>

      {columns.map((col) => (
        <div
          key={col.id}
          className="shrink-0 border-r border-border flex items-stretch"
          style={{ width: colWidth, height: ROW_HEIGHT }}
        >
          <ColumnCell column={col} item={item} onChange={changeColumnValue} />
        </div>
      ))}
    </div>
  )
}
