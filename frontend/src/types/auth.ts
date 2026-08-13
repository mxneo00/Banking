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

export type StaffRole = 'teller' | 'branch_manager' | 'admin'

export const STAFF_ROLES: readonly UserRole[] = ['teller', 'branch_manager', 'admin']

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role != null && (STAFF_ROLES as readonly string[]).includes(role)
}

export function homePathForRole(role: UserRole | null | undefined): string {
  return isStaffRole(role) ? '/staff' : '/'
}

/** Staff-only paths (plus legacy analytics alias). */
export function isStaffPath(path: string): boolean {
  return (
    path === '/staff' ||
    path.startsWith('/staff/') ||
    path === '/analytics' ||
    path === '/transactions' ||
    path === '/cash-desk'
  )
}

export function canUseCashDesk(role: UserRole | null | undefined): boolean {
  return role === 'teller' || role === 'admin'
}

/**
 * After login, prefer the role home unless the user was headed somewhere
 * their role is allowed to open (avoids staff landing on customer `/`).
 */
export function resolvePostLoginPath(
  role: UserRole | null | undefined,
  requestedPath: string | undefined,
): string {
  const home = homePathForRole(role)
  if (!requestedPath || requestedPath === '/') {
    return home
  }
  if (isStaffRole(role)) {
    return isStaffPath(requestedPath) ? requestedPath : home
  }
  return isStaffPath(requestedPath) ? home : requestedPath
}

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

export type CreateStaffPayload = {
  email: string
  password: string
  role: StaffRole
  branch_id?: string | null
}
