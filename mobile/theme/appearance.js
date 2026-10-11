/** Saved on the device and read before the interface is drawn, so colours match the last choice. */

export const APPEARANCE_KEY = 'sosvidha.appearance';

export const DEFAULT_APPEARANCE = {
  scheme: 'dark',
  accent: 'logo',
  highContrast: false,
  textScale: 1,
  reduceMotion: false,
};

const SCHEMES = new Set(['dark', 'light']);
const ACCENTS = new Set(['logo', 'white']);
const SCALES = new Set([1, 1.15, 1.3]);

export function sanitizeAppearance(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const scale = Number(src.textScale);
  return {
    scheme: SCHEMES.has(src.scheme) ? src.scheme : DEFAULT_APPEARANCE.scheme,
    accent: ACCENTS.has(src.accent) ? src.accent : DEFAULT_APPEARANCE.accent,
    highContrast: src.highContrast === true,
    textScale: SCALES.has(scale) ? scale : DEFAULT_APPEARANCE.textScale,
    reduceMotion: src.reduceMotion === true,
  };
}

export function readAppearance() {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_APPEARANCE };
    const raw = localStorage.getItem(APPEARANCE_KEY);
    return sanitizeAppearance(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function writeAppearance(partial) {
  const next = sanitizeAppearance({ ...readAppearance(), ...partial });
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  } catch {
    /* the in-memory settings still update */
  }
  return next;
}

/** Text size and reduced motion can change without rebuilding every screen. Colours cannot. */
export function applyLiveAppearance(appearance = readAppearance()) {
  if (typeof document === 'undefined') return;
  const next = sanitizeAppearance(appearance);
  document.documentElement.style.zoom = String(next.textScale);
  document.documentElement.classList.toggle('sos-reduce-motion', next.reduceMotion);
  if (!document.getElementById('sos-a11y')) {
    const style = document.createElement('style');
    style.id = 'sos-a11y';
    style.textContent =
      '.sos-reduce-motion *, .sos-reduce-motion *::before, .sos-reduce-motion *::after { animation: none !important; transition: none !important; }';
    document.head.appendChild(style);
  }
}
