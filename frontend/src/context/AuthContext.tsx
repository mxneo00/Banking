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
  // No token in localStorage at all means there's no session to restore --
  // skip the network call entirely rather than firing a request that will
  // just 401.
  if (!tokenStorage.getAccessToken()) {
    return null
  }

  try {
    // A stored access token might still be stale (expired, or revoked via
    // token_version) -- fetchCurrentUser is the actual proof it still works.
    // client.ts's interceptor will transparently refresh it here if needed.
    return await fetchCurrentUser()
  } catch {
    // Both tokens are worthless at this point (refresh already failed
    // inside the interceptor) -- clear them so the app doesn't keep
    // retrying a dead session on every request.
    tokenStorage.clear()
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // `cancelled` guards against setting state after this effect's cleanup
    // has run (e.g. the component unmounted mid-request, or React 18 Strict
    // Mode's mount/unmount/remount in dev) -- without it a late response
    // could call setState on an unmounted component.
    let cancelled = false

    loadSession()
      .then((currentUser) => {
        if (!cancelled) {
          setUser(currentUser)
        }
      })
      .finally(() => {
        // Runs whether loadSession resolved to a user or null -- either way,
        // the "are we still figuring out who's logged in?" phase is over.
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    // Exchange credentials for a token pair, persist them, then fetch the
    // full user profile the tokens' claims alone don't carry (e.g. is_active,
    // branch_id) -- this is what flips isAuthenticated to true below.
    const tokens = await loginRequest(credentials)
    tokenStorage.setTokens(tokens.access_token, tokens.refresh_token)
    const currentUser = await fetchCurrentUser()
    setUser(currentUser)
  }, [])

  const register = useCallback(async (credentials: RegisterCredentials) => {
    // Same shape as login() above -- registration also returns a usable
    // token pair immediately, so there's no separate "now go log in" step.
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
