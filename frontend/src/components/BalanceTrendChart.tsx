/**
 * Total-balance-over-time trend line for the Dashboard. There is no
 * historical-balance table anywhere in the backend -- Account.balance is a
 * live snapshot only -- so this is *derived*, not stored: starting from each
 * account's current known balance, we undo its transactions one by one
 * (in reverse-chronological order) to reconstruct what the balance was at
 * every point in time, then sum across accounts.
 *
 * Approximation, stated honestly: before an account's earliest known
 * transaction, we hold its earliest reconstructed value constant backward.
 * That's not a claim about true history before the transaction log's
 * visibility -- it's "as far back as we can see, this is what it was."
 */

import { useId, useMemo } from 'react'
import { Box, Card, CardContent, Stack, Tooltip, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'

import type { Account } from '../types/account'
import type { Transaction } from '../types/transaction'

const VIEWBOX_WIDTH = 480
const VIEWBOX_HEIGHT = 200
const PADDING = { top: 16, right: 16, bottom: 28, left: 16 }

type Point = { timestamp: number; balance: number }

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Reconstructs one account's (timestamp, balance) history from its transactions. */
function reconstructAccountSeries(account: Account, transactions: Transaction[]): Point[] {
  const relevant = transactions
    .filter((tx) => tx.from_account_id === account.account_number || tx.to_account_id === account.account_number)
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  if (relevant.length === 0) {
    return [{ timestamp: Date.now(), balance: account.balance }]
  }

  // Undo transactions newest-to-oldest to find the balance immediately after each one.
  const afterBalances = new Array<number>(relevant.length)
  let balance = account.balance
  for (let i = relevant.length - 1; i >= 0; i--) {
    afterBalances[i] = balance
    const tx = relevant[i]
    const isIncoming = tx.to_account_id === account.account_number
    balance = isIncoming ? balance - tx.amount : balance + tx.amount
  }
  const beforeFirst = balance

  const points: Point[] = [
    { timestamp: new Date(relevant[0].timestamp).getTime(), balance: beforeFirst },
    ...relevant.map((tx, i) => ({ timestamp: new Date(tx.timestamp).getTime(), balance: afterBalances[i] })),
  ]
  // Extend the line to "now" at the current known balance.
  points.push({ timestamp: Date.now(), balance: account.balance })
  return points
}

function balanceAt(series: Point[], t: number): number {
  let result = series[0].balance
  for (const p of series) {
    if (p.timestamp <= t) {
      result = p.balance
    } else {
      break
    }
  }
  return result
}

/** Sums every account's reconstructed series onto one shared timeline. */
function buildAggregateSeries(accounts: Account[], transactions: Transaction[]): Point[] {
  const perAccountSeries = accounts.map((account) => reconstructAccountSeries(account, transactions))
  const allTimestamps = Array.from(
    new Set(perAccountSeries.flatMap((series) => series.map((p) => p.timestamp))),
  ).sort((a, b) => a - b)

  return allTimestamps.map((t) => ({
    timestamp: t,
    balance: perAccountSeries.reduce((sum, series) => sum + balanceAt(series, t), 0),
  }))
}

export default function BalanceTrendChart({
  accounts,
  transactions,
}: {
  accounts: Account[]
  transactions: Transaction[]
}) {
  const theme = useTheme()
  const gradientId = useId()

  const series = useMemo(() => buildAggregateSeries(accounts, transactions), [accounts, transactions])

  const header = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
      <TrendingUpIcon color="primary" />
      <Typography variant="subtitle1">Balance trend</Typography>
    </Box>
  )

  if (accounts.length === 0) {
    return (
      <Card variant="outlined">
        <CardContent>
          {header}
          <Typography color="text.secondary">No accounts yet.</Typography>
        </CardContent>
      </Card>
    )
  }
  if (series.length < 2) {
    return (
      <Card variant="outlined">
        <CardContent>
          {header}
          <Typography color="text.secondary">
            Not enough transaction history yet to show a trend.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const timestamps = series.map((p) => p.timestamp)
  const balances = series.map((p) => p.balance)
  const minT = Math.min(...timestamps)
  const maxT = Math.max(...timestamps)
  const rawMinBalance = Math.min(...balances)
  const rawMaxBalance = Math.max(...balances)
  // Pad the value domain so the line doesn't touch the top/bottom edges.
  const balanceRange = rawMaxBalance - rawMinBalance || Math.abs(rawMaxBalance) || 1
  const minBalance = rawMinBalance - balanceRange * 0.1
  const maxBalance = rawMaxBalance + balanceRange * 0.1

  const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
  const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom
  const timeRange = maxT - minT || 1

  const xScale = (t: number) => PADDING.left + ((t - minT) / timeRange) * plotWidth
  const yScale = (balance: number) =>
    PADDING.top + (1 - (balance - minBalance) / (maxBalance - minBalance)) * plotHeight

  const linePath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.timestamp)} ${yScale(p.balance)}`).join(' ')
  const areaPath = `${linePath} L ${xScale(series[series.length - 1].timestamp)} ${PADDING.top + plotHeight} L ${xScale(series[0].timestamp)} ${PADDING.top + plotHeight} Z`

  const current = series[series.length - 1]

  return (
    <Card variant="outlined">
      <CardContent>
        {header}
        <Stack spacing={1}>
      <Box sx={{ width: '100%' }}>
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Total balance trend, currently ${formatCurrency(current.balance)}`}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
              <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* Baseline for visual reference. */}
          <line
            x1={PADDING.left}
            y1={PADDING.top + plotHeight}
            x2={VIEWBOX_WIDTH - PADDING.right}
            y2={PADDING.top + plotHeight}
            stroke={theme.palette.divider}
            strokeWidth={1}
          />

          <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
          <path d={linePath} fill="none" stroke={theme.palette.primary.main} strokeWidth={2} />

          {series.map((p, i) => (
            <Tooltip key={p.timestamp} title={`${formatDate(p.timestamp)}: ${formatCurrency(p.balance)}`} arrow>
              <circle
                cx={xScale(p.timestamp)}
                cy={yScale(p.balance)}
                r={i === series.length - 1 ? 4 : 3}
                fill={theme.palette.background.paper}
                stroke={theme.palette.primary.main}
                strokeWidth={2}
                tabIndex={0}
                style={{ cursor: 'pointer', outline: 'none' }}
              />
            </Tooltip>
          ))}
        </svg>
      </Box>

      <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {formatDate(minT)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDate(maxT)}
        </Typography>
      </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}
