import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { Box } from '@mui/material'

/**
 * A plain, dependable code editor: a textarea with a line-number gutter,
 * two-space indentation on Tab and Shift+Tab, and Ctrl+S to save. No syntax
 * colouring — a missed colour is harmless, a missed keystroke is not, and a
 * textarea never loses one.
 */
export function CodeEditor({
  value,
  onChange,
  onSave,
  readOnly,
  errorLine,
}: {
  value: string
  onChange(value: string): void
  onSave?: () => void
  readOnly?: boolean
  /** A line to mark (from a Liquid error's "line:N"). */
  errorLine?: number | null
}) {
  const area = useRef<HTMLTextAreaElement | null>(null)
  const gutter = useRef<HTMLDivElement | null>(null)
  const lines = useMemo(() => value.split('\n').length, [value])

  useEffect(() => {
    if (!errorLine || !area.current) return
    const lineHeight = 20
    area.current.scrollTop = Math.max(0, (errorLine - 5) * lineHeight)
  }, [errorLine])

  const replaceSelection = (text: string, start: number, end: number, selectStart: number, selectEnd: number) => {
    const next = value.slice(0, start) + text + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      if (!area.current) return
      area.current.selectionStart = selectStart
      area.current.selectionEnd = selectEnd
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault()
      onSave?.()
      return
    }
    if (readOnly || event.key !== 'Tab') return
    event.preventDefault()
    const target = event.currentTarget
    const { selectionStart: start, selectionEnd: end } = target
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    if (start === end && !event.shiftKey) {
      replaceSelection('  ', start, end, start + 2, start + 2)
      return
    }
    // Indent or outdent every selected line.
    const block = value.slice(lineStart, end)
    const changed = event.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ')
    const delta = changed.length - block.length
    const firstDelta = event.shiftKey ? -Math.min(2, (/^ */.exec(block)?.[0].length ?? 0)) : 2
    replaceSelection(changed, lineStart, end, Math.max(lineStart, start + firstDelta), end + delta)
  }

  return (
    <Box sx={{ position: 'relative', display: 'flex', height: '100%', minHeight: 0, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 13, lineHeight: '20px', bgcolor: '#fbfbfc' }}>
      <Box
        ref={gutter}
        aria-hidden
        sx={{ flexShrink: 0, overflow: 'hidden', textAlign: 'right', color: 'text.disabled', bgcolor: '#f3f4f6', borderRight: 1, borderColor: 'divider', py: 1.25, userSelect: 'none', minWidth: 48 }}
      >
        {Array.from({ length: lines }, (_unused, index) => (
          <Box key={index} sx={{ px: 1.25, height: 20, bgcolor: errorLine === index + 1 ? 'rgba(215,44,13,.12)' : undefined, color: errorLine === index + 1 ? 'error.main' : undefined }}>
            {index + 1}
          </Box>
        ))}
      </Box>
      <Box
        component="textarea"
        ref={area}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        aria-label="File contents"
        wrap="off"
        onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(event: React.UIEvent<HTMLTextAreaElement>) => {
          if (gutter.current) gutter.current.scrollTop = event.currentTarget.scrollTop
        }}
        sx={{
          flex: 1,
          minWidth: 0,
          border: 0,
          outline: 'none',
          resize: 'none',
          p: 1.25,
          m: 0,
          font: 'inherit',
          lineHeight: 'inherit',
          whiteSpace: 'pre',
          overflow: 'auto',
          tabSize: 2,
          bgcolor: 'transparent',
          color: 'text.primary',
        }}
      />
    </Box>
  )
}
