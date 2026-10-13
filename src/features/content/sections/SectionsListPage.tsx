import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import SearchIcon from '@mui/icons-material/Search'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
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
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { PageHeader } from '../../../components/PageHeader'
import { useDebounce } from '../../../hooks/useDebounce'
import { tokens } from '../../../theme'
import {
  SECTION_KINDS,
  useCreateSection,
  useDeleteSection,
  useSectionLibrary,
  type SectionSummary,
} from './useSections'

/**
 * The section library.
 *
 * "Less harm, more pearl" is the same words on every product in a range, so it
 * is written once here and attached wherever it belongs. The "On" column is why
 * this is a library rather than a list: it says how many products an edit here
 * will change.
 */

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

export function SectionsListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const debounced = useDebounce(search, 300)
  const { data, isLoading, error } = useSectionLibrary(debounced)
  const create = useCreateSection()
  const remove = useDeleteSection()

  const [newName, setNewName] = useState('')
  const [newKind, setNewKind] = useState<string>('feature')
  const [banner, setBanner] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<SectionSummary | null>(null)

  const sections = data?.sections ?? []

  const add = async () => {
    setBanner(null)
    if (newName.trim().length < 2) {
      setBanner('Give the section a name you will recognise later.')
      return
    }
    try {
      const result = await create.mutateAsync({ section_key: newKind, name: newName.trim() })
      setNewName('')
      navigate(`/content/sections/${result.section.id}`)
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

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
        title="Story sections"
        subtitle="Written once, attached to as many products as they belong on."
      />

      {(banner || error) && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={banner ? () => setBanner(null) : undefined}>
          {banner ?? errorText(error)}
        </Alert>
      )}

      {deleting && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Delete “{deleting.name}”?
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            {deleting.usage_count > 0
              ? `It is still on ${deleting.usage_count} ${
                  deleting.usage_count === 1 ? 'product' : 'products'
                }. Take it off those first — deleting it now would strip a block of copy off each of them.`
              : 'It is not on any product, so nothing on the site changes.'}
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
              disabled={remove.isPending || deleting.usage_count > 0}
            >
              Delete
            </Button>
          </Stack>
        </Alert>
      )}

      <Card variant="outlined" sx={{ p: 2, mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search by name or heading"
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
                <TableCell>Name</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell align="right">Blocks</TableCell>
                <TableCell align="right">On</TableCell>
                <TableCell align="right" sx={{ width: 52 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && sections.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      {debounced ? 'Nothing matches that.' : 'No sections yet. Write the first one below.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}

              {sections.map((section) => (
                <TableRow
                  key={section.id}
                  hover
                  data-section-id={section.id}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/content/sections/${section.id}`)}
                >
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {section.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: tokens.subdued }}>
                      {section.heading ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={SECTION_KINDS.find((kind) => kind.key === section.section_key)?.label ?? section.section_key}
                      sx={{ bgcolor: tokens.sand, height: 20 }}
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ color: tokens.subdued }}>
                    {section.block_count}
                  </TableCell>
                  <TableCell align="right">
                    {/* The number that makes this a library: how many products
                        an edit here will change. */}
                    <Typography variant="body2" sx={{ color: tokens.subdued }}>
                      {section.usage_count === 0
                        ? '—'
                        : `${section.usage_count} product${section.usage_count === 1 ? '' : 's'}`}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      color="error"
                      aria-label={`Delete ${section.name}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleting(section)
                        setBanner(null)
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Card variant="outlined" sx={{ mt: 2, p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
          Write a section
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'flex-end' } }}>
          <TextField
            size="small"
            label="Name"
            placeholder="Pocket Pearl packaging"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void add()
            }}
            sx={{ minWidth: 260 }}
          />
          <TextField
            select
            size="small"
            label="Kind"
            value={newKind}
            onChange={(event) => setNewKind(event.target.value)}
            sx={{ minWidth: 220 }}
          >
            {SECTION_KINDS.map((kind) => (
              <MenuItem key={kind.key} value={kind.key}>
                {kind.label} — {kind.hint}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" startIcon={<AddIcon />} onClick={add} disabled={create.isPending}>
            Write it
          </Button>
        </Stack>
      </Card>
    </Box>
  )
}
