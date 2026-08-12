/**
 * Calls for app/controllers/authController.py's /api/v1/auth/* routes.
 * This is the only service file that writes to token storage -- register,
 * login, and refresh are the moments new tokens exist; logout is the
 * moment they stop being valid.
 */

import api from './api'
import { clearTokens, isLoggedIn, setTokens } from './tokenStorage'
// UserRole is declared globally in src/types/index.d.ts -- no import needed.

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
}

/** Matches UserORM.to_dict() on the backend (models/database.py) -- never
 * includes hashed_password, since the backend never sends it. */
export interface AuthUser {
  user_id: string
  email: string
  role: UserRole
  customer_id: string | null
  branch_id: string | null
  is_active: boolean
  created_at: string
}

export interface RegisterPayload {
  email: string
  password: string
  name: string
  branch_id: string
}

export interface StaffCreatePayload {
  email: string
  password: string
  role: Exclude<UserRole, 'customer'>
  branch_id?: string
}

/** Public customer self-signup. Creates both the login and the bank
 * profile on the backend in one call (see authService.register_customer). */
export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/api/v1/auth/register', payload)
  setTokens(response.data.access_token, response.data.refresh_token)
  return response.data
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const response = await api.post<TokenResponse>('/api/v1/auth/login', { email, password })
  setTokens(response.data.access_token, response.data.refresh_token)
  return response.data
}

/** Revokes every token issued to this account (see security/dependencies.py's
 * token_version check) -- not just the one this browser tab is holding. */
export async function logout(): Promise<void> {
  try {
    await api.post('/api/v1/auth/logout')
  } finally {
    // Clear local tokens even if the request itself failed (e.g. already
    // offline, or the token was already invalid) -- there's no scenario
    // where holding onto a token after "logout" was clicked is correct.
    clearTokens()
  }
}

export async function getMe(): Promise<AuthUser> {
  const response = await api.get<AuthUser>('/api/v1/auth/me')
  return response.data
}

/** Admin-only (see require_roles(UserRole.ADMIN) on the backend route) --
 * staff can't grant themselves elevated roles through self-signup. */
export async function createStaff(payload: StaffCreatePayload): Promise<AuthUser> {
  const response = await api.post<AuthUser>('/api/v1/auth/staff', payload)
  return response.data
}

export { isLoggedIn }
