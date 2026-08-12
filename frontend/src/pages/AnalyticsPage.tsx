import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
} from '@mui/material'
import GroupsIcon from '@mui/icons-material/Groups'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import AccountTreeIcon from '@mui/icons-material/AccountTree'

const metricCards = [
  {
    title: 'Active customers',
    value: '—',
    helper: 'Staff analytics placeholder',
    icon: <GroupsIcon color="secondary" />,
  },
  {
    title: 'Branch activity',
    value: '—',
    helper: 'Will use customer/transaction APIs',
    icon: <TrendingUpIcon color="secondary" />,
  },
  {
    title: 'Linked accounts',
    value: '—',
    helper: 'Aggregates wired in a later step',
    icon: <AccountTreeIcon color="secondary" />,
  },
]

export default function AnalyticsPage() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Analytics
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Branch and performance indicators for managers and staff.
      </Typography>

      <Grid container spacing={2}>
        {metricCards.map((card) => (
          <Grid key={card.title} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {card.icon}
                  <Typography variant="subtitle1">{card.title}</Typography>
                </Box>
                <Typography variant="h5">{card.value}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {card.helper}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
