import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { AppBar, Box, IconButton, Toolbar, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import NavBar, { DRAWER_WIDTH, RAIL_WIDTH } from '../components/NavBar'

const NAV_COLLAPSED_STORAGE_KEY = 'nav_collapsed'

export default function AppLayout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) === 'true',
  )

  const desktopDrawerWidth = collapsed ? RAIL_WIDTH : DRAWER_WIDTH

  function toggleCollapsed() {
    // Persist alongside the state update (not in a separate useEffect) so
    // the write happens exactly once per toggle, using the same `next`
    // value that becomes the new state -- avoids a second render just to
    // sync localStorage.
    setCollapsed((current) => {
      const next = !current
      localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, String(next))
      return next
    })
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          width: { md: `calc(100% - ${desktopDrawerWidth}px)` },
          ml: { md: `${desktopDrawerWidth}px` },
          transition: theme.transitions.create(['width', 'margin'], {
            duration: theme.transitions.duration.shorter,
          }),
        }}
      >
        <Toolbar>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="open navigation"
              onClick={() => setMobileOpen((open) => !open)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Bank Management Portal
          </Typography>
        </Toolbar>
      </AppBar>

      <NavBar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
      />

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: { md: `calc(100% - ${desktopDrawerWidth}px)` },
          bgcolor: 'background.default',
          transition: theme.transitions.create('width', {
            duration: theme.transitions.duration.shorter,
          }),
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  )
}
