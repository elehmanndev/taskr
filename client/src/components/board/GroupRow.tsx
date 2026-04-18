import { useState } from 'react'
import type { Column, Group } from '../../lib/types'
import ItemRow from './ItemRow'
import { useBoardStore } from '../../stores/boardStore'

interface GroupRowProps {
  group: Group
  columns: Column[]
  nameWidth: number
  colWidth: number
  totalWidth: number
}

export default function GroupRow({ group, columns, nameWidth, colWidth, totalWidth }: GroupRowProps) {
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

  return (
    <div className="mb-6">
      {/* Group header bar */}
      <div
        className="flex items-center gap-2 h-9 sticky top-9 z-10 pl-1"
        style={{ minWidth: totalWidth }}
      >
        <div className="flex items-center gap-2" style={{ color: group.color }}>
          <button
            onClick={toggleCollapse}
            className="w-5 h-5 flex items-center justify-center hover:bg-gray-100 rounded"
            title={group.collapsed ? 'Expand' : 'Collapse'}
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
              className="font-semibold text-sm bg-white border border-gray-300 rounded px-1 outline-none"
              style={{ color: group.color }}
            />
          ) : (
            <button onClick={() => setEditingName(true)} className="font-semibold text-sm">
              {group.name}
            </button>
          )}
          <span className="text-xs text-gray-500 font-normal">{group.items.length} item{group.items.length === 1 ? '' : 's'}</span>
        </div>
      </div>

      {!group.collapsed && (
        <>
          <div className="rounded-md overflow-hidden border border-gray-200 bg-white" style={{ minWidth: totalWidth }}>
            {group.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                columns={columns}
                groupColor={group.color}
                nameWidth={nameWidth}
                colWidth={colWidth}
              />
            ))}

            {/* Add item row */}
            <div className="flex border-t border-gray-200" style={{ minWidth: totalWidth }}>
              <div className="shrink-0 flex items-center" style={{ width: nameWidth }}>
                <div className="w-1 h-9 shrink-0" style={{ backgroundColor: group.color }} />
                <input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
                  placeholder="+ Add item"
                  disabled={creating}
                  className="flex-1 h-9 px-3 text-sm outline-none placeholder-gray-400 bg-transparent"
                />
              </div>
              {columns.map((col) => (
                <div key={col.id} className="shrink-0 h-9 border-l border-gray-200" style={{ width: colWidth }} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
