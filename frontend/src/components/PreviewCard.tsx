/**
 * Generic "small preview of a bigger page" card: a title, a compact bit of
 * content (a mini table, typically), and a "View all" button that navigates
 * to the full page. Used by both RecentAccountsPreview and
 * RecentTransactionsPreview on the Dashboard so the shell isn't duplicated.
 */

import type { ReactNode } from 'react'
import { Button, Card, CardContent, Stack, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export default function PreviewCard({
  title,
  viewAllTo,
  viewAllLabel = 'View all',
  children,
}: {
  title: string
  viewAllTo: string
  viewAllLabel?: string
  children: ReactNode
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="subtitle1">{title}</Typography>
          <Button component={RouterLink} to={viewAllTo} size="small">
            {viewAllLabel}
          </Button>
        </Stack>
        {children}
      </CardContent>
    </Card>
  )
}
