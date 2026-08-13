import { useMemo } from 'react'
import { Typography } from '@mui/material'

import type { Budget } from '../types/budget'
import DonutChart, { type DonutSlice } from './DonutChart'

// Fixed-order categorical palette (validated for CVD-safe adjacent contrast).
// Never cycled or reassigned by rank — see dataviz color-formula.md.
const CATEGORICAL_COLORS = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
]
const OTHER_COLOR = '#898781'
const MAX_SLICES = CATEGORICAL_COLORS.length

export default function BudgetAllocationChart({ budgets }: { budgets: Budget[] }) {
  const slices: DonutSlice[] = useMemo(() => {
    const totals = new Map<string, number>()
    for (const budget of budgets) {
      if (budget.amount <= 0) continue
      totals.set(budget.category, (totals.get(budget.category) ?? 0) + budget.amount)
    }

    const sorted = Array.from(totals, ([category, amount]) => ({ category, amount })).sort(
      (a, b) => b.amount - a.amount,
    )

    const grouped =
      sorted.length <= MAX_SLICES
        ? sorted
        : [
            ...sorted.slice(0, MAX_SLICES - 1),
            {
              category: 'Other',
              amount: sorted.slice(MAX_SLICES - 1).reduce((sum, d) => sum + d.amount, 0),
            },
          ]

    return grouped.map((d, i) => ({
      label: d.category,
      value: d.amount,
      color: d.category === 'Other' ? OTHER_COLOR : CATEGORICAL_COLORS[i],
    }))
  }, [budgets])

  if (slices.length === 0) {
    return (
      <Typography color="text.secondary">
        Add budgets to see how your amounts are allocated.
      </Typography>
    )
  }

  return <DonutChart slices={slices} centerLabel="Total" />
}
