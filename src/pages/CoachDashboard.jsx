import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Users, Activity, Loader2, ArrowRight, ShieldCheck, 
  Settings, UserPlus, LogOut, MessageSquare, Globe, Copy, Check, X, Lock,
  Dumbbell, Utensils, Droplets
} from 'lucide-react';
import LocaleToggle from '../components/LocaleToggle';
import { useLocale } from '../contexts/LocaleContext';
import NotificationCenter from '../components/NotificationCenter';
import GenesisAppShell from '../components/layout/GenesisAppShell';
import {
  GenesisEmptyState,
  GenesisMetric,
  GenesisSectionHeading,
  GenesisSurface,
} from '../components/ui/GenesisUi';

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
  const [stats, setStats] = useState({ total: 0, pending: 0, active: 0, waiting: 0 });

  // 🚀 NUEVA ARQUITECTURA DE PESTAÑAS
  const [activeTab, setActiveTab] = useState('ROSTER'); // 'ROSTER' | 'MY_APPS'

  const [showAcquisitionModal, setShowAcquisitionModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
const fetchDashboardData = useCallback(async () => {
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
          (athlete) =>
            athlete.program_start_date !== null &&
            athlete.routine_status === 'PENDING_AUDIT'
        ).length,
        active: realClients.filter(
          (athlete) => athlete.program_start_date !== null
        ).length,
        waiting: realClients.filter(
          (athlete) => athlete.program_start_date === null
        ).length,
      });
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
    }, [navigate]);
  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        void fetchDashboardData();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchDashboardData]);

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

  const coachFirstName =
    (coachProfile?.full_name || 'Coach').split(' ')[0];

  const navigation = [
    {
      id: 'ROSTER',
      label: copy('Mi Tribu', 'My Roster'),
      icon: Users,
      active: activeTab === 'ROSTER',
      onSelect: () => setActiveTab('ROSTER'),
    },
    {
      id: 'MY_APPS',
      label: copy('Mis Apps', 'My Apps'),
      icon: Dumbbell,
      active: activeTab === 'MY_APPS',
      onSelect: () => setActiveTab('MY_APPS'),
    },
  ];

  const actions = (
    <>
      <button
        type="button"
        onClick={() => navigate('/coach/settings')}
        className="genesis-control grid min-h-11 min-w-11 place-items-center text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
        aria-label={copy('Ajustes', 'Settings')}
      >
        <Settings size={18} />
      </button>

      <NotificationCenter
        panelClass="bg-[#111] text-white"
        borderClass="border-neutral-800"
        accentClass="text-blue-400"
      />

      <LocaleToggle compact className="hidden sm:inline-flex" />

      <button
        type="button"
        onClick={handleLogout}
        className="genesis-control grid min-h-11 min-w-11 place-items-center text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
        aria-label={copy('Cerrar sesión', 'Sign out')}
      >
        <LogOut size={18} />
      </button>
    </>
  );
  return (
    <GenesisAppShell
      brandName="Genesis OS"
      contextLabel={copy('Centro de Control', 'Command Center')}
      eyebrow={copy('Portal Coach', 'Coach Portal')}
      title={`${copy('Hola', 'Hello')}, ${coachFirstName}`}
      description={copy(
        'Gestiona atletas, auditorías, comunicación y herramientas desde un solo espacio.',
        'Manage athletes, reviews, communication, and tools from one workspace.'
      )}
      badge={coachProfile?.b2b_plan || copy('Sin plan', 'No plan')}
      navigation={navigation}
      actions={actions}
    >
{/* ========================================================= */}
        {/* PESTAÑA 1: MI TRIBU (COMMAND CENTER ORIGINAL) */}
        {/* ========================================================= */}
        {activeTab === 'ROSTER' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="grid gap-4 md:grid-cols-5">
              <GenesisSurface className="p-6 md:col-span-2">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-neutral-500">
                  {copy('Prioridad operativa', 'Operational priority')}
                </p>
                <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                  {stats.pending}{' '}
                  {copy('auditorías pendientes', 'pending reviews')}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {stats.waiting}{' '}
                  {copy(
                    'atletas esperan activación.',
                    'athletes are waiting for activation.'
                  )}
                </p>
              </GenesisSurface>

              <div className="grid grid-cols-3 gap-3 md:col-span-3">
                <GenesisMetric
                  label={copy('Roster', 'Roster')}
                  value={stats.total}
                  icon={Users}
                  accent={brand}
                />

                <GenesisMetric
                  label={copy('Activos', 'Active')}
                  value={stats.active}
                  icon={ShieldCheck}
                  accent={brand}
                />

                <GenesisMetric
                  label={copy('Auditorías', 'Reviews')}
                  value={stats.pending}
                  icon={Activity}
                  accent="#f59e0b"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GenesisSurface
                as="button"
                type="button"
                onClick={() => navigate('/chat')}
                className="group flex w-full items-center justify-between gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-neutral-600"
                style={{ '--genesis-accent': brand }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="genesis-metric__icon"
                    aria-hidden="true"
                  >
                    {isElite ? (
                      <Globe size={20} />
                    ) : (
                      <MessageSquare size={20} />
                    )}
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-white">
                      {copy(
                        'Red de Comunicaciones',
                        'Communications'
                      )}
                    </h2>

                    <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                      {isElite
                        ? copy(
                            'Muro Global, Sala Coaches y Chat 1-a-1',
                            'Global Wall, Coaches Room, and 1:1 Chat'
                          )
                        : copy(
                            'Chat Directo 1-a-1 con Atletas',
                            'Direct 1:1 Chat with Athletes'
                          )}
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={18}
                  className="shrink-0 text-neutral-600 transition-colors group-hover:text-white"
                  aria-hidden="true"
                />
              </GenesisSurface>

              <GenesisSurface
                as="button"
                type="button"
                onClick={() => setShowAcquisitionModal(true)}
                className="group flex w-full items-center justify-between gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-neutral-600"
                style={{ '--genesis-accent': brand }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="genesis-metric__icon"
                    aria-hidden="true"
                  >
                    <UserPlus size={20} />
                  </div>

                  <div>
                    <h2 className="text-sm font-bold text-white">
                      {copy(
                        'Adquisición de Clientes',
                        'Client Acquisition'
                      )}
                    </h2>

                    <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                      {copy(
                        'Gestiona tus códigos de invitación B2C',
                        'Manage your B2C invitation codes'
                      )}
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={18}
                  className="shrink-0 text-neutral-600 transition-colors group-hover:text-white"
                  aria-hidden="true"
                />
              </GenesisSurface>
            </div>
            <GenesisSurface className="p-6">
              <GenesisSectionHeading
                title={copy(
                  'Radar Global de Atletas',
                  'Global Athlete Radar'
                )}
                description={copy(
                  'Supervisa actividad, cumplimiento y estado operativo de tu roster.',
                  'Monitor activity, compliance, and operational status across your roster.'
                )}
              />

              <div className="mt-5">
                {roster.length === 0 ? (
                  <GenesisEmptyState
                    icon={Users}
                    title={copy(
                      'Aún no tienes atletas asignados.',
                      'You have no athletes assigned yet.'
                    )}
                    description={copy(
                      'Cuando un atleta se vincule contigo aparecerá aquí con su actividad y estado.',
                      'When an athlete is linked to you, their activity and status will appear here.'
                    )}
                  />
                ) : (
                  <div className="space-y-3">                  {roster.map((athlete) => (
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
            </GenesisSurface>
          </div>
        )}
        {/* ========================================================= */}
        {/* PESTAÑA 2: MIS APPS (USO PERSONAL DEL COACH) */}
        {/* ========================================================= */}
        {activeTab === 'MY_APPS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <GenesisSurface
              className="relative overflow-hidden p-6 sm:p-8"
              style={{ '--genesis-accent': brand }}
            >
              <div
                className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl"
                aria-hidden="true"
              />

              <div className="relative">
                <GenesisSectionHeading
                  title={copy(
                    'Mi Ecosistema Personal',
                    'My Personal Ecosystem'
                  )}
                  description={copy(
                    'Como Entrenador Élite, tienes acceso total e inmersivo a todas las aplicaciones B2C de Genesis OS para llevar tu propio progreso al más alto nivel.',
                    'As an Elite Coach, you have full immersive access to all Genesis OS B2C applications to take your own progress to the next level.'
                  )}
                />

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <GenesisSurface
                    as="button"
                    type="button"
                    onClick={() => navigate('/client/arquitecto')}
                    className="group flex w-full items-start gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/50"
                    style={{ '--genesis-accent': brand }}
                  >
                    <div
                      className="genesis-metric__icon shrink-0"
                      aria-hidden="true"
                    >
                      <Utensils size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-white">
                        {copy('El Arquitecto', 'The Architect')}
                      </h3>

                      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                        {copy(
                          'Laboratorio de macros, dieta y suplementación personal.',
                          'Personal macros, nutrition, and supplement lab.'
                        )}
                      </p>
                    </div>

                    <ArrowRight
                      size={17}
                      className="mt-1 shrink-0 text-neutral-600 transition-colors group-hover:text-white"
                      aria-hidden="true"
                    />
                  </GenesisSurface>

                  <GenesisSurface
                    as="button"
                    type="button"
                    onClick={() => navigate('/client/entrenamiento')}
                    className="group flex w-full items-start gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/50"
                    style={{ '--genesis-accent': brand }}
                  >
                    <div
                      className="genesis-metric__icon shrink-0"
                      aria-hidden="true"
                    >
                      <Dumbbell size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-white">
                        Trainer Pro
                      </h3>

                      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                        {copy(
                          'Tu rutina biomecánica adaptativa y registros de peso.',
                          'Adaptive biomechanics routine and weight logs.'
                        )}
                      </p>
                    </div>

                    <ArrowRight
                      size={17}
                      className="mt-1 shrink-0 text-neutral-600 transition-colors group-hover:text-white"
                      aria-hidden="true"
                    />
                  </GenesisSurface>

                  <GenesisSurface
                    as="button"
                    type="button"
                    onClick={() => navigate('/client/disciplina')}
                    className="group flex w-full items-start gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/50"
                    style={{ '--genesis-accent': brand }}
                  >
                    <div
                      className="genesis-metric__icon shrink-0"
                      aria-hidden="true"
                    >
                      <Activity size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-white">
                        {copy(
                          'Monitoreo de Disciplina',
                          'Discipline Monitoring'
                        )}
                      </h3>

                      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                        {copy(
                          'Subida de check-ins diarios, fotos y métricas de sueño.',
                          'Daily check-ins, photos, and sleep metrics.'
                        )}
                      </p>
                    </div>

                    <ArrowRight
                      size={17}
                      className="mt-1 shrink-0 text-neutral-600 transition-colors group-hover:text-white"
                      aria-hidden="true"
                    />
                  </GenesisSurface>

                  <GenesisSurface
                    as="button"
                    type="button"
                    onClick={() => navigate('/client/hormonal')}
                    className="group flex w-full items-start gap-4 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-pink-500/50"
                    style={{ '--genesis-accent': brand }}
                  >
                    <div
                      className="genesis-metric__icon shrink-0"
                      aria-hidden="true"
                    >
                      <Droplets size={20} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-bold text-white">
                        {copy(
                          'Sync Hormonal (Opcional)',
                          'Hormonal Sync (Optional)'
                        )}
                      </h3>

                      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
                        {copy(
                          'Acceso a la modulación de ciclo (Solo atletas femeninas).',
                          'Cycle modulation access (female athletes only).'
                        )}
                      </p>
                    </div>

                    <ArrowRight
                      size={17}
                      className="mt-1 shrink-0 text-neutral-600 transition-colors group-hover:text-white"
                      aria-hidden="true"
                    />
                  </GenesisSurface>
                </div>
              </div>
            </GenesisSurface>
          </div>
        )}
      {/* MODAL CÓDIGOS (Se mantiene intacto) */}
      {showAcquisitionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md animate-in fade-in"
          role="presentation"
        >
          <GenesisSurface
            className="relative w-full max-w-md overflow-hidden p-6 shadow-2xl"
            style={{ '--genesis-accent': brand }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coach-acquisition-title"
          >
            <button
              type="button"
              onClick={() => setShowAcquisitionModal(false)}
              className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-xl border genesis-border bg-neutral-950/80 text-neutral-500 transition-colors hover:text-white"
              aria-label={copy(
                'Cerrar adquisición de clientes',
                'Close client acquisition'
              )}
            >
              <X size={18} />
            </button>

            <div
              className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative">
              <div className="mb-6 pr-12">
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="genesis-metric__icon"
                    aria-hidden="true"
                  >
                    <UserPlus size={20} />
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">
                      Genesis B2C
                    </p>

                    <h2
                      id="coach-acquisition-title"
                      className="mt-1 text-lg font-bold text-white"
                    >
                      {copy(
                        'Adquisición B2C',
                        'B2C Acquisition'
                      )}
                    </h2>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-neutral-400">
                  {copy(
                    'Comparte estos códigos únicos contus clientes. Al ingresarlos en su registro, se vincularán a tu Roster.',
                    'Share these unique codes with your clients. When entered during registration, they will be linked to your roster.'
                  )}
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4 rounded-2xl border genesis-border bg-neutral-950/70 p-4 transition-colors hover:border-neutral-600">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                      {copy(
                        'Plan Ignición (Básico)',
                        'Ignition Plan (Basic)'
                      )}
                    </p>

                    <p className="mt-1 truncate font-mono text-sm font-bold text-white">
                      {codeIGN}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(codeIGN)}
                    disabled={codeIGN.includes('Pendiente')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border genesis-border bg-neutral-900 text-neutral-400 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={copy(
                      'Copiar código Ignición',
                      'Copy Ignition code'
                    )}
                  >
                    {copiedCode === codeIGN ? (
                      <Check
                        size={16}
                        className="text-green-500"
                      />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>

                <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border genesis-border bg-neutral-950/70 p-4 transition-colors hover:border-blue-500/50">
                  {!canSellEvo && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/80 backdrop-blur-[1px]">
                      <Lock
                        size={16}
                        className="mr-2 text-neutral-500"
                      />

                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                        {copy(
                          'Plan No Autorizado',
                          'Plan Not Authorized'
                        )}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-blue-500">
                      {copy(
                        'Plan Evolución (Pro)',
                        'Evolution Plan (Pro)'
                      )}
                    </p>

                    <p className="mt-1 truncate font-mono text-sm font-bold text-white">
                      {codeEVO}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(codeEVO)}
                    disabled={codeEVO.includes('Pendiente')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border genesis-border bg-neutral-900 text-neutral-400 transition-colors hover:text-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={copy(
                      'Copiar código Evolución',
                      'Copy Evolution code'
                    )}
                  >
                    {copiedCode === codeEVO ? (
                      <Check
                        size={16}
                        className="text-green-500"
                      />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>

                <div className="relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border genesis-border bg-neutral-950/70 p-4 transition-colors hover:border-amber-500/50">
                  {!canSellElite && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/80 backdrop-blur-[1px]">
                      <Lock
                        size={16}
                        className="mr-2 text-neutral-500"
                      />

                      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">
                        {copy(
                          'Plan No Autorizado',
                          'Plan Not Authorized'
                        )}
                      </span>
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-amber-500">
                      <ShieldCheck size={10} />

                      {copy(
                        'Plan Élite 360°',
                        'Elite 360° Plan'
                      )}
                    </p>

                    <p className="mt-1 truncate font-mono text-sm font-bold text-amber-400">
                      {codePRO}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(codePRO)}
                    disabled={codePRO.includes('Pendiente')}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border genesis-border bg-neutral-900 text-neutral-400 transition-colors hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={copy(
                      'Copiar código Élite',
                      'Copy Elite code'
                    )}
                  >
                    {copiedCode === codePRO ? (
                      <Check
                        size={16}
                        className="text-green-500"
                      />
                    ) : (
                      <Copy size={16} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </GenesisSurface>
        </div>
      )}
    </GenesisAppShell>
  );
}