/**
 * Shared TypeScript types for transactions.
 *
 * Mirrors transactionService._serialize's response shape directly
 * (snake_case, no camelCase mapping layer) -- same convention as
 * types/auth.ts's User, types/account.ts's Account, types/customer.ts's Customer.
 */

// Exact casing matters -- must match app/models/domain.py's TransactionType
// enum values ("Deposit"/"Withdrawal"/"Transfer", title case), which the
// backend validates the incoming transaction_type against literally.
export type TransactionType = 'Deposit' | 'Withdrawal' | 'Transfer'

export type Transaction = {
  transaction_id: string
  from_account_id: string | null
  to_account_id: string | null
  amount: number
  description: string | null
  type: TransactionType
  timestamp: string
}

/**
 * Body for POST /api/v1/transactions (deposit/withdraw, teller/admin only).
 * Which of from_account/to_account is required depends on transaction_type:
 * Deposit needs only to_account, Withdrawal needs only from_account -- see
 * transactionService.create_transaction on the backend.
 */
export type CreateTransactionPayload = {
  from_account?: string
  to_account?: string
  amount: number
  transaction_type: TransactionType
}

export type TransferPayload = {
  from_account_id: string
  to_account_id: string
  amount: number
  description?: string
}

export type ListTransactionsParams = {
  start_date?: string
  transaction_type?: string
}
