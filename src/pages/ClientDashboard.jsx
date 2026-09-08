import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { evaluateBadges } from '../services/badgeService';
import AthletePreferences from '../components/AthletePreferences';
import { 
  Dumbbell, Utensils, Activity, MessageSquare, 
  LogOut, Loader2, Clock, ShieldCheck, Droplets, Award, Flame, Settings
} from 'lucide-react';

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme(); 
  
  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [coachName, setCoachName] = useState('');
  
  const [currentWeek, setCurrentWeek] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [program, setProgram] = useState(null);
  const [programEndsAt, setProgramEndsAt] = useState(null);
  const [programExpired, setProgramExpired] = useState(false);
  const [programTotalWeeks, setProgramTotalWeeks] = useState(12);
  const [fenixUnlocked, setFenixUnlocked] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    fetchAthleteData();
  }, []);

  const fetchAthleteData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      // Ã°Å¸Å¡â‚¬ ESCUDO ANTI-FANTASMAS: Usamos maybeSingle() para no colapsar si la cuenta fue borrada
      const { data: athleteData, error: athleteErr } = await supabase
        .from('athletes_profile')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (athleteErr || !athleteData) {
        // Si el perfil no existe (fue borrado en Supabase), cerramos sesiÃƒÂ³n forzosamente
        await supabase.auth.signOut();
        navigate('/');
        return;
      }
      
      if (!athleteData.is_onboarded) {
        navigate('/client/onboarding');
        return;
      }

      setAthlete(athleteData);

      const { data: coachData } = await supabase
        .from('coaches_profile')
        .select('full_name')
        .eq('id', athleteData.coach_id)
        .maybeSingle();
        
      if (coachData) setCoachName(coachData.full_name);

      // La autoridad del badge vive en PostgreSQL. El navegador solo solicita
      // evaluaciÃƒÂ³n determinÃƒÂ­stica y lee el resultado autorizado.
      const badgeResult = await evaluateBadges(athleteData.id);
      setFenixUnlocked(Boolean(badgeResult?.fenixUnlocked));

      const { data: programData, error: programLoadError } = await supabase
        .from('athlete_programs')
        .select('id, package_tier, service_focus, duration_value, duration_unit, starts_at, ends_at, status')
        .eq('athlete_id', athleteData.id)
        .in('status', ['ACTIVE', 'SCHEDULED', 'PAUSED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (programLoadError) {
        console.warn('No se pudo cargar el programa comercial:', programLoadError);
      }

      setProgram(programData || null);

      const now = new Date();
      const programStart = programData?.starts_at ? new Date(programData.starts_at) : null;
      const programEnd = programData?.ends_at ? new Date(programData.ends_at) : null;

      setProgramEndsAt(programData?.ends_at || null);

      if (programStart && programEnd) {
        const totalProgramWeeks = Math.max(1, Math.ceil((programEnd.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24 * 7)));
        setProgramTotalWeeks(totalProgramWeeks);

        const isExpired = now >= programEnd;
        const isCurrentlyActive = programData.status === 'ACTIVE' && now >= programStart && now < programEnd;

        setProgramExpired(isExpired);
        setIsActive(isCurrentlyActive);

        if (isCurrentlyActive) {
          const diffDays = Math.max(0, Math.floor((now.getTime() - programStart.getTime()) / (1000 * 60 * 60 * 24)));
          setCurrentWeek(Math.min(totalProgramWeeks, Math.floor(diffDays / 7) + 1));
        }
      } else if (athleteData.program_start_date) {
        setIsActive(true);
        setProgramExpired(false);

        const startDate = new Date(athleteData.program_start_date);
        const diffDays = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        setCurrentWeek(Math.max(1, Math.floor(diffDays / 7) + 1));
      }

    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin" color={theme?.brandColor || '#f59e0b'} size={40} /></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-neutral-800 relative">
      
      <div className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none" style={{ background: `linear-gradient(180deg, ${theme?.brandColor || '#f59e0b'} 0%, transparent 100%)` }}></div>

      <nav className="relative z-10 border-b border-neutral-800 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0">
        <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: theme?.brandColor || '#f59e0b' }} />
            <span className="text-xs font-black uppercase tracking-widest text-neutral-300">Team {(coachName || 'Coach').split(' ')[0]}</span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPreferencesOpen(true)} className="min-h-11 min-w-11 rounded-xl text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-white" aria-label="Preferencias"><Settings className="mx-auto" size={18} /></button>
            <button onClick={handleLogout} className="text-neutral-500 hover:text-white transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </nav>

      {preferencesOpen && (
        <AthletePreferences onClose={() => setPreferencesOpen(false)} />
      )}

      <main className="max-w-md mx-auto px-6 py-8 relative z-10 space-y-8 pb-20">
        
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight leading-none uppercase">
            Hola, <span style={{ color: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b') }}>{(athlete?.full_name || 'Atleta').split(' ')[0]}</span>
          </h1>
          <p className="text-sm text-neutral-400 font-mono">Plan activo: {athlete?.b2c_plan || 'Pendiente'}</p>
        </div>

        {fenixUnlocked && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-3xl p-5 flex items-start gap-4 animate-in zoom-in-95 duration-700 shadow-[0_0_30px_rgba(234,179,8,0.15)]">
            <div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center shrink-0 border border-yellow-500/50">
              <Flame className="text-yellow-500" size={24} />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2">
                Medalla FÃƒÂ©nix Desbloqueada <Award size={14}/>
              </h2>
              <p className="text-[11px] text-yellow-200/70 font-mono mt-1 leading-relaxed">
                Has completado el protocolo innegociable de 12 semanas. Ya no eres la misma persona que empezÃƒÂ³. Eres de Ãƒâ€°lite.
              </p>
            </div>
          </div>
        )}

        {programExpired ? (
          <div className="bg-red-950/30 border border-red-900/50 rounded-3xl p-6 flex items-start gap-4">
            <Clock className="text-red-400 shrink-0" size={24} />
            <div>
              <h2 className="text-sm font-black uppercase text-red-300 mb-1">Programa vencido</h2>
              <p className="text-xs text-neutral-400 font-mono">Tu acceso esta pausado porque el paquete contratado termino.</p>
              {programEndsAt && (
                <p className="text-xs text-red-300 font-mono mt-2">
                  Vencio el {new Intl.DateTimeFormat('es-US', { dateStyle: 'medium' }).format(new Date(programEndsAt))}
                </p>
              )}
            </div>
          </div>
        ) : isActive ? (
          <div className={`bg-[#111] border rounded-3xl p-6 relative overflow-hidden transition-all duration-700 ${fenixUnlocked ? 'border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.1)]' : 'border-neutral-800'}`}>
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b') }}></div>
            
            <div className="flex justify-between items-end mb-4 relative z-10">
              <div>
                <p className="text-[10px] uppercase font-black tracking-widest text-neutral-500 mb-1">{fenixUnlocked ? 'Ciclo Completado' : 'Tu Progreso'}</p>
                <h2 className="text-4xl font-black font-mono leading-none">
                  Semana {currentWeek}<span className="text-lg text-neutral-600">/{programTotalWeeks}</span>
                </h2>
              </div>
              <div className="w-12 h-12 rounded-full border-[3px] flex items-center justify-center font-black text-sm relative z-10 bg-black/50" style={{ borderColor: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b'), color: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b') }}>
                {fenixUnlocked ? '100%' : `${Math.round((currentWeek / programTotalWeeks) * 100)}%`}
              </div>
            </div>

            <div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden relative z-10">
              <div 
                className="h-full transition-all duration-1000 ease-out"
                style={{ width: `${fenixUnlocked ? 100 : (currentWeek / programTotalWeeks) * 100}%`, backgroundColor: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b') }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 flex items-start gap-4">
            <Clock className="text-yellow-500 shrink-0" size={24} />
            <div>
              <h2 className="text-sm font-black uppercase text-white mb-1">Sala de Espera</h2>
              <p className="text-xs text-neutral-400 font-mono">Estamos esperando que el Coach <strong className="text-white">{coachName || 'asignado'}</strong> evalÃƒÂºe tu biometrÃƒÂ­a y active tu fecha de inicio.</p>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-4">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Tus Aplicaciones</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => navigate('/client/arquitecto')} disabled={!isActive} className="bg-[#111] border border-neutral-800 rounded-[2rem] p-5 text-left transition-all hover:bg-neutral-900 hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed group">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ backgroundColor: `${theme?.brandColor || '#f59e0b'}15` }}>
                <Utensils size={20} style={{ color: theme?.brandColor || '#f59e0b' }} />
              </div>
              <h4 className="font-bold text-sm text-white leading-tight">El Arquitecto</h4>
              <p className="text-[10px] text-neutral-500 font-mono mt-1">Macros y Dieta</p>
            </button>

            <button onClick={() => navigate('/client/entrenamiento')} disabled={!isActive} className="bg-[#111] border border-neutral-800 rounded-[2rem] p-5 text-left transition-all hover:bg-neutral-900 hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed group">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ backgroundColor: `${theme?.brandColor || '#f59e0b'}15` }}>
                <Dumbbell size={20} style={{ color: theme?.brandColor || '#f59e0b' }} />
              </div>
              <h4 className="font-bold text-sm text-white leading-tight">Trainer Pro</h4>
              <p className="text-[10px] text-neutral-500 font-mono mt-1">Tu Rutina</p>
            </button>

            <button onClick={() => navigate('/client/disciplina')} disabled={!isActive} className="bg-[#111] border border-neutral-800 rounded-[2rem] p-5 text-left transition-all hover:bg-neutral-900 hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed group col-span-2 flex items-center justify-between">
              <div>
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ backgroundColor: `${theme?.brandColor || '#f59e0b'}15` }}>
                  <Activity size={20} style={{ color: theme?.brandColor || '#f59e0b' }} />
                </div>
                <h4 className="font-bold text-sm text-white leading-tight">Monitoreo de Disciplina</h4>
                <p className="text-[10px] text-neutral-500 font-mono mt-1">Check-in, Pasos y HÃƒÂ¡bitos</p>
              </div>
              {isActive && new Date().getDay() === 0 && (
                <span className="text-[9px] font-black uppercase bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 animate-pulse">Pendiente</span>
              )}
            </button>

            <button onClick={() => navigate('/client/hormonal')} disabled={!isActive} className="bg-[#111] border border-neutral-800 p-6 rounded-3xl relative overflow-hidden group hover:border-pink-500/50 transition-all text-left w-full flex flex-col col-span-2 disabled:opacity-50 disabled:cursor-not-allowed">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-pink-500/20 transition-all"></div>
              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center border border-pink-500/30 shrink-0"><Droplets size={20} className="text-pink-500" /></div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">Sync Hormonal</h2>
              </div>
              <p className="text-[11px] text-neutral-400 font-mono leading-relaxed relative z-10">SincronizaciÃƒÂ³n del ciclo menstrual con tu matriz fÃƒÂ­sica. <span className="text-pink-400 font-bold">Exclusivo Mujeres Ãƒâ€°lite.</span></p>
            </button>

            <button onClick={() => navigate('/chat')} className="bg-[#111] border border-neutral-800 rounded-[2rem] p-5 text-left transition-all hover:bg-neutral-900 hover:border-neutral-700 group col-span-2 flex items-center gap-4">
               <div className="w-10 h-10 rounded-2xl flex shrink-0 items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${theme?.brandColor || '#f59e0b'}15` }}>
                  <MessageSquare size={20} style={{ color: theme?.brandColor || '#f59e0b' }} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white leading-tight">Red de Comunicaciones</h4>
                  <p className="text-[10px] text-neutral-500 font-mono mt-1">Chat directo con el Coach y la Tribu</p>
                </div>
            </button>

          </div>
        </div>
      </main>
    </div>
  );
}
