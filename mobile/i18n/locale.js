import { localeDirection, sanitizeLocale } from './translate';

export const LOCALE_KEY = 'sosvidha.locale';

export function readLocale() {
  try {
    if (typeof localStorage === 'undefined') return 'en';
    const raw = localStorage.getItem(LOCALE_KEY);
    return raw ? sanitizeLocale(raw) : 'en';
  } catch {
    return 'en';
  }
}

export function hasStoredLocale() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LOCALE_KEY) != null;
  } catch {
    return false;
  }
}

export function storeLocale(locale) {
  const next = sanitizeLocale(locale);
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LOCALE_KEY, next);
  } catch {
    /* the in-memory setting still updates */
  }
  return next;
}

/** Web layout follows the language immediately, including right-to-left Urdu. */
export function applyDocumentLocale(locale) {
  const next = sanitizeLocale(locale);
  if (typeof document === 'undefined') return next;
  document.documentElement.lang = next;
  document.documentElement.dir = localeDirection(next);
  return next;
}

export function resolveLoadedLocale(savedLocale, localPresent) {
  if (localPresent) return readLocale();
  return sanitizeLocale(savedLocale);
}
