import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { uploadAthletePhoto } from '../services/storageService';
import {
  ArrowLeft, Droplet, Moon, Footprints, Camera,
  CheckCircle2, AlertTriangle, Loader2, Calendar, Scale, Save,
  ChevronDown, ChevronUp, Activity, Utensils, Image as ImageIcon
} from 'lucide-react';

const buildEmptyMeals = () => [1, 2, 3, 4, 5].map((mealNum) => ({
  meal_num: mealNum,
  status: 'PENDING',
  photo_url: null
}));

const pad2 = (value) => String(value).padStart(2, '0');

const getLocalDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const getLocalTimeZone = () => (
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
);

export default function MonitoreoDisciplina() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState(null);

  // Métricas Diarias (auto-reporte manual, separado de wearables)
  const [water, setWater] = useState('');
  const [sleep, setSleep] = useState('');
  const [steps, setSteps] = useState('');
  const [trainingDone, setTrainingDone] = useState('YES');
  const [difficultyNote, setDifficultyNote] = useState('');

  // 🍎 EVIDENCIA NUTRICIONAL
  const [meals, setMeals] = useState(buildEmptyMeals);
  const [uploadingMeal, setUploadingMeal] = useState(false);

  // Variables del Foto Informe (Acordeón)
  const [showPhotoPanel, setShowPhotoPanel] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(1);
  const [weight, setWeight] = useState('');
  const [frontFile, setFrontFile] = useState(null);
  const [sideFile, setSideFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [uploadingCheckIn, setUploadingCheckIn] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const hydrateDailyCheckin = (payload) => {
    if (!payload || typeof payload !== 'object') {
      setWater('');
      setSleep('');
      setSteps('');
      setTrainingDone('YES');
      setDifficultyNote('');
      setMeals(buildEmptyMeals());
      return;
    }

    const metrics = payload.metrics || {};
    const training = payload.training || {};

    setWater(metrics.water ?? '');
    setSleep(metrics.sleep ?? '');
    setSteps(metrics.steps ?? '');
    setTrainingDone(training.completed || 'YES');
    setDifficultyNote(training.difficulty_note || '');

    const savedMeals = Array.isArray(payload.meals) ? payload.meals : [];
    const mergedMeals = buildEmptyMeals().map((emptyMeal) => {
      const found = savedMeals.find((meal) => Number(meal.meal_num) === emptyMeal.meal_num);
      return found ? { ...emptyMeal, ...found } : emptyMeal;
    });

    setMeals(mergedMeals);
  };

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const today = getLocalDate();

      const [profileResult, dailyLogResult] = await Promise.all([
        supabase
          .from('athletes_profile')
          .select('*')
          .eq('user_id', session.user.id)
          .single(),
        supabase
          .from('daily_logs')
          .select('log_date, habits_data')
          .eq('user_id', session.user.id)
          .eq('log_date', today)
          .maybeSingle()
      ]);

      if (profileResult.error) throw profileResult.error;
      if (dailyLogResult.error) throw dailyLogResult.error;

      const profile = profileResult.data;

      if (!profile) {
        throw new Error('No se encontró el perfil de atleta.');
      }

      setAthlete(profile);

      // Calcular en qué semana va
      if (profile.program_start_date) {
        const start = new Date(profile.program_start_date);
        const diffDays = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));
        const week = Math.floor(diffDays / 7) + 1;
        setCurrentWeek(week > 0 ? week : 1);
      }

      // La pantalla representa HOY en la zona local del dispositivo.
      hydrateDailyCheckin(dailyLogResult.data?.habits_data || null);
    } catch (error) {
      console.error('Error cargando disciplina:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🍎 FUNCIÓN PARA SUBIR FOTO DE COMIDA
  const handleMealPhotoUpload = async (e, mealNum) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingMeal(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `meal_${mealNum}_${Date.now()}.${fileExt}`;
      const filePath = `${athlete.id}/daily_meals/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('athlete_evidence')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('athlete_evidence').getPublicUrl(filePath);

      const newMeals = meals.map((meal) =>
        meal.meal_num === mealNum
          ? { ...meal, photo_url: data.publicUrl, status: 'YES' }
          : meal
      );
      setMeals(newMeals);
    } catch (error) {
      alert('❌ Error subiendo foto de comida: ' + error.message);
    } finally {
      setUploadingMeal(false);
    }
  };

  const handleMealStatus = (mealNum, status) => {
    setMeals(meals.map((meal) =>
      meal.meal_num === mealNum ? { ...meal, status } : meal
    ));
  };

  const handleSaveDailyMetrics = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        time_zone: getLocalTimeZone(),
        metrics: { water, sleep, steps },
        training: {
          completed: trainingDone,
          difficulty_note: difficultyNote
        },
        meals
      };

      const { data, error } = await supabase.rpc(
        'save_daily_discipline_checkin',
        { p_payload: payload }
      );

      if (error) throw error;

      const saved = Array.isArray(data) ? data[0] : data;

      if (saved?.saved_payload) {
        hydrateDailyCheckin(saved.saved_payload);
        setAthlete((current) => current
          ? { ...current, discipline_metrics: saved.saved_payload }
          : current
        );
      }

      alert('✅ Auditoría Diaria guardada exitosamente.');
    } catch (err) {
      console.error('Error guardando disciplina:', err);
      alert('❌ Error guardando métricas: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoReportSubmit = async (e) => {
    e.preventDefault();
    if (!frontFile || !sideFile || !backFile || !weight) {
      return alert('⚠️ Faltan fotos o el peso para completar el Informe Fotográfico.');
    }

    setUploadingCheckIn(true);
    try {
      if (frontFile) await uploadAthletePhoto(frontFile, athlete.id, athlete.coach_id, 'front', currentWeek, weight);
      if (sideFile) await uploadAthletePhoto(sideFile, athlete.id, athlete.coach_id, 'side', currentWeek, weight);
      if (backFile) await uploadAthletePhoto(backFile, athlete.id, athlete.coach_id, 'back', currentWeek, weight);

      alert('✅ Informe Fotográfico enviado exitosamente. Tu Coach ha recibido tu actualización.');
      setFrontFile(null);
      setSideFile(null);
      setBackFile(null);
      setWeight('');
      setShowPhotoPanel(false);
    } catch (err) {
      alert('❌ Error enviando informe: ' + err.message);
    } finally {
      setUploadingCheckIn(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={40}/>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 relative overflow-hidden">

      {/* Fondo Neón Dinámico */}
      <div className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none z-0" style={{ background: `linear-gradient(180deg, ${theme?.brandColor || '#f59e0b'} 0%, transparent 100%)` }}></div>

      {/* NAVBAR */}
      <nav className="relative z-10 border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/client')} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={16} /> Volver al Portal
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 relative z-10 space-y-8">

        {/* ENCABEZADO */}
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <Activity style={{ color: theme?.brandColor || '#f59e0b' }} size={28}/>
            Auditoría de Disciplina
          </h1>
          <p className="text-xs text-neutral-400 font-mono mt-2">Semana de Protocolo: <strong className="text-white">{currentWeek} de 12</strong></p>
        </div>

        {/* 📸 FOTO INFORME (ACORDEÓN DESPLEGABLE) */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl shadow-xl transition-all duration-300">
          <div
            onClick={() => setShowPhotoPanel(!showPhotoPanel)}
            className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors rounded-3xl"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/30 shrink-0">
                <Camera className="text-amber-500" size={24}/>
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white">Foto Informe para Coach</h2>
                <p className="text-[10px] font-mono text-neutral-400 mt-1">Despliega este panel solo cuando tu Coach te solicite el informe visual corporal.</p>
              </div>
            </div>
            {showPhotoPanel ? <ChevronUp className="text-neutral-500" /> : <ChevronDown className="text-neutral-500" />}
          </div>

          {showPhotoPanel && (
            <div className="p-6 pt-0 animate-in fade-in slide-in-from-top-4 duration-300 border-t border-neutral-800/50 mt-2">
              <form onSubmit={handlePhotoReportSubmit} className="space-y-6 pt-6">
                <div className="bg-black/50 border border-neutral-800 rounded-2xl p-4 w-1/2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-amber-500/70 block mb-2 flex items-center gap-2"><Scale size={14}/> Peso Actual (KG)</label>
                  <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required placeholder="Ej: 72.5" className="w-full bg-transparent border-b border-amber-500/30 text-white font-mono text-xl outline-none focus:border-amber-500 pb-1 transition-colors"/>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-black/50 border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase text-neutral-400 mb-2">1. Frente</span>
                    <label className={`w-full aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${frontFile ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-700 hover:border-amber-500'}`}>
                      {frontFile ? <CheckCircle2 size={24} className="text-amber-500" /> : <Camera size={20} className="text-neutral-600" />}
                      <input type="file" accept="image/*" onChange={(e) => setFrontFile(e.target.files[0])} className="hidden" />
                    </label>
                  </div>
                  <div className="bg-black/50 border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase text-neutral-400 mb-2">2. Perfil</span>
                    <label className={`w-full aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${sideFile ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-700 hover:border-amber-500'}`}>
                      {sideFile ? <CheckCircle2 size={24} className="text-amber-500" /> : <Camera size={20} className="text-neutral-600" />}
                      <input type="file" accept="image/*" onChange={(e) => setSideFile(e.target.files[0])} className="hidden" />
                    </label>
                  </div>
                  <div className="bg-black/50 border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center">
                    <span className="text-[9px] font-black uppercase text-neutral-400 mb-2">3. Espalda</span>
                    <label className={`w-full aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${backFile ? 'border-amber-500 bg-amber-500/10' : 'border-neutral-700 hover:border-amber-500'}`}>
                      {backFile ? <CheckCircle2 size={24} className="text-amber-500" /> : <Camera size={20} className="text-neutral-600" />}
                      <input type="file" accept="image/*" onChange={(e) => setBackFile(e.target.files[0])} className="hidden" />
                    </label>
                  </div>
                </div>

                <button type="submit" disabled={uploadingCheckIn || !frontFile || !sideFile || !backFile || !weight} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-[11px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-40 flex items-center justify-center gap-2">
                  {uploadingCheckIn ? <Loader2 size={16} className="animate-spin"/> : <><CheckCircle2 size={16}/> Enviar Expediente a mi Coach</>}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* 🍎 EVIDENCIA NUTRICIONAL (COMIDAS) */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl relative backdrop-blur-md">
          <h2 className="text-sm font-black uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2">
            <Utensils size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Evidencia Nutricional
          </h2>

          <div className="space-y-4">
            {meals.map((meal) => (
              <div key={meal.meal_num} className="bg-black border border-neutral-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4">

                <div className="flex-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-white mb-1">Comida {meal.meal_num}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono">Sube la foto de tu plato antes de ingerirlo.</p>
                </div>

                <div className="flex items-center gap-4">
                  <label className={`w-14 h-14 rounded-xl border border-dashed flex items-center justify-center cursor-pointer transition-colors shrink-0 overflow-hidden ${meal.photo_url ? 'border-green-500 bg-green-500/10' : 'border-neutral-600 bg-neutral-900 hover:border-white'}`}>
                    {uploadingMeal ? <Loader2 size={16} className="animate-spin text-neutral-500" /> :
                     meal.photo_url ? <img src={meal.photo_url} alt="Meal" className="w-full h-full object-cover" /> :
                     <ImageIcon size={16} className="text-neutral-500" />}
                    <input type="file" accept="image/*" onChange={(e) => handleMealPhotoUpload(e, meal.meal_num)} className="hidden" disabled={uploadingMeal} />
                  </label>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button type="button" onClick={() => handleMealStatus(meal.meal_num, 'YES')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${meal.status === 'YES' ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>Cumplí</button>
                    <button type="button" onClick={() => handleMealStatus(meal.meal_num, 'PARTIAL')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${meal.status === 'PARTIAL' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>A Medias</button>
                    <button type="button" onClick={() => handleMealStatus(meal.meal_num, 'NO')} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${meal.status === 'NO' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>Fallé</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 📊 FORMULARIO DIARIO (PASOS, AGUA, SUEÑO) */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl relative backdrop-blur-md">
          <h2 className="text-sm font-black uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2">
            <Calendar size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Reporte de Hábitos de Hoy
          </h2>

          <form onSubmit={handleSaveDailyMetrics} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-black/50 border border-neutral-800 rounded-2xl p-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-3 flex items-center gap-2"><Droplet size={14}/> Agua (Litros)</label>
                <input type="number" min="0" max="20" step="0.1" value={water} onChange={(e) => setWater(e.target.value)} required placeholder="Ej: 2.5" className="w-full bg-transparent border-b border-neutral-800 text-white font-mono text-xl outline-none focus:border-blue-500 pb-1 transition-colors"/>
              </div>
              <div className="bg-black/50 border border-neutral-800 rounded-2xl p-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-3 flex items-center gap-2"><Moon size={14}/> Sueño Reportado (Horas)</label>
                <input type="number" min="0" max="24" step="0.1" value={sleep} onChange={(e) => setSleep(e.target.value)} required placeholder="Ej: 7.5" className="w-full bg-transparent border-b border-neutral-800 text-white font-mono text-xl outline-none focus:border-purple-500 pb-1 transition-colors"/>
              </div>
              <div className="bg-black/50 border border-neutral-800 rounded-2xl p-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-green-400 mb-3 flex items-center gap-2"><Footprints size={14}/> Pasos Reportados (NEAT)</label>
                <input type="number" min="0" max="200000" step="1" value={steps} onChange={(e) => setSteps(e.target.value)} required placeholder="Ej: 10000" className="w-full bg-transparent border-b border-neutral-800 text-white font-mono text-xl outline-none focus:border-green-500 pb-1 transition-colors"/>
              </div>
            </div>

            <div className="bg-black/50 border border-neutral-800 rounded-2xl p-5">
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-4 block">Cumplimiento del Entrenamiento</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setTrainingDone('YES')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${trainingDone === 'YES' ? 'bg-green-500/20 text-green-500 border border-green-500/50' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>Completado</button>
                <button type="button" onClick={() => setTrainingDone('PARTIAL')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${trainingDone === 'PARTIAL' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>A Medias</button>
                <button type="button" onClick={() => setTrainingDone('NO')} className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${trainingDone === 'NO' ? 'bg-red-500/20 text-red-500 border border-red-500/50' : 'bg-neutral-900 text-neutral-500 border border-neutral-800'}`}>Fallé</button>
              </div>
              <textarea value={difficultyNote} maxLength={1000} onChange={(e) => setDifficultyNote(e.target.value)} placeholder="Nota para el coach (Opcional): Sentí molestia en el hombro, no tuve energía hoy..." className="w-full bg-neutral-900 border border-neutral-800 rounded-xl mt-4 p-3 text-xs font-mono text-white outline-none h-16 resize-none focus:border-neutral-500"/>
            </div>

            <button type="submit" disabled={saving} className="w-full bg-white hover:bg-neutral-200 text-black font-black uppercase tracking-widest text-[11px] py-4 rounded-xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={16} className="animate-spin"/> : <><Save size={16}/> Guardar Auditoría Diaria</>}
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}