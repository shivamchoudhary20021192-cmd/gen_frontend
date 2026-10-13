import { createTheme } from '@mui/material/styles'

/**
 * Shopify-shaped theme, built from MUI components only.
 *
 * The goal is that the admin *feels* like Shopify's — same density, same
 * shapes, same restraint — without pulling in Polaris. Everything here is a
 * theme token or a component override, so pages stay plain MUI and no screen
 * has to know about the look.
 *
 * The four things that actually make it read as Shopify, in order of impact:
 *
 *   1. Labels sit ABOVE inputs, not floating in the border. This is the single
 *      biggest tell. MUI's outlined variant notches its border for a floating
 *      label; the overrides below pin the label outside the field and close the
 *      notch, so `<TextField label="..." />` needs no per-call-site change.
 *   2. 13px base type on a 4px rhythm. Shopify's admin is dense; MUI's defaults
 *      are roomy, and at 16px everything reads as a consumer app.
 *   3. Neutral greys with white cards and a hairline border, not elevation.
 *      Shadows are used once — under the primary button and the active nav pill.
 *   4. Buttons are small, near-black, 8px radius, with a 1px inner highlight.
 */
export const tokens = {
  /** Page background — Shopify's admin canvas. */
  surface: '#F1F1F1',
  /** Card and input background. */
  paper: '#FFFFFF',
  /** The nav rail, a shade darker than the canvas. */
  rail: '#EBEBEB',
  /** The dark top bar. */
  topbar: '#1A1A1A',
  ink: '#303030',
  inkStrong: '#1A1A1A',
  subdued: '#616161',
  faint: '#8A8A8A',
  border: '#E3E3E3',
  borderStrong: '#8A8A8A',
  hover: '#F7F7F7',
  selected: '#FFFFFF',
  success: '#0C5132',
  successSurface: '#CDFEE1',
  warning: '#5E4200',
  warningSurface: '#FFD794',
  critical: '#8E1F0B',
  criticalSurface: '#FEE9E8',
  info: '#00527C',
  infoSurface: '#D6F0FF',

  // Aliases kept from the previous Veylor palette so existing screens keep
  // compiling; they now point at the neutral equivalents rather than the cream
  // ones, which is what makes the restyle a one-file change.
  white: '#FFFFFF',
  /** was cream — now the page canvas, used as an image placeholder ground */
  ivory: '#F1F1F1',
  /** was warm sand — now a neutral chip surface */
  sand: '#E3E3E3',
  /** was warm taupe — now Shopify's subdued text */
  taupe: '#616161',
  /** was the warm red — now Shopify's critical */
  danger: '#8E1F0B',
} as const

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", system-ui, sans-serif'

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: tokens.ink, dark: tokens.inkStrong, contrastText: '#FFFFFF' },
    secondary: { main: tokens.subdued, contrastText: '#FFFFFF' },
    success: { main: tokens.success },
    warning: { main: tokens.warning },
    error: { main: tokens.critical },
    info: { main: tokens.info },
    background: { default: tokens.surface, paper: tokens.paper },
    text: { primary: tokens.ink, secondary: tokens.subdued, disabled: tokens.faint },
    divider: tokens.border,
    action: { hover: tokens.hover, selected: '#F1F1F1' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: FONT,
    fontSize: 13,
    htmlFontSize: 16,
    // Shopify's page title is 20px semibold — closer to MUI's h6 than its h4.
    h4: { fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em' },
    h5: { fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em' },
    h6: { fontSize: 15, fontWeight: 650, letterSpacing: 0 },
    subtitle1: { fontSize: 13, fontWeight: 650, letterSpacing: 0 },
    subtitle2: { fontSize: 12, fontWeight: 650 },
    body1: { fontSize: 13, lineHeight: 1.4 },
    body2: { fontSize: 13, lineHeight: 1.4 },
    caption: { fontSize: 12, lineHeight: 1.35, color: tokens.subdued },
    button: { textTransform: 'none', fontWeight: 600, fontSize: 13, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: tokens.surface, WebkitFontSmoothing: 'antialiased' },
        // Shopify's scrollbars are thin and only show on the scrolling surface.
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          backgroundColor: '#C9C9C9',
          borderRadius: 8,
          border: '3px solid transparent',
          backgroundClip: 'content-box',
        },
        '*::-webkit-scrollbar-thumb:hover': { backgroundColor: '#AFAFAF' },
      },
    },

    // ── the card, which is 90% of every Shopify screen ───────────────────────
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
        outlined: { borderColor: tokens.border },
      },
    },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          borderRadius: 12,
          borderColor: tokens.border,
          // One very soft shadow, so cards lift off the grey without floating.
          boxShadow: '0 1px 0 rgba(26,26,26,0.07)',
        },
      },
    },
    MuiCardHeader: {
      defaultProps: { slotProps: { title: { variant: 'subtitle1' } } },
      styleOverrides: { root: { padding: '14px 16px 10px' } },
    },
    MuiCardContent: {
      styleOverrides: { root: { padding: 16, '&:last-child': { paddingBottom: 16 } } },
    },

    // ── buttons ──────────────────────────────────────────────────────────────
    MuiButton: {
      defaultProps: { disableElevation: true, size: 'small' },
      styleOverrides: {
        root: { borderRadius: 8, minHeight: 32, padding: '6px 12px' },
        sizeSmall: { minHeight: 30, padding: '5px 12px' },
        contained: {
          // Shopify's primary is near-black with a 1px lighter top edge and a
          // tight drop shadow. That inner highlight is what stops it reading
          // as a flat rectangle.
          backgroundColor: tokens.ink,
          boxShadow:
            'inset 0 -1px 0 rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.16), 0 1px 0 rgba(26,26,26,0.1)',
          '&:hover': { backgroundColor: '#1A1A1A' },
          '&:active': { backgroundColor: '#000000' },
        },
        outlined: {
          backgroundColor: '#FFFFFF',
          borderColor: '#CDCDCD',
          color: tokens.ink,
          boxShadow: '0 1px 0 rgba(26,26,26,0.05)',
          '&:hover': { backgroundColor: tokens.hover, borderColor: '#B5B5B5' },
        },
        text: { color: tokens.ink, '&:hover': { backgroundColor: tokens.hover } },
      },
    },
    MuiIconButton: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: { borderRadius: 8, color: tokens.subdued, '&:hover': { backgroundColor: tokens.hover } },
      },
    },

    // ── inputs: the label goes ABOVE the field ───────────────────────────────
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiInputLabel: {
      // Always "shrunk", because it never sits inside the field.
      defaultProps: { shrink: true },
      styleOverrides: {
        root: {
          position: 'static',
          transform: 'none',
          fontSize: 13,
          fontWeight: 450,
          color: tokens.ink,
          marginBottom: 4,
          maxWidth: '100%',
          '&.Mui-focused': { color: tokens.ink },
          '&.Mui-error': { color: tokens.critical },
          '&.Mui-disabled': { color: tokens.faint },
        },
        asterisk: { color: tokens.critical },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          fontSize: 13,
          // The notch exists to make room for a floating label. There is no
          // floating label any more, so close it.
          '& legend': { display: 'none' },
          '& .MuiOutlinedInput-notchedOutline': {
            top: 0,
            borderColor: tokens.borderStrong,
            // Shopify's inputs have a darker top edge, as though recessed.
            borderTopColor: '#5C5C5C',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#616161' },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
            borderColor: '#005BD3',
            borderWidth: 2,
          },
          '&.Mui-disabled': { backgroundColor: '#FAFAFA' },
        },
        input: { padding: '7px 12px', height: 'auto' },
        multiline: { padding: 0 },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        // The label is a sibling above, so the field must not be pushed down.
        formControl: { marginTop: '0 !important' },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { fontSize: 12, marginLeft: 0, marginTop: 4, color: tokens.subdued },
      },
    },
    /**
     * `displayEmpty` so a select sitting on its "" option shows that option's
     * label rather than an empty box.
     *
     * Every filter dropdown in the admin has an "All statuses" / "Any method"
     * option with an empty value, and without this MUI renders nothing for it —
     * so the resting state of every filter in the product was a blank control
     * with no indication of what it filtered or that it was unset.
     */
    MuiSelect: { defaultProps: { size: 'small', displayEmpty: true } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: 13, minHeight: 34, borderRadius: 6, margin: '0 4px' } } },
    MuiMenu: { styleOverrides: { paper: { borderRadius: 10, border: `1px solid ${tokens.border}`, marginTop: 4 } } },
    MuiAutocomplete: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        inputRoot: { paddingTop: '4px !important', paddingBottom: '4px !important' },
        option: { fontSize: 13, borderRadius: 6, margin: '0 4px' },
        paper: { borderRadius: 10, border: `1px solid ${tokens.border}` },
      },
    },

    // ── controls ─────────────────────────────────────────────────────────────
    MuiCheckbox: { defaultProps: { size: 'small' }, styleOverrides: { root: { padding: 6 } } },
    MuiRadio: { defaultProps: { size: 'small' }, styleOverrides: { root: { padding: 6 } } },
    MuiSwitch: { defaultProps: { size: 'small' } },
    MuiFormControlLabel: {
      styleOverrides: { label: { fontSize: 13 } },
    },

    // ── data display ─────────────────────────────────────────────────────────
    MuiChip: {
      defaultProps: { size: 'small' },
      styleOverrides: {
        root: {
          fontWeight: 500,
          fontSize: 12,
          height: 22,
          borderRadius: 8,
          // Shopify's badges are pale surfaces with dark text, never saturated,
          // so every filled colour is remapped to its surface pair.
          // MUI v9 splits these into `filled` + `colorX` classes rather than a
          // single `filledSuccess`, so both must be in the selector.
          '&.MuiChip-filled.MuiChip-colorSuccess': {
            backgroundColor: tokens.successSurface,
            color: tokens.success,
          },
          '&.MuiChip-filled.MuiChip-colorWarning': {
            backgroundColor: tokens.warningSurface,
            color: tokens.warning,
          },
          '&.MuiChip-filled.MuiChip-colorError': {
            backgroundColor: tokens.criticalSurface,
            color: tokens.critical,
          },
          '&.MuiChip-filled.MuiChip-colorInfo': { backgroundColor: tokens.infoSurface, color: tokens.info },
          '&.MuiChip-filled.MuiChip-colorPrimary': { backgroundColor: '#E3E3E3', color: tokens.ink },
          '&.MuiChip-filled.MuiChip-colorDefault': { backgroundColor: '#E3E3E3', color: tokens.ink },
          '& .MuiChip-icon': { color: 'inherit', marginLeft: 5 },
        },
        outlined: { borderColor: tokens.border, color: tokens.subdued },
      },
    },
    MuiTable: { defaultProps: { size: 'small' } },
    MuiTableCell: {
      styleOverrides: {
        root: { fontSize: 13, borderColor: tokens.border, padding: '10px 12px' },
        head: {
          fontWeight: 600,
          fontSize: 12,
          color: tokens.subdued,
          backgroundColor: '#FAFAFA',
          textTransform: 'none',
          letterSpacing: 0,
          whiteSpace: 'nowrap',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: { '&:last-child td': { borderBottom: 0 }, '&:hover': { backgroundColor: tokens.hover } },
        head: { '&:hover': { backgroundColor: '#FAFAFA' } },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontSize: 13,
          padding: '8px 12px',
          alignItems: 'center',
          '&.MuiAlert-standard.MuiAlert-colorInfo': { backgroundColor: tokens.infoSurface, color: tokens.info },
          '&.MuiAlert-standard.MuiAlert-colorSuccess': {
            backgroundColor: tokens.successSurface,
            color: tokens.success,
          },
          '&.MuiAlert-standard.MuiAlert-colorWarning': {
            backgroundColor: tokens.warningSurface,
            color: tokens.warning,
          },
          '&.MuiAlert-standard.MuiAlert-colorError': {
            backgroundColor: tokens.criticalSurface,
            color: tokens.critical,
          },
          '& .MuiAlert-icon': { color: 'inherit', opacity: 1, marginRight: 10 },
        },
      },
    },
    MuiDialog: {
      styleOverrides: { paper: { borderRadius: 14, boxShadow: '0 26px 80px rgba(0,0,0,0.2)' } },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontSize: 15, fontWeight: 650, padding: '14px 16px' } } },
    MuiDialogContent: { styleOverrides: { root: { padding: 16 } } },
    MuiDialogActions: { styleOverrides: { root: { padding: 12, gap: 8 } } },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { backgroundColor: tokens.inkStrong, fontSize: 12, borderRadius: 8, padding: '5px 8px' },
      },
    },
    MuiDivider: { styleOverrides: { root: { borderColor: tokens.border } } },
    MuiTabs: {
      styleOverrides: {
        root: { minHeight: 38 },
        indicator: { height: 2, backgroundColor: tokens.ink },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { minHeight: 38, fontSize: 13, fontWeight: 600, textTransform: 'none', padding: '8px 12px' },
      },
    },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4, backgroundColor: '#E3E3E3' } } },
    MuiListItemIcon: { styleOverrides: { root: { minWidth: 28, color: tokens.subdued } } },
    MuiSnackbarContent: {
      // Shopify's toast is a dark pill at the bottom of the screen.
      styleOverrides: {
        root: { backgroundColor: tokens.inkStrong, borderRadius: 10, fontSize: 13, minWidth: 'auto' },
      },
    },
  },
})
