import test from 'node:test';
import assert from 'node:assert/strict';
import { EN } from '../i18n/en.js';
import { LOCALES, RAW_CATALOGS, missingKeys, sanitizeLocale, translate, localeDirection } from '../i18n/translate.js';

test('every Indian language has the same strings as English', () => {
  assert.equal(LOCALES.length, 13);
  for (const locale of LOCALES) {
    const missing = missingKeys(RAW_CATALOGS[locale.id]);
    assert.deepEqual(missing, [], `${locale.id} is missing ${missing.join(', ')}`);
    if (locale.id === 'en') continue;
    for (const key of Object.keys(EN)) {
      assert.notEqual(RAW_CATALOGS[locale.id][key], EN[key], `${locale.id} left ${key} in English`);
    }
  }
});

test('unknown languages fall back to English and placeholders are filled', () => {
  assert.equal(sanitizeLocale('zz'), 'en');
  assert.equal(translate('zz', 'nav.home'), 'Home');
  assert.equal(translate('hi', 'nav.home'), 'होम');
  assert.equal(translate('hi', 'status.readyMany', { count: 3 }), '3 आपातकालीन संपर्क अलर्ट के लिए तैयार हैं।');
  assert.equal(localeDirection('ur'), 'rtl');
  assert.equal(localeDirection('hi'), 'ltr');
});
