import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Utensils, Activity, Droplet, Flame, Zap, 
  Target, Beaker, Calendar, ShoppingCart, 
  ShieldCheck, FileText, FileSpreadsheet, ChevronDown, ChevronUp, Lock, Timer,
  Bell, X, Info, Loader2, CheckCircle2, ShieldAlert, Scale
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

// Mapas de Colores para Banners
const getAlertClasses = (color) => {
  const map = {
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-500' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-500' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-500' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/30', text: 'text-green-500' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-500' }
  };
  return map[color] || map.amber;
};

const getChartColorObj = (colorString) => {
  const colors = {
    blue: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.2)' },
    orange: { border: '#f97316', bg: 'rgba(249, 115, 22, 0.2)' },
    slate: { border: '#64748b', bg: 'rgba(100, 116, 139, 0.2)' },
    red: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.2)' },
    green: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.2)' },
    amber: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' }
  };
  return colors[colorString] || colors.blue;
};

const DynamicIcon = ({ name, size = 20, className = "" }) => {
  const IconMap = { Activity, ShoppingCart, Beaker, Info, ShieldCheck, FileText, Zap, Flame };
  const IconComponent = IconMap[name] || Info;
  return <IconComponent size={size} className={className} />;
};

const roundToHalf = (num) => Math.round(num * 2) / 2;

// Base de datos de alimentos
const FOOD_DATABASE = {
  proteins: [ { id: 'whey', name: 'Aislado de Suero (Whey)', bv: 'Inmediata' }, { id: 'egg_whites', name: 'Claras de Huevo', bv: 'Rápida' }, { id: 'white_fish', name: 'Pescado Blanco', bv: 'Rápida' }, { id: 'chicken', name: 'Pechuga de Pollo', bv: 'Media' }, { id: 'turkey', name: 'Pechuga de Pavo', bv: 'Media' }, { id: 'beef', name: 'Carne Magra de Res', bv: 'Lenta' }, { id: 'salmon', name: 'Salmón Salvaje', bv: 'Lenta' }, { id: 'cottage', name: 'Queso Cottage', bv: 'Ultra Lenta' } ],
  carbs: [ { id: 'cream_rice', name: 'Crema de Arroz', bv: 'Inmediata' }, { id: 'white_rice', name: 'Arroz Blanco / Jazmín', bv: 'Rápida' }, { id: 'potato', name: 'Papa Blanca', bv: 'Rápida' }, { id: 'pasta', name: 'Pasta Tradicional', bv: 'Media' }, { id: 'sweet_potato', name: 'Camote / Batata', bv: 'Media' }, { id: 'oats', name: 'Avena en Hojuelas', bv: 'Lenta' }, { id: 'lentils', name: 'Lentejas / Frijoles', bv: 'Muy Lenta' } ],
  fats: [ { id: 'olive_oil', name: 'Aceite de Oliva Extra Virgen', bv: 'Monoinsaturada' }, { id: 'avocado', name: 'Aguacate', bv: 'Monoinsaturada' }, { id: 'almonds', name: 'Almendras / Nueces', bv: 'Poliinsaturada' }, { id: 'peanut_butter', name: 'Crema de Maní', bv: 'Mixta' }, { id: 'egg_yolks', name: 'Yemas de Huevo', bv: 'Saturada' } ]
};

export default function ElArquitecto() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [coachName, setCoachName] = useState('Coach Élite');
  const [macros, setMacros] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [customWeeklyCalendar, setCustomWeeklyCalendar] = useState(null);
  
  const [vipExpanded, setVipExpanded] = useState(true); 
  const [routineStatus, setRoutineStatus] = useState('NEW');

  // ⚖️ ESTADOS DE RECALIBRACIÓN BIOMÉTRICA (NUEVO)
  const [showRecalibration, setShowRecalibration] = useState(false);
  const [recalWeight, setRecalWeight] = useState('');
  const [recalGoal, setRecalGoal] = useState('Pérdida de Grasa');

  // 🧪 LABORATORIO
  const [showFoodLab, setShowFoodLab] = useState(false);
  const [selectedFoods, setSelectedFoods] = useState({ proteins: [], carbs: [], fats: [] });
  const [isGeneratingDiet, setIsGeneratingDiet] = useState(false);

  // 🧰 HERRAMIENTAS Y CUSTOMIZACIONES DEL COACH
  const [coachAlerts, setCoachAlerts] = useState([]);
  const [coachTools, setCoachTools] = useState([]);
  const [coachChart, setCoachChart] = useState({ enabled: false });

  const [selectedAlertModal, setSelectedAlertModal] = useState(null);
  const [selectedToolModal, setSelectedToolModal] = useState(null);

  useEffect(() => { 
    fetchAthleteData(); 
    
    // ⚡ MAGIA REALTIME
    const syncChannel = supabase.channel('athlete_sync')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'athletes_profile' }, (payload) => {
         fetchAthleteData(); 
      })
      .subscribe();

    return () => { supabase.removeChannel(syncChannel); };
  }, []);

  const fetchAthleteData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const { data: profile } = await supabase.from('athletes_profile').select('*').eq('user_id', session.user.id).single();

      if (profile) {
        setAthlete(profile);
        setRoutineStatus(profile.routine_status || 'NEW');
        
        if(profile.coach_id) {
          const { data: coachData } = await supabase.from('coaches_profile').select('full_name').eq('id', profile.coach_id).maybeSingle();
          if(coachData) setCoachName(coachData.full_name);
        }

        if (profile.coach_customizations) {
          setCoachAlerts(profile.coach_customizations.alerts || []);
          setCoachTools(profile.coach_customizations.tools || []);
          setCoachChart(profile.coach_customizations.chart || { enabled: false });
        } else {
          setCoachAlerts([{ id: 'def1', color: 'red', title: 'Regla Innegociable: Nutrición Peri-Entrenamiento', desc: 'El 70% de tus carbohidratos diarios deben consumirse en la ventana alrededor de tu entrenamiento. El Post-Entreno exige proteína rápida + Carbohidrato simple.' }]);
          setCoachTools([
            { id: 't1', icon: 'Activity', shortTitle: 'Estudio', title: 'Estudio Clínico Deportivo', content: 'Aquí va la teoría científica del coach...', showChart: true },
            { id: 't2', icon: 'ShoppingCart', shortTitle: 'Pesaje', title: 'Reglas de Pesaje', content: 'Las carnes crudas. El arroz cocido. La avena cruda.', showChart: false }
          ]);
          setCoachChart({ enabled: false });
        }

        // 🧠 LÓGICA DE INTERCEPCIÓN (RECALIBRACIÓN -> LABORATORIO -> AUDITORÍA)
        if (profile.routine_status === 'NEW') {
          // Si el coach reseteó al atleta, le pedimos sus datos primero
          setShowRecalibration(true);
          setRecalWeight(profile.weight || '');
          setRecalGoal(profile.goal || 'Pérdida de Grasa');
          setShowFoodLab(false);
        } else if (profile.b2c_plan === 'ELITE' && !profile.food_preferences && profile.routine_status !== 'APPROVED') {
          // Si no es nuevo, pero no tiene comidas y no está aprobado, mostramos el laboratorio
          setShowRecalibration(false);
          setShowFoodLab(true);
        } else {
          setShowRecalibration(false);
          setShowFoodLab(false);
        }

        if (profile.custom_macros) {
            setMacros(profile.custom_macros.totals);
            if (profile.custom_macros.weekly_calendar) setCustomWeeklyCalendar(profile.custom_macros.weekly_calendar);
        } else {
            calculateMacros(profile.weight, profile.goal);
        }
      }
    } catch (error) { console.error("Error:", error); } finally { setLoading(false); }
  };

  const calculateMacros = (weightKg, goal) => {
    if (!weightKg) return;
    let proMultiplier = 2.2; let fatMultiplier = 0.8; let carbMultiplier = 3.0; 
    if (goal === 'Pérdida de Grasa') { carbMultiplier = 1.5; proMultiplier = 2.5; } else if (goal === 'Ganancia Muscular') { carbMultiplier = 4.5; fatMultiplier = 1.0; }
    const protein = Math.round(weightKg * proMultiplier); const fats = Math.round(weightKg * fatMultiplier); const carbs = Math.round(weightKg * carbMultiplier);
    setMacros({ calories: Math.round((protein * 4) + (carbs * 4) + (fats * 9)), protein, carbs, fats });
  };

  // ⚖️ GUARDAR RECALIBRACIÓN (Paso 1 del Reset)
  const handleUpdateBiometrics = async () => {
    if (!recalWeight || !recalGoal) return alert("Completa tus datos biológicos.");
    setIsGeneratingDiet(true);
    try {
      // Actualizamos datos y reseteamos preferencias para obligar a crearlas de nuevo
      await supabase.from('athletes_profile').update({
        weight: recalWeight,
        goal: recalGoal,
        food_preferences: null, 
        custom_macros: null
      }).eq('id', athlete.id);

      setAthlete({...athlete, weight: recalWeight, goal: recalGoal});
      setShowRecalibration(false);
      
      // Si es élite, el siguiente paso es el laboratorio. Si no, directo a auditoría.
      if (athlete.b2c_plan === 'ELITE') {
        setShowFoodLab(true);
      } else {
        await supabase.from('athletes_profile').update({ routine_status: 'PENDING_AUDIT' }).eq('id', athlete.id);
        setRoutineStatus('PENDING_AUDIT');
        alert("✅ Biometría actualizada. El Coach preparará tu nueva estructura.");
      }
    } catch(e) { alert("Error: " + e.message); } finally { setIsGeneratingDiet(false); }
  };

  const toggleFoodSelection = (category, id) => {
    setSelectedFoods(prev => {
      if (prev[category].includes(id)) return { ...prev, [category]: prev[category].filter(itemId => itemId !== id) };
      else return { ...prev, [category]: prev[category].length >= 5 ? prev[category] : [...prev[category], id] };
    });
  };

  // 🧪 GENERAR DIETA DESDE LABORATORIO (Paso 2 del Reset)
  const handleCompileDiet = async () => {
    if (selectedFoods.proteins.length < 2 || selectedFoods.carbs.length < 2 || selectedFoods.fats.length < 2) return alert("Selecciona al menos 2 opciones de cada categoría.");
    setIsGeneratingDiet(true);
    try {
      // Usamos los macros ya recalibrados en memoria (athlete.weight, athlete.goal)
      let proMultiplier = 2.2; let fatMultiplier = 0.8; let carbMultiplier = 3.0; 
      if (athlete.goal === 'Pérdida de Grasa') { carbMultiplier = 1.5; proMultiplier = 2.5; } else if (athlete.goal === 'Ganancia Muscular') { carbMultiplier = 4.5; fatMultiplier = 1.0; }
      const protein = Math.round(athlete.weight * proMultiplier); const fats = Math.round(athlete.weight * fatMultiplier); const carbs = Math.round(athlete.weight * carbMultiplier);
      const newMacros = { calories: Math.round((protein * 4) + (carbs * 4) + (fats * 9)), protein, carbs, fats };

      const dist = [ { p: 0.2, c: 0.20, f: 0.25 }, { p: 0.2, c: 0.25, f: 0.30 }, { p: 0.2, c: 0.30, f: 0.00 }, { p: 0.2, c: 0.15, f: 0.25 }, { p: 0.2, c: 0.10, f: 0.20 } ];
      const meals = dist.map(d => ({ p: Math.round(newMacros.protein * d.p), c: Math.round(newMacros.carbs * d.c), f: Math.round(newMacros.fats * d.f) }));
      const userProts = FOOD_DATABASE.proteins.filter(p => selectedFoods.proteins.includes(p.id)).map(p => p.name);
      const userCarbs = FOOD_DATABASE.carbs.filter(c => selectedFoods.carbs.includes(c.id)).map(c => c.name);
      const userFats = FOOD_DATABASE.fats.filter(f => selectedFoods.fats.includes(f.id)).map(f => f.name);

      const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
      const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const generatedCalendar = [];

      days.forEach(day => {
        meals.forEach((m, idx) => {
          let foodItem = ""; let scaleGrams = ""; let why = "";
          const randP = getRandom(userProts); const randC = getRandom(userCarbs); const randF = getRandom(userFats);
          if (idx === 0) { foodItem = `${randP} + ${randC} + ${randF}`; scaleGrams = `${Math.round(m.p*4)}g Proteína / ${Math.round(m.c*4)}g Carbo / ${Math.round(m.f*4)}g Grasa (Aprox)`; why = "Energía matutina según tus preferencias."; }
          else if (idx === 2) { foodItem = `${randP} + ${randC}`; scaleGrams = `${Math.round(m.p*4.5)}g Proteína / ${Math.round(m.c*4)}g Carbo`; why = "Absorción rápida Peri-Entrenamiento. Cero grasas intencional."; }
          else { foodItem = `${randP} + ${randC} + ${randF}`; scaleGrams = `${Math.round(m.p*4.5)}g Proteína / ${Math.round(m.c*3.5)}g Carbo / ${Math.round(m.f*5)}g Grasa (Aprox)`; why = "Comida estructurada para saciedad y reparación."; }
          generatedCalendar.push({ day, meal: `Comida ${idx + 1}`, food: foodItem, scale: scaleGrams, macros: `${m.p}g P | ${m.c}g C | ${m.f}g G`, reason: why });
        });
      });

      const custom_macros = { totals: newMacros, meals: meals, weekly_calendar: generatedCalendar };
      
      await supabase.from('athletes_profile').update({ 
        food_preferences: selectedFoods, 
        custom_macros: custom_macros, 
        routine_status: 'PENDING_AUDIT' // Manda todo a Auditoría
      }).eq('id', athlete.id);

      setMacros(newMacros);
      setCustomWeeklyCalendar(generatedCalendar); 
      setRoutineStatus('PENDING_AUDIT');
      setShowFoodLab(false);
      alert("✅ Datos Recalibrados. Dieta enviada al Coach para auditoría final.");
    } catch (error) { alert("Error: " + error.message); } finally { setIsGeneratingDiet(false); }
  };

  const getDynamicChartData = () => {
    if (!coachChart || !coachChart.enabled) return null;
    try {
      const labelsArray = coachChart.labels ? coachChart.labels.split(',').map(s => s.trim()) : [];
      const datasetsArray = (coachChart.datasets || []).map(ds => {
        const c = getChartColorObj(ds.color);
        const dataArr = typeof ds.data === 'string' ? ds.data.split(',').map(n => Number(n.trim()) || 0) : [];
        return { label: ds.label || 'Serie', data: dataArr, borderColor: c.border, backgroundColor: c.bg, borderWidth: coachChart.type === 'line' ? 3 : 1, fill: coachChart.type === 'line', tension: 0.4, pointBackgroundColor: c.border, pointBorderColor: '#fff', pointHoverRadius: 7 };
      });
      if(datasetsArray.length === 0) return null;
      return { labels: labelsArray, datasets: datasetsArray };
    } catch (e) { return null; }
  };

  const dynamicChartOptions = {
    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { position: 'top', labels: { color: '#cbd5e1', font: { size: 10 } } } },
    scales: { 
      y: { title: { display: true, text: coachChart?.yAxisLabel || '', color: '#cbd5e1' }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#888' } },
      x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#888' } }
    }
  };

  const activeChartData = getDynamicChartData();

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Activity className="animate-spin" color={theme?.brandColor || '#f59e0b'} size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 relative overflow-hidden">
      
      {/* ⚖️ PANTALLA RECALIBRACIÓN BIOMÉTRICA (INTERCEPTOR CUANDO ES 'NEW') */}
      {showRecalibration && (
        <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#111] border border-blue-500/30 rounded-3xl p-8 shadow-[0_0_50px_rgba(59,130,246,0.15)] relative">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/50 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Scale className="text-blue-500" size={32}/>
              </div>
              <h1 className="text-2xl font-black uppercase tracking-widest text-white">Recalibración Biométrica</h1>
              <p className="text-xs text-neutral-400 font-mono mt-2">Tu coach ha solicitado una actualización de protocolo. Ingresa tu peso actual y nuevo objetivo para recalcular tus algoritmos.</p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="bg-black border border-neutral-800 rounded-xl p-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-2">Peso Actual (KG)</label>
                <input type="number" value={recalWeight} onChange={(e) => setRecalWeight(e.target.value)} className="w-full bg-transparent text-2xl font-mono text-white outline-none border-b border-neutral-800 focus:border-blue-500 transition-colors" placeholder="Ej: 75.5"/>
              </div>
              <div className="bg-black border border-neutral-800 rounded-xl p-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-amber-500 block mb-2">Nuevo Objetivo Clínico</label>
                <select value={recalGoal} onChange={(e) => setRecalGoal(e.target.value)} className="w-full bg-transparent text-sm font-bold text-white outline-none cursor-pointer py-2 border-b border-neutral-800 focus:border-amber-500">
                  <option value="Pérdida de Grasa" className="bg-neutral-900">🔥 Pérdida de Grasa (Déficit Calórico)</option>
                  <option value="Ganancia Muscular" className="bg-neutral-900">💪 Ganancia Muscular (Superávit)</option>
                  <option value="Recomposición Corporal" className="bg-neutral-900">⚖️ Recomposición Corporal (Mantenimiento)</option>
                </select>
              </div>
            </div>

            <button onClick={handleUpdateBiometrics} disabled={isGeneratingDiet} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2">
              {isGeneratingDiet ? <Loader2 size={16} className="animate-spin"/> : <><Activity size={16}/> Iniciar Recalibración</>}
            </button>
          </div>
        </div>
      )}

      {/* 🧪 LABORATORIO DE ALIMENTOS (POP-UP SECUESTRADOR - PASO 2) */}
      {showFoodLab && !showRecalibration && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-start p-4 overflow-y-auto">
          <div className="max-w-5xl w-full bg-[#111] border border-amber-500/30 rounded-3xl p-8 mt-10 mb-10 shadow-[0_0_50px_rgba(245,158,11,0.1)] relative">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/50 flex items-center justify-center mx-auto mb-4 animate-pulse"><Beaker className="text-amber-500" size={32}/></div>
              <h1 className="text-3xl font-black uppercase tracking-widest text-white">Laboratorio Biológico</h1>
              <p className="text-sm text-neutral-400 font-mono mt-2 max-w-xl mx-auto">Selecciona de 2 a 5 opciones por categoría. Nuestro algoritmo cruzará tu biometría con tus gustos para ensamblar tu Calendario Semanal automático.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {['proteins', 'carbs', 'fats'].map(cat => (
                <div key={cat} className={`bg-black/50 border rounded-2xl p-5 ${cat==='proteins'?'border-blue-900/30':cat==='carbs'?'border-amber-900/30':'border-red-900/30'}`}>
                  <h2 className={`text-sm font-black uppercase tracking-widest mb-4 border-b pb-2 ${cat==='proteins'?'text-blue-400 border-blue-900/30':cat==='carbs'?'text-amber-500 border-amber-900/30':'text-red-400 border-red-900/30'}`}>
                    {cat==='proteins'?'Proteínas':cat==='carbs'?'Carbohidratos':'Grasas'} ({selectedFoods[cat].length}/5)
                  </h2>
                  <div className="space-y-3">
                    {FOOD_DATABASE[cat].map(f => (
                      <label key={f.id} className={`flex flex-col p-3 rounded-xl cursor-pointer border transition-all ${selectedFoods[cat].includes(f.id) ? (cat==='proteins'?'bg-blue-900/20 border-blue-500':cat==='carbs'?'bg-amber-900/20 border-amber-500':'bg-red-900/20 border-red-500') : 'bg-neutral-900 border-neutral-800 hover:border-neutral-600'}`}>
                        <div className="flex items-center justify-between"><span className="text-xs font-bold text-white uppercase">{f.name}</span>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${selectedFoods[cat].includes(f.id) ? (cat==='proteins'?'bg-blue-500 border-blue-500':cat==='carbs'?'bg-amber-500 border-amber-500':'bg-red-500 border-red-500') : 'border-neutral-600'}`}>{selectedFoods[cat].includes(f.id) && <CheckCircle2 size={10} className="text-black"/>}</div></div>
                        <span className="text-[9px] font-mono text-neutral-500 mt-1">{f.bv}</span>
                        <input type="checkbox" className="hidden" checked={selectedFoods[cat].includes(f.id)} onChange={() => toggleFoodSelection(cat, f.id)} />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={handleCompileDiet} disabled={isGeneratingDiet || selectedFoods.proteins.length < 2 || selectedFoods.carbs.length < 2 || selectedFoods.fats.length < 2} className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-sm py-5 rounded-2xl transition-all shadow-[0_0_30px_rgba(245,158,11,0.3)] disabled:opacity-50 flex items-center justify-center gap-3">
              {isGeneratingDiet ? <Loader2 size={24} className="animate-spin"/> : <><Utensils size={24}/> Generar Mi Dieta y Enviar a Coach</>}
            </button>
          </div>
        </div>
      )}

      {/* 🔮 MODAL DE BANNERS DINÁMICOS */}
      {selectedAlertModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-[#111] border rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 ${getAlertClasses(selectedAlertModal.color).border}`}>
            <button onClick={() => setSelectedAlertModal(null)} className="absolute top-4 right-4 text-neutral-500 hover:text-white"><X size={20}/></button>
            <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center border ${getAlertClasses(selectedAlertModal.color).bg} ${getAlertClasses(selectedAlertModal.color).border} ${getAlertClasses(selectedAlertModal.color).text}`}><Bell size={20}/></div>
            <h2 className={`text-lg font-black uppercase mb-2 ${getAlertClasses(selectedAlertModal.color).text}`}>{selectedAlertModal.title}</h2>
            <p className="text-sm font-mono text-neutral-300 leading-relaxed whitespace-pre-wrap">{selectedAlertModal.desc}</p>
          </div>
        </div>
      )}

      {/* 🧰 MODAL DINÁMICO DE HERRAMIENTAS DEL COACH */}
      {selectedToolModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-[#111] border border-blue-900/50 rounded-3xl w-full p-6 sm:p-8 shadow-[0_0_50px_rgba(37,99,235,0.1)] relative max-h-[90vh] overflow-y-auto ${selectedToolModal.showChart && coachChart?.enabled ? 'max-w-4xl' : 'max-w-2xl'}`}>
            <button onClick={() => setSelectedToolModal(null)} className="absolute top-4 right-4 text-neutral-500 hover:text-white"><X size={20}/></button>
            <h2 className="text-xl font-black uppercase text-blue-400 mb-6 flex items-center gap-3">
              <DynamicIcon name={selectedToolModal.icon} size={24}/> {selectedToolModal.title}
            </h2>
            
            {selectedToolModal.showChart && coachChart?.enabled && activeChartData && (
              <div className="w-full h-[300px] bg-black/50 rounded-2xl p-4 border border-neutral-800 mb-6">
                {coachChart.type === 'bar' ? (
                  <Bar data={activeChartData} options={dynamicChartOptions} />
                ) : (
                  <Line data={activeChartData} options={dynamicChartOptions} />
                )}
              </div>
            )}

            <div className="prose prose-invert prose-sm font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
              {selectedToolModal.content}
            </div>
          </div>
        </div>
      )}


      {/* -------------------- INTERFAZ PRINCIPAL DEL ATLETA -------------------- */}
      <div className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none z-0" style={{ background: `linear-gradient(180deg, ${theme?.brandColor || '#f59e0b'} 0%, transparent 100%)` }}></div>
      <nav className="relative z-10 border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/client')} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"><ArrowLeft size={16} /> Volver al Portal</button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10 space-y-6">
        
        {/* ENCABEZADO Y ESTADO */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#111] border border-neutral-800 rounded-3xl p-6 shadow-xl">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl font-black uppercase tracking-tight flex items-center justify-center sm:justify-start gap-2">
              <Utensils style={{ color: theme?.brandColor || '#f59e0b' }} size={24}/> El Arquitecto
            </h1>
            <p className="text-xs text-neutral-400 font-mono mt-1">Coach: <strong className="text-white">{coachName}</strong></p>
          </div>
          <div className={`px-4 py-2 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border ${routineStatus === 'APPROVED' ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'}`}>
            {routineStatus === 'APPROVED' ? <><ShieldCheck size={14}/> Aprobado por Coach</> : <><Timer size={14}/> En Auditoría Clínica</>}
          </div>
        </div>

        {/* MACROS GLOBALES */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 shadow-xl relative">
          {routineStatus !== 'APPROVED' && (
             <div className="absolute inset-0 z-20 bg-[#0a0a0a]/60 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl">
                <ShieldCheck size={32} className="text-yellow-500 mb-2" />
                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">Auditando Algoritmo...</span>
             </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Target size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Requerimiento Base Diario</h2>
            <span className="text-xl font-black font-mono text-white bg-neutral-900 px-4 py-1 rounded-xl border border-neutral-800">{macros.calories} <span className="text-[10px] text-neutral-500">KCAL</span></span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center"><span className="text-[9px] font-black uppercase tracking-widest text-blue-400 block mb-1">Proteína</span><span className="text-xl font-black font-mono text-white">{macros.protein}g</span></div>
            <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center"><span className="text-[9px] font-black uppercase tracking-widest text-amber-500 block mb-1">Carbos</span><span className="text-xl font-black font-mono text-white">{macros.carbs}g</span></div>
            <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center"><span className="text-[9px] font-black uppercase tracking-widest text-red-400 block mb-1">Grasas</span><span className="text-xl font-black font-mono text-white">{macros.fats}g</span></div>
          </div>
        </div>

        {/* BANNERS DINÁMICOS DEL COACH */}
        {coachAlerts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coachAlerts.map(alert => {
              const colors = getAlertClasses(alert.color);
              return (
                <button 
                  key={alert.id}
                  onClick={() => setSelectedAlertModal(alert)}
                  className={`text-left rounded-2xl p-4 flex items-center gap-4 transition-all hover:scale-[1.02] shadow-lg border ${colors.bg} ${colors.border} ${colors.text}`}
                >
                  <div className="shrink-0"><Bell size={24} /></div>
                  <div className="flex-1 truncate">
                    <h3 className="text-xs font-black uppercase tracking-widest truncate">{alert.title}</h3>
                    <p className="text-[10px] font-mono opacity-80 truncate mt-0.5">Toca para leer el mensaje...</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* CALENDARIO VIP */}
        <div className={`border rounded-3xl transition-all duration-500 shadow-xl overflow-hidden ${athlete?.b2c_plan === 'ELITE' ? 'bg-[#111] border-amber-500/30' : 'bg-black/50 border-neutral-800 opacity-60'}`}>
          <div onClick={() => athlete?.b2c_plan === 'ELITE' ? setVipExpanded(!vipExpanded) : alert("Función exclusiva VIP.")} className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shrink-0 ${athlete?.b2c_plan === 'ELITE' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-neutral-900 border-neutral-700 text-neutral-500'}`}><Calendar size={24}/></div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">Calendario Nutricional Semanal {athlete?.b2c_plan === 'ELITE' && <span className="bg-amber-500 text-black text-[8px] px-2 py-0.5 rounded-sm">VIP</span>}</h2>
                <p className="text-[10px] font-mono text-neutral-400 mt-1">El detalle exacto de tus comidas, días y pesos en báscula.</p>
              </div>
            </div>
            {athlete?.b2c_plan === 'ELITE' && (vipExpanded ? <ChevronUp className="text-amber-500" /> : <ChevronDown className="text-amber-500" />)}
          </div>

          {vipExpanded && athlete?.b2c_plan === 'ELITE' && (
            <div className="relative p-6 pt-0 animate-in slide-in-from-top-4 duration-300 border-t border-amber-500/20 mt-2">
              
              {routineStatus !== 'APPROVED' && (
                <div className="absolute inset-0 z-20 bg-[#0a0a0a]/80 backdrop-blur-[8px] flex flex-col items-center justify-center rounded-b-3xl">
                  <div className="bg-black/90 border border-amber-500/30 p-8 rounded-3xl text-center shadow-2xl max-w-md mx-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 animate-pulse"></div>
                    <Lock size={48} className="text-amber-500 mx-auto mb-4 opacity-80" />
                    <h3 className="text-lg font-black text-white uppercase tracking-widest mb-2">Protocolo en Auditoría</h3>
                    <p className="text-xs font-mono text-neutral-400 leading-relaxed mb-4">
                      Hemos recibido tus datos y la IA generó el borrador. <br/><br/>El Coach <strong>{coachName}</strong> está evaluándolo para asegurar que las porciones sean perfectas y seguras para ti.
                    </p>
                    <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-500 border border-amber-500/30 px-4 py-2 rounded-full">
                      <Loader2 size={14} className="animate-spin" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Esperando Aprobación</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mb-6 mt-4">
                <button onClick={() => {
                  const doc = new jsPDF('landscape'); doc.setFillColor(10, 10, 10); doc.rect(0, 0, 300, 30, 'F'); doc.setTextColor(245, 158, 11); doc.setFontSize(18); doc.text('CALENDARIO NUTRICIONAL VIP', 14, 20);
                  const rows = customWeeklyCalendar.map(r => [r.day, r.meal, r.food, r.scale, r.macros, r.reason]);
                  doc.autoTable({ startY: 40, head: [['Día', 'Comida', 'Alimentos Sugeridos', 'Gr. Báscula', 'Aporte Macros', 'Justificación Clínica']], body: rows, theme: 'grid', styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [20, 20, 20], textColor: [245, 158, 11] }, columnStyles: { 0: { fontStyle: 'bold' }, 4: { fontStyle: 'bold', textColor: [59, 130, 246] } } });
                  doc.save(`Calendario_VIP_${athlete?.full_name?.replace(/\s+/g, '_')}.pdf`);
                }} disabled={routineStatus !== 'APPROVED'} className="bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"><FileText size={14}/> PDF</button>
                <button onClick={() => {
                  const rows = customWeeklyCalendar.map(r => ({ 'Día': r.day, 'Comida': r.meal, 'Alimentos Recomendados': r.food, 'Gramaje en Báscula': r.scale, 'Aporte Real (Macros)': r.macros, 'Propósito Clínico': r.reason }));
                  const ws = XLSX.utils.json_to_sheet(rows); ws['!cols'] = [{wch: 10}, {wch: 10}, {wch: 35}, {wch: 25}, {wch: 20}, {wch: 40}];
                  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Calendario VIP"); XLSX.writeFile(wb, `Calendario_VIP_${athlete?.full_name?.replace(/\s+/g, '_')}.xlsx`);
                }} disabled={routineStatus !== 'APPROVED'} className="bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"><FileSpreadsheet size={14}/> Excel</button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-left font-mono text-[10px] whitespace-nowrap min-w-[800px]">
                  <thead className="bg-neutral-900 text-neutral-400 uppercase tracking-widest">
                    <tr><th className="p-4">Día</th><th className="p-4">Comida</th><th className="p-4">Alimentos (Tus Favoritos)</th><th className="p-4">Peso Estimado</th><th className="p-4 text-amber-500">Macros</th><th className="p-4">Justificación</th></tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {(customWeeklyCalendar || []).map((row, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-bold text-white">{row.day}</td>
                        <td className="p-4 text-neutral-300">{row.meal}</td>
                        <td className="p-4 text-white font-bold">{row.food}</td>
                        <td className="p-4 text-neutral-400">{row.scale}</td>
                        <td className="p-4 text-amber-500 font-bold bg-amber-500/5">{row.macros}</td>
                        <td className="p-4 text-neutral-500 text-[9px] truncate max-w-[200px]" title={row.reason}>{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 5️⃣ CAJA DE HERRAMIENTAS DINÁMICA (CREADAS POR EL COACH) */}
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 px-2">Caja de Herramientas Clínicas</h3>
          {coachTools.length === 0 ? (
            <p className="text-xs text-neutral-600 font-mono italic px-2">El coach aún no ha añadido herramientas.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {coachTools.map(tool => (
                <button 
                  key={tool.id} 
                  onClick={() => setSelectedToolModal(tool)} 
                  className="bg-neutral-900 border border-neutral-800 hover:border-blue-500 hover:bg-blue-500/10 rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  <DynamicIcon name={tool.icon} className="text-neutral-500 group-hover:text-blue-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-white truncate w-full text-center">
                    {tool.shortTitle}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}