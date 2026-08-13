/**
 * Dedicated cash desk page for teller/admin deposit and withdrawal.
 */

import { Navigate } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import CashDeskPanel from '../components/CashDeskPanel'
import { useAuth } from '../context/AuthContext'
import { canUseCashDesk } from '../types/auth'

export default function CashDeskPage() {
  const { user } = useAuth()

  if (!canUseCashDesk(user?.role)) {
    return <Navigate to="/staff" replace />
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cash desk
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Search customers by name, review account details and recent activity, then deposit or
        withdraw.
      </Typography>
      <CashDeskPanel />
    </Box>
  )
}
