import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import { fetchAccounts } from '../api/accounts'
import { getApiErrorMessage } from '../api/client'
import { fetchCustomer } from '../api/customers'
import { useAuth } from '../context/AuthContext'
import type { Account } from '../types/account'
import type { Customer } from '../types/customer'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      if (!user?.customer_id) {
        setCustomer(null)
        setAccounts([])
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const profile = await fetchCustomer(user.customer_id)
        const accountList = await fetchAccounts(profile.account_numbers)
        if (!cancelled) {
          setCustomer(profile)
          setAccounts(accountList)
        }
      } catch (err) {
        if (!cancelled) {
          setCustomer(null)
          setAccounts([])
          setError(getApiErrorMessage(err, 'Could not load your dashboard.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [user?.customer_id])

  const totalBalance = useMemo(
    () => accounts.reduce((sum, account) => sum + account.balance, 0),
    [accounts],
  )

  if (!user?.customer_id) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Alert severity="info">
          This dashboard is for customer accounts. Staff users should use Analytics for
          branch views.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {customer
          ? `Welcome back, ${customer.name}. Branch ${customer.branch_id}.`
          : `Welcome back, ${user.email}.`}
      </Typography>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading your profile and balances…</Typography>
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && customer && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AccountBalanceWalletIcon color="primary" />
                    <Typography variant="subtitle1">Total balance</Typography>
                  </Box>
                  <Typography variant="h5">{formatCurrency(totalBalance)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Across {accounts.length} account{accounts.length === 1 ? '' : 's'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Profile
                  </Typography>
                  <Typography variant="body1">{customer.name}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {customer.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Customer ID: {customer.customer_id}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Typography variant="h5" gutterBottom>
            Your accounts
          </Typography>

          {accounts.length === 0 ? (
            <Alert severity="info">
              You do not have any accounts yet. Opening an account will be added in a
              later step.
            </Alert>
          ) : (
            <Stack spacing={2}>
              {accounts.map((account) => (
                <Card key={account.account_number} variant="outlined">
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
                          <Typography variant="h6">{account.account_number}</Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                            <Chip label={account.account_type} size="small" />
                            <Chip
                              label={account.is_active ? 'active' : 'inactive'}
                              size="small"
                              color={account.is_active ? 'success' : 'default'}
                              variant="outlined"
                            />
                          </Stack>
                        </Box>
                      </Box>
                      <Box sx={{ textAlign: { sm: 'right' } }}>
                        <Typography variant="body2" color="text.secondary">
                          Balance
                        </Typography>
                        <Typography variant="h5">{formatCurrency(account.balance)}</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}
        </>
      )}
    </Box>
  )
}
