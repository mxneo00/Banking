/**
 * Auth API functions — thin wrappers around `/api/v1/auth/*` endpoints.
 *
 * Each function maps 1:1 to a backend route in `app/controllers/authController.py`.
 * These are called by `AuthContext` (login/register/logout/session restore), not
 * directly by pages whenever possible — keep UI logic in context/hooks.
 *
 * To add auth features (e.g. staff onboarding, password reset):
 * - Add a typed function here using `apiClient`.
 * - Expose it through `AuthContext` or a dedicated hook if UI needs it.
 */

import { apiClient } from './client'
import type {
  LoginCredentials,
  RegisterCredentials,
  TokenResponse,
  User,
} from '../types/auth'

export async function loginRequest(credentials: LoginCredentials): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/login', credentials)
  return data
}

export async function registerRequest(credentials: RegisterCredentials): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/api/v1/auth/register', credentials)
  return data
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<User>('/api/v1/auth/me')
  return data
}

export async function logoutRequest(): Promise<void> {
  await apiClient.post('/api/v1/auth/logout')
}
