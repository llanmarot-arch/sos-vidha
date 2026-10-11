import { readAppearance } from './appearance';

/**
 * Colours are chosen once, when the app loads, from the saved appearance.
 * Dark is the default. Accent is the logo purple, or white.
 * Text colours are chosen to stay readable on the surfaces they sit on.
 */

const LOGO = '#B07CC0';

function palette({ scheme, accent, highContrast }) {
  const dark = scheme !== 'light';
  const whiteAccent = accent === 'white';

  if (dark) {
    const ink = '#F7F4F8';
    return {
      scheme: 'dark',
      accent: whiteAccent ? 'white' : 'logo',
      bg0: highContrast ? '#000000' : '#0B0B10',
      bg1: highContrast ? '#000000' : '#141418',
      bg2: highContrast ? '#0A0A0A' : '#1C1C24',
      canvas: '#050508',
      header: '#121016',
      onHeader: '#FFFFFF',
      onHeaderMuted: '#E4D9EA',
      primary: whiteAccent ? '#FFFFFF' : LOGO,
      primaryLight: whiteAccent ? '#F4F4F4' : '#C9A6D4',
      primaryBright: whiteAccent ? '#E8E8E8' : '#9A68A8',
      primarySoft: whiteAccent ? '#2A2A30' : '#2C2433',
      onPrimary: '#16121A',
      critical: '#FF8A80',
      criticalFill: '#C62828',
      onCritical: '#FFFFFF',
      criticalDark: '#FF6E64',
      criticalSoft: '#3A1C1C',
      warning: '#FFD180',
      warningSoft: '#3A2C14',
      success: '#9BE7B5',
      successSoft: '#14301E',
      surface: highContrast ? '#000000' : '#1C1C24',
      surfaceElevated: highContrast ? '#0A0A0A' : '#26262F',
      border: highContrast ? '#FFFFFF' : '#3A3544',
      borderStrong: highContrast ? '#FFFFFF' : '#A79BB0',
      text: ink,
      textMuted: '#E4DEE8',
      textSubtle: '#C8C0D0',
      error: '#FF8A80',
      overlay: 'rgba(0, 0, 0, 0.72)',
    };
  }

  const primary = whiteAccent ? '#FFFFFF' : '#6E3E7C';
  const onPrimary = whiteAccent ? '#16121A' : '#FFFFFF';
  return {
    scheme: 'light',
    accent: whiteAccent ? 'white' : 'logo',
    bg0: highContrast ? '#FFFFFF' : '#F6F3F8',
    bg1: '#FFFFFF',
    bg2: '#FFFFFF',
    canvas: '#E6E0EA',
    header: whiteAccent ? '#FFFFFF' : '#3C2A44',
    onHeader: whiteAccent ? '#16121A' : '#FFFFFF',
    onHeaderMuted: whiteAccent ? '#3E3446' : '#F0E4F4',
    primary,
    primaryLight: whiteAccent ? '#F7F7F8' : '#855396',
    primaryBright: whiteAccent ? '#EFEFF1' : '#5A3066',
    primarySoft: whiteAccent ? '#F4F4F6' : '#F3E8F6',
    onPrimary,
    critical: '#C62828',
    criticalFill: '#C62828',
    onCritical: '#FFFFFF',
    criticalDark: '#A31515',
    criticalSoft: '#FDECEC',
    warning: '#8A5300',
    warningSoft: '#FFF4E0',
    success: '#1B7A3D',
    successSoft: '#E7F5EC',
    surface: '#FFFFFF',
    surfaceElevated: highContrast ? '#FFFFFF' : '#F3EEF5',
    border: highContrast ? '#000000' : '#E0D6E6',
    borderStrong: highContrast ? '#000000' : '#5C5164',
    text: '#1A1220',
    textMuted: '#3E3446',
    textSubtle: '#5C5164',
    error: '#C62828',
    overlay: 'rgba(20, 16, 28, 0.6)',
  };
}

const appearance = readAppearance();
const color = palette(appearance);

export const tokens = {
  scheme: color.scheme,
  accent: color.accent,
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
  minTouch: appearance.highContrast ? 56 : 48,
  device: { width: 390, height: 844 },
};

export const SOS_STATES = {
  IDLE: 'IDLE',
  HOLDING: 'HOLDING',
  COUNTDOWN: 'COUNTDOWN',
  DISPATCHING: 'DISPATCHING',
  ACTIVE_ALERT: 'ACTIVE_ALERT',
};
