/**
 * HTTP client and token persistence for all authenticated API calls.
 *
 * Responsibilities:
 * - `apiClient` — axios instance pointed at `VITE_API_URL` (see `.env.example`).
 * - `tokenStorage` — read/write access + refresh tokens in localStorage.
 * - Request interceptor — attaches `Authorization: Bearer <access_token>`.
 * - Response interceptor — on 401, calls `/auth/refresh` once and retries.
 * - `getApiErrorMessage` — maps FastAPI `{ message }` errors for UI display.
 *
 * Use `apiClient` for every backend request (accounts, transactions, etc.).
 * Auth-specific endpoints live in `api/auth.ts`; this file is the transport layer.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

export const tokenStorage = {
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  },
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  },
  setTokens(accessToken: string, refreshToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  },
  setAccessToken(accessToken: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
  },
  clear() {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const accessToken = tokenStorage.getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Module-level (not per-request) so concurrent 401s share one in-flight
// refresh instead of each firing its own POST /auth/refresh. Whoever hits
// the 401 first starts the request and stores the promise here; everyone
// else who 401s while it's pending just awaits the same promise. Reset to
// null once it settles so the next expiry starts a fresh refresh.
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) {
    return null
  }

  try {
    // Plain axios, not apiClient -- going through apiClient would route this
    // request through the same response interceptor below, and a failed
    // refresh returning 401 would try to refresh itself into a loop.
    const { data } = await axios.post<{ access_token: string }>(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      { refresh_token: refreshToken },
      { headers: { 'Content-Type': 'application/json' } },
    )
    tokenStorage.setAccessToken(data.access_token)
    return data.access_token
  } catch {
    // Refresh token itself is invalid/expired -- nothing left to try, so
    // clear both tokens and force the user back through login.
    tokenStorage.clear()
    return null
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const isAuthRefresh = originalRequest?.url?.includes('/api/v1/auth/refresh')

    // Only a 401 is worth retrying, and only once per request (_retry guards
    // against looping if the refreshed token still comes back 401). Also
    // skip the refresh endpoint's own 401s here -- refreshAccessToken()
    // already handles that failure directly above.
    if (error.response?.status !== 401 || originalRequest._retry || isAuthRefresh) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    // Kick off (or join) the single shared refresh described above.
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null
      })
    }

    const newAccessToken = await refreshPromise
    if (!newAccessToken) {
      return Promise.reject(error)
    }

    // Re-issue the original request with the new token rather than making
    // the caller retry manually -- from the caller's point of view the
    // request just succeeded, slightly late.
    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
    return apiClient(originalRequest)
  },
)

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined
    if (data?.message) {
      return data.message
    }
  }
  return fallback
}
