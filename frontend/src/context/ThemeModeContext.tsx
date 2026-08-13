/**
 * Light/dark theme mode provider, persisted to localStorage. Defaults to the
 * OS/browser's prefers-color-scheme if the user hasn't picked one yet. Kept
 * separate from AuthContext while theme mode has nothing to do with auth state
 * and should apply on the login/register screens too.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { getInitialMode, ThemeModeContext, type ThemeMode } from './themeMode'

const STORAGE_KEY = 'theme_mode'

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggleMode = () => setMode((current) => (current === 'light' ? 'dark' : 'light'))

  const value = useMemo(() => ({ mode, toggleMode }), [mode])

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>
}
