import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'

import type { Account, AccountType } from '../types/account'
import DonutChart, { type DonutSlice } from './DonutChart'

const TYPE_COLORS: Record<AccountType, string> = {
  checking: '#0b3d91',
  savings: '#1b7f5a',
}
const FALLBACK_COLOR = '#898781'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function TotalBalanceCard({ accounts }: { accounts: Account[] }) {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0)

  const inactiveCount = accounts.filter((a) => !a.is_active).length
  // "Overdrawn" only applies to checking (savings can never go negative --
  // its own withdrawal rule enforces the minimum balance instead).
  const overdrawnCount = accounts.filter((a) => a.account_type === 'checking' && a.balance < 0).length
  // "At minimum" only applies to savings accounts that actually have a
  // minimum_balance set, and flags once the balance has reached (or
  // dipped at/below) that floor -- an early warning before a withdrawal
  // would be rejected.
  const atMinimumCount = accounts.filter(
    (a) => a.account_type === 'savings' && a.minimum_balance != null && a.balance <= a.minimum_balance,
  ).length

  const slices: DonutSlice[] = accounts.map((account) => ({
    label: account.account_number,
    value: account.balance,
    color: TYPE_COLORS[account.account_type] ?? FALLBACK_COLOR,
  }))

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AccountBalanceWalletIcon color="primary" />
          <Typography variant="subtitle1">Total balance</Typography>
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <Typography variant="h4">{formatCurrency(total)}</Typography>
        </Box>

        {(inactiveCount > 0 || overdrawnCount > 0 || atMinimumCount > 0) && (
          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
            {overdrawnCount > 0 && (
              <Chip
                size="small"
                color="error"
                label={`${overdrawnCount} overdrawn`}
              />
            )}
            {atMinimumCount > 0 && (
              <Chip
                size="small"
                color="warning"
                label={`${atMinimumCount} at minimum`}
              />
            )}
            {inactiveCount > 0 && (
              <Chip
                size="small"
                variant="outlined"
                label={`${inactiveCount} inactive`}
              />
            )}
          </Stack>
        )}

        {accounts.length > 0 && (
          <DonutChart
            slices={slices}
            centerContent={
              <Typography variant="body2" color="text.secondary" component="div">
                {accounts.length} account{accounts.length === 1 ? '' : 's'}
              </Typography>
            }
          />
        )}
      </CardContent>
    </Card>
  )
}
