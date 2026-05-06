import { useEffect, useRef, useState } from 'react'
import type { Column, Group } from '../../lib/types'
import ItemRow from './ItemRow'
import ColumnHeader, { type SortState } from './ColumnHeader'
import { useBoardStore } from '../../stores/boardStore'
import { UPDATES_COL_WIDTH } from './columnWidth'
import { darkenForContrast } from '../columns/colors'

interface GroupRowProps {
  group: Group
  columns: Column[]
  colWidths: number[]
  nameWidth: number
  totalWidth: number
  sort: SortState | null
  onToggleSort: (columnId: string) => void
}

const NAME_BAR_H = 64
const HEADER_H = 40
const ADD_ROW_H = 44
const COLLAPSED_H = 64
const ITEMS_MAX_H = '60vh'

function ChevronIcon({ open, color }: { open: boolean; color: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      width="16"
      height="16"
      className="transition-transform duration-150"
      style={{ color, transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
    >
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MessageIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M18.5 4.5h-13a2 2 0 00-2 2v9a2 2 0 002 2h2.5L7 20.5l4.5-3h7a2 2 0 002-2v-9a2 2 0 00-2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Convert a hex color (#RRGGBB) to rgba with the given alpha.
 * Falls back to the original color if parsing fails.
 */
function tint(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// darken helper lives in components/columns/colors.ts so StatusPill and GroupRow share it

export default function GroupRow({ group, columns, colWidths, nameWidth, totalWidth, sort, onToggleSort }: GroupRowProps) {
  const { createItem, patchGroup, loadGroupItems } = useBoardStore()
  const itemsLoading = useBoardStore((s) => !!s.loadingGroupItems[group.id])
  const [newItemName, setNewItemName] = useState('')
  const [creating, setCreating] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(group.name)

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!group.collapsed && group.items === undefined) {
      loadGroupItems(group.id)
    }
  }, [group.collapsed, group.items, group.id, loadGroupItems])

  useEffect(() => {
    if (group.collapsed) return
    if (group.nextCursor == null) return
    const node = sentinelRef.current
    const root = scrollRef.current
    if (!node || !root) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadGroupItems(group.id)
      },
      { root, rootMargin: '300px' }
    )
    obs.observe(node)
    return () => obs.disconnect()
  }, [group.collapsed, group.nextCursor, group.id, loadGroupItems])

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
  const headerColor = darkenForContrast(color)
  const collapsed = !!group.collapsed
  const itemCount = group._count?.items ?? group.items?.length ?? 0
  const countLabel = `${itemCount} Tarea${itemCount === 1 ? '' : 's'}`
  const items = group.items ?? []

  if (collapsed) {
    return (
      <div className="relative mb-5 group/card">
        {/* Soft brand-color glow on hover */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-2xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 blur-xl pointer-events-none -z-10"
          style={{ background: tint(color, 0.30) }}
        />
        <button
          onClick={toggleCollapse}
          className={`relative w-full text-left rounded-2xl cursor-pointer transition-all duration-200 hover:-translate-y-0.5 overflow-hidden ${isArchived ? 'opacity-60' : ''}`}
          title="Expand group"
          style={{
            backgroundColor: 'var(--surface)',
            border: '1px solid var(--border-soft)',
            boxShadow: `var(--shadow-card), inset 0 1px 0 0 rgba(255,255,255,0.04)`,
          }}
        >
          <div className="flex items-center gap-4 pl-3 pr-5" style={{ height: COLLAPSED_H }}>
            {/* Small colored icon block carrying the brand color + chevron */}
            <div
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${headerColor} 0%, ${tint(headerColor, 0.85)} 100%)`,
                boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.20)`,
              }}
            >
              <ChevronIcon open={false} color="#ffffff" />
            </div>
            <span className="font-medium text-[17px] tracking-tight text-text-primary">
              {group.name}
            </span>
            <span
              className="text-[12px] font-medium px-2.5 py-0.5 rounded-full"
              style={{
                color: '#ffffff',
                backgroundColor: headerColor,
              }}
            >
              {countLabel}
            </span>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div
      className={`relative mb-4 rounded-2xl overflow-hidden ${isArchived ? 'opacity-80' : ''}`}
      style={{
        minWidth: totalWidth,
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border-soft)',
        boxShadow: `var(--shadow-card), inset 0 1px 0 0 ${tint('#ffffff', 0.04)}`,
      }}
    >
      {/* Name bar — same chrome as the collapsed card: neutral surface, colored
          icon block on the left, name in primary text, brand-color pill. */}
      <div
        className="flex items-center gap-4 pl-3 pr-5"
        style={{ height: NAME_BAR_H, backgroundColor: 'var(--surface)' }}
      >
        <button
          onClick={toggleCollapse}
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center hover:opacity-90 transition"
          style={{
            background: `linear-gradient(135deg, ${headerColor} 0%, ${tint(headerColor, 0.85)} 100%)`,
            boxShadow: `inset 0 1px 0 0 rgba(255,255,255,0.20)`,
          }}
          title="Collapse"
        >
          <ChevronIcon open color="#ffffff" />
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
            className="font-medium text-[17px] tracking-tight text-text-primary bg-surface-sunken border border-border rounded px-2 py-0.5 outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingName(true) }}
            className="font-medium text-[17px] tracking-tight text-text-primary hover:underline decoration-dotted underline-offset-4"
          >
            {group.name}
          </button>
        )}
        <span
          className="text-[12px] font-medium px-2.5 py-0.5 rounded-full text-white"
          style={{ backgroundColor: headerColor }}
        >
          {countLabel}
        </span>
      </div>

      {/* Scrollable items area */}
      <div
        ref={scrollRef}
        className="overflow-auto scrollbar-thin"
        style={{ maxHeight: ITEMS_MAX_H }}
      >
        {/* Sticky column header */}
        <div
          className="flex sticky top-0 z-20 bg-surface-sunken border-y border-border overflow-hidden"
          style={{ minWidth: totalWidth }}
        >
          <div
            className="shrink-0 border-r border-border flex items-center px-4 text-[11px] font-semibold text-text-secondary uppercase tracking-[0.12em]"
            style={{ width: nameWidth, height: HEADER_H }}
          >
            Item
          </div>
          <div
            className="shrink-0 border-r border-border flex items-center justify-center text-text-muted"
            style={{ width: UPDATES_COL_WIDTH, height: HEADER_H }}
            title="Updates"
          >
            <MessageIcon className="w-3.5 h-3.5" />
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

        {itemsLoading && items.length === 0 && (
          <div className="px-4 py-3 text-sm text-text-muted">
            Cargando tareas…
          </div>
        )}
        {items.map((item, idx) => (
          <ItemRow
            key={item.id}
            item={item}
            columns={columns}
            colWidths={colWidths}
            nameWidth={nameWidth}
            isLast={idx === items.length - 1 && items.length > 0}
            groupColor={color}
          />
        ))}
        {group.nextCursor != null && (
          <div ref={sentinelRef} className="px-4 py-2.5 text-[11px] text-text-muted text-center">
            {itemsLoading ? 'Cargando más…' : ''}
          </div>
        )}
      </div>

      {/* Add item row — anchored at bottom, outside the scroll */}
      <div
        className="flex border-t border-border overflow-hidden"
        style={{ minWidth: totalWidth, backgroundColor: 'var(--surface)' }}
      >
        <div className="shrink-0 flex items-center pl-3 gap-1.5 text-text-muted" style={{ width: nameWidth }}>
          <span className="text-base leading-none">+</span>
          <input
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addItem() }}
            placeholder="Añadir tarea"
            disabled={creating}
            className="flex-1 px-1 text-sm outline-none bg-transparent text-text-primary placeholder:text-text-muted"
            style={{ height: ADD_ROW_H }}
          />
        </div>
        <div className="shrink-0 border-l border-border" style={{ width: UPDATES_COL_WIDTH, height: ADD_ROW_H }} />
        {columns.map((col, i) => (
          <div key={col.id} className="shrink-0 border-l border-border" style={{ width: colWidths[i], height: ADD_ROW_H }} />
        ))}
      </div>
    </div>
  )
}
