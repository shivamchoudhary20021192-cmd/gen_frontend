import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import CloseIcon from '@mui/icons-material/Close'
import {
  Alert,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import { ApiError } from '../../../api/client'
import { MediaPicker } from '../../media/MediaPicker'
import { tokens } from '../../../theme'
import { useCreateCreator, useUpdateCreator, type Creator, type CreatorInput } from './useCreators'
import type { Media } from '../../../api/types'

/**
 * Add or edit one person.
 *
 * A dialog rather than a page: a creator is a name, a face and three links, and
 * sending someone to a separate screen to type five fields is a navigation they
 * did not need.
 */

interface FormState {
  name: string
  handle: string
  role: string
  bio: string
  instagram_url: string
  youtube_url: string
  tiktok_url: string
  website_url: string
  is_active: boolean
  is_identity_public: boolean
}

const EMPTY: FormState = {
  name: '',
  handle: '',
  role: '',
  bio: '',
  instagram_url: '',
  youtube_url: '',
  tiktok_url: '',
  website_url: '',
  is_active: true,
  is_identity_public: true,
}

function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    // The API names the field it objected to, and "instagram_url: give the
    // whole address" is a far better message than "the request is invalid".
    const details = (error.details ?? {}) as Record<string, string[]>
    const first = Object.entries(details)[0]
    if (first) return `${first[0].replace(/_/g, ' ')}: ${first[1][0]}`
    return error.message
  }
  return 'Something went wrong. Please try again.'
}

export function CreatorFormDialog({
  open,
  creator,
  onClose,
}: {
  open: boolean
  /** Null when adding someone new. */
  creator: Creator | null
  onClose: () => void
}) {
  const create = useCreateCreator()
  const update = useUpdateCreator()

  const [form, setForm] = useState<FormState>(EMPTY)
  const [portraitId, setPortraitId] = useState<number | null>(null)
  const [portraitUrl, setPortraitUrl] = useState<string>('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)

  // Seeded per opening rather than per mount: the dialog stays mounted between
  // openings, and carrying the last person's details into a new one is the kind
  // of bug nobody reports but everybody hits.
  useEffect(() => {
    if (!open) return
    setBanner(null)
    if (creator) {
      setForm({
        name: creator.name,
        handle: creator.handle ?? '',
        role: creator.role ?? '',
        bio: creator.bio ?? '',
        instagram_url: creator.instagram_url ?? '',
        youtube_url: creator.youtube_url ?? '',
        tiktok_url: creator.tiktok_url ?? '',
        website_url: creator.website_url ?? '',
        is_active: creator.is_active,
        is_identity_public: creator.is_identity_public,
      })
      setPortraitId(creator.portrait_media_id)
      setPortraitUrl(creator.portrait ?? '')
    } else {
      setForm(EMPTY)
      setPortraitId(null)
      setPortraitUrl('')
    }
  }, [open, creator])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const busy = create.isPending || update.isPending

  const save = async () => {
    setBanner(null)
    if (form.name.trim().length < 2) {
      setBanner('Give the person a name.')
      return
    }

    // Empty strings are sent as null, not as '': an empty Instagram field means
    // "she has no Instagram", and the API would reject '' as a malformed URL.
    const blankToNull = (value: string) => (value.trim() === '' ? null : value.trim())
    const input: CreatorInput = {
      name: form.name.trim(),
      handle: blankToNull(form.handle),
      role: blankToNull(form.role),
      bio: blankToNull(form.bio),
      portrait_media_id: portraitId,
      instagram_url: blankToNull(form.instagram_url),
      youtube_url: blankToNull(form.youtube_url),
      tiktok_url: blankToNull(form.tiktok_url),
      website_url: blankToNull(form.website_url),
      is_active: form.is_active,
      is_identity_public: form.is_identity_public,
    }

    try {
      if (creator) await update.mutateAsync({ id: creator.id, input })
      else await create.mutateAsync(input)
      onClose()
    } catch (caught) {
      setBanner(errorText(caught))
    }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{creator ? creator.name : 'Add a person'}</DialogTitle>
        <DialogContent>
          {banner && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setBanner(null)}>
              {banner}
            </Alert>
          )}

          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Avatar
                src={portraitUrl || undefined}
                sx={{ width: 72, height: 72, bgcolor: tokens.ivory, color: tokens.taupe }}
              >
                {form.name.trim().charAt(0).toUpperCase() || '?'}
              </Avatar>
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddPhotoAlternateIcon />}
                  onClick={() => setPickerOpen(true)}
                >
                  {portraitId ? 'Change portrait' : 'Choose a portrait'}
                </Button>
                {portraitId && (
                  <IconButton
                    size="small"
                    aria-label="Remove portrait"
                    sx={{ ml: 0.5 }}
                    onClick={() => {
                      setPortraitId(null)
                      setPortraitUrl('')
                    }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
                <Typography variant="caption" sx={{ color: tokens.subdued, display: 'block', mt: 0.5 }}>
                  Shown beside her looks on the product page.
                </Typography>
              </Box>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Name"
                placeholder="Ananya Rao"
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
              />
              <TextField
                fullWidth
                label="Handle"
                placeholder="ananyarao"
                value={form.handle}
                onChange={(event) => set('handle', event.target.value)}
                helperText="With or without the @"
              />
            </Stack>

            <TextField
              fullWidth
              label="Role"
              placeholder="Creator"
              value={form.role}
              onChange={(event) => set('role', event.target.value)}
              helperText="Founder, makeup artist, creator — shown under her name"
            />

            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={5}
              label="Bio"
              placeholder="Bangalore-based. Oily skin, sunscreen evangelist."
              value={form.bio}
              onChange={(event) => set('bio', event.target.value)}
            />

            <Typography variant="subtitle2" sx={{ fontWeight: 600, pt: 1 }}>
              Where to follow her
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Instagram"
                placeholder="https://instagram.com/ananyarao"
                value={form.instagram_url}
                onChange={(event) => set('instagram_url', event.target.value)}
              />
              <TextField
                fullWidth
                label="YouTube"
                placeholder="https://youtube.com/@ananyarao"
                value={form.youtube_url}
                onChange={(event) => set('youtube_url', event.target.value)}
              />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="TikTok"
                placeholder="https://tiktok.com/@ananyarao"
                value={form.tiktok_url}
                onChange={(event) => set('tiktok_url', event.target.value)}
              />
              <TextField
                fullWidth
                label="Website"
                placeholder="https://ananyarao.com"
                value={form.website_url}
                onChange={(event) => set('website_url', event.target.value)}
              />
            </Stack>
            <Typography variant="caption" sx={{ color: tokens.subdued }}>
              Whole addresses, starting with https:// — these are links the site sends people to.
            </Typography>

            <FormControlLabel
              control={
                <Switch
                  checked={form.is_active}
                  onChange={(event) => set('is_active', event.target.checked)}
                />
              }
              label="Available to feature"
            />

            {/* The booking, not a display preference. Off means this person is
                never named anywhere on the site, whatever an individual block
                asks for — their name, handle and profile link are taken out of
                the response before the storefront sees it. */}
            <FormControlLabel
              control={
                <Switch
                  checked={form.is_identity_public}
                  onChange={(event) => set('is_identity_public', event.target.checked)}
                />
              }
              label="May be named on the site"
            />
            <Typography variant="caption" sx={{ color: tokens.subdued, mt: -1 }}>
              {form.is_identity_public
                ? 'Their name and links can be shown beside their photographs. Each block still chooses whether to credit them.'
                : 'Their photographs can still be used. Their name, handle and links will not appear anywhere on the site, on any product.'}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={busy}>
            {creator ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(selection: Media[]) => {
          const picked = selection[0]
          if (!picked) return
          setPortraitId(picked.id)
          setPortraitUrl(picked.url)
        }}
        multiple={false}
        maxSelection={1}
        title="Choose a portrait"
        confirmLabel="Use this"
      />
    </>
  )
}
