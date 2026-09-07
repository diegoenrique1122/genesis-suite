import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { invokeAthleteBoundary } from '../services/athleteBoundaryService';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Loader2,
  LogOut,
  Scale,
  ShieldCheck,
} from 'lucide-react';

const DRAFT_SAVE_DELAY_MS = 800;

const asDraftInteger = (value) => {
  if (value === '' || value === null || value === undefined) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const asDraftNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function PhotoSlot({ label, path, uploading, onSelect }) {
  return (
    <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center">
      <span className="text-[9px] font-black uppercase text-neutral-400 mb-2">
        {label}
      </span>

      <label
        className={
          'w-full aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ' +
          (path
            ? 'border-green-500 bg-green-500/10'
            : 'border-neutral-700 bg-neutral-900 hover:border-amber-500')
        }
      >
        {uploading ? (
          <Loader2 size={20} className="text-amber-500 animate-spin" />
        ) : path ? (
          <CheckCircle2 size={24} className="text-green-500" />
        ) : (
          <Camera size={20} className="text-neutral-500" />
        )}

        <span className="text-[8px] font-mono text-neutral-400 mt-1">
          {uploading ? 'Guardando...' : path ? 'Cargada' : 'Seleccionar'}
        </span>

        <input
          type="file"
          accept="image/*"
          onChange={onSelect}
          disabled={uploading}
          className="hidden"
        />
      </label>
    </div>
  );
}

export default function ClientOnboarding() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [athleteProfileId, setAthleteProfileId] = useState(null);
  const [draftReady, setDraftReady] = useState(false);
  const [draftStatus, setDraftStatus] = useState(
    'Restaurando tu progreso seguro...'
  );
  const [uploadingView, setUploadingView] = useState(null);
  const [completed, setCompleted] = useState(false);

  const [step, setStep] = useState(1);
  const [coachCode, setCoachCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('Masculino');
  const [goal, setGoal] = useState('Pérdida de Grasa');
  const [injuries, setInjuries] = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [frontPath, setFrontPath] = useState(null);
  const [sidePath, setSidePath] = useState(null);
  const [backPath, setBackPath] = useState(null);

  const buildDraft = useCallback(
    (overrides = {}) => ({
      step: overrides.step ?? step,
      coachCode: (overrides.coachCode ?? coachCode).trim().toUpperCase() || null,
      fullName: (overrides.fullName ?? fullName).trim() || null,
      age: asDraftInteger(overrides.age ?? age),
      weight: asDraftNumber(overrides.weight ?? weight),
      height: asDraftNumber(overrides.height ?? height),
      gender: overrides.gender ?? gender ?? null,
      goal: overrides.goal ?? goal ?? null,
      injuries: (overrides.injuries ?? injuries).trim() || null,
      legalAccepted: (overrides.legalAccepted ?? legalAccepted) === true,
      frontPath: overrides.frontPath ?? frontPath ?? null,
      sidePath: overrides.sidePath ?? sidePath ?? null,
      backPath: overrides.backPath ?? backPath ?? null,
    }),
    [
      step,
      coachCode,
      fullName,
      age,
      weight,
      height,
      gender,
      goal,
      injuries,
      legalAccepted,
      frontPath,
      sidePath,
      backPath,
    ]
  );

  useEffect(() => {
    let active = true;

    const restoreDraft = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        navigate('/');
        return;
      }

      try {
        const {
          data: athleteProfile,
          error: athleteError,
        } = await supabase
          .from('athletes_profile')
          .select('id')
          .eq('user_id', session.user.id)
          .single();

        if (athleteError || !athleteProfile?.id) {
          throw new Error('No se encontró tu perfil base en Genesis.');
        }

        if (!active) return;

        setCurrentUser(session.user);
        setAthleteProfileId(athleteProfile.id);

        const draftResponse = await invokeAthleteBoundary(
          'GET_ONBOARDING_DRAFT'
        );

        if (!active) return;

        const draft = draftResponse.draft;

        if (draft) {
          setStep(draft.step);
          setCoachCode(draft.coachCode || '');
          setFullName(draft.fullName || '');
          setAge(draft.age?.toString() || '');
          setWeight(draft.weight?.toString() || '');
          setHeight(draft.height?.toString() || '');
          setGender(draft.gender || 'Masculino');
          setGoal(draft.goal || 'Pérdida de Grasa');
          setInjuries(draft.injuries || '');
          setLegalAccepted(draft.legalAccepted === true);
          setFrontPath(draft.frontPath || null);
          setSidePath(draft.sidePath || null);
          setBackPath(draft.backPath || null);
          setDraftStatus('Tu progreso guardado fue restaurado.');
        } else {
          setDraftStatus('Tu progreso se guardará automáticamente.');
        }
      } catch (err) {
        console.error('Genesis onboarding draft restore:', err);

        if (active) {
          setDraftStatus(
            'No se pudo restaurar el borrador. Revisa tu conexión antes de continuar.'
          );
        }
      } finally {
        if (active) setDraftReady(true);
      }
    };

    void restoreDraft();

    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    if (
      !draftReady ||
      !currentUser?.id ||
      !athleteProfileId ||
      loading ||
      uploadingView ||
      completed
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setDraftStatus('Guardando progreso...');
          await invokeAthleteBoundary('SAVE_ONBOARDING_DRAFT', {
            draft: buildDraft(),
          });
          setDraftStatus('Progreso guardado.');
        } catch (err) {
          console.error('Genesis onboarding draft save:', err);
          setDraftStatus(
            'No se pudo guardar este cambio. Revisa tu conexión antes de salir.'
          );
        }
      })();
    }, DRAFT_SAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    draftReady,
    currentUser,
    athleteProfileId,
    loading,
    uploadingView,
    completed,
    buildDraft,
  ]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const uploadPhotoToStorage = async (file, viewName) => {
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (!fileExt || !athleteProfileId) {
      throw new Error('No fue posible preparar la fotografía para guardarla.');
    }

    const filePath =
      athleteProfileId +
      '/week_0/' +
      viewName +
      '/' +
      Date.now() +
      '_' +
      crypto.randomUUID() +
      '.' +
      fileExt;

    const { error } = await supabase.storage
      .from('athlete_evidence')
      .upload(filePath, file, { upsert: false });

    if (error) throw error;

    return filePath;
  };

  const saveDraft = async (overrides = {}) =>
    invokeAthleteBoundary('SAVE_ONBOARDING_DRAFT', {
      draft: buildDraft(overrides),
    });

  const handleInvitationStep = async (event) => {
    event.preventDefault();

    const code = coachCode.trim().toUpperCase();

    if (!code) {
      alert('Debes ingresar el código de invitación proporcionado por tu Coach.');
      return;
    }

    setLoading(true);

    try {
      await invokeAthleteBoundary('RESOLVE_COACH_INVITE', { code });
      setCoachCode(code);
      setStep(2);
    } catch (err) {
      console.error('Genesis coach invite resolution:', err);
      alert('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelection = async (event, viewName) => {
    const file = event.target.files?.[0] || null;

    event.target.value = '';

    if (!file) return;

    setUploadingView(viewName);
    setDraftStatus('Guardando fotografía de forma privada...');

    try {
      const photoPath = await uploadPhotoToStorage(file, viewName);

      await saveDraft({
        frontPath: viewName === 'front' ? photoPath : frontPath,
        sidePath: viewName === 'side' ? photoPath : sidePath,
        backPath: viewName === 'back' ? photoPath : backPath,
      });

      if (viewName === 'front') setFrontPath(photoPath);
      if (viewName === 'side') setSidePath(photoPath);
      if (viewName === 'back') setBackPath(photoPath);

      setDraftStatus('Fotografía guardada. Puedes continuar cuando quieras.');
    } catch (err) {
      console.error('Genesis onboarding photo draft:', err);
      alert('❌ Error: ' + err.message);
      setDraftStatus('No se pudo guardar la fotografía. Intenta nuevamente.');
    } finally {
      setUploadingView(null);
    }
  };

  const handleCompleteOnboarding = async (event) => {
    event.preventDefault();

    if (!frontPath || !sidePath || !backPath) {
      alert('⚠️ ALERTA INNEGOCIABLE: Debes adjuntar las 3 fotos de inicio.');
      return;
    }

    if (!legalAccepted) {
      alert(
        '⚠️ ALERTA LEGAL: Debes aceptar los Términos de Servicio para continuar.'
      );
      return;
    }

    setLoading(true);

    try {
      const code = coachCode.trim().toUpperCase();

      if (!code || !currentUser?.id) {
        throw new Error('Tu sesión o código de invitación no pudo ser validado.');
      }

      const onboardingResult = await invokeAthleteBoundary(
        'COMPLETE_ONBOARDING',
        {
          code,
          fullName: fullName.trim(),
          age: Number.parseInt(age, 10),
          weight: Number.parseFloat(weight),
          height: Number.parseFloat(height),
          gender,
          goal,
          injuries: injuries.trim() || 'Ninguna',
          frontPath,
          sidePath,
          backPath,
          legalAccepted,
        }
      );

      setCompleted(true);

      console.log('Genesis onboarding completed:', {
        athleteId: onboardingResult.athlete_id,
        coachId: onboardingResult.coach_id,
        plan: onboardingResult.athlete_plan,
      });

      alert(
        '✅ Contrato firmado y datos registrados con éxito. Redirigiendo a tu Portal...'
      );

      navigate('/client');
    } catch (err) {
      console.error('Client onboarding error:', err);
      alert('❌ Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!draftReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm font-mono text-neutral-300">
          <Loader2 size={18} className="animate-spin text-amber-500" />
          Restaurando tu configuración segura...
        </div>
      </div>
    );
  }

  const stepTitle =
    step === 1
      ? 'Tu Invitación'
      : step === 2
        ? 'Métricas Clínicas'
        : step === 3
          ? 'Fotos Semanales'
          : 'Contrato Legal';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans selection:bg-amber-500/30">
      <div className="w-full max-w-lg bg-[#111] border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 opacity-5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />

        <div className="flex justify-between items-center mb-6 border-b border-neutral-800/60 pb-4 relative z-20">
          <div className="flex items-center gap-2">
            <ShieldCheck size={28} className="text-amber-500" />
            <span className="text-xs font-black uppercase tracking-widest text-neutral-300">
              Genesis OS
            </span>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-red-400 transition-colors font-mono bg-neutral-900/50 px-3 py-1.5 rounded-lg border border-neutral-800"
          >
            <LogOut size={14} />
            Cerrar Sesión
          </button>
        </div>

        <div className="text-center mb-4 relative z-10">
          <h1 className="text-2xl font-black uppercase tracking-widest">
            Configuración Inicial
          </h1>
          <p className="text-xs text-neutral-500 font-mono mt-2">
            Paso {step} de 4: {stepTitle}
          </p>
        </div>

        <p className="text-center text-[10px] font-mono text-neutral-500 mb-5">
          {draftStatus}
        </p>

        <form
          onSubmit={
            step === 1
              ? handleInvitationStep
              : step === 2
                ? (event) => {
                    event.preventDefault();
                    setStep(3);
                  }
                : step === 3
                  ? (event) => {
                      event.preventDefault();
                      setStep(4);
                    }
                  : handleCompleteOnboarding
          }
          className="space-y-5 relative z-10"
        >
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  Código de Invitación del Coach
                </label>
                <input
                  type="text"
                  value={coachCode}
                  onChange={(event) =>
                    setCoachCode(event.target.value.toUpperCase())
                  }
                  required
                  placeholder="Ej: PRO-123456"
                  className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm font-mono text-amber-500 outline-none focus:border-amber-500 uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  Nombre Completo Real
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  required
                  placeholder="Nombre y Apellido"
                  className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Edad
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(event) => setAge(event.target.value)}
                    required
                    min="14"
                    max="99"
                    placeholder="25"
                    className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Género Biológico
                  </label>
                  <select
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"
                  >
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg disabled:opacity-40"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                Siguiente
                <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Peso (KG)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(event) => setWeight(event.target.value)}
                    required
                    placeholder="70.5"
                    className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                    Altura (CM)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(event) => setHeight(event.target.value)}
                    required
                    placeholder="175"
                    className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  Objetivo Físico
                </label>
                <select
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"
                >
                  <option value="Pérdida de Grasa">Pérdida de Grasa</option>
                  <option value="Ganancia Muscular">Ganancia Muscular</option>
                  <option value="Recomposición">
                    Recomposición (Mantenimiento)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">
                  Lesiones o Patologías (Opcional)
                </label>
                <textarea
                  value={injuries}
                  onChange={(event) => setInjuries(event.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs font-mono text-white outline-none h-16 resize-none focus:border-amber-500"
                  placeholder="Ej: Dolor en rodilla derecha, asma..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-1/3 bg-neutral-900 text-neutral-400 font-bold uppercase text-[10px] py-4 rounded-xl hover:text-white transition-colors"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  Siguiente
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle
                  size={20}
                  className="text-amber-500 shrink-0 mt-0.5"
                />
                <p className="text-[11px] text-amber-200/90 font-mono leading-relaxed">
                  <strong>Requisito Innegociable:</strong> Adjunta las 3 fotos
                  para que tu entrenador pueda evaluar tu punto de partida corporal.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <PhotoSlot
                  label="1. Frente"
                  path={frontPath}
                  uploading={uploadingView === 'front'}
                  onSelect={(event) => {
                    void handlePhotoSelection(event, 'front');
                  }}
                />
                <PhotoSlot
                  label="2. Perfil"
                  path={sidePath}
                  uploading={uploadingView === 'side'}
                  onSelect={(event) => {
                    void handlePhotoSelection(event, 'side');
                  }}
                />
                <PhotoSlot
                  label="3. Espalda"
                  path={backPath}
                  uploading={uploadingView === 'back'}
                  onSelect={(event) => {
                    void handlePhotoSelection(event, 'back');
                  }}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-1/3 bg-neutral-900 text-neutral-400 font-bold uppercase text-[10px] py-4 rounded-xl hover:text-white transition-colors"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={
                    !frontPath ||
                    !sidePath ||
                    !backPath ||
                    uploadingView !== null
                  }
                  className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Siguiente
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center border border-neutral-700">
                  <Scale className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">
                    Términos de Servicio
                  </h2>
                  <p className="text-[10px] text-neutral-500 font-mono">
                    Jurisdicción: Estado de Florida, EE.UU.
                  </p>
                </div>
              </div>

              <div className="bg-black border border-neutral-800 rounded-2xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-neutral-400 space-y-3 scrollbar-hide shadow-inner">
                <p>
                  <strong className="text-white">
                    1. MEDICAL DISCLAIMER & ASSUMPTION OF RISK
                  </strong>
                  <br />
                  The information provided by Genesis OS and its affiliated coaches is for educational and informational purposes only and is not intended as medical advice. You acknowledge that participating in exercise and diet programs involves inherent risks of physical injury. You assume all responsibility for your own health and safety.
                </p>
                <p>
                  <strong className="text-white">
                    2. WAIVER OF LIABILITY
                  </strong>
                  <br />
                  By checking the box below, you release, waive, and discharge Genesis OS, its creators, and your assigned coach from any and all liability, claims, or causes of action arising out of or related to any loss, damage, or injury sustained while participating in the programs.
                </p>
                <p>
                  <strong className="text-white">
                    3. NO REFUND POLICY (TIME-BOXING)
                  </strong>
                  <br />
                  You acknowledge that all payments made to your coach or the platform are final. Programs are strictly time-boxed (e.g., 12 weeks). Pauses, extensions, or refunds are not permitted under any circumstances.
                </p>
                <p>
                  <strong className="text-white">
                    4. GOVERNING LAW
                  </strong>
                  <br />
                  This agreement shall be governed by and construed in accordance with the laws of the State of Florida, United States, without giving effect to any principles of conflicts of law.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-xl hover:bg-neutral-900/50 transition-colors">
                <div
                  className={
                    'w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ' +
                    (legalAccepted
                      ? 'bg-amber-500 border-amber-500'
                      : 'bg-black border-neutral-700 group-hover:border-amber-500')
                  }
                >
                  {legalAccepted ? (
                    <CheckCircle2 size={14} className="text-black" />
                  ) : null}
                </div>
                <span className="text-[11px] font-mono text-neutral-300 leading-relaxed">
                  He leído cuidadosamente, entiendo y acepto voluntariamente el{' '}
                  <strong>Descargo de Responsabilidad Médica</strong> y la
                  Renuncia de Responsabilidad.
                </span>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={legalAccepted}
                  onChange={(event) => setLegalAccepted(event.target.checked)}
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="w-1/3 bg-neutral-900 text-neutral-400 font-bold uppercase text-[10px] py-4 rounded-xl hover:text-white transition-colors"
                >
                  Atrás
                </button>
                <button
                  type="submit"
                  disabled={loading || !legalAccepted}
                  className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Scale size={16} />
                      Firmar y Acceder
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}