/**
 * Reads the current theme mode from ThemeModeContext and hands MUI the
 * matching theme; pulled out of main.tsx into its own file so the entry
 * point doesn't define an unexported component (react-refresh/only-export-components
 * flags that, and main.tsx isn't meant to export anything).
 */

import type { ReactNode } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import { useThemeMode } from '../context/themeMode'
import { getTheme } from './theme'

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { mode } = useThemeMode()
  return (
    <ThemeProvider theme={getTheme(mode)}>
      {/* enableColorScheme tells the browser this page supports dark mode, so
          native UI it renders itself (scrollbars, form control chrome) picks
          a matching dark variant instead of staying white. */}
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  )
}
