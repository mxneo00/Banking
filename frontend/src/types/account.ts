/**
 * Shared TypeScript types for accounts.
 *
 * Mirrors app/models/database.py's Account.to_dict() directly (snake_case,
 * no camelCase mapping layer) -- same convention as types/auth.ts's User.
 */

export type AccountType = 'savings' | 'checking'

export type Account = {
  account_number: string
  customer_id: string
  account_type: AccountType
  balance: number
  branch_code: string
  is_active: boolean
  /** Savings accounts only -- omitted by the backend for checking accounts. */
  minimum_balance?: number
  /** Checking accounts only -- omitted by the backend for savings accounts. */
  overdraft_limit?: number
}

export type AccountCreatePayload = {
  customer_id: string
  account_type: AccountType
  opening_balance?: number
  minimum_balance?: number
  overdraft_limit?: number
}

export type ListAccountsParams = {
  customer_id?: string
  branch_code?: string
}
