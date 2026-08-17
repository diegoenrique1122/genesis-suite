import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, 
  Utensils, 
  Flame, 
  Activity, 
  Beef, 
  Wheat, 
  Droplet,
  Info,
  Loader2
} from 'lucide-react';

export default function ElArquitecto() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  
  // Nivel de actividad interactivo para el cálculo dinámico
  const [activityMultiplier, setActivityMultiplier] = useState(1.375); // Por defecto: Ligero

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

    } catch (error) {
      console.error("Error cargando El Arquitecto:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🧠 MOTOR MATEMÁTICO CLÍNICO (Basado en tu documento "APP DIETA")
  const calculateNutrition = () => {
    if (!athlete) return null;

    const { weight, height, age, gender, goal } = athlete;
    
    // 1. Tasa Metabólica Basal (Mifflin-St Jeor)
    let bmr = 0;
    if (gender === 'Masculino') {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) + 5;
    } else {
      bmr = (10 * weight) + (6.25 * height) - (5 * age) - 161;
    }

    // 2. Gasto Energético Total (TDEE)
    let tdee = bmr * activityMultiplier;

    // 3. Ajuste por Objetivo
    let targetCals = tdee;
    if (goal.toLowerCase().includes('grasa') || goal.toLowerCase().includes('perder')) {
      targetCals -= 500;
    } else if (goal.toLowerCase().includes('masa') || goal.toLowerCase().includes('volumen')) {
      targetCals += 400;
    }

    // 4. Cálculo de Macros
    const proteinGrams = weight * 2.2;
    const proteinCals = proteinGrams * 4;

    const fatCals = targetCals * 0.25;
    const fatGrams = fatCals / 9;

    const carbCals = targetCals - (proteinCals + fatCals);
    const carbGrams = Math.max(0, carbCals / 4);

    return {
      calories: Math.round(targetCals),
      protein: Math.round(proteinGrams),
      fats: Math.round(fatGrams),
      carbs: Math.round(carbGrams)
    };
  };

  const macros = calculateNutrition();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin" color={theme.brandColor} size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-neutral-800 pb-20">
      
      {/* NAVBAR SUPERIOR */}
      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-md mx-auto px-6 h-16 flex items-center gap-4">
          <button onClick={() => navigate('/client')} className="text-neutral-500 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <Utensils size={16} style={{ color: theme.brandColor }} /> El Arquitecto
          </h1>
        </div>
      </nav>

      <main className="max-w-md mx-auto px-6 py-6 space-y-8">
        
        {/* CABECERA Y SELECTOR DE ACTIVIDAD */}
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tight">Presupuesto Metabólico</h2>
            <p className="text-xs text-neutral-400 font-mono mt-1">Fórmula: Mifflin-St Jeor | Objetivo: <span className="text-white font-bold">{athlete?.goal}</span></p>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl">
            <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block mb-3 flex items-center gap-2">
              <Activity size={14} style={{ color: theme.brandColor }}/> Ajustar Nivel de Actividad Hoy
            </label>
            <select 
              value={activityMultiplier} 
              onChange={(e) => setActivityMultiplier(parseFloat(e.target.value))}
              className="w-full bg-[#111] border border-neutral-800 text-white text-xs font-bold rounded-xl p-3 outline-none focus:border-neutral-600 transition-colors"
            >
              <option value={1.2}>Sedentario (Casi nada de ejercicio)</option>
              <option value={1.375}>Ligero (1-3 días por semana)</option>
              <option value={1.55}>Moderado (3-5 días por semana)</option>
              <option value={1.725}>Atleta (Entrenamiento intenso 6-7 días)</option>
            </select>
          </div>
        </div>

        {/* VISOR DE MACROS GLOBALES */}
        {macros && (
          <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: theme.brandColor }}></div>
            
            <div className="text-center mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-1">Calorías Diarias</p>
              <div className="text-5xl font-black font-mono tracking-tighter flex items-center justify-center gap-2">
                {macros.calories} <Flame size={24} style={{ color: theme.brandColor }} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 border-t border-neutral-800/50 pt-6">
              <div className="text-center">
                <div className="mx-auto w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center mb-2">
                  <Beef size={14} className="text-blue-400" />
                </div>
                <p className="text-xl font-bold font-mono">{macros.protein}g</p>
                <p className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Proteína</p>
              </div>
              <div className="text-center border-l border-r border-neutral-800/50">
                <div className="mx-auto w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center mb-2">
                  <Wheat size={14} className="text-yellow-500" />
                </div>
                <p className="text-xl font-bold font-mono">{macros.carbs}g</p>
                <p className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Carbos</p>
              </div>
              <div className="text-center">
                <div className="mx-auto w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center mb-2">
                  <Droplet size={14} className="text-red-400" />
                </div>
                <p className="text-xl font-bold font-mono">{macros.fats}g</p>
                <p className="text-[9px] uppercase tracking-widest text-neutral-500 mt-1">Grasas</p>
              </div>
            </div>
          </div>
        )}

        {/* NUTRIENT TIMING (Distribución de Comidas) */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Nutrient Timing</h3>
            <Info size={12} className="text-neutral-600" />
          </div>

          {[
            { name: 'Desayuno', p: 0.20, c: 0.20, f: 0.25 },
            { name: 'Almuerzo', p: 0.20, c: 0.25, f: 0.30 },
            { name: 'Post-Entrenamiento', p: 0.20, c: 0.30, f: 0.00 },
            { name: 'Cena', p: 0.20, c: 0.15, f: 0.25 },
            { name: 'Snack Nocturno', p: 0.20, c: 0.10, f: 0.20 },
          ].map((meal, index) => (
            <div key={index} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between group hover:border-neutral-700 transition-colors">
              <div>
                <h4 className="text-sm font-bold text-white">{meal.name}</h4>
                <div className="flex gap-3 mt-2 text-[10px] font-mono text-neutral-400">
                  <span className="text-blue-400 font-bold">P: {Math.round(macros.protein * meal.p)}g</span>
                  <span className="text-yellow-500 font-bold">C: {Math.round(macros.carbs * meal.c)}g</span>
                  <span className="text-red-400 font-bold">F: {Math.round(macros.fats * meal.f)}g</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full border border-neutral-800 flex items-center justify-center font-black text-xs text-neutral-500">
                {index + 1}
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}