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
    // `balance` here is "the balance right after transaction i" on this
    // pass, since we start from the current (i.e. after the *last*
    // transaction) balance and walk backward.
    afterBalances[i] = balance
    const tx = relevant[i]
    const isIncoming = tx.to_account_id === account.account_number
    // Reversing the transaction's effect: an incoming credit is subtracted
    // back out, an outgoing debit is added back in, leaving `balance` equal
    // to what it was immediately *before* transaction i.
    balance = isIncoming ? balance - tx.amount : balance + tx.amount
  }
  // After the loop, `balance` has been walked back past the earliest known
  // transaction -- this is the account's balance right before it happened.
  const beforeFirst = balance

  const points: Point[] = [
    { timestamp: new Date(relevant[0].timestamp).getTime(), balance: beforeFirst },
    ...relevant.map((tx, i) => ({ timestamp: new Date(tx.timestamp).getTime(), balance: afterBalances[i] })),
  ]
  // Extend the line to "now" at the current known balance.
  points.push({ timestamp: Date.now(), balance: account.balance })
  return points
}

/** A step function: the balance held at time `t` is whatever it was set to
 * by the most recent point at or before `t` (series is assumed sorted). */
function balanceAt(series: Point[], t: number): number {
  let result = series[0].balance
  for (const p of series) {
    if (p.timestamp <= t) {
      result = p.balance
    } else {
      // Series is sorted ascending, so once a point is later than `t`
      // every remaining point will be too -- safe to stop scanning.
      break
    }
  }
  return result
}

/** Sums every account's reconstructed series onto one shared timeline. */
function buildAggregateSeries(accounts: Account[], transactions: Transaction[]): Point[] {
  const perAccountSeries = accounts.map((account) => reconstructAccountSeries(account, transactions))
  // Each account has its own set of transaction timestamps; merge and
  // dedupe them into one shared timeline so every account gets evaluated
  // (via balanceAt's step function) at every point any account changed.
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
  // The `|| Math.abs(rawMaxBalance) || 1` fallback chain handles a flat
  // line (min === max): first try 10% of the value itself, then just fall
  // back to a fixed unit so a $0 flat line still gets a visible range.
  const balanceRange = rawMaxBalance - rawMinBalance || Math.abs(rawMaxBalance) || 1
  const minBalance = rawMinBalance - balanceRange * 0.1
  const maxBalance = rawMaxBalance + balanceRange * 0.1

  const plotWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right
  const plotHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom
  const timeRange = maxT - minT || 1

  // Map a timestamp/balance (data space) to an SVG x/y coordinate (viewBox
  // space). yScale inverts the fraction (`1 - ...`) because SVG y grows
  // downward while a higher balance should plot higher up (smaller y).
  const xScale = (t: number) => PADDING.left + ((t - minT) / timeRange) * plotWidth
  const yScale = (balance: number) =>
    PADDING.top + (1 - (balance - minBalance) / (maxBalance - minBalance)) * plotHeight

  // The line itself: "M" (move to) the first point, then "L" (line to)
  // every point after it.
  const linePath = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xScale(p.timestamp)} ${yScale(p.balance)}`).join(' ')
  // The filled area under the line: reuse the line path, then drop straight
  // down to the baseline at the last point, run back along the baseline to
  // the first point's x, and close -- turns the line into a closed shape
  // that can be filled with the gradient below.
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
