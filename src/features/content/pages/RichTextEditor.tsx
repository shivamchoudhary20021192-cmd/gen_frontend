/**
 * Professional Rich Text Editor Component
 * Built with Tiptap - Industry standard editor
 * Shopify-inspired design with Material-UI
 */

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Link } from '@tiptap/extension-link'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TextAlign } from '@tiptap/extension-text-align'
import { Underline } from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import {
  Box,
  ButtonGroup,
  IconButton,
  Paper,
  Tooltip,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Typography,
} from '@mui/material'
import {
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatStrikethrough as StrikethroughIcon,
  Code as CodeIcon,
  FormatQuote as QuoteIcon,
  FormatListBulleted as BulletListIcon,
  FormatListNumbered as NumberListIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignRight as AlignRightIcon,
  Link as LinkIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  FormatClear as ClearIcon,
} from '@mui/icons-material'
import { useCallback, useEffect } from 'react'
import { tokens } from '../../../theme'

/**
 * An empty body is `''` in the form's state and `<p></p>` once Tiptap has
 * rendered it. They are the same document and must not count as a change.
 */
function isEmptyDocument(html: string): boolean {
  const trimmed = (html ?? '').trim()
  return trimmed === '' || trimmed === '<p></p>' || trimmed === '<p><br></p>'
}

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  error?: boolean
  helperText?: string
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  disabled = false,
  error = false,
  helperText,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      TextStyle,
      Color,
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      /**
       * Tiptap announces an update while it is bringing its own view up, and
       * under React StrictMode that happens twice: the editor is created,
       * destroyed and created again. The fresh, empty one emits *after* the
       * form has already been filled from the API — so `onChange('<p></p>')`
       * landed on top of the body that had just been fetched, and the field
       * opened blank while every plain input beside it was filled.
       *
       * An edit a person makes always happens in a focused editor, including
       * clearing the field and every toolbar button (they focus it first). An
       * initialisation emit never does. That is the whole distinction.
       */
      if (!editor.isFocused && isEmptyDocument(editor.getHTML())) return
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'editor-content',
      },
    },
  })

  // Update content when prop changes
  /**
   * Pushes a new `content` prop into the editor.
   *
   * Two things here are load-bearing.
   *
   * **`emitUpdate: false`.** `setContent` emits an update by default, and the
   * `onUpdate` above turns that straight back into `onChange(editor.getHTML())`.
   * So the sync that runs on mount — content `''` against an empty editor —
   * called back with Tiptap's rendering of an empty document, `<p></p>`, and
   * overwrote whatever the form had just fetched. On a banner or a page loaded
   * for editing that meant the body arrived from the API and was wiped a tick
   * later; the field opened blank while every plain input beside it was filled.
   * A programmatic sync is not something a person typed, so it must not be
   * announced as an edit.
   *
   * **Treating `''` and `<p></p>` as the same document.** The form stores an
   * empty body as `''`; Tiptap renders one as `<p></p>`. Comparing them raw
   * makes the effect fire on every render of an empty editor.
   */
  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    const current = editor.getHTML()
    if (content === current) return
    if (isEmptyDocument(content) && isEmptyDocument(current)) return

    editor.commands.setContent(content, { emitUpdate: false })
  }, [content, editor])

  // Update disabled state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled)
    }
  }, [disabled, editor])

  const setLink = useCallback(() => {
    if (!editor) return

    const previousUrl = editor.getAttributes('link').href
    const url = window.prompt('Enter URL:', previousUrl)

    if (url === null) return

    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) {
    return null
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Paper
        variant="outlined"
        sx={{
          borderColor: error ? 'error.main' : tokens.border,
          borderRadius: '8px',
          overflow: 'hidden',
          '&:focus-within': {
            borderColor: error ? 'error.main' : 'primary.main',
            boxShadow: error
              ? '0 0 0 3px rgba(244, 67, 54, 0.1)'
              : '0 0 0 3px rgba(25, 118, 210, 0.1)',
          },
        }}
      >
        {/* Toolbar */}
        <Box
          sx={{
            bgcolor: tokens.ivory,
            borderBottom: `1px solid ${tokens.border}`,
            p: 1,
          }}
        >
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Undo/Redo */}
            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Undo">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().undo().run()}
                    disabled={!editor.can().undo() || disabled}
                    sx={{ borderRadius: 0 }}
                  >
                    <UndoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => editor.chain().focus().redo().run()}
                    disabled={!editor.can().redo() || disabled}
                    sx={{ borderRadius: 0 }}
                  >
                    <RedoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Headings */}
            <ToggleButtonGroup
              size="small"
              exclusive
              value={
                editor.isActive('heading', { level: 1 })
                  ? 'h1'
                  : editor.isActive('heading', { level: 2 })
                    ? 'h2'
                    : editor.isActive('heading', { level: 3 })
                      ? 'h3'
                      : editor.isActive('heading', { level: 4 })
                        ? 'h4'
                        : editor.isActive('heading', { level: 5 })
                          ? 'h5'
                          : editor.isActive('heading', { level: 6 })
                            ? 'h6'
                            : editor.isActive('paragraph')
                              ? 'p'
                              : null
              }
              disabled={disabled}
            >
              <ToggleButton
                value="p"
                onClick={() => editor.chain().focus().setParagraph().run()}
                sx={{ px: 1, fontSize: '12px', lineHeight: 1 }}
              >
                P
              </ToggleButton>
              <ToggleButton
                value="h1"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                sx={{ px: 1, fontSize: '12px', lineHeight: 1 }}
              >
                H1
              </ToggleButton>
              <ToggleButton
                value="h2"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                sx={{ px: 1, fontSize: '12px', lineHeight: 1 }}
              >
                H2
              </ToggleButton>
              <ToggleButton
                value="h3"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                sx={{ px: 1, fontSize: '12px', lineHeight: 1 }}
              >
                H3
              </ToggleButton>
              <ToggleButton
                value="h4"
                onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                sx={{ px: 1, fontSize: '12px', lineHeight: 1 }}
              >
                H4
              </ToggleButton>
              <ToggleButton
                value="h5"
                onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
                sx={{ px: 1, fontSize: '12px', lineHeight: 1 }}
              >
                H5
              </ToggleButton>
              <ToggleButton
                value="h6"
                onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
                sx={{ px: 1, fontSize: '12px', lineHeight: 1 }}
              >
                H6
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Text Formatting */}
            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Bold">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  disabled={disabled}
                  color={editor.isActive('bold') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <BoldIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Italic">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  disabled={disabled}
                  color={editor.isActive('italic') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <ItalicIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Underline">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  disabled={disabled}
                  color={editor.isActive('underline') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <UnderlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Strikethrough">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  disabled={disabled}
                  color={editor.isActive('strike') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <StrikethroughIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Lists */}
            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Bullet List">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  disabled={disabled}
                  color={editor.isActive('bulletList') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <BulletListIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Numbered List">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  disabled={disabled}
                  color={editor.isActive('orderedList') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <NumberListIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Alignment */}
            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Align Left">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  disabled={disabled}
                  color={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <AlignLeftIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Align Center">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  disabled={disabled}
                  color={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <AlignCenterIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Align Right">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  disabled={disabled}
                  color={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <AlignRightIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Other */}
            <ButtonGroup size="small" variant="outlined">
              <Tooltip title="Link">
                <IconButton
                  size="small"
                  onClick={setLink}
                  disabled={disabled}
                  color={editor.isActive('link') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <LinkIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Blockquote">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  disabled={disabled}
                  color={editor.isActive('blockquote') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <QuoteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Code Block">
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                  disabled={disabled}
                  color={editor.isActive('codeBlock') ? 'primary' : 'default'}
                  sx={{ borderRadius: 0 }}
                >
                  <CodeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </ButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Clear Formatting */}
            <Tooltip title="Clear Formatting">
              <span>
                <IconButton
                  size="small"
                  onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                  disabled={disabled}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>

        {/* Editor Content */}
        <Box
          sx={{
            minHeight: 200,
            maxHeight: 600,
            overflowY: 'auto',
            p: 2,
            '& .editor-content': {
              outline: 'none',
              minHeight: 184,
            },
            '& .ProseMirror': {
              outline: 'none',
              '& > * + *': {
                mt: '0.75em',
              },
              '& h1': {
                fontSize: '2em',
                fontWeight: 700,
                lineHeight: 1.2,
                mt: '0.67em',
              },
              '& h2': {
                fontSize: '1.5em',
                fontWeight: 700,
                lineHeight: 1.3,
                mt: '0.75em',
              },
              '& h3': {
                fontSize: '1.25em',
                fontWeight: 600,
                lineHeight: 1.4,
                mt: '0.83em',
              },
              '& h4': {
                fontSize: '1.1em',
                fontWeight: 600,
                lineHeight: 1.4,
                mt: '1em',
              },
              '& h5': {
                fontSize: '1em',
                fontWeight: 600,
                lineHeight: 1.5,
                mt: '1.2em',
              },
              '& h6': {
                fontSize: '0.9em',
                fontWeight: 600,
                lineHeight: 1.5,
                mt: '1.33em',
              },
              '& p': {
                lineHeight: 1.6,
              },
              '& ul, & ol': {
                pl: 3,
                lineHeight: 1.6,
              },
              '& ul': {
                listStyleType: 'disc',
              },
              '& ol': {
                listStyleType: 'decimal',
              },
              '& li': {
                mb: 0.5,
              },
              '& blockquote': {
                borderLeft: `3px solid ${tokens.border}`,
                pl: 2,
                py: 0.5,
                fontStyle: 'italic',
                color: tokens.subdued,
              },
              '& code': {
                bgcolor: tokens.ivory,
                borderRadius: '3px',
                px: 0.5,
                py: 0.25,
                fontSize: '0.9em',
                fontFamily: 'monospace',
              },
              '& pre': {
                bgcolor: tokens.rail,
                borderRadius: '6px',
                p: 2,
                overflow: 'auto',
                '& code': {
                  bgcolor: 'transparent',
                  p: 0,
                  color: 'inherit',
                },
              },
              '& a': {
                color: 'primary.main',
                textDecoration: 'underline',
                '&:hover': {
                  textDecoration: 'none',
                },
              },
              '& .is-editor-empty:first-of-type::before': {
                content: 'attr(data-placeholder)',
                color: tokens.faint,
                pointerEvents: 'none',
                height: 0,
                float: 'left',
              },
            },
          }}
        >
          <EditorContent editor={editor} />
        </Box>
      </Paper>

      {helperText && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            ml: 1.5,
            color: error ? 'error.main' : 'text.secondary',
          }}
        >
          {helperText}
        </Typography>
      )}
    </Box>
  )
}
