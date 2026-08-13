/**
 * One side of a staff transfer (source or destination).
 *
 * Empty: a single search field. Typing filters customers/accounts; choosing
 * a result loads that account immediately — no separate lookup step.
 * Selected: a compact summary with a Change action to pick someone else.
 */

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { fuzzySearch } from '../utils/fuzzyMatch'
import { formatTimestamp, TYPE_COLOR } from '../utils/transactionDisplay'
import type { Account } from '../types/account'
import type { Transaction } from '../types/transaction'

export type AccountOption = {
  accountNumber: string
  customerName: string
  customerId: string
  email: string
  branchId: string
  /** True when the staff typed a number that is not in the customer directory. */
  manual?: boolean
}

export type SelectedAccount = {
  option: AccountOption
  account: Account
  recent: Transaction[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function optionHaystack(option: AccountOption): string {
  return `${option.customerName} ${option.accountNumber} ${option.email} ${option.customerId}`
}

type TransferAccountPickerProps = {
  label: string
  accent: 'primary' | 'secondary'
  options: AccountOption[]
  optionsLoading: boolean
  excludeAccountNumber?: string
  selected: SelectedAccount | null
  loading: boolean
  error: string | null
  onChoose: (option: AccountOption) => void
  onClear: () => void
}

export default function TransferAccountPicker({
  label,
  accent,
  options,
  optionsLoading,
  excludeAccountNumber,
  selected,
  loading,
  error,
  onChoose,
  onClear,
}: TransferAccountPickerProps) {
  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        minHeight: 280,
        borderTop: 3,
        borderTopColor: `${accent}.main`,
      }}
    >
      <CardContent sx={{ height: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1.2 }}>
            {label}
          </Typography>
          {selected && (
            <Button size="small" onClick={onClear}>
              Change
            </Button>
          )}
        </Stack>

        {selected ? (
          <SelectedSummary selected={selected} />
        ) : (
          <SearchField
            options={options}
            optionsLoading={optionsLoading}
            excludeAccountNumber={excludeAccountNumber}
            loading={loading}
            error={error}
            onChoose={onChoose}
          />
        )}
      </CardContent>
    </Card>
  )
}

function SearchField({
  options,
  optionsLoading,
  excludeAccountNumber,
  loading,
  error,
  onChoose,
}: {
  options: AccountOption[]
  optionsLoading: boolean
  excludeAccountNumber?: string
  loading: boolean
  error: string | null
  onChoose: (option: AccountOption) => void
}) {
  return (
    <Stack spacing={2}>
      <Autocomplete
        options={options}
        loading={optionsLoading}
        disabled={loading || optionsLoading}
        blurOnSelect
        autoHighlight
        getOptionLabel={(option) =>
          option.manual ? option.accountNumber : `${option.accountNumber} · ${option.customerName}`
        }
        isOptionEqualToValue={(a, b) => a.accountNumber === b.accountNumber}
        filterOptions={(opts, state) => {
          const query = state.inputValue.trim()
          if (!query) {
            return []
          }
          const filtered = fuzzySearch(opts, query, optionHaystack)
            .filter((option) => option.accountNumber !== excludeAccountNumber)
            .slice(0, 8)
          if (filtered.length === 0) {
            filtered.push({
              accountNumber: query,
              customerName: '',
              customerId: '',
              email: '',
              branchId: '',
              manual: true,
            })
          }
          return filtered
        }}
        onChange={(_event, value) => {
          if (value) {
            onChoose(value)
          }
        }}
        noOptionsText="Type a customer name or account number"
        renderOption={(props, option) => {
          const { key, ...rest } = props
          if (option.manual) {
            return (
              <Box component="li" key={key} {...rest}>
                <Box>
                  <Typography variant="body2">Use account {option.accountNumber}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Open this account number directly
                  </Typography>
                </Box>
              </Box>
            )
          }
          return (
            <Box component="li" key={key} {...rest}>
              <Box>
                <Typography variant="body2">{option.accountNumber}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {option.customerName}
                  {option.branchId ? ` · ${option.branchId}` : ''}
                </Typography>
              </Box>
            </Box>
          )
        }}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search"
            placeholder="Name or account number"
            helperText="Choose a result to load the account."
          />
        )}
      />
      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Opening account…
          </Typography>
        </Stack>
      )}
      {error && <Alert severity="warning">{error}</Alert>}
    </Stack>
  )
}

function SelectedSummary({ selected }: { selected: SelectedAccount }) {
  const { account, option, recent } = selected

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h6">{account.account_number}</Typography>
        <Typography color="text.secondary">{option.customerName || account.customer_id}</Typography>
      </Box>

      <Typography variant="h4">{formatCurrency(account.balance)}</Typography>

      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Chip size="small" label={account.account_type} variant="outlined" />
        <Chip
          size="small"
          label={account.is_active ? 'active' : 'inactive'}
          color={account.is_active ? 'success' : 'default'}
          variant="outlined"
        />
        <Chip size="small" label={account.branch_code} variant="outlined" />
      </Stack>

      {account.minimum_balance != null && (
        <Typography variant="body2" color="text.secondary">
          Minimum balance {formatCurrency(account.minimum_balance)}
        </Typography>
      )}
      {account.overdraft_limit != null && (
        <Typography variant="body2" color="text.secondary">
          Overdraft limit {formatCurrency(account.overdraft_limit)}
        </Typography>
      )}

      {!account.is_active && (
        <Alert severity="warning">Inactive accounts cannot be used in a transfer.</Alert>
      )}

      <Box>
        <Typography variant="caption" color="text.secondary">
          Recent activity
        </Typography>
        {recent.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            No transactions yet.
          </Typography>
        ) : (
          <Stack spacing={0.75} sx={{ mt: 0.75 }}>
            {recent.map((tx) => (
              <Stack
                key={tx.transaction_id}
                direction="row"
                spacing={1}
                sx={{ justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                  <Chip size="small" label={tx.type} color={TYPE_COLOR[tx.type]} variant="outlined" />
                  <Typography variant="body2" noWrap>
                    {formatTimestamp(tx.timestamp)}
                  </Typography>
                </Stack>
                <Typography variant="body2">{formatCurrency(tx.amount)}</Typography>
              </Stack>
            ))}
          </Stack>
        )}
      </Box>
    </Stack>
  )
}
