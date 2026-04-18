import { useState } from 'react'
import type { Board } from '../../lib/types'
import ColumnHeader from './ColumnHeader'
import GroupRow from './GroupRow'
import { useBoardStore } from '../../stores/boardStore'

const NAME_COL_WIDTH = 320
const COL_WIDTH = 140

interface BoardViewProps {
  board: Board
}

export default function BoardView({ board }: BoardViewProps) {
  const { createGroup } = useBoardStore()
  const [adding, setAdding] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')

  const totalWidth = NAME_COL_WIDTH + board.columns.length * COL_WIDTH

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
    <div className="p-4 overflow-auto h-full scrollbar-thin">
      <div style={{ minWidth: totalWidth }}>
        {/* Column headers row */}
        <div className="flex sticky top-0 z-20 bg-gray-50 border-b border-gray-200">
          <div
            className="shrink-0 h-9 border-r border-gray-200 bg-gray-50 flex items-center px-3 text-xs font-semibold text-gray-600 uppercase tracking-wide"
            style={{ width: NAME_COL_WIDTH }}
          >
            Item
          </div>
          {board.columns.map((col) => (
            <ColumnHeader key={col.id} column={col} width={COL_WIDTH} />
          ))}
        </div>

        {/* Groups */}
        <div className="pt-4">
          {board.groups.map((group) => (
            <GroupRow
              key={group.id}
              group={group}
              columns={board.columns}
              nameWidth={NAME_COL_WIDTH}
              colWidth={COL_WIDTH}
              totalWidth={totalWidth}
            />
          ))}

          {/* Add group */}
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') addGroup() }}
                placeholder="+ Add group"
                disabled={adding}
                className="text-sm px-3 py-1.5 border border-dashed border-gray-300 rounded-md bg-transparent outline-none focus:border-indigo-500 focus:bg-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
