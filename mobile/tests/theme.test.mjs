import test from 'node:test';
import assert from 'node:assert/strict';
import { createTheme } from '../theme/palette.js';
import {
  APPEARANCE_KEY,
  reduceAppearance,
  mergeLoadedAppearance,
  storeAppearance,
  readAppearance,
  themeAfterAccountSave,
  sanitizeAppearance,
  documentColors,
} from '../theme/appearance.js';

test('light and dark palettes differ without a reload', () => {
  const dark = createTheme({ scheme: 'dark', accent: 'logo' });
  const light = createTheme({ scheme: 'light', accent: 'logo' });
  assert.equal(dark.color.bg0, '#0B0B10');
  assert.equal(light.color.bg0, '#F6F3F8');
  assert.equal(dark.color.primary, '#B07CC0');
  assert.equal(light.color.primary, '#6E3E7C');
  assert.notEqual(dark.color.text, light.color.text);
  assert.equal(dark.color.onPrimary, '#16121A');
  assert.equal(light.color.onPrimary, '#FFFFFF');
});

test('logo and white accents stay readable on both schemes', () => {
  const darkWhite = createTheme({ scheme: 'dark', accent: 'white' });
  const lightWhite = createTheme({ scheme: 'light', accent: 'white' });
  const darkLogo = createTheme({ scheme: 'dark', accent: 'logo' });

  assert.equal(darkWhite.color.primary, '#FFFFFF');
  assert.equal(darkWhite.color.onPrimary, '#16121A');
  assert.equal(darkWhite.color.accentOnSurface, '#FFFFFF');
  assert.notEqual(darkLogo.color.primary, darkWhite.color.primary);

  assert.equal(lightWhite.color.primary, '#FFFFFF');
  assert.equal(lightWhite.color.accentOnSurface, '#16121A');
  assert.equal(lightWhite.color.selectedFill, '#16121A');
  assert.equal(lightWhite.color.selectedText, '#FFFFFF');
  assert.equal(lightWhite.color.ghostText, lightWhite.color.text);
  assert.ok(lightWhite.color.primaryBorderWidth > 0);
});

test('choosing a theme updates the palette immediately', () => {
  const current = sanitizeAppearance({ scheme: 'dark', accent: 'logo' });
  const next = reduceAppearance(current, { scheme: 'light', accent: 'white' });
  const theme = createTheme(next);
  assert.equal(next.scheme, 'light');
  assert.equal(next.accent, 'white');
  assert.equal(theme.color.bg0, '#F6F3F8');
  assert.equal(theme.color.selectedFill, '#16121A');
  assert.equal(current.scheme, 'dark');
});

test('saved appearance is what a restart reads when local storage is absent', () => {
  const saved = { scheme: 'light', accent: 'white', highContrast: true, textScale: 1.15, reduceMotion: true };
  const loaded = mergeLoadedAppearance(saved, { scheme: 'dark', accent: 'logo' }, false);
  assert.equal(loaded.scheme, 'light');
  assert.equal(loaded.accent, 'white');
  assert.equal(loaded.highContrast, true);
  assert.equal(loaded.textScale, 1.15);
  assert.equal(loaded.reduceMotion, true);
  assert.equal(createTheme(loaded).color.bg0, '#FFFFFF');
});

test('a first launch with no saved colour follows the device scheme', () => {
  const loaded = mergeLoadedAppearance({}, { scheme: 'light', accent: 'logo' }, false);
  assert.equal(loaded.scheme, 'light');
  assert.equal(documentColors(loaded).background, '#E6E0EA');
  assert.equal(documentColors({ scheme: 'dark' }).background, '#050508');
});

test('an existing local appearance wins over the settings record', () => {
  const loaded = mergeLoadedAppearance(
    { scheme: 'light', accent: 'white' },
    { scheme: 'dark', accent: 'logo', highContrast: false, textScale: 1, reduceMotion: false },
    true
  );
  assert.equal(loaded.scheme, 'dark');
  assert.equal(loaded.accent, 'logo');
});

test('appearance round-trips through storage', () => {
  const memory = new Map();
  global.localStorage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, value),
  };
  storeAppearance({ scheme: 'light', accent: 'white', highContrast: false, textScale: 1.3, reduceMotion: true });
  const stored = JSON.parse(memory.get(APPEARANCE_KEY));
  assert.equal(stored.scheme, 'light');
  assert.equal(stored.accent, 'white');
  assert.deepEqual(readAppearance(), stored);
  delete global.localStorage;
});

test('a failed account save does not change the local theme', () => {
  const chosen = reduceAppearance({ scheme: 'dark', accent: 'logo' }, { scheme: 'light', accent: 'white' });
  assert.deepEqual(themeAfterAccountSave(chosen, false), chosen);
  assert.deepEqual(themeAfterAccountSave(chosen, true), chosen);
  assert.equal(createTheme(themeAfterAccountSave(chosen, false)).scheme, 'light');
});
