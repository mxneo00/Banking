import { createTheme, type Theme } from '@mui/material/styles'
import type { ThemeMode } from '../context/themeMode'

export function getTheme(mode: ThemeMode): Theme {
  const isDark = mode === 'dark'

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#5b8fd6' : '#0b3d91',
        dark: isDark ? '#3d6bb5' : '#072a64',
        light: isDark ? '#8fb3e6' : '#3d6bb5',
      },
      secondary: {
        main: isDark ? '#3ba37a' : '#1b7f5a',
      },
      background: {
        default: isDark ? '#0f172a' : '#f4f6f9',
        paper: isDark ? '#1e293b' : '#ffffff',
      },
    },
    typography: {
      fontFamily: '"IBM Plex Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 650 },
      h6: { fontWeight: 600 },
    },
    shape: {
      borderRadius: 10,
    },
  })
}
