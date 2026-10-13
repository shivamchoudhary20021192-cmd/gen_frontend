import { useMemo, useState } from 'react'
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  TextField,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import type { JsonTemplate, SectionSchema } from '../themeTypes'
import { canAdd, type Target } from './editorModel'

/**
 * "Add section": every section the theme offers here, by its presets, grouped
 * by category and searchable — Shopify's picker. A section appears only if
 * its schema has a preset and its enabled_on / disabled_on allow this
 * template or group.
 */
export function AddSectionDialog({
  open,
  target,
  document,
  schemas,
  onClose,
  onAdd,
}: {
  open: boolean
  target: Target | null
  document: JsonTemplate | null
  schemas: Record<string, SectionSchema>
  onClose(): void
  onAdd(type: string, presetIndex: number): void
}) {
  const [term, setTerm] = useState('')
  const groups = useMemo(() => {
    if (!target || !document) return []
    const byCategory = new Map<string, { type: string; index: number; name: string }[]>()
    for (const [type, schema] of Object.entries(schemas)) {
      if (!canAdd(type, schema, target, document)) continue
      schema.presets!.forEach((preset, index) => {
        if (term && !`${preset.name} ${preset.category ?? ''} ${type}`.toLowerCase().includes(term.toLowerCase())) return
        const category = preset.category ?? 'Sections'
        byCategory.set(category, [...(byCategory.get(category) ?? []), { type, index, name: preset.name }])
      })
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => ({ category, items: items.sort((x, y) => x.name.localeCompare(y.name)) }))
  }, [target, document, schemas, term])

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { height: '70vh' } } }}>
      <DialogTitle sx={{ pb: 1 }}>Add section</DialogTitle>
      <Box sx={{ px: 3, pb: 1 }}>
        <TextField
          autoFocus
          size="small"
          fullWidth
          placeholder="Search sections"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        />
      </Box>
      <DialogContent dividers sx={{ p: 0 }}>
        {groups.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3 }}>
            {term ? `No sections match “${term}”.` : 'This theme has no sections that can be added here.'}
          </Typography>
        ) : (
          <List dense disablePadding>
            {groups.map((group) => (
              <li key={group.category}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader sx={{ lineHeight: '32px', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.06em' }}>{group.category}</ListSubheader>
                  {group.items.map((item) => (
                    <ListItemButton key={`${item.type}:${item.index}`} onClick={() => onAdd(item.type, item.index)}>
                      <ListItemText primary={item.name} secondary={schemas[item.type]?.name !== item.name ? schemas[item.type]?.name : undefined} />
                    </ListItemButton>
                  ))}
                </ul>
              </li>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  )
}
