/**
 * Calls for app/controllers/accountController.py's /api/v1/accounts routes.
 * Access rules enforced on the backend: openAccount/getAccount both require
 * the account to belong to you, unless you're staff (ensure_self_or_staff).
 */

import api from './api'
// Account and AccountType are declared globally in src/types/index.d.ts -- no import needed.

export interface AccountCreatePayload {
  customer_id: string
  account_type: AccountType
  opening_balance?: number
  /** Savings only -- rejected by the backend if paired with checking. */
  minimum_balance?: number
  /** Checking only -- rejected by the backend if paired with savings. */
  overdraft_limit?: number
}

/** Backend wire format (see models/database.py's Account.to_dict()). */
interface AccountApiResponse {
  account_number: string
  customer_id: string
  account_type: AccountType
  balance: number
  branch_code: string
  is_active: boolean
  minimum_balance?: number
  overdraft_limit?: number
}

function toAccount(raw: AccountApiResponse): Account {
  return {
    accountNumber: raw.account_number,
    accountType: raw.account_type,
    balance: raw.balance,
    isActive: raw.is_active,
    minimumBalance: raw.minimum_balance,
    overdraftLimit: raw.overdraft_limit,
  }
}

export async function openAccount(payload: AccountCreatePayload): Promise<Account> {
  const response = await api.post<AccountApiResponse>('/api/v1/accounts', payload)
  return toAccount(response.data)
}

export async function getAccount(accountNumber: string): Promise<Account> {
  const response = await api.get<AccountApiResponse>(`/api/v1/accounts/${accountNumber}`)
  return toAccount(response.data)
}
