import { Box, Stack, Tooltip, Typography } from '@mui/material'
import { useMemo, useState } from 'react'

import type { Budget } from '../types/budget'

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

const VIEWBOX = 200
const CENTER = VIEWBOX / 2
const OUTER_RADIUS = 92
const INNER_RADIUS = 58
const SURFACE_COLOR = '#ffffff'

function polarToCartesian(radius: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: CENTER + radius * Math.cos(angleRad),
    y: CENTER + radius * Math.sin(angleRad),
  }
}

function donutSlicePath(startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  const outerStart = polarToCartesian(OUTER_RADIUS, endAngle)
  const outerEnd = polarToCartesian(OUTER_RADIUS, startAngle)
  const innerStart = polarToCartesian(INNER_RADIUS, startAngle)
  const innerEnd = polarToCartesian(INNER_RADIUS, endAngle)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${OUTER_RADIUS} ${OUTER_RADIUS} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ')
}

// Picks ink vs white label text so it always clears contrast on the fill.
function labelColorFor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#0b0b0b' : '#ffffff'
}

const currency = (value: number) =>
  value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })

type Slice = {
  category: string
  amount: number
  fraction: number
  startAngle: number
  endAngle: number
  color: string
}

export default function BudgetAllocationChart({ budgets }: { budgets: Budget[] }) {
  const [hovered, setHovered] = useState<number | null>(null)

  const { slices, total } = useMemo(() => {
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

    const sumTotal = grouped.reduce((sum, d) => sum + d.amount, 0)

    let cursor = 0
    const computed: Slice[] = grouped.map((d, i) => {
      const fraction = sumTotal > 0 ? d.amount / sumTotal : 0
      const startAngle = cursor
      const endAngle = cursor + fraction * 360
      cursor = endAngle
      return {
        ...d,
        fraction,
        startAngle,
        endAngle,
        color: d.category === 'Other' ? OTHER_COLOR : CATEGORICAL_COLORS[i],
      }
    })

    return { slices: computed, total: sumTotal }
  }, [budgets])

  if (slices.length === 0) {
    return (
      <Typography color="text.secondary">
        Add budgets to see how your amounts are allocated.
      </Typography>
    )
  }

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={3}
      sx={{ alignItems: 'center', maxWidth: 460 }}
    >
      <Box sx={{ position: 'relative', width: 200, maxWidth: '100%', flexShrink: 0 }}>
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Budget allocation donut chart totaling ${currency(total)}`}
        >
          {slices.map((slice, i) => {
            const label = `${slice.category}: ${currency(slice.amount)} (${Math.round(slice.fraction * 100)}%)`
            const midAngle = (slice.startAngle + slice.endAngle) / 2
            const midRadius = (OUTER_RADIUS + INNER_RADIUS) / 2
            const labelPos = polarToCartesian(midRadius, midAngle)
            const showLabel = slice.fraction >= 0.08

            return (
              <Tooltip key={slice.category} title={label} arrow>
                <g
                  tabIndex={0}
                  role="img"
                  aria-label={label}
                  style={{
                    cursor: 'pointer',
                    filter: hovered === i ? 'brightness(1.08)' : undefined,
                    transition: 'filter 0.12s ease',
                    outline: 'none',
                  }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered((current) => (current === i ? null : current))}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered((current) => (current === i ? null : current))}
                >
                  <path
                    d={donutSlicePath(slice.startAngle, slice.endAngle)}
                    fill={slice.color}
                    stroke={SURFACE_COLOR}
                    strokeWidth={2}
                  />
                  {showLabel && (
                    <text
                      x={labelPos.x}
                      y={labelPos.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={11}
                      fontWeight={600}
                      fill={labelColorFor(slice.color)}
                      style={{ pointerEvents: 'none' }}
                    >
                      {Math.round(slice.fraction * 100)}%
                    </text>
                  )}
                </g>
              </Tooltip>
            )
          })}
        </svg>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography variant="caption" color="text.secondary" component="div">
            Total
          </Typography>
          <Typography variant="h6" component="div">
            {currency(total)}
          </Typography>
        </Box>
      </Box>

      <Stack spacing={1} sx={{ minWidth: 0, width: '100%' }}>
        {slices.map((slice, i) => (
          <Stack
            key={slice.category}
            direction="row"
            spacing={1}
            sx={{
              alignItems: 'center',
              opacity: hovered === null || hovered === i ? 1 : 0.5,
              transition: 'opacity 0.12s ease',
            }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((current) => (current === i ? null : current))}
          >
            <Box
              sx={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                bgcolor: slice.color,
                flexShrink: 0,
              }}
            />
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
              {slice.category}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              {currency(slice.amount)} · {Math.round(slice.fraction * 100)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}
