/**
 * The one place in the frontend that touches localStorage for auth tokens.
 * Everything else (api.ts's request/response interceptors, auth.tsx) goes
 * through these functions rather than calling localStorage directly, so
 * swapping the storage mechanism later (e.g. to an httpOnly cookie set by
 * the backend, which is more XSS-resistant than localStorage) only means
 * changing this one file.
 */

const ACCESS_TOKEN_KEY = 'banking_access_token'
const REFRESH_TOKEN_KEY = 'banking_refresh_token'

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
}

/** Used after a refresh, when only a new access token comes back. */
export function setAccessToken(accessToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function isLoggedIn(): boolean {
  return getAccessToken() !== null
}