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
          className={`relative w-8 h-8 flex items-center justify-center rounded-md transition hover:bg-surface-hover ${
            commentCount > 0 ? 'text-accent' : 'text-text-muted hover:text-accent'
          }`}
          title={commentCount ? `${commentCount} actualizaciones — clic para abrir` : 'Escribir una actualización'}
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-[26px] h-[26px]">
            <path
              d="M18.5 4.5h-13a2 2 0 00-2 2v9a2 2 0 002 2h2.5L7 20.5l4.5-3h7a2 2 0 002-2v-9a2 2 0 00-2-2z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {commentCount > 0 && (
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold leading-none pb-[5px]">
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
