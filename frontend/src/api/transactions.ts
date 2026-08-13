/**
 * Transaction API functions — thin wrappers around `/api/v1/transactions/*`
 * endpoints. Same pattern as `api/auth.ts`/`api/accounts.ts`/`api/customers.ts`:
 * a typed function per backend route (`app/controllers/transactionController.py`),
 * built on the shared `apiClient`.
 *
 * RBAC note (enforced on the backend, not repeated here):
 *   - createTransaction (deposit/withdraw) : teller/admin only
 *   - transferMoney                        : the owning customer (their own
 *                                             from_account_id only), or staff
 *   - listTransactions, getTransaction     : a customer sees only transactions
 *                                             touching their own account(s);
 *                                             staff sees everything
 */

import { apiClient } from './client'
import type {
  CreateTransactionPayload,
  ListTransactionsParams,
  Transaction,
  TransferPayload,
} from '../types/transaction'

/** Deposit or withdrawal, on a customer's behalf. Teller/admin only. */
export async function createTransaction(payload: CreateTransactionPayload): Promise<Transaction> {
  const { data } = await apiClient.post<Transaction>('/api/v1/transactions', payload)
  return data
}

export async function transferMoney(payload: TransferPayload): Promise<Transaction> {
  const { data } = await apiClient.post<Transaction>('/api/v1/transactions/transfer', payload)
  return data
}

export async function listTransactions(params?: ListTransactionsParams): Promise<Transaction[]> {
  const { data } = await apiClient.get<Transaction[]>('/api/v1/transactions', { params })
  return data
}

export async function getTransaction(transactionId: string): Promise<Transaction> {
  const { data } = await apiClient.get<Transaction>(`/api/v1/transactions/${transactionId}`)
  return data
}
