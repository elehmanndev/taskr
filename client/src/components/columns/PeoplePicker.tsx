import ProfilePopover from '../profile/ProfilePopover'
import type { ItemAssignee } from '../../lib/types'

interface PeoplePickerProps {
  assignees: ItemAssignee[]
}

const MAX_VISIBLE = 2

export default function PeoplePicker({ assignees }: PeoplePickerProps) {
  if (!assignees || assignees.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-text-muted">
        <div className="w-6 h-6 rounded-full border-2 border-dashed border-border-strong" />
      </div>
    )
  }
  const visible = assignees.slice(0, MAX_VISIBLE)
  const overflow = assignees.length - visible.length
  const overflowTitle = overflow > 0
    ? assignees.slice(MAX_VISIBLE).map((a) => a.user.name).join(', ')
    : undefined

  return (
    <div className="w-full h-full flex items-center justify-center gap-0.5 px-1">
      {visible.map((a) => (
        <ProfilePopover
          key={a.id}
          userId={a.userId}
          name={a.user.name}
          avatarUrl={a.user.avatarUrl}
          size="sm"
        />
      ))}
      {overflow > 0 && (
        <span
          title={overflowTitle}
          className="w-6 h-6 rounded-full bg-surface-sunken border border-border-strong flex items-center justify-center text-[10px] font-semibold text-text-secondary"
        >
          +{overflow}
        </span>
      )}
    </div>
  )
}
