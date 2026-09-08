import { useState } from 'react';
import { useLocale } from '../contexts/LocaleContext';

export default function LocaleToggle({ className = '' }) {
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
      className={`inline-flex min-h-[56px] rounded-xl border border-neutral-700 bg-black/90 p-1.5 shadow-lg ${className}`}
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
          className={`min-h-[44px] min-w-[72px] rounded-lg px-4 py-2 text-xs font-black uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${locale === option ? 'bg-amber-500 text-black shadow-sm' : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'} disabled:cursor-wait disabled:opacity-60`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}