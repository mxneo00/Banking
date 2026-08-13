import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Grid, Stack, Typography } from '@mui/material'
import { fetchAccounts } from '../api/accounts'
import { getApiErrorMessage } from '../api/client'
import { fetchCustomer } from '../api/customers'
import { listTransactions } from '../api/transactions'
import BalanceTrendChart from '../components/BalanceTrendChart'
import RecentAccountsPreview from '../components/RecentAccountsPreview'
import RecentTransactionsPreview from '../components/RecentTransactionsPreview'
import TotalBalanceCard from '../components/TotalBalanceCard'
import { useAuth } from '../context/AuthContext'
import type { Account } from '../types/account'
import type { Customer } from '../types/customer'
import type { Transaction } from '../types/transaction'

export default function DashboardPage() {
  const { user } = useAuth()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      if (!user?.customer_id) {
        setCustomer(null)
        setAccounts([])
        setTransactions([])
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const profile = await fetchCustomer(user.customer_id)
        const [accountList, transactionList] = await Promise.all([
          fetchAccounts(profile.account_numbers),
          listTransactions(),
        ])
        if (!cancelled) {
          setCustomer(profile)
          setAccounts(accountList)
          setTransactions(
            [...transactionList].sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
            ),
          )
        }
      } catch (err) {
        if (!cancelled) {
          setCustomer(null)
          setAccounts([])
          setTransactions([])
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

  if (!user?.customer_id) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Alert severity="info">
          This dashboard is for customer accounts. Staff users should use Staff home or Branch
          overview.
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
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TotalBalanceCard accounts={accounts} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <BalanceTrendChart accounts={accounts} transactions={transactions} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <RecentAccountsPreview accounts={accounts} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <RecentTransactionsPreview transactions={transactions} />
          </Grid>
        </Grid>
      )}
    </Box>
  )
}
