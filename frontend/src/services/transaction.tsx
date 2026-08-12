/**
 * Calls for app/controllers/transactionController.py's /api/v1/transactions
 * routes. Access rules enforced on the backend (security/dependencies.py +
 * transactionController.py's own comments):
 *   - createTransaction (deposit/withdraw) : teller/admin only
 *   - transferMoney                        : the owning customer (their own
 *                                             from_account only), or staff
 *   - listTransactions, getTransaction     : a customer sees only their own
 *                                             transactions; staff sees all
 */

import api from './api'
// Transaction and TransactionType are declared globally in src/types/index.d.ts -- no import needed.

export interface TransferPayload {
  from_account_id: string
  to_account_id: string
  amount: number
  description?: string
}

/** Body for the generic POST /api/v1/transactions route -- which of
 * from_account/to_account is required depends on transaction_type: Deposit
 * needs only to_account, Withdrawal needs only from_account, Transfer needs
 * both (see transactionService.create_transaction on the backend). */
export interface CreateTransactionPayload {
  from_account?: string
  to_account?: string
  amount: number
  transaction_type: TransactionType
}

export interface ListTransactionsParams {
  start_date?: string
  transaction_type?: string
}

/** Backend wire format (see transactionService._serialize). */
interface TransactionApiResponse {
  transaction_id: string
  from_account_id: string | null
  to_account_id: string | null
  amount: number
  description: string | null
  type: TransactionType
  timestamp: string
}

function toTransaction(raw: TransactionApiResponse): Transaction {
  return {
    transactionId: raw.transaction_id,
    type: raw.type,
    amount: raw.amount,
    fromAccountId: raw.from_account_id,
    toAccountId: raw.to_account_id,
    description: raw.description ?? undefined,
    timestamp: raw.timestamp,
  }
}

/** Deposit or withdrawal, on a customer's behalf. Teller/admin only. */
export async function createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
  const response = await api.post<TransactionApiResponse>('/api/v1/transactions', payload)
  return toTransaction(response.data)
}

export async function transferMoney(payload: TransferPayload): Promise<Transaction> {
  const response = await api.post<TransactionApiResponse>('/api/v1/transactions/transfer', payload)
  return toTransaction(response.data)
}

export async function listTransactions(params?: ListTransactionsParams): Promise<Transaction[]> {
  const response = await api.get<TransactionApiResponse[]>('/api/v1/transactions', { params })
  return response.data.map(toTransaction)
}

export async function getTransaction(transactionId: string): Promise<Transaction> {
  const response = await api.get<TransactionApiResponse>(`/api/v1/transactions/${transactionId}`)
  return toTransaction(response.data)
}
