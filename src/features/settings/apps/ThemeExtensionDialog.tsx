import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { api, tokenStore } from '../../../api/client'
import { errorMessage } from '../../../lib/errors'

interface ExtensionBlock {
  handle: string
  name: string
  target: 'section' | 'head' | 'body'
}

interface Extension {
  version: number
  updated_at?: string
  unchanged?: boolean
  blocks: ExtensionBlock[]
}

const API_BASE = `${(import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')}/admin/api/v1`

const TARGETS: Record<ExtensionBlock['target'], string> = {
  section: 'App block',
  head: 'App embed · head',
  body: 'App embed · body',
}

/**
 * A custom app's theme extension: the Liquid blocks it puts on the
 * storefront. Deploying uploads a zip of blocks/, snippets/, locales/ and assets/; merchants then
 * add the blocks in the theme editor (app blocks) or switch them on under
 * Theme settings → App embeds.
 */
export function ThemeExtensionDialog({ app, onClose, onDeployed }: { app: { id: string; name: string } | null; onClose(): void; onDeployed(message: string): void }) {
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement | null>(null)
  const key = ['apps', 'custom', app?.id, 'theme-extension'] as const

  const extension = useQuery({
    queryKey: key,
    queryFn: () => api.get<{ extension: Extension | null }>(`/apps/custom/${app!.id}/theme-extension`),
    enabled: Boolean(app),
  })

  const deploy = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData()
      form.append('file', file)
      const token = tokenStore.access
      const response = await fetch(`${API_BASE}/apps/custom/${app!.id}/theme-extension`, { method: 'PUT', body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        const details = body?.error?.details?.files as string[] | undefined
        throw new Error(details?.length ? details.join('\n') : (body?.error?.message ?? `Upload failed (${response.status})`))
      }
      return body as { extension: Extension }
    },
    onSuccess: (result) => {
      queryClient.setQueryData(key, { extension: result.extension })
      onDeployed(result.extension.unchanged ? 'Nothing changed: that extension is already deployed' : `Version ${result.extension.version} deployed`)
    },
  })

  const current = extension.data?.extension ?? null

  return (
    <Dialog open={Boolean(app)} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Theme extension · {app?.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Blocks your app adds to the storefront without editing the theme. Merchants place app blocks in the theme editor and switch app embeds on under
          Theme settings → App embeds. Uninstalling the app removes them from every page.
        </Typography>

        {(extension.isLoading || deploy.isPending) && <LinearProgress sx={{ mb: 2 }} />}
        {deploy.isError && (
          <Alert severity="error" sx={{ mb: 2, whiteSpace: 'pre-line' }}>
            {errorMessage(deploy.error)}
          </Alert>
        )}

        {current ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Deployed · version {current.version}</Typography>
            <List dense disablePadding>
              {current.blocks.map((block) => (
                <ListItem key={block.handle} disableGutters secondaryAction={<Chip size="small" label={TARGETS[block.target]} variant="outlined" />}>
                  <ListItemText primary={block.name} secondary={`blocks/${block.handle}.liquid`} />
                </ListItem>
              ))}
            </List>
          </Box>
        ) : (
          !extension.isLoading && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Nothing deployed yet.
            </Alert>
          )
        )}

        <Typography variant="subtitle2" gutterBottom>
          What to upload
        </Typography>
        <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: 'action.hover', borderRadius: 1, fontSize: 12, overflow: 'auto' }}>
          {`extension.zip
├─ blocks/
│  ├─ trust-badges.liquid   {% schema %} { "name", "target": "section", "settings", "stylesheet" }
│  └─ chat-button.liquid    {% schema %} { "name", "target": "body", "settings" }
├─ snippets/
│  └─ badge.liquid          {% render 'badge' %} from your blocks
├─ locales/
│  ├─ en.default.json       {{ 'badges.title' | t }} in your blocks
│  └─ fr.json
└─ assets/
   └─ trust-badges.css      CSS, JS, SVG or JSON`}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          Inside a block, <code>block.settings</code> holds the merchant’s choices and <code>app</code> is your app. A stylesheet or javascript named in the
          schema loads with the block. <code>render</code> finds your snippets (never the theme’s), <code>t</code> your locales in the shopper’s language, and{' '}
          <code>asset_url</code> your assets.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <input
          ref={input}
          type="file"
          accept=".zip,application/zip"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) deploy.mutate(file)
          }}
        />
        <Button variant="contained" startIcon={<CloudUploadOutlinedIcon />} disabled={deploy.isPending} onClick={() => input.current?.click()}>
          {current ? 'Deploy new version' : 'Deploy extension'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
