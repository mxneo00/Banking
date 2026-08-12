/**
 * Staff Analytics dashboard — branch customer metrics for employees.
 *
 * Uses GET /api/v1/customers (staff-only). When the logged-in user has a
 * branch_id, results are scoped to that branch.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import GroupsIcon from '@mui/icons-material/Groups'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { getApiErrorMessage } from '../api/client'
import { listCustomers } from '../api/customers'
import { useAuth } from '../context/AuthContext'
import type { Customer } from '../types/banking'

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadCustomers() {
      setLoading(true)
      setError(null)
      try {
        const params = user?.branch_id ? { branch_id: user.branch_id } : undefined
        const rows = await listCustomers(params)
        if (!cancelled) {
          setCustomers(rows)
        }
      } catch (err) {
        if (!cancelled) {
          setCustomers([])
          setError(getApiErrorMessage(err, 'Could not load staff analytics.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadCustomers()
    return () => {
      cancelled = true
    }
  }, [user?.branch_id])

  const metrics = useMemo(() => {
    const active = customers.filter((c) => c.is_active).length
    const inactive = customers.length - active
    const linkedAccounts = customers.reduce((sum, c) => sum + c.account_numbers.length, 0)
    return { active, inactive, linkedAccounts, total: customers.length }
  }, [customers])

  const metricCards = [
    {
      title: 'Active customers',
      value: String(metrics.active),
      helper: `${metrics.inactive} inactive`,
      icon: <GroupsIcon color="secondary" />,
    },
    {
      title: 'Customers in view',
      value: String(metrics.total),
      helper: user?.branch_id ? `Branch ${user.branch_id}` : 'All branches',
      icon: <TrendingUpIcon color="secondary" />,
    },
    {
      title: 'Linked accounts',
      value: String(metrics.linkedAccounts),
      helper: 'From customer profiles',
      icon: <AccountTreeIcon color="secondary" />,
    },
  ]

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Staff Analytics
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Branch customer distribution and account coverage
        {user?.role ? ` · signed in as ${user.role}` : ''}.
      </Typography>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading customers…</Typography>
        </Stack>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {metricCards.map((card) => (
              <Grid key={card.title} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {card.icon}
                      <Typography variant="subtitle1">{card.title}</Typography>
                    </Box>
                    <Typography variant="h5">{card.value}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.helper}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="h5" gutterBottom>
            Customers
          </Typography>

          {customers.length === 0 ? (
            <Alert severity="info">No customers found for this view.</Alert>
          ) : (
            <TableContainer component={Card} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Customer ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Branch</TableCell>
                    <TableCell>Accounts</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow key={customer.customer_id} hover>
                      <TableCell>{customer.customer_id}</TableCell>
                      <TableCell>{customer.name}</TableCell>
                      <TableCell>{customer.email}</TableCell>
                      <TableCell>{customer.branch_id}</TableCell>
                      <TableCell>{customer.account_numbers.length}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={customer.is_active ? 'active' : 'inactive'}
                          color={customer.is_active ? 'success' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Box>
  )
}
