/**
 * Login page — public route at `/login`.
 *
 * Collects email + password and calls `useAuth().login()`. On success, navigates
 * to a role-appropriate home (or a previously requested path the role may open).
 * Errors from the API are shown using `getApiErrorMessage`.
 *
 * Does not talk to axios directly; all auth side effects go through AuthContext.
 */

import { useState, type FormEvent } from 'react'
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Link,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { getApiErrorMessage, useAuth } from '../context/AuthContext'
import { fetchCurrentUser } from '../api/auth'
import { resolvePostLoginPath } from '../types/auth'

type LocationState = {
  from?: string
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const requestedPath = (location.state as LocationState | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login({ email, password })
      const currentUser = await fetchCurrentUser()
      navigate(resolvePostLoginPath(currentUser.role, requestedPath), { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to log in.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Sign in
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Sign in with your email and password.
          </Typography>

          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <Button type="submit" variant="contained" size="large" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>

          <Typography variant="body2" sx={{ mt: 2 }}>
            Need an account?{' '}
            <Link component={RouterLink} to="/register">
              Register as a customer
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
