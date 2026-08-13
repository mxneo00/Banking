/**
 * Client-side CSV export -- no backend endpoint needed, just formats data
 * already in memory and triggers a browser download via a Blob URL.
 */

import type { Transaction } from '../types/transaction'

/** Wraps a cell in quotes (escaping embedded quotes) only if it needs it. */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function transactionsToCsv(transactions: Transaction[]): string {
  const header = ['Date', 'Type', 'From Account', 'To Account', 'Description', 'Amount']
  const rows = transactions.map((tx) => [
    tx.timestamp,
    tx.type,
    tx.from_account_id ?? '',
    tx.to_account_id ?? '',
    tx.description ?? '',
    tx.amount.toFixed(2),
  ])

  return [header, ...rows].map((row) => row.map((cell) => csvCell(String(cell))).join(',')).join('\r\n')
}

export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
