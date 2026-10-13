import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { formatMoney } from '../../../lib/format'
import type { Announcement, AnnouncementSettings } from './useAnnouncements'

/**
 * The bar as the storefront draws it, for the settings beside it.
 *
 * The same classes and rules as the theme's (`vl-ab` in base.css) — rotating
 * lines with their transition, the ticker, the three height modes, the
 * arrows and the link arrow per device — so what is chosen here is what
 * shoppers see. Rendered at the device's own width.
 */

const CSS = `
.abp { position: relative; overflow: hidden; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; line-height: 1.35; letter-spacing: .02em; transition: background-color .4s, color .4s; }
.abp--upper { text-transform: uppercase; letter-spacing: .08em; }
.abp__inner { display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 10px; }
.abp--fixed .abp__inner { min-height: 0; }
.abp__viewport { position: relative; flex: 1 1 auto; min-width: 0; overflow: hidden; align-self: stretch; display: flex; align-items: center; }
.abp__track { position: relative; width: 100%; }
.abp__line { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px 10px; padding: 8px 4px; }
.abp--left .abp__line { justify-content: flex-start; text-align: left; }
.abp--center .abp__line { text-align: center; }
.abp__cta { text-decoration: underline; text-underline-offset: 3px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.abp__code { font-weight: 700; letter-spacing: .08em; border: 1px dashed currentColor; border-radius: 4px; padding: 0 7px; font-size: .92em; }
.abp__countdown { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.abp__progress { flex-basis: 100%; display: block; max-width: 240px; height: 4px; margin: 2px auto 0; border-radius: 2px; background: color-mix(in srgb, currentColor 22%, transparent); overflow: hidden; }
.abp__progress > span { display: block; height: 100%; width: 35%; background: currentColor; }
.abp__btn { flex: none; display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; opacity: .85; font-size: 15px; line-height: 1; }
.abp--rotate .abp__track { display: grid; }
.abp--rotate .abp__line { grid-area: 1 / 1; visibility: hidden; }
.abp--rotate .abp__line.is-active, .abp--rotate .abp__line.is-leaving { visibility: visible; }
.abp--auto.abp--rotate .abp__line:not(.is-active) { position: absolute; inset: 0 0 auto 0; }
.abp--fixed .abp__line { padding-top: 2px; padding-bottom: 2px; flex-wrap: nowrap; }
.abp--fixed .abp__text { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.abp--fixed .abp__progress { display: none; }
.abp--fade .abp__line { opacity: 0; transition: opacity .45s ease, visibility 0s linear .45s; }
.abp--fade .abp__line.is-active { opacity: 1; transition: opacity .45s ease, visibility 0s; }
.abp--slide .abp__line { transform: translateX(100%); transition: transform .55s cubic-bezier(.22,.61,.36,1), visibility 0s linear .55s; }
.abp--slide .abp__line.is-active { transform: none; transition: transform .55s cubic-bezier(.22,.61,.36,1), visibility 0s; }
.abp--slide .abp__line.is-leaving { transform: translateX(-100%); }
.abp--slide_up .abp__line { transform: translateY(100%); opacity: 0; transition: transform .5s cubic-bezier(.22,.61,.36,1), opacity .5s, visibility 0s linear .5s; }
.abp--slide_up .abp__line.is-active { transform: none; opacity: 1; transition: transform .5s cubic-bezier(.22,.61,.36,1), opacity .5s, visibility 0s; }
.abp--slide_up .abp__line.is-leaving { transform: translateY(-100%); opacity: 0; }
.abp--slide .abp__line:not(.is-active):not(.is-leaving), .abp--slide_up .abp__line:not(.is-active):not(.is-leaving) { transition: none; }
.abp__typed::after { content: ""; display: inline-block; width: 1px; height: 1em; margin-left: 2px; vertical-align: -.12em; background: currentColor; animation: abp-caret .9s steps(1) infinite; }
@keyframes abp-caret { 50% { opacity: 0; } }
.abp--marquee .abp__viewport { mask-image: linear-gradient(90deg, transparent, #000 20px, #000 calc(100% - 20px), transparent); }
.abp--marquee .abp__track { display: flex; width: max-content; animation: abp-marquee var(--abp-duration, 20s) linear infinite; }
.abp--marquee.abp--right .abp__track { animation-direction: reverse; }
.abp--marquee .abp__line { flex: none; flex-wrap: nowrap; white-space: nowrap; padding-left: 14px; padding-right: 14px; }
.abp--marquee .abp__line::after { content: var(--abp-sep, "•"); margin-left: 28px; opacity: .6; }
.abp--marquee .abp__line[data-bg] { background: var(--line-bg); color: var(--line-fg, inherit); border-radius: 999px; margin: 4px 18px 4px 0; padding-top: 4px; padding-bottom: 4px; }
.abp--marquee .abp__line[data-bg]::after { content: none; }
.abp--marquee .abp__progress { display: none; }
.abp--hover:hover .abp__track, .abp.is-paused .abp__track { animation-play-state: paused; }
@keyframes abp-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
`

type Device = 'desktop' | 'mobile'
const shows = (choice: string, device: Device) => choice === 'all' || choice === device
const pad = (n: number) => String(n).padStart(2, '0')

function countdownText(ends: string | null, now: number): string | null {
  if (!ends) return null
  const left = Math.floor((new Date(ends).getTime() - now) / 1000)
  if (left <= 0) return null
  const d = Math.floor(left / 86400)
  return `Ends in ${d ? `${d}d ` : ''}${pad(Math.floor((left % 86400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`
}

function money(amount: number | null): string {
  return amount === null ? '—' : formatMoney(amount)
}

export function AnnouncementPreview({ settings, lines: all, device }: { settings: AnnouncementSettings; lines: Announcement[]; device: Device }) {
  const lines = useMemo(() => all.filter((line) => !line.hidden_because && shows(line.visibility, device)), [all, device])
  // The showing line and the one on its way out, moved together.
  const [slide, setSlide] = useState<{ index: number; leaving: number | null }>({ index: 0, leaving: null })
  const [paused, setPaused] = useState(false)
  const [typed, setTyped] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const track = useRef<HTMLDivElement | null>(null)
  const index = slide.index
  const leaving = slide.leaving
  const go = (step: number) =>
    setSlide((current) => ({ index: (current.index + step + lines.length) % lines.length, leaving: current.index % lines.length }))

  const rotating = settings.display_mode === 'rotate' && settings.autoplay && lines.length > 1
  const safeIndex = lines.length ? index % lines.length : 0

  // Rotation, as the storefront times it.
  useEffect(() => {
    if (!rotating || paused) return
    const timer = setInterval(() => {
      setSlide((current) => ({ index: (current.index + 1) % lines.length, leaving: current.index % lines.length }))
    }, Math.max(3, settings.rotation_seconds) * 1000)
    return () => clearInterval(timer)
  }, [rotating, paused, settings.rotation_seconds, lines.length])

  useEffect(() => {
    if (leaving === null) return
    const timer = setTimeout(() => setSlide((current) => ({ ...current, leaving: null })), 650)
    return () => clearTimeout(timer)
  }, [leaving])

  // The typewriter types the showing line out.
  const activeMessage = lines[safeIndex]?.message ?? ''
  useEffect(() => {
    if (settings.display_mode !== 'rotate' || settings.transition !== 'typewriter') return
    let shown = 0
    const timer = setInterval(() => {
      shown += 1
      setTyped(activeMessage.slice(0, shown))
      if (shown >= activeMessage.length) {
        clearInterval(timer)
        setTyped(null)
      }
    }, Math.max(18, Math.min(60, 1400 / Math.max(activeMessage.length, 1))))
    return () => clearInterval(timer)
  }, [activeMessage, settings.display_mode, settings.transition, safeIndex])

  useEffect(() => {
    if (!lines.some((line) => line.show_countdown && line.ends_at)) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [lines])

  // The ticker's speed is pixels a second, whatever its length: set on the element, measured after layout.
  useLayoutEffect(() => {
    const node = track.current
    if (settings.display_mode !== 'marquee' || !node) return
    const seconds = Math.max(4, node.scrollWidth / 2 / Math.max(10, settings.marquee_speed))
    node.style.setProperty('--abp-duration', `${seconds.toFixed(2)}s`)
  }, [settings.display_mode, settings.marquee_speed, lines, device, settings.font_size_desktop, settings.font_size_mobile])

  if (!shows(settings.bar_visibility, device)) {
    return (
      <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1, textAlign: 'center' }} data-preview-hidden>
        <Typography variant="body2" color="text.secondary">The bar is hidden on {device === 'mobile' ? 'phones' : 'desktop'}.</Typography>
      </Box>
    )
  }
  if (!settings.is_enabled || lines.length === 0) {
    return (
      <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1, textAlign: 'center' }} data-preview-hidden>
        <Typography variant="body2" color="text.secondary">
          {!settings.is_enabled ? 'The bar is switched off.' : `No live line shows on ${device === 'mobile' ? 'phones' : 'desktop'} — the theme’s own lines show instead.`}
        </Typography>
      </Box>
    )
  }

  const active = lines[safeIndex]
  const barBg = settings.background_hex && settings.background_gradient_hex
    ? `linear-gradient(90deg, ${settings.background_hex}, ${settings.background_gradient_hex})`
    : settings.background_hex ?? '#1a1a1a'
  const rotateColours = settings.display_mode === 'rotate' && active?.background_hex
  const fixed = settings.height_mode === 'fixed'
  const fontSize = device === 'mobile' ? settings.font_size_mobile : settings.font_size_desktop
  const arrows = settings.display_mode === 'rotate' && lines.length > 1 && shows(settings.arrows_visibility, device)
  const linkArrow = shows(settings.link_arrow_visibility, device)
  const moving = rotating || settings.display_mode === 'marquee'
  const classes = [
    'abp',
    `abp--${settings.display_mode}`,
    `abp--${settings.height_mode}`,
    settings.display_mode === 'rotate' ? `abp--${settings.transition}` : '',
    `abp--${settings.text_align}`,
    settings.text_transform === 'uppercase' ? 'abp--upper' : '',
    settings.pause_on_hover ? 'abp--hover' : '',
    settings.marquee_direction === 'right' ? 'abp--right' : '',
    paused ? 'is-paused' : '',
  ].join(' ')

  const renderLine = (line: Announcement, position: number, clone = false) => {
    const isActive = settings.display_mode === 'marquee' || position === safeIndex
    const text = line.kind === 'free_shipping'
      ? line.message.replace('{amount}', money(line.free_shipping_threshold))
      : line.message
    const shown = !clone && isActive && typed !== null && settings.transition === 'typewriter' ? typed : text
    const countdown = line.show_countdown ? countdownText(line.ends_at, now) : null
    return (
      <div
        key={`${clone ? 'c' : 'o'}${line.id}`}
        className={`abp__line${isActive ? ' is-active' : ''}${!clone && position === leaving && settings.display_mode === 'rotate' ? ' is-leaving' : ''}`}
        data-bg={line.background_hex ?? undefined}
        style={{ ['--line-bg' as string]: line.background_hex ?? undefined, ['--line-fg' as string]: line.text_hex ?? undefined }}
        aria-hidden={clone || undefined}
      >
        <span
          className={`abp__text${!clone && isActive && typed !== null && settings.transition === 'typewriter' ? ' abp__typed' : ''}`}
          style={fixed ? { WebkitLineClamp: settings.max_lines } : undefined}
        >
          {shown}
        </span>
        {line.link.type !== 'none' && line.link.label && (
          <span className="abp__cta">{line.link.label}{linkArrow && <span aria-hidden>→</span>}</span>
        )}
        {line.link.type !== 'none' && !line.link.label && linkArrow && <span aria-hidden>→</span>}
        {line.coupon?.live && line.coupon.code && <span className="abp__code">{line.coupon.code}</span>}
        {countdown && <span className="abp__countdown">{countdown}</span>}
        {line.kind === 'free_shipping' && <span className="abp__progress"><span /></span>}
      </div>
    )
  }

  return (
    <Box data-announcement-preview={device}>
      <style>{CSS}</style>
      <div
        className={classes}
        style={{
          background: rotateColours ? active.background_hex! : barBg,
          color: (settings.display_mode === 'rotate' && active?.text_hex) || settings.text_hex || '#ffffff',
          fontSize,
          fontWeight: settings.font_weight === 'bold' ? 700 : settings.font_weight === 'regular' ? 400 : 500,
          ['--abp-sep' as string]: `"${settings.marquee_separator.replace(/"/g, '')}"`,
        }}
      >
        <div className="abp__inner" style={fixed ? { height: device === 'mobile' ? settings.fixed_height_mobile : settings.fixed_height_desktop } : undefined}>
          {arrows && (
            <span className="abp__btn" aria-hidden onClick={() => go(-1)} style={{ cursor: 'pointer' }}>
              ‹
            </span>
          )}
          <div className="abp__viewport">
            <div className="abp__track" ref={track}>
              {lines.map((line, position) => renderLine(line, position))}
              {settings.display_mode === 'marquee' && lines.map((line, position) => renderLine(line, position, true))}
            </div>
          </div>
          {arrows && (
            <span className="abp__btn" aria-hidden onClick={() => go(1)} style={{ cursor: 'pointer' }}>
              ›
            </span>
          )}
          {moving && (
            <span className="abp__btn" aria-hidden onClick={() => setPaused(!paused)} style={{ cursor: 'pointer', fontSize: 11 }} title={paused ? 'Play' : 'Pause'}>
              {paused ? '▶' : '❚❚'}
            </span>
          )}
          {settings.is_dismissible && <span className="abp__btn" aria-hidden>×</span>}
        </div>
      </div>
    </Box>
  )
}
