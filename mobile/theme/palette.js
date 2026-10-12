/**
 * Pure colour palette. Screens call this with the current appearance so a
 * change repaints immediately. Nothing here reads storage or React state.
 */

const LOGO_DARK = '#B07CC0';
const LOGO_LIGHT = '#6E3E7C';

export function createTheme(raw) {
  const scheme = raw?.scheme === 'light' ? 'light' : 'dark';
  const accent = raw?.accent === 'white' ? 'white' : 'logo';
  const highContrast = raw?.highContrast === true;
  const dark = scheme === 'dark';
  const whiteAccent = accent === 'white';
  const whiteOnLight = !dark && whiteAccent;
  const logo = dark ? LOGO_DARK : LOGO_LIGHT;
  const primary = whiteAccent ? '#FFFFFF' : logo;
  const onPrimary = whiteAccent || dark ? '#16121A' : '#FFFFFF';
  const text = dark ? '#F7F4F8' : '#1A1220';
  const borderStrong = highContrast ? (dark ? '#FFFFFF' : '#000000') : dark ? '#A79BB0' : '#5C5164';

  const color = {
    scheme,
    accent,
    bg0: highContrast ? (dark ? '#000000' : '#FFFFFF') : dark ? '#0B0B10' : '#F6F3F8',
    bg1: highContrast ? (dark ? '#000000' : '#FFFFFF') : dark ? '#141418' : '#FFFFFF',
    bg2: highContrast ? (dark ? '#0A0A0A' : '#FFFFFF') : dark ? '#1C1C24' : '#FFFFFF',
    canvas: dark ? '#050508' : '#E6E0EA',
    header: dark ? '#121016' : '#FFFFFF',
    onHeader: dark ? '#FFFFFF' : '#16121A',
    onHeaderMuted: dark ? '#E4D9EA' : '#5C5164',
    primary,
    primaryLight: whiteAccent ? (dark ? '#F4F4F4' : '#F7F7F8') : dark ? '#C9A6D4' : '#855396',
    primaryBright: whiteAccent ? (dark ? '#E8E8E8' : '#EFEFF1') : dark ? '#9A68A8' : '#5A3066',
    primarySoft: whiteAccent ? (dark ? '#2A2A30' : '#F4F4F6') : dark ? '#2C2433' : '#F3E8F6',
    onPrimary,
    /** Icons, links, and selected tabs that sit on a page surface. */
    accentOnSurface: whiteOnLight ? '#16121A' : primary,
    /** Filled choice chips. White-on-light uses dark ink so the chip stays visible. */
    selectedFill: whiteOnLight ? '#16121A' : primary,
    selectedText: whiteOnLight ? '#FFFFFF' : onPrimary,
    primaryBorderWidth: whiteAccent ? 1.5 : 0,
    primaryBorder: borderStrong,
    ghostBorder: whiteOnLight ? borderStrong : primary,
    ghostText: whiteOnLight ? text : primary,
    controlThumb: whiteOnLight ? '#FFFFFF' : onPrimary,
    critical: dark ? '#FF8A80' : '#C62828',
    criticalFill: '#C62828',
    onCritical: '#FFFFFF',
    criticalDark: dark ? '#FF6E64' : '#A31515',
    criticalSoft: dark ? '#3A1C1C' : '#FDECEC',
    warning: dark ? '#FFD180' : '#8A5300',
    warningSoft: dark ? '#3A2C14' : '#FFF4E0',
    success: dark ? '#9BE7B5' : '#1B7A3D',
    successSoft: dark ? '#14301E' : '#E7F5EC',
    onSuccess: dark ? '#102418' : '#FFFFFF',
    surface: highContrast ? (dark ? '#000000' : '#FFFFFF') : dark ? '#1C1C24' : '#FFFFFF',
    surfaceElevated: highContrast ? (dark ? '#0A0A0A' : '#FFFFFF') : dark ? '#26262F' : '#F3EEF5',
    border: highContrast ? (dark ? '#FFFFFF' : '#000000') : dark ? '#3A3544' : '#E0D6E6',
    borderStrong,
    text,
    textMuted: dark ? '#E4DEE8' : '#3E3446',
    textSubtle: dark ? '#C8C0D0' : '#5C5164',
    error: dark ? '#FF8A80' : '#C62828',
    overlay: dark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(20, 16, 28, 0.6)',
  };

  return {
    scheme: color.scheme,
    accent: color.accent,
    highContrast,
    textScale: raw?.textScale,
    reduceMotion: raw?.reduceMotion === true,
    color,
    spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
    radius: { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 },
    typography: {
      hero: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
      title: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
      subtitle: { fontSize: 15, fontWeight: '400', lineHeight: 22, color: color.textMuted },
      body: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
      caption: { fontSize: 14, fontWeight: '700', lineHeight: 20 },
      mono: { fontSize: 13, fontFamily: 'monospace' },
    },
    minTouch: highContrast ? 56 : 48,
    device: { width: 390, height: 844 },
  };
}
