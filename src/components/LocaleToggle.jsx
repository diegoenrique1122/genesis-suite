import { useState } from 'react';
import { useLocale } from '../contexts/LocaleContext';

export default function LocaleToggle({ className = '', compact = false }) {
  const { locale, setLocale, t } = useLocale();
  const [saving, setSaving] = useState(false);

  const changeLocale = async (nextLocale) => {
    if (saving || nextLocale === locale) return;
    setSaving(true);
    await setLocale(nextLocale);
    setSaving(false);
  };

  return (
    <div
      className={`inline-flex ${compact ? 'min-h-[40px]' : 'min-h-[48px]'} rounded-xl border border-neutral-700 bg-black/90 p-1 shadow-lg ${className}`}
      role="group"
      aria-label={t('language')}
    >
      {['es', 'en'].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => changeLocale(option)}
          disabled={saving}
          aria-pressed={locale === option}
          aria-label={`${t('language')}: ${option.toUpperCase()}`}
          className={`${compact ? 'min-h-[32px] min-w-[48px] px-2.5 py-1.5 text-[10px]' : 'min-h-[40px] min-w-[56px] px-3 py-2 text-[11px]'} rounded-lg font-black uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${locale === option ? 'bg-amber-500 text-black shadow-sm' : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'} disabled:cursor-wait disabled:opacity-60`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}