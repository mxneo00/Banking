/**
 * Route guard for customer-only pages (dashboard, accounts).
 *
 * Authenticated staff are sent to `/staff` so they never sit on the
 * customer dashboard by accident.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { homePathForRole, isStaffRole } from '../types/auth'

export default function CustomerRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress />
      </Box>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (isStaffRole(user?.role)) {
    return <Navigate to={homePathForRole(user?.role)} replace />
  }

  return <Outlet />
}
