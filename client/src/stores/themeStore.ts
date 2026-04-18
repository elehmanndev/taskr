import { create } from 'zustand'

export type Theme = 'night' | 'light' | 'black'

const STORAGE_KEY = 'taskr.theme'

function readInitial(): Theme {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'night' || saved === 'light' || saved === 'black') return saved
  return 'night'
}

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => {
  const initial = readInitial()
  apply(initial)
  return {
    theme: initial,
    setTheme: (t) => {
      apply(t)
      localStorage.setItem(STORAGE_KEY, t)
      set({ theme: t })
    },
  }
})
