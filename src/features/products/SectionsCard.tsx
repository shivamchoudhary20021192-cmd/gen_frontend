import AddIcon from '@mui/icons-material/Add'
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward'
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { tokens } from '../../theme'
import {
  SECTION_KINDS,
  useAttachSection,
  useCreateSection,
  useDetachSection,
  useProductSections,
  useReorderSections,
  useSectionLibrary,
  useUpdateAssignment,
} from '../content/sections/useSections'

/**
 * The story sections on one product.
 *
 * Sections are written in the library at /content/sections and attached here,
 * so this card deliberately does not edit their contents: a heading typed here
 * would change every other product the section sits on, which is exactly the
 * surprise the library exists to avoid. The link out makes that trip explicit.
 *
 * Each action saves straight away rather than waiting for the form's Save.
 * An assignment is a row of its own, not a column on the product, and holding
 * it until the next Save would lose it if the person navigated away.
 */

function kindLabel(key: string): string {
  return SECTION_KINDS.find((kind) => kind.key === key)?.label ?? key
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) return error.message
  return 'Something went wrong. Please try again.'
}

export function SectionsCard({ productId }: { productId: number | undefined }) {
  const attached = useProductSections(productId)
  const library = useSectionLibrary()
  const attach = useAttachSection()
  const detach = useDetachSection()
  const setEnabled = useUpdateAssignment()
  const reorder = useReorderSections()

  const create = useCreateSection()
  const navigate = useNavigate()

  const [pick, setPick] = useState('')
  const [banner, setBanner] = useState<string | null>(null)

  const rows = attached.data?.sections ?? []
  /** Nothing has ever been written, as opposed to "all of it is already on". */
  const libraryEmpty = !library.isLoading && (library.data?.sections?.length ?? 0) === 0

  // Only what is not already on this product: attaching the same section twice
  // would render the same words twice down the page.
  const available = useMemo(() => {
    const taken = new Set(rows.map((row) => row.id))
    return (library.data?.sections ?? []).filter((section) => !taken.has(section.id))
  }, [library.data, rows])

  if (!productId) {
    return (
      <Card>
        <CardHeader
          title="Story sections"
          subheader="The claims strip, the packaging diagram, a model's routine."
          slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
        />
        <CardContent sx={{ pt: 0 }}>
          <Typography variant="body2" sx={{ color: tokens.subdued }}>
            Save the product first. Sections attach to a product that exists.
          </Typography>
        </CardContent>
      </Card>
    )
  }

  const run = async (work: Promise<unknown>) => {
    setBanner(null)
    try {
      await work
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length) return
    const ids = rows.map((row) => row.assignment_id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    void run(reorder.mutateAsync({ productId, ids }))
  }

  return (
    <Card>
      <CardHeader
        title="Story sections"
        subheader="Written in the library, attached here. They show below the description, in this order."
        slotProps={{ title: { variant: 'subtitle1' }, subheader: { variant: 'caption' } }}
        action={
          <Button
            size="small"
            endIcon={<OpenInNewIcon fontSize="small" />}
            href="/content/sections"
            target="_blank"
            rel="noopener noreferrer"
          >
            Library
          </Button>
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {banner && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBanner(null)}>
            {banner}
          </Alert>
        )}

        <Stack spacing={1.5} sx={{ mb: 2 }}>
          {rows.length === 0 && !attached.isLoading && !libraryEmpty && (
            // Only when there is something to pick. With an empty library the
            // block below says so properly, and "pick one below" would be
            // pointing at a control that has nothing in it.
            <Typography variant="body2" sx={{ color: tokens.subdued }}>
              Nothing attached yet. Pick one below, or write a new one in the library.
            </Typography>
          )}

          {rows.map((row, index) => (
            <Box
              key={row.assignment_id}
              data-assignment-id={row.assignment_id}
              sx={{
                border: `1px solid ${tokens.border}`,
                borderRadius: 1.5,
                p: 1.5,
                opacity: row.is_enabled ? 1 : 0.6,
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Stack sx={{ mr: 0.5 }}>
                  <IconButton
                    size="small"
                    aria-label={`Move ${row.name} up`}
                    disabled={index === 0 || reorder.isPending}
                    onClick={() => move(index, index - 1)}
                    sx={{ p: 0.25 }}
                  >
                    <ArrowUpwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    aria-label={`Move ${row.name} down`}
                    disabled={index === rows.length - 1 || reorder.isPending}
                    onClick={() => move(index, index + 1)}
                    sx={{ p: 0.25 }}
                  >
                    <ArrowDownwardIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Stack>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {row.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={kindLabel(row.section_key)}
                      sx={{ bgcolor: tokens.sand, height: 20 }}
                    />
                    {row.usage_count > 1 && (
                      // The warning that makes sharing safe: editing this changes
                      // other products too.
                      <Tooltip title={`Also on ${row.usage_count - 1} other product${row.usage_count === 2 ? '' : 's'}`}>
                        <Chip size="small" variant="outlined" label="Shared" sx={{ height: 20 }} />
                      </Tooltip>
                    )}
                  </Stack>
                  <Typography variant="caption" sx={{ color: tokens.subdued }}>
                    {row.heading ?? '—'} · {row.blocks.length} block
                    {row.blocks.length === 1 ? '' : 's'}
                  </Typography>
                </Box>

                <Tooltip title={row.is_enabled ? 'Showing on the site' : 'Hidden on the site'}>
                  {/* `slotProps.input`, not `inputProps`: this MUI passes the
                      latter straight through to the DOM as an attribute. */}
                  <Switch
                    size="small"
                    checked={row.is_enabled}
                    slotProps={{ input: { 'aria-label': `Show ${row.name}` } }}
                    onChange={(event) =>
                      void run(
                        setEnabled.mutateAsync({
                          productId,
                          assignmentId: row.assignment_id,
                          input: { is_enabled: event.target.checked },
                        }),
                      )
                    }
                  />
                </Tooltip>

                <IconButton
                  size="small"
                  aria-label={`Edit ${row.name}`}
                  href={`/content/sections/${row.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>

                <Tooltip title="Take it off this product. The section itself stays in the library.">
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Detach ${row.name}`}
                    disabled={detach.isPending}
                    onClick={() =>
                      void run(detach.mutateAsync({ productId, assignmentId: row.assignment_id }))
                    }
                  >
                    <LinkOffIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          ))}
        </Stack>

        {/* Nothing written yet.
            An empty dropdown with no explanation is a dead end: it reads as a
            broken control rather than as an empty library, and there is nothing
            on screen to say what to do about it. So when the library is empty
            the picker is replaced by the one action that helps. */}
        {libraryEmpty ? (
          <Box>
            <Typography variant="body2" sx={{ color: tokens.subdued, mb: 1.5 }}>
              No sections have been written yet. A section is a band of the product page —
              the claims strip, the packaging diagram, a model&rsquo;s routine — written once and
              attached to as many products as it belongs on.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              disabled={create.isPending}
              onClick={async () => {
                setBanner(null)
                try {
                  const made = await create.mutateAsync({
                    section_key: 'model_routine',
                    name: 'Untitled section',
                  })
                  navigate(`/content/sections/${made.section.id}`)
                } catch (caught) {
                  setBanner(errorText(caught))
                }
              }}
            >
              Write the first one
            </Button>
          </Box>
        ) : (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{ alignItems: { sm: 'flex-end' } }}
        >
          {/* `displayEmpty` with a `renderValue`, not `placeholder`.
              A select ignores the placeholder attribute, so with nothing chosen
              this rendered as an empty box — no text, no hint that it holds
              anything. It looks like a dead control, so it never gets opened,
              nothing is ever attached, and the product page stays without its
              story. The unchosen state has to say what to do. */}
          <TextField
            select
            size="small"
            label="Attach a section"
            value={pick}
            onChange={(event) => setPick(event.target.value)}
            sx={{ minWidth: 300 }}
            slotProps={{
              select: {
                displayEmpty: true,
                renderValue: (value: unknown) => {
                  const chosen = available.find((section) => String(section.id) === String(value))
                  if (chosen) return `${chosen.name} — ${kindLabel(chosen.section_key)}`
                  return (
                    <Typography component="span" variant="body2" sx={{ color: tokens.subdued }}>
                      Choose a section
                    </Typography>
                  )
                },
              },
            }}
          >
            {available.length === 0 && (
              <MenuItem value="" disabled>
                Nothing left to attach
              </MenuItem>
            )}
            {available.map((section) => (
              <MenuItem key={section.id} value={String(section.id)}>
                {section.name} — {kindLabel(section.section_key)}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            disabled={!pick || attach.isPending}
            onClick={async () => {
              await run(attach.mutateAsync({ productId, sectionId: Number(pick) }))
              setPick('')
            }}
          >
            Attach
          </Button>
        </Stack>
        )}

        {available.length === 0 && (library.data?.sections?.length ?? 0) > 0 && (
          <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mt: 1 }}>
            Everything in the library is already on this product.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
