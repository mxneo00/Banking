/**
 * Catch-all / default redirect to the caller's role home.
 */

import { Navigate } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { useAuth } from '../context/AuthContext'
import { homePathForRole } from '../types/auth'

export default function RoleHomeRedirect() {
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

  return <Navigate to={homePathForRole(user?.role)} replace />
}
