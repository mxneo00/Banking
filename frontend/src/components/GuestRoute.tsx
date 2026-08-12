/**
 * Route guard for public-only pages (login, register).
 *
 * Opposite of `ProtectedRoute`: if the user is already authenticated, redirect
 * to their role home instead of showing the sign-in form again.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { homePathForRole } from '../types/auth'

export default function GuestRoute() {
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

  if (isAuthenticated) {
    return <Navigate to={homePathForRole(user?.role)} replace />
  }

  return <Outlet />
}
