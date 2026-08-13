import { useMemo, type ReactNode } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Stack, Toolbar, Tooltip, Typography, useMediaQuery, } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import SavingsIcon from '@mui/icons-material/Savings'
import DashboardIcon from '@mui/icons-material/Dashboard'
import InsightsIcon from '@mui/icons-material/Insights'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import Menu from '@mui/icons-material/Menu'
import Brightness4Icon from '@mui/icons-material/Brightness4'
import Brightness7Icon from '@mui/icons-material/Brightness7'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../context/AuthContext'
import { useThemeMode } from '../context/themeMode'
import { isStaffRole, type UserRole } from '../types/auth'

export const DRAWER_WIDTH = 240
export const RAIL_WIDTH = 72

type NavItem = {
  label: string
  path: string
  icon: ReactNode
  staffOnly?: boolean
  customerOnly?: boolean
  /** If set, only these roles see the item (still requires staffOnly/customerOnly rules). */
  roles?: readonly UserRole[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon />, customerOnly: true },
  { label: 'Accounts', path: '/accounts', icon: <AccountBalanceIcon />, customerOnly: true },
  { label: 'Budgets', path: '/budgets', icon: <SavingsIcon />, customerOnly: true },
  {
    label: 'Transaction history',
    path: '/transaction-history',
    icon: <ReceiptLongIcon />,
    customerOnly: true,
  },
  { label: 'Staff home', path: '/staff', icon: <DashboardIcon />, staffOnly: true },
  {
    label: 'Cash desk',
    path: '/cash-desk',
    icon: <PointOfSaleIcon />,
    staffOnly: true,
    roles: ['teller', 'admin'],
  },
  { label: 'Branch overview', path: '/analytics', icon: <InsightsIcon />, staffOnly: true },
  { label: 'Transactions', path: '/transactions', icon: <ReceiptLongIcon />, staffOnly: true },
]

export default function NavBar({
  mobileOpen,
  onMobileClose,
  collapsed,
  onToggleCollapsed,
}: {
  mobileOpen: boolean
  onMobileClose: () => void
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const theme = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { mode, toggleMode } = useThemeMode()

  // The mobile drawer is a temporary overlay -- collapsing it to icon-only
  // never makes sense there, so only rail-ify on desktop.
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isRailMode = collapsed && !isMobile
  const desktopDrawerWidth = collapsed ? RAIL_WIDTH : DRAWER_WIDTH

  const visibleNav = useMemo(() => {
    const staff = isStaffRole(user?.role)
    const role = user?.role
    // Three-tier visibility per item: customerOnly items need a non-staff
    // user; staffOnly items need a staff user AND (if `roles` narrows it
    // further, e.g. Cash desk being teller/admin only) a matching role;
    // anything with neither flag is visible to everyone.
    return navItems.filter((item) => {
      if (item.customerOnly) return !staff
      if (item.staffOnly) {
        if (!staff) return false
        if (item.roles && (!role || !item.roles.includes(role))) return false
        return true
      }
      return true
    })
  }, [user?.role])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ justifyContent: isRailMode ? 'center' : 'space-between', px: isRailMode ? 1 : 2 }}>
        {!isRailMode && (
          <Typography variant="h6" noWrap>
            Banking
          </Typography>
        )}
        <IconButton
          onClick={onToggleCollapsed}
          size="small"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          sx={{ display: { xs: 'none', md: 'inline-flex' } }}
        >
          <Menu />
        </IconButton>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, flexGrow: 1 }}>
        {visibleNav.map((item) => {
          // Dashboard ("/") needs an exact match, or it would also light up
          // for every other route (they all start with "/"). Every other
          // item uses startsWith so a nested path (e.g. "/accounts/123", if
          // one existed) still highlights its parent nav entry.
          const selected =
            item.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path)
          const button = (
            <ListItemButton
              key={item.path}
              component={RouterLink}
              to={item.path}
              selected={selected}
              onClick={onMobileClose}
              sx={{
                borderRadius: 2,
                mb: 0.5,
                justifyContent: isRailMode ? 'center' : 'flex-start',
                px: isRailMode ? 1.5 : 2,
              }}
            >
              <ListItemIcon sx={{ minWidth: isRailMode ? 0 : 40, justifyContent: 'center' }}>
                {item.icon}
              </ListItemIcon>
              {!isRailMode && <ListItemText primary={item.label} />}
            </ListItemButton>
          )
          return isRailMode ? (
            <Tooltip key={item.path} title={item.label} placement="right">
              {button}
            </Tooltip>
          ) : (
            button
          )
        })}
      </List>
      
      {/* Footer portion of the Navigation Bar */}
      <Divider />
      <Box sx={{ p: isRailMode ? 1 : 1.5 }}>
        <Stack
          direction={isRailMode ? 'column' : 'row'}
          spacing={1}
          sx={{ alignItems: 'center', mb: 1 }}
        >
          <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>{(user?.email ?? '?').charAt(0).toUpperCase()}</Avatar>
          {!isRailMode && user && (
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography variant="body2" noWrap>{user.email}</Typography>
            </Box>
          )}
        </Stack>

        <Stack
          direction="row"
          spacing={0.5}
          sx={{ justifyContent: isRailMode ? 'center' : 'space-between' }}
        >
          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton size="small" onClick={toggleMode} aria-label="Toggle dark mode">
              {mode === 'dark' ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Log out">
            <IconButton size="small" onClick={handleLogout} aria-label="Log out">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  )

  return (
    <Box
      component="nav"
      sx={{
        width: { md: desktopDrawerWidth },
        flexShrink: { md: 0 },
        transition: theme.transitions.create('width', {
          duration: theme.transitions.duration.shorter,
        }),
      }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: desktopDrawerWidth,
            overflowX: 'hidden',
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.shorter,
            }),
          },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  )
}
