import { useEffect, useState } from 'react';
import { Check, Globe2, Loader2, Ruler, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useLocale } from '../contexts/LocaleContext';
import { useTheme } from '../contexts/ThemeContext';

const COPY = {
  es: {
    title: 'Ajustes personales',
    description: 'Elige cómo quieres ver Genesis y tus medidas.',
    language: 'Idioma de Genesis',
    units: 'Sistema de medidas',
    metric: 'Métrico',
    metricHint: 'Kilogramos y centimetros',
    imperial: 'Americano',
    imperialHint: 'Libras y pies/pulgadas',
    save: 'Guardar preferencias',
    saved: 'Preferencias guardadas.',
    close: 'Cerrar',
    loadError: 'No se pudieron cargar tus preferencias.',
    saveError: 'No se pudieron guardar tus preferencias.',
  },
  en: {
    title: 'Personal settings',
    description: 'Choose how you want to view Genesis and your measurements.',
    language: 'Genesis language',
    units: 'Measurement system',
    metric: 'Metric',
    metricHint: 'Kilograms and centimeters',
    imperial: 'US customary',
    imperialHint: 'Pounds and feet/inches',
    save: 'Save preferences',
    saved: 'Preferences saved.',
    close: 'Close',
    loadError: 'Your preferences could not be loaded.',
    saveError: 'Your preferences could not be saved.',
  },
};

export default function AthletePreferences({ onClose }) {
  const { locale, setLocale } = useLocale();
  const { theme } = useTheme();
  const brandColor = theme?.brandColor || '#f59e0b';
  const [selectedLocale, setSelectedLocale] = useState(locale);
  const [unitSystem, setUnitSystem] = useState('METRIC');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const labels = COPY[selectedLocale] || COPY.es;

  useEffect(() => {
    let mounted = true;

    const loadPreferences = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;

        const { data, error } = await supabase
          .from('user_preferences')
          .select('preferred_locale, preferred_unit_system')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (error) throw error;

        if (mounted && data) {
          setSelectedLocale(data.preferred_locale || locale);
          setUnitSystem(data.preferred_unit_system || 'METRIC');
        }
      } catch (error) {
        console.error('Genesis athlete preferences:', error);
        if (mounted) setMessage(labels.loadError);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPreferences();
    return () => { mounted = false; };
  }, [locale]);

  const savePreferences = async () => {
    try {
      setSaving(true);
      setMessage('');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('GENESIS_SESSION_REQUIRED');

      const { error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: session.user.id,
            preferred_locale: selectedLocale,
            preferred_unit_system: unitSystem,
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;

      await setLocale(selectedLocale);
      setMessage(labels.saved);
    } catch (error) {
      console.error('Genesis athlete preferences:', error);
      setMessage(labels.saveError);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={labels.title}>
      <section className="w-full max-w-md rounded-3xl border bg-[#111] p-6 shadow-2xl" style={{ borderColor: `${brandColor}66` }}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wide text-white">{labels.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-400">{labels.description}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded-xl border border-neutral-700 text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white" aria-label={labels.close}>
            <X className="mx-auto" size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-40 items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={26} /></div>
        ) : (
          <div className="space-y-6">
            <fieldset>
              <legend className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-300"><Globe2 size={16} style={{ color: brandColor }} />{labels.language}</legend>
              <div className="grid grid-cols-2 gap-3">
                {['es', 'en'].map((option) => (
                  <button key={option} type="button" onClick={() => setSelectedLocale(option)} className={`min-h-[52px] rounded-xl border px-4 text-sm font-black transition-colors ${selectedLocale === option ? 'text-black' : 'border-neutral-700 bg-black text-neutral-300 hover:border-neutral-500 hover:text-white'}`} style={selectedLocale === option ? { borderColor: brandColor, backgroundColor: brandColor } : undefined}>
                    {option === 'es' ? 'Español' : 'English'}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-neutral-300"><Ruler size={16} style={{ color: brandColor }} />{labels.units}</legend>
              <div className="space-y-3">
                {[{ id: 'METRIC', title: labels.metric, hint: labels.metricHint }, { id: 'IMPERIAL', title: labels.imperial, hint: labels.imperialHint }].map((option) => (
                  <button key={option.id} type="button" onClick={() => setUnitSystem(option.id)} className={`flex min-h-[64px] w-full items-center justify-between rounded-xl border px-4 text-left transition-colors ${unitSystem === option.id ? 'bg-black/40' : 'border-neutral-700 bg-black hover:border-neutral-500'}`} style={unitSystem === option.id ? { borderColor: brandColor } : undefined}>
                    <span><span className="block text-sm font-black text-white">{option.title}</span><span className="mt-0.5 block text-xs text-neutral-400">{option.hint}</span></span>
                    {unitSystem === option.id && <Check size={18} style={{ color: brandColor }} />}
                  </button>
                ))}
              </div>
            </fieldset>

            {message && <p className="rounded-xl border border-neutral-700 bg-black px-4 py-3 text-xs text-neutral-300">{message}</p>}

            <button type="button" onClick={savePreferences} disabled={saving} className="flex min-h-[52px] w-full items-center justify-center rounded-xl px-4 text-xs font-black uppercase tracking-widest text-black transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60" style={{ backgroundColor: brandColor }}>
              {saving ? <Loader2 className="animate-spin" size={18} /> : labels.save}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
