import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import AddIcon from '@mui/icons-material/Add'

import { fetchAccounts, openAccount } from '../api/accounts'
import { getApiErrorMessage } from '../api/client'
import { fetchCustomer } from '../api/customers'
import { transferMoney } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import type { Account } from '../types/banking'

export default function AccountPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isNewAccountOpen, setIsNewAccountOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAccountsData = useCallback(async () => {
    if (!user?.customer_id) return []
    const profile = await fetchCustomer(user.customer_id)
    return fetchAccounts(profile.account_numbers)
  }, [user])

  useEffect(() => {
    let cancelled = false
    loadAccountsData()
      .then((data) => {
        if (!cancelled) setAccounts(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Could not load your accounts.'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [loadAccountsData])

  const refreshAccounts = useCallback(() => {
    setIsLoading(true)
    setError(null)
    loadAccountsData()
      .then(setAccounts)
      .catch((err) => setError(getApiErrorMessage(err, 'Could not load your accounts.')))
      .finally(() => setIsLoading(false))
  }, [loadAccountsData])

  if (!user?.customer_id) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        You must be logged in to view your accounts.
      </Alert>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Accounts
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        View balances and account details, and transfer between accounts.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setIsNewAccountOpen((open) => !open)}
        >
          {isNewAccountOpen ? 'Cancel' : 'Open a new account'}
        </Button>
        <Collapse in={isNewAccountOpen} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2, maxWidth: 420 }}>
            <NewAccountForm
              customerId={user.customer_id}
              onSuccess={() => {
                setIsNewAccountOpen(false)
                refreshAccounts()
              }}
            />
          </Box>
        </Collapse>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refreshAccounts}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!isLoading && !error && accounts.length === 0 && (
        <Alert severity="info">No accounts yet.</Alert>
      )}

      {!isLoading && !error && accounts.length > 0 && (
        <Stack spacing={2}>
          {accounts.map((account) => (
            <AccountCard
              key={account.account_number}
              account={account}
              otherAccounts={accounts.filter(
                (a) => a.account_number !== account.account_number,
              )}
              onTransferComplete={refreshAccounts}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

function AccountCard({
  account,
  otherAccounts,
  onTransferComplete,
}: {
  account: Account
  otherAccounts: Account[]
  onTransferComplete: () => void
}) {
  const [isTransferOpen, setIsTransferOpen] = useState(false)

  return (
    <Card variant="outlined">
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
              <Chip label={account.account_type} size="small" sx={{ mt: 0.5 }} />
              {!account.is_active && (
                <Chip label="inactive" size="small" color="default" sx={{ mt: 0.5, ml: 0.5 }} />
              )}
            </Box>
          </Box>
          <Box sx={{ textAlign: { sm: 'right' } }}>
            <Typography variant="body2" color="text.secondary">
              Balance
            </Typography>
            <Typography variant="h5">
              ${account.balance.toFixed(2)}
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Button
            size="small"
            variant="outlined"
            disabled={!account.is_active}
            onClick={() => setIsTransferOpen((open) => !open)}
          >
            {isTransferOpen ? 'Cancel transfer' : 'Transfer money'}
          </Button>
        </Box>

        <Collapse in={isTransferOpen} timeout="auto" unmountOnExit>
          <TransferForm
            fromAccount={account}
            otherAccounts={otherAccounts}
            onSuccess={() => {
              setIsTransferOpen(false)
              onTransferComplete()
            }}
          />
        </Collapse>
      </CardContent>
    </Card>
  )
}

function NewAccountForm({ 
  customerId,
  onSuccess,
}: {
  customerId: string
  onSuccess: () => void
}) {
  const [accountType, setAccountType] = useState<'savings' | 'checking'>('savings')
  const [openingBalance, setOpeningBalance] = useState<string>('0')
  // Only one of these is ever sent -- matches the backend's rule that
  // minimum_balance and overdraft_limit are mutually exclusive by type.
  const [minimumBalance, setMinimumBalance] = useState('')
  const [overdraftLimit, setOverdraftLimit] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const parsedOpeningBalance = Number(openingBalance)
    if (!Number.isFinite(parsedOpeningBalance) || parsedOpeningBalance < 0) {
      setFormError('Opening balance must be 0 or more.')
      return
    }

    let parsedMinimumBalance: number | undefined
    let parsedOverdraftLimit: number | undefined
    if (accountType === 'savings' && minimumBalance.trim()) {
      parsedMinimumBalance = Number(minimumBalance)
      if (!Number.isFinite(parsedMinimumBalance) || parsedMinimumBalance < 0) {
        setFormError('Minimum balance must be 0 or more.')
        return
      }
    }
    if (accountType === 'checking' && overdraftLimit.trim()) {
      parsedOverdraftLimit = Number(overdraftLimit)
      if (!Number.isFinite(parsedOverdraftLimit) || parsedOverdraftLimit < 0) {
        setFormError('Overdraft limit must be 0 or more.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      await openAccount({
        customer_id: customerId,
        account_type: accountType,
        opening_balance: parsedOpeningBalance,
        minimum_balance: parsedMinimumBalance,
        overdraft_limit: parsedOverdraftLimit,
      })
      onSuccess()
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'Could not open the account.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card variant="outlined">
      <CardContent>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <TextField
              select
              label="Account type"
              value={accountType}
              onChange={(e) => setAccountType(e.target.value as 'savings' | 'checking')}
              size="small"
              fullWidth
              disabled={isSubmitting}
            >
              <MenuItem value="savings">Savings</MenuItem>
              <MenuItem value="checking">Checking</MenuItem>
            </TextField>

            <TextField
              label="Opening balance"
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              size="small"
              fullWidth
              disabled={isSubmitting}
            />

            {accountType === 'savings' ? (
              <TextField
                label="Minimum balance (optional)"
                type="number"
                value={minimumBalance}
                onChange={(e) => setMinimumBalance(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                size="small"
                fullWidth
                disabled={isSubmitting}
              />
            ) : (
              <TextField
                label="Overdraft limit (optional)"
                type="number"
                value={overdraftLimit}
                onChange={(e) => setOverdraftLimit(e.target.value)}
                slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                size="small"
                fullWidth
                disabled={isSubmitting}
              />
            )}

            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Opening…' : 'Open account'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  )
}

function TransferForm({
  fromAccount,
  otherAccounts,
  onSuccess,
}: {
  fromAccount: Account
  otherAccounts: Account[]
  onSuccess: () => void
}) {
  const [toAccountId, setToAccountId] = useState<string>('')
  const [amount, setAmount] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const parsedAmount = Number(amount)
    if (!toAccountId.trim()) {
      setFormError('Please select a destination account.')
      return
    }
    if (toAccountId.trim() === fromAccount.account_number) {
      setFormError('Please select a different destination account.')
      return
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('Please enter a valid amount greater than 0.')
      return
    }

    setIsSubmitting(true)
    try {
      await transferMoney({
        from_account_id: fromAccount.account_number,
        to_account_id: toAccountId,
        amount: parsedAmount,
        description: description.trim() || undefined,
      })
      onSuccess()
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Transfer failed. Please try again.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}

        <TextField
          label="To account number"
          value={toAccountId}
          onChange={(e) => setToAccountId(e.target.value)}
          placeholder={otherAccounts[0]?.account_number ?? 'e.g. ACC-456'}
          size="small"
          fullWidth
          disabled={isSubmitting}
        />
        <TextField
          label="Amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
          size="small"
          fullWidth
          disabled={isSubmitting}
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          size="small"
          fullWidth
          disabled={isSubmitting}
        />
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send transfer'}
        </Button>
      </Stack>
    </Box>
  )
}