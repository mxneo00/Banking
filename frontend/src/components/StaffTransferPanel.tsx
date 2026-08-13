/**
 * Staff transfer workspace — pick source and destination, then
 * POST /api/v1/transactions/transfer.
 *
 * Account search is a typeahead over the customer directory. Selecting a
 * result fetches that account; there is no separate lookup control.
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Alert, Box, Button, Card, CardContent, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import { fetchAccount } from '../api/accounts'
import { getApiErrorMessage } from '../api/client'
import { fetchCustomer, listCustomers } from '../api/customers'
import { listTransactions, transferMoney } from '../api/transactions'
import TransferAccountPicker, {
  type AccountOption,
  type SelectedAccount,
} from './TransferAccountPicker'
import type { Transaction } from '../types/transaction'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function recentForAccount(rows: Transaction[], accountNumber: string): Transaction[] {
  return rows
    .filter((tx) => tx.from_account_id === accountNumber || tx.to_account_id === accountNumber)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3)
}

export default function StaffTransferPanel() {
  const [options, setOptions] = useState<AccountOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  const [from, setFrom] = useState<SelectedAccount | null>(null)
  const [to, setTo] = useState<SelectedAccount | null>(null)
  const [fromLoading, setFromLoading] = useState(false)
  const [toLoading, setToLoading] = useState(false)
  const [fromError, setFromError] = useState<string | null>(null)
  const [toError, setToError] = useState<string | null>(null)

  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDirectory() {
      setOptionsLoading(true)
      setOptionsError(null)
      try {
        const customers = await listCustomers()
        if (cancelled) return
        const next: AccountOption[] = []
        for (const customer of customers) {
          for (const accountNumber of customer.account_numbers) {
            next.push({
              accountNumber,
              customerName: customer.name,
              customerId: customer.customer_id,
              email: customer.email,
              branchId: customer.branch_id,
            })
          }
        }
        setOptions(next)
      } catch (err) {
        if (!cancelled) {
          setOptions([])
          setOptionsError(getApiErrorMessage(err, 'Could not load accounts.'))
        }
      } finally {
        if (!cancelled) {
          setOptionsLoading(false)
        }
      }
    }

    void loadDirectory()
    return () => {
      cancelled = true
    }
  }, [])

  async function chooseSide(side: 'from' | 'to', option: AccountOption) {
    const setSelected = side === 'from' ? setFrom : setTo
    const setLoading = side === 'from' ? setFromLoading : setToLoading
    const setSideError = side === 'from' ? setFromError : setToError

    setLoading(true)
    setSideError(null)
    setSuccess(null)
    try {
      const [account, ledger] = await Promise.all([
        fetchAccount(option.accountNumber),
        listTransactions(),
      ])
      let resolved = option
      if (option.manual || !option.customerName) {
        try {
          const customer = await fetchCustomer(account.customer_id)
          resolved = {
            accountNumber: account.account_number,
            customerName: customer.name,
            customerId: customer.customer_id,
            email: customer.email,
            branchId: customer.branch_id,
          }
        } catch {
          resolved = {
            accountNumber: account.account_number,
            customerName: account.customer_id,
            customerId: account.customer_id,
            email: '',
            branchId: account.branch_code,
          }
        }
      }
      setSelected({
        option: resolved,
        account,
        recent: recentForAccount(ledger, account.account_number),
      })
    } catch (err) {
      setSelected(null)
      setSideError(getApiErrorMessage(err, 'Could not open that account.'))
    } finally {
      setLoading(false)
    }
  }

  function handleSwap() {
    setFrom(to)
    setTo(from)
    setFromError(null)
    setToError(null)
    setError(null)
    setSuccess(null)
  }

  const parsedAmount = Number(amount)
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0
  const sameAccount =
    from != null && to != null && from.account.account_number === to.account.account_number
  const inactiveSide =
    (from != null && !from.account.is_active) || (to != null && !to.account.is_active)
  const canSubmit =
    from != null && to != null && amountValid && !sameAccount && !inactiveSide && !submitting

  const preview = useMemo(() => {
    if (!from || !to) {
      return 'Select a source and destination account.'
    }
    if (sameAccount) {
      return 'Source and destination must be different accounts.'
    }
    if (inactiveSide) {
      return 'Both accounts must be active.'
    }
    if (!amountValid) {
      return `From ${from.account.account_number} to ${to.account.account_number}.`
    }
    return `${formatCurrency(parsedAmount)} from ${from.account.account_number} to ${to.account.account_number}.`
  }, [from, to, sameAccount, inactiveSide, amountValid, parsedAmount])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!from || !to) {
      setError('Select both a source and a destination account.')
      return
    }
    if (sameAccount) {
      setError('Cannot transfer money to the same account.')
      return
    }
    if (!amountValid) {
      setError('Amount must be greater than 0.')
      return
    }
    if (inactiveSide) {
      setError('Cannot transfer using an inactive account.')
      return
    }

    setSubmitting(true)
    try {
      const tx = await transferMoney({
        from_account_id: from.account.account_number,
        to_account_id: to.account.account_number,
        amount: parsedAmount,
        description: description.trim() || undefined,
      })
      setSuccess(
        `Transferred ${formatCurrency(tx.amount)} from ${tx.from_account_id} to ${tx.to_account_id}.`,
      )
      setAmount('')
      setDescription('')
      try {
        const [refreshedFrom, refreshedTo, ledger] = await Promise.all([
          fetchAccount(from.account.account_number),
          fetchAccount(to.account.account_number),
          listTransactions(),
        ])
        setFrom({
          ...from,
          account: refreshedFrom,
          recent: recentForAccount(ledger, refreshedFrom.account_number),
        })
        setTo({
          ...to,
          account: refreshedTo,
          recent: recentForAccount(ledger, refreshedTo.account_number),
        })
      } catch {
        // Non-fatal; the transfer itself succeeded.
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not complete transfer.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Stack spacing={3}>
      {optionsError && <Alert severity="error">{optionsError}</Alert>}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'stretch' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <TransferAccountPicker
            label="From"
            accent="primary"
            options={options}
            optionsLoading={optionsLoading}
            excludeAccountNumber={to?.account.account_number}
            selected={from}
            loading={fromLoading}
            error={fromError}
            onChoose={(option) => void chooseSide('from', option)}
            onClear={() => {
              setFrom(null)
              setFromError(null)
              setSuccess(null)
            }}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'center', md: 'center' },
            justifyContent: 'center',
            py: { xs: 0, md: 0 },
          }}
        >
          <Tooltip title="Swap accounts">
            <span>
              <IconButton
                onClick={handleSwap}
                disabled={!from && !to}
                aria-label="Swap source and destination"
                sx={{ transform: { xs: 'rotate(90deg)', md: 'none' } }}
              >
                <SwapHorizIcon />
              </IconButton>
            </span>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <TransferAccountPicker
            label="To"
            accent="secondary"
            options={options}
            optionsLoading={optionsLoading}
            excludeAccountNumber={from?.account.account_number}
            selected={to}
            loading={toLoading}
            error={toError}
            onChoose={(option) => void chooseSide('to', option)}
            onClear={() => {
              setTo(null)
              setToError(null)
              setSuccess(null)
            }}
          />
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
                  ? 'Transferring…'
                  : amountValid
                    ? `Transfer ${formatCurrency(parsedAmount)}`
                    : 'Transfer'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  )
}
