/**
 * Route guard for authenticated pages.
 *
 * Wrap protected route groups in `<Route element={<ProtectedRoute />}>`.
 * While auth is restoring from localStorage, shows a loading spinner.
 * If the user is not logged in, redirects to `/login` and saves the intended
 * path in location state so LoginPage can send them back after sign-in.
 *
 * Used in `App.tsx` around AppLayout and all dashboard/account pages.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
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

  return <Outlet />
}
