import { create } from 'zustand'
import { api } from '../lib/api'
import type { Board, Group, Item, Column } from '../lib/types'

interface BoardState {
  board: Board | null
  loading: boolean
  /** groupIds that are currently fetching items */
  loadingGroupItems: Record<string, boolean>
  error: string | null

  loadBoard: (boardId: string) => Promise<void>
  loadGroupItems: (groupId: string) => Promise<void>
  clearBoard: () => void

  // Local mutations (optimistic + socket-driven)
  upsertItem: (item: Item) => void
  removeItem: (itemId: string) => void
  reorderItems: (updates: Array<{ id: string; groupId: string; position: number }>) => void

  addGroup: (group: Group) => void
  updateGroup: (group: Partial<Group> & { id: string }) => void
  removeGroup: (groupId: string) => void

  updateColumns: (columns: Column[]) => void

  // Async actions
  createItem: (groupId: string, name: string) => Promise<Item>
  updateItem: (itemId: string, patch: Partial<Item>) => Promise<Item>
  deleteItem: (itemId: string) => Promise<void>
  createGroup: (name: string, color?: string) => Promise<Group>
  patchGroup: (groupId: string, patch: Partial<Group>) => Promise<void>
}

export const useBoardStore = create<BoardState>((set, get) => ({
  board: null,
  loading: false,
  loadingGroupItems: {},
  error: null,

  loadBoard: async (boardId) => {
    set({ loading: true, error: null, loadingGroupItems: {} })
    try {
      const board = await api.get<Board>(`/api/boards/${boardId}`)
      set({ board, loading: false })
    } catch (err: any) {
      set({ error: err?.message ?? 'Failed to load board', loading: false })
    }
  },

  loadGroupItems: async (groupId) => {
    const board = get().board
    if (!board) return
    const group = board.groups.find((g) => g.id === groupId)
    if (!group) return
    if (group.nextCursor === null) return // already fully loaded
    if (get().loadingGroupItems[groupId]) return
    set((s) => ({ loadingGroupItems: { ...s.loadingGroupItems, [groupId]: true } }))
    try {
      const cursorParam = group.nextCursor ? `?cursor=${encodeURIComponent(group.nextCursor)}` : ''
      const { items, nextCursor } = await api.get<{ items: Item[]; nextCursor: string | null }>(
        `/api/boards/${board.id}/groups/${groupId}/items${cursorParam}`
      )
      set((state) => {
        if (!state.board) return state
        return {
          board: {
            ...state.board,
            groups: state.board.groups.map((g) => {
              if (g.id !== groupId) return g
              const merged = [...(g.items ?? []), ...items]
              return { ...g, items: merged, nextCursor }
            }),
          },
          loadingGroupItems: { ...state.loadingGroupItems, [groupId]: false },
        }
      })
    } catch {
      set((s) => ({ loadingGroupItems: { ...s.loadingGroupItems, [groupId]: false } }))
    }
  },

  clearBoard: () => set({ board: null, error: null, loadingGroupItems: {} }),

  upsertItem: (item) => set((state) => {
    if (!state.board) return state
    const groups = state.board.groups.map((g) => {
      if (g.items === undefined) return g
      if (g.id !== item.groupId) {
        const filtered = g.items.filter((i) => i.id !== item.id)
        return filtered.length === g.items.length ? g : { ...g, items: filtered }
      }
      const exists = g.items.some((i) => i.id === item.id)
      const items = exists
        ? g.items.map((i) => (i.id === item.id ? { ...i, ...item } : i))
        : [...g.items, item].sort((a, b) => a.position - b.position)
      const count = g._count?.items
      const _count = exists ? g._count : { items: (count ?? items.length - 1) + 1 }
      return { ...g, items, _count }
    })
    return { board: { ...state.board, groups } }
  }),

  removeItem: (itemId) => set((state) => {
    if (!state.board) return state
    const groups = state.board.groups.map((g) => {
      if (g.items === undefined) return g
      const items = g.items.filter((i) => i.id !== itemId)
      if (items.length === g.items.length) return g
      const count = g._count?.items
      return { ...g, items, _count: count != null ? { items: Math.max(0, count - 1) } : g._count }
    })
    return { board: { ...state.board, groups } }
  }),

  reorderItems: (updates) => set((state) => {
    if (!state.board) return state
    const byId: Record<string, { groupId: string; position: number }> = {}
    for (const u of updates) byId[u.id] = { groupId: u.groupId, position: u.position }

    const itemsById: Record<string, Item> = {}
    for (const g of state.board.groups) for (const i of (g.items ?? [])) itemsById[i.id] = i
    for (const id of Object.keys(byId)) {
      if (itemsById[id]) itemsById[id] = { ...itemsById[id], ...byId[id] }
    }

    const groups = state.board.groups.map((g) => {
      if (g.items === undefined) return g
      const items = Object.values(itemsById)
        .filter((i) => i.groupId === g.id)
        .sort((a, b) => a.position - b.position)
      return { ...g, items }
    })
    return { board: { ...state.board, groups } }
  }),

  addGroup: (group) => set((state) => {
    if (!state.board) return state
    if (state.board.groups.some((g) => g.id === group.id)) return state
    const groups = [...state.board.groups, { ...group, items: group.items ?? [] }]
      .sort((a, b) => a.position - b.position)
    return { board: { ...state.board, groups } }
  }),

  updateGroup: (group) => set((state) => {
    if (!state.board) return state
    const groups = state.board.groups.map((g) =>
      g.id === group.id ? { ...g, ...group } : g
    )
    return { board: { ...state.board, groups } }
  }),

  removeGroup: (groupId) => set((state) => {
    if (!state.board) return state
    return { board: { ...state.board, groups: state.board.groups.filter((g) => g.id !== groupId) } }
  }),

  updateColumns: (columns) => set((state) => {
    if (!state.board) return state
    return { board: { ...state.board, columns } }
  }),

  createItem: async (groupId, name) => {
    const board = get().board
    if (!board) throw new Error('No board loaded')
    const item = await api.post<Item>(`/api/boards/${board.id}/items`, { name, groupId, columnValues: {} })
    get().upsertItem(item)
    return item
  },

  updateItem: async (itemId, patch) => {
    const board = get().board
    if (!board) throw new Error('No board loaded')
    const item = await api.patch<Item>(`/api/boards/${board.id}/items/${itemId}`, patch)
    get().upsertItem(item)
    return item
  },

  deleteItem: async (itemId) => {
    const board = get().board
    if (!board) throw new Error('No board loaded')
    await api.delete(`/api/boards/${board.id}/items/${itemId}`)
    get().removeItem(itemId)
  },

  createGroup: async (name, color) => {
    const board = get().board
    if (!board) throw new Error('No board loaded')
    const group = await api.post<Group>(`/api/boards/${board.id}/groups`, { name, color })
    get().addGroup({ ...group, items: [], _count: { items: 0 } })
    return group
  },

  patchGroup: async (groupId, patch) => {
    const board = get().board
    if (!board) throw new Error('No board loaded')
    const group = await api.patch<Group>(`/api/boards/${board.id}/groups/${groupId}`, patch)
    get().updateGroup(group)
  },
}))
