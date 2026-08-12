import {
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'

const placeholderAccounts = [
  { number: 'ACC-123', type: 'checking', balance: '—' },
  { number: 'ACC-456', type: 'checking', balance: '—' },
]

export default function AccountPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Accounts
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        View balances and account details. Live data connects in a later step.
      </Typography>

      <Stack spacing={2}>
        {placeholderAccounts.map((account) => (
          <Card key={account.number} variant="outlined">
            <CardContent>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{
                  alignItems: { sm: 'center' },
                  justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AccountBalanceIcon color="primary" />
                  <Box>
                    <Typography variant="h6">{account.number}</Typography>
                    <Chip label={account.type} size="small" sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
                <Box sx={{ textAlign: { sm: 'right' } }}>
                  <Typography variant="body2" color="text.secondary">
                    Balance
                  </Typography>
                  <Typography variant="h5">{account.balance}</Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  )
}
