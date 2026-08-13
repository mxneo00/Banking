/**
 * Customer profile card for the Dashboard. Pulled out of DashboardPage.tsx
 * so it's a standalone, reusable component like TotalBalanceCard.
 *
 * `user` (not just `customer`) is needed for `created_at`, because
 * the field lives on the auth User record, not on Customer.
 */

import { Card, CardContent, Chip, Stack, Typography } from '@mui/material'

import type { User } from '../types/auth'
import type { Customer } from '../types/customer'

function formatMemberSince(value: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

export default function ProfileCard({ customer, user }: { customer: Customer; user: User }) {
  const memberSince = formatMemberSince(user.created_at)

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1">Profile</Typography>
          {!customer.is_active && <Chip size="small" color="warning" label="Inactive" />}
        </Stack>

        <Typography variant="body1">{customer.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {customer.email}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Customer ID: {customer.customer_id}
        </Typography>
        {memberSince && (
          <Typography variant="body2" color="text.secondary">
            Member since {memberSince}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
