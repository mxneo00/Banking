/**
 * Compact accounts table for the Dashboard. "View all" sends the customer
 * to AccountPage.tsx for the full management view (open/transfer). Reuses
 * data DashboardPage already fetches; no separate call.
 */

import {
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material'

import type { Account } from '../types/account'
import PreviewCard from './PreviewCard'

const MAX_ROWS = 5

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function RecentAccountsPreview({ accounts }: { accounts: Account[] }) {
  const rows = accounts.slice(0, MAX_ROWS)

  return (
    <PreviewCard title="Accounts" viewAllTo="/accounts">
      {rows.length === 0 ? (
        <Typography color="text.secondary">No accounts yet.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableBody>
              {rows.map((account) => (
                <TableRow key={account.account_number} hover>
                  <TableCell sx={{ pl: 0 }}>
                    <Typography variant="body2">{account.account_number}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={account.account_type} variant="outlined" />
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatCurrency(account.balance)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </PreviewCard>
  )
}
