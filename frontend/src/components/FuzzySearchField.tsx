/**
 * Search box for fuzzy-matched text search (see utils/fuzzyMatch.ts for the
 * actual algorithm). This is just the input, styled to signal it's a fuzzy
 * search rather than an exact substring match).
 */

import { InputAdornment, TextField, type TextFieldProps } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

type FuzzySearchFieldProps = Omit<TextFieldProps, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
}

export default function FuzzySearchField({ value, onChange, ...textFieldProps }: FuzzySearchFieldProps) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          ),
        },
      }}
      {...textFieldProps}
    />
  )
}
