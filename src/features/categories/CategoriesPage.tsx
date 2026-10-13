import AddIcon from '@mui/icons-material/Add'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { ApiError } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { PageHeader } from '../../components/PageHeader'
import { useCategories, useCreateCategory } from '../products/useProducts'

export function CategoriesPage() {
  const { can } = useAuth()
  const list = useCategories()
  const create = useCreateCategory()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState<number | ''>('')
  const [error, setError] = useState<string | null>(null)

  const categories = list.data?.categories ?? []

  const submit = () => {
    setError(null)
    create.mutate(
      { name: name.trim(), parent_id: parentId === '' ? null : parentId },
      {
        onSuccess: () => {
          setName('')
          setParentId('')
          setOpen(false)
        },
        onError: (caught) =>
          setError(caught instanceof ApiError ? caught.message : 'Could not create the category.'),
      },
    )
  }

  return (
    <Box>
      <PageHeader
        title="Categories"
        subtitle={`${categories.length} total`}
        actions={
          can('products.create') ? (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>
              Add category
            </Button>
          ) : null
        }
      />

      <Card>
        {list.isLoading ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}>
            <CircularProgress size={26} />
          </Box>
        ) : categories.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="body2" color="text.secondary">
              No categories yet.
            </Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Path</TableCell>
                  <TableCell align="right">Products</TableCell>
                  <TableCell>Visibility</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ pl: category.depth * 2, fontWeight: 500 }}>
                        {category.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        /{category.path}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {/* The subtree number is the headline because it is what
                          clicking through to the product list returns; the
                          direct count is only worth showing when they differ. */}
                      <Typography variant="body2">{category.total_product_count}</Typography>
                      {category.total_product_count !== category.product_count && (
                        <Typography variant="caption" color="text.secondary">
                          {category.product_count} here,{' '}
                          {category.total_product_count - category.product_count} in sub-categories
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={category.is_active ? 'Active' : 'Hidden'}
                        color={category.is_active ? 'success' : 'default'}
                        variant={category.is_active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New category</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              autoFocus
              label="Name"
              placeholder="Serums"
              value={name}
              onChange={(event) => setName(event.target.value)}
              fullWidth
            />
            <TextField
              select
              label="Parent"
              value={parentId}
              onChange={(event) => setParentId(event.target.value === '' ? '' : Number(event.target.value))}
              helperText="Nesting is limited to four levels."
              fullWidth
            >
              <MenuItem value="">Top level — no parent</MenuItem>
              {categories
                .filter((category) => category.depth < 3)
                .map((category) => (
                  <MenuItem key={category.id} value={category.id}>
                    {'— '.repeat(category.depth)}
                    {category.name}
                  </MenuItem>
                ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={submit} disabled={!name.trim() || create.isPending}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
