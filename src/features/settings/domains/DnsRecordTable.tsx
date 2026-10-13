import { Box, Chip, IconButton, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { useState } from 'react'
import type { DnsRecordCheck } from './domainTypes'

/** Most DNS providers want the name relative to the domain: "www", or "@" for the domain itself. */
function relativeName(name: string, root: string): string {
  if (name === root) return '@'
  return name.endsWith(`.${root}`) ? name.slice(0, -root.length - 1) : name
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Box component="span" sx={{ fontFamily: 'monospace', fontSize: 12.5, wordBreak: 'break-all' }}>
        {value}
      </Box>
      <Tooltip title={copied ? 'Copied' : 'Copy'}>
        <IconButton
          size="small"
          aria-label={`Copy ${value}`}
          onClick={() =>
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1500)
            })
          }
        >
          <ContentCopyIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Tooltip>
    </Box>
  )
}

/**
 * The records a domain needs, each with what DNS shows now: a checklist the
 * merchant works through at their provider.
 */
export function DnsRecordTable({ records, rootDomain }: { records: DnsRecordCheck[]; rootDomain: string }) {
  return (
    <Table size="small" sx={{ '& td': { verticalAlign: 'top' } }}>
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 32 }} />
          <TableCell sx={{ width: 70 }}>Type</TableCell>
          <TableCell>Name (host)</TableCell>
          <TableCell>Value (points to)</TableCell>
          <TableCell>Found now</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {records.map((record) => (
          <TableRow key={`${record.type}-${record.name}-${record.value}`}>
            <TableCell>
              {record.status === 'ok' ? (
                <CheckCircleIcon color="success" fontSize="small" titleAccess="Found" />
              ) : record.status === 'wrong' ? (
                <ErrorOutlineIcon color="error" fontSize="small" titleAccess="Something else is there" />
              ) : (
                <RadioButtonUncheckedIcon color="disabled" fontSize="small" titleAccess={record.status === 'optional' ? 'Optional' : 'Not found yet'} />
              )}
            </TableCell>
            <TableCell>
              <Chip size="small" label={record.type} variant="outlined" />
            </TableCell>
            <TableCell>
              <CopyValue value={relativeName(record.name, rootDomain)} />
              {relativeName(record.name, rootDomain) !== record.name && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {record.name}
                </Typography>
              )}
            </TableCell>
            <TableCell>
              <CopyValue value={record.value} />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {record.purpose}
              </Typography>
            </TableCell>
            <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, color: record.status === 'wrong' ? 'error.main' : 'text.secondary', wordBreak: 'break-all' }}>
              {record.found.length ? record.found.join(', ') : '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
