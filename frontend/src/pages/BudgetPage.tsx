import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SavingsIcon from '@mui/icons-material/Savings'

import { createBudget, deleteBudget, fetchBudgets } from '../api/budgets'
import { getApiErrorMessage } from '../api/client'
import BudgetAllocationChart from '../components/BudgetAllocationChart'
import type { Budget, BudgetPeriod } from '../types/budget'

type PeriodFilter = 'all' | BudgetPeriod

export default function BudgetPage() {
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('all')

    const filteredBudgets = useMemo(
        () => (periodFilter === 'all' ? budgets : budgets.filter((budget) => budget.period === periodFilter)),
        [budgets, periodFilter],
    )

    // Split out regardless of the active filter -- needed so the "all"
    // view below can render weekly and monthly as two separate donut
    // charts side by side instead of mixing differently-scaled amounts
    // into one chart.
    const weeklyBudgets = useMemo(() => budgets.filter((budget) => budget.period === 'weekly'), [budgets])
    const monthlyBudgets = useMemo(() => budgets.filter((budget) => budget.period === 'monthly'), [budgets])

    const loadBudgets = useCallback(() => fetchBudgets(), [])

    useEffect(() => {
        let cancelled = false
        loadBudgets()
            .then((data) => {
                if (!cancelled) setBudgets(data)
            })
            .catch((err) => {
                if (!cancelled) setError(getApiErrorMessage(err, 'Could not load your budgets.'))
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [loadBudgets])
    
    const refreshBudgets = useCallback(() => {
        setIsLoading(true)
        setError(null)
        loadBudgets()
            .then(setBudgets)
            .catch((err) => setError(getApiErrorMessage(err, 'Could not load your budgets.')))
            .finally(() => setIsLoading(false))
    }, [loadBudgets])

    const handleDelete = async (budgetId: string) => {
        try {
            // Remove from local state only after the server confirms the
            // delete -- if the request fails, the budget stays in the list
            // and the error below explains why nothing changed.
            await deleteBudget(budgetId)
            setBudgets((current) => current.filter((budget) => budget.id !== budgetId))
        } catch (err) {
            setError(getApiErrorMessage(err, 'Could not delete the budget.'))
        }
    }

    return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Budgets
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Manage your budgets here. You can add new budgets, view existing ones, and delete budgets that are no longer needed.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setIsAddOpen((open) => !open)}
        >
          {isAddOpen ? 'Cancel' : 'Add a budget'}
        </Button>
        <Collapse in={isAddOpen} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2, maxWidth: 420 }}>
            <AddBudgetForm
              onSuccess={() => {
                setIsAddOpen(false)
                refreshBudgets()
              }}
            />
          </Box>
        </Collapse>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!isLoading && error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={refreshBudgets}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!isLoading && !error && budgets.length === 0 && (
        <Alert severity="info">No budgets yet — add one above to get started.</Alert>
      )}

      {!isLoading && !error && budgets.length > 0 && (
        <>
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              value={periodFilter}
              exclusive
              size="small"
              onChange={(_event, value: PeriodFilter | null) => {
                if (value) setPeriodFilter(value)
              }}
              aria-label="Filter budgets by period"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="weekly">Weekly</ToggleButton>
              <ToggleButton value="monthly">Monthly</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {filteredBudgets.length > 0 && (
            <Card variant="outlined" sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Category allocation
                </Typography>
                {periodFilter === 'all' ? (
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                    {weeklyBudgets.length > 0 && (
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Weekly
                        </Typography>
                        <BudgetAllocationChart budgets={weeklyBudgets} />
                      </Box>
                    )}
                    {monthlyBudgets.length > 0 && (
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          Monthly
                        </Typography>
                        <BudgetAllocationChart budgets={monthlyBudgets} />
                      </Box>
                    )}
                  </Stack>
                ) : (
                  <BudgetAllocationChart budgets={filteredBudgets} />
                )}
              </CardContent>
            </Card>
          )}

          {filteredBudgets.length === 0 && (
            <Alert severity="info" sx={{ mb: 3 }}>
              No {periodFilter} budgets — try a different filter.
            </Alert>
          )}
        </>
      )}

      {!isLoading && !error && filteredBudgets.length > 0 && (
        <Stack spacing={2}>
          {filteredBudgets.map((budget) => (
            <Card key={budget.id} variant="outlined">
              <CardContent
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <SavingsIcon color="primary" />
                  <Box>
                    <Typography variant="h6">{budget.category}</Typography>
                    <Chip label={budget.period} size="small" sx={{ mt: 0.5 }} />
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6">${budget.amount.toFixed(2)}</Typography>
                  <IconButton
                    aria-label={`Delete ${budget.category} budget`}
                    onClick={() => handleDelete(budget.id)}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  )
}

function AddBudgetForm({ onSuccess }: { onSuccess: () => void }) {
    const [category, setCategory] = useState('')
    const [amount, setAmount] = useState('')
    const [period, setPeriod] = useState<BudgetPeriod | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault()
        setIsSubmitting(true)
        setFormError(null)

        if (!category || !amount || !period) {
            setFormError('All fields are required.')
            setIsSubmitting(false)
            return
        }

        try {
            const parsedAmount = Number(amount)
            await createBudget({ category, amount: parsedAmount, period })
            onSuccess()
        } catch (error) {
            setFormError(getApiErrorMessage(error, 'Could not add the budget.'))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
    <Card variant="outlined">
      <CardContent>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {formError && <Alert severity="error">{formError}</Alert>}

            <TextField
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Groceries, Entertainment"
              size="small"
              fullWidth
              disabled={isSubmitting}
            />
            <TextField
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
              size="small"
              fullWidth
              disabled={isSubmitting}
            />
            <TextField
              select
              label="Resets"
              value={period}
              onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
              size="small"
              fullWidth
              disabled={isSubmitting}
            >
              <MenuItem value="weekly">Weekly</MenuItem>
              <MenuItem value="monthly">Monthly</MenuItem>
            </TextField>

            <Button type="submit" variant="contained" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add budget'}
            </Button>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  )
}