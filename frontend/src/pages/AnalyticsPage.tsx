/**
 * Branch overview — shared operations view for teller / manager / admin.
 *
 * Customers: GET /customers (filtered by user.branch_id when set).
 * Transactions: GET /transactions, then keep rows that touch accounts belonging
 * to those customers (transactions have no branch_id column).
 */

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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import GroupsIcon from '@mui/icons-material/Groups'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import PaymentsIcon from '@mui/icons-material/Payments'
import PersonOffIcon from '@mui/icons-material/PersonOff'
import { getApiErrorMessage } from '../api/client'
import { listCustomers } from '../api/customers'
import { listTransactions } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import type { Customer } from '../types/customer'
import type { Transaction, TransactionType } from '../types/transaction'

const RECENT_LIMIT = 8
const DAYS_WINDOW = 7

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

/** Midnight, `days` calendar days ago -- inclusive of today, so
 * `startOfDaysAgo(7)` covers "today and the 6 days before it." */
function startOfDaysAgo(days: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const branchLabel = user?.branch_id ? `Branch ${user.branch_id}` : 'All branches'

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const customerParams = user?.branch_id ? { branch_id: user.branch_id } : undefined
        const [customerRows, txnRows] = await Promise.all([
          listCustomers(customerParams),
          listTransactions(),
        ])
        if (!cancelled) {
          setCustomers(customerRows)
          setTransactions(txnRows)
        }
      } catch (err) {
        if (!cancelled) {
          setCustomers([])
          setTransactions([])
          setError(getApiErrorMessage(err, 'Could not load branch overview.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.branch_id])

  // Flatten every in-scope customer's account numbers into one lookup set --
  // this is the bridge between "customers scoped to this branch" (from the
  // API) and "transactions touching this branch" (transactions carry no
  // branch field of their own, only account ids).
  const branchAccountNumbers = useMemo(() => {
    const set = new Set<string>()
    for (const customer of customers) {
      for (const number of customer.account_numbers) {
        set.add(number)
      }
    }
    return set
  }, [customers])

  // A transaction counts as "branch-related" if either side of it touches
  // one of this branch's accounts (a transfer could cross branches).
  const branchTransactions = useMemo(() => {
    return transactions.filter(
      (tx) =>
        (tx.from_account_id != null && branchAccountNumbers.has(tx.from_account_id)) ||
        (tx.to_account_id != null && branchAccountNumbers.has(tx.to_account_id)),
    )
  }, [transactions, branchAccountNumbers])

  const customerMetrics = useMemo(() => {
    const active = customers.filter((c) => c.is_active).length
    const linkedAccounts = customers.reduce((sum, c) => sum + c.account_numbers.length, 0)
    const withoutAccounts = customers.filter((c) => c.account_numbers.length === 0).length
    return {
      active,
      inactive: customers.length - active,
      total: customers.length,
      linkedAccounts,
      withoutAccounts,
    }
  }, [customers])

  const txnMetrics = useMemo(() => {
    const windowStart = startOfDaysAgo(DAYS_WINDOW)
    const inWindow = branchTransactions.filter((tx) => new Date(tx.timestamp) >= windowStart)

    // Pre-seed all three types at zero so the per-type cards below always
    // have a bucket to read, even for a type with no activity this window.
    const byType: Record<TransactionType, { count: number; volume: number }> = {
      Deposit: { count: 0, volume: 0 },
      Withdrawal: { count: 0, volume: 0 },
      Transfer: { count: 0, volume: 0 },
    }

    // Single pass over the windowed transactions, tallying count and dollar
    // volume into the matching bucket as we go.
    for (const tx of inWindow) {
      const bucket = byType[tx.type]
      if (bucket) {
        bucket.count += 1
        bucket.volume += tx.amount
      }
    }

    const count = inWindow.length
    const volume = inWindow.reduce((sum, tx) => sum + tx.amount, 0)

    return { count, volume, byType, inWindow }
  }, [branchTransactions])

  const recentBranchTransactions = useMemo(() => {
    return [...branchTransactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, RECENT_LIMIT)
  }, [branchTransactions])

  const topMetricCards = [
    {
      title: 'Active customers',
      value: String(customerMetrics.active),
      helper: `${customerMetrics.inactive} inactive · ${customerMetrics.total} total`,
      icon: <GroupsIcon color="secondary" />,
    },
    {
      title: 'Linked accounts',
      value: String(customerMetrics.linkedAccounts),
      helper: branchLabel,
      icon: <AccountTreeIcon color="secondary" />,
    },
    {
      title: `Txns (${DAYS_WINDOW}d)`,
      value: String(txnMetrics.count),
      helper: 'On this branch’s customer accounts',
      icon: <ReceiptLongIcon color="secondary" />,
    },
    {
      title: `Volume (${DAYS_WINDOW}d)`,
      value: formatCurrency(txnMetrics.volume),
      helper: 'Sum of matching ledger amounts',
      icon: <PaymentsIcon color="secondary" />,
    },
  ]

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Branch overview
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 1 }}>
        {branchLabel}
        {user?.role ? ` · signed in as ${user.role}` : ''}.
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Customers are scoped by branch when your login has a branch. Transaction metrics include
        ledger rows that touch those customers&apos; accounts (transactions have no branch field of
        their own).
      </Typography>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading branch overview…</Typography>
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {topMetricCards.map((card) => (
              <Grid key={card.title} size={{ xs: 12, sm: 6, md: 3 }}>
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

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {(['Deposit', 'Withdrawal', 'Transfer'] as TransactionType[]).map((type) => (
              <Grid key={type} size={{ xs: 12, sm: 4 }}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Chip size="small" label={type} sx={{ mb: 1 }} />
                    <Typography variant="h5">{txnMetrics.byType[type].count}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(txnMetrics.byType[type].volume)} in last {DAYS_WINDOW} days
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
            <Grid size={{ xs: 12 }}>
              <Alert severity="info" icon={<PersonOffIcon fontSize="inherit" />}>
                {customerMetrics.withoutAccounts} customer
                {customerMetrics.withoutAccounts === 1 ? '' : 's'} in this view have no accounts yet.
              </Alert>
            </Grid>
          </Grid>

          <Typography variant="h5" gutterBottom>
            Customers
          </Typography>
          {customers.length === 0 ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              No customers found for this view.
            </Alert>
          ) : (
            <TableContainer component={Card} variant="outlined" sx={{ mb: 3, overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Branch</TableCell>
                    <TableCell>Accounts</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.customer_id} hover>
                      <TableCell>{customer.customer_id}</TableCell>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>{customer.branch_id}</TableCell>
                      <TableCell>{customer.account_numbers.length}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={customer.is_active ? 'active' : 'inactive'}
                          color={customer.is_active ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Typography variant="h5" gutterBottom>
            Recent branch-related transactions
          </Typography>
          {recentBranchTransactions.length === 0 ? (
            <Alert severity="info">No transactions touch accounts for customers in this view.</Alert>
          ) : (
            <TableContainer component={Card} variant="outlined" sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentBranchTransactions.map((tx) => (
                    <TableRow key={tx.transaction_id} hover>
                      <TableCell>{formatTimestamp(tx.timestamp)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={tx.type} variant="outlined" />
                      </TableCell>
                      <TableCell>{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>{tx.from_account_id ?? '—'}</TableCell>
                      <TableCell>{tx.to_account_id ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  )
}
