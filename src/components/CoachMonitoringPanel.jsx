import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Droplet,
  Footprints,
  HeartPulse,
  Loader2,
  Moon,
  Utensils,
  Watch,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { createEvidenceSignedUrl } from '../services/evidenceStorageService';

const STATUS_LABELS = {
  YES: 'Cumplido',
  PARTIAL: 'A medias',
  NO: 'Falló',
  PENDING: 'Pendiente',
};

const statusClass = (status) => {
  if (status === 'YES') return 'text-green-400 border-green-900/40 bg-green-500/10';
  if (status === 'PARTIAL') return 'text-yellow-400 border-yellow-900/40 bg-yellow-500/10';
  if (status === 'NO') return 'text-red-400 border-red-900/40 bg-red-500/10';
  return 'text-neutral-400 border-neutral-800 bg-neutral-900';
};

const displayDate = (dateKey) => {
  if (!dateKey || typeof dateKey !== 'string') return 'Sin fecha';
  const [year, month, day] = dateKey.split('-');
  if (!year || !month || !day) return dateKey;
  return `${month}/${day}/${year}`;
};

const valueOrDash = (value, suffix = '') => (
  value === null || value === undefined || value === ''
    ? '—'
    : `${value}${suffix}`
);

const mealEvidenceSource = (meal) => (
  meal?.photo_path ||
  meal?.photo_url ||
  null
);
const parseManualRow = (row) => {
  const payload = row?.habits_data;
  if (!payload || payload.source !== 'MANUAL_DISCIPLINE') return null;

  const meals = Array.isArray(payload.meals) ? payload.meals : [];
  const mealCounts = meals.reduce(
    (acc, meal) => {
      const status = String(meal?.status || 'PENDING').toUpperCase();
      if (Object.prototype.hasOwnProperty.call(acc, status)) acc[status] += 1;
      return acc;
    },
    { YES: 0, PARTIAL: 0, NO: 0, PENDING: 0 },
  );

  return {
    logDate: row.log_date,
    complianceScore: row.compliance_score,
    timeZone: payload.time_zone || null,
    water: payload.metrics?.water ?? null,
    sleep: payload.metrics?.sleep ?? null,
    steps: payload.metrics?.steps ?? null,
    training: payload.training?.completed ?? null,
    difficultyNote: payload.training?.difficulty_note || '',
    meals,
    mealCounts,
  };
};

export default function CoachMonitoringPanel({ athlete }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [manualRows, setManualRows] = useState([]);
  const [wearableRows, setWearableRows] = useState([]);
  const [mealEvidenceUrls, setMealEvidenceUrls] = useState({});
  const [mealEvidenceErrors, setMealEvidenceErrors] = useState({});
  const [mealEvidenceSigning, setMealEvidenceSigning] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadMonitoring = async () => {
      if (!athlete?.id || !athlete?.user_id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [disciplineResult, wearableResult] = await Promise.all([
          supabase
            .from('daily_logs')
            .select('log_date, compliance_score, habits_data, created_at')
            .eq('user_id', athlete.user_id)
            .order('log_date', { ascending: false })
            .limit(7),
          supabase
            .from('athlete_daily_metrics')
            .select('date, steps, sleep_hours, hrv, rhr, created_at')
            .eq('athlete_id', athlete.id)
            .order('date', { ascending: false })
            .limit(7),
        ]);

        if (disciplineResult.error) throw disciplineResult.error;
        if (wearableResult.error) throw wearableResult.error;

        const parsedManual = (disciplineResult.data || [])
          .map(parseManualRow)
          .filter(Boolean);

        if (!cancelled) {
          setManualRows(parsedManual);
          setWearableRows(wearableResult.data || []);
        }
      } catch (loadError) {
        console.error('Genesis coach monitoring load:', loadError);
        if (!cancelled) {
          setError(loadError?.message || 'No fue posible cargar el seguimiento del atleta.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMonitoring();

    return () => {
      cancelled = true;
    };
  }, [athlete?.id, athlete?.user_id]);

  const latestManual = manualRows[0] || null;
  const latestWearable = wearableRows[0] || null;
  useEffect(() => {
    let cancelled = false;

    const signLatestMealEvidence = async () => {
      const evidenceMeals =
        (latestManual?.meals || []).filter(
          (meal) => mealEvidenceSource(meal)
        );

      setMealEvidenceUrls({});
      setMealEvidenceErrors({});

      if (evidenceMeals.length === 0) {
        setMealEvidenceSigning(false);
        return;
      }

      setMealEvidenceSigning(true);

      const results = await Promise.all(
        evidenceMeals.map(async (meal) => {
          const key = String(meal.meal_num);

          try {
            const result =
              await createEvidenceSignedUrl(
                mealEvidenceSource(meal)
              );

            return {
              key,
              signedUrl: result.signedUrl,
              error: ''
            };

          } catch (error) {
            console.error(
              'Genesis coach meal signed URL:',
              error
            );

            return {
              key,
              signedUrl: null,
              error:
                error?.message ||
                'Evidencia no disponible.'
            };
          }
        })
      );

      if (!cancelled) {
        const urls = {};
        const errors = {};

        results.forEach((result) => {
          if (result.signedUrl) {
            urls[result.key] =
              result.signedUrl;
          }

          if (result.error) {
            errors[result.key] =
              result.error;
          }
        });

        setMealEvidenceUrls(urls);
        setMealEvidenceErrors(errors);
        setMealEvidenceSigning(false);
      }
    };

    signLatestMealEvidence();

    return () => {
      cancelled = true;
    };
  }, [latestManual]);

  const manualSummary = useMemo(() => ({
    days: manualRows.length,
    evaluatedComplianceDays: manualRows.filter(
      (row) => row.complianceScore !== null && row.complianceScore !== undefined,
    ).length,
  }), [manualRows]);

  if (loading) {
    return (
      <div className="bg-[#111] border border-neutral-800 p-8 rounded-3xl flex items-center justify-center gap-3 text-neutral-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-xs font-mono">Cargando seguimiento canónico...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-3xl">
        <div className="flex items-center gap-2 text-red-400 font-black uppercase text-xs tracking-widest mb-2">
          <AlertTriangle size={16} /> Error de seguimiento
        </div>
        <p className="text-xs font-mono text-red-200/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#111] border border-neutral-800 p-6 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xs font-black uppercase text-neutral-300 flex items-center gap-2">
              <Activity size={16} className="text-amber-500" /> Seguimiento de Disciplina
            </h2>
            <p className="text-[10px] text-neutral-500 font-mono mt-1">
              Fuente: daily_logs · auto-reporte manual del atleta · últimos 7 registros
            </p>
          </div>
          <div className="flex gap-2 text-[9px] font-black uppercase tracking-widest">
            <span className="px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300">
              {manualSummary.days} día(s) reportados
            </span>
            <span className="px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400">
              Compliance evaluado: {manualSummary.evaluatedComplianceDays}
            </span>
          </div>
        </div>

        {latestManual ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">
                Último check-in: {displayDate(latestManual.logDate)}
              </span>
              {latestManual.timeZone && (
                <span className="text-[9px] font-mono text-neutral-500 border border-neutral-800 rounded-full px-2 py-1">
                  {latestManual.timeZone}
                </span>
              )}
              <span className="text-[9px] font-mono text-neutral-500 border border-neutral-800 rounded-full px-2 py-1">
                Cumplimiento formal: {latestManual.complianceScore === null || latestManual.complianceScore === undefined
                  ? 'No evaluado'
                  : `${latestManual.complianceScore}%`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-black border border-neutral-800 rounded-2xl p-4">
                <Droplet size={18} className="text-blue-400 mb-3" />
                <span className="text-xl font-black font-mono block text-white">{valueOrDash(latestManual.water, ' L')}</span>
                <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Agua reportada</span>
              </div>
              <div className="bg-black border border-neutral-800 rounded-2xl p-4">
                <Moon size={18} className="text-purple-400 mb-3" />
                <span className="text-xl font-black font-mono block text-white">{valueOrDash(latestManual.sleep, ' h')}</span>
                <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Sueño reportado</span>
              </div>
              <div className="bg-black border border-neutral-800 rounded-2xl p-4">
                <Footprints size={18} className="text-green-400 mb-3" />
                <span className="text-xl font-black font-mono block text-white">{valueOrDash(latestManual.steps)}</span>
                <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Pasos reportados</span>
              </div>
              <div className="bg-black border border-neutral-800 rounded-2xl p-4">
                <Activity size={18} className="text-amber-400 mb-3" />
                <span className={`inline-flex text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border ${statusClass(latestManual.training)}`}>
                  {STATUS_LABELS[latestManual.training] || 'Sin reporte'}
                </span>
                <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500 block mt-3">Entrenamiento reportado</span>
              </div>
            </div>

            {latestManual.difficultyNote && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4">
                <span className="text-[9px] uppercase font-black tracking-widest text-yellow-500 block mb-2">
                  Nota de dificultad del atleta
                </span>
                <p className="text-xs text-yellow-100/80 font-mono">{latestManual.difficultyNote}</p>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Utensils size={14} className="text-neutral-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Comidas del último check-in</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {latestManual.meals.map((meal, index) => (
                  <div key={meal?.meal_num ?? index} className="bg-black border border-neutral-800 rounded-xl p-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 block mb-2">
                      Comida {meal?.meal_num ?? index + 1}
                    </span>
                    <span className={`inline-flex text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${statusClass(meal?.status)}`}>
                      {STATUS_LABELS[meal?.status] || 'Sin estado'}
                    </span>
                    {mealEvidenceSource(meal) && (
                      <button
                        type="button"
                        disabled={
                          !mealEvidenceUrls[
                            String(meal?.meal_num ?? index + 1)
                          ]
                        }
                        onClick={() => {
                          const signedUrl =
                            mealEvidenceUrls[
                              String(meal?.meal_num ?? index + 1)
                            ];

                          if (signedUrl) {
                            window.open(
                              signedUrl,
                              '_blank',
                              'noopener,noreferrer'
                            );
                          }
                        }}
                        title={
                          mealEvidenceErrors[
                            String(meal?.meal_num ?? index + 1)
                          ] || ''
                        }
                        className="text-[9px] font-mono text-blue-400 hover:text-blue-300 disabled:text-neutral-600 disabled:cursor-not-allowed block mt-3"
                      >
                        {mealEvidenceUrls[
                          String(meal?.meal_num ?? index + 1)
                        ]
                          ? 'Ver evidencia'
                          : mealEvidenceSigning
                            ? 'Autorizando...'
                            : 'Evidencia no disponible'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-5">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-3">Histórico manual reciente</h3>
              <div className="space-y-2">
                {manualRows.map((row) => (
                  <div key={row.logDate} className="bg-black/60 border border-neutral-800 rounded-xl p-3 grid grid-cols-2 md:grid-cols-6 gap-2 items-center text-[10px] font-mono">
                    <span className="text-white font-bold">{displayDate(row.logDate)}</span>
                    <span className="text-neutral-400">Agua {valueOrDash(row.water, 'L')}</span>
                    <span className="text-neutral-400">Sueño {valueOrDash(row.sleep, 'h')}</span>
                    <span className="text-neutral-400">Pasos {valueOrDash(row.steps)}</span>
                    <span className={statusClass(row.training).split(' ')[0]}>Entreno {STATUS_LABELS[row.training] || '—'}</span>
                    <span className="text-neutral-500">
                      Comidas ✓{row.mealCounts.YES} / ½{row.mealCounts.PARTIAL} / ✕{row.mealCounts.NO}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center border-2 border-dashed border-neutral-800 rounded-2xl">
            <p className="text-xs font-mono text-neutral-500">Sin check-ins manuales en daily_logs.</p>
          </div>
        )}
      </div>

      <div className="bg-[#111] border border-blue-900/30 p-6 rounded-3xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xs font-black uppercase text-neutral-300 flex items-center gap-2">
              <Watch size={16} className="text-blue-400" /> Telemetría Wearable
            </h2>
            <p className="text-[10px] text-neutral-500 font-mono mt-1">
              Fuente: athlete_daily_metrics · nunca fusionada con auto-reporte manual
            </p>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-900/40 text-blue-300 w-fit">
            {wearableRows.length} día(s) con telemetría
          </span>
        </div>

        {latestWearable ? (
          <div className="space-y-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-white">
              Última telemetría: {displayDate(latestWearable.date)}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-black border border-neutral-800 rounded-2xl p-4">
                <Footprints size={18} className="text-green-400 mb-2" />
                <span className="text-lg font-black font-mono text-white block">{valueOrDash(latestWearable.steps)}</span>
                <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Pasos wearable</span>
              </div>
              <div className="bg-black border border-neutral-800 rounded-2xl p-4">
                <Moon size={18} className="text-purple-400 mb-2" />
                <span className="text-lg font-black font-mono text-white block">{valueOrDash(latestWearable.sleep_hours, ' h')}</span>
                <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Sueño wearable</span>
              </div>
              <div className="bg-black border border-neutral-800 rounded-2xl p-4">
                <Activity size={18} className="text-blue-400 mb-2" />
                <span className="text-lg font-black font-mono text-white block">{valueOrDash(latestWearable.hrv, ' ms')}</span>
                <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">HRV</span>
              </div>
              <div className="bg-black border border-neutral-800 rounded-2xl p-4">
                <HeartPulse size={18} className="text-red-400 mb-2" />
                <span className="text-lg font-black font-mono text-white block">{valueOrDash(latestWearable.rhr, ' bpm')}</span>
                <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">RHR</span>
              </div>
            </div>

            <div className="space-y-2 border-t border-neutral-800 pt-5">
              {wearableRows.map((row) => (
                <div key={row.date} className="bg-black/60 border border-neutral-800 rounded-xl p-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-[10px] font-mono">
                  <span className="text-white font-bold">{displayDate(row.date)}</span>
                  <span className="text-neutral-400">Pasos {valueOrDash(row.steps)}</span>
                  <span className="text-neutral-400">Sueño {valueOrDash(row.sleep_hours, 'h')}</span>
                  <span className="text-neutral-400">HRV {valueOrDash(row.hrv, 'ms')}</span>
                  <span className="text-neutral-400">RHR {valueOrDash(row.rhr, 'bpm')}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-10 text-center border-2 border-dashed border-blue-900/20 rounded-2xl">
            <p className="text-xs font-mono text-neutral-500">Sin telemetría wearable registrada.</p>
          </div>
        )}
      </div>
    </div>
  );
}
