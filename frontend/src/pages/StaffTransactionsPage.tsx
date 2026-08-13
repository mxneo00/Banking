/**
 * Staff transaction history — full ledger view for employees.
 *
 * Uses GET /api/v1/transactions (staff sees all rows). Supports backend
 * filters for start_date and transaction_type, plus a local search box.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { getApiErrorMessage } from '../api/client'
import { listTransactions } from '../api/transactions'
import type { Transaction, TransactionType } from '../types/transaction'

const TYPE_OPTIONS: Array<TransactionType | ''> = ['', 'Deposit', 'Withdrawal', 'Transfer']

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

function typeChipColor(type: TransactionType): 'success' | 'warning' | 'info' | 'default' {
  if (type === 'Deposit') return 'success'
  if (type === 'Withdrawal') return 'warning'
  if (type === 'Transfer') return 'info'
  return 'default'
}

export default function StaffTransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [transactionType, setTransactionType] = useState<TransactionType | ''>('')
  const [search, setSearch] = useState('')

  // Applied filters (updated when user clicks Apply / on first load)
  const [appliedStartDate, setAppliedStartDate] = useState('')
  const [appliedType, setAppliedType] = useState<TransactionType | ''>('')

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await listTransactions({
          start_date: appliedStartDate || undefined,
          transaction_type: appliedType || undefined,
        })
        if (!cancelled) {
          setTransactions(rows)
        }
      } catch (err) {
        if (!cancelled) {
          setTransactions([])
          setError(getApiErrorMessage(err, 'Could not load transactions.'))
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
  }, [appliedStartDate, appliedType])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) {
      return transactions
    }
    return transactions.filter((tx) => {
      const haystack = [
        tx.transaction_id,
        tx.from_account_id ?? '',
        tx.to_account_id ?? '',
        tx.description ?? '',
        tx.type,
        String(tx.amount),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [transactions, search])

  function handleApplyFilters() {
    setAppliedStartDate(startDate)
    setAppliedType(transactionType)
  }

  function handleClearFilters() {
    setStartDate('')
    setTransactionType('')
    setSearch('')
    setAppliedStartDate('')
    setAppliedType('')
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Transactions
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Branch-wide ledger history. Filter by date or type; search matches account IDs and descriptions.
      </Typography>

      <Card variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          sx={{ alignItems: { md: 'center' } }}
        >
          <TextField
            label="Start date"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
            size="small"
            sx={{ minWidth: 180 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="tx-type-label">Type</InputLabel>
            <Select
              labelId="tx-type-label"
              label="Type"
              value={transactionType}
              onChange={(event) => setTransactionType(event.target.value as TransactionType | '')}
            >
              {TYPE_OPTIONS.map((option) => (
                <MenuItem key={option || 'all'} value={option}>
                  {option || 'All types'}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            size="small"
            placeholder="Account, ID, description…"
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={handleApplyFilters} disabled={loading}>
              Apply
            </Button>
            <Button variant="outlined" onClick={handleClearFilters} disabled={loading}>
              Clear
            </Button>
          </Stack>
        </Stack>
      </Card>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading transactions…</Typography>
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Alert severity="info">No transactions match the current filters.</Alert>
      )}

      {!loading && !error && filtered.length > 0 && (
        <TableContainer component={Card} variant="outlined" sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>ID</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((tx) => (
                <TableRow key={tx.transaction_id} hover>
                  <TableCell>{formatTimestamp(tx.timestamp)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={tx.type} color={typeChipColor(tx.type)} variant="outlined" />
                  </TableCell>
                  <TableCell>{formatCurrency(tx.amount)}</TableCell>
                  <TableCell>{tx.from_account_id ?? '—'}</TableCell>
                  <TableCell>{tx.to_account_id ?? '—'}</TableCell>
                  <TableCell>{tx.description ?? '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                      {tx.transaction_id.slice(0, 8)}…
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  )
}
