import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  InputAdornment,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SearchIcon from '@mui/icons-material/Search'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink, useParams } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'
import { RichTextEditor } from '../../content/pages/RichTextEditor'
import type { ResourceKind, TranslatableResource, TranslationField, TranslationsResponse } from './languageTypes'

const KINDS: { kind: ResourceKind; label: string }[] = [
  { kind: 'product', label: 'Products' },
  { kind: 'collection', label: 'Collections' },
  { kind: 'page', label: 'Pages' },
  { kind: 'article', label: 'Blog posts' },
  { kind: 'link', label: 'Navigation' },
  { kind: 'theme', label: 'Theme content' },
]

/**
 * Settings → Languages → Translate: every translatable resource of a kind,
 * and, for the one picked, its original text beside the translation.
 * Empty translations fall back to the original on the storefront.
 */
export function TranslatePage() {
  const { locale = '' } = useParams()
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('settings.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const [kind, setKind] = useState<ResourceKind>('product')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  // Bumped to remount the rich text editors when a draft is thrown away.
  const [generation, setGeneration] = useState(0)

  const listKey = ['online-store', 'translations', locale, kind, search, page] as const
  const list = useQuery({
    queryKey: listKey,
    queryFn: () => api.get<TranslationsResponse>(`/online-store/translations/${locale}/${kind}`, { q: search || undefined, page, limit: 20 }),
    placeholderData: keepPreviousData,
  })
  const resources = list.data?.resources ?? []
  const selected: TranslatableResource | null = resources.find((resource) => resource.key === selectedKey) ?? resources[0] ?? null
  const dirty = Object.keys(drafts).length > 0

  const save = useMutation({
    mutationFn: (resource: TranslatableResource) => api.put<{ saved: number }>(`/online-store/translations/${locale}/${kind}/${resource.id}`, { fields: drafts }),
    onSuccess: () => {
      setDrafts({})
      success('Translation saved')
      void queryClient.invalidateQueries({ queryKey: ['online-store', 'translations', locale, kind] })
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const choose = (next: { kind?: ResourceKind; key?: string | null; page?: number; search?: string }) => {
    if (dirty && !window.confirm('Discard the translation you have not saved?')) return
    setDrafts({})
    if (next.kind !== undefined) {
      setKind(next.kind)
      setPage(1)
      setSearch('')
      setSelectedKey(null)
    }
    if (next.page !== undefined) {
      setPage(next.page)
      setSelectedKey(null)
    }
    if (next.search !== undefined) {
      setSearch(next.search)
      setPage(1)
      setSelectedKey(null)
    }
    if (next.key !== undefined) setSelectedKey(next.key)
  }

  const language = list.data?.language
  const valueOf = (field: TranslationField) => drafts[field.key] ?? field.translation

  return (
    <>
      <PageHeader
        title={language ? `Translate into ${language.name}` : 'Translate'}
        subtitle={language && !language.published ? 'This language is unpublished: shoppers cannot see it yet.' : 'Changes show on your store as soon as you save.'}
        back={
          <Button size="small" startIcon={<ArrowBackIcon />} component={RouterLink} to="/settings/languages" sx={{ mb: 1 }}>
            Languages
          </Button>
        }
        actions={
          language && (
            <Button variant="outlined" href={language.preview_url} target="_blank" rel="noopener">
              Preview
            </Button>
          )
        }
      />

      {list.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(list.error)}</Alert>}

      <Card sx={{ mb: 2 }}>
        <Tabs value={kind} onChange={(_event, value: ResourceKind) => choose({ kind: value })} variant="scrollable" allowScrollButtonsMobile>
          {KINDS.map((entry) => (
            <Tab key={entry.kind} value={entry.kind} label={entry.label} />
          ))}
        </Tabs>
      </Card>

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '320px minmax(0, 1fr)' }, alignItems: 'start' }}>
        <Card>
          <Box sx={{ p: 1.5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder={`Search ${KINDS.find((entry) => entry.kind === kind)?.label.toLowerCase()}`}
              defaultValue={search}
              key={`${kind}-search`}
              onKeyDown={(event) => {
                if (event.key === 'Enter') choose({ search: (event.target as HTMLInputElement).value.trim() })
              }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
            />
          </Box>
          {list.isFetching && <LinearProgress sx={{ height: 2 }} />}
          <List dense disablePadding sx={{ maxHeight: { md: 'calc(100vh - 330px)' }, overflow: 'auto' }}>
            {resources.map((resource) => {
              const total = resource.fields.length
              const done = resource.translated
              return (
                <ListItemButton key={resource.key} selected={selected?.key === resource.key} onClick={() => choose({ key: resource.key })}>
                  <ListItemText
                    primary={resource.title || '(untitled)'}
                    secondary={resource.subtitle}
                    slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                  />
                  <Chip size="small" label={`${done}/${total}`} color={total > 0 && done === total ? 'success' : done > 0 ? 'info' : 'default'} variant={done === 0 ? 'outlined' : 'filled'} sx={{ ml: 1 }} />
                </ListItemButton>
              )
            })}
            {!list.isLoading && resources.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                Nothing to translate here{search ? ` matching “${search}”` : ''}.
              </Typography>
            )}
          </List>
          {(list.data?.pagination.pages ?? 1) > 1 && (
            <Stack sx={{ alignItems: 'center', py: 1 }}>
              <Pagination size="small" count={list.data!.pagination.pages} page={page} onChange={(_event, value) => choose({ page: value })} />
            </Stack>
          )}
        </Card>

        <Card sx={{ p: 2.5 }}>
          {list.isLoading && (
            <Stack sx={{ alignItems: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Stack>
          )}
          {selected && (
            <>
              <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="h6" noWrap>
                    {selected.title || '(untitled)'}
                  </Typography>
                  {selected.subtitle && (
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {selected.subtitle}
                    </Typography>
                  )}
                </Box>
                {canManage && (
                  <Stack direction="row" spacing={1}>
                    <Button
                      disabled={!dirty || save.isPending}
                      onClick={() => {
                        setDrafts({})
                        setGeneration((value) => value + 1)
                      }}
                    >
                      Discard
                    </Button>
                    <Button variant="contained" disabled={!dirty || save.isPending} onClick={() => save.mutate(selected)}>
                      Save
                    </Button>
                  </Stack>
                )}
              </Stack>

              <Stack spacing={3}>
                {selected.fields.map((field) => (
                  <Box key={field.key}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2">{field.label}</Typography>
                      {field.outdated && drafts[field.key] === undefined && <Chip size="small" color="warning" label="Original changed since" />}
                    </Stack>
                    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Original
                        </Typography>
                        <Box
                          sx={{
                            mt: 0.5,
                            p: 1.25,
                            borderRadius: 1,
                            bgcolor: 'action.hover',
                            fontSize: 14,
                            maxHeight: 260,
                            overflow: 'auto',
                            whiteSpace: field.format === 'html' ? 'normal' : 'pre-wrap',
                            '& p': { my: 0.5 },
                          }}
                          {...(field.format === 'html' ? { dangerouslySetInnerHTML: { __html: field.original } } : { children: field.original })}
                        />
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          {language?.name ?? 'Translation'}
                        </Typography>
                        <Box sx={{ mt: 0.5 }} lang={language?.code}>
                          {field.format === 'html' ? (
                            <RichTextEditor
                              key={`${selected.key}-${field.key}-${generation}`}
                              content={valueOf(field)}
                              disabled={!canManage}
                              placeholder="Leave empty to show the original"
                              onChange={(html) => setDrafts((current) => ({ ...current, [field.key]: html === '<p></p>' ? '' : html }))}
                            />
                          ) : (
                            <TextField
                              fullWidth
                              size="small"
                              multiline={field.format === 'multiline'}
                              minRows={field.format === 'multiline' ? 3 : undefined}
                              value={valueOf(field)}
                              disabled={!canManage}
                              placeholder="Leave empty to show the original"
                              onChange={(event) => setDrafts((current) => ({ ...current, [field.key]: event.target.value }))}
                            />
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                ))}
                {selected.fields.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    This has no text to translate yet.
                  </Typography>
                )}
              </Stack>
            </>
          )}
        </Card>
      </Box>

      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}
