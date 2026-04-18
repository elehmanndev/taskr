import { create } from 'zustand'
import { api, ApiError } from '../lib/api'
import { disconnectSocket } from '../lib/socket'
import type { User, OrgMember } from '../lib/types'

interface AuthUser extends User {
  orgs: OrgMember[]
}

interface AuthState {
  user: AuthUser | null
  currentOrgId: string | null
  loading: boolean
  fetchMe: () => Promise<void>
  loginWithGoogle: (idToken: string) => Promise<void>
  logout: () => Promise<void>
  setCurrentOrg: (orgId: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  currentOrgId: localStorage.getItem('currentOrgId'),
  loading: true,

  fetchMe: async () => {
    set({ loading: true })
    try {
      const user = await api.get<AuthUser>('/auth/me')
      const existing = get().currentOrgId
      const firstOrg = user?.orgs?.[0]?.orgId ?? null
      const currentOrgId = existing && user.orgs.some((o) => o.orgId === existing)
        ? existing
        : firstOrg
      if (currentOrgId) localStorage.setItem('currentOrgId', currentOrgId)
      set({ user, currentOrgId, loading: false })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        set({ user: null, loading: false })
      } else {
        set({ loading: false })
      }
    }
  },

  loginWithGoogle: async (idToken: string) => {
    await api.post('/auth/google', { idToken })
    await get().fetchMe()
  },

  logout: async () => {
    await api.post('/auth/logout')
    disconnectSocket()
    localStorage.removeItem('currentOrgId')
    set({ user: null, currentOrgId: null })
  },

  setCurrentOrg: (orgId: string) => {
    localStorage.setItem('currentOrgId', orgId)
    set({ currentOrgId: orgId })
  },
}))
