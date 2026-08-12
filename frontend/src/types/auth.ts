/**
 * Shared TypeScript types for authentication.
 *
 * Mirrors the FastAPI auth schemas (`UserOut`, `TokenResponse`, login/register
 * bodies) so API responses and AuthContext state stay typed end-to-end.
 *
 * When extending the frontend:
 * - Add new fields here when the backend exposes them on `/auth/me` or tokens.
 * - Import these types in API modules and pages instead of redefining shapes.
 */

export type UserRole = 'customer' | 'teller' | 'branch_manager' | 'admin'

export type User = {
  user_id: string
  email: string
  role: UserRole
  customer_id: string | null
  branch_id: string | null
  is_active: boolean
  created_at: string
}

export type TokenResponse = {
  access_token: string
  refresh_token: string
  token_type: string
}

export type LoginCredentials = {
  email: string
  password: string
}

export type RegisterCredentials = {
  email: string
  password: string
  name: string
  branch_id: string
}
