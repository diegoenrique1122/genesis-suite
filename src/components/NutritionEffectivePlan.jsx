import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Clock3, Utensils } from 'lucide-react';
import { supabase } from '../supabaseClient';

const LABELS = {
  EFFECTIVE: ['Plan vigente', 'text-emerald-300', CheckCircle2],
  NO_PLAN: ['Tu coach aún no ha creado un plan nutricional.', 'text-neutral-300', Utensils],
  NO_SELECTION: ['Tu coach todavía no ha seleccionado una versión aprobada.', 'text-neutral-300', Clock3],
  VERSION_SCHEDULED: ['Tu plan está programado y aparecerá cuando comience su vigencia.', 'text-sky-300', CalendarClock],
  VERSION_EXPIRED: ['La vigencia de la versión seleccionada terminó. Consulta con tu coach.', 'text-amber-300', Clock3],
  NO_MEALS_FOR_DAY: ['El plan está vigente, pero no contiene comidas para este tipo de día.', 'text-amber-300', AlertCircle],
  PROGRAM_SCHEDULED: ['Tu programa todavía no ha comenzado.', 'text-sky-300', CalendarClock],
  PROGRAM_EXPIRED: ['El periodo de tu programa terminó.', 'text-amber-300', Clock3],
  PROGRAM_PAUSED: ['Tu programa está pausado. Consulta con tu coach.', 'text-amber-300', Clock3],
  PROGRAM_CANCELLED: ['Este programa fue cancelado.', 'text-neutral-300', AlertCircle],
  PROGRAM_PENDING: ['Tu programa está pendiente de activación.', 'text-sky-300', Clock3],
  PROGRAM_UNAVAILABLE: ['No se puede confirmar la vigencia del programa.', 'text-amber-300', AlertCircle],
  PROGRAM_NOT_NUTRITION: ['El programa actual no incluye nutrición.', 'text-neutral-300', Utensils],
};

const number = (value) => value == null ? '—' : new Intl.NumberFormat('es-US', { maximumFractionDigits: 1 }).format(Number(value));

export default function NutritionEffectivePlan({ athleteId }) {
  const [dayType, setDayType] = useState('EVERY_DAY');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: program, error: programError } = await supabase
        .from('athlete_programs')
        .select('id, service_focus')
        .eq('athlete_id', athleteId)
        .in('service_focus', ['NUTRITION', 'BOTH'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (programError) throw programError;
      if (!program) {
        setResult({ state: 'NO_PLAN' });
        return;
      }
      const { data, error: rpcError } = await supabase.rpc('genesis_get_effective_nutrition_plan', {
        p_program_id: program.id,
        p_day_type: dayType,
      });
      if (rpcError) throw rpcError;
      setResult(data);
    } catch (loadError) {
      console.error('Genesis effective nutrition read:', loadError);
      setError('No pudimos cargar el plan nutricional. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  }, [athleteId, dayType]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void load();
    });
    return () => { active = false; };
  }, [load]);

  const state = result?.state;
  const [message, color, Icon] = LABELS[state] || ['Estado nutricional no disponible.', 'text-neutral-300', AlertCircle];
  const plan = result?.effective_plan;

  return (
    <section className="rounded-3xl border border-emerald-500/20 bg-[#111] p-6 shadow-xl" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-white">
            <Utensils size={18} className="text-emerald-400" /> Plan nutricional aprobado
          </h2>
          <p className="mt-2 text-xs text-neutral-400">Información del programa y versión seleccionados por tu coach.</p>
        </div>
        <label className="text-xs text-neutral-400">
          Tipo de día
          <select value={dayType} onChange={(event) => setDayType(event.target.value)} className="ml-2 rounded-lg border border-neutral-700 bg-black px-2 py-2 text-white">
            <option value="EVERY_DAY">Diario</option>
            <option value="TRAINING_DAY">Entrenamiento</option>
            <option value="REST_DAY">Descanso</option>
          </select>
        </label>
      </div>

      {loading ? <p role="status" className="mt-5 text-sm text-neutral-400">Cargando plan…</p> : null}
      {!loading && error ? (
        <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
          <span>{error}</span><button type="button" onClick={() => void load()} className="rounded-lg border border-amber-500/30 px-3 py-2 font-bold">Reintentar</button>
        </div>
      ) : null}
      {!loading && !error && !plan ? (
        <div className={`mt-5 flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-4 text-sm ${color}`}>
          <Icon size={18} aria-hidden="true" /><p>{message}</p>
        </div>
      ) : null}

      {!loading && !error && plan ? (
        <div className="mt-5 space-y-5">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-emerald-300"><CheckCircle2 size={15} /> {message}</p>
            <h3 className="mt-2 text-lg font-black text-white">{plan.title}</h3>
            <p className="mt-1 text-xs text-neutral-400">Versión {plan.version_number} · Fecha local: {plan.local_date} · {plan.time_zone}</p>
            {plan.plan_note ? <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-300">{plan.plan_note}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Calorías', plan.target_calories_kcal, 'kcal'],
              ['Proteína', plan.target_protein_g, 'g'],
              ['Carbohidratos', plan.target_carbs_g, 'g'],
              ['Grasas', plan.target_fat_g, 'g'],
            ].map(([label, value, unit]) => (
              <div key={label} className="rounded-xl border border-neutral-800 bg-black/40 p-3 text-center">
                <span className="block text-[10px] font-bold uppercase tracking-wide text-neutral-500">{label}</span>
                <span className="mt-1 block font-mono text-lg font-black text-white">{number(value)} <small className="text-[10px] text-neutral-500">{unit}</small></span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {(plan.meals || []).map((meal) => (
              <article key={meal.id} className="rounded-xl border border-neutral-800 bg-black/30 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="font-bold text-white">{meal.meal_number}. {meal.title}</h4>
                  <span className="text-xs text-neutral-500">{meal.local_time || 'Hora no especificada'}</span>
                </div>
                {meal.instructions ? <p className="mt-2 text-xs text-neutral-400">{meal.instructions}</p> : null}
                <ul className="mt-3 space-y-2">
                  {(meal.items || []).map((item) => (
                    <li key={item.id} className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-white/5 pt-2 text-sm">
                      <span className="text-neutral-200">{item.food_name}{item.preparation ? ` · ${item.preparation}` : ''}</span>
                      <span className="text-neutral-400">{number(item.quantity)} {item.quantity_unit}{item.portion_description ? ` · ${item.portion_description}` : ''}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
