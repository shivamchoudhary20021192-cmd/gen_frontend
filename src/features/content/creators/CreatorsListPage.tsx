import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState } from 'react'
import { ApiError } from '../../../api/client'
import { PageHeader } from '../../../components/PageHeader'
import { useDebounce } from '../../../hooks/useDebounce'
import { tokens } from '../../../theme'
import { CreatorFormDialog } from './CreatorFormDialog'
import { useCreators, useDeleteCreator, type Creator } from './useCreators'

/**
 * The people whose faces sell the product.
 *
 * Kept as a library because that is how a brand actually works: you cast
 * someone for a campaign and she appears on the serum, the sunscreen and a
 * journal article. "Appears in" is on the table for the same reason — before
 * removing someone, you want to know what she is currently in.
 */

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

export function CreatorsListPage() {
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)
  const { data, isLoading, error } = useCreators(debounced)
  const remove = useDeleteCreator()

  const [editing, setEditing] = useState<Creator | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Creator | null>(null)
  const [banner, setBanner] = useState<string | null>(null)

  const creators = data?.creators ?? []

  const confirmDelete = async () => {
    if (!deleting) return
    setBanner(null)
    try {
      await remove.mutateAsync(deleting.id)
      setDeleting(null)
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  return (
    <Box>
      <PageHeader
        title="Creators"
        subtitle="The models, founders and artists whose looks appear across the shop."
        actions={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Add a person
          </Button>
        }
      />

      {(banner || error) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={banner ? () => setBanner(null) : undefined}>
          {banner ?? errorText(error)}
        </Alert>
      )}

      {deleting && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Remove {deleting.name}?
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {deleting.block_count > 0
              ? `She is featured in ${deleting.block_count} ${
                  deleting.block_count === 1 ? 'look' : 'looks'
                }. Those keep working — this only takes her out of the picker for new ones.`
              : 'She is not featured anywhere, so nothing on the site changes.'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={confirmDelete}
              disabled={remove.isPending}
            >
              Remove
            </Button>
          </Stack>
        </Alert>
      )}

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name or handle"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          sx={{ minWidth: 280 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Card>

      <Card variant="outlined">
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 64 }} />
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Follow</TableCell>
                <TableCell align="right">Appears in</TableCell>
                <TableCell align="right" sx={{ width: 110 }}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && creators.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      {debounced
                        ? 'Nobody matches that.'
                        : 'Nobody yet. Add the first person and she can be featured on any product.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {creators.map((creator) => (
                <TableRow key={creator.id} hover data-creator-id={creator.id}>
                  <TableCell>
                    <Avatar
                      src={creator.portrait ?? undefined}
                      sx={{ width: 40, height: 40, bgcolor: tokens.ivory, color: tokens.taupe }}
                    >
                      {creator.name.charAt(0).toUpperCase()}
                    </Avatar>
                  </TableCell>

                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {creator.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.subdued }}>
                      {creator.handle ?? '—'}
                    </Typography>
                    {!creator.is_active && (
                      <Chip size="small" label="Not available" sx={{ ml: 1, height: 20 }} />
                    )}
                  </TableCell>

                  <TableCell sx={{ color: tokens.subdued }}>{creator.role ?? '—'}</TableCell>

                  <TableCell>
                    {creator.instagram_url ? (
                      // The link opens where it says it opens, and noopener is
                      // not optional on a URL somebody typed into a form.
                      <MuiLink
                        href={creator.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        sx={{ color: tokens.info, display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      >
                        Instagram <OpenInNewIcon sx={{ fontSize: 13 }} />
                      </MuiLink>
                    ) : (
                      <Typography variant="body2" sx={{ color: tokens.subdued }}>
                        —
                      </Typography>
                    )}
                  </TableCell>

                  <TableCell align="right">
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      {creator.block_count === 0
                        ? '—'
                        : `${creator.block_count} ${creator.block_count === 1 ? 'look' : 'looks'}`}
                    </Typography>
                  </TableCell>

                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                      <IconButton
                        size="small"
                        aria-label={`Edit ${creator.name}`}
                        onClick={() => {
                          setEditing(creator)
                          setFormOpen(true)
                          setDeleting(null)
                        }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label={`Remove ${creator.name}`}
                        onClick={() => {
                          setDeleting(creator)
                          setBanner(null)
                        }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <CreatorFormDialog open={formOpen} creator={editing} onClose={() => setFormOpen(false)} />
    </Box>
  )
}
