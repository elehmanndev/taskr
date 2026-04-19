import { useState } from 'react'
import type { Column, Group } from '../../lib/types'
import ItemRow from './ItemRow'
import ColumnHeader, { type SortState } from './ColumnHeader'
import { useBoardStore } from '../../stores/boardStore'
import { UPDATES_COL_WIDTH } from './columnWidth'

interface GroupRowProps {
  group: Group
  columns: Column[]
  colWidths: number[]
  nameWidth: number
  totalWidth: number
  sort: SortState | null
  onToggleSort: (columnId: string) => void
}

const NAME_BAR_H = 40
const HEADER_H = 40
const ADD_ROW_H = 40
const COLLAPSED_H = 72
// Space between groups. Lives INSIDE the outer wrapper so the sticky nameBar
// stays pinned through it — prevents previous-group items bleeding into the
// next group's sticky header during scroll transitions.
const GROUP_GUTTER = 24

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

  const isArchived = /hist[oó]rico|archiv|no toc/i.test(group.name)
  const color = isArchived ? '#8e94b8' : (group.color || '#579bfc')
  const collapsed = !!group.collapsed
  const countLabel = `${group.items.length} Proyecto${group.items.length === 1 ? '' : 's'}`

  if (collapsed) {
    return (
      <div className="relative" style={{ minWidth: totalWidth, paddingBottom: GROUP_GUTTER }}>
        <div
          onClick={toggleCollapse}
          className={`relative overflow-hidden rounded-lg border border-border bg-surface shadow-card cursor-pointer hover:bg-surface-hover ${isArchived ? 'opacity-70' : ''}`}
          role="button"
          title="Expand group"
        >
          <div
            className="flex items-center gap-4 bg-surface rounded-lg pl-5 pr-6"
            style={{ height: COLLAPSED_H, borderLeft: `6px solid ${color}` }}
          >
            <span className="inline-block w-6 h-6 flex items-center justify-center shrink-0 text-lg" style={{ color }}>▶</span>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight" style={{ color }}>{group.name}</span>
              <span className="text-xs text-text-secondary font-normal mt-0.5">{countLabel}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative ${isArchived ? 'opacity-80' : ''}`}
      style={{ minWidth: totalWidth, paddingBottom: GROUP_GUTTER }}
    >
      {/* Name bar — sticky within outer wrapper (pb-24) so it stays pinned through
          the group gutter, covering any visual bleed into the next group. */}
      <div
        className="sticky top-0 z-30 flex items-center gap-2 bg-surface border border-border rounded-t-lg"
        style={{ height: NAME_BAR_H, paddingLeft: 14, borderLeft: `4px solid ${color}` }}
      >
        <button
          onClick={toggleCollapse}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-surface-hover shrink-0"
          title={collapsed ? 'Expand' : 'Collapse'}
          style={{ color }}
        >
          <span className="inline-block transition-transform rotate-90">▶</span>
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
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingName(true) }}
            className="font-semibold text-base"
            style={{ color }}
          >
            {group.name}
          </button>
        )}
        <span className="text-xs text-text-secondary font-normal">{countLabel}</span>
      </div>

      {/* Card body — continues visually from the name bar, holds items. */}
      <div className="relative bg-surface border border-t-0 border-border rounded-b-lg shadow-card">
        {/* Colored left bar spans items region only, so it doesn't clash with rounded corners */}
        <div
          className="absolute left-0 w-1 z-10"
          style={{ backgroundColor: color, top: HEADER_H, bottom: ADD_ROW_H }}
        />

        {/* Sticky column header — pinned below the name bar */}
        <div
          className="flex sticky z-20 bg-surface-sunken border-b border-border overflow-hidden"
          style={{ top: NAME_BAR_H }}
        >
          <div
            className="shrink-0 border-r border-border bg-surface-sunken flex items-center px-4 text-[11px] font-semibold text-text-primary uppercase tracking-wider"
            style={{ width: nameWidth, height: HEADER_H }}
          >
            Item
          </div>
          <div
            className="shrink-0 border-r border-border bg-surface-sunken flex items-center justify-center text-text-muted"
            style={{ width: UPDATES_COL_WIDTH, height: HEADER_H }}
            title="Updates"
          >
            <span className="text-sm">💬</span>
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
            groupColor={color}
          />
        ))}

        {/* Add item row */}
        <div className="flex border-t border-border hover:bg-surface-hover/40 rounded-b-lg overflow-hidden" style={{ minWidth: totalWidth }}>
          <div className="shrink-0 flex items-center pl-3" style={{ width: nameWidth }}>
            <input
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
              placeholder="+ Añadir proyecto"
              disabled={creating}
              className="flex-1 px-2 text-sm outline-none bg-transparent text-text-primary placeholder:text-text-muted"
              style={{ height: ADD_ROW_H }}
            />
          </div>
          <div className="shrink-0 border-l border-border" style={{ width: UPDATES_COL_WIDTH, height: ADD_ROW_H }} />
          {columns.map((col, i) => (
            <div key={col.id} className="shrink-0 border-l border-border" style={{ width: colWidths[i], height: ADD_ROW_H }} />
          ))}
        </div>
      </div>
    </div>
  )
}
