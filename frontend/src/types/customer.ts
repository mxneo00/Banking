/**
 * Shared TypeScript types for customers.
 *
 * Mirrors customerService._serialize_customer's response shape directly
 * (snake_case, no camelCase mapping layer) -- same convention as
 * types/auth.ts's User and types/account.ts's Account.
 */

export type Customer = {
  customer_id: string
  name: string
  email: string
  branch_id: string
  is_active: boolean
  account_numbers: string[]
}
