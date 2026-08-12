/**
 * Employee / admin sign-in at `/staff/login`.
 *
 * Uses the same `/auth/login` API as customers, then rejects non-staff roles
 * (logs them out) so customers cannot enter the staff portal through this page.
 * Staff cannot self-register; use seeded demo credentials or an admin-created
 * staff account.
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
import { homePathForRole, isStaffRole } from '../types/auth'

type LocationState = {
  from?: string
}

export default function StaffLoginPage() {
  const { login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = (location.state as LocationState | null)?.from ?? '/analytics'

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
      if (!isStaffRole(currentUser.role)) {
        await logout()
        setError('This portal is for bank employees only. Customers should use the regular sign-in page.')
        return
      }
      navigate(redirectTo.startsWith('/staff') ? homePathForRole(currentUser.role) : redirectTo, {
        replace: true,
      })
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
      <Card sx={{ width: '100%', maxWidth: 440 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Employee sign-in
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Staff and admin access only. Accounts are provisioned by an administrator —
            there is no employee self-registration.
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Local demo: admin@bank.local / admin123, teller@bank.local / teller123,
            manager@bank.local / manager123
          </Alert>

          <Stack component="form" spacing={2} onSubmit={handleSubmit}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Work email"
              type="email"
              autoComplete="username"
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
              {isSubmitting ? 'Signing in…' : 'Sign in as employee'}
            </Button>
          </Stack>

          <Typography variant="body2" sx={{ mt: 2 }}>
            Customer?{' '}
            <Link component={RouterLink} to="/login">
              Sign in here
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
