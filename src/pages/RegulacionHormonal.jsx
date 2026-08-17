import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Activity, Lock, Info, Calendar, Droplets, 
  Flame, Wind, CheckCircle2, Loader2, BrainCircuit, Dumbbell, Utensils
} from 'lucide-react';

export default function RegulacionHormonal() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [athlete, setAthlete] = useState(null);
  
  // Datos del Ciclo
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [cycleLength, setCycleLength] = useState(28); // Promedio clínico

  // Cálculos en tiempo real
  const [currentDayOfCycle, setCurrentDayOfCycle] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(null);

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

      if (data.hormonal_data) {
        setLastPeriodDate(data.hormonal_data.lastPeriodDate || '');
        setCycleLength(data.hormonal_data.cycleLength || 28);
        calculatePhase(data.hormonal_data.lastPeriodDate, data.hormonal_data.cycleLength || 28);
      }
    } catch (error) {
      console.error("Error cargando Hormonal:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePhase = (dateString, length) => {
    if (!dateString) return;
    const start = new Date(dateString);
    start.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const diffTime = today - start;
    let diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) diffDays = 0;
    
    // El día actual del ciclo (Ej: Día 14 de 28)
    const dayOfCycle = (diffDays % length) + 1;
    setCurrentDayOfCycle(dayOfCycle);

    // Motor Clínico: Fases del Ciclo
    if (dayOfCycle >= 1 && dayOfCycle <= 5) {
      setCurrentPhase('MENSTRUAL');
    } else if (dayOfCycle >= 6 && dayOfCycle <= 13) {
      setCurrentPhase('FOLICULAR');
    } else if (dayOfCycle >= 14 && dayOfCycle <= 16) {
      setCurrentPhase('OVULATORIA');
    } else {
      setCurrentPhase('LUTEA');
    }
  };

  // Auto-calcular al cambiar inputs
  useEffect(() => {
    if (lastPeriodDate && cycleLength) {
      calculatePhase(lastPeriodDate, cycleLength);
    }
  }, [lastPeriodDate, cycleLength]);

  const handleSaveHormonalData = async () => {
    try {
      setSaving(true);
      const hormonalData = {
        lastPeriodDate,
        cycleLength,
        currentDayOfCycle,
        currentPhase,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('athletes_profile')
        .update({ hormonal_data: hormonalData })
        .eq('id', athlete.id);

      if (error) throw error;
      alert("✅ Biometría hormonal sincronizada. Tu matriz de entrenamiento y nutrición se ajustará inteligentemente.");
    } catch (err) {
      console.error(err);
      alert("❌ Error guardando datos.");
    } finally {
      setSaving(false);
    }
  };

  // --- LIBRERÍA CLÍNICA DE FASES ---
  const PHASE_DETAILS = {
    MENSTRUAL: {
      name: "Fase Menstrual",
      days: "Días 1 - 5",
      color: "text-rose-500",
      bg: "bg-rose-500/10 border-rose-500/30",
      icon: <Droplets size={24} className="text-rose-500" />,
      desc: "Niveles de estrógeno y progesterona en su punto más bajo. La inflamación sistémica está elevada.",
      training: "Disminuir RIR (dejar 2-3 reps en reserva). Reducir volumen total un 10-20% si hay fatiga severa. No buscar PRs (Récords Personales).",
      nutrition: "Priorizar hidratación y alimentos ricos en hierro (carnes rojas, espinacas). Aumentar omega-3 para reducir inflamación."
    },
    FOLICULAR: {
      name: "Fase Folicular",
      days: "Días 6 - 13",
      color: "text-blue-500",
      bg: "bg-blue-500/10 border-blue-500/30",
      icon: <Wind size={24} className="text-blue-500" />,
      desc: "El estrógeno comienza a subir. Alta tolerancia al dolor y excelente sensibilidad a la insulina.",
      training: "Fase óptima para sobrecarga progresiva pesada. Buscar el Fallo Muscular (RIR 0-1). Excelente momento para entrenamientos HIIT.",
      nutrition: "Aumentar carbohidratos complejos en un 10-15%. El cuerpo utiliza eficientemente el glucógeno muscular."
    },
    OVULATORIA: {
      name: "Fase Ovulatoria",
      days: "Días 14 - 16",
      color: "text-green-500",
      bg: "bg-green-500/10 border-green-500/30",
      icon: <Flame size={24} className="text-green-500" />,
      desc: "Pico máximo de estrógeno y testosterona. Máxima fuerza, pero mayor riesgo de lesiones en ligamentos.",
      training: "Pico de fuerza (Récords Personales). Mantener técnica estricta, ya que el estrógeno relaja los ligamentos (cuidado con las rodillas).",
      nutrition: "Mantener macros estables. El metabolismo basal aumenta ligeramente (gasto extra de 100-200 kcal)."
    },
    LUTEA: {
      name: "Fase Lútea",
      days: "Días 17 - 28",
      color: "text-purple-500",
      bg: "bg-purple-500/10 border-purple-500/30",
      icon: <BrainCircuit size={24} className="text-purple-500" />,
      desc: "La progesterona domina. Temperatura corporal elevada, retención de líquidos y posibles antojos.",
      training: "Transición a tensión mecánica controlada. Bajar intensidad cardiovascular. Evitar el fallo muscular extremo en días pre-menstruales.",
      nutrition: "Reducir carbohidratos ligeramente e incrementar grasas saludables. Aumentar magnesio para mitigar los antojos de azúcar."
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin" color={theme.brandColor} size={40}/></div>;

  // FILTRO 1: SOLO PARA MUJERES
  if (athlete?.gender?.toUpperCase() !== 'FEMENINO') {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center justify-center text-center">
        <button onClick={() => navigate('/client')} className="absolute top-6 left-6 text-neutral-500 hover:text-white"><ArrowLeft size={24}/></button>
        <Activity size={40} className="text-neutral-600 mb-4" />
        <h1 className="text-xl font-black uppercase mb-2">Exclusivo Fisiología Femenina</h1>
        <p className="text-xs font-mono text-neutral-500 max-w-sm">Este algoritmo está diseñado estructuralmente para sincronizar cargas biomecánicas con el ciclo menstrual. Tu plan B2C obedece a otros protocolos metabólicos.</p>
      </div>
    );
  }

  // FILTRO 2: EFECTO ESCAPARATE PARA PLANES INFERIORES
  const isElite = athlete?.b2c_plan?.toUpperCase() === 'ELITE';

  if (!isElite) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white font-sans p-6 flex flex-col items-center justify-center relative overflow-hidden">
        <button onClick={() => navigate('/client')} className="absolute top-6 left-6 text-neutral-500 hover:text-white"><ArrowLeft size={24}/></button>
        <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center border border-neutral-800 mb-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] z-10"><Lock size={28} className="text-neutral-400" /></div>
        <h1 className="text-2xl font-black uppercase tracking-tight mb-3 text-center z-10">Sincronización Élite Bloqueada</h1>
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 max-w-sm text-center z-10">
          <Droplets size={32} style={{ color: theme.brandColor }} className="mx-auto mb-4" />
          <p className="text-xs text-neutral-400 font-mono mb-4 leading-relaxed">Las mujeres no somos hombres pequeños. Nuestro metabolismo cambia cada semana del mes. El plan ÉLITE te permite ajustar tu rutina y macros según tu fase (Folicular, Ovulatoria, Lútea).</p>
          <div className="bg-black border border-neutral-800 rounded-xl p-3 mb-6 flex items-start gap-3 text-left">
             <Info size={14} className="text-neutral-500 shrink-0 mt-0.5" />
             <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">Desbloquea el ajuste hormonal con tu Coach.</p>
          </div>
          <button onClick={() => { alert("Petición de Upgrade enviada a tu Coach."); navigate('/client'); }} className="w-full text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.3)] hover:brightness-110" style={{ backgroundColor: theme.brandColor }}>Solicitar Plan Élite</button>
        </div>
      </div>
    );
  }

  const activePhase = currentPhase ? PHASE_DETAILS[currentPhase] : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 overflow-x-hidden">
      
      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/client')} className="text-neutral-500 hover:text-white"><ArrowLeft size={20} /></button>
            <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2"><Droplets size={16} style={{ color: theme.brandColor }} /> Sync Hormonal</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">

        {/* INPUTS DE CALIBRACIÓN */}
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-1">Ciclo Metabólico</h2>
          <p className="text-[10px] text-neutral-500 font-mono mb-4">La matriz de entrenamiento se ajustará a tu fisiología.</p>
          
          <div className="bg-[#111] border border-neutral-800 rounded-3xl p-5 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2 mb-2"><Calendar size={14} style={{ color: theme.brandColor }}/> 1er Día de Menstruación</label>
              <input 
                type="date" 
                value={lastPeriodDate}
                onChange={(e) => setLastPeriodDate(e.target.value)}
                className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white font-mono outline-none focus:border-neutral-500"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400 mb-2 block">Duración Promedio del Ciclo</label>
              <div className="flex items-center gap-3">
                <input 
                  type="range" min="21" max="35" 
                  value={cycleLength} onChange={(e) => setCycleLength(parseInt(e.target.value))}
                  className="flex-1 accent-white"
                />
                <span className="text-lg font-black font-mono w-12 text-right">{cycleLength} <span className="text-xs text-neutral-500">d</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* RESULTADO: FASE ACTUAL */}
        {activePhase && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`border rounded-3xl p-6 relative overflow-hidden ${activePhase.bg}`}>
              <div className="absolute top-0 right-0 w-32 h-32 opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 bg-current" style={{ color: activePhase.color }}></div>
              
              <div className="flex justify-between items-start mb-4 relative z-10">
                <div>
                  <h3 className={`text-2xl font-black uppercase tracking-tight ${activePhase.color}`}>{activePhase.name}</h3>
                  <p className="text-[10px] font-mono text-white/70 uppercase tracking-widest">Hoy es el Día {currentDayOfCycle} del Ciclo</p>
                </div>
                <div className="w-12 h-12 bg-black/50 backdrop-blur rounded-full flex items-center justify-center border border-white/10 shrink-0">
                  {activePhase.icon}
                </div>
              </div>

              <p className="text-xs font-mono text-white/80 leading-relaxed mb-6">{activePhase.desc}</p>

              <div className="space-y-3">
                <div className="bg-black/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2 flex items-center gap-2"><Dumbbell size={12}/> Ajuste Biomecánico</h4>
                  <p className="text-[11px] font-mono text-white leading-relaxed">{activePhase.training}</p>
                </div>
                <div className="bg-black/40 backdrop-blur-sm border border-white/5 rounded-2xl p-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2 flex items-center gap-2"><Utensils size={12}/> Ajuste Metabólico</h4>
                  <p className="text-[11px] font-mono text-white leading-relaxed">{activePhase.nutrition}</p>
                </div>
              </div>

            </div>
          </div>
        )}

        <button 
          onClick={handleSaveHormonalData}
          disabled={saving || !currentPhase}
          className="w-full mt-4 py-4 rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-[0_0_20px_rgba(0,0,0,0.3)] disabled:opacity-50 text-white"
          style={{ backgroundColor: theme.brandColor }}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Aplicar Ajustes a la Matriz</>}
        </button>

      </main>
    </div>
  );
}