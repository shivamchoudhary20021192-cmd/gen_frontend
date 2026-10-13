import AddIcon from '@mui/icons-material/Add'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import PlaceIcon from '@mui/icons-material/Place'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../../api/client'
import { PageHeader } from '../../../components/PageHeader'
import { MediaPicker } from '../../media/MediaPicker'
import { tokens } from '../../../theme'
import { useCreators } from '../creators/useCreators'
import { HotspotEditor } from './HotspotEditor'
import {
  BLOCK_KINDS,
  SECTION_KINDS,
  useAddBlock,
  useDeleteBlock,
  useReorderBlocks,
  useSection,
  useSetHotspots,
  useUpdateBlock,
  useUpdateSection,
  type SectionBlock,
} from './useSections'
import type { Media } from '../../../api/types'

/**
 * One story section and the blocks inside it.
 *
 * The section carries the words around the content — the heading, the standfirst,
 * the footnote — and each block is one repeatable thing: a statistic, a look, a
 * labelled diagram. Blocks save one at a time rather than as a form, because a
 * section can hold a dozen of them and nobody wants a single Save that either
 * writes all twelve or none.
 */

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

function BlockCard({
  sectionId,
  block,
  index,
  total,
  onBanner,
  onMove,
}: {
  sectionId: number
  block: SectionBlock
  index: number
  total: number
  onBanner: (message: string | null) => void
  /** Reordering is the page's job — it is the only thing that knows the order. */
  onMove: (from: number, to: number) => void
}) {
  const updateBlock = useUpdateBlock()
  const deleteBlock = useDeleteBlock()
  const setHotspots = useSetHotspots()
  const creators = useCreators()

  const [heading, setHeading] = useState(block.heading ?? '')
  const [body, setBody] = useState(block.body ?? '')
  const [pickerFor, setPickerFor] = useState<'media' | 'secondary' | null>(null)
  const [pinsOpen, setPinsOpen] = useState(false)

  // Re-seeded when the block changes underneath — after a save, a reorder, or
  // someone else's edit arriving through an invalidation.
  useEffect(() => {
    setHeading(block.heading ?? '')
    setBody(block.body ?? '')
  }, [block.id, block.heading, block.body])

  /**
   * Whether this person may be named at all.
   *
   * Read off their own record rather than off the block, because the block
   * cannot grant what the booking withheld. When it is false the switch below
   * is off and disabled, and says why.
   */
  const identityAllowed =
    (creators.data?.creators ?? []).find((person) => person.id === block.creator?.id)
      ?.is_identity_public !== false

  const patch = async (input: Parameters<typeof updateBlock.mutateAsync>[0]['input']) => {
    onBanner(null)
    try {
      await updateBlock.mutateAsync({ sectionId, blockId: block.id, input })
    } catch (caught) {
      onBanner(errorText(caught))
    }
  }

  const move = (direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= total) return
    onMove(index, target)
  }

  return (
    <Card variant="outlined" sx={{ mb: 2 }} data-block-id={block.id}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
          <Chip size="small" label={block.block_type} sx={{ bgcolor: tokens.sand }} />
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" aria-label="Move up" disabled={index === 0} onClick={() => move(-1)}>
            <ArrowUpwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            aria-label="Move down"
            disabled={index === total - 1}
            onClick={() => move(1)}
          >
            <ArrowDownwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            aria-label={`Remove block ${index + 1}`}
            onClick={async () => {
              onBanner(null)
              try {
                await deleteBlock.mutateAsync({ sectionId, blockId: block.id })
              } catch (caught) {
                onBanner(errorText(caught))
              }
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>

        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              fullWidth
              size="small"
              label="Heading"
              placeholder="100%"
              value={heading}
              onChange={(event) => setHeading(event.target.value)}
              onBlur={() => heading !== (block.heading ?? '') && patch({ heading: heading || null })}
            />
            <TextField
              fullWidth
              size="small"
              label="Body"
              placeholder="said it gave cheeks a natural glow"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onBlur={() => body !== (block.body ?? '') && patch({ body: body || null })}
            />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mb: 0.5 }}>
                Picture or film
              </Typography>
              {block.media ? (
                <Box sx={{ position: 'relative' }}>
                  {block.media_type === 'video' ? (
                    <Box
                      component="video"
                      src={block.media}
                      poster={block.poster ?? undefined}
                      muted
                      controls
                      sx={{ width: 160, borderRadius: 1.5, display: 'block' }}
                    />
                  ) : (
                    <Box
                      component="img"
                      src={block.media}
                      alt=""
                      sx={{ width: 160, borderRadius: 1.5, display: 'block' }}
                    />
                  )}
                  <Button size="small" sx={{ mt: 0.5 }} onClick={() => setPickerFor('media')}>
                    Change
                  </Button>
                </Box>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddPhotoAlternateIcon />}
                  onClick={() => setPickerFor('media')}
                >
                  Choose
                </Button>
              )}
            </Box>

            <Box sx={{ flex: 1 }}>
              <Stack spacing={2}>
                <TextField
                  select
                  size="small"
                  label="Whose look this is"
                  value={block.creator?.id ?? ''}
                  onChange={(event) =>
                    patch({ creator_id: event.target.value === '' ? null : Number(event.target.value) })
                  }
                  helperText="Only for a look — leaves the callouts anonymous otherwise"
                >
                  <MenuItem value="">Nobody</MenuItem>
                  {(creators.data?.creators ?? []).map((creator) => (
                    <MenuItem key={creator.id} value={creator.id}>
                      {creator.name}
                      {creator.handle ? ` · ${creator.handle}` : ''}
                      {creator.is_identity_public === false ? ' · not named publicly' : ''}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Per shoot, not per person. The same model may be named on a
                    campaign and left anonymous on a texture shot — so the
                    choice belongs on the block. It cannot override the person's
                    own setting: a model booked without a credit stays anonymous
                    here however this switch is left. */}
                {block.creator && (
                  <Box>
                    <FormControlLabel
                      control={
                        <Switch
                          size="small"
                          checked={identityAllowed && block.credit_creator !== false}
                          disabled={!identityAllowed}
                          onChange={(event) => patch({ credit_creator: event.target.checked })}
                        />
                      }
                      label="Credit them on the site"
                    />
                    <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block' }}>
                      {!identityAllowed
                        ? `${block.creator.name ?? 'This person'} is set to never be named on the site. The photograph is used; the name and link are not.`
                        : block.credit_creator === false
                          ? 'The photograph is used anonymously — no name, handle, portrait or link reaches the site.'
                          : 'Their name and Instagram link show beside this photograph.'}
                    </Typography>
                  </Box>
                )}

                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<PlaceIcon />}
                  disabled={!block.media}
                  onClick={() => setPinsOpen(true)}
                  data-pins-for={block.id}
                >
                  {block.hotspots.length > 0
                    ? `${block.hotspots.length} label${block.hotspots.length === 1 ? '' : 's'} pinned`
                    : 'Pin labels on it'}
                </Button>
                {!block.media && (
                  <Typography variant="caption" sx={{ color: tokens.subdued }}>
                    A label needs a picture to be pinned to.
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </CardContent>

      <MediaPicker
        open={pickerFor !== null}
        onClose={() => setPickerFor(null)}
        onSelect={(selection: Media[]) => {
          const picked = selection[0]
          if (!picked) return
          void patch(
            pickerFor === 'secondary'
              ? { secondary_media_id: picked.id }
              : { media_id: picked.id },
          )
        }}
        multiple={false}
        maxSelection={1}
        title="Choose a picture or film"
        confirmLabel="Use this"
        // A look can be a film, so this slot opens on everything.
        defaultMediaType=""
      />

      <HotspotEditor
        open={pinsOpen}
        image={block.media_type === 'video' ? block.poster : block.media}
        hotspots={block.hotspots}
        saving={setHotspots.isPending}
        onClose={() => setPinsOpen(false)}
        onSave={async (hotspots) => {
          onBanner(null)
          try {
            await setHotspots.mutateAsync({ sectionId, blockId: block.id, hotspots })
            setPinsOpen(false)
          } catch (caught) {
            onBanner(errorText(caught))
          }
        }}
      />
    </Card>
  )
}

export function SectionEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const sectionId = Number(id)
  const { data, isLoading, error } = useSection(sectionId)
  const updateSection = useUpdateSection()
  const addBlock = useAddBlock()
  const reorder = useReorderBlocks()

  const [banner, setBanner] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [heading, setHeading] = useState('')
  const [standfirst, setStandfirst] = useState('')
  const [footnote, setFootnote] = useState('')
  const [newBlockKind, setNewBlockKind] = useState<string>('feature')

  const section = data?.section

  useEffect(() => {
    if (!section) return
    setName(section.name)
    setHeading(section.heading ?? '')
    setStandfirst(section.standfirst ?? '')
    setFootnote(section.footnote ?? '')
  }, [section])

  const saveSection = async (input: Parameters<typeof updateSection.mutateAsync>[0]['input']) => {
    setBanner(null)
    try {
      await updateSection.mutateAsync({ id: sectionId, input })
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  const move = async (from: number, to: number) => {
    if (!section) return
    const ids = section.blocks.map((block) => block.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    setBanner(null)
    try {
      await reorder.mutateAsync({ sectionId, ids })
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'grid', placeItems: 'center', py: 10 }}>
        <CircularProgress size={24} />
      </Box>
    )
  }

  if (error || !section) {
    return <Alert severity="error">{errorText(error)}</Alert>
  }

  return (
    <Box>
      <PageHeader
        title={section.name}
        subtitle={
          section.usage_count > 0
            ? `On ${section.usage_count} ${section.usage_count === 1 ? 'product' : 'products'} — editing this changes all of them.`
            : 'Not on any product yet.'
        }
        back={
          <Button
            size="small"
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/content/sections')}
            sx={{ mb: 1 }}
          >
            Story sections
          </Button>
        }
      />

      {banner && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBanner(null)}>
          {banner}
        </Alert>
      )}

      {section.usage_count > 1 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This section is shared. Anything changed here changes it on all{' '}
          {section.usage_count} products at once — which is the point of sharing it, and worth
          knowing before rewriting the heading.
        </Alert>
      )}

      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                size="small"
                label="Name"
                placeholder="Pocket Pearl packaging"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={() => name !== section.name && saveSection({ name })}
                helperText="What you will recognise it by in the library"
              />
              <TextField
                select
                size="small"
                label="Kind"
                value={section.section_key}
                onChange={(event) => saveSection({ section_key: event.target.value })}
                sx={{ minWidth: 200 }}
              >
                {SECTION_KINDS.map((kind) => (
                  <MenuItem key={kind.key} value={kind.key}>
                    {kind.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                size="small"
                label="Layout"
                value={section.layout}
                onChange={(event) => saveSection({ layout: event.target.value as 'split' })}
                sx={{ minWidth: 160 }}
              >
                {['split', 'stacked', 'carousel', 'grid'].map((layout) => (
                  <MenuItem key={layout} value={layout}>
                    {layout}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <TextField
              fullWidth
              size="small"
              label="Heading"
              placeholder="less harm, more pearl."
              value={heading}
              onChange={(event) => setHeading(event.target.value)}
              onBlur={() => heading !== (section.heading ?? '') && saveSection({ heading: heading || null })}
            />
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              label="Standfirst"
              placeholder="Pocket Pearl packaging is made with post-consumer recycled materials."
              value={standfirst}
              onChange={(event) => setStandfirst(event.target.value)}
              onBlur={() =>
                standfirst !== (section.standfirst ?? '') && saveSection({ standfirst: standfirst || null })
              }
            />
            <TextField
              fullWidth
              size="small"
              label="Footnote"
              placeholder="*Based on a 32-subject consumer perception study after 2 weeks of use."
              value={footnote}
              onChange={(event) => setFootnote(event.target.value)}
              onBlur={() =>
                footnote !== (section.footnote ?? '') && saveSection({ footnote: footnote || null })
              }
            />
          </Stack>
        </CardContent>
      </Card>

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
        Blocks
      </Typography>

      {section.blocks.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Nothing in this section yet. Add a block below.
        </Alert>
      )}

      {section.blocks.map((block, index) => (
        <BlockCard
          key={block.id}
          sectionId={sectionId}
          block={block}
          index={index}
          total={section.blocks.length}
          onBanner={setBanner}
          onMove={move}
        />
      ))}

      <Card variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-end' }}>
          <TextField
            select
            size="small"
            label="Block kind"
            value={newBlockKind}
            onChange={(event) => setNewBlockKind(event.target.value)}
            sx={{ minWidth: 220 }}
          >
            {BLOCK_KINDS.map((kind) => (
              <MenuItem key={kind.key} value={kind.key}>
                {kind.label} — {kind.hint}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={async () => {
              setBanner(null)
              try {
                await addBlock.mutateAsync({ sectionId, input: { block_type: newBlockKind } })
              } catch (caught) {
                setBanner(errorText(caught))
              }
            }}
          >
            Add block
          </Button>
        </Stack>
      </Card>
    </Box>
  )
}
