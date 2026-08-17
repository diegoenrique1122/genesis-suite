import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, User, Image as ImageIcon, BrainCircuit, Activity, 
  Loader2, Dumbbell, CheckCircle2, Lock, Plus, MessageSquareQuote, 
  Droplet, Moon, Footprints, Utensils, AlertTriangle, Scale, Target, 
  TrendingUp, Droplets, Wind, Flame, LayoutDashboard, Camera
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function ClientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [coachIsElite, setCoachIsElite] = useState(false);
  const [allPhotos, setAllPhotos] = useState([]);
  const [selectedWeekFilter, setSelectedWeekFilter] = useState(0);
  
  const [aiLoading, setAiLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');

  const [editablePlan, setEditablePlan] = useState(null);
  const [coachNote, setCoachNote] = useState('');
  const [activeDayCoach, setActiveDayCoach] = useState(1);
  const [calculatedCurrentDay, setCalculatedCurrentDay] = useState(1);

  const [activeTab, setActiveTab] = useState('OVERVIEW'); 

  useEffect(() => {
    fetchExpediente();
  }, [id]);

  const fetchExpediente = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data: coachData } = await supabase.from('coaches_profile').select('b2b_plan').eq('user_id', session.user.id).single();
      if (coachData?.b2b_plan === 'ELITE') setCoachIsElite(true);

      const { data: profileData } = await supabase.from('athletes_profile').select('*').or(`id.eq.${id},user_id.eq.${id}`).maybeSingle();
      if (!profileData) return setLoading(false);

      setAthlete(profileData);
      if (profileData.ai_diagnosis) setDiagnosis(profileData.ai_diagnosis);
      if (profileData.training_plan) setEditablePlan(profileData.training_plan);
      if (profileData.coach_note) setCoachNote(profileData.coach_note);

      if (profileData.program_start_date) {
        const start = new Date(profileData.program_start_date);
        start.setHours(0,0,0,0);
        const today = new Date();
        today.setHours(0,0,0,0);
        const diffTime = today - start;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) {
           const currentDay = (diffDays % 6) + 1;
           setCalculatedCurrentDay(currentDay);
           setActiveDayCoach(currentDay);
        }
      }
      
      const { data: photosData } = await supabase
        .from('athlete_photos')
        .select('*')
        .eq('athlete_id', profileData.id)
        .order('week_number', { ascending: true });
        
      setAllPhotos(photosData || []);

    } catch (error) {
      console.error("Error general:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🚀 FUNCIÓN VIP: UPGRADE DE ATLETA (SOLO ÉLITE)
  const handleChangeAthletePlan = async (newPlan) => {
    if (!window.confirm(`¿Ascender/Degradar a este atleta al plan ${newPlan}?`)) return;
    try {
      const { error } = await supabase.from('athletes_profile').update({ b2c_plan: newPlan }).eq('id', athlete.id);
      if (error) throw error;
      setAthlete({...athlete, b2c_plan: newPlan});
      alert(`✅ Plan del atleta actualizado exitosamente a ${newPlan}.`);
    } catch (err) {
      alert("❌ Error actualizando plan: " + err.message);
    }
  };

  const handleExChange = (dayIndex, exIndex, field, value) => {
    if (!coachIsElite) return;
    const newPlan = [...editablePlan];
    newPlan[dayIndex].exercises[exIndex][field] = value;
    setEditablePlan(newPlan);
  };

  const handleAddExercise = (dayIndex) => {
    if (!coachIsElite) return;
    const newPlan = [...editablePlan];
    newPlan[dayIndex].exercises.push({ name: 'Nuevo Ejercicio', muscle: 'Personalizado', type: 'Adicional', sets: 3, reps: '10', rir: '1', restSets: '90s', technique: 'Técnica Coach', execution: 'Focus.' });
    setEditablePlan(newPlan);
  };

  const handleRemoveExercise = (dayIndex, exIndex) => {
    if (!coachIsElite) return;
    const newPlan = [...editablePlan];
    newPlan[dayIndex].exercises.splice(exIndex, 1);
    setEditablePlan(newPlan);
  };

  const handleApproveRoutine = async () => {
    try {
      const { error } = await supabase.from('athletes_profile').update({ routine_status: 'APPROVED', training_plan: editablePlan, coach_note: coachNote }).eq('id', athlete.id);
      if (error) throw error;
      setAthlete({ ...athlete, routine_status: 'APPROVED' });
      alert("✅ Protocolo Élite Guardado y Aprobado.");
    } catch (err) { alert("❌ Error de guardado."); }
  };

  const handleGenerateDiagnosis = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return alert("⚠️ Falta la API Key de Gemini en tu archivo .env");
    setAiLoading(true);
    try {
      const promptText = `Actúa como un entrenador y nutriólogo clínico. Atleta: ${athlete.full_name}, ${athlete.age} años, ${athlete.weight}kg. Objetivo: ${athlete.goal}. Lesiones: ${athlete.injuries}. Genera un "Diagnóstico Asistido por IA" clínico, máximo 3 párrafos. Estructura: 1. Perfil Metabólico. 2. Puntos Críticos. 3. Enfoque de Protocolo. Tono clínico, agresivo, directo. No saludes.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message);
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      setDiagnosis(aiText);
      await supabase.from('athletes_profile').update({ ai_diagnosis: aiText }).eq('id', athlete.id);
    } catch (error) { alert(`❌ Error IA: ${error.message}`); } finally { setAiLoading(false); }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin" color={theme?.brandColor || '#f59e0b'} size={40}/></div>;
  if (!athlete) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><p className="text-red-500">Atleta no encontrado</p></div>;

  const currentDayCoach = editablePlan?.find(d => d.day === activeDayCoach);
  const metrics = athlete?.discipline_metrics;
  const currentPhotoSet = allPhotos.find(p => p.week_number === selectedWeekFilter);

  let adherenceScore = 0, tScore = 0, nScore = 0, rScore = 0;
  if (metrics) {
    if (metrics.training?.completed === 'YES') tScore = 100; else if (metrics.training?.completed === 'PARTIAL') tScore = 50;
    if (metrics.meals && metrics.meals.length > 0) {
      let mealPts = 0;
      metrics.meals.forEach(m => { if (m.status === 'YES') mealPts += 20; else if (m.status === 'PARTIAL') mealPts += 10; });
      nScore = mealPts;
    }
    const sleep = parseFloat(metrics.metrics?.sleep || 0), water = parseFloat(metrics.metrics?.water || 0);
    let recPts = 0;
    if (sleep >= 7) recPts += 50; else if (sleep >= 5) recPts += 25;
    if (water >= 2.5) recPts += 50; else if (water >= 1.5) recPts += 25;
    rScore = recPts;
    adherenceScore = Math.round((tScore * 0.4) + (nScore * 0.4) + (rScore * 0.2));
  }
  const scoreColor = adherenceScore >= 80 ? 'text-green-500' : adherenceScore >= 50 ? 'text-yellow-500' : 'text-red-500';

  const PHASE_UI = {
    MENSTRUAL: { name: "Fase Menstrual", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/30", icon: <Droplets size={20} className="text-rose-500" />, desc: "Niveles bajos. Inflamación elevada.", training: "Bajar RIR (2-3 reps reserva). Reducir volumen 10-20%. No buscar PRs.", nutrition: "Priorizar hierro y Omega-3." },
    FOLICULAR: { name: "Fase Folicular", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30", icon: <Wind size={20} className="text-blue-500" />, desc: "Estrógeno subiendo. Alta tolerancia al dolor.", training: "Sobrecarga pesada. Buscar Fallo (RIR 0-1).", nutrition: "Aumentar carbohidratos complejos 10-15%." },
    OVULATORIA: { name: "Fase Ovulatoria", color: "text-green-500", bg: "bg-green-500/10 border-green-500/30", icon: <Flame size={20} className="text-green-500" />, desc: "Pico máximo de estrógeno y testosterona.", training: "Pico de fuerza (PRs). Cuidar ligamentos rodillas.", nutrition: "Metabolismo basal aumenta ligeramente." },
    LUTEA: { name: "Fase Lútea", color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/30", icon: <BrainCircuit size={20} className="text-purple-500" />, desc: "Progesterona domina. Temperatura elevada.", training: "Transición a tensión mecánica. Evitar fallo extremo.", nutrition: "Reducir carbos, incrementar grasas y magnesio." }
  };
  const hormonal = athlete?.hormonal_data;
  const hPhase = hormonal?.currentPhase ? PHASE_UI[hormonal.currentPhase] : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-20">
      
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-800 px-4 py-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => navigate('/coach')} className="flex items-center gap-2 text-neutral-500 hover:text-white mb-2 text-[10px] font-black uppercase tracking-widest"><ArrowLeft size={14} /> Volver al Roster</button>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black uppercase tracking-tight">Expediente 360°</h1>
                {!athlete.program_start_date && (
                  <button 
                    onClick={async () => {
                      if(!window.confirm("¿Iniciar el cronómetro de 12 Semanas?")) return;
                      await supabase.from('athletes_profile').update({ program_start_date: new Date().toISOString() }).eq('id', athlete.id);
                      setAthlete({...athlete, program_start_date: new Date().toISOString()});
                      alert("✅ Atleta Activado exitosamente.");
                    }} 
                    className="bg-green-600 hover:bg-green-500 text-white font-black uppercase text-[9px] px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1 transition-colors"
                  >
                    <CheckCircle2 size={12}/> Activar
                  </button>
                )}
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">Atleta: <span className="font-bold text-white uppercase">{athlete.full_name || 'Sin Nombre'}</span> | Plan: <span style={{ color: theme?.brandColor || '#f59e0b' }} className="font-bold">{athlete.b2c_plan || 'N/A'}</span></p>
            </div>

            <div className="flex overflow-x-auto w-full sm:w-auto gap-2 pb-1 scrollbar-hide">
              <button onClick={() => setActiveTab('OVERVIEW')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><LayoutDashboard size={14}/> General</button>
              <button onClick={() => setActiveTab('TRAINING')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'TRAINING' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><Dumbbell size={14}/> Matriz Técnica</button>
              <button onClick={() => setActiveTab('DISCIPLINE')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'DISCIPLINE' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><Activity size={14}/> Auditoría Diaria</button>
              <button onClick={() => setActiveTab('GALLERY')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'GALLERY' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><Camera size={14}/> Galería Visual</button>
              <button onClick={() => setActiveTab('AI')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'AI' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-neutral-900 text-blue-500 hover:text-white border border-blue-900/50'}`}><BrainCircuit size={14}/> Auditor IA</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8">
        
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* LADO IZQUIERDO: BIOMETRÍA Y SUSCRIPCIÓN */}
            <div className="space-y-6">
              <div className="bg-[#111] border border-neutral-800 p-6 rounded-3xl h-fit">
                <h2 className="text-xs font-black uppercase text-neutral-400 mb-6 flex items-center gap-2"><User size={16} style={{ color: theme?.brandColor || '#f59e0b' }}/> Biometría Base</h2>
                <div className="space-y-4">
                  <div className="flex justify-between border-b border-neutral-800/50 pb-3"><span className="text-xs text-neutral-500">Género</span><span className="text-sm font-bold uppercase text-white">{athlete.gender || 'N/A'}</span></div>
                  <div className="flex justify-between border-b border-neutral-800/50 pb-3"><span className="text-xs text-neutral-500">Edad</span><span className="text-sm font-bold text-white">{athlete.age || 0} años</span></div>
                  <div className="flex justify-between border-b border-neutral-800/50 pb-3"><span className="text-xs text-neutral-500">Peso Base</span><span className="text-sm font-bold text-white">{athlete.weight || 0} kg</span></div>
                  <div className="flex justify-between border-b border-neutral-800/50 pb-3"><span className="text-xs text-neutral-500">Objetivo</span><span className="text-sm font-black text-blue-400">{athlete.goal || 'N/A'}</span></div>
                  <div className="flex justify-between border-b border-neutral-800/50 pb-3"><span className="text-xs text-neutral-500">Lesiones</span><span className="text-[10px] font-mono text-red-400 max-w-[60%] text-right">{athlete.injuries || 'Ninguna'}</span></div>
                </div>
              </div>

              {/* 🚀 TARJETA DE GESTIÓN VIP (SOLO ÉLITE) */}
              {coachIsElite && (
                <div className="bg-[#111] border border-neutral-800 p-6 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: theme?.brandColor || '#f59e0b' }}></div>
                  <h2 className="text-xs font-black uppercase text-neutral-400 mb-4 flex items-center gap-2 relative z-10"><Target size={16} style={{ color: theme?.brandColor || '#f59e0b' }}/> Gestión de Suscripción VIP</h2>
                  <div className="flex items-center justify-between relative z-10 bg-black/50 p-4 rounded-xl border border-neutral-800">
                    <div>
                      <p className="text-[10px] font-black uppercase text-neutral-500 mb-1">Plan Actual</p>
                      <p className="text-sm font-bold text-white">{athlete.b2c_plan}</p>
                    </div>
                    <div>
                      <select 
                        value={athlete.b2c_plan} 
                        onChange={(e) => handleChangeAthletePlan(e.target.value)} 
                        className="bg-black border border-neutral-700 rounded-xl p-2 text-xs font-mono font-bold uppercase text-white outline-none focus:border-white transition-colors cursor-pointer hover:bg-neutral-900"
                      >
                        <option value="IGNICION">Plan Ignición</option>
                        <option value="EVOLUCION">Plan Evolución</option>
                        <option value="ELITE">Plan Élite 360</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* LADO DERECHO: MÉTRICAS Y HORMONAS */}
            <div className="space-y-6">
              <div className="bg-[#111] border border-neutral-800 p-6 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: theme?.brandColor || '#f59e0b' }}></div>
                <h2 className="text-xs font-black uppercase text-neutral-400 mb-6 flex items-center gap-2"><TrendingUp size={16} style={{ color: theme?.brandColor || '#f59e0b' }}/> Score de Adherencia Global</h2>
                {metrics ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                        <svg className="w-full h-full transform -rotate-90"><circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-neutral-900" /><circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray="226" strokeDashoffset={226 - (226 * adherenceScore) / 100} className={`${scoreColor} transition-all duration-1000 ease-out`} /></svg>
                        <div className="absolute flex flex-col items-center justify-center"><span className={`text-xl font-black font-mono leading-none ${scoreColor}`}>{adherenceScore}%</span></div>
                      </div>
                      <div>
                        <h3 className="text-xs font-black uppercase text-white mb-1">Resumen Diario</h3>
                        <p className="text-[10px] text-neutral-500 font-mono leading-tight">Cálculo en base al último Check-in del atleta.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div><div className="flex justify-between text-[9px] font-black uppercase text-neutral-400 mb-1.5"><span>Nutrición (40%)</span><span className="text-white">{nScore}%</span></div><div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${nScore}%` }}></div></div></div>
                      <div><div className="flex justify-between text-[9px] font-black uppercase text-neutral-400 mb-1.5"><span>Entrenamiento (40%)</span><span className="text-white">{tScore}%</span></div><div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden"><div className="h-full bg-green-500 rounded-full" style={{ width: `${tScore}%` }}></div></div></div>
                      <div><div className="flex justify-between text-[9px] font-black uppercase text-neutral-400 mb-1.5"><span>Recuperación (20%)</span><span className="text-white">{rScore}%</span></div><div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden"><div className="h-full bg-purple-500 rounded-full" style={{ width: `${rScore}%` }}></div></div></div>
                    </div>
                  </div>
                ) : (<div className="py-6 text-center border-2 border-dashed border-neutral-800 rounded-2xl"><p className="text-xs font-mono text-neutral-500">Sin datos de adherencia.</p></div>)}
              </div>

              {athlete?.gender?.toUpperCase() === 'FEMENINO' && hormonal && hPhase && (
                <div className="bg-[#111] border border-neutral-800 p-6 rounded-3xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-50" style={{ color: hPhase.color.replace('text-', 'bg-') }}></div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xs font-black uppercase text-neutral-400 flex items-center gap-2"><Droplets size={16} className="text-pink-500" /> Bio-Tracker Femenino</h2>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${hPhase.bg} ${hPhase.color}`}>Día {hormonal.currentDayOfCycle}</span>
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${hPhase.bg} shrink-0`}>{hPhase.icon}</div>
                    <div><h3 className={`text-lg font-black uppercase tracking-tight leading-none ${hPhase.color}`}>{hPhase.name}</h3><p className="text-[10px] text-neutral-500 font-mono mt-1">Ciclo de {hormonal.cycleLength} días</p></div>
                  </div>
                  <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden mb-5"><div className="h-full bg-pink-500 rounded-full" style={{ width: `${(hormonal.currentDayOfCycle / (hormonal.cycleLength || 28)) * 100}%` }}></div></div>
                  <div className="space-y-3">
                    <p className="text-[11px] font-mono text-neutral-400 leading-relaxed pb-2 border-b border-neutral-800/50">{hPhase.desc}</p>
                    <div className="bg-black/50 border border-neutral-800 rounded-xl p-3"><h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1.5 flex items-center gap-2"><Dumbbell size={12}/> Ajuste Biomecánico</h4><p className="text-[11px] text-neutral-300 font-mono leading-relaxed">{hPhase.training}</p></div>
                    <div className="bg-black/50 border border-neutral-800 rounded-xl p-3"><h4 className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1.5 flex items-center gap-2"><Utensils size={12}/> Ajuste Metabólico</h4><p className="text-[11px] text-neutral-300 font-mono leading-relaxed">{hPhase.nutrition}</p></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* LAS OTRAS PESTAÑAS (TRAINING, DISCIPLINE, GALLERY, AI) PERMANECEN INTACTAS ABAJO... */}
        {activeTab === 'TRAINING' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-[#111] border border-neutral-800 p-6 rounded-3xl relative overflow-hidden max-w-4xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-black uppercase text-neutral-400 flex items-center gap-2"><Dumbbell size={16} style={{ color: theme?.brandColor || '#f59e0b' }}/> Edición de Arquitectura B2B</h2>
                  <span className="text-[9px] bg-blue-500/20 border border-blue-500/30 text-blue-400 px-3 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                    <Target size={10} /> Hoy Toca: Día {calculatedCurrentDay}
                  </span>
                </div>
                <div className="flex gap-2">
                  {athlete.routine_status === 'PENDING_AUDIT' && <span className="text-[10px] bg-yellow-500/20 text-yellow-500 px-3 py-1 rounded-full font-bold uppercase animate-pulse">Pendiente Aprobación</span>}
                  {athlete.routine_status === 'APPROVED' && <span className="text-[10px] bg-green-500/20 text-green-500 px-3 py-1 rounded-full font-bold uppercase">Rutina Activa y Aprobada</span>}
                </div>
              </div>

              {!coachIsElite && editablePlan && (
                 <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md">
                   <div className="text-center max-w-sm px-6">
                     <div className="w-12 h-12 rounded-full bg-neutral-900 flex items-center justify-center border border-neutral-800 mx-auto mb-4"><Lock size={20} className="text-neutral-400" /></div>
                     <h3 className="font-black uppercase text-lg text-white mb-2">Override Bloqueado</h3>
                     <p className="text-[11px] text-neutral-400 font-mono mb-6">La edición de matrices es exclusiva del plan ÉLITE.</p>
                   </div>
                 </div>
              )}

              {editablePlan ? (
                <div className={`space-y-6 ${!coachIsElite ? 'opacity-30 pointer-events-none blur-sm' : ''}`}>
                  <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4">
                    <label className="text-[10px] font-black uppercase text-neutral-500 flex items-center gap-2 mb-2"><MessageSquareQuote size={14} style={{ color: theme?.brandColor || '#f59e0b' }}/> Anuncio Especial para la Rutina</label>
                    <textarea value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="Escribe instrucciones especiales que el atleta verá como un banner en su app..." className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs font-mono text-white outline-none h-20 resize-none" />
                  </div>

                  <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide border-b border-neutral-800">
                    {editablePlan.map(day => (
                      <button key={day.day} onClick={() => setActiveDayCoach(day.day)} className={`px-4 py-3 rounded-t-xl text-[10px] font-bold uppercase transition-all ${activeDayCoach === day.day ? 'bg-neutral-800 text-white border-b-2 border-white' : day.day === calculatedCurrentDay ? 'bg-blue-900/20 text-blue-400' : 'bg-transparent text-neutral-500 hover:text-white'}`}>
                        Día {day.day} {day.day === calculatedCurrentDay && '(Hoy)'}
                      </button>
                    ))}
                  </div>

                  {currentDayCoach && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-white uppercase">{currentDayCoach.title}</span>
                        <button onClick={() => handleAddExercise(editablePlan.indexOf(currentDayCoach))} className="text-[10px] flex items-center gap-1 bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg text-neutral-300 hover:bg-white"><Plus size={12}/> Añadir Ejercicio</button>
                      </div>
                      {(currentDayCoach.exercises || []).map((exe, exIndex) => {
                        const dayIndex = editablePlan.indexOf(currentDayCoach);
                        return (
                          <div key={exIndex} className="bg-black border border-neutral-800 rounded-2xl p-4 flex gap-4">
                            <div className="flex-1 space-y-3">
                              <input value={exe.name} onChange={(e) => handleExChange(dayIndex, exIndex, 'name', e.target.value)} className="bg-transparent text-sm font-bold text-white outline-none w-full border-b border-neutral-800 pb-1 focus:border-neutral-500"/>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div><label className="text-[8px] uppercase text-neutral-500 font-bold block mb-1">Sets</label><input value={exe.sets} onChange={(e) => handleExChange(dayIndex, exIndex, 'sets', e.target.value)} className="w-full bg-neutral-900 rounded p-1.5 text-xs text-center border border-neutral-800 outline-none text-white"/></div>
                                <div><label className="text-[8px] uppercase text-neutral-500 font-bold block mb-1">Reps</label><input value={exe.reps} onChange={(e) => handleExChange(dayIndex, exIndex, 'reps', e.target.value)} className="w-full bg-neutral-900 rounded p-1.5 text-xs text-center border border-neutral-800 outline-none text-white"/></div>
                                <div><label className="text-[8px] uppercase text-neutral-500 font-bold block mb-1">RIR (Fallo)</label><input value={exe.rir} onChange={(e) => handleExChange(dayIndex, exIndex, 'rir', e.target.value)} className="w-full bg-neutral-900 rounded p-1.5 text-xs text-center border border-neutral-800 outline-none text-white"/></div>
                                <div><label className="text-[8px] uppercase text-neutral-500 font-bold block mb-1">Descanso</label><input value={exe.restSets} onChange={(e) => handleExChange(dayIndex, exIndex, 'restSets', e.target.value)} className="w-full bg-neutral-900 rounded p-1.5 text-xs text-center border border-neutral-800 outline-none text-white"/></div>
                              </div>
                            </div>
                            <button onClick={() => handleRemoveExercise(dayIndex, exIndex)} className="text-neutral-600 hover:text-red-500 mt-2">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <button onClick={handleApproveRoutine} className="w-full mt-4 flex justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                    <CheckCircle2 size={16}/> Guardar Override y Aprobar Protocolo
                  </button>
                </div>
              ) : (<div className="py-12 text-center border-2 border-dashed border-neutral-800 rounded-2xl"><p className="text-xs font-mono text-neutral-500">Atleta no ha generado su matriz base en Trainer Pro.</p></div>)}
            </div>
          </div>
        )}

        {activeTab === 'DISCIPLINE' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-4xl mx-auto">
            <div className="bg-[#111] border border-neutral-800 p-6 rounded-3xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs font-black uppercase text-neutral-400 flex items-center gap-2"><Activity size={16} style={{ color: theme?.brandColor || '#f59e0b' }}/> Reporte de Disciplina Diaria</h2>
              </div>
              
              {metrics ? (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center"><Droplet size={20} className="text-blue-400 mx-auto mb-2" /><span className="text-2xl font-black font-mono block text-white">{metrics.metrics?.water || '0'} L</span><span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Agua</span></div>
                    <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center"><Moon size={20} className="text-purple-400 mx-auto mb-2" /><span className="text-2xl font-black font-mono block text-white">{metrics.metrics?.sleep || '0'} Hrs</span><span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Sueño</span></div>
                    <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center"><Footprints size={20} className="text-green-400 mx-auto mb-2" /><span className="text-2xl font-black font-mono block text-white">{metrics.metrics?.steps || '0'}</span><span className="text-[9px] uppercase font-black tracking-widest text-neutral-500">Pasos</span></div>
                  </div>
                  
                  {metrics.training?.difficulty_note && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5">
                      <span className="text-[10px] uppercase font-black tracking-widest text-yellow-500 block mb-2 flex items-center gap-2"><AlertTriangle size={14}/> Nota de Dificultad del Atleta:</span>
                      <p className="text-sm text-yellow-200/90 font-mono italic">"{metrics.training.difficulty_note}"</p>
                    </div>
                  )}
                  
                  {metrics.meals && (
                    <div>
                      <span className="text-xs font-black uppercase text-neutral-400 block mb-4 border-b border-neutral-800 pb-2">Evidencia Nutricional (Fotos Diarias)</span>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        {(metrics.meals || []).map((m, i) => (
                          <div key={i} className="bg-black border border-neutral-800 rounded-xl p-3 text-center flex flex-col items-center">
                            <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-2">Comida {m.meal_num}</span>
                            <div className="w-full aspect-square bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center mb-2 shadow-inner">
                              {m.photo_url ? <img src={m.photo_url} alt="Comida" className="w-full h-full object-cover cursor-pointer hover:scale-110 transition-transform" onClick={() => window.open(m.photo_url, '_blank')} /> : <Utensils size={16} className="text-neutral-700" />}
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-neutral-900 border ${m.status === 'YES' ? 'text-green-500 border-green-900/30' : m.status === 'PARTIAL' ? 'text-yellow-500 border-yellow-900/30' : 'text-red-500 border-red-900/30'}`}>{m.status === 'YES' ? 'Cumplido' : m.status === 'PARTIAL' ? 'A medias' : 'Falló'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center border-2 border-dashed border-neutral-800 rounded-2xl"><p className="text-xs font-mono text-neutral-500">Sin reportes diarios de disciplina.</p></div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'GALLERY' && (
          <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
            
            <div className="bg-[#111] border border-neutral-800 p-6 rounded-3xl">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-neutral-800 pb-4">
                <div>
                  <h2 className="text-sm font-black uppercase text-white flex items-center gap-2">
                    <Camera size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Galería de Evaluación Corporal
                  </h2>
                  <p className="text-[10px] text-neutral-500 font-mono mt-1">Registros fotográficos obligatorios de Frente, Perfil y Espalda.</p>
                </div>

                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 scrollbar-hide">
                  {[0, 3, 6, 9, 12].map(wk => (
                    <button
                      key={wk}
                      onClick={() => setSelectedWeekFilter(wk)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase transition-all ${selectedWeekFilter === wk ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:text-white'}`}
                    >
                      {wk === 0 ? 'Semana 0 (Inicio)' : `Semana ${wk}`}
                    </button>
                  ))}
                </div>
              </div>

              {currentPhotoSet ? (
                <div className="space-y-4">
                  {currentPhotoSet.weight_recorded && (
                    <p className="text-xs font-mono text-neutral-400 bg-black border border-neutral-800 px-4 py-2 rounded-xl w-fit">
                      Peso en esta fecha: <strong className="text-amber-500">{currentPhotoSet.weight_recorded} KG</strong>
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-black border border-neutral-800 rounded-2xl p-3 relative group">
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 mb-2">
                        <img src={currentPhotoSet.front_url} alt="Frente" className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer" onClick={() => window.open(currentPhotoSet.front_url, '_blank')} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block text-center">1. Frente</span>
                    </div>

                    <div className="bg-black border border-neutral-800 rounded-2xl p-3 relative group">
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 mb-2">
                        <img src={currentPhotoSet.side_url} alt="Perfil" className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer" onClick={() => window.open(currentPhotoSet.side_url, '_blank')} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block text-center">2. Perfil / Lado</span>
                    </div>

                    <div className="bg-black border border-neutral-800 rounded-2xl p-3 relative group">
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-neutral-900 mb-2">
                        <img src={currentPhotoSet.back_url} alt="Espalda" className="w-full h-full object-cover group-hover:scale-105 transition-transform cursor-pointer" onClick={() => window.open(currentPhotoSet.back_url, '_blank')} />
                      </div>
                      <span className="text-[10px] font-black uppercase text-neutral-400 tracking-widest block text-center">3. Espalda</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center border-2 border-dashed border-neutral-800 rounded-2xl space-y-2">
                  <ImageIcon size={32} className="text-neutral-700 mx-auto" />
                  <p className="text-xs font-mono text-neutral-500">No hay fotos registradas para la Semana {selectedWeekFilter}.</p>
                </div>
              )}
            </div>

          </div>
        )}

        {activeTab === 'AI' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-3xl mx-auto">
            <div className="bg-neutral-900/50 border border-blue-900/30 p-1 rounded-3xl relative overflow-hidden shadow-[0_0_50px_rgba(37,99,235,0.1)]">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
              
              <div className="bg-[#0a0a0a] p-8 rounded-[1.3rem] h-full relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-neutral-800/50 pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/30 shrink-0"><BrainCircuit className="text-blue-500" size={24}/></div>
                    <div>
                      <h2 className="text-xl font-black uppercase tracking-tight text-white">Auditor Clínico IA</h2>
                      <p className="text-[11px] text-blue-400 font-mono mt-1">Potenciado por Google Gemini Flash 1.5</p>
                    </div>
                  </div>
                  
                  <button onClick={handleGenerateDiagnosis} disabled={aiLoading} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50 flex items-center justify-center gap-2">
                    {aiLoading ? <Loader2 size={16} className="animate-spin"/> : 'Generar Análisis Clínico'}
                  </button>
                </div>

                <div className="bg-[#111] border border-neutral-800 rounded-2xl p-8 min-h-[300px]">
                  {diagnosis ? (
                    <div className="prose prose-invert prose-sm max-w-none prose-p:text-neutral-300 prose-p:leading-relaxed prose-strong:text-blue-400 font-mono text-sm">
                      {diagnosis.split('\n').map((paragraph, index) => <p key={index} className="mb-4">{paragraph}</p>)}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-50">
                      <BrainCircuit size={48} className="text-neutral-700 mb-4" />
                      <p className="text-sm font-mono text-neutral-400 max-w-md mx-auto">La Inteligencia Artificial cruzará la biometría, lesiones y objetivos del atleta para generar un resumen médico-deportivo altamente preciso.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}