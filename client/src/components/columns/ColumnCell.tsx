import type { Column, Item } from '../../lib/types'
import StatusPill from './StatusPill'
import PeoplePicker from './PeoplePicker'
import DateCell from './DateCell'
import TextCell from './TextCell'
import CheckboxCell from './CheckboxCell'
import EmailCell from './EmailCell'
import PhoneCell from './PhoneCell'
import LinkCell from './LinkCell'
import FileCell from './FileCell'
import TimelineCell from './TimelineCell'

interface ColumnCellProps {
  column: Column
  item: Item
  onChange: (columnId: string, value: any) => void
  groupColor?: string
}

export default function ColumnCell({ column, item, onChange, groupColor }: ColumnCellProps) {
  const value = item.columnValues?.[column.id]

  switch (column.type) {
    case 'STATUS': {
      const labels = column.settings?.labels ?? []
      return (
        <StatusPill
          value={value}
          labels={labels}
          onChange={(id) => onChange(column.id, id)}
        />
      )
    }
    case 'PEOPLE':
      return <PeoplePicker assignees={item.assignees} />

    case 'DATE':
      return <DateCell value={value} onChange={(v) => onChange(column.id, v)} />

    case 'CHECKBOX':
      return <CheckboxCell value={value} onChange={(v) => onChange(column.id, v)} />

    case 'NUMBERS':
      return (
        <TextCell
          value={value != null ? String(value) : ''}
          onChange={(v) => onChange(column.id, v === '' ? null : Number(v))}
          align="center"
          numeric
        />
      )

    case 'TEXT':
    case 'LONG_TEXT':
    case 'URL':
      return (
        <TextCell
          value={value ?? ''}
          onChange={(v) => onChange(column.id, v)}
        />
      )

    case 'EMAIL':
      return <EmailCell value={value ?? ''} onChange={(v) => onChange(column.id, v)} />

    case 'PHONE':
      return <PhoneCell value={value ?? ''} onChange={(v) => onChange(column.id, v)} />

    case 'LINK':
      return <LinkCell value={value} onChange={(v) => onChange(column.id, v)} />

    case 'FILE':
      return <FileCell value={value} onChange={(v) => onChange(column.id, v)} />

    case 'TIMELINE':
      return <TimelineCell value={value} onChange={(v) => onChange(column.id, v)} groupColor={groupColor} />

    case 'RATING': {
      const rating = Number(value ?? 0)
      return (
        <div className="w-full h-full flex items-center justify-center text-xs">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onChange(column.id, n === rating ? 0 : n)}
              className={n <= rating ? 'text-amber-400' : 'text-text-muted'}
            >★</button>
          ))}
        </div>
      )
    }

    case 'PROGRESS': {
      const pct = Math.max(0, Math.min(100, Number(value ?? 0)))
      return (
        <div className="w-full h-full flex items-center px-2 gap-2">
          <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-text-secondary w-8 text-right">{pct}%</span>
        </div>
      )
    }

    case 'DROPDOWN':
    case 'TAGS':
      return (
        <div className="w-full h-full text-xs text-text-primary px-2 flex items-center truncate">
          {Array.isArray(value) ? value.join(', ') : value || <span className="text-text-muted">—</span>}
        </div>
      )

    case 'CREATION_LOG':
      return (
        <div className="w-full h-full text-xs text-text-secondary px-2 flex items-center">
          {new Date(item.createdAt).toLocaleDateString()}
        </div>
      )

    case 'LAST_UPDATED':
      return (
        <div className="w-full h-full text-xs text-text-secondary px-2 flex items-center">
          {new Date(item.updatedAt).toLocaleDateString()}
        </div>
      )

    default:
      return (
        <div className="w-full h-full text-xs text-text-muted px-2 flex items-center italic">
          {value != null ? String(value) : '—'}
        </div>
      )
  }
}
