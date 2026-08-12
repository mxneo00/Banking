/**
 * Account API helpers — thin wrappers around `/api/v1/accounts/*`.
 *
 * There is no list-by-customer endpoint yet; callers load account numbers
 * from the customer profile, then fetch each account individually.
 */

import { apiClient } from './client'
import type { Account } from '../types/banking'

export async function fetchAccount(accountNumber: string): Promise<Account> {
  const { data } = await apiClient.get<Account>(`/api/v1/accounts/${accountNumber}`)
  return data
}

export async function fetchAccounts(accountNumbers: string[]): Promise<Account[]> {
  if (accountNumbers.length === 0) {
    return []
  }
  return Promise.all(accountNumbers.map((number) => fetchAccount(number)))
}
