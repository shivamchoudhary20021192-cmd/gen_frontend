import {
  Alert,
  Autocomplete,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import TranslateOutlinedIcon from '@mui/icons-material/TranslateOutlined'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../../../api/client'
import { useAuth } from '../../../auth/useAuth'
import { ConfirmDialog } from '../../../components/ConfirmDialog'
import { FlashSnackbar } from '../../../components/FlashSnackbar'
import { PageHeader } from '../../../components/PageHeader'
import { SectionCard } from '../../../components/SectionCard'
import { useFlash } from '../../../hooks/useFlash'
import { errorMessage } from '../../../lib/errors'
import { languagesKey, type AvailableLanguage, type Language, type LanguagesResponse } from './languageTypes'

/**
 * Settings → Languages: the languages the online store is offered in.
 *
 * The primary language is the store's own and lives at the root of the
 * domain. Each added language is translated here, previewed, and published
 * when ready — then shoppers reach it at /<code>/ and through the language
 * picker in the theme's header.
 */
export function LanguagesPage() {
  const queryClient = useQueryClient()
  const { can } = useAuth()
  const canManage = can('settings.manage')
  const { flash, success, error: flashError, clear } = useFlash()
  const [adding, setAdding] = useState(false)
  const [choice, setChoice] = useState<AvailableLanguage | null>(null)
  const [menu, setMenu] = useState<{ anchor: HTMLElement; language: Language } | null>(null)
  const [removing, setRemoving] = useState<Language | null>(null)

  const languages = useQuery({ queryKey: languagesKey, queryFn: () => api.get<LanguagesResponse>('/online-store/languages') })
  const store = (response: LanguagesResponse) => queryClient.setQueryData(languagesKey, response)

  const add = useMutation({
    mutationFn: (code: string) => api.post<LanguagesResponse>('/online-store/languages', { locale: code }),
    onSuccess: (response, code) => {
      store(response)
      setAdding(false)
      setChoice(null)
      success(`${response.languages.find((language) => language.code === code)?.name ?? code} added. Translate it, then publish it.`)
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const publish = useMutation({
    mutationFn: ({ code, published }: { code: string; published: boolean }) => api.patch<LanguagesResponse>(`/online-store/languages/${code}`, { published }),
    onSuccess: (response, { code, published }) => {
      store(response)
      const name = response.languages.find((language) => language.code === code)?.name ?? code
      success(published ? `${name} is live on your store` : `${name} is unpublished`)
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })
  const remove = useMutation({
    mutationFn: (code: string) => api.delete<LanguagesResponse>(`/online-store/languages/${code}`),
    onSuccess: (response) => {
      store(response)
      setRemoving(null)
      success('Language removed. Its translations are kept in case you add it again.')
    },
    onError: (caught) => flashError(errorMessage(caught)),
  })

  const data = languages.data
  const others = (data?.languages ?? []).filter((language) => !language.primary)

  return (
    <>
      <PageHeader
        title="Languages"
        subtitle="Sell in more than one language. Each gets its own address, like yourstore.com/hi."
        actions={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>
              Add language
            </Button>
          )
        }
      />

      {languages.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(languages.error)}</Alert>}

      <SectionCard title="Store languages" description="Published languages appear in the language picker. Unpublished ones can be previewed and translated." flush>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Language</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Address</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.languages ?? []).map((language) => (
              <TableRow key={language.code} hover>
                <TableCell>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {language.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lang={language.code}>
                      {language.endonym !== language.name ? language.endonym : ''}
                    </Typography>
                    {language.primary && <Chip size="small" label="Default" color="primary" />}
                  </Stack>
                  {!language.primary && !language.theme_strings && (
                    <Typography variant="caption" color="text.secondary">
                      Theme buttons and labels stay in {data?.primary.name} until you add locales/{language.code}.json in the code editor.
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {language.primary || language.published ? <Chip size="small" label="Published" color="success" /> : <Chip size="small" label="Unpublished" />}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                    {language.root_url}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  {!language.primary && (
                    <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end', alignItems: 'center' }}>
                      <Button size="small" startIcon={<TranslateOutlinedIcon />} component={RouterLink} to={`/settings/languages/${language.code}/translate`}>
                        Translate
                      </Button>
                      {canManage && (
                        <IconButton size="small" aria-label={`More actions for ${language.name}`} onClick={(event) => setMenu({ anchor: event.currentTarget, language })}>
                          <MoreHorizIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {data && others.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            Your store is only in {data.primary.name}. Add a language to reach shoppers in theirs.
          </Typography>
        )}
      </SectionCard>

      <SectionCard title="What gets translated" description="Translate in the order shoppers see things.">
        <Typography variant="body2" component="div">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
            <li>
              <strong>Theme words</strong> — buttons, labels, account pages — come with the theme for Hindi, French, Spanish and German.
            </li>
            <li>
              <strong>Your content</strong> — products, collections, pages, blog posts, menus and the text in your theme’s sections — is translated with
              Translate.
            </li>
            <li>Anything left untranslated shows in {data?.primary.name ?? 'your default language'}, so nothing is ever blank.</li>
            <li>
              Turn on the language picker in the theme editor: Header → <em>Show country/language selector</em>.
            </li>
          </ul>
        </Typography>
      </SectionCard>

      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            if (menu) publish.mutate({ code: menu.language.code, published: !menu.language.published })
            setMenu(null)
          }}
        >
          {menu?.language.published ? 'Unpublish' : 'Publish'}
        </MenuItem>
        <MenuItem component="a" href={menu?.language.preview_url} target="_blank" rel="noopener" onClick={() => setMenu(null)}>
          Preview
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            if (menu) setRemoving(menu.language)
            setMenu(null)
          }}
        >
          Remove
        </MenuItem>
      </Menu>

      <Dialog open={adding} onClose={() => setAdding(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add language</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            It starts unpublished, so you can translate and preview it first.
          </Typography>
          <Autocomplete
            options={data?.available ?? []}
            value={choice}
            onChange={(_event, value) => setChoice(value)}
            getOptionLabel={(option) => (option.endonym !== option.name ? `${option.name} · ${option.endonym}` : option.name)}
            renderInput={(params) => <TextField {...params} label="Language" autoFocus />}
            renderOption={(props, option) => (
              <li {...props} key={option.code}>
                <Stack sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between' }} direction="row" spacing={1}>
                  <span>
                    {option.name} <Typography component="span" variant="body2" color="text.secondary">{option.endonym !== option.name ? option.endonym : ''}</Typography>
                  </span>
                  {option.theme && <Chip size="small" label="Theme translated" variant="outlined" />}
                </Stack>
              </li>
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>Cancel</Button>
          <Button variant="contained" disabled={!choice || add.isPending} onClick={() => choice && add.mutate(choice.code)}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={Boolean(removing)}
        title={`Remove ${removing?.name ?? ''}?`}
        body={`Shoppers will no longer see your store in ${removing?.name ?? 'this language'}. Its translations are kept, so adding it back restores them.`}
        confirmLabel="Remove"
        destructive
        busy={remove.isPending}
        onConfirm={() => removing && remove.mutate(removing.code)}
        onClose={() => setRemoving(null)}
      />

      <FlashSnackbar flash={flash} onClose={clear} />
    </>
  )
}
