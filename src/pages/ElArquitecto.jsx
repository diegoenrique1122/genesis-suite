import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Utensils, Activity, Droplet, Flame, Zap, 
  Info, ShieldAlert, Target, Beaker, Calendar, ShoppingCart, 
  ShieldCheck, FileText, FileSpreadsheet, ChevronDown, ChevronUp, Lock
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const roundToHalf = (num) => Math.round(num * 2) / 2;

export default function ElArquitecto() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [coachName, setCoachName] = useState('Coach Élite');
  const [macros, setMacros] = useState({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const [mealsData, setMealsData] = useState([]);
  
  const [activeTab, setActiveTab] = useState('plan');
  const [vipExpanded, setVipExpanded] = useState(false);
  
  // Prescripción del Coach
  const [prescription, setPrescription] = useState('');
  const [isSavingPrescription, setIsSavingPrescription] = useState(false);

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
        setPrescription(profile.coach_note || '');
        
        // Obtener nombre del coach
        if(profile.coach_id) {
          const { data: coachData } = await supabase.from('coaches_profile').select('full_name').eq('id', profile.coach_id).maybeSingle();
          if(coachData) setCoachName(coachData.full_name);
        }

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
    
    let proMultiplier = 2.2; 
    let fatMultiplier = 0.8;
    let carbMultiplier = 3.0; 
    
    if (goal === 'Pérdida de Grasa') { carbMultiplier = 1.5; proMultiplier = 2.5; } 
    else if (goal === 'Ganancia Muscular') { carbMultiplier = 4.5; fatMultiplier = 1.0; }

    const protein = Math.round(weightKg * proMultiplier);
    const fats = Math.round(weightKg * fatMultiplier);
    const carbs = Math.round(weightKg * carbMultiplier);
    const calories = Math.round((protein * 4) + (carbs * 4) + (fats * 9));

    setMacros({ calories, protein, carbs, fats });

    // Distribución en 5 comidas
    const dist = [
        { p: 0.2, c: 0.20, f: 0.25 },
        { p: 0.2, c: 0.25, f: 0.30 },
        { p: 0.2, c: 0.30, f: 0.00 },
        { p: 0.2, c: 0.15, f: 0.25 },
        { p: 0.2, c: 0.10, f: 0.20 }
    ];
    setMealsData(dist.map(d => ({ p: Math.round(protein * d.p), c: Math.round(carbs * d.c), f: Math.round(fats * d.f) })));
  };

  // 💾 GUARDAR PRESCRIPCIÓN
  const handleSavePrescription = async () => {
    setIsSavingPrescription(true);
    try {
      await supabase.from('athletes_profile').update({ coach_note: prescription }).eq('id', athlete.id);
      alert("✅ Prescripción guardada exitosamente.");
    } catch (err) {
      alert("Error guardando prescripción.");
    } finally {
      setIsSavingPrescription(false);
    }
  };

  // 📊 CONFIGURACIÓN DE LA GRÁFICA (Estudio Clínico de 3 Grupos)
  const chartData = {
    labels: ['Semana 0', 'Semana 2', 'Semana 4', 'Semana 6', 'Semana 8', 'Semana 10', 'Semana 12'],
    datasets: [
        {
            label: 'Grupo A (Peri-Entreno + Vinagre de Manzana)',
            data: [0, 0.7, 1.5, 2.3, 3.0, 3.7, 4.2],
            borderColor: '#3b82f6', 
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            borderWidth: 4, pointBackgroundColor: '#60a5fa', pointBorderColor: '#fff',
            pointHoverRadius: 8, fill: true, tension: 0.4 
        },
        {
            label: 'Grupo B (Solo Carbos Post-Entreno)',
            data: [0, 0.4, 0.9, 1.4, 1.8, 2.2, 2.6],
            borderColor: '#f97316', 
            borderWidth: 3, pointBackgroundColor: '#fb923c', pointBorderColor: '#fff',
            pointHoverRadius: 7, fill: false, tension: 0.4
        },
        {
            label: 'Grupo C (Control Normal sin horarios)',
            data: [0, 0.2, 0.4, 0.6, 0.8, 0.9, 1.1],
            borderColor: '#64748b', 
            borderWidth: 2, pointBackgroundColor: '#94a3b8', pointBorderColor: '#fff',
            pointHoverRadius: 7, fill: false, borderDash: [5, 5], tension: 0.4
        }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { padding: 15, usePointStyle: true, boxWidth: 8, font: { size: 10 }, color: '#cbd5e1' } },
      tooltip: { backgroundColor: 'rgba(15, 23, 42, 0.9)', padding: 12, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} Kg` } }
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Masa Muscular (Kg)', color: '#cbd5e1' }, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#888' } },
      x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#888' } }
    }
  };

  // 📅 GENERADOR DE DATOS VIP (Lunes a Domingo)
  const generateVipWeekData = () => {
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const tableRows = [];

    days.forEach(day => {
      mealsData.forEach((m, idx) => {
        let foodItem = ""; let scaleGrams = ""; let why = "";
        
        if(idx === 0) { foodItem = "Huevos Enteros + Claras extras"; scaleGrams = `${Math.floor(m.f/5)} Enteros + ${Math.round(m.p/3.6)} Claras`; why = "Alto valor biológico al despertar"; }
        if(idx === 1) { foodItem = day === 'Lunes' || day === 'Miércoles' || day === 'Viernes' ? "Pechuga de Pollo + Arroz Jazmín" : "Pescado Blanco + Papa/Camote"; scaleGrams = `${Math.round(m.p*4.5)}g Proteína / ${Math.round(m.c*3.5)}g Carbo`; why = "Carbohidratos complejos para energía sostenida"; }
        if(idx === 2) { foodItem = "Aislado de Suero + Crema de Arroz"; scaleGrams = `${roundToHalf(m.p/25)} scoop(s) / ${Math.round(m.c*1.2)}g Crema`; why = "Absorción ultra-rápida (Peri-Entrenamiento)"; }
        if(idx === 3) { foodItem = "Carne Magra o Lomo + Aguacate"; scaleGrams = `${Math.round(m.p*4.8)}g Carne / ${Math.round(m.f*6.6)}g Aguacate`; why = "Grasas saludables post-entrenamiento lejano"; }
        if(idx === 4) { foodItem = "Queso Cottage + Almendras"; scaleGrams = `${Math.round(m.p*8.3)}g Cottage / ${Math.round(m.f*2)}g Almendras`; why = "Caseína (Digestión nocturna lenta)"; }

        tableRows.push({ day, meal: `Comida ${idx + 1}`, food: foodItem, scale: scaleGrams, macros: `${m.p}g P | ${m.c}g C | ${m.f}g G`, reason: why });
      });
    });
    return tableRows;
  };

  // 🖨️ EXPORTACIONES VIP
  const exportVIPToPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFillColor(10, 10, 10); doc.rect(0, 0, 300, 30, 'F');
    doc.setTextColor(245, 158, 11); doc.setFontSize(18); doc.text('CALENDARIO NUTRICIONAL VIP', 14, 20);
    
    const rows = generateVipWeekData().map(r => [r.day, r.meal, r.food, r.scale, r.macros, r.reason]);
    
    doc.autoTable({
      startY: 40,
      head: [['Día', 'Comida', 'Alimentos (Ejemplo)', 'Gr. Báscula', 'Aporte Macros', 'Justificación Clínica']],
      body: rows,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [20, 20, 20], textColor: [245, 158, 11] },
      columnStyles: { 0: { fontStyle: 'bold' }, 4: { fontStyle: 'bold', textColor: [59, 130, 246] } },
      didParseCell: function(data) { if (data.row.index % 5 === 0 && data.section === 'body') data.cell.styles.fillColor = [240, 240, 240]; }
    });
    doc.save(`Calendario_VIP_${athlete?.full_name?.replace(/\s+/g, '_')}.pdf`);
  };

  const exportVIPToExcel = () => {
    const rows = generateVipWeekData().map(r => ({ 'Día': r.day, 'Comida': r.meal, 'Alimentos Recomendados': r.food, 'Gramaje en Báscula': r.scale, 'Aporte Real (Macros)': r.macros, 'Propósito Clínico': r.reason }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch: 10}, {wch: 10}, {wch: 35}, {wch: 25}, {wch: 20}, {wch: 40}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calendario VIP");
    XLSX.writeFile(wb, `Calendario_VIP_${athlete?.full_name?.replace(/\s+/g, '_')}.xlsx`);
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Activity className="animate-spin" color={theme?.brandColor || '#f59e0b'} size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 relative overflow-hidden">
      
      <div className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none z-0" style={{ background: `linear-gradient(180deg, ${theme?.brandColor || '#f59e0b'} 0%, transparent 100%)` }}></div>

      <nav className="relative z-10 border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/client')} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={16} /> Volver al Portal
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 relative z-10 space-y-8">
        
        {/* ENCABEZADO */}
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center justify-center sm:justify-start gap-3">
            <Utensils style={{ color: theme?.brandColor || '#f59e0b' }} size={32}/> 
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
              <strong> El Post-Entreno exige proteína de rápida asimilación + Carbohidrato simple para cortar el cortisol inmediatamente.</strong>
            </p>
          </div>
        </div>

        {/* ✍️ PREESCRIPCIÓN DEL COACH ELITE */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: theme?.brandColor || '#f59e0b' }}></div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2 relative z-10">
            <Target size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> 
            Prescripción Clínica del Coach {coachName}
          </h2>
          <div className="relative z-10">
            <textarea 
              value={prescription}
              onChange={(e) => setPrescription(e.target.value)}
              placeholder="El coach aún no ha añadido notas o directrices específicas..."
              className="w-full bg-black/50 border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-300 outline-none focus:border-amber-500 transition-colors min-h-[100px] resize-y"
            />
            {prescription !== (athlete?.coach_note || '') && (
              <button onClick={handleSavePrescription} disabled={isSavingPrescription} className="mt-3 text-[10px] font-black uppercase tracking-widest bg-amber-500 text-black px-4 py-2 rounded-lg hover:bg-amber-400">
                {isSavingPrescription ? 'Guardando...' : 'Guardar Prescripción'}
              </button>
            )}
          </div>
        </div>

        {/* 👑 FUNCIÓN VIP: EJEMPLOS DE COMIDAS (CALENDARIO COMPLETO) */}
        <div className={`border rounded-3xl transition-all duration-500 shadow-xl overflow-hidden ${athlete?.b2c_plan === 'ELITE' ? 'bg-[#111] border-amber-500/30' : 'bg-black/50 border-neutral-800 opacity-60'}`}>
          <div 
            onClick={() => athlete?.b2c_plan === 'ELITE' ? setVipExpanded(!vipExpanded) : alert("Función exclusiva para atletas VIP (Plan Élite).")}
            className="p-6 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center border shrink-0 ${athlete?.b2c_plan === 'ELITE' ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-neutral-900 border-neutral-700 text-neutral-500'}`}>
                {athlete?.b2c_plan === 'ELITE' ? <Calendar size={24}/> : <Lock size={20}/>}
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                  Calendario Nutricional Semanal {athlete?.b2c_plan === 'ELITE' && <span className="bg-amber-500 text-black text-[8px] px-2 py-0.5 rounded-sm">VIP</span>}
                </h2>
                <p className="text-[10px] font-mono text-neutral-400 mt-1">Ejemplos diarios con detalle de báscula vs aporte de macros. Descargable en PDF/Excel.</p>
              </div>
            </div>
            {athlete?.b2c_plan === 'ELITE' && (vipExpanded ? <ChevronUp className="text-amber-500" /> : <ChevronDown className="text-amber-500" />)}
          </div>

          {vipExpanded && athlete?.b2c_plan === 'ELITE' && (
            <div className="p-6 pt-0 animate-in slide-in-from-top-4 duration-300 border-t border-amber-500/20 mt-2">
              <div className="flex gap-2 mb-6">
                <button onClick={exportVIPToPDF} className="bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2">
                  <FileText size={14}/> Exportar PDF
                </button>
                <button onClick={exportVIPToExcel} className="bg-green-500/10 text-green-500 border border-green-500/30 hover:bg-green-500 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2">
                  <FileSpreadsheet size={14}/> Exportar Excel
                </button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-800">
                <table className="w-full text-left font-mono text-[10px] whitespace-nowrap min-w-[700px]">
                  <thead className="bg-neutral-900 text-neutral-400 uppercase tracking-widest">
                    <tr><th className="p-3">Día</th><th className="p-3">Comida</th><th className="p-3">Alimento (Ejemplo)</th><th className="p-3">Peso en Báscula</th><th className="p-3 text-amber-500">Macros Reales</th><th className="p-3">Justificación</th></tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {generateVipWeekData().map((row, i) => (
                      <tr key={i} className="hover:bg-white/5 transition-colors">
                        <td className="p-3 font-bold text-white">{row.day}</td>
                        <td className="p-3 text-neutral-300">{row.meal}</td>
                        <td className="p-3 text-neutral-300">{row.food}</td>
                        <td className="p-3 text-neutral-400 font-bold">{row.scale}</td>
                        <td className="p-3 text-amber-500 font-bold">{row.macros}</td>
                        <td className="p-3 text-neutral-500 text-[9px] truncate max-w-[200px]" title={row.reason}>{row.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* 🧮 MACROS PRINCIPALES Y MENÚ BASE (SIN ALIMENTOS) */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Target size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Requerimiento Metabólico Base
            </h2>
            <span className="text-xl font-black font-mono text-white bg-neutral-900 px-4 py-1 rounded-xl border border-neutral-800 shadow-inner">
              {macros.calories} <span className="text-[10px] text-neutral-500">KCAL</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
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

          <div className="grid grid-cols-4 bg-neutral-900 p-1 rounded-xl border border-neutral-800 gap-1 mb-6">
            <button onClick={() => setActiveTab('plan')} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'plan' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500 hover:text-white'}`}><Calendar size={14} className="mb-1" /> Menú</button>
            <button onClick={() => setActiveTab('peri')} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'peri' ? 'bg-blue-900/30 text-blue-400 border border-blue-900/50 shadow' : 'text-neutral-500 hover:text-white'}`}><Zap size={14} className="mb-1" /> Peri-Entreno</button>
            <button onClick={() => setActiveTab('groceries')} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'groceries' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500 hover:text-white'}`}><ShoppingCart size={14} className="mb-1" /> Pesaje</button>
            <button onClick={() => setActiveTab('supps')} className={`flex flex-col items-center justify-center py-2 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all ${activeTab === 'supps' ? 'bg-neutral-800 text-white shadow' : 'text-neutral-500 hover:text-white'}`}><ShieldCheck size={14} className="mb-1" /> Sups</button>
          </div>

          {/* CONTENIDO DE LAS PESTAÑAS */}
          {activeTab === 'plan' && (
            <div className="space-y-4 animate-in fade-in">
              <p className="text-[10px] text-neutral-400 mb-4 bg-black p-3 rounded-lg border border-neutral-800">Esta es la estructura base de tus macros por comida. Los ejemplos exactos de alimentos por día se encuentran en tu Calendario VIP.</p>
              {mealsData.map((m, i) => (
                <div key={i} className="bg-black border border-neutral-800 rounded-xl p-4 flex justify-between items-center hover:border-neutral-600 transition-colors">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase">Comida {i + 1}</h3>
                    <p className="text-[9px] font-mono text-neutral-500 mt-1">Presupuesto asignado</p>
                  </div>
                  <div className="text-right space-y-1 bg-neutral-900 px-4 py-2 rounded-lg border border-neutral-800 shadow-inner">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block">{m.p}g Proteína</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 block">{m.c}g Carbos</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-red-400 block">{m.f}g Grasas</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'peri' && (
            <div className="animate-in fade-in space-y-4 text-sm text-neutral-300 font-mono leading-relaxed">
              <p>Organiza tus 5 comidas alrededor de tu horario de entrenamiento.</p>
              <div className="bg-blue-900/20 border border-blue-900/50 p-4 rounded-xl">
                <strong className="text-blue-400 block mb-1">Pre-Entrenamiento (1-2 Hrs antes)</strong>
                Carbohidratos complejos + Proteína magra. Cero grasas para no retrasar el vaciado gástrico.
              </div>
              <div className="bg-green-900/20 border border-green-900/50 p-4 rounded-xl">
                <strong className="text-green-400 block mb-1">Post-Entrenamiento (Inmediato)</strong>
                Proteína de rápida asimilación (Whey) + Carbohidrato de alto índice glucémico (Crema de arroz, banano). La insulina frenará el catabolismo.
              </div>
            </div>
          )}

          {activeTab === 'groceries' && (
            <div className="animate-in fade-in bg-amber-500/10 border border-amber-500/30 p-5 rounded-xl">
              <h4 className="text-amber-500 font-black uppercase mb-2">Regla de Oro del Pesaje</h4>
              <p className="text-xs text-amber-200/80 leading-relaxed font-mono">
                NO confundas gramos de alimento con gramos de macronutriente. El menú ya te da los gramos EXACTOS de comida a pesar en la báscula.<br/><br/>
                - Carnes se pesan <strong>CRUDAS</strong>.<br/>
                - Arroz, pasta y granos se pesan <strong>COCIDOS</strong>.<br/>
                - Avena y cereales se pesan <strong>CRUDOS</strong>.
              </p>
            </div>
          )}

          {activeTab === 'supps' && (
            <div className="animate-in fade-in space-y-4">
              <div className="bg-neutral-900 p-4 rounded-lg border-l-4 border-blue-500"><h4 className="font-bold text-white uppercase text-sm mb-1">Aislado de Suero / Albúmina</h4><p className="text-[11px] text-neutral-400">Proteína de altísima biodisponibilidad para el Post-Entreno inmediato.</p></div>
              <div className="bg-neutral-900 p-4 rounded-lg border-l-4 border-orange-500"><h4 className="font-bold text-white uppercase text-sm mb-1">Matriz Intra-Entreno (Dextrina)</h4><p className="text-[11px] text-neutral-400">Intra-entrenamiento. Expansión celular, hidratación y reposición de glucógeno en tiempo real.</p></div>
              <div className="bg-neutral-900 p-4 rounded-lg border-l-4 border-red-500"><h4 className="font-bold text-white uppercase text-sm mb-1">Termogénico Clínico</h4><p className="text-[11px] text-neutral-400">Recomendado para oxidación de lípidos. Controla ansiedad y picos de hambre.</p></div>
            </div>
          )}
        </div>

        {/* 📊 LA GRÁFICA CLÍNICA RESTAURADA (Comparativa Vinagre de Manzana) */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                <Activity size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/> Estudio Clínico: Nutrición Peri-Entrenamiento
              </h2>
              <p className="text-[10px] font-mono text-neutral-500 mt-1">Impacto de Carbohidratos Intra/Post + Sensibilizadores de Insulina (Vinagre de Manzana).</p>
            </div>
            <span className="text-[9px] font-black bg-neutral-900 border border-neutral-700 px-3 py-1 rounded-full text-neutral-400">
              Progreso 12 Semanas
            </span>
          </div>

          <div className="w-full h-[300px] bg-black/50 rounded-2xl p-4 border border-neutral-800 mb-4">
            <Line data={chartData} options={chartOptions} />
          </div>

          <div className="space-y-4 mb-4">
            <div className="bg-neutral-900 p-4 rounded-lg border-l-4 border-blue-500">
              <h4 className="font-bold text-white uppercase text-sm mb-1">Grupo A: Protocolo Élite</h4>
              <p className="text-[11px] text-neutral-400">Dieta hipercalórica + Carbohidratos en entrenamiento + Sensibilizador de Insulina (Vinagre de Manzana previo a comida alta en carbos).</p>
            </div>
            <div className="bg-neutral-900 p-4 rounded-lg border-l-4 border-orange-500">
              <h4 className="font-bold text-white uppercase text-sm mb-1">Grupo B: Protocolo Intra</h4>
              <p className="text-[11px] text-neutral-400">Misma dieta hipercalórica, pero usando únicamente carbohidratos simples post-entreno (Sin optimizador de insulina).</p>
            </div>
            <div className="bg-neutral-900 p-4 rounded-lg border-l-4 border-slate-500">
              <h4 className="font-bold text-white uppercase text-sm mb-1">Grupo C: Control Normal</h4>
              <p className="text-[11px] text-neutral-400">Dieta estándar, comidas a deshoras, sin horario estricto alrededor del entrenamiento.</p>
            </div>
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
              <p className="text-[10px] text-neutral-400 font-mono leading-relaxed">1 cucharada diluida en agua 15 minutos antes de tu comida más alta en carbohidratos. <strong>Reduce el pico de insulina</strong> hasta un 30%.</p>
            </div>

            <div className="bg-black border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group hover:border-red-500/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/30 mb-4 group-hover:scale-110 transition-transform">
                <Flame className="text-red-500" size={18}/>
              </div>
              <h3 className="text-xs font-black uppercase text-white mb-2">Agua de Jamaica Orgánica</h3>
              <p className="text-[10px] text-neutral-400 font-mono leading-relaxed">Hervir flor de jamaica sin azúcar. Tomar 1 Litro a lo largo del día. Actúa como un potente <strong>diurético natural</strong> subcutáneo.</p>
            </div>

            <div className="bg-black border border-neutral-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/50 transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 mb-4 group-hover:scale-110 transition-transform">
                <Zap className="text-blue-500" size={18}/>
              </div>
              <h3 className="text-xs font-black uppercase text-white mb-2">La Bomba de Sodio (Pre)</h3>
              <p className="text-[10px] text-neutral-400 font-mono leading-relaxed">1/2 cucharadita de Sal del Himalaya + Medio limón en 100ml de agua, 30 mins antes de entrenar. Genera <strong>expansión de volumen sanguíneo</strong>.</p>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}