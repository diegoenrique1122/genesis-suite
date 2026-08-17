import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { ShieldCheck, CheckCircle2, Loader2, ArrowRight, Camera, AlertTriangle, LogOut, Scale } from 'lucide-react';

export default function ClientOnboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  const [step, setStep] = useState(1); // 1: Código | 2: Biometría | 3: Fotos | 4: Legal
  const [coachCode, setCoachCode] = useState('');
  
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [gender, setGender] = useState('Masculino');
  const [goal, setGoal] = useState('Pérdida de Grasa');
  const [injuries, setInjuries] = useState('');

  const [frontFile, setFrontFile] = useState(null);
  const [sideFile, setSideFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  
  // ⚖️ ESTADO DEL ESCUDO LEGAL
  const [legalAccepted, setLegalAccepted] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');
      setCurrentUser(session.user);
    };
    checkUser();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const uploadPhotoToStorage = async (file, viewName, athleteId) => {
    const fileExt = file.name.split('.').pop();
    const filePath = `progress_photos/${athleteId}_week0_${viewName}_${Date.now()}.${fileExt}`;
    const { error: uploadErr } = await supabase.storage.from('athlete_evidence').upload(filePath, file);
    if (uploadErr) throw uploadErr;
    const { data } = supabase.storage.from('athlete_evidence').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleCompleteOnboarding = async (e) => {
    e.preventDefault();
    
    if (!frontFile || !sideFile || !backFile) {
      alert("⚠️ ALERTA INNEGOCIABLE: Debes adjuntar las 3 fotos de inicio.");
      return;
    }
    
    if (!legalAccepted) {
      alert("⚠️ ALERTA LEGAL: Debes aceptar los Términos de Servicio para continuar.");
      return;
    }

    setLoading(true);

    try {
      const numericCode = coachCode.replace(/\D/g, ''); 
      if (!numericCode || numericCode.length < 4) {
        throw new Error("Código de Coach inválido. Ingresa el código numérico que te proporcionó tu entrenador.");
      }

      let planAssigned = 'IGNICION';
      if (coachCode.toUpperCase().includes('EVO')) planAssigned = 'EVOLUCION';
      if (coachCode.toUpperCase().includes('PRO')) planAssigned = 'ELITE';

      const { data: coachData, error: coachErr } = await supabase
        .from('coaches_profile')
        .select('id, full_name')
        .ilike('coach_code', `%${numericCode}%`)
        .maybeSingle();

      if (coachErr || !coachData) throw new Error("Entrenador no encontrado. Verifica el código con tu Coach.");

      const { data: athleteProfile } = await supabase
        .from('athletes_profile')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

      if (!athleteProfile) throw new Error("No se encontró tu perfil base en el sistema.");

      const frontUrl = await uploadPhotoToStorage(frontFile, 'front', athleteProfile.id);
      const sideUrl = await uploadPhotoToStorage(sideFile, 'side', athleteProfile.id);
      const backUrl = await uploadPhotoToStorage(backFile, 'back', athleteProfile.id);

      const { error: photosTableErr } = await supabase.from('athlete_photos').insert({
        athlete_id: athleteProfile.id,
        coach_id: coachData.id,
        week_number: 0,
        front_url: frontUrl,
        side_url: sideUrl,
        back_url: backUrl,
        weight_recorded: parseFloat(weight)
      });

      if (photosTableErr) throw photosTableErr;

      const { error: updateErr } = await supabase
        .from('athletes_profile')
        .update({
          full_name: fullName,
          coach_id: coachData.id,
          b2c_plan: planAssigned,
          age: parseInt(age),
          weight: parseFloat(weight),
          height: parseFloat(height),
          gender: gender,
          goal: goal,
          injuries: injuries || 'Ninguna',
          is_onboarded: true,
          legal_accepted: true, // ⚖️ SELLO LEGAL EN BASE DE DATOS
          program_start_date: null
        })
        .eq('user_id', currentUser.id);

      if (updateErr) throw updateErr;

      await supabase.from('system_notifications').insert({
        recipient_role: 'COACH',
        recipient_id: coachData.id,
        title: '¡Nuevo Atleta en Sala de Espera!',
        message: `El atleta ${fullName} ha completado su biometría, firmado el contrato y subido sus fotos.`,
        type: 'NEW_ATHLETE'
      });

      alert("✅ Contrato firmado y datos registrados con éxito. Redirigiendo a tu Portal...");
      navigate('/client');

    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans selection:bg-amber-500/30">
      <div className="w-full max-w-lg bg-[#111] border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 opacity-5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

        <div className="flex justify-between items-center mb-6 border-b border-neutral-800/60 pb-4 relative z-20">
          <div className="flex items-center gap-2">
            <ShieldCheck size={28} className="text-amber-500" />
            <span className="text-xs font-black uppercase tracking-widest text-neutral-300">Genesis OS</span>
          </div>
          <button 
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-red-400 transition-colors font-mono bg-neutral-900/50 px-3 py-1.5 rounded-lg border border-neutral-800"
          >
            <LogOut size={14} /> Cerrar Sesión
          </button>
        </div>

        <div className="text-center mb-8 relative z-10">
          <h1 className="text-2xl font-black uppercase tracking-widest">Configuración Inicial</h1>
          <p className="text-xs text-neutral-500 font-mono mt-2">
            Paso {step} de 4: {step === 1 ? 'Tu Invitación' : step === 2 ? 'Métricas Clínicas' : step === 3 ? 'Fotos Semanales' : 'Contrato Legal'}
          </p>
        </div>

        <form onSubmit={step === 1 ? (e) => { e.preventDefault(); setStep(2); } : step === 2 ? (e) => { e.preventDefault(); setStep(3); } : step === 3 ? (e) => { e.preventDefault(); setStep(4); } : handleCompleteOnboarding} className="space-y-5 relative z-10">
          
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Código de Invitación del Coach</label>
                <input type="text" value={coachCode} onChange={(e) => setCoachCode(e.target.value.toUpperCase())} required placeholder="Ej: PRO-123456" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm font-mono text-amber-500 outline-none focus:border-amber-500 uppercase"/>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Nombre Completo Real</label>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="Nombre y Apellido" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Edad</label>
                  <input type="number" value={age} onChange={(e) => setAge(e.target.value)} required min="14" max="99" placeholder="25" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"/>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Género Biológico</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500">
                    <option value="Masculino">Masculino</option>
                    <option value="Femenino">Femenino</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 mt-4 shadow-lg">
                Siguiente <ArrowRight size={16}/>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
               <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Peso (KG)</label>
                  <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} required placeholder="70.5" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"/>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Altura (CM)</label>
                  <input type="number" value={height} onChange={(e) => setHeight(e.target.value)} required placeholder="175" className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500"/>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Objetivo Físico</label>
                <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-sm text-white outline-none focus:border-amber-500">
                  <option value="Pérdida de Grasa">Pérdida de Grasa</option>
                  <option value="Ganancia Muscular">Ganancia Muscular</option>
                  <option value="Recomposición">Recomposición (Mantenimiento)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-neutral-500 block mb-1">Lesiones o Patologías (Opcional)</label>
                <textarea value={injuries} onChange={(e) => setInjuries(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs font-mono text-white outline-none h-16 resize-none focus:border-amber-500" placeholder="Ej: Dolor en rodilla derecha, asma..."/>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setStep(1)} className="w-1/3 bg-neutral-900 text-neutral-400 font-bold uppercase text-[10px] py-4 rounded-xl hover:text-white transition-colors">Atrás</button>
                <button type="submit" className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[10px] tracking-widest py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg">
                  Siguiente <ArrowRight size={16}/>
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/90 font-mono leading-relaxed">
                  <strong>Requisito Innegociable:</strong> Adjunta las 3 fotos para que tu entrenador pueda evaluar tu punto de partida corporal.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center">
                  <span className="text-[9px] font-black uppercase text-neutral-400 mb-2">1. Frente</span>
                  <label className={`w-full aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${frontFile ? 'border-green-500 bg-green-500/10' : 'border-neutral-700 bg-neutral-900 hover:border-amber-500'}`}>
                    {frontFile ? <CheckCircle2 size={24} className="text-green-500" /> : <Camera size={20} className="text-neutral-500" />}
                    <span className="text-[8px] font-mono text-neutral-400 mt-1">{frontFile ? 'Cargada' : 'Seleccionar'}</span>
                    <input type="file" accept="image/*" onChange={(e) => setFrontFile(e.target.files[0])} className="hidden" />
                  </label>
                </div>

                <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center">
                  <span className="text-[9px] font-black uppercase text-neutral-400 mb-2">2. Perfil</span>
                  <label className={`w-full aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${sideFile ? 'border-green-500 bg-green-500/10' : 'border-neutral-700 bg-neutral-900 hover:border-amber-500'}`}>
                    {sideFile ? <CheckCircle2 size={24} className="text-green-500" /> : <Camera size={20} className="text-neutral-500" />}
                    <span className="text-[8px] font-mono text-neutral-400 mt-1">{sideFile ? 'Cargada' : 'Seleccionar'}</span>
                    <input type="file" accept="image/*" onChange={(e) => setSideFile(e.target.files[0])} className="hidden" />
                  </label>
                </div>

                <div className="bg-black border border-neutral-800 rounded-2xl p-3 text-center flex flex-col items-center">
                  <span className="text-[9px] font-black uppercase text-neutral-400 mb-2">3. Espalda</span>
                  <label className={`w-full aspect-[3/4] rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${backFile ? 'border-green-500 bg-green-500/10' : 'border-neutral-700 bg-neutral-900 hover:border-amber-500'}`}>
                    {backFile ? <CheckCircle2 size={24} className="text-green-500" /> : <Camera size={20} className="text-neutral-500" />}
                    <span className="text-[8px] font-mono text-neutral-400 mt-1">{backFile ? 'Cargada' : 'Seleccionar'}</span>
                    <input type="file" accept="image/*" onChange={(e) => setBackFile(e.target.files[0])} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(2)} className="w-1/3 bg-neutral-900 text-neutral-400 font-bold uppercase text-[10px] py-4 rounded-xl hover:text-white transition-colors">Atrás</button>
                <button type="submit" disabled={!frontFile || !sideFile || !backFile} className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  Siguiente <ArrowRight size={16}/>
                </button>
              </div>
            </div>
          )}

          {/* ⚖️ PASO 4: CONTRATO LEGAL (FLORIDA JURISDICTION) */}
          {step === 4 && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center border border-neutral-700">
                  <Scale className="text-white" size={20}/>
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-widest text-white">Términos de Servicio</h2>
                  <p className="text-[10px] text-neutral-500 font-mono">Jurisdicción: Estado de Florida, EE.UU.</p>
                </div>
              </div>

              <div className="bg-black border border-neutral-800 rounded-2xl p-4 h-48 overflow-y-auto font-mono text-[10px] text-neutral-400 space-y-3 scrollbar-hide shadow-inner">
                <p><strong className="text-white">1. MEDICAL DISCLAIMER & ASSUMPTION OF RISK</strong><br/>
                The information provided by Genesis OS and its affiliated coaches is for educational and informational purposes only and is not intended as medical advice. You acknowledge that participating in exercise and diet programs involves inherent risks of physical injury. You assume all responsibility for your own health and safety.</p>
                
                <p><strong className="text-white">2. WAIVER OF LIABILITY</strong><br/>
                By checking the box below, you release, waive, and discharge Genesis OS, its creators, and your assigned coach from any and all liability, claims, or causes of action arising out of or related to any loss, damage, or injury sustained while participating in the programs.</p>

                <p><strong className="text-white">3. NO REFUND POLICY (TIME-BOXING)</strong><br/>
                You acknowledge that all payments made to your coach or the platform are final. Programs are strictly time-boxed (e.g., 12 weeks). Pauses, extensions, or refunds are not permitted under any circumstances.</p>

                <p><strong className="text-white">4. GOVERNING LAW</strong><br/>
                This agreement shall be governed by and construed in accordance with the laws of the State of Florida, United States, without giving effect to any principles of conflicts of law.</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer group p-2 rounded-xl hover:bg-neutral-900/50 transition-colors">
                <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${legalAccepted ? 'bg-amber-500 border-amber-500' : 'bg-black border-neutral-700 group-hover:border-amber-500'}`}>
                  {legalAccepted && <CheckCircle2 size={14} className="text-black" />}
                </div>
                <span className="text-[11px] font-mono text-neutral-300 leading-relaxed">
                  He leído cuidadosamente, entiendo y acepto voluntariamente el <strong>Descargo de Responsabilidad Médica</strong> y la Renuncia de Responsabilidad.
                </span>
                <input type="checkbox" className="hidden" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} />
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setStep(3)} className="w-1/3 bg-neutral-900 text-neutral-400 font-bold uppercase text-[10px] py-4 rounded-xl hover:text-white transition-colors">Atrás</button>
                <button type="submit" disabled={loading || !legalAccepted} className="w-2/3 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest text-[10px] py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {loading ? <Loader2 size={16} className="animate-spin"/> : <><Scale size={16}/> Firmar y Acceder</>}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}