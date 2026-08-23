import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  ArrowLeft, User, Image as ImageIcon, BrainCircuit, Activity, 
  Loader2, Dumbbell, CheckCircle2, Lock, Plus, MessageSquareQuote, 
  Droplet, Moon, Footprints, Utensils, AlertTriangle, Target, 
  TrendingUp, Droplets, Wind, Flame, LayoutDashboard, Camera,
  ShieldCheck, Save, Beaker, Calendar, FileText, FileSpreadsheet, Edit3,
  Bell, X, ShoppingCart, Info, Zap
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

// 🔥 IMPORTACIONES CLAVE CORREGIDAS PARA EL PDF Y EXCEL
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const roundToHalf = (num) => Math.round(num * 2) / 2;

// Íconos disponibles para que el Coach personalice sus botones
const AVAILABLE_ICONS = [
  { id: 'Activity', name: 'Gráfica / Estudio' },
  { id: 'ShoppingCart', name: 'Carrito / Pesaje' },
  { id: 'Beaker', name: 'Ciencia / Hacks' },
  { id: 'Info', name: 'Información / Teoría' },
  { id: 'ShieldCheck', name: 'Seguridad / Reglas' },
  { id: 'FileText', name: 'Documento / Recetas' },
  { id: 'Zap', name: 'Energía / Tips' },
  { id: 'Flame', name: 'Fuego / Quemadores' }
];

const DEFAULT_CHART = {
  enabled: true, type: 'line', yAxisLabel: 'Masa Muscular (Kg)',
  labels: 'Semana 0, Semana 2, Semana 4, Semana 6, Semana 8, Semana 10, Semana 12',
  datasets: [
    { id: '1', label: 'Grupo A (Peri-Entreno)', data: '0, 0.7, 1.5, 2.3, 3.0, 3.7, 4.2', color: 'blue' },
    { id: '2', label: 'Grupo B (Control)', data: '0, 0.2, 0.4, 0.6, 0.8, 0.9, 1.1', color: 'slate' }
  ]
};

const DynamicIcon = ({ name, size = 20, className = "" }) => {
  const IconMap = { Activity, ShoppingCart, Beaker, Info, ShieldCheck, FileText, Zap, Flame };
  const IconComponent = IconMap[name] || Info;
  return <IconComponent size={size} className={className} />;
};

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
  
  // ⚡ ANCHOR V4: ESTADO GLOBAL DEL PROTOCOLO
  const [routineStatus, setRoutineStatus] = useState('NEW');

  // 🏋️ ESTADOS ENTRENAMIENTO
  const [editablePlan, setEditablePlan] = useState(null);
  const [coachNote, setCoachNote] = useState('');
  const [activeDayCoach, setActiveDayCoach] = useState(1);
  const [calculatedCurrentDay, setCalculatedCurrentDay] = useState(1);
  
  const [activeTab, setActiveTab] = useState('OVERVIEW'); 

  // 🍎 ESTADOS NUTRICIÓN
  const [editProtein, setEditProtein] = useState(0);
  const [editCarbs, setEditCarbs] = useState(0);
  const [editFats, setEditFats] = useState(0);
  const [editCalories, setEditCalories] = useState(0);
  const [weeklyCalendar, setWeeklyCalendar] = useState([]);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState('Lunes');
  const [isSavingDiet, setIsSavingDiet] = useState(false);

  // 🧰 ESTADOS CUSTOMIZACIÓN
  const [editAlerts, setEditAlerts] = useState([]);
  const [editTools, setEditTools] = useState([]);
  const [editChart, setEditChart] = useState(DEFAULT_CHART);

  useEffect(() => { fetchExpediente(); }, [id]);

  useEffect(() => {
    setEditCalories(Math.round((editProtein * 4) + (editCarbs * 4) + (editFats * 9)));
  }, [editProtein, editCarbs, editFats]);

  const fetchExpediente = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: coachData } = await supabase.from('coaches_profile').select('b2b_plan').eq('user_id', session.user.id).maybeSingle();
      if (coachData?.b2b_plan === 'ELITE') setCoachIsElite(true);

      const { data: profileData } = await supabase.from('athletes_profile').select('*').or(`id.eq.${id},user_id.eq.${id}`).maybeSingle();
      if (!profileData) return setLoading(false);

      setAthlete(profileData);
      
      // ESTADOS BÁSICOS
      if (profileData.ai_diagnosis) setDiagnosis(profileData.ai_diagnosis);
      if (profileData.training_plan) setEditablePlan(profileData.training_plan);
      if (profileData.coach_note) setCoachNote(profileData.coach_note);
      
      // ANCHOR V4: Única fuente de verdad
      setRoutineStatus(profileData.routine_status || 'NEW');

      // CARGA DE CUSTOMIZACIONES B2B
      if (profileData.coach_customizations) {
        setEditAlerts(profileData.coach_customizations.alerts || []);
        setEditTools(profileData.coach_customizations.tools || []);
        setEditChart(profileData.coach_customizations.chart || DEFAULT_CHART);
      } else {
        setEditAlerts([{ id: 'def1', color: 'red', title: 'Regla Innegociable: Peri-Entrenamiento', desc: 'El Post-Entreno exige proteína rápida + Carbohidrato simple para frenar el cortisol.' }]);
        setEditTools([
          { id: 't1', icon: 'Activity', shortTitle: 'Estudio', title: 'Estudio Clínico Deportivo', content: 'Detalle de la metodología de suplementación...', showChart: true },
          { id: 't2', icon: 'ShoppingCart', shortTitle: 'Pesaje', title: 'Reglas de Pesaje', content: 'Carnes: CRUDAS.\nGranos/Pasta: COCIDOS.\nAvena: CRUDA.', showChart: false }
        ]);
        setEditChart(DEFAULT_CHART);
      }

      // CARGA DE NUTRICIÓN Y CALENDARIO
      let initialTotals; let initialMeals;
      if (profileData.custom_macros) {
        initialTotals = profileData.custom_macros.totals;
        initialMeals = profileData.custom_macros.meals;
        if (profileData.custom_macros.weekly_calendar?.length > 0) {
          setWeeklyCalendar(profileData.custom_macros.weekly_calendar);
        } else {
          setWeeklyCalendar(generateDefaultWeeklyCalendar(initialMeals));
        }
      } else {
        initialTotals = calculateBaseMacros(profileData.weight, profileData.goal);
        const dist = [ { p: 0.2, c: 0.20, f: 0.25 }, { p: 0.2, c: 0.25, f: 0.30 }, { p: 0.2, c: 0.30, f: 0.00 }, { p: 0.2, c: 0.15, f: 0.25 }, { p: 0.2, c: 0.10, f: 0.20 } ];
        initialMeals = dist.map(d => ({ p: Math.round(initialTotals.protein * d.p), c: Math.round(initialTotals.carbs * d.c), f: Math.round(initialTotals.fats * d.f) }));
        setWeeklyCalendar(generateDefaultWeeklyCalendar(initialMeals));
      }

      setEditProtein(initialTotals.protein); setEditCarbs(initialTotals.carbs); setEditFats(initialTotals.fats); setEditCalories(initialTotals.calories);

      // CÁLCULO DEL DÍA ACTUAL
      if (profileData.program_start_date) {
        const start = new Date(profileData.program_start_date); start.setHours(0,0,0,0);
        const diffDays = Math.floor((new Date().setHours(0,0,0,0) - start) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) { setCalculatedCurrentDay((diffDays % 6) + 1); setActiveDayCoach((diffDays % 6) + 1); }
      }
      
      const { data: photosData } = await supabase.from('athlete_photos').select('*').eq('athlete_id', profileData.id).order('week_number', { ascending: true });
      setAllPhotos(photosData || []);

    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const calculateBaseMacros = (weightKg, goal) => {
    let proMultiplier = 2.2; let fatMultiplier = 0.8; let carbMultiplier = 3.0; 
    if (goal === 'Pérdida de Grasa') { carbMultiplier = 1.5; proMultiplier = 2.5; } else if (goal === 'Ganancia Muscular') { carbMultiplier = 4.5; fatMultiplier = 1.0; }
    const protein = Math.round((weightKg || 70) * proMultiplier); const fats = Math.round((weightKg || 70) * fatMultiplier); const carbs = Math.round((weightKg || 70) * carbMultiplier);
    return { calories: Math.round((protein * 4) + (carbs * 4) + (fats * 9)), protein, carbs, fats };
  };

  const generateDefaultWeeklyCalendar = (meals) => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const calendar = [];
    days.forEach(day => {
      meals.forEach((m, idx) => {
        let foodItem = ""; let scaleGrams = ""; let why = "";
        if(idx === 0) { foodItem = "Huevos Enteros + Claras extras"; scaleGrams = `${Math.floor(m.f/5)} Ent + ${Math.round(m.p/3.6)} Clar`; why = "Alto valor biológico al despertar"; }
        if(idx === 1) { foodItem = day === 'Lunes' || day === 'Miércoles' || day === 'Viernes' ? "Pechuga de Pollo + Arroz Jazmín" : "Pescado Blanco + Papa/Camote"; scaleGrams = `${Math.round(m.p*4.5)}g Prot / ${Math.round(m.c*3.5)}g Carb`; why = "Carbohidratos complejos para energía sostenida"; }
        if(idx === 2) { foodItem = "Aislado de Suero + Crema de Arroz"; scaleGrams = `${roundToHalf(m.p/25)} scoop(s) / ${Math.round(m.c*1.2)}g Crema`; why = "Absorción ultra-rápida (Peri-Entrenamiento)"; }
        if(idx === 3) { foodItem = "Carne Magra o Lomo + Aguacate"; scaleGrams = `${Math.round(m.p*4.8)}g Carne / ${Math.round(m.f*6.6)}g Aguacate`; why = "Grasas saludables post-entrenamiento lejano"; }
        if(idx === 4) { foodItem = "Queso Cottage + Almendras"; scaleGrams = `${Math.round(m.p*8.3)}g Cottage / ${Math.round(m.f*2)}g Almendras`; why = "Caseína (Digestión nocturna lenta)"; }
        calendar.push({ day, meal: `Comida ${idx + 1}`, food: foodItem, scale: scaleGrams, macros: `${m.p}g P | ${m.c}g C | ${m.f}g G`, reason: why });
      });
    });
    return calendar;
  };

  const handleCalendarCellChange = (indexInArray, field, value) => {
    const updated = [...weeklyCalendar]; updated[indexInArray][field] = value; setWeeklyCalendar(updated);
  };

  // 🔔 FUNCIONES BANNERS
  const handleAddAlert = () => setEditAlerts([...editAlerts, { id: `alert_${Date.now()}`, color: 'amber', title: 'Nueva Alerta', desc: 'Instrucción para el atleta...' }]);
  const handleRemoveAlert = (id) => setEditAlerts(editAlerts.filter(a => a.id !== id));
  const handleAlertChange = (id, field, value) => setEditAlerts(editAlerts.map(a => a.id === id ? { ...a, [field]: value } : a));

  // 🧰 FUNCIONES HERRAMIENTAS
  const handleAddTool = () => {
    if (editTools.length >= 6) return alert("Máximo 6 herramientas permitidas.");
    setEditTools([...editTools, { id: `tool_${Date.now()}`, icon: 'Info', shortTitle: 'Botón', title: 'Título Modal', content: 'Contenido...', showChart: false }]);
  };
  const handleRemoveTool = (id) => setEditTools(editTools.filter(t => t.id !== id));
  const handleToolChange = (id, field, value) => setEditTools(editTools.map(t => t.id === id ? { ...t, [field]: value } : t));

  // 📈 FUNCIONES GRÁFICA
  const handleChartChange = (field, value) => setEditChart({ ...editChart, [field]: value });
  const handleAddDataset = () => {
    if (editChart.datasets.length >= 4) return alert("Máximo 4 líneas/barras para no saturar.");
    setEditChart({ ...editChart, datasets: [...editChart.datasets, { id: `ds_${Date.now()}`, label: 'Nueva Serie', data: '0, 1, 2, 3', color: 'blue' }] });
  };
  const handleRemoveDataset = (id) => setEditChart({ ...editChart, datasets: editChart.datasets.filter(d => d.id !== id) });
  const handleDatasetChange = (id, field, value) => setEditChart({ ...editChart, datasets: editChart.datasets.map(d => d.id === id ? { ...d, [field]: value } : d) });

  // ⚡ ANCHOR V4: CAMBIAR ESTADO GLOBAL DEL PROTOCOLO
  const handleStatusChange = async (newStatus) => {
    try {
      const { error } = await supabase.from('athletes_profile').update({ routine_status: newStatus }).eq('id', athlete.id);
      if (error) throw error;
      setRoutineStatus(newStatus);
      setAthlete({ ...athlete, routine_status: newStatus });
      alert(newStatus === 'APPROVED' ? "✅ Expediente APROBADO y Desbloqueado." : "🔒 Expediente en AUDITORÍA y Bloqueado.");
    } catch(err) { alert("Error al cambiar estado: " + err.message); }
  };

  // 🍎 GUARDAR NUTRICIÓN Y UI
  const handleSaveNutritionOverride = async () => {
    setIsSavingDiet(true);
    try {
      const dist = [ { p: 0.2, c: 0.20, f: 0.25 }, { p: 0.2, c: 0.25, f: 0.30 }, { p: 0.2, c: 0.30, f: 0.00 }, { p: 0.2, c: 0.15, f: 0.25 }, { p: 0.2, c: 0.10, f: 0.20 } ];
      const newMeals = dist.map(d => ({ p: Math.round(editProtein * d.p), c: Math.round(editCarbs * d.c), f: Math.round(editFats * d.f) }));
      const custom_macros = { totals: { calories: editCalories, protein: editProtein, carbs: editCarbs, fats: editFats }, meals: newMeals, weekly_calendar: weeklyCalendar };
      const coach_customizations = { alerts: editAlerts, tools: editTools, chart: editChart };

      const { error } = await supabase.from('athletes_profile').update({
        custom_macros: custom_macros, coach_customizations: coach_customizations
      }).eq('id', athlete.id);

      if (error) throw error;
      alert(`✅ Módulo Nutricional Guardado. Asegúrate de tener el "Estado Global" en APROBADO para que el atleta lo vea.`);
    } catch (err) { alert("Error guardando cambios: " + err.message); } finally { setIsSavingDiet(false); }
  };

  const handleChangeAthletePlan = async (newPlan) => {
    if (!window.confirm(`¿Ascender/Degradar a este atleta al plan ${newPlan}?`)) return;
    try {
      const { error } = await supabase.from('athletes_profile').update({ b2c_plan: newPlan }).eq('id', athlete.id);
      if (error) throw error;
      setAthlete({...athlete, b2c_plan: newPlan});
      alert(`✅ Plan del atleta actualizado exitosamente a ${newPlan}.`);
    } catch (err) { alert("❌ Error actualizando plan: " + err.message); }
  };

  const handleExChange = (dayIndex, exIndex, field, value) => {
    if (!coachIsElite) return;
    const newPlan = [...editablePlan]; newPlan[dayIndex].exercises[exIndex][field] = value; setEditablePlan(newPlan);
  };
  
  const handleAddExercise = (dayIndex) => {
    if (!coachIsElite) return;
    const newPlan = [...editablePlan]; newPlan[dayIndex].exercises.push({ name: 'Nuevo Ejercicio', muscle: 'Personalizado', type: 'Adicional', sets: 3, reps: '10', rir: '1', restSets: '90s', technique: 'Coach', execution: 'Focus' }); setEditablePlan(newPlan);
  };
  
  const handleRemoveExercise = (dayIndex, exIndex) => {
    if (!coachIsElite) return;
    const newPlan = [...editablePlan]; newPlan[dayIndex].exercises.splice(exIndex, 1); setEditablePlan(newPlan);
  };
  
  const handleApproveRoutine = async () => {
    try {
      const { error } = await supabase.from('athletes_profile').update({ 
        routine_status: 'APPROVED', 
        training_plan: editablePlan, 
        coach_note: coachNote 
      }).eq('id', athlete.id);
      if (error) throw error;
      setAthlete({ ...athlete, routine_status: 'APPROVED' });
      setRoutineStatus('APPROVED');
      alert("✅ Protocolo Élite Guardado y Aprobado.");
    } catch (err) { alert("❌ Error de guardado."); }
  };

  // 🔥 CORRECCIÓN EXACTA DE LA IA
  const handleGenerateDiagnosis = async () => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) return alert("⚠️ Falta API Key de Gemini");
    
    setAiLoading(true);
    
    try {
      const promptText = `Actúa como un entrenador y nutriólogo de nivel clínico/olímpico. Tengo un nuevo atleta con el siguiente perfil: Nombre: ${athlete.full_name}, Edad: ${athlete.age}, Peso: ${athlete.weight}kg, Objetivo: ${athlete.goal}. Genera un "Diagnóstico Asistido por IA" para mí de máximo 3 párrafos con Puntos Críticos y Enfoque de Protocolo. Tono clínico, agresivo, directo y científico.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "Error conectando con la IA");
      }

      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!aiText) throw new Error("La IA no devolvió contenido válido.");

      setDiagnosis(aiText);
      await supabase.from('athletes_profile').update({ ai_diagnosis: aiText }).eq('id', athlete.id);

    } catch (error) {
      alert(`❌ Error IA: ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Activity className="animate-spin text-amber-500" size={40}/></div>;
  if (!athlete) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><p className="text-red-500">Atleta no encontrado</p></div>;

  const currentDayCoach = editablePlan?.find(d => d.day === activeDayCoach);
  const metrics = athlete?.discipline_metrics;
  const currentPhotoSet = allPhotos.find(p => p.week_number === selectedWeekFilter);

  let adherenceScore = 0, tScore = 0, nScore = 0, rScore = 0;
  if (metrics) {
    if (metrics.training?.completed === 'YES') tScore = 100; else if (metrics.training?.completed === 'PARTIAL') tScore = 50;
    if (metrics.meals && metrics.meals.length > 0) {
      let mealPts = 0; metrics.meals.forEach(m => { if (m.status === 'YES') mealPts += 20; else if (m.status === 'PARTIAL') mealPts += 10; }); nScore = mealPts;
    }
    const sleep = parseFloat(metrics.metrics?.sleep || 0), water = parseFloat(metrics.metrics?.water || 0);
    let recPts = 0; if (sleep >= 7) recPts += 50; else if (sleep >= 5) recPts += 25;
    if (water >= 2.5) recPts += 50; else if (water >= 1.5) recPts += 25; rScore = recPts;
    adherenceScore = Math.round((tScore * 0.4) + (nScore * 0.4) + (rScore * 0.2));
  }
  const scoreColor = adherenceScore >= 80 ? 'text-green-500' : adherenceScore >= 50 ? 'text-yellow-500' : 'text-red-500';

  const PHASE_UI = {
    MENSTRUAL: { name: "Menstrual", color: "text-rose-500", bg: "bg-rose-500/10 border-rose-500/30", icon: <Droplets size={20} className="text-rose-500" />, desc: "Inflamación elevada.", training: "Bajar RIR. No buscar PRs.", nutrition: "Priorizar hierro y Omega-3." },
    FOLICULAR: { name: "Folicular", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/30", icon: <Wind size={20} className="text-blue-500" />, desc: "Alta tolerancia al dolor.", training: "Sobrecarga pesada. RIR 0-1.", nutrition: "Aumentar carbos complejos." },
    OVULATORIA: { name: "Ovulatoria", color: "text-green-500", bg: "bg-green-500/10 border-green-500/30", icon: <Flame size={20} className="text-green-500" />, desc: "Pico de testosterona.", training: "Pico de fuerza (PRs).", nutrition: "Metabolismo basal aumenta." },
    LUTEA: { name: "Lútea", color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/30", icon: <BrainCircuit size={20} className="text-purple-500" />, desc: "Progesterona domina.", training: "Tensión mecánica. Evitar fallo.", nutrition: "Reducir carbos, subir grasas." }
  };
  const hormonal = athlete?.hormonal_data;
  const hPhase = hormonal?.currentPhase ? PHASE_UI[hormonal.currentPhase] : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-20">
      
      {/* NAVBAR B2B */}
      <div className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-neutral-800 px-4 py-4 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <button onClick={() => navigate('/coach')} className="flex items-center gap-2 text-neutral-500 hover:text-white mb-2 text-[10px] font-black uppercase tracking-widest"><ArrowLeft size={14} /> Volver al Roster</button>
          
          {/* PANEL DE CONTROL SUPERIOR */}
          <div className="flex flex-col md:flex-row justify-between items-center bg-[#111] border border-neutral-800 rounded-3xl p-4 shadow-xl gap-4 mb-6 mt-4">
            <div>
              <h2 className="text-sm md:text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Target size={18} className="text-amber-500"/> Estado Global del Protocolo
              </h2>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select 
                value={routineStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                className={`w-full md:w-auto text-xs font-black uppercase tracking-widest p-3 rounded-xl outline-none appearance-none cursor-pointer transition-colors ${routineStatus === 'APPROVED' ? 'bg-green-500/10 text-green-500 border border-green-500/30' : routineStatus === 'PENDING_AUDIT' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30' : 'bg-red-500/10 text-red-500 border border-red-500/30'}`}
              >
                <option value="NEW">🔴 Nuevo / Incompleto</option>
                <option value="PENDING_AUDIT">🔒 Bloqueado (En Auditoría)</option>
                <option value="APPROVED">✅ Aprobado (Desbloqueado)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black uppercase tracking-tight">Expediente 360°</h1>
                {!athlete.program_start_date && (
                  <button onClick={async () => { if(window.confirm("¿Activar Atleta?")) { await supabase.from('athletes_profile').update({ program_start_date: new Date().toISOString() }).eq('id', athlete.id); setAthlete({...athlete, program_start_date: new Date().toISOString()}); } }} className="bg-green-600 text-white font-black uppercase text-[9px] px-3 py-1.5 rounded-lg flex items-center gap-1"><CheckCircle2 size={12}/> Activar</button>
                )}
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">Atleta: <span className="font-bold text-white uppercase">{athlete.full_name || 'Sin Nombre'}</span> | Plan: <span style={{ color: theme?.brandColor || '#f59e0b' }} className="font-bold">{athlete.b2c_plan || 'N/A'}</span></p>
            </div>

            <div className="flex overflow-x-auto w-full sm:w-auto gap-2 pb-1 scrollbar-hide">
              <button onClick={() => setActiveTab('OVERVIEW')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><LayoutDashboard size={14}/> General</button>
              <button onClick={() => setActiveTab('TRAINING')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'TRAINING' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><Dumbbell size={14}/> Entreno</button>
              <button onClick={() => setActiveTab('NUTRITION')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'NUTRITION' ? 'bg-white text-black shadow border border-amber-500/30 text-amber-500' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><Utensils size={14}/> Nutrición y UI</button>
              <button onClick={() => setActiveTab('DISCIPLINE')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'DISCIPLINE' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><Activity size={14}/> Auditoría</button>
              <button onClick={() => setActiveTab('GALLERY')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'GALLERY' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}><Camera size={14}/> Galería</button>
              <button onClick={() => setActiveTab('AI')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'AI' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-neutral-900 text-blue-500 hover:text-white border border-blue-900/50'}`}><BrainCircuit size={14}/> IA</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-8">
        
        {/* ================================================== */}
        {/* 📊 PESTAÑA: VISTA GENERAL (OVERVIEW COMPLETO)       */}
        {/* ================================================== */}
        {activeTab === 'OVERVIEW' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                        className="bg-black border border-neutral-700 rounded-xl p-2 text-xs font-mono font-bold uppercase text-white outline-none cursor-pointer"
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
                        <p className="text-[10px] text-neutral-500 font-mono leading-tight">Último Check-in del atleta.</p>
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

        {/* =================================================================================== */}
        {/* 🍎 PESTAÑA DE NUTRICIÓN Y CONSTRUCTOR B2B (COACH OVERRIDE)                          */}
        {/* =================================================================================== */}
        {activeTab === 'NUTRITION' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* 1. MACROS GLOBALES */}
              <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 shadow-xl">
                <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-4 flex items-center gap-2"><Target size={14}/> Override Metabólico (Macros Totales)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black border border-neutral-800 rounded-xl p-3"><label className="text-[9px] font-black uppercase text-blue-400 block mb-1">Proteína (g)</label><input type="number" value={editProtein} onChange={(e)=>setEditProtein(Number(e.target.value))} className="w-full bg-transparent text-xl font-mono text-white outline-none"/></div>
                  <div className="bg-black border border-neutral-800 rounded-xl p-3"><label className="text-[9px] font-black uppercase text-amber-500 block mb-1">Carbohidratos (g)</label><input type="number" value={editCarbs} onChange={(e)=>setEditCarbs(Number(e.target.value))} className="w-full bg-transparent text-xl font-mono text-white outline-none"/></div>
                  <div className="bg-black border border-neutral-800 rounded-xl p-3"><label className="text-[9px] font-black uppercase text-red-400 block mb-1">Grasas (g)</label><input type="number" value={editFats} onChange={(e)=>setEditFats(Number(e.target.value))} className="w-full bg-transparent text-xl font-mono text-white outline-none"/></div>
                  <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-3 flex flex-col justify-center"><label className="text-[9px] font-black uppercase text-neutral-500 block mb-1">Calorías Totales</label><span className="text-2xl font-black text-white">{editCalories} <span className="text-xs text-neutral-500">kcal</span></span></div>
                </div>
              </div>

              {/* 2. BANNERS DINÁMICOS */}
              <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 shadow-xl flex flex-col">
                <div className="flex justify-between items-center border-b border-neutral-800 pb-4 mb-4">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Bell size={14}/> Banners de Alerta del Coach</h3>
                    <p className="text-[9px] font-mono text-neutral-500 mt-1">Aparecerán de colores en la pantalla del atleta.</p>
                  </div>
                  <button onClick={handleAddAlert} className="text-[9px] font-bold uppercase bg-neutral-900 border border-neutral-700 px-3 py-1.5 rounded-lg text-white hover:bg-neutral-800 flex items-center gap-1"><Plus size={12}/> Añadir</button>
                </div>
                <div className="flex-1 space-y-3 max-h-[250px] overflow-y-auto pr-2">
                  {editAlerts.length === 0 && <p className="text-xs text-neutral-600 font-mono text-center py-4">No hay banners activos.</p>}
                  {editAlerts.map(alert => (
                    <div key={alert.id} className="bg-black border border-neutral-800 rounded-2xl p-3 flex flex-col gap-2 relative">
                      <button onClick={() => handleRemoveAlert(alert.id)} className="absolute top-3 right-3 text-neutral-600 hover:text-red-500"><X size={14}/></button>
                      <select value={alert.color} onChange={(e) => handleAlertChange(alert.id, 'color', e.target.value)} className="bg-neutral-900 border border-neutral-700 rounded p-1.5 text-[10px] font-bold outline-none text-white w-2/3">
                        <option value="red">🔴 Rojo (Máxima/Innegociable)</option><option value="amber">🟠 Ámbar (Aviso/Nota)</option><option value="blue">🔵 Azul (Info/Teoría)</option><option value="green">🟢 Verde (Éxito/Motivación)</option><option value="purple">🟣 Púrpura (Especial)</option>
                      </select>
                      <input type="text" value={alert.title} onChange={(e) => handleAlertChange(alert.id, 'title', e.target.value)} placeholder="Título del Banner..." className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs font-bold text-white outline-none"/>
                      <textarea value={alert.desc} onChange={(e) => handleAlertChange(alert.id, 'desc', e.target.value)} placeholder="Mensaje que se abre al tocar..." className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-[10px] font-mono text-neutral-300 outline-none h-12 resize-none"/>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. CAJA DE HERRAMIENTAS CLÍNICAS */}
            <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2"><LayoutDashboard size={18} className="text-blue-500"/> Caja de Herramientas Dinámica (Botones)</h3>
                  <p className="text-[10px] font-mono text-neutral-400 mt-1">Crea botones en la parte inferior de la app del atleta. Cada botón abre un Pop-up con la información que elijas.</p>
                </div>
                <button onClick={handleAddTool} className="text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-white flex items-center gap-2 transition-colors"><Plus size={12}/> Agregar Botón</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2">
                {editTools.map(tool => (
                  <div key={tool.id} className="bg-black border border-neutral-800 rounded-2xl p-4 relative group">
                    <button onClick={() => handleRemoveTool(tool.id)} className="absolute top-2 right-2 text-neutral-600 hover:text-red-500"><X size={16}/></button>
                    
                    <div className="flex gap-2 mb-3">
                      <div className="w-1/3">
                        <label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Ícono</label>
                        <select value={tool.icon} onChange={(e) => handleToolChange(tool.id, 'icon', e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-[10px] text-white outline-none cursor-pointer">
                          {AVAILABLE_ICONS.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                      </div>
                      <div className="w-2/3">
                        <label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Nombre Corto</label>
                        <input type="text" value={tool.shortTitle} onChange={(e) => handleToolChange(tool.id, 'shortTitle', e.target.value)} placeholder="Ej: Pesaje" className="w-full bg-neutral-900 border border-neutral-700 rounded p-1.5 text-[10px] font-bold text-white outline-none"/>
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-neutral-800 pt-3">
                      <div>
                        <label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Título Grande</label>
                        <input type="text" value={tool.title} onChange={(e) => handleToolChange(tool.id, 'title', e.target.value)} placeholder="Ej: Reglas de Pesaje Semanal" className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-xs font-bold text-white outline-none"/>
                      </div>
                      <div>
                        <label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Contenido de Lectura</label>
                        <textarea value={tool.content} onChange={(e) => handleToolChange(tool.id, 'content', e.target.value)} placeholder="Escribe todo el texto, hacks o estudios aquí..." className="w-full bg-neutral-900 border border-neutral-700 rounded p-2 text-[10px] font-mono text-neutral-300 outline-none h-20 resize-y"/>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer mt-2 bg-neutral-950 p-2 rounded-lg border border-neutral-800">
                        <input type="checkbox" checked={tool.showChart} onChange={(e) => handleToolChange(tool.id, 'showChart', e.target.checked)} className="w-3 h-3 rounded bg-neutral-900 border-neutral-700 text-blue-500 focus:ring-0"/>
                        <span className="text-[9px] font-bold uppercase text-neutral-400">Mostrar Gráfica Interactiva</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. CONSTRUCTOR DE LA GRÁFICA */}
            {editTools.some(t => t.showChart) && (
              <div className="bg-[#111] border border-blue-900/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 opacity-10 bg-blue-500 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-center border-b border-neutral-800 pb-4 mb-4 relative z-10">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-blue-400 flex items-center gap-2"><Activity size={18}/> Constructor de Gráfica Interactiva</h3>
                    <p className="text-[10px] font-mono text-neutral-500 mt-1">Has elegido mostrar una gráfica en una de tus herramientas. Configúrala aquí.</p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer bg-black px-4 py-2 rounded-xl border border-neutral-800">
                    <span className="text-[10px] font-black uppercase text-neutral-400">Motor Activo:</span>
                    <input type="checkbox" checked={editChart.enabled} onChange={(e) => handleChartChange('enabled', e.target.checked)} className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-blue-500 focus:ring-0"/>
                  </label>
                </div>

                {editChart.enabled && (
                  <div className="bg-black/50 border border-neutral-800 rounded-2xl p-5 space-y-5 relative z-10">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="text-[9px] uppercase font-bold text-neutral-500 block mb-1">Tipo de Gráfico</label>
                        <select value={editChart.type} onChange={(e) => handleChartChange('type', e.target.value)} className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-2 text-xs font-bold text-white outline-none cursor-pointer">
                          <option value="line">📈 Gráfico de Líneas (Tendencias)</option>
                          <option value="bar">📊 Gráfico de Barras (Comparativa)</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[9px] uppercase font-bold text-neutral-500 block mb-1">Etiqueta Eje Y (Lateral)</label>
                        <input type="text" value={editChart.yAxisLabel} onChange={(e) => handleChartChange('yAxisLabel', e.target.value)} placeholder="Ej: Masa Muscular (Kg)" className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-2 text-xs text-white outline-none focus:border-blue-500"/>
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <label className="text-[9px] uppercase font-bold text-neutral-500 block mb-1">Etiquetas Eje X (Separadas por coma)</label>
                        <input type="text" value={editChart.labels} onChange={(e) => handleChartChange('labels', e.target.value)} placeholder="Ene, Feb, Mar, Abr, May..." className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-2 text-xs font-mono text-white outline-none focus:border-blue-500"/>
                      </div>
                    </div>

                    <div className="border-t border-neutral-800 pt-5">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-[10px] uppercase font-black tracking-widest text-neutral-400">Series de Datos ({editChart.datasets?.length || 0}/4)</span>
                        <button onClick={handleAddDataset} className="text-[9px] font-bold uppercase tracking-widest bg-blue-900/20 border border-blue-900/50 text-blue-400 px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-600 hover:text-white transition-colors"><Plus size={12}/> Añadir Línea/Barra</button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {editChart.datasets?.map(ds => (
                          <div key={ds.id} className="bg-neutral-950 border border-neutral-800 rounded-xl p-3 flex flex-col gap-3 relative group">
                            <button onClick={() => handleRemoveDataset(ds.id)} className="absolute top-3 right-3 text-neutral-600 hover:text-red-500"><X size={14}/></button>
                            <div className="flex gap-2 w-[90%]">
                              <input type="text" value={ds.label} onChange={(e) => handleDatasetChange(ds.id, 'label', e.target.value)} placeholder="Nombre de la Leyenda" className="flex-1 bg-black border border-neutral-800 rounded p-1.5 text-xs font-bold text-white outline-none focus:border-neutral-500"/>
                              <select value={ds.color} onChange={(e) => handleDatasetChange(ds.id, 'color', e.target.value)} className={`bg-black border border-neutral-800 rounded p-1.5 text-[10px] font-bold outline-none cursor-pointer w-24 ${ds.color === 'blue' ? 'text-blue-500' : ds.color === 'red' ? 'text-red-500' : ds.color === 'green' ? 'text-green-500' : ds.color === 'amber' ? 'text-amber-500' : ds.color === 'orange' ? 'text-orange-500' : 'text-slate-400'}`}>
                                <option value="blue">🔵 Azul</option><option value="orange">🟠 Naranja</option><option value="slate">⚪ Gris</option><option value="red">🔴 Rojo</option><option value="green">🟢 Verde</option><option value="amber">🟡 Ámbar</option>
                              </select>
                            </div>
                            <input type="text" value={ds.data} onChange={(e) => handleDatasetChange(ds.id, 'data', e.target.value)} placeholder="Valores con comas (Ej: 10, 20, 30, 40)" className="w-full bg-black border border-neutral-800 rounded p-2 text-xs font-mono text-neutral-400 outline-none focus:border-white"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. EDITOR DEL CALENDARIO VIP Y BOTÓN DE PDF (AQUÍ CORREGIMOS EL AUTO-TABLE) */}
            <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800 pb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                    <Edit3 size={18} className="text-amber-500"/> Edición del Calendario Semanal
                  </h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-1">Cambia la fuente de alimentos o aporta razones clínicas día por día.</p>
                </div>
                <div className="flex gap-1 overflow-x-auto w-full md:w-auto scrollbar-hide">
                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo', 'Todos'].map(d => (
                    <button key={d} type="button" onClick={() => setSelectedCalendarDay(d)} className={`px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase transition-all whitespace-nowrap ${selectedCalendarDay === d ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-black text-neutral-400 border border-neutral-800 hover:text-white'}`}>{d}</button>
                  ))}
                </div>
              </div>

              {/* 🔥 BOTÓN DE PDF CORREGIDO */}
              <div className="flex gap-2">
                <button onClick={() => {
                  const doc = new jsPDF('landscape'); 
                  doc.setFillColor(10, 10, 10); doc.rect(0, 0, 300, 30, 'F'); 
                  doc.setTextColor(245, 158, 11); doc.setFontSize(18); doc.text('CALENDARIO NUTRICIONAL VIP', 14, 20);
                  const rows = weeklyCalendar.map(r => [r.day, r.meal, r.food, r.scale, r.macros, r.reason]);
                  
                  // Sintaxis correcta para autoTable
                  autoTable(doc, { 
                    startY: 40, 
                    head: [['Día', 'Comida', 'Alimentos Sugeridos', 'Gr. Báscula', 'Aporte Macros', 'Justificación Clínica']], 
                    body: rows, 
                    theme: 'grid', 
                    styles: { fontSize: 8, cellPadding: 3 }, 
                    headStyles: { fillColor: [20, 20, 20], textColor: [245, 158, 11] }, 
                    columnStyles: { 0: { fontStyle: 'bold' }, 4: { fontStyle: 'bold', textColor: [59, 130, 246] } } 
                  });
                  doc.save(`Calendario_VIP_${athlete?.full_name?.replace(/\s+/g, '_')}.pdf`);
                }} className="bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2">
                  <FileText size={14}/> PDF
                </button>
                
                <button onClick={() => {
                  const rows = weeklyCalendar.map(r => ({ 'Día': r.day, 'Comida': r.meal, 'Alimentos Recomendados': r.food, 'Gramaje en Báscula': r.scale, 'Aporte Real (Macros)': r.macros, 'Propósito Clínico': r.reason }));
                  const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = [{wch: 10}, {wch: 10}, {wch: 35}, {wch: 25}, {wch: 20}, {wch: 40}];
                  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Calendario VIP"); XLSX.writeFile(wb, `Calendario_VIP_${athlete?.full_name?.replace(/\s+/g, '_')}.xlsx`);
                }} className="bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2">
                  <FileSpreadsheet size={14}/> Excel
                </button>
              </div>

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {weeklyCalendar
                  .map((item, indexInArray) => ({ item, indexInArray }))
                  .filter(({ item }) => selectedCalendarDay === 'Todos' || item.day === selectedCalendarDay)
                  .map(({ item, indexInArray }) => (
                    <div key={indexInArray} className="bg-black border border-neutral-800 rounded-2xl p-4 space-y-3 hover:border-neutral-700 transition-colors">
                      <div className="flex justify-between items-center border-b border-neutral-800/80 pb-2">
                        <span className="text-xs font-black uppercase text-amber-500 tracking-wider">{item.day} • {item.meal}</span>
                        <input type="text" value={item.macros} onChange={(e) => handleCalendarCellChange(indexInArray, 'macros', e.target.value)} placeholder="Aporte Macros" className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-[10px] font-mono text-blue-400 outline-none text-right focus:border-blue-500 w-48"/>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                        <div><label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Alimento</label><input type="text" value={item.food} onChange={(e) => handleCalendarCellChange(indexInArray, 'food', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-white outline-none focus:border-amber-500"/></div>
                        <div><label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Báscula</label><input type="text" value={item.scale} onChange={(e) => handleCalendarCellChange(indexInArray, 'scale', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-white outline-none focus:border-amber-500"/></div>
                        <div><label className="text-[8px] uppercase font-bold text-neutral-500 block mb-1">Justificación</label><input type="text" value={item.reason} onChange={(e) => handleCalendarCellChange(indexInArray, 'reason', e.target.value)} className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-neutral-300 outline-none focus:border-amber-500"/></div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <button onClick={handleSaveNutritionOverride} disabled={isSavingDiet} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-xs py-5 rounded-2xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] disabled:opacity-50 flex items-center justify-center gap-2">
              {isSavingDiet ? <Loader2 size={18} className="animate-spin" /> : <><Save size={18}/> Guardar Macros, UI y Calendario Nutricional</>}
            </button>
          </div>
        )}

        {/* =================================================================================== */}
        {/* 🏋️ PESTAÑA: ENTRENAMIENTO (DONDE SE APRUEBA LA RUTINA TAMBIÉN)                      */}
        {/* =================================================================================== */}
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
                            <button onClick={() => handleRemoveExercise(dayIndex, exIndex)} className="text-neutral-600 hover:text-red-500 mt-2"><X size={16}/></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {/* ANCHOR V4: BOTÓN DE GUARDADO Y APROBACIÓN GLOBAL DEL PROTOCOLO */}
                  <button onClick={handleApproveRoutine} className="w-full mt-4 flex justify-center gap-2 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-[10px] py-4 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                    <CheckCircle2 size={16}/> Guardar Override y Aprobar Protocolo General
                  </button>
                </div>
              ) : (<div className="py-12 text-center border-2 border-dashed border-neutral-800 rounded-2xl"><p className="text-xs font-mono text-neutral-500">Atleta no ha generado su matriz base en Trainer Pro.</p></div>)}
            </div>
          </div>
        )}

        {/* =================================================================================== */}
        {/* 📸 PESTAÑA: DISCIPLINA DIARIA                                                       */}
        {/* =================================================================================== */}
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

        {/* =================================================================================== */}
        {/* 📷 PESTAÑA: GALERÍA VISUAL                                                          */}
        {/* =================================================================================== */}
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

        {/* =================================================================================== */}
        {/* 🧠 PESTAÑA: INTELIGENCIA ARTIFICIAL (DIAGNÓSTICO)                                   */}
        {/* =================================================================================== */}
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