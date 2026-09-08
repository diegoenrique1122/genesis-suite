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
    <div className={`inline-flex rounded-lg border border-neutral-800 bg-black p-1 ${className}`} aria-label={t('language')}>
      {['es', 'en'].map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => changeLocale(option)}
          disabled={saving}
          className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-colors ${locale === option ? 'bg-amber-500 text-black' : 'text-neutral-500 hover:text-white'} disabled:opacity-60`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
