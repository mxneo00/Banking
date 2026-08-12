/**
 * Customer API helpers — thin wrappers around `/api/v1/customers/*`.
 */

import { apiClient } from './client'
import type { Customer } from '../types/banking'

export async function fetchCustomer(customerId: string): Promise<Customer> {
  const { data } = await apiClient.get<Customer>(`/api/v1/customers/${customerId}`)
  return data
}
