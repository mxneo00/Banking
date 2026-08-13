/**
 * Non-component half of theme-mode state (context object, storage helpers,
 * the useThemeMode hook); split from ThemeModeContext.tsx's Provider so
 * that file only exports a component (react-refresh/only-export-components).
 */

import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'dark'

export const STORAGE_KEY = 'theme_mode'

export function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') {
    return stored
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export type ThemeModeContextValue = {
  mode: ThemeMode
  toggleMode: () => void
}

export const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined)

export function useThemeMode(): ThemeModeContextValue {
  const context = useContext(ThemeModeContext)
  if (!context) {
    throw new Error('useThemeMode must be used within a ThemeModeProvider')
  }
  return context
}
