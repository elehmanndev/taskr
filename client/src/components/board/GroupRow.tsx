import { useState } from 'react'
import type { Column, Group } from '../../lib/types'
import ItemRow from './ItemRow'
import ColumnHeader, { type SortState } from './ColumnHeader'
import { useBoardStore } from '../../stores/boardStore'

interface GroupRowProps {
  group: Group
  columns: Column[]
  colWidths: number[]
  nameWidth: number
  totalWidth: number
  sort: SortState | null
  onToggleSort: (columnId: string) => void
}

export default function GroupRow({ group, columns, colWidths, nameWidth, totalWidth, sort, onToggleSort }: GroupRowProps) {
  const { createItem, patchGroup } = useBoardStore()
  const [newItemName, setNewItemName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(group.name)

  const toggleCollapse = () => {
    patchGroup(group.id, { collapsed: !group.collapsed }).catch(() => {})
  }

  const commitName = () => {
    setEditingName(false)
    if (nameDraft.trim() && nameDraft !== group.name) {
      patchGroup(group.id, { name: nameDraft.trim() }).catch(() => setNameDraft(group.name))
    } else {
      setNameDraft(group.name)
    }
  }

  const addItem = async () => {
    if (!newItemName.trim() || creating) return
    setCreating(true)
    try {
      await createItem(group.id, newItemName.trim())
      setNewItemName('')
    } finally {
      setCreating(false)
    }
  }

  const color = group.color || '#579bfc'

  return (
    <div style={{ minWidth: totalWidth }}>
      {/* Group name bar */}
      <div className="flex items-center gap-2 h-9 pl-1 mb-1">
        <button
          onClick={toggleCollapse}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-hover"
          title={group.collapsed ? 'Expand' : 'Collapse'}
          style={{ color }}
        >
          <span className={`inline-block transition-transform ${group.collapsed ? '' : 'rotate-90'}`}>▶</span>
        </button>
        {editingName ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') { setNameDraft(group.name); setEditingName(false) }
            }}
            className="font-semibold text-base bg-surface border border-border rounded px-2 py-0.5 outline-none"
            style={{ color }}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="font-semibold text-base"
            style={{ color }}
          >
            {group.name}
          </button>
        )}
        <span className="text-xs text-text-secondary font-normal">
          {group.items.length} item{group.items.length === 1 ? '' : 's'}
        </span>
      </div>

      {!group.collapsed && (
        <div
          className="relative rounded-lg border border-border bg-surface shadow-card"
          style={{ minWidth: totalWidth }}
        >
          {/* Colored left bar — spans the items region only, so it doesn't clash with the header's rounded top-left or the add-item row's rounded bottom-left */}
          <div
            className="absolute left-0 w-1 z-10"
            style={{ backgroundColor: color, top: 40, bottom: 40 }}
          />

          {/* Sticky column header — pinned to top of the group card while scrolling */}
          <div className="flex sticky top-0 z-20 bg-surface-sunken border-b border-border rounded-t-lg overflow-hidden">
            <div
              className="shrink-0 h-10 border-r border-border bg-surface-sunken flex items-center px-4 text-[11px] font-semibold text-text-primary uppercase tracking-wider"
              style={{ width: nameWidth }}
            >
              Item
            </div>
            {columns.map((col, i) => (
              <ColumnHeader
                key={col.id}
                column={col}
                width={colWidths[i]}
                sort={sort}
                onToggleSort={onToggleSort}
              />
            ))}
          </div>

          {group.items.map((item, idx) => (
            <ItemRow
              key={item.id}
              item={item}
              columns={columns}
              colWidths={colWidths}
              nameWidth={nameWidth}
              isLast={idx === group.items.length - 1 && group.items.length > 0}
            />
          ))}

          {/* Add item row */}
          <div className="flex border-t border-border hover:bg-surface-hover/40 rounded-b-lg overflow-hidden" style={{ minWidth: totalWidth }}>
            <div className="shrink-0 flex items-center pl-3" style={{ width: nameWidth }}>
              <input
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
                placeholder="+ Add item"
                disabled={creating}
                className="flex-1 h-10 px-2 text-sm outline-none bg-transparent text-text-primary placeholder:text-text-muted"
              />
            </div>
            {columns.map((col, i) => (
              <div key={col.id} className="shrink-0 h-10 border-l border-border" style={{ width: colWidths[i] }} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
