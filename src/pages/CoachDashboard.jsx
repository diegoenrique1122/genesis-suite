import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Users, Link as LinkIcon, ShieldCheck, Clock, CheckCircle2, 
  Settings, LogOut, Copy, Lock, Loader2, Dumbbell, PlayCircle, AtSign 
} from 'lucide-react';

export default function CoachDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  
  const [coach, setCoach] = useState(null);
  const [athletes, setAthletes] = useState([]);
  const [pendingAthletes, setPendingAthletes] = useState([]);
  
  const [globalSettings, setGlobalSettings] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const { data: globals } = await supabase.from('super_admin_settings').select('*').eq('id', 1).maybeSingle();
      if (globals) setGlobalSettings(globals);

      const { data: profileData, error: profileErr } = await supabase
        .from('coaches_profile')
        .select('*')
        .eq('user_id', session.user.id)
        .single();
      
      if (profileErr) throw profileErr;
      setCoach(profileData);

      const { data: athletesData } = await supabase
        .from('athletes_profile')
        .select('*')
        .eq('coach_id', profileData.id)
        .order('created_at', { ascending: false });

      const allAthletes = athletesData || [];
      
      setPendingAthletes(allAthletes.filter(a => !a.program_start_date || a.routine_status === 'PENDING_AUDIT'));
      setAthletes(allAthletes.filter(a => a.program_start_date));

    } catch (error) {
      console.error("Error Dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleActivateAthlete = async (athleteId) => {
    if(!window.confirm("¿Seguro que deseas activar a este atleta? Su cronómetro de 12 semanas iniciará en este preciso instante.")) return;
    
    try {
      setLoading(true);
      const { error } = await supabase.from('athletes_profile').update({
        program_start_date: new Date().toISOString()
      }).eq('id', athleteId);
      
      if (error) throw error;
      alert("✅ Atleta activado. El protocolo innegociable de 12 semanas ha comenzado.");
      fetchDashboardData(); 
    } catch (error) {
      alert("❌ Error al activar: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    alert(`✅ Código copiado: ${code}\nEnvíalo a tu atleta para que se registre en su plan.`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin" color={theme?.brandColor || '#f59e0b'} size={40}/></div>;

  const baseCode = coach?.coach_code || '123456';
  const planB2B = coach?.b2b_plan?.toUpperCase() || 'IGNICION';
  const isElite = planB2B === 'ELITE';
  
  const canSellEvo = planB2B === 'EVOLUCION' || planB2B === 'ELITE';
  const canSellElite = planB2B === 'ELITE'; 

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-20 relative overflow-hidden">
      
      {/* 🔮 RENDERIZADOR CONDICIONAL DE MARCA DE AGUA (FIJADA Y VISIBLE) */}
      {isElite && coach?.brand_logo_url ? (
         <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-0 opacity-10">
           <img src={coach.brand_logo_url} alt="Coach Logo" className="w-1/2 object-contain grayscale" />
         </div>
      ) : (!isElite && globalSettings) ? (
         <div className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center z-0" style={{ opacity: (globalSettings.watermark_opacity || 15) / 100 }}>
           {globalSettings.watermark_url && (
             <img src={globalSettings.watermark_url} alt="Genesis Global" style={{ width: `${globalSettings.watermark_size || 50}%`, objectFit: 'contain' }} className="blur-[1px] drop-shadow-2xl" />
           )}
           {globalSettings.instagram_handle && (
             <div className="flex items-center gap-3 mt-6 text-4xl sm:text-6xl font-black tracking-widest text-white/40 drop-shadow-lg">
               <AtSign size={48} /> {globalSettings.instagram_handle.replace('@', '')}
             </div>
           )}
         </div>
      ) : null}

      <div className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none z-0" style={{ background: `linear-gradient(180deg, ${theme?.brandColor || '#f59e0b'} 0%, transparent 100%)` }}></div>

      {/* NAVBAR */}
      <nav className="relative z-10 border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: theme?.brandColor || '#f59e0b' }} />
            <span className="text-xs font-black uppercase tracking-widest text-neutral-300">Command Center</span>
          </div>
          <div className="flex gap-4">
            <button onClick={() => navigate('/coach/settings')} className="text-neutral-500 hover:text-white transition-colors"><Settings size={18} /></button>
            <button onClick={handleLogout} className="text-neutral-500 hover:text-white transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 relative z-10 space-y-8">
        
        {/* ENCABEZADO */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight">Hola, {coach?.full_name?.split(' ')[0] || 'Coach'}</h1>
            <p className="text-sm text-neutral-400 font-mono mt-1">Licencia B2B: <span style={{ color: theme?.brandColor || '#f59e0b' }} className="font-bold">{planB2B}</span></p>
          </div>
          <button onClick={() => navigate('/coach/settings')} className="bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-xl text-[10px] font-black uppercase hover:bg-neutral-800 transition-colors shadow-lg">
            Tu Marca & Ajustes
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* COLUMNA IZQUIERDA: ENLACES */}
          <div className="lg:col-span-4 space-y-6">
            {/* 🔮 Tarjeta Glassmorphism */}
            <div className="bg-[#111]/70 backdrop-blur-xl border border-neutral-800/60 p-6 rounded-3xl shadow-xl">
              <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 mb-6 flex items-center gap-2"><LinkIcon size={16} style={{ color: theme?.brandColor || '#f59e0b' }}/> Enlaces de Adquisición</h2>
              
              <div className="space-y-4">
                <div className="bg-black/60 border border-neutral-800/50 rounded-2xl p-4 relative group backdrop-blur-md">
                  <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">Plan Ignición (Base)</span>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-mono font-bold text-white tracking-wider">IGN-{baseCode}</span>
                    <button onClick={() => handleCopy(`IGN-${baseCode}`)} className="text-neutral-500 hover:text-white bg-neutral-900/80 p-2 rounded-xl"><Copy size={14}/></button>
                  </div>
                </div>

                <div className={`bg-black/60 border border-neutral-800/50 rounded-2xl p-4 relative backdrop-blur-md ${!canSellEvo ? 'opacity-50 grayscale' : ''}`}>
                  {!canSellEvo && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-2xl"><Lock size={20} className="text-neutral-400"/></div>}
                  <span className="text-[10px] font-black uppercase text-blue-500 block mb-1">Plan Evolución (Pro)</span>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-mono font-bold text-blue-100 tracking-wider">EVO-{baseCode}</span>
                    <button disabled={!canSellEvo} onClick={() => handleCopy(`EVO-${baseCode}`)} className="text-blue-500 hover:text-blue-400 bg-blue-900/20 p-2 rounded-xl"><Copy size={14}/></button>
                  </div>
                </div>

                <div className={`bg-black/60 border border-neutral-800/50 rounded-2xl p-4 relative backdrop-blur-md ${!canSellElite ? 'opacity-50 grayscale' : ''}`}>
                  {!canSellElite && <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 rounded-2xl"><Lock size={20} className="text-neutral-400"/></div>}
                  <span className="text-[10px] font-black uppercase text-amber-500 block mb-1">Plan Élite 360°</span>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-mono font-bold text-amber-100 tracking-wider">PRO-{baseCode}</span>
                    <button disabled={!canSellElite} onClick={() => handleCopy(`PRO-${baseCode}`)} className="text-amber-500 hover:text-amber-400 bg-amber-900/20 p-2 rounded-xl"><Copy size={14}/></button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: ROSTER */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* SALA DE ESPERA (PENDIENTES) */}
            <div className="bg-gradient-to-br from-[#111]/80 to-[#1a1a1a]/80 backdrop-blur-xl border border-neutral-800/60 p-6 rounded-3xl shadow-2xl">
              <div className="flex justify-between items-center mb-6 border-b border-neutral-800/50 pb-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Clock size={16} className="text-yellow-500"/> Por Activar</h2>
                <span className="bg-yellow-500/20 text-yellow-500 font-mono font-bold text-[10px] px-3 py-1 rounded-full">{pendingAthletes.length}</span>
              </div>

              {pendingAthletes.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-neutral-800/50 rounded-2xl bg-black/20"><p className="text-xs font-mono text-neutral-500">Tu sala de espera está vacía.</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pendingAthletes.map(athlete => (
                    <div key={athlete.id} className="bg-black/40 backdrop-blur-sm border border-neutral-800/50 p-4 rounded-2xl flex flex-col justify-between shadow-inner">
                      <div className="mb-4">
                        <h3 className="font-bold text-sm text-white uppercase">{athlete.full_name}</h3>
                        <p className="text-[10px] text-neutral-500 font-mono mt-1">Plan: <span className="text-yellow-500">{athlete.b2c_plan}</span></p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => navigate(`/coach/client/${athlete.id}`)} className="flex-1 bg-neutral-900/80 hover:bg-neutral-800 text-white font-bold uppercase text-[10px] py-2 rounded-xl transition-colors border border-neutral-800">
                          Auditar
                        </button>
                        {!athlete.program_start_date && (
                          <button onClick={() => handleActivateAthlete(athlete.id)} className="flex-1 bg-green-600/90 hover:bg-green-500 text-white font-bold uppercase text-[10px] py-2 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-1">
                            <PlayCircle size={12}/> Activar
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ROSTER ACTIVO */}
            <div className="bg-[#111]/70 backdrop-blur-xl border border-neutral-800/60 p-6 rounded-3xl shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Users size={16} style={{ color: theme?.brandColor || '#f59e0b' }}/> Roster Activo</h2>
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-neutral-500 mb-0.5">Total Atletas</p>
                  <span className="font-mono text-xl font-black">{athletes.length}</span>
                </div>
              </div>

              {athletes.length === 0 ? (
                <div className="py-12 text-center border-2 border-dashed border-neutral-800/50 rounded-2xl bg-black/20"><p className="text-xs font-mono text-neutral-500">Aún no tienes clientes activos en la plataforma.</p></div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {athletes.map(athlete => (
                    <div key={athlete.id} onClick={() => navigate(`/coach/client/${athlete.id}`)} className="bg-black/50 backdrop-blur-sm border border-neutral-800/50 p-4 rounded-2xl cursor-pointer hover:border-neutral-600 transition-all group flex items-center justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-white uppercase group-hover:text-amber-500 transition-colors">{athlete.full_name}</h3>
                        <p className="text-[10px] text-neutral-500 font-mono mt-1">Suscripción: {athlete.b2c_plan}</p>
                      </div>
                      <Dumbbell size={16} className="text-neutral-700 group-hover:text-amber-500 transition-colors" />
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}