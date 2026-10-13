import AddIcon from '@mui/icons-material/Add'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import RefreshIcon from '@mui/icons-material/Refresh'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { formatRelative } from '../../lib/format'
import { useCollectionList, useRecalculateCollection } from './useCollections'

export function CollectionsPage() {
  const { can } = useAuth()
  const navigate = useNavigate()

  const list = useCollectionList()
  const recalculate = useRecalculateCollection()

  const collections = list.data?.collections ?? []
  const canEdit = can('products.update')

  return (
    <Box>
      <PageHeader
        title="Collections"
        subtitle={`${collections.length} total`}
        actions={
          canEdit ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/collections/new')}>
              Create collection
            </Button>
          ) : null
        }
      />

      <Card>
        {list.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : collections.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No collections yet. A collection groups products for the storefront — either by hand,
              or from rules that keep themselves up to date.
            </Typography>
            {canEdit && (
              <Button variant="outlined" onClick={() => navigate('/collections/new')}>
                Create your first collection
              </Button>
            )}
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell align="right">Products</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow
                    key={collection.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/collections/${collection.id}`)}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {collection.title}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        /{collection.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                        {collection.collection_type === 'automatic' && (
                          <Tooltip
                            title={
                              collection.rules
                                ?.map((r) => `${r.field} ${r.operator} ${r.value ?? ''}`)
                                .join(` ${collection.match_condition === 'all' ? 'AND' : 'OR'} `) ?? ''
                            }
                          >
                            <AutoAwesomeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                          </Tooltip>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {collection.collection_type}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2">{collection.product_count}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={collection.is_active ? 'Active' : 'Hidden'}
                        color={collection.is_active ? 'success' : 'default'}
                        variant={collection.is_active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {formatRelative(collection.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right" onClick={(event) => event.stopPropagation()}>
                      {/* Automatic membership is materialised server-side, so a
                          catalogue change needs a recalculation to show up. */}
                      {collection.collection_type === 'automatic' && canEdit && (
                        <Button
                          size="small"
                          startIcon={<RefreshIcon fontSize="small" />}
                          onClick={() => recalculate.mutate(collection.id)}
                          disabled={recalculate.isPending}
                        >
                          Recalculate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>
    </Box>
  )
}
