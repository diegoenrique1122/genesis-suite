import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Users, Activity, Loader2, ArrowRight, ShieldCheck, 
  Settings, UserPlus, LogOut, MessageSquare, Globe, Copy, Check, X, Lock,
  Dumbbell, Utensils, Droplets, LayoutDashboard
} from 'lucide-react';
import LocaleToggle from '../components/LocaleToggle';
import { useLocale } from '../contexts/LocaleContext';

const formatRosterActivityDate = (dateKey, emptyLabel = 'Sin registro') => {
  if (!dateKey || typeof dateKey !== 'string') return emptyLabel;

  const [year, month, day] = dateKey.split('-');

  if (!year || !month || !day) return dateKey;

  return `${month}/${day}/${year}`;
};

export default function CoachDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { locale } = useLocale();
  const copy = (es, en) => (locale === 'en' ? en : es);
  
  const [loading, setLoading] = useState(true);
  const [coachProfile, setCoachProfile] = useState(null);
  const [roster, setRoster] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0 });

  // 🚀 NUEVA ARQUITECTURA DE PESTAÑAS
  const [activeTab, setActiveTab] = useState('ROSTER'); // 'ROSTER' | 'MY_APPS'

  const [showAcquisitionModal, setShowAcquisitionModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const { data: coachData } = await supabase.from('coaches_profile').select('*').eq('user_id', session.user.id).single();
      setCoachProfile(coachData);

      const [
        { data: athletesData, error: athletesError },
        { data: activityData, error: activityError },
      ] = await Promise.all([
        supabase
          .from('athletes_profile')
          .select('id, user_id, full_name, b2c_plan, routine_status, program_start_date')
          .eq('coach_id', coachData.id)
          .order('created_at', { ascending: false }),

        supabase.rpc('get_coach_roster_activity'),
      ]);

      if (athletesError) throw athletesError;
      if (activityError) throw activityError;

      const activityByAthleteId = new Map(
        (activityData || []).map((row) => [
          row.athlete_id,
          row,
        ])
      );

      // Identidad canónica: nunca excluir clientes comparando nombres.
      const realClients = (athletesData || [])
        .filter((athlete) => athlete.user_id !== session.user.id)
        .map((athlete) => ({
          ...athlete,
          activity: activityByAthleteId.get(athlete.id) || null,
        }));

      setRoster(realClients);

      setStats({
        total: realClients.length,
        pending: realClients.filter(
          (athlete) => athlete.routine_status === 'PENDING_AUDIT'
        ).length,
        active: realClients.filter(
          (athlete) => athlete.program_start_date !== null
        ).length,
      });
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  };

  const handleCopy = (code) => {
    if (!code || code === 'N/A') return;
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  const brand = theme?.brandColor || '#3b82f6';
  const isElite = coachProfile?.b2b_plan === 'ELITE';
  const isEvolucion = coachProfile?.b2b_plan === 'EVOLUCION';
  const canSellEvo = isEvolucion || isElite;
  const canSellElite = isElite;

  const codeIGN = coachProfile?.invite_code_ignicion || (coachProfile?.coach_code ? `IGN-${coachProfile.coach_code}` : copy('Pendiente Súper Admin', 'Pending Super Admin'));
  const codeEVO = coachProfile?.invite_code_evolucion || (coachProfile?.coach_code ? `EVO-${coachProfile.coach_code}` : copy('Pendiente Súper Admin', 'Pending Super Admin'));
  const codePRO = coachProfile?.invite_code_elite || (coachProfile?.coach_code ? `PRO-${coachProfile.coach_code}` : copy('Pendiente Súper Admin', 'Pending Super Admin'));

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-20 selection:bg-neutral-800 relative" style={{ backgroundColor: theme?.bgColor || "#0a0a0a", color: theme?.textColor || "#ffffff" }}>
      <div className="absolute top-0 left-0 w-full h-96 opacity-10 pointer-events-none" style={{ background: `linear-gradient(180deg, ${brand} 0%, transparent 100%)` }}></div>

      <nav className="border-b genesis-border bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} style={{ color: brand }} />
            <span className="text-sm font-black uppercase tracking-widest text-white">{copy('Centro de Control', 'Command Center')}</span>
            <span className="text-[9px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono ml-2">{coachProfile?.b2b_plan}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* PESTAÑAS DE NAVEGACIÓN COACH */}
            <button onClick={() => setActiveTab('ROSTER')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'ROSTER' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}>
              {copy("Mi Tribu", "My Roster")}
            </button>
            <button onClick={() => setActiveTab('MY_APPS')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'MY_APPS' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-neutral-500 hover:text-amber-500 border border-transparent hover:border-amber-500/30'}`}>
              <Dumbbell size={14}/> {copy("Mis Apps", "My Apps")}
            </button>

            <div className="w-px h-6 bg-neutral-800 mx-2"></div>
            <button onClick={() => navigate('/coach/settings')} className="text-neutral-500 hover:text-white transition-colors flex items-center gap-2 text-[10px] uppercase font-bold tracking-widest"><Settings size={16} /> {copy("Ajustes", "Settings")}</button>
            <LocaleToggle compact className="hidden sm:inline-flex" />
            <button onClick={handleLogout} className="text-neutral-500 hover:text-red-500 transition-colors"><LogOut size={16} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 relative z-10">
        
        {/* ========================================================= */}
        {/* PESTAÑA 1: MI TRIBU (COMMAND CENTER ORIGINAL) */}
        {/* ========================================================= */}
        {activeTab === 'ROSTER' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="genesis-surface border genesis-border rounded-3xl p-6 md:col-span-2 flex flex-col justify-center">
                <h1 className="text-2xl font-black uppercase tracking-tight mb-1">{copy('Hola,', 'Hello,')} {coachProfile?.full_name?.split(' ')[0] || 'Coach'}</h1>
                <p className="text-xs text-neutral-400 font-mono">{copy('Tienes', 'You have')} {stats.pending} {copy('atletas requiriendo auditoría clínica hoy.', 'athletes requiring clinical review today.')}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="genesis-bg border genesis-border rounded-3xl p-5 text-center flex flex-col justify-center">
                  <span className="text-3xl font-black font-mono text-white">{stats.active}</span>
                  <span className="text-[9px] uppercase font-black tracking-widest text-neutral-500 mt-1">{copy("Activos", "Active")}</span>
                </div>
                <div className="genesis-bg border genesis-border rounded-3xl p-5 text-center flex flex-col justify-center">
                  <span className="text-3xl font-black font-mono text-amber-500">{stats.pending}</span>
                  <span className="text-[9px] uppercase font-black tracking-widest text-amber-500/70 mt-1">{copy("Pendientes", "Pending")}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => navigate('/chat')} className="genesis-surface border genesis-border hover:border-neutral-600 rounded-3xl p-5 flex items-center justify-between group transition-all shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center genesis-bg border genesis-border group-hover:scale-110 transition-transform">{isElite ? <Globe size={20} style={{ color: brand }} /> : <MessageSquare size={20} style={{ color: brand }} />}</div>
                  <div className="text-left">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">{copy("Red de Comunicaciones", "Communications")}</h2>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{isElite ? copy('Muro Global, Sala Coaches y Chat 1-a-1', 'Global Wall, Coaches Room, and 1:1 Chat') : copy('Chat Directo 1-a-1 con Atletas', 'Direct 1:1 Chat with Athletes')}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-neutral-600 group-hover:text-white transition-colors" />
              </button>

              <button onClick={() => setShowAcquisitionModal(true)} className="genesis-surface border genesis-border hover:border-neutral-600 rounded-3xl p-5 flex items-center justify-between group transition-all shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center genesis-bg border genesis-border group-hover:scale-110 transition-transform"><UserPlus size={20} className="text-neutral-400" /></div>
                  <div className="text-left">
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">{copy("Adquisición de Clientes", "Client Acquisition")}</h2>
                    <p className="text-[10px] text-neutral-500 font-mono mt-0.5">{copy("Gestiona tus códigos de invitación B2C", "Manage your B2C invitation codes")}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-neutral-600 group-hover:text-white transition-colors" />
              </button>
            </div>

            <div className="genesis-surface border genesis-border rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between border-b genesis-border pb-4 mb-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-neutral-400 flex items-center gap-2"><Activity size={16} style={{ color: brand }} /> {copy("Radar Global de Atletas", "Global Athlete Radar")}</h2>
              </div>
              {roster.length === 0 ? (
                <div className="text-center py-12"><Users size={40} className="text-neutral-700 mx-auto mb-3" /><p className="text-xs font-mono text-neutral-500">{copy("Aún no tienes atletas asignados.", "You have no athletes assigned yet.")}</p></div>
              ) : (
                <div className="space-y-3">
                  {roster.map((athlete) => (
                    <button
                      key={athlete.id}
                      onClick={() => navigate(`/coach/client/${athlete.id}`)}
                      className="w-full genesis-bg border genesis-border hover:border-neutral-600 rounded-2xl p-4 transition-all group text-left"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">

                        {/* IDENTIDAD */}
                        <div className="flex items-center gap-4 lg:w-56 shrink-0">
                          <div className="w-10 h-10 rounded-xl bg-neutral-900 border genesis-border flex items-center justify-center font-black uppercase text-sm group-hover:bg-white group-hover:text-black transition-colors">
                            {athlete.full_name?.substring(0, 2)}
                          </div>

                          <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-white">
                              {athlete.full_name}
                            </h3>

                            <p className="text-[10px] font-mono text-neutral-500">
                              {copy('Plan:', 'Plan:')} {athlete.b2c_plan}
                            </p>
                          </div>
                        </div>

                        {/* ACTIVIDAD CANÓNICA */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 w-full">

                          <div className="bg-neutral-950 border genesis-border rounded-xl px-3 py-2">
                            <p className="text-[8px] font-black uppercase tracking-widest text-amber-500 mb-1">
                              {copy("Auto-reporte manual", "Manual self-report")}
                            </p>

                            <p className="text-[10px] font-mono text-white">
                              {copy('Último:', 'Last:')} {formatRosterActivityDate(
                                 athlete.activity?.last_manual_date,
                                 copy('Sin registro', 'No record')
                               )}
                            </p>

                            <p className="text-[9px] font-mono text-neutral-500 mt-1">
                              {copy('Compliance:', 'Compliance:')} {
                                athlete.activity?.manual_compliance_score === null ||
                                athlete.activity?.manual_compliance_score === undefined
                                  ? copy('No evaluado', 'Not evaluated')
                                  : `${athlete.activity.manual_compliance_score}%`
                              }
                            </p>
                          </div>

                          <div className="bg-neutral-950 border border-blue-900/30 rounded-xl px-3 py-2">
                            <p className="text-[8px] font-black uppercase tracking-widest text-blue-400 mb-1">
                              Wearable
                            </p>

                            <p className="text-[10px] font-mono text-white">
                              {copy('Último:', 'Last:')} {formatRosterActivityDate(
                                 athlete.activity?.last_wearable_date,
                                 copy('Sin registro', 'No record')
                               )}
                            </p>

                            <p className="text-[9px] font-mono text-neutral-500 mt-1">
                              {athlete.activity?.last_wearable_date
                                ? copy('Telemetría registrada', 'Telemetry recorded')
                                : copy('Sin telemetría', 'No telemetry')}
                            </p>
                          </div>

                        </div>

                        {/* ESTADO OPERACIONAL */}
                        <div className="flex items-center gap-3 lg:w-44 lg:justify-end shrink-0">

                          {!athlete.program_start_date ? (
                            <span className="text-[9px] bg-neutral-800 text-neutral-400 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                              {copy("En Sala de Espera", "Waiting Room")}
                            </span>

                          ) : athlete.routine_status === 'PENDING_AUDIT' ? (
                            <span className="text-[9px] bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-3 py-1 rounded-full font-bold uppercase tracking-widest animate-pulse">
                              {copy("Requiere Auditoría", "Requires Review")}
                            </span>

                          ) : (
                            <span className="text-[9px] bg-green-500/10 border border-green-500/30 text-green-500 px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                              {copy("Activo / Auditado", "Active / Reviewed")}
                            </span>
                          )}

                          <ArrowRight
                            size={16}
                            className="text-neutral-600 group-hover:text-white"
                          />
                        </div>

                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PESTAÑA 2: MIS APPS (USO PERSONAL DEL COACH) */}
        {/* ========================================================= */}
        {activeTab === 'MY_APPS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="genesis-surface border border-amber-500/30 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.1)]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2 flex items-center gap-2">
                <Dumbbell className="text-amber-500" /> Mi Ecosistema Personal
              </h2>
              <p className="text-xs text-neutral-400 font-mono mb-8 max-w-2xl">
                {copy('Como Entrenador Élite, tienes acceso total e inmersivo a todas las aplicaciones B2C de Genesis OS para llevar tu propio progreso al más alto nivel.', 'As an Elite Coach, you have full immersive access to all Genesis OS B2C applications to take your own progress to the next level.')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => navigate('/client/arquitecto')} className="genesis-bg border genesis-border hover:border-amber-500/50 rounded-2xl p-6 text-left group transition-all">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border genesis-border flex items-center justify-center mb-4 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors"><Utensils size={24}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">{copy("El Arquitecto", "The Architect")}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-2">{copy("Laboratorio de macros, dieta y suplementación personal.", "Personal macros, nutrition, and supplement lab.")}</p>
                </button>
                <button onClick={() => navigate('/client/entrenamiento')} className="genesis-bg border genesis-border hover:border-amber-500/50 rounded-2xl p-6 text-left group transition-all">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border genesis-border flex items-center justify-center mb-4 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors"><Dumbbell size={24}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Trainer Pro</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-2">{copy("Tu rutina biomecánica adaptativa y registros de peso.", "Adaptive biomechanics routine and weight logs.")}</p>
                </button>
                <button onClick={() => navigate('/client/disciplina')} className="genesis-bg border genesis-border hover:border-amber-500/50 rounded-2xl p-6 text-left group transition-all">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border genesis-border flex items-center justify-center mb-4 group-hover:bg-amber-500/10 group-hover:text-amber-500 transition-colors"><Activity size={24}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">{copy("Monitoreo de Disciplina", "Discipline Monitoring")}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-2">{copy("Subida de check-ins diarios, fotos y métricas de sueño.", "Daily check-ins, photos, and sleep metrics.")}</p>
                </button>
                <button onClick={() => navigate('/client/hormonal')} className="genesis-bg border genesis-border hover:border-pink-500/50 rounded-2xl p-6 text-left group transition-all">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border genesis-border flex items-center justify-center mb-4 group-hover:bg-pink-500/10 group-hover:text-pink-500 transition-colors"><Droplets size={24}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">{copy("Sync Hormonal (Opcional)", "Hormonal Sync (Optional)")}</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-2">{copy("Acceso a la modulación de ciclo (Solo atletas femeninas).", "Cycle modulation access (female athletes only).")}</p>
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* MODAL CÓDIGOS (Se mantiene intacto) */}
      {showAcquisitionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 genesis-bg/80 backdrop-blur-sm animate-in fade-in">
          <div className="genesis-surface border genesis-border rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setShowAcquisitionModal(false)} className="absolute top-5 right-5 text-neutral-500 hover:text-white transition-colors"><X size={20} /></button>
            <h2 className="text-lg font-black uppercase text-white mb-1 flex items-center gap-2"><UserPlus className="text-amber-500" size={20} /> {copy("Adquisición B2C", "B2C Acquisition")}</h2>
            <p className="text-[11px] text-neutral-400 font-mono mb-6 leading-relaxed">{copy("Comparte estos códigos únicos con tus clientes. Al ingresarlos en su registro, se vincularán a tu Roster.", "Share these unique codes with your clients. When entered during registration, they will be linked to your roster.")}</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between genesis-bg border genesis-border p-4 rounded-2xl group hover:border-neutral-600 transition-colors">
                <div><p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mb-1">{copy("Plan Ignición (Básico)", "Ignition Plan (Basic)")}</p><p className="font-mono text-white font-bold text-sm">{codeIGN}</p></div>
                <button onClick={() => handleCopy(codeIGN)} disabled={codeIGN.includes('Pendiente')} className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-neutral-400 hover:text-white transition-colors disabled:opacity-50">{copiedCode === codeIGN ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}</button>
              </div>
              <div className="flex items-center justify-between genesis-bg border genesis-border p-4 rounded-2xl group hover:border-blue-500/50 transition-colors relative overflow-hidden">
                {!canSellEvo && <div className="absolute inset-0 genesis-bg/70 backdrop-blur-[1px] flex items-center justify-center z-10"><Lock size={16} className="text-neutral-500 mr-2"/><span className="text-[9px] uppercase font-black text-neutral-500">{copy("Plan No Autorizado", "Plan Not Authorized")}</span></div>}
                <div><p className="text-[9px] font-black uppercase tracking-widest text-blue-500 mb-1">{copy("Plan Evolución (Pro)", "Evolution Plan (Pro)")}</p><p className="font-mono text-white font-bold text-sm">{codeEVO}</p></div>
                <button onClick={() => handleCopy(codeEVO)} disabled={codeEVO.includes('Pendiente')} className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-neutral-400 hover:text-blue-500 transition-colors disabled:opacity-50">{copiedCode === codeEVO ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}</button>
              </div>
              <div className="flex items-center justify-between genesis-bg border genesis-border p-4 rounded-2xl group hover:border-amber-500/50 transition-colors relative overflow-hidden">
                {!canSellElite && <div className="absolute inset-0 genesis-bg/70 backdrop-blur-[1px] flex items-center justify-center z-10"><Lock size={16} className="text-neutral-500 mr-2"/><span className="text-[9px] uppercase font-black text-neutral-500">{copy("Plan No Autorizado", "Plan Not Authorized")}</span></div>}
                <div><p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1 flex items-center gap-1"><ShieldCheck size={10}/> {copy("Plan Élite 360°", "Elite 360° Plan")}</p><p className="font-mono text-amber-400 font-bold text-sm">{codePRO}</p></div>
                <button onClick={() => handleCopy(codePRO)} disabled={codePRO.includes('Pendiente')} className="w-10 h-10 bg-neutral-900 rounded-xl flex items-center justify-center text-neutral-400 hover:text-amber-500 transition-colors disabled:opacity-50">{copiedCode === codePRO ? <Check size={16} className="text-green-500"/> : <Copy size={16}/>}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}