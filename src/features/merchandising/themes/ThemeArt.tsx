import { Box, Stack, Typography } from '@mui/material'
import type { ThemePreset } from './themeTypes'

/**
 * A theme's thumbnail: a real screenshot of the theme in that style when the
 * theme store has one, otherwise drawn from the style itself — colours,
 * heading font, button shape — so every card looks like the theme it stands for.
 */
export function ThemeArt({ name, image, screenshot, height, preset, compact }: { name: string; image?: string | null; screenshot?: string | null; height: number; preset?: ThemePreset; compact?: boolean }) {
  if (screenshot) return <Box component="img" src={screenshot} alt={`${name}${preset ? ` · ${preset.name}` : ''}`} loading="lazy" sx={{ display: 'block', width: '100%', height, objectFit: 'cover', objectPosition: 'top' }} />
  if (image) return <Box component="img" src={image} alt={name} sx={{ display: 'block', width: '100%', height, objectFit: 'cover' }} />
  const settings = preset?.style ?? preset?.settings ?? {}
  const color = (key: string, fallback: string) => (typeof settings[key] === 'string' ? String(settings[key]) : fallback)
  const font = typeof settings.font_heading === 'string' ? settings.font_heading : null
  const radius = settings.button_style === 'pill' ? 999 : settings.button_style === 'square' ? 0 : Number(settings.radius ?? 6)
  const text = color('color_text', '#1A1A1A')
  return (
    <Box aria-hidden sx={{ height, bgcolor: color('color_background', '#FFFFFF'), display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {!compact && <Box sx={{ height: 12, bgcolor: color('color_espresso', '#1F1B16') }} />}
      {!compact && (
        <Stack direction="row" sx={{ px: 2, py: 1, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontFamily: font ? `"${font}", serif` : undefined, fontWeight: 700, fontSize: 13, color: text }}>{name}</Typography>
          <Stack direction="row" spacing={1}>
            {[28, 22, 30].map((width, index) => (
              <Box key={index} sx={{ width, height: 4, borderRadius: 2, bgcolor: text, opacity: 0.35 }} />
            ))}
          </Stack>
        </Stack>
      )}
      <Box sx={{ flex: 1, bgcolor: color('color_cream', color('color_ivory', '#F5F5F5')), display: 'flex', alignItems: 'center', px: compact ? 1 : 2.5 }}>
        <Stack spacing={compact ? 0.5 : 1.25} sx={{ maxWidth: '70%' }}>
          <Typography sx={{ fontFamily: font ? `"${font}", serif` : undefined, fontSize: compact ? 12 : height > 220 ? 30 : 22, fontWeight: 600, color: text, lineHeight: 1.05, textTransform: settings.heading_case === 'uppercase' ? 'uppercase' : 'none' }}>
            {compact ? name : 'Made for everyday'}
          </Typography>
          {!compact && <Box sx={{ alignSelf: 'flex-start', px: 1.5, py: 0.6, borderRadius: `${Math.min(radius, 999)}px`, bgcolor: color('color_accent', '#1A1A1A'), color: color('color_accent_contrast', '#FFFFFF'), fontSize: 11, fontWeight: 600 }}>Shop now</Box>}
        </Stack>
      </Box>
      {!compact && (
        <Stack direction="row" spacing={1} sx={{ px: 2, py: 1.25 }}>
          {[0, 1, 2, 3].map((index) => (
            <Box key={index} sx={{ flex: 1 }}>
              <Box sx={{ height: height > 220 ? 46 : 30, bgcolor: color('color_ivory', '#FAFAFA'), border: `1px solid ${color('color_border', '#E5E5E5')}`, borderRadius: `${Math.min(Number(settings.radius ?? 4), 12)}px` }} />
              <Box sx={{ mt: 0.5, width: '70%', height: 3, borderRadius: 2, bgcolor: text, opacity: 0.3 }} />
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  )
}
