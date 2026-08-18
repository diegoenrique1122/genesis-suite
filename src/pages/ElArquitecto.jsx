import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Utensils, Activity, Droplet, 
  Flame, Zap, Info, ShieldAlert, Target, Beaker
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Registrar componentes de Chart.js
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function ElArquitecto() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [macros, setMacros] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });

  useEffect(() => {
    fetchAthleteData();
  }, []);

  const fetchAthleteData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const { data: profile } = await supabase
        .from('athletes_profile')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (profile) {
        setAthlete(profile);
        calculateMacros(profile.weight, profile.goal, profile.gender);
      }
    } catch (error) {
      console.error("Error cargando perfil:", error);
    } finally {
      setLoading(false);
    }
  };

  // 🧮 MOTOR MATEMÁTICO DE MACRONUTRIENTES
  const calculateMacros = (weightKg, goal, gender) => {
    if (!weightKg) return;
    
    let proMultiplier = 2.2; // Alta proteína para retención muscular
    let fatMultiplier = 0.8;
    let carbMultiplier = 3.0; // Mantenimiento base
    
    if (goal === 'Pérdida de Grasa') {
      carbMultiplier = 1.5;
      proMultiplier = 2.5; // Mayor proteína en déficit
    } else if (goal === 'Ganancia Muscular') {
      carbMultiplier = 4.5;
      fatMultiplier = 1.0;
    }

    const protein = Math.round(weightKg * proMultiplier);
    const fats = Math.round(weightKg * fatMultiplier);
    const carbs = Math.round(weightKg * carbMultiplier);
    const calories = Math.round((protein * 4) + (carbs * 4) + (fats * 9));

    setMacros({ calories, protein, carbs, fats });
  };

  // 📊 CONFIGURACIÓN DE LA GRÁFICA GASPARI (Síntesis Proteica)
  const chartData = {
    labels: ['10g', '20g', '30g', '40g', '50g', '60g'],
    datasets: [
      {
        label: 'Estimulación de Síntesis Proteica (MPS %)',
        data: [15, 45, 95, 100, 100, 100], // Umbral de Leucina de Gaspari
        borderColor: theme?.brandColor || '#f59e0b',
        backgroundColor: `${theme?.brandColor || '#f59e0b'}30`,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#fff',
        pointBorderColor: theme?.brandColor || '#f59e0b',
        pointRadius: 4,
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `Activación MPS: ${context.raw}%`
        }
      }
    },
    scales: {
      y: { min: 0, max: 110, grid: { color: '#333' }, ticks: { color: '#888' } },
      x: { grid: { display: false }, ticks: { color: '#888' } }
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Activity className="animate-spin" color={theme?.brandColor || '#f59e0b'} size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 relative overflow-hidden">
      
      {/* Fondo Neón Dinámico */}
      <div className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none z-0" style={{ background: `linear-gradient(180deg, ${theme?.brandColor || '#f59e0b'} 0%, transparent 100%)` }}></div>

      {/* NAVBAR */}
      <nav className="relative z-10 border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/client')} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={16} /> Volver al Portal
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 relative z-10 space-y-8">
        
        {/* ENCABEZADO */}
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
            <Utensils style={{ color: theme?.brandColor || '#f59e0b' }} size={28}/> 
            El Arquitecto
          </h1>
          <p className="text-xs text-neutral-400 font-mono mt-2">Protocolo Nutricional Clínico para: <strong className="text-white">{athlete?.goal}</strong></p>
        </div>

        {/* ⚠️ ALERTA PERI-ENTRENAMIENTO */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-3xl p-5 flex items-start gap-4 animate-in fade-in zoom-in duration-500 shadow-[0_0_30px_rgba(239,68,68,0.15)]">
          <ShieldAlert className="text-red-500 shrink-0 mt-1" size={24} />
          <div>
            <h2 className="text-xs font-black uppercase tracking-widest text-red-500 mb-1">Regla Innegociable: Nutrición Peri-Entrenamiento</h2>
            <p className="text-[11px] text-red-200/80 font-mono leading-relaxed">
              El 70% de tus carbohidratos diarios deben consumirse en la ventana alrededor de tu entrenamiento (Pre y Post). 
              <strong> El Post-Entreno exige proteína de rápida asimilación (Whey) + Carbohidrato simple para cortar el cortisol inmediatamente.</strong>
            </p>
          </div>
        </div>

        {/* 🧮 MACROS PRINCIPALES */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Target size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Requerimiento Metabólico Diario
            </h2>
            <span className="text-xl font-black font-mono text-white bg-neutral-900 px-4 py-1 rounded-xl border border-neutral-800 shadow-inner">
              {macros.calories} <span className="text-[10px] text-neutral-500">KCAL</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 block mb-2">Proteína</span>
              <span className="text-2xl font-black font-mono text-white">{macros.protein}g</span>
            </div>
            <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 block mb-2">Carbos</span>
              <span className="text-2xl font-black font-mono text-white">{macros.carbs}g</span>
            </div>
            <div className="bg-black border border-neutral-800 rounded-2xl p-4 text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-400 block mb-2">Grasas</span>
              <span className="text-2xl font-black font-mono text-white">{macros.fats}g</span>
            </div>
          </div>
        </div>

        {/* 📊 LA GRÁFICA GASPARI */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Activity size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Ley de Umbral de Leucina
              </h2>
              <p className="text-[10px] font-mono text-neutral-500 mt-1">Modelo de absorción de síntesis proteica (Efecto "Muscle Fullness").</p>
            </div>
            <span className="text-[9px] font-black bg-neutral-900 border border-neutral-700 px-3 py-1 rounded-full text-neutral-400">
              Estudio Científico
            </span>
          </div>

          <div className="w-full h-64 bg-black/50 rounded-2xl p-4 border border-neutral-800 mb-4">
            <Line data={chartData} options={chartOptions} />
          </div>

          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 flex gap-3">
            <Info className="text-blue-400 shrink-0" size={18}/>
            <p className="text-[10px] font-mono text-blue-200/80 leading-relaxed">
              <strong>Análisis Clínico:</strong> Consumir más de 40g-50g de proteína en una sola comida NO aumenta la síntesis muscular (la curva se aplana). Tu cuerpo oxidará el exceso. Por eso, dividimos tus {macros.protein}g diarios en múltiples comidas espaciadas cada 3-4 horas para mantener la máquina encendida.
            </p>
          </div>
        </div>

        {/* 🧪 LOS HACKS METABÓLICOS */}
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2 px-2">
            <Beaker size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Hacks Metabólicos B2B
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-black border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group hover:border-amber-500/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/30 mb-4 group-hover:scale-110 transition-transform">
                <Droplet className="text-amber-500" size={18}/>
              </div>
              <h3 className="text-xs font-black uppercase text-white mb-2">Vinagre de Sidra de Manzana</h3>
              <p className="text-[10px] text-neutral-400 font-mono leading-relaxed">1 cucharada diluida en agua 15 minutos antes de tu comida más alta en carbohidratos. <strong>Reduce el pico de insulina</strong> hasta un 30%, optimizando la sensibilidad celular.</p>
            </div>

            <div className="bg-black border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group hover:border-red-500/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/30 mb-4 group-hover:scale-110 transition-transform">
                <Flame className="text-red-500" size={18}/>
              </div>
              <h3 className="text-xs font-black uppercase text-white mb-2">Agua de Jamaica Orgánica</h3>
              <p className="text-[10px] text-neutral-400 font-mono leading-relaxed">Hervir flor de jamaica sin azúcar. Tomar 1 Litro a lo largo del día. Actúa como un potente <strong>diurético natural</strong> que drena la retención hídrica subcutánea.</p>
            </div>

            <div className="bg-black border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 mb-4 group-hover:scale-110 transition-transform">
                <Zap className="text-blue-500" size={18}/>
              </div>
              <h3 className="text-xs font-black uppercase text-white mb-2">La Bomba de Sodio (Pre)</h3>
              <p className="text-[10px] text-neutral-400 font-mono leading-relaxed">1/2 cucharadita de Sal del Himalaya + Medio limón en 100ml de agua, 30 mins antes de entrenar. Genera <strong>expansión de volumen sanguíneo</strong> (bombeo brutal).</p>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}