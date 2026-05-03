// D365 Attribute Manager — Theme Store
import { create } from 'zustand'
import { applyTheme, saveTheme, loadTheme, DEFAULT_THEME } from '../globals/themes/index.js'

export const useThemeStore = create((set, get) => ({
  themeId: DEFAULT_THEME,

  // Load theme on app start
  initTheme: async () => {
    const themeId = await loadTheme()
    applyTheme(themeId)
    set({ themeId })
  },

  // Switch theme
  setTheme: async (themeId) => {
    applyTheme(themeId)
    await saveTheme(themeId)
    set({ themeId })
  },
}))