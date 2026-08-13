/**
 * Teller/admin cash desk — deposit or withdraw on a customer's account.
 *
 * Calls POST /api/v1/transactions (teller/admin only on the backend).
 * Find accounts via customer name search (GET /customers, filtered client-side),
 * or enter an account number directly. Selecting an account opens a detail card
 * with balances, limits, and recent transactions (no opened-date field).
 */

import { useEffect, useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import AccountDetailCard from './AccountDetailCard'
import { fetchAccount } from '../api/accounts'
import { getApiErrorMessage } from '../api/client'
import { listCustomers } from '../api/customers'
import { createTransaction, listTransactions } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import type { Account } from '../types/account'
import type { Customer } from '../types/customer'
import type { Transaction } from '../types/transaction'

type CashOp = 'Deposit' | 'Withdrawal'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

type CashDeskPanelProps = {
  /** Called after a successful deposit/withdraw so parents can refresh lists. */
  onSuccess?: (transaction: Transaction) => void
  embedded?: boolean
}

export default function CashDeskPanel({ onSuccess, embedded = false }: CashDeskPanelProps) {
  const { user } = useAuth()

  const [operation, setOperation] = useState<CashOp>('Deposit')
  const [accountNumber, setAccountNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [lookedUp, setLookedUp] = useState<Account | null>(null)
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [nameQuery, setNameQuery] = useState('')
  const [customerMatches, setCustomerMatches] = useState<Customer[]>([])
  const [searchingCustomers, setSearchingCustomers] = useState(false)
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null)
  const [customerSearchDone, setCustomerSearchDone] = useState(false)

  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [loadingTransactions, setLoadingTransactions] = useState(false)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadRecent() {
      if (!lookedUp) {
        setRecentTransactions([])
        setTransactionsError(null)
        setLoadingTransactions(false)
        return
      }

      setLoadingTransactions(true)
      setTransactionsError(null)
      try {
        const rows = await listTransactions()
        if (cancelled) return
        // No "transactions for this account" endpoint exists -- fetch the
        // full ledger the caller can see (staff sees everything) and narrow
        // to this account, newest first, capped to a short preview list.
        const forAccount = rows
          .filter(
            (tx) =>
              tx.from_account_id === lookedUp.account_number ||
              tx.to_account_id === lookedUp.account_number,
          )
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 5)
        setRecentTransactions(forAccount)
      } catch (err) {
        if (!cancelled) {
          setRecentTransactions([])
          setTransactionsError(getApiErrorMessage(err, 'Could not load recent transactions.'))
        }
      } finally {
        if (!cancelled) {
          setLoadingTransactions(false)
        }
      }
    }

    void loadRecent()
    return () => {
      cancelled = true
    }
  }, [lookedUp])

  async function lookupAccount(number: string, customerName?: string | null) {
    setLookingUp(true)
    setLookupError(null)
    setSuccess(null)
    try {
      const account = await fetchAccount(number)
      setLookedUp(account)
      setAccountNumber(account.account_number)
      if (customerName !== undefined) {
        setSelectedCustomerName(customerName)
      }
    } catch (err) {
      setLookedUp(null)
      setSelectedCustomerName(null)
      setLookupError(getApiErrorMessage(err, 'Could not find that account.'))
    } finally {
      setLookingUp(false)
    }
  }

  async function handleLookup() {
    const number = accountNumber.trim()
    if (!number) {
      setLookupError('Enter an account number to look up.')
      setLookedUp(null)
      setSelectedCustomerName(null)
      return
    }
    await lookupAccount(number, null)
  }

  async function handleCustomerSearch() {
    const q = nameQuery.trim().toLowerCase()
    if (!q) {
      setCustomerSearchError('Enter a customer name to search.')
      setCustomerMatches([])
      setCustomerSearchDone(false)
      return
    }

    setSearchingCustomers(true)
    setCustomerSearchError(null)
    setCustomerSearchDone(false)
    try {
      // Branch-scope the candidate list server-side when this teller belongs
      // to one branch, then narrow by name client-side -- there's no
      // name-search query param on GET /customers today.
      const params = user?.branch_id ? { branch_id: user.branch_id } : undefined
      const rows = await listCustomers(params)
      const matches = rows.filter((customer) => customer.name.toLowerCase().includes(q))
      setCustomerMatches(matches)
      setCustomerSearchDone(true)
      if (matches.length === 0) {
        setCustomerSearchError(`No customers matched “${nameQuery.trim()}”.`)
      }
    } catch (err) {
      setCustomerMatches([])
      setCustomerSearchDone(false)
      setCustomerSearchError(getApiErrorMessage(err, 'Could not search customers.'))
    } finally {
      setSearchingCustomers(false)
    }
  }

  async function handleSelectAccount(number: string, customerName: string) {
    setAccountNumber(number)
    setLookupError(null)
    await lookupAccount(number, customerName)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const number = accountNumber.trim()
    const parsedAmount = Number(amount)
    if (!number) {
      setError('Account number is required.')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Amount must be greater than 0.')
      return
    }

    setSubmitting(true)
    try {
      // A deposit credits `to_account`; a withdrawal debits `from_account`
      // -- only one side is ever sent, matching what transactionController
      // expects for each type (see app/services/transactionService.py).
      const payload =
        operation === 'Deposit'
          ? {
              to_account: number,
              amount: parsedAmount,
              transaction_type: 'Deposit' as const,
            }
          : {
              from_account: number,
              amount: parsedAmount,
              transaction_type: 'Withdrawal' as const,
            }

      const tx = await createTransaction(payload)
      const verb = operation === 'Deposit' ? 'Deposited' : 'Withdrew'
      setSuccess(
        `${verb} ${formatCurrency(tx.amount)} on ${number}. Transaction ${tx.transaction_id.slice(0, 8)}…`,
      )
      setAmount('')
      try {
        const refreshed = await fetchAccount(number)
        setLookedUp(refreshed)
      } catch {
        // Non-fatal; the transaction itself succeeded.
      }
      onSuccess?.(tx)
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not complete ${operation.toLowerCase()}.`))
    } finally {
      setSubmitting(false)
    }
  }

  const workspace = (
    <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
      <Grid size={{ xs: 12, md: lookedUp ? 6 : 12 }}>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle1" gutterBottom>
              Find customer by name
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label="Customer name"
                value={nameQuery}
                onChange={(event) => {
                  setNameQuery(event.target.value)
                  setCustomerSearchError(null)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void handleCustomerSearch()
                  }
                }}
                placeholder="e.g. Aisha"
                sx={{ flexGrow: 1 }}
              />
              <Button
                type="button"
                variant="outlined"
                onClick={() => void handleCustomerSearch()}
                disabled={searchingCustomers}
                sx={{ alignSelf: { sm: 'center' }, whiteSpace: 'nowrap' }}
              >
                {searchingCustomers ? 'Searching…' : 'Search'}
              </Button>
            </Stack>
            {customerSearchError && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                {customerSearchError}
              </Alert>
            )}
            {customerSearchDone && customerMatches.length > 0 && (
              <Stack spacing={1} sx={{ mt: 1.5 }}>
                {customerMatches.map((customer) => (
                  <Card key={customer.customer_id} variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Typography variant="subtitle2">
                        {customer.name}{' '}
                        <Typography component="span" variant="body2" color="text.secondary">
                          ({customer.customer_id}
                          {!customer.is_active ? ', inactive' : ''})
                        </Typography>
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {customer.email} · branch {customer.branch_id}
                      </Typography>
                      {customer.account_numbers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">
                          No accounts on file.
                        </Typography>
                      ) : (
                        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                          {customer.account_numbers.map((number) => (
                            <Chip
                              key={number}
                              label={number}
                              color={accountNumber === number ? 'primary' : 'default'}
                              onClick={() => void handleSelectAccount(number, customer.name)}
                              clickable
                            />
                          ))}
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Box>

          <Divider />

          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            <FormControl>
              <Typography variant="subtitle2" gutterBottom>
                Operation
              </Typography>
              <RadioGroup
                row
                value={operation}
                onChange={(event) => setOperation(event.target.value as CashOp)}
              >
                <FormControlLabel value="Deposit" control={<Radio />} label="Deposit" />
                <FormControlLabel value="Withdrawal" control={<Radio />} label="Withdrawal" />
              </RadioGroup>
            </FormControl>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                label="Account number"
                required
                value={accountNumber}
                onChange={(event) => {
                  setAccountNumber(event.target.value)
                  setLookedUp(null)
                  setSelectedCustomerName(null)
                  setLookupError(null)
                }}
                placeholder="Select from search or type e.g. ACC-123"
                sx={{ flexGrow: 1 }}
              />
              <Button
                type="button"
                variant="outlined"
                onClick={() => void handleLookup()}
                disabled={lookingUp}
                sx={{ alignSelf: { sm: 'center' }, whiteSpace: 'nowrap' }}
              >
                {lookingUp ? 'Looking up…' : 'Look up'}
              </Button>
            </Stack>

            {lookupError && <Alert severity="warning">{lookupError}</Alert>}

            <TextField
              label="Amount"
              type="number"
              required
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              slotProps={{ htmlInput: { min: 0.01, step: '0.01' } }}
            />

            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? 'Processing…' : `Submit ${operation.toLowerCase()}`}
            </Button>
          </Stack>
        </Stack>
      </Grid>

      {lookedUp && (
        <Grid size={{ xs: 12, md: 6 }}>
          <AccountDetailCard
            account={lookedUp}
            customerName={selectedCustomerName}
            recentTransactions={recentTransactions}
            loadingTransactions={loadingTransactions}
            transactionsError={transactionsError}
          />
        </Grid>
      )}
    </Grid>
  )

  if (embedded) {
    return (
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PointOfSaleIcon color="primary" />
            <Typography variant="h6">Cash desk</Typography>
          </Box>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Search a customer by name, select an account to inspect details, then deposit or
            withdraw. Teller and admin only.
          </Typography>
          {workspace}
        </CardContent>
      </Card>
    )
  }

  return workspace
}
