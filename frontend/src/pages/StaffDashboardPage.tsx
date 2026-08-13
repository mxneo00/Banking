/**
 * Role-aware staff home at `/staff`.
 *
 * Shared for all employees:
 *   - KPI cards (customers / accounts / recent txn count)
 *   - Recent transactions preview + links
 *
 * Role sections:
 *   - teller + admin: cash-desk shortcuts (deposit/withdraw note + link)
 *   - manager + admin: customer distribution table
 *   - admin: create staff form
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import GroupsIcon from '@mui/icons-material/Groups'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import { createStaffRequest } from '../api/auth'
import { getApiErrorMessage } from '../api/client'
import { listCustomers } from '../api/customers'
import { listTransactions } from '../api/transactions'
import CashDeskPanel from '../components/CashDeskPanel'
import { useAuth } from '../context/AuthContext'
import type { StaffRole } from '../types/auth'
import type { Customer } from '../types/customer'
import type { Transaction } from '../types/transaction'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

export default function StaffDashboardPage() {
  const { user } = useAuth()
  const role = user?.role
  const isTeller = role === 'teller' || role === 'admin'
  const isManager = role === 'branch_manager' || role === 'admin'
  const isAdmin = role === 'admin'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [staffEmail, setStaffEmail] = useState('')
  const [staffPassword, setStaffPassword] = useState('')
  const [staffRole, setStaffRole] = useState<StaffRole>('teller')
  const [staffBranchId, setStaffBranchId] = useState(user?.branch_id ?? 'BR001')
  const [staffMessage, setStaffMessage] = useState<string | null>(null)
  const [staffError, setStaffError] = useState<string | null>(null)
  const [staffSubmitting, setStaffSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const customerParams = user?.branch_id ? { branch_id: user.branch_id } : undefined
        const [customerRows, txnRows] = await Promise.all([
          listCustomers(customerParams),
          listTransactions(),
        ])
        if (!cancelled) {
          setCustomers(customerRows)
          setTransactions(txnRows)
        }
      } catch (err) {
        if (!cancelled) {
          setCustomers([])
          setTransactions([])
          setError(getApiErrorMessage(err, 'Could not load staff dashboard.'))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [user?.branch_id])

  const metrics = useMemo(() => {
    const active = customers.filter((c) => c.is_active).length
    const linkedAccounts = customers.reduce((sum, c) => sum + c.account_numbers.length, 0)
    const volume = transactions.reduce((sum, t) => sum + t.amount, 0)
    return {
      active,
      totalCustomers: customers.length,
      linkedAccounts,
      txnCount: transactions.length,
      volume,
    }
  }, [customers, transactions])

  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
  }, [transactions])

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStaffMessage(null)
    setStaffError(null)
    setStaffSubmitting(true)
    try {
      const created = await createStaffRequest({
        email: staffEmail,
        password: staffPassword,
        role: staffRole,
        branch_id: staffBranchId.trim() || null,
      })
      setStaffMessage(`Created ${created.role} account for ${created.email}.`)
      setStaffEmail('')
      setStaffPassword('')
    } catch (err) {
      setStaffError(getApiErrorMessage(err, 'Could not create staff user.'))
    } finally {
      setStaffSubmitting(false)
    }
  }

  const roleTitle =
    role === 'admin'
      ? 'Admin dashboard'
      : role === 'branch_manager'
        ? 'Manager dashboard'
        : role === 'teller'
          ? 'Teller dashboard'
          : 'Staff dashboard'

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {roleTitle}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Signed in as {user?.email}
        {user?.branch_id ? ` · branch ${user.branch_id}` : ' · all branches'}
        {role ? ` · ${role}` : ''}.
      </Typography>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <CircularProgress size={22} />
          <Typography color="text.secondary">Loading staff workspace…</Typography>
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <GroupsIcon color="secondary" />
                    <Typography variant="subtitle1">Customers</Typography>
                  </Box>
                  <Typography variant="h5">{metrics.totalCustomers}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {metrics.active} active
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <AccountTreeIcon color="secondary" />
                    <Typography variant="subtitle1">Linked accounts</Typography>
                  </Box>
                  <Typography variant="h5">{metrics.linkedAccounts}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    From customer profiles
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <ReceiptLongIcon color="secondary" />
                    <Typography variant="subtitle1">Transactions</Typography>
                  </Box>
                  <Typography variant="h5">{metrics.txnCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    In current ledger view
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" gutterBottom>
                    Ledger volume
                  </Typography>
                  <Typography variant="h5">{formatCurrency(metrics.volume)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sum of listed amounts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 3 }}>
            <Button component={RouterLink} to="/transactions" variant="contained">
              Open full ledger
            </Button>
            <Button component={RouterLink} to="/analytics" variant="outlined">
              Branch overview
            </Button>
          </Stack>

          {isTeller && (
            <CashDeskPanel
              embedded
              onSuccess={(tx) => {
                setTransactions((prev) => [tx, ...prev])
              }}
            />
          )}

          <Typography variant="h5" gutterBottom>
            Recent transactions
          </Typography>
          {recentTransactions.length === 0 ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              No transactions in the ledger yet.
            </Alert>
          ) : (
            <TableContainer component={Card} variant="outlined" sx={{ mb: 3, overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>When</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>From</TableCell>
                    <TableCell>To</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentTransactions.map((tx) => (
                    <TableRow key={tx.transaction_id} hover>
                      <TableCell>{formatTimestamp(tx.timestamp)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={tx.type} variant="outlined" />
                      </TableCell>
                      <TableCell>{formatCurrency(tx.amount)}</TableCell>
                      <TableCell>{tx.from_account_id ?? '—'}</TableCell>
                      <TableCell>{tx.to_account_id ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {isManager && (
            <>
              <Typography variant="h5" gutterBottom>
                Customers in scope
              </Typography>
              {customers.length === 0 ? (
                <Alert severity="info" sx={{ mb: 3 }}>
                  No customers found for this view.
                </Alert>
              ) : (
                <TableContainer component={Card} variant="outlined" sx={{ mb: 3, overflowX: 'auto' }}>
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

          {isAdmin && (
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AdminPanelSettingsIcon color="primary" />
                  <Typography variant="h6">Create staff account</Typography>
                </Box>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Admins only. Creates a teller, branch manager, or admin login (no self-registration
                  for employees).
                </Typography>
                <Stack component="form" spacing={2} onSubmit={handleCreateStaff} sx={{ maxWidth: 480 }}>
                  {staffMessage && <Alert severity="success">{staffMessage}</Alert>}
                  {staffError && <Alert severity="error">{staffError}</Alert>}
                  <TextField
                    label="Work email"
                    type="email"
                    required
                    value={staffEmail}
                    onChange={(event) => setStaffEmail(event.target.value)}
                  />
                  <TextField
                    label="Temporary password"
                    type="password"
                    required
                    helperText="At least 8 characters"
                    value={staffPassword}
                    onChange={(event) => setStaffPassword(event.target.value)}
                  />
                  <FormControl>
                    <InputLabel id="staff-role-label">Role</InputLabel>
                    <Select
                      labelId="staff-role-label"
                      label="Role"
                      value={staffRole}
                      onChange={(event) => setStaffRole(event.target.value as StaffRole)}
                    >
                      <MenuItem value="teller">teller</MenuItem>
                      <MenuItem value="branch_manager">branch_manager</MenuItem>
                      <MenuItem value="admin">admin</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    label="Branch ID"
                    value={staffBranchId}
                    onChange={(event) => setStaffBranchId(event.target.value)}
                    helperText="Optional for admin; typically BR001 for teller/manager"
                  />
                  <Button type="submit" variant="contained" disabled={staffSubmitting}>
                    {staffSubmitting ? 'Creating…' : 'Create staff user'}
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  )
}
