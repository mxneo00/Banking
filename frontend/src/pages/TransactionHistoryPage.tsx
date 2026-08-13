/**
 * Customer-facing transaction history.
 * The staff equivalent (StaffTransactionsPage.tsx, branch-wide with date
 * filters) already exists; this is the customer's own view, scoped
 * automatically by the backend (GET /transactions returns only rows
 * touching the caller's own accounts for a customer token).
 *
 * Filtering/sorting is all client-side over one fetch: Type is filterable
 * via a dropdown behind its column header (ColumnFilterHeader), Description
 * has a fuzzy-matched toolbar search box (utils/fuzzyMatch.ts), and
 * When/Amount are sortable via a standard clickable header (TableSortLabel).
 * The backend has no from/to/description filter params, so this app fetches
 * once and slices locally rather than round-tripping per filter change.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  MenuList,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material'
import { alpha } from '@mui/material/styles'
import CheckIcon from '@mui/icons-material/Check'
import DownloadIcon from '@mui/icons-material/Download'

import { getApiErrorMessage } from '../api/client'
import { listTransactions } from '../api/transactions'
import ColumnFilterHeader from '../components/ColumnFilterHeader'
import FuzzySearchField from '../components/FuzzySearchField'
import type { Transaction, TransactionType } from '../types/transaction'
import { downloadCsv, transactionsToCsv } from '../utils/csvExport'
import { fuzzyMatch } from '../utils/fuzzyMatch'
import { TYPE_COLOR, formatTimestamp } from '../utils/transactionDisplay'

const TYPE_OPTIONS: Array<TransactionType | ''> = ['', 'Deposit', 'Withdrawal', 'Transfer']

type SortField = 'date' | 'amount'
type SortDirection = 'asc' | 'desc'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function TransactionHistoryPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeFilter, setTypeFilter] = useState<TransactionType | ''>('')
  const [descriptionSearch, setDescriptionSearch] = useState('')

  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await listTransactions()
        if (!cancelled) {
          setTransactions(rows)
        }
      } catch (err) {
        if (!cancelled) {
          setTransactions([])
          setError(getApiErrorMessage(err, 'Could not load your transaction history.'))
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
  }, [])

  function handleSort(field: SortField) {
    // Clicking the already-active column flips its direction; clicking a
    // different column switches to it fresh, defaulting to descending
    // (newest/largest first, the more common starting point for both
    // dates and amounts).
    if (field === sortField) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  function resetPage() {
    setPage(0)
  }

  const filteredAndSorted = useMemo(() => {
    // Both filters are AND-ed: a row must pass the type dropdown (if set)
    // AND fuzzy-match the description search (an empty query always matches,
    // see fuzzyMatch.ts).
    const filtered = transactions.filter((tx) => {
      if (typeFilter && tx.type !== typeFilter) return false
      if (!fuzzyMatch(descriptionSearch, tx.description ?? '').matched) return false
      return true
    })

    // +1/-1 multiplier lets one comparator express both sort directions
    // instead of duplicating the sort logic per direction.
    const directionMultiplier = sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (sortField === 'amount') {
        return (a.amount - b.amount) * directionMultiplier
      }
      return (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) * directionMultiplier
    })
  }, [transactions, typeFilter, descriptionSearch, sortField, sortDirection])

  const paged = filteredAndSorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

  function handleExportCsv() {
    const today = new Date().toISOString().slice(0, 10)
    downloadCsv(`transaction-history-${today}.csv`, transactionsToCsv(filteredAndSorted))
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Transaction history
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Every deposit, withdrawal, and transfer across your accounts. Click a column header to
        sort or filter it.
      </Typography>

      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <FuzzySearchField
          label="Search descriptions"
          placeholder="e.g. rent, groceries…"
          value={descriptionSearch}
          onChange={(value) => {
            setDescriptionSearch(value)
            resetPage()
          }}
          sx={{ minWidth: 240 }}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<DownloadIcon />}
          onClick={handleExportCsv}
          disabled={filteredAndSorted.length === 0}
        >
          Export CSV
        </Button>
      </Stack>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading transactions…</Typography>
        </Stack>
      )}

      {!loading && error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && transactions.length === 0 && (
        <Alert severity="info">No transactions yet.</Alert>
      )}

      {!loading && !error && transactions.length > 0 && (
        <Box sx={{ borderRadius: 2, overflow: 'hidden', border: 1, borderColor: 'divider' }}>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>
                    <TableSortLabel
                      active={sortField === 'date'}
                      direction={sortField === 'date' ? sortDirection : 'desc'}
                      onClick={() => handleSort('date')}
                    >
                      When
                    </TableSortLabel>
                  </TableCell>

                  <ColumnFilterHeader label="Type" active={typeFilter !== ''}>
                    {(close) => (
                      <MenuList dense disablePadding>
                        {TYPE_OPTIONS.map((option) => (
                          <MenuItem
                            key={option || 'all'}
                            selected={typeFilter === option}
                            onClick={() => {
                              setTypeFilter(option)
                              resetPage()
                              close()
                            }}
                          >
                            {typeFilter === option && (
                              <CheckIcon fontSize="small" sx={{ mr: 1 }} />
                            )}
                            {option || 'All types'}
                          </MenuItem>
                        ))}
                      </MenuList>
                    )}
                  </ColumnFilterHeader>

                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Description</TableCell>

                  <TableCell align="right">
                    <TableSortLabel
                      active={sortField === 'amount'}
                      direction={sortField === 'amount' ? sortDirection : 'desc'}
                      onClick={() => handleSort('amount')}
                    >
                      Amount
                    </TableSortLabel>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paged.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        No transactions match the current filters.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {paged.map((tx) => (
                  <TableRow
                    key={tx.transaction_id}
                    hover
                    sx={{
                      bgcolor: (t) => alpha(t.palette[TYPE_COLOR[tx.type]].main, 0.06),
                    }}
                  >
                    <TableCell>{formatTimestamp(tx.timestamp)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={tx.type} color={TYPE_COLOR[tx.type]} variant="outlined" />
                    </TableCell>
                    <TableCell>
                      {tx.from_account_id ? (
                        <Chip size="small" label={tx.from_account_id} variant="outlined" />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {tx.to_account_id ? (
                        <Chip size="small" label={tx.to_account_id} variant="outlined" />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{tx.description ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 600, color: (t) => t.palette[TYPE_COLOR[tx.type]].main }}
                      >
                        {/* Transfer direction depends on which side is "my" account, which this
                            page doesn't know without cross-referencing the caller's own account
                            list -- only sign Deposit/Withdrawal, which are unambiguous. */}
                        {tx.type === 'Withdrawal' && '-'}
                        {tx.type === 'Deposit' && '+'}
                        {formatCurrency(tx.amount)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={filteredAndSorted.length}
            page={page}
            onPageChange={(_event, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(event) => {
              setRowsPerPage(parseInt(event.target.value, 10))
              setPage(0)
            }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </Box>
      )}
    </Box>
  )
}
