/**
 * Staff-only route guard.
 *
 * Requires an authenticated staff role (teller / branch_manager / admin).
 * Unauthenticated users go to `/login`. Customers are sent to `/`.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { isStaffRole } from '../types/auth'

export default function StaffRoute() {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

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
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (!isStaffRole(user?.role)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
