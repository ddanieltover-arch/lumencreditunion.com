/**
 * Lumenfield Design Tokens
 * Strictly adhering to brand guidelines:
 * - Base: Teal #0A3D3F
 * - Mid Teal: #0F766E
 * - Primary Action: Amber #F5B942
 * - Ink: #0E1B1F
 * - Surface: #F4F7F6
 * - Border: #DCE5E3
 * - Muted Text: #4A5B60
 * - Warning Bg: #FFF1CC
 * - Fonts: Sora (headings), Inter (body)
 * - Accessibility: Min touch target 44px, text contrast 4.5:1
 */

export const DESIGN_TOKENS = {
  colors: {
    tealBase: '#0A3D3F',
    tealDark: '#072F30',
    tealMid: '#0F766E',
    tealHover: '#0F5557',
    tealActive: '#0A4F4A',
    amber: '#F5B942',
    amberLight: '#FFF1CC',
    amberBorder: '#F0D58A',
    amberText: '#5A4100',
    ink: '#0E1B1F',
    surface: '#F4F7F6',
    surfaceTint: '#E3F3F1',
    border: '#DCE5E3',
    borderStrong: '#BCCAC8',
    mutedText: '#4A5B60',
    subtleText: '#8FA5A3',
    white: '#FFFFFF',
    danger: '#D9383A',
    dangerBg: '#FDF2F2',
    success: '#107E54',
    successBg: '#EAF7EE',
  },
  fonts: {
    heading: "'Sora', -apple-system, BlinkMacSystemFont, sans-serif",
    body: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
  accessibility: {
    minTouchTargetPx: 44,
    minContrastRatio: 4.5,
  },
  sandboxCopy: {
    persistentBanner: '',
    prohibitedClaims: ['NCUA', 'FDIC', 'chartered', 'licensed'],
  },
} as const;
