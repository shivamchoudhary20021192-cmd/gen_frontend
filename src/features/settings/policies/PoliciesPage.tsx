import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import HistoryIcon from '@mui/icons-material/History'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
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
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'
import { formatDate, formatRelative } from '../../../lib/format'
import { RichTextEditor } from '../../content/pages/RichTextEditor'
import { privacyKeys } from '../../privacy/privacyTypes'

type Kind = 'refund' | 'privacy' | 'terms' | 'shipping' | 'contact' | 'legal_notice'

interface PolicyEntry {
  kind: Kind
  handle: string
  default_title: string
  title: string
  body: string
  version: number
  url: string
  updated_at: string | null
}

interface Version {
  version: number
  title: string
  body: string
  created_at: string
}

const ABOUT: Record<Kind, string> = {
  refund: 'Returns, exchanges and refunds. The Consumer Protection (E-Commerce) Rules require it to be displayed.',
  privacy: 'What personal data the store collects, why, who it is shared with, and how shoppers exercise their rights. The cookie banner links to it; changing it can ask visitors for consent again.',
  terms: 'The terms shoppers agree to when they use the store and buy from it.',
  shipping: 'Processing times, delivery charges and estimates, cash on delivery, international orders.',
  contact: 'Who runs the store and how to reach them — including the grievance officer the E-Commerce Rules ask for.',
  legal_notice: 'The operator’s legal details, for stores that sell into the EU (an “Impressum”).',
}

const isEmpty = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''

/**
 * Settings → Policies, as on Shopify: the store's legal pages, served at
 * /policies/<handle>, linked from the footer and the checkout, and available
 * to themes as shop.privacy_policy and the rest. Every save is a new version
 * and the old text is kept — a consent can be traced to what the privacy
 * policy said when it was given.
 */
export function PoliciesPage() {
  const { flash, success, clear } = useFlash()
  const list = useQuery({ queryKey: privacyKeys.policies, queryFn: () => api.get<{ policies: PolicyEntry[]; storefront_url: string }>('/privacy/policies') })
  const [kind, setKind] = useState<Kind>('privacy')

  if (list.isLoading) return <Box sx={{ p: 6, textAlign: 'center' }}><CircularProgress /></Box>
  if (list.isError) return <Alert severity="error">{errorMessage(list.error)}</Alert>
  const policies = list.data?.policies ?? []
  const current = policies.find((policy) => policy.kind === kind)

  return (
    <Box>
      <PageHeader title="Policies" subtitle="Your store’s legal pages: linked from the footer, the cookie banner and checkout" />
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px 1fr' }, gap: 2, alignItems: 'start' }}>
        <Card variant="outlined">
          <List disablePadding>
            {policies.map((policy) => (
              <ListItemButton key={policy.kind} selected={policy.kind === kind} onClick={() => setKind(policy.kind)} data-policy={policy.kind}>
                <ListItemText
                  primary={policy.title}
                  secondary={policy.body ? `Version ${policy.version} · ${formatRelative(policy.updated_at)}` : 'Not written yet'}
                />
                {policy.kind === 'privacy' && !policy.body && <Chip size="small" color="warning" label="Needed" />}
              </ListItemButton>
            ))}
          </List>
        </Card>
        {current && <PolicyEditor key={`${current.kind}:${current.version}`} policy={current} storefront={list.data!.storefront_url} onSaved={success} />}
      </Box>
      <FlashSnackbar flash={flash} onClose={clear} />
    </Box>
  )
}

/** One policy being edited; remounted when another is chosen or a save makes a new version. */
function PolicyEditor({ policy: current, storefront, onSaved }: { policy: PolicyEntry; storefront: string; onSaved(message: string): void }) {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('privacy.settings')
  const kind = current.kind
  const [title, setTitle] = useState(current.title)
  const [body, setBody] = useState(current.body)
  // What "unchanged" means: the editor rewrites HTML as it loads it (a list
  // item gains a <p>), so its first output — before anyone touches it — is
  // the saved text in its own words, not an edit.
  const [baseline, setBaseline] = useState(current.body)
  const touched = useRef(false)
  const edited = (html: string) => {
    if (!touched.current) setBaseline(html)
    setBody(html)
  }
  const [mode, setMode] = useState<'visual' | 'html'>('visual')
  const [editorKey, setEditorKey] = useState(0)
  const [confirmTemplate, setConfirmTemplate] = useState(false)
  const [history, setHistory] = useState(false)
  const [viewing, setViewing] = useState<Version | null>(null)

  const versions = useQuery({
    queryKey: ['privacy', 'policy-versions', kind],
    queryFn: () => api.get<{ versions: Version[] }>(`/privacy/policies/${kind}/versions`),
    enabled: history,
  })

  const save = useMutation({
    mutationFn: () => api.put<{ policy: PolicyEntry }>(`/privacy/policies/${kind}`, { title: title.trim() || null, body: isEmpty(body) ? '' : body }),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: privacyKeys.policies })
      void queryClient.invalidateQueries({ queryKey: privacyKeys.overview })
      onSaved(response.policy.body ? `${response.policy.title} saved — version ${response.policy.version}` : `${response.policy.title} removed from the store`)
    },
  })
  const template = useMutation({
    mutationFn: () => api.post<{ draft: { title: string; body: string } }>(`/privacy/policies/${kind}/template`),
    onSuccess: (response) => {
      setConfirmTemplate(false)
      touched.current = true
      setTitle(response.draft.title)
      setBody(response.draft.body)
      setEditorKey((key) => key + 1)
      onSaved('Draft filled in from your store details — read it, fill in the [bracketed] parts, then save')
    },
  })

  const dirty = title !== current.title || body !== baseline

  return (
    <>
          <Card variant="outlined" sx={{ p: 2.5 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
                <Box>
                  <Typography variant="h6">{current.default_title}</Typography>
                  <Typography variant="body2" color="text.secondary">{ABOUT[kind]}</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                  {current.body && (
                    <Button size="small" startIcon={<OpenInNewIcon />} href={`${storefront}${current.url}`} target="_blank" rel="noreferrer">View</Button>
                  )}
                  {current.version > 0 && <Button size="small" startIcon={<HistoryIcon />} onClick={() => setHistory(true)}>History</Button>}
                </Stack>
              </Stack>

              {canManage && (
                <Alert
                  severity="info"
                  icon={<AutoFixHighIcon />}
                  action={
                    <Button color="inherit" size="small" disabled={template.isPending} onClick={() => (isEmpty(body) ? template.mutate() : setConfirmTemplate(true))} data-policy-template>
                      Create from template
                    </Button>
                  }
                >
                  Start from a draft written for Indian law (the DPDP Act, the E-Commerce Rules) and GDPR and US state law, filled in from your store details. It is a starting point, not legal advice — have it checked.
                </Alert>
              )}

              <TextField label="Title" value={title} disabled={!canManage} onChange={(event) => setTitle(event.target.value)} slotProps={{ htmlInput: { maxLength: 191 } }} />

              <Box>
                <Tabs value={mode} onChange={(_event, next) => { setMode(next); setEditorKey((key) => key + 1) }} sx={{ minHeight: 36, mb: 1 }}>
                  <Tab value="visual" label="Visual" sx={{ minHeight: 36 }} />
                  <Tab value="html" label="HTML" sx={{ minHeight: 36 }} />
                </Tabs>
                {mode === 'visual' ? (
                  <Box
                    onKeyDownCapture={() => (touched.current = true)}
                    onMouseDownCapture={() => (touched.current = true)}
                    onPasteCapture={() => (touched.current = true)}
                  >
                    <RichTextEditor key={`${kind}-${editorKey}`} content={body} onChange={edited} disabled={!canManage} placeholder="Write the policy, or create it from the template" />
                  </Box>
                ) : (
                  <TextField
                    fullWidth
                    multiline
                    minRows={16}
                    value={body}
                    disabled={!canManage}
                    onChange={(event) => { touched.current = true; setBody(event.target.value) }}
                    slotProps={{ htmlInput: { spellCheck: false, style: { fontFamily: 'monospace', fontSize: 13 } } }}
                    helperText="Scripts, frames and forms are removed when you save."
                  />
                )}
              </Box>

              {save.isError && <Alert severity="error">{errorMessage(save.error)}</Alert>}
              {canManage && (
                <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
                  <Button disabled={!dirty || save.isPending} onClick={() => { touched.current = false; setTitle(current.title); setBody(current.body); setBaseline(current.body); setEditorKey((key) => key + 1) }}>Discard</Button>
                  <Button variant="contained" disabled={!dirty || save.isPending} onClick={() => save.mutate()} data-policy-save>
                    {save.isPending ? 'Saving…' : 'Save'}
                  </Button>
                </Stack>
              )}
            </Stack>
          </Card>

      <ConfirmDialog
        open={confirmTemplate}
        title="Replace with the template?"
        body="The text in the editor is replaced by the template. Nothing is saved until you press Save, and earlier saved versions stay in the history."
        confirmLabel="Replace"
        busy={template.isPending}
        onConfirm={() => template.mutate()}
        onClose={() => setConfirmTemplate(false)}
      />

      <Dialog open={history} onClose={() => { setHistory(false); setViewing(null) }} fullWidth maxWidth="md">
        <DialogTitle>{current?.default_title} — history</DialogTitle>
        <DialogContent dividers>
          {versions.isLoading && <CircularProgress size={24} />}
          {viewing ? (
            <Box>
              <Typography variant="subtitle2" gutterBottom>Version {viewing.version} · {formatDate(viewing.created_at)}</Typography>
              <Box sx={{ '& h2': { fontSize: '1.1rem' }, '& table': { borderCollapse: 'collapse' }, '& td, & th': { border: 1, borderColor: 'divider', p: 0.75 } }} dangerouslySetInnerHTML={{ __html: viewing.body }} />
            </Box>
          ) : (
            <List dense>
              {(versions.data?.versions ?? []).map((entry) => (
                <ListItemButton key={entry.version} onClick={() => setViewing(entry)}>
                  <ListItemText primary={`Version ${entry.version}${entry.version === current?.version ? ' (current)' : ''}`} secondary={`${formatDate(entry.created_at)} · ${entry.body ? `${entry.body.replace(/<[^>]*>/g, ' ').trim().slice(0, 90)}…` : 'Removed'}`} />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          {viewing && <Button onClick={() => setViewing(null)}>Back to versions</Button>}
          {viewing && canManage && (
            <Button onClick={() => { touched.current = true; setTitle(viewing.title); setBody(viewing.body); setEditorKey((key) => key + 1); setHistory(false); setViewing(null) }}>Restore into editor</Button>
          )}
          <Button onClick={() => { setHistory(false); setViewing(null) }}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
