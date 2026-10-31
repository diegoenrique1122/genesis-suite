import { useId, useState } from 'react';
import { useLocale } from '../contexts/LocaleContext';

const COPY = {
  es: {
    title: 'Próximas aplicaciones',
    status: 'En desarrollo',
    action: 'Ver estado',
    message: 'Estamos trabajando en esta aplicación. Aún no permite crear planes ni registrar sesiones. Tus aplicaciones actuales siguen disponibles.',
    close: 'Cerrar aviso',
    running: 'Running',
    triathlon: 'Triatlón / Ironman',
  },
  en: {
    title: 'Upcoming applications',
    status: 'In development',
    action: 'View status',
    message: 'We are working on this application. Plans and session logging are not available yet. Your current applications remain available.',
    close: 'Close notice',
    running: 'Running',
    triathlon: 'Triathlon / Ironman',
  },
};

export default function UpcomingSports() {
  const { locale } = useLocale();
  const text = COPY[locale] || COPY.es;
  const [selected, setSelected] = useState(null);
  const id = useId();
  const sports = [
    { id: 'running', label: text.running },
    { id: 'triathlon', label: text.triathlon },
  ];

  return (
    <section className="rounded-2xl border border-current/15 p-5" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-sm font-bold">{text.title}</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {sports.map((sport) => (
          <button
            key={sport.id}
            type="button"
            onClick={() => setSelected(sport.id)}
            aria-expanded={selected === sport.id}
            aria-controls={`${id}-${sport.id}`}
            className="rounded-xl border border-current/20 p-4 text-left transition hover:bg-current/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{sport.label}</span>
              <span className="rounded-full border border-current/20 px-2 py-1 text-[10px] font-bold uppercase tracking-wide">{text.status}</span>
            </span>
            <span className="mt-2 block text-xs opacity-70">{text.action}</span>
          </button>
        ))}
      </div>
      {sports.map((sport) => (
        <div id={`${id}-${sport.id}`} key={sport.id} hidden={selected !== sport.id} className="mt-4 rounded-xl border border-current/15 p-4">
          {selected === sport.id ? (
            <>
              <p role="status" className="text-sm leading-relaxed"><strong>{sport.label}: {text.status}.</strong> {text.message}</p>
              <button type="button" onClick={() => setSelected(null)} className="mt-3 rounded-lg border border-current/25 px-3 py-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">{text.close}</button>
            </>
          ) : null}
        </div>
      ))}
    </section>
  );
}
