/**
 * This file contains functions for interacting with the transactions API.
 */

import { apiClient } from './client'
import type { Transaction, TransferRequest } from '../types/banking'

export async function transferMoney(payload: TransferRequest): Promise<Transaction> {
  const { data } = await apiClient.post<Transaction>('/api/v1/transactions/transfer', payload)
  return data
}