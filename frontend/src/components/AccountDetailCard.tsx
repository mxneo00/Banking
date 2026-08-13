/**
 * Account detail card for teller cash desk — shown after an account is selected.
 * Uses only fields already returned by GET /accounts/{number} plus recent ledger rows.
 */

import type { ReactNode } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import type { Account } from '../types/account'
import type { Transaction } from '../types/transaction'

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

type AccountDetailCardProps = {
  account: Account
  customerName?: string | null
  recentTransactions: Transaction[]
  loadingTransactions?: boolean
  transactionsError?: string | null
}

export default function AccountDetailCard({
  account,
  customerName,
  recentTransactions,
  loadingTransactions = false,
  transactionsError = null,
}: AccountDetailCardProps) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <AccountBalanceIcon color="primary" />
          <Typography variant="h6">Account details</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {account.account_number}
          {customerName ? ` · ${customerName}` : ''}
        </Typography>

        <Stack spacing={1.25} sx={{ mb: 2 }}>
          <DetailRow label="Customer ID" value={account.customer_id} />
          <DetailRow
            label="Account type"
            value={<Chip size="small" label={account.account_type} variant="outlined" />}
          />
          <DetailRow label="Balance" value={formatCurrency(account.balance)} emphasize />
          {account.minimum_balance != null && (
            <DetailRow label="Minimum balance" value={formatCurrency(account.minimum_balance)} />
          )}
          {account.overdraft_limit != null && (
            <DetailRow label="Overdraft limit" value={formatCurrency(account.overdraft_limit)} />
          )}
          <DetailRow label="Branch" value={account.branch_code} />
          <DetailRow
            label="Status"
            value={
              <Chip
                size="small"
                label={account.is_active ? 'active' : 'inactive'}
                color={account.is_active ? 'success' : 'default'}
                variant="outlined"
              />
            }
          />
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" gutterBottom>
          Last transactions
        </Typography>
        {loadingTransactions && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={18} />
            <Typography variant="body2" color="text.secondary">
              Loading recent activity…
            </Typography>
          </Stack>
        )}
        {transactionsError && <Alert severity="warning">{transactionsError}</Alert>}
        {!loadingTransactions && !transactionsError && recentTransactions.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            No transactions for this account yet.
          </Typography>
        )}
        {!loadingTransactions && recentTransactions.length > 0 && (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentTransactions.map((tx) => (
                <TableRow key={tx.transaction_id}>
                  <TableCell>{formatTimestamp(tx.timestamp)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={tx.type} variant="outlined" />
                  </TableCell>
                  <TableCell align="right">{formatCurrency(tx.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function DetailRow({
  label,
  value,
  emphasize = false,
}: {
  label: string
  value: ReactNode
  emphasize?: boolean
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      {typeof value === 'string' || typeof value === 'number' ? (
        <Typography
          variant={emphasize ? 'subtitle1' : 'body2'}
          sx={{ fontWeight: emphasize ? 600 : 400 }}
        >
          {value}
        </Typography>
      ) : (
        value
      )}
    </Stack>
  )
}
