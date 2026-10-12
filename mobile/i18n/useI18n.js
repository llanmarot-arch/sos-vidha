import { useSettingsStore } from '../store/useSettingsStore';
import { translate } from './translate';

export function useI18n() {
  const locale = useSettingsStore((s) => s.locale || 'en');
  return {
    locale,
    t: (key, vars) => translate(locale, key, vars),
  };
}
