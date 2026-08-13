import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, LinearProgress, Stack, Typography } from '@mui/material'
import SavingsIcon from '@mui/icons-material/Savings'

import { fetchBudgets } from '../api/budgets'
import { getApiErrorMessage } from '../api/client'
import type { Budget } from '../types/budget'

const CATEGORY_COLORS = ['#0b3d91', '#1b7f5a', '#eda100', '#e87ba4', '#4a3aa7']
const MAX_ROWS = 5

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function BudgetBreakdownList() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchBudgets()
      .then((data) => {
        if (!cancelled) setBudgets(data)
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Could not load your budgets.'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
        <CircularProgress size={18} />
        <Typography variant="body2" color="text.secondary">
          Loading budgets…
        </Typography>
      </Stack>
    )
  }

  if (error) {
    return <Alert severity="warning">{error}</Alert>
  }

  if (budgets.length === 0) {
    return (
      <Typography color="text.secondary">
        No budgets yet — add one from the Budgets page to see a breakdown here.
      </Typography>
    )
  }

  // Largest budgets first, capped to a short preview list -- this is a
  // Dashboard summary, not the full management view (that's BudgetPage.tsx).
  const rows = [...budgets].sort((a, b) => b.amount - a.amount).slice(0, MAX_ROWS)
  // Bar widths are relative to the biggest budget *shown*, not some fixed
  // dollar scale, so the largest bar always fills the row regardless of
  // whether budgets are in the tens or thousands.
  const maxAmount = Math.max(...rows.map((b) => b.amount))

  return (
    <Stack spacing={1.5}>
      {rows.map((budget, index) => {
        const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length]
        const percent = maxAmount > 0 ? (budget.amount / maxAmount) * 100 : 0
        return (
          <Box key={budget.id}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                <SavingsIcon fontSize="small" sx={{ color }} />
                <Typography variant="body2" noWrap>
                  {budget.category}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 1 }}>
                {formatCurrency(budget.amount)} / {budget.period}
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percent}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'action.hover',
                '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 4 },
              }}
            />
          </Box>
        )
      })}
    </Stack>
  )
}
