import ProfilePopover from '../profile/ProfilePopover'
import type { ItemAssignee } from '../../lib/types'

interface PeoplePickerProps {
  assignees: ItemAssignee[]
}

export default function PeoplePicker({ assignees }: PeoplePickerProps) {
  if (!assignees || assignees.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-300">
        <div className="w-6 h-6 rounded-full border-2 border-dashed border-gray-300" />
      </div>
    )
  }
  return (
    <div className="w-full h-full flex items-center justify-center gap-0.5 px-1">
      {assignees.slice(0, 3).map((a) => (
        <ProfilePopover
          key={a.id}
          userId={a.userId}
          name={a.user.name}
          avatarUrl={a.user.avatarUrl}
          size="sm"
        />
      ))}
      {assignees.length > 3 && (
        <span className="text-xs text-gray-500 ml-1">+{assignees.length - 3}</span>
      )}
    </div>
  )
}
