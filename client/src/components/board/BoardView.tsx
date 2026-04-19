import { useMemo, useState } from 'react'
import type { Board, Column, Group, Item } from '../../lib/types'
import type { SortState } from './ColumnHeader'
import GroupRow from './GroupRow'
import { useBoardStore } from '../../stores/boardStore'
import { NAME_COL_WIDTH, UPDATES_COL_WIDTH, widthForColumn } from './columnWidth'

interface BoardViewProps {
  board: Board
}

function cellSortKey(item: Item, column: Column): string | number {
  const v = item.columnValues?.[column.id]
  if (v == null) return ''
  if (typeof v === 'number') return v
  if (typeof v === 'string') return v.toLowerCase()
  if (typeof v === 'object') {
    if ('from' in v && v.from) return v.from as string
    if ('id' in v && typeof v.id === 'number') return v.id
    if ('label' in v) return String(v.label).toLowerCase()
    if ('url' in v) return String(v.url).toLowerCase()
  }
  return JSON.stringify(v).toLowerCase()
}

function sortedItems(items: Item[], columns: Column[], sort: SortState | null): Item[] {
  if (!sort) return items
  const col = columns.find((c) => c.id === sort.columnId)
  if (!col) return items
  const sorted = [...items].sort((a, b) => {
    const va = cellSortKey(a, col)
    const vb = cellSortKey(b, col)
    if (va < vb) return sort.dir === 'asc' ? -1 : 1
    if (va > vb) return sort.dir === 'asc' ? 1 : -1
    return 0
  })
  return sorted
}

export default function BoardView({ board }: BoardViewProps) {
  const { createGroup } = useBoardStore()
  const [adding, setAdding] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [sort, setSort] = useState<SortState | null>(null)

  const colWidths = useMemo(() => board.columns.map(widthForColumn), [board.columns])
  const totalWidth = NAME_COL_WIDTH + UPDATES_COL_WIDTH + colWidths.reduce((a, b) => a + b, 0)

  const groupsSorted: Group[] = useMemo(() => {
    if (!sort) return board.groups
    return board.groups.map((g) => ({ ...g, items: sortedItems(g.items, board.columns, sort) }))
  }, [board.groups, board.columns, sort])

  const toggleSort = (columnId: string) => {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, dir: 'asc' }
      if (prev.dir === 'asc') return { columnId, dir: 'desc' }
      return null
    })
  }

  const addGroup = async () => {
    if (!newGroupName.trim()) return
    setAdding(true)
    try {
      await createGroup(newGroupName.trim())
      setNewGroupName('')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="p-6 overflow-auto h-full scrollbar-thin bg-app">
      <div style={{ minWidth: totalWidth }}>
        <div className="space-y-6">
          {groupsSorted.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              columns={board.columns}
              colWidths={colWidths}
              nameWidth={NAME_COL_WIDTH}
              totalWidth={totalWidth}
              sort={sort}
              onToggleSort={toggleSort}
            />
          ))}

          <div className="mt-2">
            <input
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGroup() }}
              placeholder="+ Add group"
              disabled={adding}
              className="text-sm px-3 py-2 border border-dashed border-border rounded-md bg-transparent text-text-secondary placeholder:text-text-muted outline-none focus:border-accent focus:bg-surface focus:text-text-primary"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
