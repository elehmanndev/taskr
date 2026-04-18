import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useBoardStore } from '../stores/boardStore'
import { joinBoard, leaveBoard, onEvent } from '../lib/socket'
import BoardView from '../components/board/BoardView'
import type { Group, Item } from '../lib/types'

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>()
  const {
    board, loading, error,
    loadBoard, clearBoard,
    upsertItem, removeItem, reorderItems,
    addGroup, updateGroup, removeGroup,
  } = useBoardStore()

  useEffect(() => {
    if (!boardId) return
    loadBoard(boardId)
    return () => { clearBoard() }
  }, [boardId, loadBoard, clearBoard])

  useEffect(() => {
    if (!boardId) return
    joinBoard(boardId)

    const offs = [
      onEvent<Item>('item:created', (item) => upsertItem(item)),
      onEvent<Item>('item:updated', (item) => upsertItem(item)),
      onEvent<{ itemId: string }>('item:deleted', ({ itemId }) => removeItem(itemId)),
      onEvent<{ updates: Array<{ id: string; groupId: string; position: number }> }>(
        'items:reordered', ({ updates }) => reorderItems(updates)
      ),
      onEvent<Group>('group:created', (g) => addGroup({ ...g, items: (g as any).items ?? [] })),
      onEvent<Group>('group:updated', (g) => updateGroup(g)),
      onEvent<{ groupId: string }>('group:deleted', ({ groupId }) => removeGroup(groupId)),
    ]

    return () => {
      offs.forEach((off) => off())
      leaveBoard(boardId)
    }
  }, [boardId, upsertItem, removeItem, reorderItems, addGroup, updateGroup, removeGroup])

  if (loading && !board) return <div className="p-8 text-text-secondary">Loading board…</div>
  if (error) return <div className="p-8 text-danger">{error}</div>
  if (!board) return null

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-4 pb-2 border-b border-border bg-surface shrink-0">
        <h1 className="text-xl font-bold">{board.name}</h1>
        {board.description && <p className="text-sm text-text-secondary mt-0.5">{board.description}</p>}
      </div>
      <div className="flex-1 min-h-0">
        <BoardView board={board} />
      </div>
    </div>
  )
}
