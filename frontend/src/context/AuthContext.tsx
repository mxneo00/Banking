/**
 * React Auth Context — single source of truth for "who is logged in?"
 *
 * Wrap the app with `<AuthProvider>` (see `main.tsx`). Any component can then
 * call `useAuth()` to read `user`, `isAuthenticated`, `isLoading`, and invoke
 * `login`, `register`, or `logout`.
 *
 * Flow:
 * 1. On mount — if an access token exists, call `/auth/me` to restore session.
 * 2. login/register — exchange credentials for tokens, persist them, fetch user.
 * 3. logout — revoke tokens on the server, clear localStorage, reset state.
 *
 * For role-based UI (hide nav items, teller-only actions), read `user.role`
 * from `useAuth()`. The backend still enforces RBAC; this is for UX only.
 *
 * Re-exported `getApiErrorMessage` is a convenience for login/register pages.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchCurrentUser,
  loginRequest,
  logoutRequest,
  registerRequest,
} from '../api/auth'
import { getApiErrorMessage, tokenStorage } from '../api/client'
import type { LoginCredentials, RegisterCredentials, User } from '../types/auth'

type AuthContextValue = {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (credentials: RegisterCredentials) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function loadSession(): Promise<User | null> {
  if (!tokenStorage.getAccessToken()) {
    return null
  }

  try {
    return await fetchCurrentUser()
  } catch {
    tokenStorage.clear()
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    loadSession()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    const tokens = await loginRequest(credentials)
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token)
    const currentUser = await fetchCurrentUser()
    setUser(currentUser)
  }, [])

  const register = useCallback(async (credentials: RegisterCredentials) => {
    const tokens = await registerRequest(credentials)
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token)
    const currentUser = await fetchCurrentUser()
    setUser(currentUser)
  }, [])

  const logout = useCallback(async () => {
    try {
      if (tokenStorage.getAccessToken()) {
        await logoutRequest()
      }
    } catch {
      // Local logout still runs if the server call fails (expired token, etc.).
    } finally {
      tokenStorage.clear()
      setUser(null)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: user !== null,
      login,
      register,
      logout,
    }),
    [user, isLoading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export { getApiErrorMessage }
