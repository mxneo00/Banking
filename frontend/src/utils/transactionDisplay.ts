/**
 * Shared display helpers for rendering a Transaction; pulled out of
 * TransactionHistoryPage.tsx so the Dashboard's recent-transactions preview
 * doesn't need its own copy.
 */

import type { TransactionType } from '../types/transaction'

export const TYPE_COLOR: Record<TransactionType, 'success' | 'warning' | 'info'> = {
  Deposit: 'success',
  Withdrawal: 'warning',
  Transfer: 'info',
}

export function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}
