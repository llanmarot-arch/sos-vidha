import { EN } from './en.js';
import { HI } from './hi.js';
import { BN } from './bn.js';
import { TE } from './te.js';
import { MR } from './mr.js';
import { TA } from './ta.js';
import { GU } from './gu.js';
import { KN } from './kn.js';
import { ML } from './ml.js';
import { PA } from './pa.js';
import { OR } from './or.js';
import { AS } from './as.js';
import { UR } from './ur.js';

export const LOCALES = [
  { id: 'en', nativeLabel: 'English', dir: 'ltr' },
  { id: 'hi', nativeLabel: 'हिन्दी', dir: 'ltr' },
  { id: 'bn', nativeLabel: 'বাংলা', dir: 'ltr' },
  { id: 'te', nativeLabel: 'తెలుగు', dir: 'ltr' },
  { id: 'mr', nativeLabel: 'मराठी', dir: 'ltr' },
  { id: 'ta', nativeLabel: 'தமிழ்', dir: 'ltr' },
  { id: 'gu', nativeLabel: 'ગુજરાતી', dir: 'ltr' },
  { id: 'kn', nativeLabel: 'ಕನ್ನಡ', dir: 'ltr' },
  { id: 'ml', nativeLabel: 'മലയാളം', dir: 'ltr' },
  { id: 'pa', nativeLabel: 'ਪੰਜਾਬੀ', dir: 'ltr' },
  { id: 'or', nativeLabel: 'ଓଡ଼ିଆ', dir: 'ltr' },
  { id: 'as', nativeLabel: 'অসমীয়া', dir: 'ltr' },
  { id: 'ur', nativeLabel: 'اردو', dir: 'rtl' },
];

export const RAW_CATALOGS = {
  en: EN,
  hi: HI,
  bn: BN,
  te: TE,
  mr: MR,
  ta: TA,
  gu: GU,
  kn: KN,
  ml: ML,
  pa: PA,
  or: OR,
  as: AS,
  ur: UR,
};

const LOCALE_IDS = new Set(LOCALES.map((item) => item.id));

export function sanitizeLocale(value) {
  return LOCALE_IDS.has(value) ? value : 'en';
}

export function missingKeys(partial) {
  return Object.keys(EN).filter((key) => typeof partial?.[key] !== 'string' || partial[key].length === 0);
}

function fill(partial) {
  const out = { ...EN };
  for (const key of Object.keys(EN)) {
    if (typeof partial?.[key] === 'string' && partial[key].length > 0) out[key] = partial[key];
  }
  return out;
}

export const CATALOGS = Object.fromEntries(
  Object.entries(RAW_CATALOGS).map(([id, dict]) => [id, id === 'en' ? EN : fill(dict)])
);

export function localeDirection(locale) {
  const id = sanitizeLocale(locale);
  return LOCALES.find((item) => item.id === id)?.dir || 'ltr';
}

export function translate(locale, key, vars) {
  const lang = CATALOGS[sanitizeLocale(locale)] || EN;
  let text = lang[key] ?? EN[key] ?? key;
  if (vars && typeof text === 'string') {
    for (const [name, value] of Object.entries(vars)) {
      text = text.split(`{${name}}`).join(value == null ? '' : String(value));
    }
  }
  return text;
}
