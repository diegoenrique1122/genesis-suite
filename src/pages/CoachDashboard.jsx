import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Users, Activity, Loader2, ArrowRight, ShieldCheck, 
  Settings, UserPlus, LogOut, MessageSquare, Globe
} from 'lucide-react';

export default function CoachDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState(null);
  const [roster, setRoster] = useState([]);
  
  // Estadísticas rápidas
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0 });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      // 1. Obtener perfil del Coach
      const { data: coachData, error: coachErr } = await supabase
        .from('coaches_profile')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (coachErr || !coachData) throw new Error("Perfil de coach no encontrado");
      setCoachProfile(coachData);

      // 2. Obtener Roster de Atletas (Radar Global)
      const { data: athletesData } = await supabase
        .from('athletes_profile')
        .select('id, full_name, b2c_plan, routine_status, program_start_date, discipline_metrics')
        .eq('coach_id', coachData.id)
        .order('created_at', { ascending: false });

      if (athletesData) {
        setRoster(athletesData);
        setStats({
          total: athletesData.length,
          pending: athletesData.filter(a => a.routine_status === 'PENDING_AUDIT').length,
          active: athletesData.filter(a => a.program_start_date !== null).length
        });
      }

    } catch (err) {
      console.error("Error cargando Command Center:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  const brand = theme?.brandColor || '#3b82f6';
  const isElite = coachProfile?.b2b_plan === 'ELITE';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-20 selection:bg-neutral-800">
      
      {/* Background Glow */}
      <div 
        className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none"
        style={{ background: `linear-gradient(180deg, ${brand} 0%, transparent 100%)` }}
      ></div>

      {/* NAVBAR B2B */}
      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: brand }} />
            <span className="text-sm font-black uppercase tracking-widest text-white">
              Command Center
            </span>
            <span className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono ml-2">
              {coachProfile?.b2b_plan}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/coach/settings')} className="text-neutral-500 hover:text-white transition-colors flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest">
              <Settings size={16} /> Ajustes
            </button>
            <button onClick={handleLogout} className="text-neutral-500 hover:text-red-500 transition-colors">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 relative z-10">
        
        {/* ENCABEZADO Y MÉTRICAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 md:col-span-2 flex flex-col justify-center">
            <h1 className="text-2xl font-black uppercase tracking-tight mb-1">
              Hola, {coachProfile?.full_name?.split(' ')[0] || 'Coach'}
            </h1>
            <p className="text-xs text-neutral-400 font-mono">
              Tienes {stats.pending} atletas requiriendo auditoría clínica hoy.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-black border border-neutral-800 rounded-3xl p-5 text-center flex flex-col justify-center">
              <span className="text-3xl font-black font-mono text-white">{stats.active}</span>
              <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500 mt-1">Activos</span>
            </div>
            <div className="bg-black border border-neutral-800 rounded-3xl p-5 text-center flex flex-col justify-center">
              <span className="text-3xl font-black font-mono text-amber-500">{stats.pending}</span>
              <span className="text-[9px] uppercase font-black tracking-widest text-amber-500/70 mt-1">Pendientes</span>
            </div>
          </div>
        </div>

        {/* 🚀 NUEVO: HUB DE ACCIONES RÁPIDAS (AQUÍ ESTÁ EL CHAT) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Botón hacia el Chat (Multi-Tenant) */}
          <button 
            onClick={() => navigate('/chat')}
            className="bg-[#111] border border-neutral-800 hover:border-neutral-600 rounded-3xl p-5 flex items-center justify-between group transition-all shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-12 h-12 rounded-xl flex items-center justify-center bg-black border border-neutral-800 group-hover:scale-110 transition-transform"
              >
                {isElite ? <Globe size={20} style={{ color: brand }} /> : <MessageSquare size={20} style={{ color: brand }} />}
              </div>
              <div className="text-left">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">
                  Red de Comunicaciones
                </h2>
                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                  {isElite ? 'Muro Global, Sala Coaches y Chat 1-a-1' : 'Chat Directo 1-a-1 con Atletas'}
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-neutral-600 group-hover:text-white transition-colors" />
          </button>

          {/* Botón para invitar clientes */}
          <button 
            onClick={() => navigate('/coach/settings')}
            className="bg-[#111] border border-neutral-800 hover:border-neutral-600 rounded-3xl p-5 flex items-center justify-between group transition-all shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-black border border-neutral-800 group-hover:scale-110 transition-transform">
                <UserPlus size={20} className="text-neutral-400" />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-black uppercase tracking-widest text-white">
                  Adquisición de Clientes
                </h2>
                <p className="text-[10px] text-neutral-500 font-mono mt-0.5">
                  Gestiona tus códigos de invitación B2C
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-neutral-600 group-hover:text-white transition-colors" />
          </button>

        </div>

        {/* RADAR GLOBAL (ROSTER DE ATLETAS) */}
        <div className="bg-[#111] border border-neutral-800 rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2">
              <Activity size={16} style={{ color: brand }} /> Radar Global de Atletas
            </h2>
          </div>

          {roster.length === 0 ? (
            <div className="text-center py-12">
              <Users size={40} className="text-neutral-700 mx-auto mb-3" />
              <p className="text-xs font-mono text-neutral-500">Aún no tienes atletas asignados a tu roster.</p>
              <p className="text-[10px] text-neutral-600 mt-1">Comparte tus códigos de invitación para comenzar.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {roster.map(athlete => (
                <button
                  key={athlete.id}
                  onClick={() => navigate(`/coach/client/${athlete.id}`)}
                  className="w-full bg-black border border-neutral-800 hover:border-neutral-600 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center font-black uppercase text-sm group-hover:bg-white group-hover:text-black transition-colors">
                      {athlete.full_name?.substring(0, 2)}
                    </div>
                    <div className="text-left">
                      <h3 className="text-sm font-black uppercase tracking-widest text-white">
                        {athlete.full_name}
                      </h3>
                      <p className="text-[10px] font-mono text-neutral-500">
                        Plan: {athlete.b2c_plan}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    {!athlete.program_start_date ? (
                      <span className="text-[9px] bg-neutral-800 text-neutral-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                        En Sala de Espera
                      </span>
                    ) : athlete.routine_status === 'PENDING_AUDIT' ? (
                      <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-3 py-1 rounded-full font-bold uppercase tracking-widest animate-pulse">
                        Requiere Auditoría
                      </span>
                    ) : (
                      <span className="text-[9px] bg-green-500/10 border border-green-500/30 text-green-500 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                        Activo / Auditado
                      </span>
                    )}
                    <ArrowRight size={16} className="text-neutral-600 group-hover:text-white" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}