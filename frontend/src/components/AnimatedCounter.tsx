import { useEffect, useRef, useState } from 'react'
import { Typography, type TypographyProps } from '@mui/material'

const DURATION_MS = 1000

// Cubic ease-out -- fast start, gentle settle.
function easeOut(t: number): number {
  return 1 - (1 - t) ** 3
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

export default function AnimatedCounter({
  amount,
  variant = 'h4',
  ...typographyProps
}: { amount: number } & Omit<TypographyProps, 'children'>) {
  const [displayed, setDisplayed] = useState(0)
  const fromRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const delta = amount - from
    if (delta === 0) {
      return
    }

    let frameId: number
    const startTime = performance.now()

    function tick(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / DURATION_MS, 1)
      setDisplayed(from + delta * easeOut(progress))
      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
      } else {
        fromRef.current = amount
      }
    }

    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [amount])

  return (
    <Typography variant={variant} {...typographyProps}>
      {formatCurrency(displayed)}
    </Typography>
  )
}
