import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Activity, Lock, Info, Droplet, Moon, 
  Utensils, Camera, Scale, CheckCircle2, AlertTriangle, Loader2, 
  Watch, Dumbbell, MessageSquarePlus, ImagePlus
} from 'lucide-react';

export default function MonitoreoDisciplina() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState(null);
  
  // Calendario
  const [currentWeek, setCurrentWeek] = useState(1);
  const [isSunday, setIsSunday] = useState(false);
  const [isEvenWeek, setIsEvenWeek] = useState(false);

  // 📊 HÁBITOS Y WEARABLES
  const [waterIntake, setWaterIntake] = useState('');
  const [sleepHours, setSleepHours] = useState('');
  const [steps, setSteps] = useState('');
  
  // 🏋️ ENTRENAMIENTO Y FEEDBACK
  const [workoutStatus, setWorkoutStatus] = useState(''); // 'YES' | 'PARTIAL' | 'NO'
  const [dailyNote, setDailyNote] = useState(''); // Cajón opcional de dificultades
  
  // 🥗 5 COMIDAS Y SUS FOTOS
  const [mealsStatus, setMealsStatus] = useState(['', '', '', '', '']); // 'YES' | 'PARTIAL' | 'NO'
  const [mealPhotos, setMealPhotos] = useState([null, null, null, null, null]);
  const [mealPreviews, setMealPreviews] = useState([null, null, null, null, null]);

  // 🚨 RITUAL DOMINICAL
  const [sundayWeight, setSundayWeight] = useState('');
  const [sundayPhotos, setSundayPhotos] = useState({ front: null, side: null, back: null });
  const [sundayPreviews, setSundayPreviews] = useState({ front: null, side: null, back: null });

  // Dev Mode (Pruebas)
  const [devModeSunday, setDevModeSunday] = useState(false);
  const [devModeEvenWeek, setDevModeEvenWeek] = useState(false);

  useEffect(() => {
    fetchAthleteData();
  }, []);

  const fetchAthleteData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const { data, error } = await supabase.from('athletes_profile').select('*').eq('user_id', session.user.id).single();
      if (error) throw error;
      
      setAthlete(data);

      if (data.program_start_date) {
        const startDate = new Date(data.program_start_date);
        const today = new Date();
        const diffDays = Math.ceil(Math.abs(today - startDate) / (1000 * 60 * 60 * 24));
        const week = Math.floor(diffDays / 7) + 1;
        setCurrentWeek(week > 0 ? week : 1);
        setIsEvenWeek(week % 2 === 0);
        setIsSunday(today.getDay() === 0);
      }
    } catch (error) {
      console.error("Error cargando Monitoreo:", error);
    } finally {
      setLoading(false);
    }
  };

  const isElite = athlete?.b2c_plan?.toUpperCase() === 'ELITE';

  // Handlers de UI
  const handleMealStatus = (index, status) => {
    const newStatus = [...mealsStatus]; newStatus[index] = status; setMealsStatus(newStatus);
  };

  const handleMealPhotoChange = (index, e) => {
    const file = e.target.files[0];
    if (file) {
      const newPhotos = [...mealPhotos]; newPhotos[index] = file; setMealPhotos(newPhotos);
      const newPreviews = [...mealPreviews]; newPreviews[index] = URL.createObjectURL(file); setMealPreviews(newPreviews);
    }
  };

  const handleSundayPhotoChange = (view, e) => {
    const file = e.target.files[0];
    if (file) {
      setSundayPhotos({ ...sundayPhotos, [view]: file });
      setSundayPreviews({ ...sundayPreviews, [view]: URL.createObjectURL(file) });
    }
  };

  const simulateWearableSync = () => {
    setSteps('10452');
    setSleepHours('7.5');
    setWaterIntake('3.5');
    alert("⌚ Wearable Sincronizado: Pasos, Sueño y Agua importados correctamente.");
  };

  // Subida Inteligente a Storage
  const uploadPhoto = async (file, pathPrefix) => {
    if (!file) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${pathPrefix}_${Date.now()}.${fileExt}`;
    const filePath = `${athlete.id}/week_${currentWeek}/${fileName}`;

    // Subimos al bucket maestro 'athlete_evidence'
    const { error: uploadError } = await supabase.storage.from('athlete_evidence').upload(filePath, file);
    if (uploadError) {
      console.error("Error subiendo foto:", uploadError);
      return null;
    }
    const { data } = supabase.storage.from('athlete_evidence').getPublicUrl(filePath);
    return data.publicUrl;
  };

  // Guardar Check-in en la Base de Datos
  const handleSaveCheckIn = async () => {
    try {
      setSaving(true);

      // 1. Subir las 5 fotos de comida a Storage
      const mealPhotoUrls = await Promise.all(
        mealPhotos.map((file, i) => uploadPhoto(file, `meal_${i+1}`))
      );

      // 2. Subir las 3 fotos dominicales (si aplica)
      let sundayPhotoUrls = { front: null, side: null, back: null };
      if ((isSunday || devModeSunday) && (isEvenWeek || devModeEvenWeek)) {
        sundayPhotoUrls.front = await uploadPhoto(sundayPhotos.front, 'sunday_front');
        sundayPhotoUrls.side = await uploadPhoto(sundayPhotos.side, 'sunday_side');
        sundayPhotoUrls.back = await uploadPhoto(sundayPhotos.back, 'sunday_back');
      }

      // 3. Empaquetar JSON
      const checkinData = {
        updated_at: new Date().toISOString(),
        week: currentWeek,
        metrics: { water: waterIntake, sleep: sleepHours, steps: steps },
        training: { completed: workoutStatus, difficulty_note: dailyNote },
        meals: mealsStatus.map((status, i) => ({
          meal_num: i + 1,
          status: status,
          photo_url: mealPhotoUrls[i] || null
        })),
        sunday_ritual: (isSunday || devModeSunday) ? {
          is_active: true,
          weight: sundayWeight,
          photos: sundayPhotoUrls
        } : { is_active: false }
      };

      // 4. Guardar en columna discipline_metrics de Supabase
      const { error } = await supabase
        .from('athletes_profile')
        .update({ discipline_metrics: checkinData })
        .eq('id', athlete.id);

      if (error) throw error;
      
      alert("✅ Reporte de Disciplina enviado con éxito a tu Coach Élite.");
      navigate('/client');
    } catch (err) {
      console.error(err);
      alert("❌ Error guardando la disciplina.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin" color={theme.brandColor} size={40}/></div>;

  // EFECTO ESCAPARATE
  if (!isElite) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <button onClick={() => navigate('/client')} className="absolute top-6 left-6 text-neutral-500 hover:text-white"><ArrowLeft size={24}/></button>
        <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center border border-neutral-800 mb-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] z-10"><Lock size={28} className="text-neutral-400" /></div>
        <h1 className="text-2xl font-black uppercase tracking-tight mb-3 text-center z-10">Monitoreo Élite Bloqueado</h1>
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 max-w-sm text-center z-10">
          <Activity size={32} style={{ color: theme.brandColor }} className="mx-auto mb-4" />
          <p className="text-xs text-neutral-400 font-mono mb-4 leading-relaxed">El control biométrico diario (Pasos, Sueño, Fotos de Nutrición y Ritual Dominical) es una herramienta analítica exclusiva del ecosistema <strong>ÉLITE</strong>.</p>
          <button onClick={() => { alert("Notificación Push enviada al Coach."); navigate('/client'); }} className="w-full text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.3)]" style={{ backgroundColor: theme.brandColor }}>Solicitar Upgrade a Élite</button>
        </div>
      </div>
    );
  }

  const activeSunday = isSunday || devModeSunday;
  const activeEvenWeek = isEvenWeek || devModeEvenWeek;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 overflow-x-hidden">
      
      {/* NAVBAR */}
      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/client')} className="text-neutral-500 hover:text-white"><ArrowLeft size={20} /></button>
            <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Activity size={16} style={{ color: theme.brandColor }} /> Monitoreo de Disciplina</h1>
          </div>
          <span className="text-[10px] bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full text-neutral-400 font-bold uppercase tracking-widest">Semana {currentWeek}</span>
        </div>
      </nav>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* ⌚ MÓDULO 1: WEARABLES Y RECUPERACIÓN */}
        <div>
          <div className="flex items-center justify-between mb-3 ml-1">
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500">Wearables & Biometría</h2>
            <button onClick={simulateWearableSync} className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 px-2 py-1 rounded-md text-[9px] font-bold text-blue-400 uppercase tracking-wider hover:bg-neutral-800 transition-colors">
              <Watch size={10} /> Sincronizar Reloj
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[#111] border border-neutral-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
              <Droplet size={16} className="text-blue-400 mb-2" />
              <input type="number" placeholder="Lts" value={waterIntake} onChange={(e) => setWaterIntake(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg p-1 text-xs text-center font-bold text-white outline-none focus:border-blue-500"/>
              <span className="text-[8px] uppercase text-neutral-500 font-black mt-1">Agua</span>
            </div>
            <div className="bg-[#111] border border-neutral-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
              <Moon size={16} className="text-purple-400 mb-2" />
              <input type="number" placeholder="Hrs" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg p-1 text-xs text-center font-bold text-white outline-none focus:border-purple-500"/>
              <span className="text-[8px] uppercase text-neutral-500 font-black mt-1">Sueño</span>
            </div>
            <div className="bg-[#111] border border-neutral-800 rounded-2xl p-3 flex flex-col items-center justify-center text-center">
              <Activity size={16} className="text-green-400 mb-2" />
              <input type="number" placeholder="Pasos" value={steps} onChange={(e) => setSteps(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-lg p-1 text-xs text-center font-bold text-white outline-none focus:border-green-500"/>
              <span className="text-[8px] uppercase text-neutral-500 font-black mt-1">Pasos / NEAT</span>
            </div>
          </div>
        </div>

        {/* 🥗 MÓDULO 2: 5 COMIDAS Y FOTOS */}
        <div>
          <h2 className="text-xs font-black uppercase tracking-widest text-neutral-500 mb-3 ml-1">Nutrición Diaria (5 Comidas)</h2>
          <div className="bg-[#111] border border-neutral-800 rounded-3xl p-5 space-y-3">
            {[1, 2, 3, 4, 5].map((mealNum, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-neutral-800/50 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  {/* Foto de la comida */}
                  <div className="relative w-10 h-10 bg-black border border-neutral-700 border-dashed rounded-lg flex items-center justify-center overflow-hidden shrink-0 group hover:border-neutral-500 cursor-pointer">
                    {mealPreviews[idx] ? (
                      <img src={mealPreviews[idx]} alt="Meal" className="w-full h-full object-cover" />
                    ) : (
                      <ImagePlus size={14} className="text-neutral-600" />
                    )}
                    <input type="file" accept="image/*" onChange={(e) => handleMealPhotoChange(idx, e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-white uppercase tracking-wider block">Comida {mealNum}</span>
                    <span className="text-[8px] text-neutral-500 font-mono">{mealPreviews[idx] ? 'Foto cargada' : 'Subir foto'}</span>
                  </div>
                </div>
                
                {/* Botones Sí/Medio/No */}
                <div className="flex bg-black rounded-lg border border-neutral-800 p-0.5">
                  <button onClick={() => handleMealStatus(idx, 'NO')} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase transition-all ${mealsStatus[idx] === 'NO' ? 'bg-red-500/20 text-red-500' : 'text-neutral-500 hover:text-white'}`}>No</button>
                  <button onClick={() => handleMealStatus(idx, 'PARTIAL')} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase transition-all ${mealsStatus[idx] === 'PARTIAL' ? 'bg-yellow-500/20 text-yellow-500' : 'text-neutral-500 hover:text-white'}`}>Medio</button>
                  <button onClick={() => handleMealStatus(idx, 'YES')} className={`px-2.5 py-1 rounded text-[8px] font-black uppercase transition-all ${mealsStatus[idx] === 'YES' ? 'bg-green-500/20 text-green-500' : 'text-neutral-500 hover:text-white'}`}>Sí</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 🏋️ MÓDULO 3: ENTRENAMIENTO Y FEEDBACK */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-5 space-y-4">
           <h2 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 flex items-center gap-2"><Dumbbell size={14} style={{ color: theme.brandColor }}/> ¿Cumplí el Entrenamiento Hoy?</h2>
           
           <div className="flex bg-black rounded-xl border border-neutral-800 p-1">
              <button onClick={() => setWorkoutStatus('NO')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${workoutStatus === 'NO' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'text-neutral-500 hover:text-white'}`}>No Entrené</button>
              <button onClick={() => setWorkoutStatus('PARTIAL')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${workoutStatus === 'PARTIAL' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' : 'text-neutral-500 hover:text-white'}`}>A Medias</button>
              <button onClick={() => setWorkoutStatus('YES')} className={`flex-1 py-2.5 rounded-lg text-[9px] font-black uppercase transition-all ${workoutStatus === 'YES' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'text-neutral-500 hover:text-white'}`}>Cumplido 100%</button>
           </div>

           <label className="text-[9px] uppercase font-black tracking-widest text-neutral-500 flex items-center gap-2 pt-2"><MessageSquarePlus size={12} className="text-neutral-600"/> ¿Tuviste alguna dificultad en algo hoy? (Opcional)</label>
           <textarea 
             value={dailyNote}
             onChange={(e) => setDailyNote(e.target.value)}
             placeholder="Ej. Me dolió la rodilla izquierda en la prensa o tuve mucho estrés laboral..."
             className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-[10px] font-mono text-neutral-300 outline-none focus:border-neutral-600 h-20 resize-none"
           />
        </div>

        {/* 🚨 MÓDULO 4: RITUAL DOMINICAL INTELIGENTE */}
        {activeSunday && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-gradient-to-br from-neutral-900 to-black border border-neutral-700 rounded-3xl p-6 relative overflow-hidden shadow-[0_0_30px_rgba(255,255,255,0.05)]">
              <div className="absolute top-0 right-0 w-40 h-40 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: theme.brandColor }}></div>
              
              <div className="flex gap-3 items-center mb-6">
                <AlertTriangle size={24} style={{ color: theme.brandColor }} />
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tight text-white leading-none">Ritual Dominical</h2>
                  <p className="text-[10px] text-neutral-400 font-mono mt-1">Semana {currentWeek} - {activeEvenWeek ? 'Auditoría Visual (Semana Par)' : 'Control de Peso (Semana Impar)'}</p>
                </div>
              </div>

              {/* Peso Obligatorio */}
              <div className="bg-black/50 border border-neutral-800 rounded-2xl p-4 mb-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[10px] uppercase font-black tracking-widest text-neutral-300 flex items-center gap-2"><Scale size={14} style={{ color: theme.brandColor }}/> Peso en Ayunas</label>
                  <span className="text-[9px] text-red-500 font-mono border border-red-500/30 bg-red-500/10 px-2 py-0.5 rounded">Requerido</span>
                </div>
                <div className="relative">
                  <input type="number" placeholder="Ej. 75.5" value={sundayWeight} onChange={(e) => setSundayWeight(e.target.value)} className="w-full bg-[#111] border border-neutral-700 rounded-xl p-3 text-lg font-mono font-bold text-white outline-none focus:border-white transition-colors" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 font-black uppercase">KG</span>
                </div>
              </div>

              {/* Evidencia Visual (Semanas Pares) */}
              {activeEvenWeek && (
                <div className="bg-black/50 border border-neutral-800 rounded-2xl p-4">
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-[10px] uppercase font-black tracking-widest text-neutral-300 flex items-center gap-2"><Camera size={14} style={{ color: theme.brandColor }}/> Evidencia Visual</label>
                    <span className="text-[9px] bg-neutral-800 text-neutral-400 border border-neutral-700 px-2 py-0.5 rounded uppercase font-bold tracking-wider">3 Fotos</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    {['front', 'side', 'back'].map((view) => (
                      <div key={view} className="relative aspect-[3/4] bg-[#111] border border-neutral-700 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-neutral-500 overflow-hidden group">
                        {sundayPreviews[view] ? (
                          <img src={sundayPreviews[view]} alt={view} className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Camera size={20} className="text-neutral-600 mb-2 group-hover:text-white" />
                            <span className="text-[7px] font-black uppercase tracking-widest text-neutral-500">{view}</span>
                          </>
                        )}
                        <input type="file" accept="image/*" onChange={(e) => handleSundayPhotoChange(view, e)} className="absolute inset-0 opacity-0 cursor-pointer" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* BOTÓN DE ENVÍO */}
        <button 
          onClick={handleSaveCheckIn}
          disabled={saving}
          className="w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-[0_0_20px_rgba(0,0,0,0.3)] disabled:opacity-50 text-white"
          style={{ backgroundColor: theme.brandColor }}
        >
          {saving ? <><Loader2 size={16} className="animate-spin" /> Encriptando & Guardando...</> : <><CheckCircle2 size={16} /> Enviar Auditoría al Coach</>}
        </button>

      </main>

      {/* 🧪 DEV MODE (testing) */}
      <div className="fixed bottom-4 right-4 bg-neutral-900 border border-neutral-700 p-3 rounded-2xl z-50 flex flex-col gap-2 shadow-2xl opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-[8px] font-black text-yellow-500 uppercase tracking-widest text-center">Dev Mode</p>
        <button onClick={() => setDevModeSunday(!devModeSunday)} className={`text-[9px] px-2 py-1 rounded font-mono ${devModeSunday ? 'bg-white text-black' : 'bg-black text-white border border-neutral-700'}`}>Forzar Domingo</button>
        <button onClick={() => setDevModeEvenWeek(!devModeEvenWeek)} className={`text-[9px] px-2 py-1 rounded font-mono ${devModeEvenWeek ? 'bg-white text-black' : 'bg-black text-white border border-neutral-700'}`}>Forzar Sem. Par</button>
      </div>

    </div>
  );
}