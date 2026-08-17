import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Dumbbell, Building2, Home, CheckCircle2, 
  Loader2, Calendar, ShieldCheck, Clock, PlayCircle, 
  BrainCircuit, AlertCircle, Send, MessageSquareQuote
} from 'lucide-react';

export default function AppTrainerPro() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState(null);
  
  const [environment, setEnvironment] = useState('GYM');
  const [activeDay, setActiveDay] = useState(1);
  const [routineStatus, setRoutineStatus] = useState('NEW');

  useEffect(() => {
    fetchAthleteData();
  }, []);

  const fetchAthleteData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const { data, error } = await supabase
        .from('athletes_profile')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;
      
      setAthlete(data);
      if (data.training_location?.toLowerCase().includes('casa')) setEnvironment('HOME');
      if (data.routine_status) setRoutineStatus(data.routine_status);

    } catch (error) {
      console.error("Error cargando Trainer Pro:", error);
    } finally {
      setLoading(false);
    }
  };

  const isElite = athlete?.b2c_plan?.toUpperCase() === 'ELITE';

  // Motor de Arquitectura Biomecánica Base
  const generateWeeklyRoutine = () => {
    const isHome = environment === 'HOME';
    const DB = {
      Pecho: { gym: ['Press de Banca', 'Press Inclinado', 'Aperturas', 'Crossover'], home: ['Push-ups Clásicas', 'Push-ups Declinadas', 'Aperturas Bandas', 'Push-ups Diamante'] },
      Hombros: { gym: ['Press Militar', 'Elevaciones Laterales', 'Face Pull'], home: ['Pike Push-ups', 'Elevaciones Laterales', 'Band Pull-aparts'] },
      Espalda: { gym: ['Jalón al Pecho', 'Remo c/ Barra', 'Pullover', 'Remo Mancuerna'], home: ['Dominadas', 'Remo Banda', 'Superman', 'Remo Mochila'] },
      Bíceps: { gym: ['Curl c/ Barra Z', 'Curl Martillo', 'Curl Scott'], home: ['Curl Isométrico Toalla', 'Curl Alternado Peso', 'Curl Banda'] },
      Cuádriceps: { gym: ['Sentadilla Libre', 'Prensa', 'Sentadilla Hack', 'Extensiones'], home: ['Sentadilla Búlgara', 'Sentadilla Goblet', 'Pistol Squats', 'Sissy Squat'] },
      Pantorrillas: { gym: ['Elevación Pie', 'Elevación Sentado', 'Elevación Unilateral'], home: ['Elevación Escalón', 'Elevación Isométrica', 'Saltos'] },
      Isquiosurales: { gym: ['Peso Muerto Rumano', 'Curl Acostado', 'Curl Sentado', 'Buenos Días'], home: ['Curl Deslizante', 'Peso Muerto a 1 Pierna', 'Puente de Glúteo', 'Nordic Curl'] },
      Glúteos: { gym: ['Hip Thrust Pesado', 'Abducción Máquina', 'Patada Polea'], home: ['Hip Thrust a 1 Pierna', 'Abducción Banda', 'Frog Pumps'] }
    };

    const buildExercise = (name, muscle, isLarge) => ({
      name, muscle, type: isLarge ? 'Grupo Grande' : 'Grupo Pequeño', sets: isLarge ? 4 : 3, reps: isLarge ? '8-10' : '12-15', rir: isElite ? '1' : '2', restSets: isLarge ? '120s' : '90s',
      technique: 'Tensión Mecánica', execution: 'Ejecución controlada.'
    });

    const buildDay = (dayNum, title, largeM, smallM) => ({
      day: dayNum, title, focus: `${largeM} + ${smallM}`,
      exercises: [...DB[largeM][isHome?'home':'gym'].map(n => buildExercise(n, largeM, true)), ...DB[smallM][isHome?'home':'gym'].map(n => buildExercise(n, smallM, false))]
    });

    return [
      buildDay(1, 'Empuje Frontal (Push A)', 'Pecho', 'Hombros'), buildDay(2, 'Tracción Dorsal (Pull A)', 'Espalda', 'Bíceps'),
      buildDay(3, 'Cadena Anterior (Legs A)', 'Cuádriceps', 'Pantorrillas'), buildDay(4, 'Empuje Superior (Push B)', 'Hombros', 'Pecho'),
      buildDay(5, 'Cadena Posterior (Legs B)', 'Isquiosurales', 'Glúteos'), buildDay(6, 'Tracción + Core (Pull B)', 'Espalda', 'Bíceps')
    ];
  };

  // 🔑 CRÍTICO: Si el status NO es NEW, leemos de la Base de Datos.
  const displayRoutine = (routineStatus !== 'NEW' && athlete?.training_plan) 
    ? athlete.training_plan 
    : generateWeeklyRoutine();

  const currentDayRoutine = displayRoutine.find(d => d.day === activeDay) || displayRoutine[0];

  const handleSendToCoach = async () => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('athletes_profile')
        .update({ 
          training_plan: displayRoutine, 
          routine_status: 'PENDING_AUDIT' 
        })
        .eq('id', athlete.id);

      if (error) throw error;
      setRoutineStatus('PENDING_AUDIT');
      alert('✅ Plan enviado con éxito al Coach.');
    } catch (err) {
      alert('❌ Error al conectar con el servidor.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin" color={theme.brandColor} size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 overflow-x-hidden">
      
      {/* NAVBAR CON LOGO */}
      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/client')} className="text-neutral-500 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
            <div className="flex items-center gap-2">
              {theme.logo_url ? <img src={theme.logo_url} alt="Coach Logo" className="h-6 object-contain" /> : <Dumbbell size={16} style={{ color: theme.brandColor }} />}
              <h1 className="text-sm font-black uppercase tracking-widest">Trainer Pro</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        
        {/* BANNER DE NOTA DEL COACH */}
        {routineStatus === 'APPROVED' && athlete?.coach_note && (
           <div className="bg-gradient-to-r from-blue-900/40 to-blue-600/10 border border-blue-500/30 rounded-2xl p-5 shadow-[0_0_20px_rgba(59,130,246,0.1)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <div className="flex gap-3 mb-2">
                <MessageSquareQuote size={18} className="text-blue-400 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-widest text-blue-400 mt-0.5">Nota de tu Entrenador</h3>
              </div>
              <p className="text-[11px] text-white font-mono leading-relaxed pl-7 italic">"{athlete.coach_note}"</p>
           </div>
        )}

        <div className="space-y-4">
          <div><h2 className="text-2xl font-black uppercase tracking-tight">Matriz Biomecánica</h2></div>

          {routineStatus === 'NEW' && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-blue-500 mb-1">Estructura Generada</h3>
              <p className="text-[10px] text-blue-300/70 font-mono mb-3">Revisa el plan y envíalo a tu Coach para su auditoría.</p>
              <button onClick={handleSendToCoach} disabled={saving} className="w-full py-3 rounded-xl font-black uppercase text-[10px] flex items-center justify-center gap-2 text-white" style={{ backgroundColor: theme.brandColor }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14}/> Enviar al Coach para Auditoría</>}
              </button>
            </div>
          )}

          {routineStatus === 'PENDING_AUDIT' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 flex gap-3">
              <Clock size={18} className="text-yellow-500 shrink-0" />
              <div>
                <h3 className="text-xs font-black uppercase text-yellow-500 mb-1">Auditoría Pendiente</h3>
                <p className="text-[10px] text-yellow-500/70 font-mono">Plan en la mesa de tu Coach. Te notificaremos cuando esté 100% aprobada.</p>
              </div>
            </div>
          )}

          {routineStatus === 'APPROVED' && !athlete?.coach_note && (
             <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 flex gap-3">
               <ShieldCheck size={18} className="text-green-500 shrink-0" />
               <div>
                 <h3 className="text-xs font-black uppercase text-green-500 mb-1">Aprobada por tu Coach</h3>
                 <p className="text-[10px] text-green-500/70 font-mono">Rutina validada. Sigue estrictamente los descansos y RIR.</p>
               </div>
             </div>
          )}
        </div>

        {/* DIAS SCROLLER */}
        <div className={routineStatus === 'NEW' ? 'opacity-50 pointer-events-none' : ''}>
          <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide snap-x">
            {displayRoutine.map(day => (
              <button 
                key={day.day} onClick={() => setActiveDay(day.day)}
                className={`snap-center shrink-0 w-20 flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${activeDay === day.day ? 'bg-[#111] border-neutral-600 shadow-lg' : 'bg-black border-neutral-800 opacity-60'}`}
              >
                <span className="text-[9px] font-black uppercase text-neutral-500 mb-1">Día</span>
                <span className="text-xl font-black font-mono" style={{ color: activeDay === day.day ? theme.brandColor : 'white' }}>{day.day}</span>
              </button>
            ))}
          </div>
        </div>

        {/* RUTINA DEL DIA */}
        <div className={`space-y-4 animate-in fade-in ${routineStatus === 'NEW' ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="border-b border-neutral-800 pb-3">
            <h3 className="text-lg font-black uppercase text-white">{currentDayRoutine.title}</h3>
            <p className="text-[10px] text-neutral-500 font-mono mt-1">{currentDayRoutine.exercises.length} Ejercicios Asignados</p>
          </div>

          <div className="space-y-4">
            {currentDayRoutine.exercises.map((exe, index) => (
              <div key={index} className="bg-[#111] border border-neutral-800 rounded-3xl p-5 relative overflow-hidden">
                <div className="flex items-start justify-between mb-4">
                  <div className="pr-8">
                    <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 mb-2 inline-block border border-neutral-700">{exe.muscle}</span>
                    <h4 className="font-bold text-sm text-white leading-tight">{exe.name}</h4>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0"><span className="text-xs font-black text-neutral-500">{index + 1}</span></div>
                </div>

                <div className="grid grid-cols-4 gap-2 text-[10px] font-mono mb-4">
                  <div className="bg-black rounded-xl p-2 text-center border border-neutral-800/50"><span className="text-neutral-500 font-black uppercase text-[7px] block mb-1">Sets</span><span className="text-white font-bold">{exe.sets}</span></div>
                  <div className="bg-black rounded-xl p-2 text-center border border-neutral-800/50"><span className="text-neutral-500 font-black uppercase text-[7px] block mb-1">Reps</span><span className="text-white font-bold">{exe.reps}</span></div>
                  <div className="bg-black rounded-xl p-2 text-center border border-neutral-800/50"><span className="text-neutral-500 font-black uppercase text-[7px] block mb-1">RIR</span><span className="text-white font-bold">{exe.rir}</span></div>
                  <div className="bg-black rounded-xl p-2 text-center border border-neutral-800/50"><span className="text-neutral-500 font-black uppercase text-[7px] block mb-1">Desc.</span><span className="text-white font-bold">{exe.restSets}</span></div>
                </div>
              </div>
            ))}
          </div>

          <button 
            className="w-full mt-6 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-[0_0_20px_rgba(0,0,0,0.3)] disabled:opacity-50 text-white"
            style={{ backgroundColor: theme.brandColor }}
            disabled={routineStatus !== 'APPROVED'}
            onClick={() => alert('Entrenamiento completado y guardado en tu historial.')}
          >
            {routineStatus === 'APPROVED' ? (
               <><CheckCircle2 size={16} /> Completar Día {activeDay}</>
            ) : (
               <><AlertCircle size={16} /> Bloqueado: Esperando Auditoría del Coach</>
            )}
          </button>
        </div>

      </main>
    </div>
  );
}