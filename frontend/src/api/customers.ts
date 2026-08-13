/**
 * Customer API helpers — thin wrappers around `/api/v1/customers/*`.
 */

import { apiClient } from './client'
import type { Customer } from '../types/customer'

export async function fetchCustomer(customerId: string): Promise<Customer> {
  const { data } = await apiClient.get<Customer>(`/api/v1/customers/${customerId}`)
  return data
}

export async function listCustomers(params?: {
  branch_id?: string
  active_only?: boolean
}): Promise<Customer[]> {
  const { data } = await apiClient.get<Customer[]>('/api/v1/customers', { params })
  return data
}
