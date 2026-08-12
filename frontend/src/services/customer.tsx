/**
 * Calls for app/controllers/customerController.py's /api/v1/customers
 * routes. Access rules enforced on the backend (not repeated here -- see
 * security/dependencies.py's ensure_self_or_staff/require_roles):
 *   - createCustomer, listCustomers, deactivateCustomer : staff only
 *   - getCustomer, updateCustomer                        : that customer, or staff
 */

import api from './api'
// CustomerProfile is declared globally in src/types/index.d.ts -- no import needed.

export interface CustomerCreatePayload {
  customer_id: string
  name: string
  email: string
  branch_id: string
}

export interface CustomerUpdatePayload {
  name?: string
  email?: string
}

export interface ListCustomersParams {
  branch_id?: string
  active_only?: boolean
}

/** The backend's wire format (see customerService._serialize_customer) --
 * snake_case, and includes account_numbers, which CustomerProfile doesn't
 * carry today. Kept private to this file; toCustomerProfile is the only
 * thing that needs to know the raw shape. */
interface CustomerApiResponse {
  customer_id: string
  name: string
  email: string
  branch_id: string
  is_active: boolean
  account_numbers: string[]
}

function toCustomerProfile(raw: CustomerApiResponse): CustomerProfile {
  return {
    customerId: raw.customer_id,
    name: raw.name,
    email: raw.email,
    branchId: raw.branch_id,
    isActive: raw.is_active,
  }
}

export async function createCustomer(payload: CustomerCreatePayload): Promise<CustomerProfile> {
  const response = await api.post<CustomerApiResponse>('/api/v1/customers', payload)
  return toCustomerProfile(response.data)
}

export async function listCustomers(params?: ListCustomersParams): Promise<CustomerProfile[]> {
  const response = await api.get<CustomerApiResponse[]>('/api/v1/customers', { params })
  return response.data.map(toCustomerProfile)
}

export async function getCustomer(customerId: string): Promise<CustomerProfile> {
  const response = await api.get<CustomerApiResponse>(`/api/v1/customers/${customerId}`)
  return toCustomerProfile(response.data)
}

export async function updateCustomer(customerId: string, payload: CustomerUpdatePayload): Promise<CustomerProfile> {
  const response = await api.put<CustomerApiResponse>(`/api/v1/customers/${customerId}`, payload)
  return toCustomerProfile(response.data)
}

export async function deactivateCustomer(customerId: string): Promise<void> {
  await api.delete(`/api/v1/customers/${customerId}`)
}
