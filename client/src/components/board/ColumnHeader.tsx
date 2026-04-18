import type { Column } from '../../lib/types'

export type SortDir = 'asc' | 'desc'
export interface SortState { columnId: string; dir: SortDir }

interface ColumnHeaderProps {
  column: Column
  width: number
  sort: SortState | null
  onToggleSort: (columnId: string) => void
}

export default function ColumnHeader({ column, width, sort, onToggleSort }: ColumnHeaderProps) {
  const active = sort?.columnId === column.id
  const arrow = active ? (sort!.dir === 'asc' ? '↑' : '↓') : '↕'

  return (
    <button
      type="button"
      onClick={() => onToggleSort(column.id)}
      className="shrink-0 h-10 border-r border-border bg-surface-sunken flex items-center justify-between px-3 text-[11px] font-semibold text-text-secondary uppercase tracking-wider hover:bg-surface-hover group"
      style={{ width }}
      title={column.title}
    >
      <span className="truncate">{column.title}</span>
      <span
        className={`ml-2 text-xs transition-opacity ${active ? 'opacity-100 text-accent' : 'opacity-40 group-hover:opacity-80'}`}
      >
        {arrow}
      </span>
    </button>
  )
}
