/**
 * Customer send-money workspace.
 *
 * Backend rule (POST /api/v1/transactions/transfer): a customer may debit
 * only an account they own; the destination may be anyone's. This UI never
 * offers a source except the caller's own accounts, and never looks up an
 * external destination (GET /accounts/{id} is owner-or-staff).
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { fetchAccounts } from '../api/accounts'
import { getApiErrorMessage } from '../api/client'
import { fetchCustomer } from '../api/customers'
import { transferMoney } from '../api/transactions'
import { useAuth } from '../context/AuthContext'
import type { Account } from '../types/account'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

export default function CustomerTransferPanel() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    if (!user?.customer_id) {
      setAccounts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const profile = await fetchCustomer(user.customer_id)
      const rows = await fetchAccounts(profile.account_numbers)
      setAccounts(rows)
      setFromId((current) => {
        if (current && rows.some((account) => account.account_number === current)) {
          return current
        }
        const firstActive = rows.find((account) => account.is_active)
        return firstActive?.account_number ?? ''
      })
    } catch (err) {
      setAccounts([])
      setLoadError(getApiErrorMessage(err, 'Could not load your accounts.'))
    } finally {
      setLoading(false)
    }
  }, [user?.customer_id])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const ownNumbers = useMemo(
    () => new Set(accounts.map((account) => account.account_number)),
    [accounts],
  )
  const fromAccount = accounts.find((account) => account.account_number === fromId) ?? null
  const toOwnAccount = accounts.find((account) => account.account_number === toId.trim()) ?? null
  const destinationOptions = accounts.filter(
    (account) => account.account_number !== fromId && account.is_active,
  )
  const toIsExternal = toId.trim().length > 0 && !ownNumbers.has(toId.trim())

  const parsedAmount = Number(amount)
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0
  const sameAccount = fromId.trim() !== '' && fromId.trim() === toId.trim()
  const canSubmit =
    fromAccount != null &&
    fromAccount.customer_id === user?.customer_id &&
    fromAccount.is_active &&
    toId.trim() !== '' &&
    !sameAccount &&
    amountValid &&
    !submitting

  const preview = useMemo(() => {
    if (!fromAccount) {
      return 'Choose one of your accounts to send from.'
    }
    if (!fromAccount.is_active) {
      return 'The source account is inactive.'
    }
    if (!toId.trim()) {
      return 'Enter a destination account number.'
    }
    if (sameAccount) {
      return 'Source and destination must be different accounts.'
    }
    const destLabel = toOwnAccount
      ? `your ${toOwnAccount.account_type} ${toOwnAccount.account_number}`
      : toId.trim()
    if (!amountValid) {
      return `From ${fromAccount.account_number} to ${destLabel}.`
    }
    return `${formatCurrency(parsedAmount)} from ${fromAccount.account_number} to ${destLabel}.`
  }, [fromAccount, toId, sameAccount, toOwnAccount, amountValid, parsedAmount])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!fromAccount || fromAccount.customer_id !== user?.customer_id) {
      setError('You can only send from one of your own accounts.')
      return
    }
    if (!fromAccount.is_active) {
      setError('Cannot transfer using an inactive account.')
      return
    }
    const destination = toId.trim()
    if (!destination) {
      setError('Destination account is required.')
      return
    }
    if (destination === fromAccount.account_number) {
      setError('Cannot transfer money to the same account.')
      return
    }
    if (!amountValid) {
      setError('Amount must be greater than 0.')
      return
    }

    setSubmitting(true)
    try {
      const tx = await transferMoney({
        from_account_id: fromAccount.account_number,
        to_account_id: destination,
        amount: parsedAmount,
        description: description.trim() || undefined,
      })
      setSuccess(
        `Sent ${formatCurrency(tx.amount)} from ${tx.from_account_id} to ${tx.to_account_id}.`,
      )
      setAmount('')
      setDescription('')
      await loadAccounts()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not complete transfer.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!user?.customer_id) {
    return <Alert severity="info">Sign in as a customer to send money.</Alert>
  }

  if (loading) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CircularProgress size={22} />
        <Typography color="text.secondary">Loading your accounts…</Typography>
      </Stack>
    )
  }

  if (loadError) {
    return <Alert severity="error">{loadError}</Alert>
  }

  if (accounts.length === 0) {
    return <Alert severity="info">Open an account before sending money.</Alert>
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'stretch' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card variant="outlined" sx={{ height: '100%', borderTop: 3, borderTopColor: 'primary.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
                From
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Only your accounts. The bank will reject a debit from anyone else’s.
              </Typography>
              <FormControl fullWidth>
                <InputLabel id="customer-from-account-label">Your account</InputLabel>
                <Select
                  labelId="customer-from-account-label"
                  label="Your account"
                  value={fromId}
                  onChange={(event) => {
                    setFromId(event.target.value)
                    setSuccess(null)
                  }}
                >
                  {accounts.map((account) => (
                    <MenuItem
                      key={account.account_number}
                      value={account.account_number}
                      disabled={!account.is_active}
                    >
                      {account.account_number} · {account.account_type} ·{' '}
                      {formatCurrency(account.balance)}
                      {!account.is_active && ' (inactive)'}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {fromAccount && (
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', mt: 2 }}>
                  <Chip size="small" label={fromAccount.account_type} variant="outlined" />
                  <Chip
                    size="small"
                    label={fromAccount.is_active ? 'active' : 'inactive'}
                    color={fromAccount.is_active ? 'success' : 'default'}
                    variant="outlined"
                  />
                  <Chip size="small" label={formatCurrency(fromAccount.balance)} variant="outlined" />
                </Stack>
              )}
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Card variant="outlined" sx={{ height: '100%', borderTop: 3, borderTopColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
                To
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Another of your accounts, or any account number at this bank.
              </Typography>
              <Autocomplete
                freeSolo
                options={destinationOptions.map((account) => account.account_number)}
                inputValue={toId}
                onInputChange={(_event, value) => {
                  setToId(value)
                  setSuccess(null)
                }}
                renderOption={(props, option) => {
                  const match = destinationOptions.find((account) => account.account_number === option)
                  return (
                    <Box component="li" {...props} key={option}>
                      <Box>
                        <Typography variant="body2">{option}</Typography>
                        {match && (
                          <Typography variant="caption" color="text.secondary">
                            Your {match.account_type} · {formatCurrency(match.balance)}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  )
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Destination"
                    placeholder="e.g. ACC-456"
                    helperText="Your accounts are listed. Type a number to send elsewhere."
                  />
                )}
              />
              {toOwnAccount && toOwnAccount.account_number !== fromId && (
                <Chip size="small" label={`Your ${toOwnAccount.account_type}`} sx={{ mt: 2 }} variant="outlined" />
              )}
              {toIsExternal && (
                <Chip size="small" color="secondary" label="External account" sx={{ mt: 2 }} variant="outlined" />
              )}
            </CardContent>
          </Card>
        </Box>
      </Stack>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Amount
          </Typography>
          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Amount"
                type="number"
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                slotProps={{ htmlInput: { min: 0.01, step: '0.01' } }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Optional"
                sx={{ flex: 2 }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {preview}
            </Typography>
            <Box>
              <Button type="submit" variant="contained" disabled={!canSubmit}>
                {submitting
                  ? 'Sending…'
                  : amountValid
                    ? `Send ${formatCurrency(parsedAmount)}`
                    : 'Send'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
