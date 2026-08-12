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
  Typography,
} from '@mui/material'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SavingsIcon from '@mui/icons-material/Savings'

import { createBudget, deleteBudget, fetchBudgets } from '../api/budgets'
import { getApiErrorMessage } from '../api/client'
import type { Budget, BudgetPeriod } from '../types/budget'

export default function BudgetPage() {
    const [budgets, setBudgets] = useState<Budget[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isAddOpen, setIsAddOpen] = useState(false)

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
        <Stack spacing={2}>
          {budgets.map((budget) => (
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