/**
 * Customer page for sending money from an owned account to any account
 * at the bank (another of theirs, or someone else's).
 */

import { Box, Typography } from '@mui/material'
import CustomerTransferPanel from '../components/CustomerTransferPanel'

export default function CustomerTransferPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Send money
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Send from one of your accounts to another account at this bank. Deposits and
        withdrawals are handled at the cash desk.
      </Typography>
      <CustomerTransferPanel />
    </Box>
  )
}
