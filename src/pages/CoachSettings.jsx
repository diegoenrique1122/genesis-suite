import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { useLocale } from '../contexts/LocaleContext';
import GenesisTabs from '../components/ui/GenesisTabs';
import { loadCoachSettings, coachRegistrationLink } from '../services/coachSettingsService';
import { 
  ArrowLeft, User, Lock, Send, Eye, 
  CheckCircle2, Loader2, Building2, Upload, Palette, AtSign, CreditCard,
  Users, GitMerge, MessageSquare, Layers, Copy, AlertTriangle, RotateCcw
} from 'lucide-react';

const COACH_THEMES = [
  { id: 'dark', name: 'Dark Genesis', bg: 'bg-[#0a0a0a]', card: 'bg-[#111111]', border: 'border-neutral-800', text: 'text-white', accent: 'text-amber-500' },
  { id: 'midnight', name: 'Midnight Blue', bg: 'bg-[#050B14]', card: 'bg-[#0A192F]', border: 'border-blue-900/50', text: 'text-blue-50', accent: 'text-blue-400' },
  { id: 'crimson', name: 'Crimson Force', bg: 'bg-[#1a0505]', card: 'bg-[#2a0808]', border: 'border-red-900/50', text: 'text-red-50', accent: 'text-red-500' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', bg: 'bg-[#0d0221]', card: 'bg-[#1a053a]', border: 'border-purple-500/30', text: 'text-pink-50', accent: 'text-cyan-400' },
  { id: 'emerald', name: 'Emerald Eco', bg: 'bg-[#021810]', card: 'bg-[#042f1f]', border: 'border-emerald-900/50', text: 'text-emerald-50', accent: 'text-emerald-400' },
  { id: 'light', name: 'Clean Light', bg: 'bg-neutral-50', card: 'bg-white', border: 'border-neutral-200', text: 'text-neutral-900', accent: 'text-blue-600' }
];

export default function CoachSettings() {
  const navigate = useNavigate();
  const { refreshTheme } = useTheme();
  const { locale, setLocale } = useLocale();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [immersionLoading, setImmersiveLoading] = useState(false);
  
  const [coach, setCoach] = useState(null);
  const [globalSettings, setGlobalSettings] = useState(null);
  
  // NUEVOS ESTADOS B2B
  const [athletes, setAthletes] = useState([]);
  const [referredCoaches, setReferredCoaches] = useState([]);
  
  const [activeTab, setActiveTab] = useState('PREFERENCES'); 
  const [activeTheme, setActiveTheme] = useState(COACH_THEMES[0]);

  // Estados Formulario
  const [fullName, setFullName] = useState('');
  const [themeId, setThemeId] = useState('dark');
  const [watermarkOpacity, setWatermarkOpacity] = useState(15);
  const [watermarkSize, setWatermarkSize] = useState(50);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [preferredLocale, setPreferredLocale] = useState(locale || 'es');
  const [coachAdminUnitSystem, setCoachAdminUnitSystem] = useState('METRIC');
  const [preferencesSaving, setPreferencesSaving] = useState(false);

  // Estados Request Admin
  const [requestType, setRequestType] = useState('UPGRADE');
  const [requestedPlan, setRequestedPlan] = useState('ELITE');
  const [requestNote, setRequestNote] = useState('');
  const [sendingReq, setSendingReq] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [notice, setNotice] = useState(null);
  const [copying, setCopying] = useState(false);
  const uiLocale = preferredLocale || locale;
  const copy = (es, en) => (uiLocale === 'en' ? en : es);
  const busy = saving || preferencesSaving || sendingReq;


  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!session) { navigate('/'); return; }
        const result = await loadCoachSettings(supabase, session.user.id);
        if (cancelled) return;
        const { coach: data, preferences } = result;
        setCoach(data);
        setFullName(data.full_name || '');
        setThemeId(data.theme_id || 'dark');
        setWatermarkOpacity(data.watermark_opacity ?? 15);
        setWatermarkSize(data.watermark_size ?? 50);
        setInstagramHandle(data.instagram_handle || '');
        setActiveTheme(COACH_THEMES.find(th => th.id === data.theme_id) || COACH_THEMES[0]);
        setGlobalSettings(result.globalSettings);
        setPreferredLocale(preferences?.preferred_locale || 'es');
        setCoachAdminUnitSystem(preferences?.coach_admin_unit_system || preferences?.preferred_unit_system || 'METRIC');
        setAthletes(result.athletes);
        setReferredCoaches(result.referredCoaches);
      } catch (error) {
        if (!cancelled) setLoadError(error.message || 'No fue posible cargar los ajustes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [navigate, loadAttempt]);

  const handleSaveBrand = async (e) => {
    e.preventDefault();
    if (busy || coach?.b2b_plan !== 'ELITE') return;
    setNotice(null);

    try {
      setSaving(true);
      let logoUrl = coach.brand_logo_url;

      if (logoFile) {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/webp'
        ];

        if (!allowedMimeTypes.includes(logoFile.type)) {
          throw new Error(
            'El logo debe ser JPG, PNG o WEBP.'
          );
        }

        if (logoFile.size > 5 * 1024 * 1024) {
          throw new Error(
            'El logo no puede superar 5 MB.'
          );
        }

        const fileExt = (
          logoFile.name.split('.').pop() || 'png'
        )
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        const filePath =
          `coaches/${coach.id}/logo_${Date.now()}.${fileExt}`;

        const { error: uploadErr } =
          await supabase.storage
            .from('genesis_brand_assets')
            .upload(
              filePath,
              logoFile,
              {
                cacheControl: '3600',
                upsert: false
              }
            );

        if (uploadErr) {
          throw uploadErr;
        }

        const { data } =
          supabase.storage
            .from('genesis_brand_assets')
            .getPublicUrl(filePath);

        if (!data?.publicUrl) {
          throw new Error(
            'Genesis no pudo generar la URL pública del logo.'
          );
        }

        logoUrl = data.publicUrl;
      }
      const { data: savedBrand, error } = await supabase.from('coaches_profile').update({
        full_name: fullName, 
        theme_id: themeId, 
        brand_logo_url: logoUrl, 
        watermark_opacity: Number(watermarkOpacity), 
        watermark_size: Number(watermarkSize), 
        instagram_handle: instagramHandle
      }).eq('id', coach.id).eq('user_id', coach.user_id)
        .select('id, full_name, theme_id, brand_logo_url, watermark_opacity, watermark_size, instagram_handle').single();

      if (error) throw error;
      
      if (savedBrand?.id !== coach.id) throw new Error(copy('No se confirmó el guardado de la marca.', 'Brand settings were not confirmed.'));
      const t = COACH_THEMES.find(th => th.id === themeId) || COACH_THEMES[0];
      setActiveTheme(t);
      setCoach((current) => ({ ...current, ...savedBrand }));
      setLogoFile(null);
      setNotice({ type: 'success', message: copy('Identidad visual guardada.', 'Visual identity saved.') });
      try { await refreshTheme(); } catch {
        setNotice({ type: 'success', message: copy('Identidad guardada. Recarga el portal para actualizar la apariencia.', 'Brand saved. Reload the portal to refresh the appearance.') });
      }
    } catch (error) {
      setNotice({ type: 'error', message: copy('No se guardaron los ajustes: ', 'Settings were not saved: ') + error.message });
    } finally { setSaving(false); }
  };

  const handleSaveOperationalPreferences = async (event) => {
    event.preventDefault();

    if (busy || !coach?.user_id) return;
    setNotice(null);

    try {
      setPreferencesSaving(true);

      const { data: savedPreferences, error } = await supabase
        .from('user_preferences')
        .upsert(
          {
            user_id: coach.user_id,
            preferred_locale: preferredLocale,
            preferred_unit_system: coachAdminUnitSystem,
            coach_admin_unit_system: coachAdminUnitSystem,
          },
          { onConflict: 'user_id' }
        ).select('user_id, preferred_locale, coach_admin_unit_system').single();

      if (error) throw error;

      if (savedPreferences?.user_id !== coach.user_id) throw new Error(copy('No se confirmó el guardado.', 'Save was not confirmed.'));
      await setLocale(preferredLocale);
      setNotice({ type: 'success', message: copy('Preferencias guardadas.', 'Preferences saved.') });
    } catch (err) {
      setNotice({ type: 'error', message: copy('Error al guardar preferencias: ', 'Could not save preferences: ') + err.message });
    } finally {
      setPreferencesSaving(false);
    }
  };


  const handleSendAdminRequest = async (e) => {
    e.preventDefault();
    if (busy || !coach?.id) return;
    setNotice(null);
    try {
      setSendingReq(true);
      const { error } = await supabase.from('admin_requests').insert({
        coach_id: coach.id, request_type: requestType, requested_plan: requestedPlan, note: requestNote, status: 'PENDING'
      });
      if (error) throw error;
      setNotice({ type: 'success', message: copy('Solicitud enviada al Súper Admin. Pendiente de revisión.', 'Request sent to Super Admin. Awaiting review.') });
      setRequestNote('');
    } catch (error) { setNotice({ type: 'error', message: copy('No se envió la solicitud: ', 'Request was not sent: ') + error.message }); } finally { setSendingReq(false); }
  };

const handleImmersiveMode = async () => {
  try {
    setImmersiveLoading(true);

    const {
      data,
      error,
    } = await supabase.rpc(
      'ensure_immersive_athlete_profile'
    );

    if (error) {
      throw error;
    }

    const result =
      Array.isArray(data)
        ? data[0]
        : data;

    if (!result?.athlete_id) {
      throw new Error(
        'Genesis no pudo preparar el perfil inmersivo.'
      );
    }

    console.log(
      'Genesis Immersive Athlete Mode:',
      {
        athleteId: result.athlete_id,
        plan: result.athlete_plan,
        created: result.created,
      }
    );

    navigate('/client');

  } catch (err) {
    console.error(
      'Genesis immersive mode error:',
      err
    );

    alert(
      `❌ Error al iniciar ${copy('Modo Inmersivo', 'Immersive Mode')}: ${err.message}`
    );

  } finally {
    setImmersiveLoading(false);
  }
};

  const copyRegistrationLink = async () => {
    if (copying) return;
    setCopying(true);
    setNotice(null);
    try {
      await navigator.clipboard.writeText(coachRegistrationLink(window.location.origin));
      setNotice({ type: 'success', message: copy('Enlace de registro copiado.', 'Registration link copied.') });
    } catch {
      setNotice({ type: 'error', message: copy('No se pudo copiar. Selecciona el enlace y cópialo manualmente.', 'Copy failed. Select the link and copy it manually.') });
    } finally { setCopying(false); }
  };

  if (loading) return <div className={`min-h-screen ${activeTheme.bg} flex items-center justify-center`} role="status" aria-label={copy('Cargando ajustes', 'Loading settings')}><Loader2 className={`animate-spin ${activeTheme.accent}`} size={40}/></div>;
  if (loadError) return (
    <main className={`min-h-screen ${activeTheme.bg} ${activeTheme.text} p-6 flex items-center justify-center`}>
      <div className={`max-w-lg w-full rounded-3xl border ${activeTheme.border} ${activeTheme.card} p-8 space-y-4`}>
        <AlertTriangle size={28} className="text-amber-500" />
        <h1 className="text-xl font-bold">{copy('No se pudieron cargar los ajustes', 'Settings could not be loaded')}</h1>
        <p role="alert" className="text-sm opacity-70">{loadError}</p>
        <div className="flex gap-4">
          <button type="button" onClick={() => setLoadAttempt((n) => n + 1)} className="rounded-xl border border-current/30 p-3 text-sm flex items-center gap-2"><RotateCcw size={16}/>{copy('Reintentar', 'Retry')}</button>
          <button type="button" onClick={() => navigate('/coach')} className="p-3 text-sm">{copy('Volver al panel', 'Back to dashboard')}</button>
        </div>
      </div>
    </main>
  );
  const isElite = coach?.b2b_plan === 'ELITE';
  const tabs = [
    { id: 'PREFERENCES', label: copy('Preferencias', 'Preferences'), description: copy('Idioma y unidades', 'Language and units'), icon: User },
    { id: 'BRANDING', label: copy('Identidad visual', 'Visual identity'), description: copy('Marca y apariencia · Élite', 'Brand and appearance · Elite'), icon: Palette },
    { id: 'ROSTER', label: copy('Mis atletas', 'My athletes'), description: copy('Atletas vinculados', 'Linked athletes'), icon: Users },
    { id: 'COMM', label: copy('Comunicaciones', 'Communications'), description: copy('Chat privado y comunidad', 'Private chat and community'), icon: MessageSquare },
    { id: 'MULTILEVEL', label: copy('Invitaciones', 'Invitations'), description: copy('Registro y red existente', 'Registration and existing network'), icon: GitMerge },
    { id: 'LICENSE', label: copy('Mi licencia', 'My license'), description: copy('Solicitudes al administrador', 'Administrator requests'), icon: CreditCard },
  ];

  return (
    <div style={{ colorScheme: activeTheme.id === 'light' ? 'light' : 'dark' }} className={`min-h-screen ${activeTheme.bg} ${activeTheme.text} font-sans pb-24 relative overflow-hidden transition-colors duration-500`}>
      
      {/* 🔮 RENDERIZADOR DE MARCA DE AGUA INTACTO */}
      {isElite && coach?.brand_logo_url ? (
         <div className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center z-0" style={{ opacity: watermarkOpacity / 100 }}>
           <img src={coach.brand_logo_url} alt="Coach Logo" style={{ width: `${watermarkSize}%`, objectFit: 'contain' }} className="blur-[1px] drop-shadow-2xl" />
           {instagramHandle && (
             <div className="flex items-center gap-3 mt-6 text-4xl sm:text-6xl font-black tracking-widest text-white/40 drop-shadow-lg"><AtSign size={48} /> {instagramHandle.replace('@', '')}</div>
           )}
         </div>
      ) : (!isElite && globalSettings?.watermark_url) ? (
         <div className="fixed inset-0 pointer-events-none flex flex-col items-center justify-center z-0" style={{ opacity: (globalSettings.watermark_opacity || 15) / 100 }}>
           <img src={globalSettings.watermark_url} alt="Genesis Global" style={{ width: `${globalSettings.watermark_size || 50}%`, objectFit: 'contain' }} className="blur-[1px] drop-shadow-2xl" />
           {globalSettings.instagram_handle && (
             <div className="flex items-center gap-3 mt-6 text-4xl sm:text-6xl font-black tracking-widest text-white/40 drop-shadow-lg"><AtSign size={48} /> {globalSettings.instagram_handle.replace('@', '')}</div>
           )}
         </div>
      ) : null}

      {/* NAVBAR INTACTO */}
      <nav className={`${activeTheme.card} ${activeTheme.border} border-b sticky top-0 z-40 shadow-lg backdrop-blur-md bg-opacity-80`}>
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button aria-label={copy('Volver al panel', 'Back to dashboard')} onClick={() => navigate('/coach')} className="text-neutral-500 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
            <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Building2 size={16} className={activeTheme.accent}/> {copy('Configuración del coach', 'Coach settings')}
            </h1>
          </div>
          {isElite && (
            <button onClick={handleImmersiveMode} disabled={immersionLoading} className={`bg-neutral-900 border ${activeTheme.border} px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${activeTheme.accent} hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50`}>
              {immersionLoading ? <Loader2 size={12} className="animate-spin"/> : <Eye size={12}/>} {copy('Modo Inmersivo', 'Immersive Mode')}
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8 relative z-10">
        
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p className={`text-[11px] font-bold uppercase tracking-[0.2em] ${activeTheme.accent}`}>Genesis OS · {copy('Configuración', 'Settings')}</p>
            <h2 className="text-3xl font-bold tracking-tight mt-2">{copy('Tu espacio de trabajo', 'Your workspace')}</h2>
            <p className="text-sm opacity-60 mt-2">{copy('Administra tu experiencia, comunicación e identidad en un solo lugar.', 'Manage your experience, communication and identity in one place.')}</p>
          </div>
          <span className={`rounded-full border ${activeTheme.border} px-4 py-2 text-xs font-bold self-start`}>Plan {coach.b2b_plan}</span>
        </header>
        {notice ? (
          <div role={notice.type === 'error' ? 'alert' : 'status'} className={`rounded-2xl border p-4 text-sm flex items-start gap-3 ${notice.type === 'error' ? 'border-red-500/40 bg-red-500/10' : 'border-green-500/40 bg-green-500/10'}`}>
            {notice.type === 'error' ? <AlertTriangle size={18} className="shrink-0"/> : <CheckCircle2 size={18} className="shrink-0"/>}
            <p>{notice.message}</p>
          </div>
        ) : null}
        <GenesisTabs label={copy('Secciones de configuración', 'Settings sections')} tabs={tabs} activeTab={activeTab} onChange={(tab) => { setActiveTab(tab); setNotice(null); }}>
        {activeTab === 'PREFERENCES' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl`}>
            <div className="flex items-center gap-4 border-b border-neutral-800/50 pb-6">
              <div className={`w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center border ${activeTheme.border}`}>
                <User className={activeTheme.accent} size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight">{copy('Preferencias Operativas', 'Operational Preferences')}</h2>
                <p className="text-[11px] font-mono opacity-60 mt-1">
                  {copy('Define como Genesis presenta medidas en tu administración. Los datos clínicos se conservan internamente en kg y cm.', 'Choose how Genesis displays measurements in your administration. Clinical data remains stored internally in kg and cm.')}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveOperationalPreferences} >
              <fieldset disabled={busy} className="space-y-6 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase opacity-60 block mb-2">{copy('Idioma preferido', 'Preferred language')}</label>
                  <select
                    aria-label={copy('Idioma preferido', 'Preferred language')}
                    value={preferredLocale}
                    onChange={(event) => setPreferredLocale(event.target.value)}
                    className={`w-full bg-black/5 border ${activeTheme.border} rounded-xl p-4 text-xs font-mono outline-none`}
                  >
                    <option value="es" className="text-black">{copy('Español', 'Spanish')}</option>
                    <option value="en" className="text-black">English</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase opacity-60 block mb-2">{copy('Unidades administrativas', 'Administrative units')}</label>
                  <select
                    aria-label={copy('Unidades administrativas', 'Administrative units')}
                    value={coachAdminUnitSystem}
                    onChange={(event) => setCoachAdminUnitSystem(event.target.value)}
                    className={`w-full bg-black/5 border ${activeTheme.border} rounded-xl p-4 text-xs font-mono outline-none`}
                  >
                    <option value="METRIC" className="text-black">{copy('Métrico (kg / cm)', 'Metric (kg / cm)')}</option>
                    <option value="IMPERIAL" className="text-black">{copy('Americano (lb / ft)', 'Imperial (lb / ft)')}</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="bg-white hover:bg-neutral-200 text-black font-black uppercase text-[11px] tracking-widest px-8 py-4 rounded-xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {preferencesSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {copy('Guardar preferencias', 'Save preferences')}
              </button>
            </fieldset>
            </form>
          </div>
        )}

        {/* 1. PESTAÑA: MARCA BLANCA (TU CÓDIGO INTACTO) */}
        {activeTab === 'BRANDING' && !isElite && (
          <div className={`${activeTheme.card} border ${activeTheme.border} p-6 sm:p-8 rounded-3xl text-center space-y-4`}>
            <Lock size={32} className="mx-auto opacity-60"/>
            <h2 className="text-xl font-bold">{copy('Identidad visual Élite', 'Elite visual identity')}</h2>
            <p className="text-sm opacity-65 max-w-md mx-auto">{copy('El plan Élite incluye tu logo, colores y marca de agua para el panel y la experiencia de tus atletas.', 'The Elite plan includes your logo, colors and watermark for your dashboard and your athletes’ experience.')}</p>
            <button type="button" onClick={() => setActiveTab('LICENSE')} className="px-5 py-3 rounded-xl bg-white text-black text-sm font-bold">{copy('Ver mi licencia', 'View my license')}</button>
          </div>
        )}
        {activeTab === 'BRANDING' && isElite && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 sm:p-8 rounded-3xl space-y-6 relative overflow-hidden shadow-xl`}>
            <div className="flex items-center gap-4 border-b border-neutral-800/50 pb-6">
              <div className={`w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center border ${activeTheme.border}`}><Palette className={activeTheme.accent} size={24}/></div>
              <div><h2 className="text-xl font-black uppercase tracking-tight">{copy('Personalización de Marca', 'Brand Customization')}</h2><p className="text-[11px] font-mono opacity-60 mt-1">{copy('Estos ajustes se reflejarán en tu panel y en la app de todos tus atletas.', 'These settings apply to your dashboard and all of your athletes’ apps.')}</p></div>
            </div>
            
            <form onSubmit={handleSaveBrand}>
              <fieldset disabled={busy || !isElite} className="space-y-6 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">{copy('Nombre Comercial', 'Business Name')}</label><input aria-label={copy('Nombre comercial', 'Business name')} type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={`w-full bg-black/5 border ${activeTheme.border} rounded-xl p-3 text-xs font-mono outline-none focus:border-white transition-colors`}/></div>
                <div>
                  <label className="text-[10px] font-black uppercase opacity-60 block mb-2">{copy('Tema y Paleta de Colores', 'Theme and Color Palette')}</label>
                  <select aria-label={copy('Tema de marca', 'Brand theme')} value={themeId} onChange={(e) => setThemeId(e.target.value)} className={`w-full bg-black/5 border ${activeTheme.border} rounded-xl p-3 text-xs font-mono font-bold uppercase outline-none focus:border-white transition-colors`}>
                    {COACH_THEMES.map(t => <option key={t.id} value={t.id} className="text-black">{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase opacity-60 block mb-3">{copy('Logo Empresarial (Marca de Agua)', 'Business Logo (Watermark)')}</label>
                <div className="flex items-center gap-6">
                  <div className={`w-32 h-32 border-2 border-dashed ${activeTheme.border} rounded-2xl flex items-center justify-center bg-black/5 overflow-hidden relative group hover:border-white transition-colors`}>
                    {coach?.brand_logo_url ? <img src={coach?.brand_logo_url} alt="Logo" className="w-full h-full object-contain p-2 opacity-50"/> : <Upload size={24} className="opacity-50"/>}
                    <input aria-label={copy('Logo empresarial', 'Business logo')} type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setLogoFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  </div>
                  <p className="text-xs font-mono opacity-70 max-w-xs">{copy('Sube una imagen PNG con transparencia para inyectarla en el fondo del ecosistema.', 'Upload a transparent PNG to place your brand across the ecosystem.')}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/5 border border-neutral-800 rounded-2xl p-5"><label className="text-[10px] font-black uppercase opacity-60 flex justify-between mb-3"><span>{copy('Opacidad', 'Opacity')}</span> <span className={activeTheme.accent}>{watermarkOpacity}%</span></label><input aria-label={copy('Opacidad de marca', 'Brand opacity')} type="range" min="1" max="100" value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(e.target.value)} className="w-full accent-current"/></div>
                <div className="bg-black/5 border border-neutral-800 rounded-2xl p-5"><label className="text-[10px] font-black uppercase opacity-60 flex justify-between mb-3"><span>{copy('Tamaño', 'Size')}</span> <span className={activeTheme.accent}>{watermarkSize}%</span></label><input aria-label={copy('Tamaño de marca', 'Brand size')} type="range" min="10" max="150" value={watermarkSize} onChange={(e) => setWatermarkSize(e.target.value)} className="w-full accent-current"/></div>
              </div>
              <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">{copy('Firma Digital (Usuario de Instagram)', 'Digital Signature (Instagram handle)')}</label><div className="relative"><AtSign className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={18}/><input aria-label={copy('Usuario de Instagram', 'Instagram handle')} type="text" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@TuUsuario" className={`w-full bg-black/5 border ${activeTheme.border} rounded-2xl pl-12 pr-4 py-4 text-sm font-mono outline-none focus:border-white transition-colors`}/></div></div>
              
              <div className="pt-4 border-t border-neutral-800/50">
                <button type="submit" disabled={busy || !isElite} className="bg-white hover:bg-neutral-200 text-black font-black uppercase text-[11px] tracking-widest px-8 py-4 rounded-xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin"/> : <><CheckCircle2 size={16}/> {copy('Guardar identidad visual', 'Save visual identity')}</>}
                </button>
              </div>
            </fieldset>
            </form>
          </div>
        )}

        {/* 2. PESTAÑA: ORGANIZACIÓN ROSTER (NUEVO) */}
        {activeTab === 'ROSTER' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl`}>
            <div className="flex justify-between items-center border-b border-neutral-800/50 pb-6">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Users size={20} className={activeTheme.accent} /> {copy('Pirámide de Atletas', 'Athlete Roster')}
              </h2>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${activeTheme.border} ${activeTheme.accent}`}>
                Total: {athletes.length}
              </span>
            </div>

            <div className="space-y-3">
              {athletes.length === 0 ? (
                <p className="text-xs text-neutral-500 font-mono text-center py-8">{copy('No tienes atletas vinculados todavía.', 'You do not have linked athletes yet.')}</p>
              ) : (
                athletes.map((ath, index) => (
                  <div key={ath.id} className={`p-4 rounded-2xl bg-black/5 border ${activeTheme.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border ${activeTheme.border} ${activeTheme.accent}`}>
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold">{ath.full_name || copy('Sin Nombre', 'Unnamed')}</h4>
                        <p className="text-[10px] text-neutral-500 font-mono">{copy('Ingreso:', 'Joined:')} {new Date(ath.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-black/5 border border-neutral-500/40">
                      {copy('Plan', 'Plan')} {ath.b2c_plan}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. PESTAÑA: RED MULTINIVEL (NUEVO) */}
        {activeTab === 'MULTILEVEL' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl`}>
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 mb-2">
              <GitMerge size={20} className={activeTheme.accent} /> {copy('Invitaciones y red de entrenadores', 'Invitations and coach network')}
            </h2>
            
            <div className={`p-6 border ${activeTheme.border} bg-black/5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4`}>
              <div>
                <h3 className={`text-sm font-bold uppercase ${activeTheme.accent}`}>{copy('Invitar a otro coach', 'Invite another coach')}</h3>
                <p className="text-xs text-neutral-400 font-mono mt-1">{copy('Comparte el registro de Genesis. Este enlace no asigna referidos ni genera comisiones automáticamente.', 'Share Genesis registration. This link does not automatically assign referrals or generate commissions.')}</p>
              </div>
              <button onClick={copyRegistrationLink} disabled={copying} className={`px-4 py-3 rounded-xl font-bold text-[10px] uppercase flex items-center gap-2 border ${activeTheme.border} hover:bg-white/10 transition-colors`}>
                {copying ? <Loader2 size={14} className="animate-spin"/> : <Copy size={14} />} {copy('Copiar enlace', 'Copy link')}
              </button>
            </div>

            <input aria-label={copy('Enlace de registro para coaches', 'Coach registration link')} readOnly value={coachRegistrationLink(window.location.origin)} onFocus={(event) => event.target.select()} className={`w-full rounded-xl border ${activeTheme.border} bg-transparent p-3 text-xs font-mono`} />
            <div className="space-y-3 mt-6">
              {referredCoaches.length === 0 ? (
                <p className="text-xs text-neutral-500 font-mono text-center py-8">{copy('Aún no hay coaches referidos.', 'No referred coaches yet.')}</p>
              ) : (
                referredCoaches.map((refCoach) => (
                  <div key={refCoach.id} className={`p-4 rounded-2xl bg-black/5 border ${activeTheme.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <Layers className={activeTheme.accent} size={18} />
                      <div>
                        <h4 className="text-sm font-bold">{refCoach.full_name}</h4>
                        <p className="text-[10px] text-neutral-500 font-mono">{copy('Atletas Activos:', 'Active Athletes:')} {refCoach.active_clients_count || 0}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-3 py-1 rounded-full border ${activeTheme.border} ${activeTheme.accent}`}>
                      {refCoach.b2b_plan}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'COMM' && (
          <div className={`${activeTheme.card} border ${activeTheme.border} p-6 sm:p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl`}>
            <div className="flex items-center gap-4">
              <div className={`rounded-2xl p-3 border ${activeTheme.border}`}><MessageSquare size={24} className={activeTheme.accent}/></div>
              <div>
                <h2 className="text-xl font-bold">{copy('Tu centro de mensajes', 'Your message center')}</h2>
                <p className="text-sm opacity-65 mt-1">{copy('Comunícate con los atletas vinculados a tu cuenta.', 'Stay in touch with the athletes linked to your account.')}</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className={`rounded-2xl border ${activeTheme.border} p-5`}>
                <MessageSquare size={20} className={activeTheme.accent}/>
                <h3 className="font-bold mt-3">{copy('Mensajería privada', 'Private messaging')}</h3>
                <p className="text-sm opacity-65 mt-2">{copy('Conversaciones directas con tus atletas desde el directorio.', 'Direct conversations with your athletes from the directory.')}</p>
              </div>
              <div className={`rounded-2xl border ${activeTheme.border} p-5`}>
                <Users size={20} className={activeTheme.accent}/>
                <h3 className="font-bold mt-3">{copy('Canales de comunidad', 'Community channels')}</h3>
                <p className="text-sm opacity-65 mt-2">{isElite ? copy('Tu plan Élite incluye el muro global y la sala de coaches.', 'Your Elite plan includes the global wall and coaches room.') : copy('El muro global y la sala de coaches están incluidos en el plan Élite.', 'The global wall and coaches room are included in the Elite plan.')}</p>
              </div>
            </div>
            <button type="button" onClick={() => navigate('/chat')} className="inline-flex items-center gap-2 bg-white text-black rounded-xl px-5 py-3 text-sm font-bold"><MessageSquare size={16}/>{copy('Abrir mensajería', 'Open messages')}</button>
          </div>
        )}

        {/* 5. PESTAÑA: GESTIÓN DE LICENCIA (TU CÓDIGO INTACTO) */}
        {activeTab === 'LICENSE' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 sm:p-8 rounded-3xl space-y-6 shadow-xl`}>
            <div className="flex items-center justify-between border-b border-neutral-800/50 pb-6">
              <div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-xl bg-black/5 flex items-center justify-center border ${activeTheme.border}`}><CreditCard className={activeTheme.accent} size={24}/></div><div><h2 className="text-xl font-black uppercase tracking-tight">{copy('Licencia & Facturación', 'License & Billing')}</h2><p className="text-[11px] font-mono opacity-60 mt-1">{copy('Solicita modificaciones de tu plan B2B.', 'Request changes to your B2B plan.')}</p></div></div>
              <span className={`text-[10px] bg-black/5 border ${activeTheme.border} px-4 py-2 rounded-full ${activeTheme.accent} font-black uppercase tracking-widest`}>Plan: {coach?.b2b_plan}</span>
            </div>
            <form onSubmit={handleSendAdminRequest} >
              <fieldset disabled={busy} className="space-y-6 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">{copy('Acción Solicitada', 'Requested Action')}</label><select aria-label={copy('Acción solicitada', 'Requested action')} value={requestType} onChange={(e) => setRequestType(e.target.value)} className={`w-full bg-black/5 border ${activeTheme.border} rounded-xl p-4 text-xs font-mono outline-none`}><option value="UPGRADE" className="text-black">{copy('Solicitar Upgrade de Plan', 'Request Plan Upgrade')}</option><option value="DOWNGRADE" className="text-black">{copy('Solicitar Downgrade', 'Request Downgrade')}</option><option value="PAUSE" className="text-black">{copy('Solicitar Pausa de Licencia', 'Request License Pause')}</option></select></div>
                <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">{copy('Plan Objetivo', 'Target Plan')}</label><select aria-label={copy('Plan objetivo', 'Target plan')} value={requestedPlan} onChange={(e) => setRequestedPlan(e.target.value)} className={`w-full bg-black/5 border ${activeTheme.border} rounded-xl p-4 text-xs font-mono outline-none`}><option value="IGNICION" className="text-black">{copy('Plan Ignición (Base)', 'Ignition Plan (Base)')}</option><option value="EVOLUCION" className="text-black">{copy('Plan Evolución (Pro)', 'Evolution Plan (Pro)')}</option><option value="ELITE" className="text-black">{copy('Plan Élite (VIP)', 'Elite Plan (VIP)')}</option></select></div>
              </div>
              <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">{copy('Nota para el Administrador', 'Note for Administrator')}</label><textarea aria-label={copy('Nota para el administrador', 'Note for administrator')} maxLength={1000} placeholder={copy('Explica tu caso...', 'Explain your request...')} value={requestNote} onChange={(e) => setRequestNote(e.target.value)} className={`w-full bg-black/5 border ${activeTheme.border} rounded-xl p-4 text-xs font-mono outline-none h-24 resize-none`}/></div>
              <button type="submit" disabled={busy} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white font-black uppercase text-[11px] tracking-widest px-8 py-4 rounded-xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">{sendingReq ? <Loader2 size={16} className="animate-spin"/> : <><Send size={16}/> {copy('Enviar Petición Formal', 'Submit Formal Request')}</>}</button>
            </fieldset>
            </form>
          </div>
        )}

        </GenesisTabs>
      </main>
    </div>
  );
}

