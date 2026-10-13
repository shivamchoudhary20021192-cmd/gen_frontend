import { useState, type DragEvent } from 'react'
import { Box, Button, IconButton, ListItemText, Menu, MenuItem, Stack, Tooltip, Typography } from '@mui/material'
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import WidgetsOutlinedIcon from '@mui/icons-material/WidgetsOutlined'
import type { JsonTemplate, SectionSchema } from '../themeTypes'
import { blockLabel, blockOrder, canAddBlock, sectionLabel, type Target } from './editorModel'

/**
 * The left pane: the page's sections, in the order they render — the
 * header group, the template, the footer group — each with its blocks.
 * Rows drag to reorder within their list; the eye hides without deleting;
 * "Add section" and "Add block" insert where they are.
 */

export interface TreeTarget extends Target {
  label: string
  document: JsonTemplate
}

export type Selection = { file: string; section: string; block?: string } | null

interface Props {
  targets: TreeTarget[]
  schemas: Record<string, SectionSchema>
  selection: Selection
  expanded: Set<string>
  disabled: boolean
  onSelect(selection: Selection): void
  onToggleExpand(key: string): void
  onToggleSection(file: string, section: string): void
  onToggleBlock(file: string, section: string, block: string): void
  onAddSection(target: Target): void
  onAddBlock(file: string, section: string, type: string): void
  onMoveSection(file: string, section: string, index: number): void
  onMoveBlock(file: string, section: string, block: string, index: number): void
}

type Drag = { kind: 'section'; file: string; id: string } | { kind: 'block'; file: string; section: string; id: string } | null

const rowSx = (selected: boolean, hidden: boolean) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  minHeight: 34,
  pr: 0.5,
  borderRadius: 1,
  cursor: 'pointer',
  color: hidden ? 'text.disabled' : 'text.primary',
  bgcolor: selected ? 'action.selected' : 'transparent',
  '&:hover': { bgcolor: selected ? 'action.selected' : 'action.hover' },
  '&:hover .row-actions': { opacity: 1 },
})

export function SectionTree(props: Props) {
  const { targets, schemas, selection, expanded, disabled } = props
  const [drag, setDrag] = useState<Drag>(null)
  const [dropAt, setDropAt] = useState<string | null>(null)
  const [blockMenu, setBlockMenu] = useState<{ anchor: HTMLElement; file: string; section: string } | null>(null)

  const onDragOver = (event: DragEvent, key: string, accepts: boolean) => {
    if (!accepts) return
    event.preventDefault()
    setDropAt(key)
  }

  return (
    <Box sx={{ py: 1 }}>
      {targets.map((target) => {
        const doc = target.document
        return (
          <Box key={target.file} sx={{ mb: 1.5 }}>
            <Typography variant="caption" sx={{ px: 1.5, display: 'block', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', mb: 0.25 }}>
              {target.label}
            </Typography>
            {doc.order.map((sectionId, index) => {
              const section = doc.sections[sectionId]
              if (!section) return null
              const schema = schemas[section.type]
              const key = `${target.file}::${sectionId}`
              const open = expanded.has(key)
              const blocks = blockOrder(section).filter((id) => section.blocks?.[id])
              const selected = selection?.file === target.file && selection.section === sectionId && !selection.block
              const hidden = Boolean(section.disabled)
              const addableBlocks = (schema?.blocks ?? []).filter((block) => canAddBlock(section, schema!, block.type))
              return (
                <Box key={sectionId}>
                  {drag?.kind === 'section' && dropAt === `${key}:before` && <Box sx={{ height: 2, bgcolor: 'primary.main', mx: 1, borderRadius: 1 }} />}
                  <Box
                    sx={{ ...rowSx(selected, hidden), pl: 0.5 }}
                    draggable={!disabled}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move'
                      setDrag({ kind: 'section', file: target.file, id: sectionId })
                    }}
                    onDragEnd={() => {
                      setDrag(null)
                      setDropAt(null)
                    }}
                    onDragOver={(event) => onDragOver(event, `${key}:before`, drag?.kind === 'section' && drag.file === target.file && drag.id !== sectionId)}
                    onDrop={(event) => {
                      event.preventDefault()
                      if (drag?.kind === 'section' && drag.file === target.file) {
                        const from = doc.order.indexOf(drag.id)
                        props.onMoveSection(target.file, drag.id, from < index ? index - 1 : index)
                      }
                      setDrag(null)
                      setDropAt(null)
                    }}
                    onClick={() => props.onSelect({ file: target.file, section: sectionId })}
                  >
                    <IconButton
                      size="small"
                      aria-label={open ? 'Collapse' : 'Expand'}
                      sx={{ visibility: blocks.length || addableBlocks.length ? 'visible' : 'hidden', p: 0.25 }}
                      onClick={(event) => {
                        event.stopPropagation()
                        props.onToggleExpand(key)
                      }}
                    >
                      {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                    </IconButton>
                    <ViewAgendaOutlinedIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: selected ? 600 : 400 }}>
                      {sectionLabel(section, schema)}
                    </Typography>
                    {!disabled && (
                      <Stack className="row-actions" direction="row" sx={{ opacity: hidden ? 1 : 0, transition: 'opacity .12s' }}>
                        {!section.type.startsWith('main-') && (
                          <Tooltip title={hidden ? 'Show section' : 'Hide section'}>
                            <IconButton
                              size="small"
                              aria-label={hidden ? 'Show section' : 'Hide section'}
                              onClick={(event) => {
                                event.stopPropagation()
                                props.onToggleSection(target.file, sectionId)
                              }}
                            >
                              {hidden ? <VisibilityOffOutlinedIcon sx={{ fontSize: 16 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 16 }} />}
                            </IconButton>
                          </Tooltip>
                        )}
                        <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.disabled', cursor: 'grab', alignSelf: 'center' }} />
                      </Stack>
                    )}
                  </Box>

                  {open && (
                    <Box sx={{ pl: 3.5 }}>
                      {blocks.map((blockId, blockIndex) => {
                        const block = section.blocks![blockId]
                        const definition = schema?.blocks?.find((candidate) => candidate.type === block.type)
                        const blockSelected = selection?.file === target.file && selection.section === sectionId && selection.block === blockId
                        const blockKey = `${key}::${blockId}`
                        return (
                          <Box key={blockId}>
                            {drag?.kind === 'block' && dropAt === `${blockKey}:before` && <Box sx={{ height: 2, bgcolor: 'primary.main', mr: 1, borderRadius: 1 }} />}
                            <Box
                              sx={{ ...rowSx(blockSelected, Boolean(block.disabled)), pl: 1 }}
                              draggable={!disabled}
                              onDragStart={(event) => {
                                event.stopPropagation()
                                event.dataTransfer.effectAllowed = 'move'
                                setDrag({ kind: 'block', file: target.file, section: sectionId, id: blockId })
                              }}
                              onDragEnd={() => {
                                setDrag(null)
                                setDropAt(null)
                              }}
                              onDragOver={(event) => onDragOver(event, `${blockKey}:before`, drag?.kind === 'block' && drag.section === sectionId && drag.file === target.file && drag.id !== blockId)}
                              onDrop={(event) => {
                                event.preventDefault()
                                event.stopPropagation()
                                if (drag?.kind === 'block' && drag.section === sectionId) {
                                  const from = blocks.indexOf(drag.id)
                                  props.onMoveBlock(target.file, sectionId, drag.id, from < blockIndex ? blockIndex - 1 : blockIndex)
                                }
                                setDrag(null)
                                setDropAt(null)
                              }}
                              onClick={() => props.onSelect({ file: target.file, section: sectionId, block: blockId })}
                            >
                              <WidgetsOutlinedIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
                              <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: blockSelected ? 600 : 400 }}>
                                {blockLabel(block, definition)}
                              </Typography>
                              {!disabled && (
                                <Stack className="row-actions" direction="row" sx={{ opacity: block.disabled ? 1 : 0 }}>
                                  <IconButton
                                    size="small"
                                    aria-label={block.disabled ? 'Show block' : 'Hide block'}
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      props.onToggleBlock(target.file, sectionId, blockId)
                                    }}
                                  >
                                    {block.disabled ? <VisibilityOffOutlinedIcon sx={{ fontSize: 15 }} /> : <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />}
                                  </IconButton>
                                  <DragIndicatorIcon sx={{ fontSize: 15, color: 'text.disabled', cursor: 'grab', alignSelf: 'center' }} />
                                </Stack>
                              )}
                            </Box>
                          </Box>
                        )
                      })}
                      {!disabled && addableBlocks.length > 0 && (
                        <Button
                          size="small"
                          startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />}
                          sx={{ justifyContent: 'flex-start', textTransform: 'none', pl: 1 }}
                          onClick={(event) => setBlockMenu({ anchor: event.currentTarget, file: target.file, section: sectionId })}
                        >
                          Add block
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>
              )
            })}
            {drag?.kind === 'section' && drag.file === target.file && (
              <Box
                onDragOver={(event) => onDragOver(event, `${target.file}:end`, true)}
                onDrop={(event) => {
                  event.preventDefault()
                  props.onMoveSection(target.file, drag.id, doc.order.length - 1)
                  setDrag(null)
                  setDropAt(null)
                }}
                sx={{ height: 14, mx: 1, borderTop: 2, borderColor: dropAt === `${target.file}:end` ? 'primary.main' : 'transparent' }}
              />
            )}
            {!disabled && (
              <Button size="small" startIcon={<AddCircleOutlineIcon sx={{ fontSize: 16 }} />} sx={{ textTransform: 'none', ml: 1 }} onClick={() => props.onAddSection(target)}>
                Add section
              </Button>
            )}
          </Box>
        )
      })}

      <Menu anchorEl={blockMenu?.anchor} open={Boolean(blockMenu)} onClose={() => setBlockMenu(null)}>
        {blockMenu &&
          (() => {
            const target = targets.find((candidate) => candidate.file === blockMenu.file)
            const section = target?.document.sections[blockMenu.section]
            const schema = section ? schemas[section.type] : undefined
            return (schema?.blocks ?? []).map((block) => (
              <MenuItem
                key={block.type}
                disabled={!section || !canAddBlock(section, schema!, block.type)}
                onClick={() => {
                  props.onAddBlock(blockMenu.file, blockMenu.section, block.type)
                  setBlockMenu(null)
                }}
              >
                <ListItemText primary={block.name} secondary={block.app ? `App · ${block.app}` : undefined} />
              </MenuItem>
            ))
          })()}
      </Menu>
    </Box>
  )
}
