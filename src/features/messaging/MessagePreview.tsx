import { Box, Stack, Typography } from '@mui/material'
import { tokens } from '../../theme'
import type { Channel, SmsInfo } from './useMessaging'

/**
 * What the message will look like where it lands.
 *
 * Three different pictures, because the three channels are three different
 * objects: a WhatsApp bubble with a tail and a timestamp, a grey SMS bubble
 * with a header line above it, and an inbox row with a sender, a subject and a
 * preheader. A single grey box captioned "preview" tells nobody whether the
 * subject line is too long or whether the greeting reads as a form letter.
 *
 * Everything here is drawn with MUI and CSS — no images, no external fonts —
 * so it renders the same in the editor, in the campaign review step and in the
 * one-to-one composer, which all show the same component.
 */

interface MessagePreviewProps {
  channel: Channel
  subject?: string | null
  preheader?: string | null
  headerText?: string | null
  body: string
  footerText?: string | null
  from?: string | null
  sms?: SmsInfo | null
  /** Shown under the frame: "Simulated — nothing is sent yet." */
  note?: string | null
}

function nowLabel(): string {
  return new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

export function MessagePreview({
  channel,
  subject,
  preheader,
  headerText,
  body,
  footerText,
  from,
  sms,
  note,
}: MessagePreviewProps) {
  const lines = (body || '').split('\n')

  return (
    <Stack spacing={1}>
      <Box
        sx={{
          borderRadius: 3,
          border: `1px solid ${tokens.border}`,
          // WhatsApp's own wallpaper for WhatsApp, a neutral ground for SMS:
          // the point of the frame is that it looks like where it will land.
          bgcolor: channel === 'whatsapp' ? '#ECE5DD' : channel === 'sms' ? tokens.surface : tokens.paper,
          p: channel === 'email' ? 0 : 2,
          overflow: 'hidden',
        }}
      >
        {channel === 'email' ? (
          <Box>
            <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${tokens.border}` }}>
              <Typography sx={{ fontSize: 12, color: tokens.subdued }}>{from || 'Your shop'}</Typography>
              <Typography sx={{ fontSize: 15, fontWeight: 600, color: tokens.inkStrong, mt: 0.25 }}>
                {subject || '(no subject)'}
              </Typography>
              {preheader && (
                <Typography sx={{ fontSize: 12, color: tokens.faint, mt: 0.25 }} noWrap>
                  {preheader}
                </Typography>
              )}
            </Box>
            <Box sx={{ px: 2, py: 2 }}>
              {lines.map((line, index) => (
                <Typography
                  key={index}
                  sx={{ fontSize: 14, lineHeight: 1.7, color: tokens.ink, minHeight: line === '' ? 12 : undefined }}
                >
                  {line}
                </Typography>
              ))}
              {footerText && (
                <Typography sx={{ fontSize: 11, color: tokens.faint, mt: 2, pt: 1.5, borderTop: `1px solid ${tokens.border}` }}>
                  {footerText}
                </Typography>
              )}
            </Box>
          </Box>
        ) : (
          <Stack spacing={0.5} sx={{ alignItems: 'flex-start' }}>
            {channel === 'sms' && from && (
              <Typography
                sx={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  color: tokens.subdued,
                  alignSelf: 'center',
                  mb: 0.5,
                }}
              >
                {from}
              </Typography>
            )}
            <Box
              sx={{
                position: 'relative',
                maxWidth: '85%',
                bgcolor: channel === 'whatsapp' ? '#FFFFFF' : '#E9E9EB',
                borderRadius: 2,
                borderTopLeftRadius: channel === 'whatsapp' ? 2 : 16,
                px: 1.5,
                py: 1,
                boxShadow: '0 1px 1px rgba(0,0,0,0.08)',
              }}
            >
              {headerText && (
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: tokens.inkStrong, mb: 0.5 }}>
                  {headerText}
                </Typography>
              )}
              {lines.map((line, index) => (
                <Typography
                  key={index}
                  sx={{
                    fontSize: 13.5,
                    lineHeight: 1.55,
                    color: tokens.ink,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    minHeight: line === '' ? 10 : undefined,
                  }}
                >
                  {line}
                </Typography>
              ))}
              {footerText && (
                <Typography sx={{ fontSize: 11.5, color: tokens.faint, mt: 0.75 }}>{footerText}</Typography>
              )}
              <Typography sx={{ fontSize: 10.5, color: tokens.faint, textAlign: 'right', mt: 0.25 }}>
                {nowLabel()}
              </Typography>
            </Box>
          </Stack>
        )}
      </Box>

      {/* The numbers that decide what this costs, said once, under the picture. */}
      {sms && (
        <Typography sx={{ fontSize: 11.5, color: sms.segments > 1 ? tokens.warning : tokens.subdued }}>
          {sms.characters} characters · {sms.encoding} · {sms.segments} segment{sms.segments === 1 ? '' : 's'}
          {sms.segments > 1 ? ` — billed ${sms.segments} times` : ''}
        </Typography>
      )}
      {note && <Typography sx={{ fontSize: 11.5, color: tokens.subdued }}>{note}</Typography>}
    </Stack>
  )
}
