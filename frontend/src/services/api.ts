/**
 * The shared axios client every other service file (auth.tsx, customer.tsx,
 * account.tsx, transaction.tsx, employee.tsx) is built on top of. Handles
 * the two cross-cutting auth concerns so individual endpoint functions
 * don't have to think about either one:
 *
 *  1. Attach `Authorization: Bearer <access_token>` to every outgoing
 *     request, if we have one.
 *  2. On a 401 (access token expired -- they're short-lived on purpose,
 *     see security/tokens.py's ACCESS_TOKEN_EXPIRE_MINUTES on the backend),
 *     try ONCE to silently refresh via /api/v1/auth/refresh and replay the
 *     original request, instead of forcing a re-login every 30 minutes.
 */

import axios from 'axios'
import type { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { clearTokens, getAccessToken, getRefreshToken, setAccessToken } from './tokenStorage'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000'

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Marks a request as "already retried once after a refresh" so a request
// that fails again post-refresh doesn't loop forever trying to refresh
// again -- it falls through and the caller sees the (second) error instead.
interface RetryableRequestConfig extends InternalAxiosRequestConfig {
  _retriedAfterRefresh?: boolean
}

// If several requests 401 around the same moment (e.g. a page that fires
// off 3 fetches at once right as the access token expires), they should
// share ONE refresh call, not each independently hit /auth/refresh. This
// holds the in-flight refresh so concurrent 401s all await the same promise.
let refreshInFlight: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) {
    throw new Error('No refresh token available.')
  }
  // Plain axios, not `api` -- going through `api` here would re-enter this
  // same response interceptor if the refresh call itself ever 401s.
  const response = await axios.post<{ access_token: string }>(`${BASE_URL}/api/v1/auth/refresh`, {
    refresh_token: refreshToken,
  })
  setAccessToken(response.data.access_token)
  return response.data.access_token
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined

    const shouldAttemptRefresh =
      error.response?.status === 401 && originalRequest && !originalRequest._retriedAfterRefresh

    if (!shouldAttemptRefresh) {
      return Promise.reject(error)
    }

    originalRequest._retriedAfterRefresh = true

    try {
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null
      })
      const newAccessToken = await refreshInFlight
      originalRequest.headers = originalRequest.headers ?? {}
      ;(originalRequest.headers as Record<string, string>).Authorization = `Bearer ${newAccessToken}`
      return api(originalRequest as AxiosRequestConfig)
    } catch {
      // Refresh token is missing, expired, or revoked (e.g. the user logged
      // out elsewhere -- see security/dependencies.py's token_version check
      // on the backend). Nothing left to try; clear stale tokens so the app
      // doesn't keep sending a dead access token on every future request.
      clearTokens()
      return Promise.reject(error)
    }
  },
)

export default api
