import { create } from 'zustand'
import { api } from '../lib/api'
import type { Notification } from '../lib/types'

interface NotificationState {
  items: Notification[]
  unreadCount: number
  loading: boolean
  fetch: () => Promise<void>
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  pushNew: (n: Notification) => void
}

const isRead = (n: Notification) => !!n.readAt

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  loading: false,

  fetch: async () => {
    set({ loading: true })
    try {
      const [items, { count }] = await Promise.all([
        api.get<Notification[]>('/api/notifications'),
        api.get<{ count: number }>('/api/notifications/unread-count'),
      ])
      set({ items, unreadCount: count, loading: false })
    } catch {
      set({ loading: false })
    }
  },

  markRead: async (id) => {
    await api.post('/api/notifications/read', { ids: [id] })
    set((state) => {
      const items = state.items.map((n) =>
        n.id === id ? { ...n, readAt: new Date().toISOString() } : n
      )
      return { items, unreadCount: items.filter((n) => !isRead(n)).length }
    })
  },

  markAllRead: async () => {
    await api.post('/api/notifications/read', {})
    const now = new Date().toISOString()
    set((state) => ({
      items: state.items.map((n) => ({ ...n, readAt: n.readAt ?? now })),
      unreadCount: 0,
    }))
  },

  pushNew: (n) => set((state) => ({
    items: [n, ...state.items],
    unreadCount: state.unreadCount + (isRead(n) ? 0 : 1),
  })),
}))
