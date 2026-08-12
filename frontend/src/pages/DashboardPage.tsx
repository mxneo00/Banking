import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
} from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { useAuth } from '../context/AuthContext'

const summaryCards = [
  {
    title: 'Total balance',
    value: '—',
    helper: 'Connected in a later step',
    icon: <AccountBalanceWalletIcon color="primary" />,
  },
  {
    title: 'Recent activity',
    value: '—',
    helper: 'Transaction history placeholder',
    icon: <ReceiptLongIcon color="primary" />,
  },
  {
    title: 'Quick transfer',
    value: 'Ready',
    helper: 'Transfer UI comes next',
    icon: <SwapHorizIcon color="primary" />,
  },
]

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Welcome back{user ? `, ${user.email}` : ''}. Overview of your accounts and recent banking activity.
      </Typography>

      <Grid container spacing={2}>
        {summaryCards.map((card) => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {card.icon}
                  <Typography variant="subtitle1">{card.title}</Typography>
                </Box>
                <Typography variant="h5">{card.value}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.helper}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
