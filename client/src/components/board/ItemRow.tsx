import { useState, useEffect, useRef } from 'react'
import type { Column, Item } from '../../lib/types'
import ColumnCell from '../columns/ColumnCell'
import { useBoardStore } from '../../stores/boardStore'

interface ItemRowProps {
  item: Item
  columns: Column[]
  groupColor: string
  nameWidth: number
  colWidth: number
}

export default function ItemRow({ item, columns, groupColor, nameWidth, colWidth }: ItemRowProps) {
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
    <div className="flex border-b border-gray-200 bg-white hover:bg-gray-50 group">
      {/* Name cell with colored group border */}
      <div
        className="shrink-0 flex items-center border-r border-gray-200 relative"
        style={{ width: nameWidth }}
      >
        <div className="w-1 h-full shrink-0" style={{ backgroundColor: groupColor }} />
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
            className="flex-1 h-full px-3 text-sm outline-none bg-white"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 h-full px-3 text-sm text-left truncate"
          >
            {item.name || <span className="text-gray-300 italic">Untitled</span>}
          </button>
        )}
        {item._count?.comments ? (
          <span className="text-xs text-gray-400 px-2" title={`${item._count.comments} comments`}>
            💬 {item._count.comments}
          </span>
        ) : null}
        <button
          onClick={() => {
            if (confirm('Delete this item?')) deleteItem(item.id).catch(() => {})
          }}
          className="opacity-0 group-hover:opacity-100 px-2 text-gray-400 hover:text-red-500 text-sm"
          title="Delete item"
        >×</button>
      </div>

      {columns.map((col) => (
        <div
          key={col.id}
          className="shrink-0 h-9 border-r border-gray-200 flex items-center"
          style={{ width: colWidth }}
        >
          <ColumnCell column={col} item={item} onChange={changeColumnValue} />
        </div>
      ))}
    </div>
  )
}
