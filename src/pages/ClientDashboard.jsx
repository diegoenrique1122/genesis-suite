import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { evaluateBadges } from '../services/badgeService';
import AthletePreferences from '../components/AthletePreferences';
import {
  Dumbbell, Utensils, Activity, MessageSquare,
  LogOut, Loader2, Clock, ShieldCheck, Droplets, Award, Flame, Settings,
} from 'lucide-react';

const COPY = {
  es: {
    team: 'Equipo', coach: 'Coach', preferences: 'Preferencias', signOut: 'Cerrar sesion',
    greeting: 'Hola', athlete: 'Atleta', activePlan: 'Plan activo:', pending: 'Pendiente',
    medalTitle: 'Medalla Fenix desbloqueada', medalText: 'Has completado el protocolo innegociable de 12 semanas. Ya no eres la misma persona que empezo. Eres de Elite.',
    expiredTitle: 'Programa vencido', expiredText: 'Tu acceso esta pausado porque el paquete contratado termino.', expiredOn: 'Vencio el',
    cycleCompleted: 'Ciclo completado', progress: 'Tu progreso', week: 'Semana',
    waitingTitle: 'Sala de espera', waitingStart: 'Estamos esperando que el Coach', assigned: 'asignado', waitingEnd: 'evalue tu biometria y active tu fecha de inicio.',
    apps: 'Tus aplicaciones', nutritionName: 'El Arquitecto', nutritionHint: 'Macros y dieta', trainingName: 'Trainer Pro', trainingHint: 'Tu rutina',
    disciplineName: 'Monitoreo de disciplina', disciplineHint: 'Check-in, pasos y habitos', pendingTask: 'Pendiente',
    hormonalName: 'Sync hormonal', hormonalHint: 'Sincronizacion del ciclo menstrual con tu matriz fisica.', hormonalElite: 'Exclusivo Mujeres Elite.',
    chatName: 'Red de comunicaciones', chatHint: 'Chat directo con el Coach y la Tribu',
  },
  en: {
    team: 'Team', coach: 'Coach', preferences: 'Preferences', signOut: 'Sign out',
    greeting: 'Hello', athlete: 'Athlete', activePlan: 'Active plan:', pending: 'Pending',
    medalTitle: 'Phoenix medal unlocked', medalText: 'You completed the non-negotiable 12-week protocol. You are no longer the same person who started. You are Elite.',
    expiredTitle: 'Program expired', expiredText: 'Your access is paused because the purchased package has ended.', expiredOn: 'Expired on',
    cycleCompleted: 'Cycle completed', progress: 'Your progress', week: 'Week',
    waitingTitle: 'Waiting room', waitingStart: 'We are waiting for Coach', assigned: 'assigned', waitingEnd: 'to review your biometrics and activate your start date.',
    apps: 'Your applications', nutritionName: 'Nutrition Architect', nutritionHint: 'Macros and nutrition', trainingName: 'Trainer Pro', trainingHint: 'Your workout plan',
    disciplineName: 'Discipline monitoring', disciplineHint: 'Check-in, steps and habits', pendingTask: 'Pending',
    hormonalName: 'Hormonal sync', hormonalHint: 'Menstrual-cycle synchronization with your physical matrix.', hormonalElite: 'Elite women only.',
    chatName: 'Communications network', chatHint: 'Direct chat with your Coach and community',
  },
};

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { locale } = useLocale();
  const text = COPY[locale] || COPY.es;

  const [loading, setLoading] = useState(true);
  const [athlete, setAthlete] = useState(null);
  const [coachName, setCoachName] = useState('');
  const [currentWeek, setCurrentWeek] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [programEndsAt, setProgramEndsAt] = useState(null);
  const [programExpired, setProgramExpired] = useState(false);
  const [programTotalWeeks, setProgramTotalWeeks] = useState(12);
  const [fenixUnlocked, setFenixUnlocked] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => { fetchAthleteData(); }, []);

  const fetchAthleteData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const { data: athleteData, error: athleteErr } = await supabase
        .from('athletes_profile').select('*').eq('user_id', session.user.id).maybeSingle();

      if (athleteErr || !athleteData) {
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
        .from('coaches_profile').select('full_name').eq('id', athleteData.coach_id).maybeSingle();
      if (coachData) setCoachName(coachData.full_name);

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

      if (programLoadError) console.warn('Genesis program load:', programLoadError);

      const now = new Date();
      const programStart = programData?.starts_at ? new Date(programData.starts_at) : null;
      const programEnd = programData?.ends_at ? new Date(programData.ends_at) : null;
      setProgramEndsAt(programData?.ends_at || null);

      if (programStart && programEnd) {
        const totalWeeks = Math.max(1, Math.ceil((programEnd.getTime() - programStart.getTime()) / 604800000));
        const active = programData.status === 'ACTIVE' && now >= programStart && now < programEnd;
        setProgramTotalWeeks(totalWeeks);
        setProgramExpired(now >= programEnd);
        setIsActive(active);
        if (active) {
          const elapsedDays = Math.max(0, Math.floor((now.getTime() - programStart.getTime()) / 86400000));
          setCurrentWeek(Math.min(totalWeeks, Math.floor(elapsedDays / 7) + 1));
        }
      } else if (athleteData.program_start_date) {
        const startDate = new Date(athleteData.program_start_date);
        const elapsedDays = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / 86400000));
        setIsActive(true);
        setProgramExpired(false);
        setCurrentWeek(Math.max(1, Math.floor(elapsedDays / 7) + 1));
      }
    } catch (error) {
      console.error('Genesis athlete dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin" color={theme?.brandColor || '#f59e0b'} size={40} /></div>;

  const progress = fenixUnlocked ? 100 : Math.round((currentWeek / programTotalWeeks) * 100);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-neutral-800 relative" style={{ backgroundColor: theme?.bgColor || "#0a0a0a", color: theme?.textColor || "#ffffff" }}>
      <div className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none" style={{ background: `linear-gradient(180deg, ${theme?.brandColor || '#f59e0b'} 0%, transparent 100%)` }} />
      <nav className="relative z-10 border-b genesis-border genesis-bg backdrop-blur-md sticky top-0">
        <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {theme?.logoUrl ? (
              <img
                src={theme.logoUrl}
                alt=""
                aria-hidden="true"
                className="h-7 w-7 rounded-lg object-contain border border-white/10 bg-black/20 p-1"
              />
            ) : (
              <ShieldCheck size={20} style={{ color: theme?.brandColor || '#f59e0b' }} />
            )}
            <span className="text-xs font-black uppercase tracking-widest text-neutral-300">
              {text.team} {(coachName || text.coach).split(' ')[0]}
            </span>
          </div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setPreferencesOpen(true)} className="min-h-11 min-w-11 rounded-xl text-neutral-400 transition-colors hover:bg-neutral-900 hover:text-white" aria-label={text.preferences}><Settings className="mx-auto" size={18} /></button><button type="button" onClick={handleLogout} className="min-h-11 min-w-11 rounded-xl text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-white" aria-label={text.signOut}><LogOut className="mx-auto" size={18} /></button></div>
        </div>
      </nav>

      {preferencesOpen && <AthletePreferences onClose={() => setPreferencesOpen(false)} />}

      <main className="max-w-md mx-auto px-6 py-8 relative z-10 space-y-8 pb-20">
        <div className="space-y-2"><h1 className="text-3xl font-black tracking-tight leading-none uppercase">{text.greeting}, <span style={{ color: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b') }}>{(athlete?.full_name || text.athlete).split(' ')[0]}</span></h1><p className="text-sm text-neutral-400 font-mono">{text.activePlan} {athlete?.b2c_plan || text.pending}</p></div>

        {fenixUnlocked && <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-3xl p-5 flex items-start gap-4 animate-in zoom-in-95 duration-700 shadow-[0_0_30px_rgba(234,179,8,0.15)]"><div className="w-12 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center shrink-0 border border-yellow-500/50"><Flame className="text-yellow-500" size={24} /></div><div><h2 className="text-sm font-black uppercase text-yellow-500 tracking-widest flex items-center gap-2">{text.medalTitle} <Award size={14} /></h2><p className="text-[11px] text-yellow-200/70 font-mono mt-1 leading-relaxed">{text.medalText}</p></div></div>}

        {programExpired ? <div className="bg-red-950/30 border border-red-900/50 rounded-3xl p-6 flex items-start gap-4"><Clock className="text-red-400 shrink-0" size={24} /><div><h2 className="text-sm font-black uppercase text-red-300 mb-1">{text.expiredTitle}</h2><p className="text-xs text-neutral-400 font-mono">{text.expiredText}</p>{programEndsAt && <p className="text-xs text-red-300 font-mono mt-2">{text.expiredOn} {new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-US', { dateStyle: 'medium' }).format(new Date(programEndsAt))}</p>}</div></div> : isActive ? <div className={`genesis-surface border rounded-3xl p-6 relative overflow-hidden transition-all duration-700 ${fenixUnlocked ? 'border-yellow-500/50 shadow-[0_0_40px_rgba(234,179,8,0.1)]' : 'genesis-border'}`}><div className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b') }} /><div className="flex justify-between items-end mb-4 relative z-10"><div><p className="text-[10px] uppercase font-black tracking-widest text-neutral-500 mb-1">{fenixUnlocked ? text.cycleCompleted : text.progress}</p><h2 className="text-4xl font-black font-mono leading-none">{text.week} {currentWeek}<span className="text-lg text-neutral-600">/{programTotalWeeks}</span></h2></div><div className="w-12 h-12 rounded-full border-[3px] flex items-center justify-center font-black text-sm relative z-10 genesis-bg" style={{ borderColor: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b'), color: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b') }}>{progress}%</div></div><div className="w-full bg-neutral-900 h-2 rounded-full overflow-hidden relative z-10"><div className="h-full transition-all duration-1000 ease-out" style={{ width: `${progress}%`, backgroundColor: fenixUnlocked ? '#EAB308' : (theme?.brandColor || '#f59e0b') }} /></div></div> : <div className="bg-neutral-900 border genesis-border rounded-3xl p-6 flex items-start gap-4"><Clock className="text-yellow-500 shrink-0" size={24} /><div><h2 className="text-sm font-black uppercase text-white mb-1">{text.waitingTitle}</h2><p className="text-xs text-neutral-400 font-mono">{text.waitingStart} <strong className="text-white">{coachName || text.assigned}</strong> {text.waitingEnd}</p></div></div>}

        <div className="space-y-4 pt-4"><h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">{text.apps}</h3><div className="grid grid-cols-2 gap-4">
          <button type="button" onClick={() => navigate('/client/arquitecto')} disabled={!isActive} className="genesis-surface border genesis-border rounded-[2rem] p-5 text-left transition-all hover:bg-neutral-900 hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed group"><div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ backgroundColor: `${theme?.brandColor || '#f59e0b'}15` }}><Utensils size={20} style={{ color: theme?.brandColor || '#f59e0b' }} /></div><h4 className="font-bold text-sm text-white leading-tight">{text.nutritionName}</h4><p className="text-[10px] text-neutral-500 font-mono mt-1">{text.nutritionHint}</p></button>
          <button type="button" onClick={() => navigate('/client/entrenamiento')} disabled={!isActive} className="genesis-surface border genesis-border rounded-[2rem] p-5 text-left transition-all hover:bg-neutral-900 hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed group"><div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ backgroundColor: `${theme?.brandColor || '#f59e0b'}15` }}><Dumbbell size={20} style={{ color: theme?.brandColor || '#f59e0b' }} /></div><h4 className="font-bold text-sm text-white leading-tight">{text.trainingName}</h4><p className="text-[10px] text-neutral-500 font-mono mt-1">{text.trainingHint}</p></button>
          <button type="button" onClick={() => navigate('/client/disciplina')} disabled={!isActive} className="genesis-surface border genesis-border rounded-[2rem] p-5 text-left transition-all hover:bg-neutral-900 hover:border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed group col-span-2 flex items-center justify-between"><div><div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ backgroundColor: `${theme?.brandColor || '#f59e0b'}15` }}><Activity size={20} style={{ color: theme?.brandColor || '#f59e0b' }} /></div><h4 className="font-bold text-sm text-white leading-tight">{text.disciplineName}</h4><p className="text-[10px] text-neutral-500 font-mono mt-1">{text.disciplineHint}</p></div>{isActive && new Date().getDay() === 0 && <span className="text-[9px] font-black uppercase bg-red-500/20 text-red-500 px-3 py-1 rounded-full border border-red-500/30 animate-pulse">{text.pendingTask}</span>}</button>
          <button type="button" onClick={() => navigate('/client/hormonal')} disabled={!isActive} className="genesis-surface border genesis-border p-6 rounded-3xl relative overflow-hidden group hover:border-pink-500/50 transition-all text-left w-full flex flex-col col-span-2 disabled:opacity-50 disabled:cursor-not-allowed"><div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-pink-500/20 transition-all" /><div className="flex items-center gap-3 mb-3 relative z-10"><div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center border border-pink-500/30 shrink-0"><Droplets size={20} className="text-pink-500" /></div><h2 className="text-xl font-black uppercase tracking-tight text-white">{text.hormonalName}</h2></div><p className="text-[11px] text-neutral-400 font-mono leading-relaxed relative z-10">{text.hormonalHint} <span className="text-pink-400 font-bold">{text.hormonalElite}</span></p></button>
          <button type="button" onClick={() => navigate('/chat')} className="genesis-surface border genesis-border rounded-[2rem] p-5 text-left transition-all hover:bg-neutral-900 hover:border-neutral-700 group col-span-2 flex items-center gap-4"><div className="w-10 h-10 rounded-2xl flex shrink-0 items-center justify-center transition-transform group-hover:scale-110" style={{ backgroundColor: `${theme?.brandColor || '#f59e0b'}15` }}><MessageSquare size={20} style={{ color: theme?.brandColor || '#f59e0b' }} /></div><div><h4 className="font-bold text-sm text-white leading-tight">{text.chatName}</h4><p className="text-[10px] text-neutral-500 font-mono mt-1">{text.chatHint}</p></div></button>
        </div></div>
      </main>
    </div>
  );
}
