/**
 * Route guard for public-only pages (login, register).
 *
 * Opposite of `ProtectedRoute`: if the user is already authenticated, redirect
 * to the dashboard instead of showing the sign-in form again.
 *
 * Used in `App.tsx` around `/login` and `/register`.
 */

import { Navigate, Outlet } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'

export default function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth()

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
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
