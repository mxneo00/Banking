/**
 * Types for customer profile and account responses.
 *
 * Mirrors FastAPI shapes from `customerService._serialize_customer` and
 * `Account.to_dict` so dashboard/account pages stay typed end-to-end.
 */

export type Customer = {
  customer_id: string
  name: string
  email: string
  branch_id: string
  is_active: boolean
  account_numbers: string[]
}

export type Account = {
  account_number: string
  customer_id: string
  account_type: string
  balance: number
  branch_code: string
  is_active: boolean
  minimum_balance?: number
  overdraft_limit?: number
}
