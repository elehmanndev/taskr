import { create } from 'zustand'

export type Theme = 'night'

function apply(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

interface ThemeState {
  theme: Theme
  setTheme: (t: Theme) => void
}

export const useThemeStore = create<ThemeState>((set) => {
  apply('night')
  return {
    theme: 'night',
    setTheme: (t) => {
      apply(t)
      set({ theme: t })
    },
  }
})
