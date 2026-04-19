import { useState, useEffect, useRef } from 'react'
import type { Column, Item } from '../../lib/types'
import ColumnCell from '../columns/ColumnCell'
import UpdateModal from '../item/UpdateModal'
import { useBoardStore } from '../../stores/boardStore'
import { UPDATES_COL_WIDTH } from './columnWidth'

interface ItemRowProps {
  item: Item
  columns: Column[]
  colWidths: number[]
  nameWidth: number
  isLast?: boolean
  groupColor?: string
}

const ROW_HEIGHT = 44

export default function ItemRow({ item, columns, colWidths, nameWidth, isLast, groupColor }: ItemRowProps) {
  const { updateItem, deleteItem } = useBoardStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(item.name)
  const [updatesOpen, setUpdatesOpen] = useState(false)
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

  const commentCount = item._count?.comments ?? 0

  return (
    <div
      className={`flex border-b border-border bg-surface hover:bg-surface-hover group ${isLast ? 'border-b-0' : ''}`}
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
          onClick={() => {
            if (confirm('Delete this item?')) deleteItem(item.id).catch(() => {})
          }}
          className="opacity-0 group-hover:opacity-100 w-7 h-7 mr-1 flex items-center justify-center text-text-muted hover:text-danger"
          title="Delete item"
        >×</button>
      </div>

      {/* Updates cell */}
      <div
        className="shrink-0 border-r border-border flex items-center justify-center"
        style={{ width: UPDATES_COL_WIDTH, height: ROW_HEIGHT }}
      >
        <button
          onClick={() => setUpdatesOpen(true)}
          className="relative w-7 h-7 flex items-center justify-center rounded-full text-text-muted hover:text-accent hover:bg-surface-hover"
          title={commentCount ? `${commentCount} actualizaciones — clic para añadir` : 'Escribir una actualización'}
        >
          <span className="text-base leading-none">💬</span>
          {commentCount > 0 && (
            <span
              className="absolute -top-0.5 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-[10px] font-semibold text-text-on-accent flex items-center justify-center"
            >
              {commentCount > 99 ? '99+' : commentCount}
            </span>
          )}
        </button>
      </div>

      {columns.map((col, i) => (
        <div
          key={col.id}
          className="shrink-0 border-r border-border flex items-stretch"
          style={{ width: colWidths[i], height: ROW_HEIGHT }}
        >
          <ColumnCell column={col} item={item} onChange={changeColumnValue} groupColor={groupColor} />
        </div>
      ))}

      <UpdateModal item={item} open={updatesOpen} onClose={() => setUpdatesOpen(false)} />
    </div>
  )
}
