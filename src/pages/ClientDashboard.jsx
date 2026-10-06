import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Award,
  Clock,
  Dumbbell,
  Flame,
  LogOut,
  MessageSquare,
  Settings,
  Utensils,
} from 'lucide-react';

import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import { evaluateBadges } from '../services/badgeService';
import AthletePreferences from '../components/AthletePreferences';
import NotificationCenter from '../components/NotificationCenter';
import GenesisAppShell from '../components/layout/GenesisAppShell';
import {
  GenesisProgressRing,
  GenesisSectionHeading,
  GenesisSurface,
} from '../components/ui/GenesisUi';

const COPY = {
  es: {
    team: 'Equipo',
    coach: 'Coach',
    preferences: 'Preferencias',
    signOut: 'Cerrar sesión',
    greeting: 'Hola',
    athlete: 'Atleta',
    activePlan: 'Plan activo',
    pending: 'Pendiente',
    medalTitle: 'Medalla Fénix desbloqueada',
    medalText: 'Completaste el protocolo de 12 semanas. Este logro queda registrado en tu progreso.',
    expiredTitle: 'Programa vencido',
    expiredText: 'Tu acceso operativo está pausado porque el paquete contratado terminó.',
    expiredOn: 'Venció el',
    cycleCompleted: 'Ciclo completado',
    progress: 'Progreso del programa',
    week: 'Semana',
    waitingTitle: 'Programa pendiente de activación',
    waitingStart: 'Estamos esperando que',
    assigned: 'tu coach asignado',
    waitingEnd: 'revise tu información y active la fecha de inicio.',
    apps: 'Tu espacio de trabajo',
    appsDescription: 'Accede a las herramientas activas de tu programa.',
    nutritionName: 'El Arquitecto',
    nutritionHint: 'Plan nutricional y seguimiento',
    trainingName: 'TrainerPro',
    trainingHint: 'Rutina, ejecución y progreso',
    disciplineName: 'Disciplina',
    disciplineHint: 'Check-in, hábitos y evidencia',
    pendingTask: 'Pendiente',
    chatName: 'Mensajes',
    chatHint: 'Comunicación directa con tu coach',
    accessProgram: 'Disponible con programa activo',
    open: 'Abrir',
  },
  en: {
    team: 'Team',
    coach: 'Coach',
    preferences: 'Preferences',
    signOut: 'Sign out',
    greeting: 'Hello',
    athlete: 'Athlete',
    activePlan: 'Active plan',
    pending: 'Pending',
    medalTitle: 'Phoenix medal unlocked',
    medalText: 'You completed the 12-week protocol. This achievement is now part of your progress.',
    expiredTitle: 'Program expired',
    expiredText: 'Your operational access is paused because the purchased package has ended.',
    expiredOn: 'Expired on',
    cycleCompleted: 'Cycle completed',
    progress: 'Program progress',
    week: 'Week',
    waitingTitle: 'Program pending activation',
    waitingStart: 'We are waiting for',
    assigned: 'your assigned coach',
    waitingEnd: 'to review your information and activate the start date.',
    apps: 'Your workspace',
    appsDescription: 'Access the tools that are active for your program.',
    nutritionName: 'Nutrition Architect',
    nutritionHint: 'Nutrition plan and follow-up',
    trainingName: 'TrainerPro',
    trainingHint: 'Workout, execution and progress',
    disciplineName: 'Discipline',
    disciplineHint: 'Check-in, habits and evidence',
    pendingTask: 'Pending',
    chatName: 'Messages',
    chatHint: 'Direct communication with your coach',
    accessProgram: 'Available with an active program',
    open: 'Open',
  },
};

function ApplicationCard({
  icon: Icon,
  title,
  description,
  onClick,
  enabled,
  accent,
  availabilityLabel,
  openLabel,
  badge = null,
  className = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className={`genesis-surface-panel group w-full p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ '--genesis-accent': accent }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="genesis-metric__icon" aria-hidden="true">
          <Icon size={20} />
        </div>
        {badge ? badge : null}
      </div>

      <h3 className="mt-5 text-base font-bold tracking-tight text-white">
        {title}
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-neutral-400">
        {description}
      </p>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/5 pt-4 text-[11px] font-bold uppercase tracking-[0.12em]">
        <span className={enabled ? 'text-neutral-300' : 'text-neutral-500'}>
          {enabled ? openLabel : availabilityLabel}
        </span>
        <span
          className="text-base leading-none"
          aria-hidden="true"
          style={{ color: accent }}
        >
          →
        </span>
      </div>
    </button>
  );
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { locale } = useLocale();
  const text = COPY[locale] || COPY.es;
  const accent = theme?.brandColor || '#f59e0b';

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

  const fetchAthleteData = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate('/');
        return;
      }

      const {
        data: athleteData,
        error: athleteError,
      } = await supabase
        .from('athletes_profile')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (athleteError || !athleteData) {
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

      if (coachData) {
        setCoachName(coachData.full_name);
      }

      const badgeResult = await evaluateBadges(athleteData.id);
      setFenixUnlocked(Boolean(badgeResult?.fenixUnlocked));

      const {
        data: programData,
        error: programLoadError,
      } = await supabase
        .from('athlete_programs')
        .select(
          'id, package_tier, service_focus, duration_value, duration_unit, starts_at, ends_at, status'
        )
        .eq('athlete_id', athleteData.id)
        .in('status', ['ACTIVE', 'SCHEDULED', 'PAUSED'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (programLoadError) {
        console.warn('Genesis program load:', programLoadError);
      }

      const now = new Date();
      const programStart = programData?.starts_at
        ? new Date(programData.starts_at)
        : null;
      const programEnd = programData?.ends_at
        ? new Date(programData.ends_at)
        : null;

      setProgramEndsAt(programData?.ends_at || null);

      if (programStart && programEnd) {
        const totalWeeks = Math.max(
          1,
          Math.ceil(
            (programEnd.getTime() - programStart.getTime()) / 604800000
          )
        );

        const active =
          programData.status === 'ACTIVE' &&
          now >= programStart &&
          now < programEnd;

        setProgramTotalWeeks(totalWeeks);
        setProgramExpired(now >= programEnd);
        setIsActive(active);

        if (active) {
          const elapsedDays = Math.max(
            0,
            Math.floor(
              (now.getTime() - programStart.getTime()) / 86400000
            )
          );

          setCurrentWeek(
            Math.min(totalWeeks, Math.floor(elapsedDays / 7) + 1)
          );
        }

        return;
      }

      if (athleteData.program_start_date) {
        const startDate = new Date(athleteData.program_start_date);
        const elapsedDays = Math.max(
          0,
          Math.floor((now.getTime() - startDate.getTime()) / 86400000)
        );

        setIsActive(true);
        setProgramExpired(false);
        setCurrentWeek(Math.max(1, Math.floor(elapsedDays / 7) + 1));
      }
    } catch (error) {
      console.error('Genesis athlete dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        void fetchAthleteData();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [fetchAthleteData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center genesis-bg">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-neutral-800 border-t-current"
          style={{ color: accent }}
          aria-label="Loading"
          role="status"
        />
      </div>
    );
  }

  const progress = fenixUnlocked
    ? 100
    : Math.round((currentWeek / programTotalWeeks) * 100);

  const athleteName =
    (athlete?.full_name || text.athlete).split(' ')[0];

  const coachFirstName =
    (coachName || text.coach).split(' ')[0];

  const actions = (
    <>
      <NotificationCenter
        panelClass="bg-[#111] text-white"
        borderClass="border-neutral-800"
        accentClass="text-amber-500"
      />
      <button
        type="button"
        onClick={() => setPreferencesOpen(true)}
        className="genesis-control grid min-h-11 min-w-11 place-items-center text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
        aria-label={text.preferences}
      >
        <Settings size={18} />
      </button>
      <button
        type="button"
        onClick={handleLogout}
        className="genesis-control grid min-h-11 min-w-11 place-items-center text-neutral-500 transition-colors hover:bg-red-500/10 hover:text-red-300"
        aria-label={text.signOut}
      >
        <LogOut size={18} />
      </button>
    </>
  );

  return (
    <GenesisAppShell
      brandName="Genesis OS"
      contextLabel={`${text.team} ${coachFirstName}`}
      eyebrow={text.activePlan}
      title={`${text.greeting}, ${athleteName}`}
      description={isActive ? text.appsDescription : text.accessProgram}
      badge={athlete?.b2c_plan || text.pending}
      actions={actions}
    >
      {preferencesOpen ? (
        <AthletePreferences onClose={() => setPreferencesOpen(false)} />
      ) : null}

      <div className="mx-auto grid w-full max-w-3xl gap-6">
        {fenixUnlocked ? (
          <GenesisSurface
            className="flex items-start gap-4 border-yellow-500/40 bg-yellow-500/10 p-5"
            style={{ '--genesis-accent': '#eab308' }}
          >
            <div
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-yellow-500/40 bg-yellow-500/10 text-yellow-400"
              aria-hidden="true"
            >
              <Flame size={21} />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.1em] text-yellow-300">
                {text.medalTitle}
                <Award size={15} aria-hidden="true" />
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-yellow-100/70">
                {text.medalText}
              </p>
            </div>
          </GenesisSurface>
        ) : null}

        {programExpired ? (
          <GenesisSurface className="flex items-start gap-4 border-red-500/30 bg-red-950/25 p-6">
            <Clock className="mt-0.5 shrink-0 text-red-300" size={23} />
            <div>
              <h2 className="text-base font-bold text-red-100">
                {text.expiredTitle}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-neutral-300">
                {text.expiredText}
              </p>
              {programEndsAt ? (
                <p className="mt-3 text-xs font-semibold text-red-200">
                  {text.expiredOn}{' '}
                  {new Intl.DateTimeFormat(
                    locale === 'en' ? 'en-US' : 'es-US',
                    { dateStyle: 'medium' }
                  ).format(new Date(programEndsAt))}
                </p>
              ) : null}
            </div>
          </GenesisSurface>
        ) : isActive ? (
          <GenesisSurface
            className="relative overflow-hidden p-6"
            style={{
              '--genesis-accent': fenixUnlocked ? '#eab308' : accent,
            }}
          >
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-neutral-500">
                  {fenixUnlocked ? text.cycleCompleted : text.progress}
                </p>
                <h2 className="mt-2 genesis-kpi-value text-4xl font-black text-white">
                  {text.week} {currentWeek}
                  <span className="ml-1 text-xl text-neutral-500">
                    /{programTotalWeeks}
                  </span>
                </h2>
                <p className="mt-2 text-sm text-neutral-400">
                  {text.appsDescription}
                </p>
              </div>

              <GenesisProgressRing
                value={progress}
                size={86}
                accent={fenixUnlocked ? '#eab308' : accent}
                label={`${text.progress}: ${progress}%`}
              />
            </div>
          </GenesisSurface>
        ) : (
          <GenesisSurface className="flex items-start gap-4 p-6">
            <Clock className="mt-0.5 shrink-0" size={23} style={{ color: accent }} />
            <div>
              <h2 className="text-base font-bold text-white">
                {text.waitingTitle}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                {text.waitingStart}{' '}
                <strong className="font-semibold text-white">
                  {coachName || text.assigned}
                </strong>{' '}
                {text.waitingEnd}
              </p>
            </div>
          </GenesisSurface>
        )}

        <section className="pt-2">
          <GenesisSectionHeading
            title={text.apps}
            description={text.appsDescription}
          />

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ApplicationCard
              icon={Dumbbell}
              title={text.trainingName}
              description={text.trainingHint}
              onClick={() => navigate('/client/entrenamiento')}
              enabled={isActive}
              accent={accent}
              availabilityLabel={text.accessProgram}
              openLabel={text.open}
            />
            <ApplicationCard
              icon={Utensils}
              title={text.nutritionName}
              description={text.nutritionHint}
              onClick={() => navigate('/client/arquitecto')}
              enabled={isActive}
              accent={accent}
              availabilityLabel={text.accessProgram}
              openLabel={text.open}
            />
            <ApplicationCard
              icon={Activity}
              title={text.disciplineName}
              description={text.disciplineHint}
              onClick={() => navigate('/client/disciplina')}
              enabled={isActive}
              accent={accent}
              availabilityLabel={text.accessProgram}
              openLabel={text.open}
              badge={
                isActive && new Date().getDay() === 0 ? (
                  <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-red-300">
                    {text.pendingTask}
                  </span>
                ) : null
              }
            />
            <ApplicationCard
              icon={MessageSquare}
              title={text.chatName}
              description={text.chatHint}
              onClick={() => navigate('/chat')}
              enabled
              accent={accent}
              availabilityLabel={text.open}
              openLabel={text.open}
            />
          </div>
        </section>
      </div>
    </GenesisAppShell>
  );
}
