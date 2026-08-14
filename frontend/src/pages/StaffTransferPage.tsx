/**
 * Staff page for moving money between any two accounts.
 *
 * Available to teller, branch_manager, and admin (StaffRoute).
 */

import { Box, Typography } from '@mui/material'
import StaffTransferPanel from '../components/StaffTransferPanel'

export default function StaffTransferPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Transfers
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Search by customer name or account number, then move money between the two accounts.
      </Typography>
      <StaffTransferPanel />
    </Box>
  )
}
