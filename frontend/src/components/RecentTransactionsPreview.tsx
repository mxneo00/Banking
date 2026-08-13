/**
 * Compact recent-transactions table for the Dashboard. "View all" sends
 * the customer to TransactionHistoryPage.tsx for the full sortable/filterable
 * view. Expects transactions already sorted however the caller wants
 * (DashboardPage passes the most recent first) and just takes the first few.
 */

import { Chip, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from '@mui/material'

import type { Transaction } from '../types/transaction'
import { TYPE_COLOR, formatTimestamp } from '../utils/transactionDisplay'
import PreviewCard from './PreviewCard'

const MAX_ROWS = 5

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function RecentTransactionsPreview({ transactions }: { transactions: Transaction[] }) {
  const rows = transactions.slice(0, MAX_ROWS)

  return (
    <PreviewCard title="Recent transactions" viewAllTo="/transaction-history">
      {rows.length === 0 ? (
        <Typography color="text.secondary">No transactions yet.</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableBody>
              {rows.map((tx) => (
                <TableRow key={tx.transaction_id} hover>
                  <TableCell sx={{ pl: 0 }}>
                    <Typography variant="body2" color="text.secondary">
                      {formatTimestamp(tx.timestamp)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={tx.type} color={TYPE_COLOR[tx.type]} variant="outlined" />
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 600, color: (t) => t.palette[TYPE_COLOR[tx.type]].main }}
                    >
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
      )}
    </PreviewCard>
  )
}
