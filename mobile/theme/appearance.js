/** Saved on the device and read before the interface is drawn, so colours match the last choice. */

import { createTheme } from './palette.js';

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

/** Device colour scheme when the person has not chosen one yet. Dark stays the fallback. */
export function systemScheme() {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    }
  } catch {
    /* keep the app default */
  }
  return DEFAULT_APPEARANCE.scheme;
}

export function readAppearance() {
  try {
    if (typeof localStorage === 'undefined') {
      return sanitizeAppearance({ ...DEFAULT_APPEARANCE, scheme: systemScheme() });
    }
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return sanitizeAppearance({ ...DEFAULT_APPEARANCE, scheme: systemScheme() });
    return sanitizeAppearance(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function hasStoredAppearance() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(APPEARANCE_KEY) != null;
  } catch {
    return false;
  }
}

/** Writes the full appearance. Does not merge with an older copy. */
export function storeAppearance(appearance) {
  const next = sanitizeAppearance(appearance);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(APPEARANCE_KEY, JSON.stringify(next));
  } catch {
    /* the in-memory settings still update */
  }
  return next;
}

export function writeAppearance(partial) {
  return storeAppearance({ ...readAppearance(), ...partial });
}

/**
 * Web can read localStorage before the first paint. Native only has the
 * AsyncStorage settings record, so that record wins when localStorage is empty.
 */
export function mergeLoadedAppearance(savedRecord, localAppearance, localPresent) {
  if (localPresent) return sanitizeAppearance(localAppearance);
  const saved = savedRecord && typeof savedRecord === 'object' ? savedRecord : {};
  if (saved.scheme === 'light' || saved.scheme === 'dark') return sanitizeAppearance(saved);
  return sanitizeAppearance({ ...saved, scheme: localAppearance?.scheme || systemScheme() });
}

/** Next appearance after a control is pressed. Applied immediately; no reload. */
export function reduceAppearance(current, partial) {
  return sanitizeAppearance({ ...current, ...partial });
}

/** A failed account save must not change the appearance already stored on the device. */
export function themeAfterAccountSave(appearance, _accountSaved) {
  return sanitizeAppearance(appearance);
}

/** Page background for the browser chrome, including the area outside the app column. */
export function documentColors(appearance) {
  const next = sanitizeAppearance(appearance);
  const theme = createTheme(next);
  return { scheme: next.scheme, background: theme.color.canvas, color: theme.color.text };
}

function applyNativeScheme(scheme) {
  if (typeof document === 'undefined' && typeof navigator === 'undefined') return;
  try {
    const { Appearance } = require('react-native');
    if (Appearance && typeof Appearance.setColorScheme === 'function') {
      Appearance.setColorScheme(scheme === 'light' ? 'light' : 'dark');
    }
  } catch {
    /* The web Appearance object has no setter. Document colours still update. */
  }
}

/** Text size, reduced motion, and the page colour scheme. React styles read the same choice. */
export function applyLiveAppearance(appearance = readAppearance()) {
  const next = sanitizeAppearance(appearance);
  applyNativeScheme(next.scheme);
  if (typeof document === 'undefined') return;
  const colors = documentColors(next);
  const root = document.documentElement;
  root.style.zoom = String(next.textScale);
  root.style.colorScheme = colors.scheme;
  root.style.backgroundColor = colors.background;
  root.dataset.scheme = colors.scheme;
  root.classList.toggle('sos-reduce-motion', next.reduceMotion);
  if (document.body) {
    document.body.style.backgroundColor = colors.background;
    document.body.style.color = colors.color;
    document.body.style.colorScheme = colors.scheme;
  }
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta && document.head) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  if (meta) meta.setAttribute('content', colors.background);
  if (!document.getElementById('sos-a11y') && document.head) {
    const style = document.createElement('style');
    style.id = 'sos-a11y';
    style.textContent =
      '.sos-reduce-motion *, .sos-reduce-motion *::before, .sos-reduce-motion *::after { animation: none !important; transition: none !important; }';
    document.head.appendChild(style);
  }
}
