import type { Column } from '../../lib/types'

interface ColumnHeaderProps {
  column: Column
  width: number
}

export default function ColumnHeader({ column, width }: ColumnHeaderProps) {
  return (
    <div
      className="shrink-0 h-9 border-r border-gray-200 bg-white flex items-center px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide"
      style={{ width }}
      title={column.title}
    >
      <span className="truncate">{column.title}</span>
    </div>
  )
}
