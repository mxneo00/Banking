/**
 * Generic donut chart reimplemented as inline SVG (same technique 
 * BudgetAllocationChart.tsx already uses in this codebase) so no charting
 * library is added. Kept as its own independent component rather than 
 * a shared import so it doesn't touch BudgetAllocationChart.tsx.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { Box, Stack, Tooltip, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

const VIEWBOX = 200
const CENTER = VIEWBOX / 2
const OUTER_RADIUS = 92
const INNER_RADIUS = 58

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

function labelColorFor(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#0b0b0b' : '#ffffff'
}

const currency = (value: number) =>
  value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })

export type DonutSlice = {
  label: string
  value: number
  color: string
}

type ComputedSlice = DonutSlice & {
  fraction: number
  startAngle: number
  endAngle: number
}

export default function DonutChart({
  slices: inputSlices,
  centerLabel = 'Total',
  centerContent,
}: {
  slices: DonutSlice[]
  centerLabel?: string
  /** Overrides the default centerLabel + currency-total block entirely. */
  centerContent?: ReactNode
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const theme = useTheme()
  // Gap color between slices should match the surface the chart sits on
  // (a Card, always background.paper) -- not a hardcoded white, which reads
  // as a bug in dark mode.
  const surfaceColor = theme.palette.background.paper

  const { slices, total } = useMemo(() => {
    const positive = inputSlices.filter((s) => s.value > 0)
    const sumTotal = positive.reduce((sum, s) => sum + s.value, 0)

    const { computed } = positive.reduce<{ computed: ComputedSlice[]; cursor: number }>(
      (acc, s) => {
        const fraction = sumTotal > 0 ? s.value / sumTotal : 0
        const startAngle = acc.cursor
        const endAngle = acc.cursor + fraction * 360
        acc.computed.push({ ...s, fraction, startAngle, endAngle })
        acc.cursor = endAngle
        return acc
      },
      { computed: [], cursor: 0 },
    )

    return { slices: computed, total: sumTotal }
  }, [inputSlices])

  if (slices.length === 0) {
    return <Typography color="text.secondary">Nothing to show yet.</Typography>
  }

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: 'center', maxWidth: 460 }}>
      <Box sx={{ position: 'relative', width: 200, maxWidth: '100%', flexShrink: 0 }}>
        <svg
          viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Donut chart totaling ${currency(total)}`}
        >
          {slices.map((slice, i) => {
            const label = `${slice.label}: ${currency(slice.value)} (${Math.round(slice.fraction * 100)}%)`
            const midAngle = (slice.startAngle + slice.endAngle) / 2
            const midRadius = (OUTER_RADIUS + INNER_RADIUS) / 2
            const labelPos = polarToCartesian(midRadius, midAngle)
            const showLabel = slice.fraction >= 0.08

            return (
              <Tooltip key={slice.label} title={label} arrow>
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
                    stroke={surfaceColor}
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
          {centerContent ?? (
            <>
              <Typography variant="caption" color="text.secondary" component="div">
                {centerLabel}
              </Typography>
              <Typography variant="h6" component="div">
                {currency(total)}
              </Typography>
            </>
          )}
        </Box>
      </Box>

      <Stack spacing={1} sx={{ minWidth: 0, width: '100%' }}>
        {slices.map((slice, i) => (
          <Stack
            key={slice.label}
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
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: slice.color, flexShrink: 0 }} />
            <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
              {slice.label}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              {currency(slice.value)} · {Math.round(slice.fraction * 100)}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}
