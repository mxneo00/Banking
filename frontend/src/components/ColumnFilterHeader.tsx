/**
 * Generic filterable table-column header: replaces a plain column label with
 * the same label plus a small dropdown-indicator icon. Clicking anywhere on
 * the header opens a popover anchored to it; what's inside the popover is up
 * to the caller (a list of selectable values, a text field, ...), so this
 * one component drives every filterable column (Type/From/To in
 * TransactionHistoryPage today) without knowing what any of them filter by.
 */

import { useState, type ReactNode } from 'react'
import { Box, Popover, Stack, TableCell, Typography, type TableCellProps } from '@mui/material'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

type ColumnFilterHeaderProps = {
  label: string
  /** Highlights the label/icon and keeps them visible when a filter is applied. */
  active: boolean
  align?: TableCellProps['align']
  /** Popover content. Receives a `close` callback for filters that should
   * dismiss themselves on selection (e.g. picking one radio option). */
  children: (close: () => void) => ReactNode
}

export default function ColumnFilterHeader({ label, active, align, children }: ColumnFilterHeaderProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)

  return (
    <TableCell align={align}>
      <Stack
        direction="row"
        spacing={0.25}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          alignItems: 'center',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          cursor: 'pointer',
          userSelect: 'none',
          width: 'fit-content',
          ...(align === 'right' && { ml: 'auto' }),
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: active ? 700 : 600, color: active ? 'primary.main' : 'text.primary' }}
        >
          {label}
        </Typography>
        <ArrowDropDownIcon fontSize="small" color={active ? 'primary' : 'action'} />
      </Stack>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, minWidth: 220 }}>{children(() => setAnchorEl(null))}</Box>
      </Popover>
    </TableCell>
  )
}
