import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, User, Lock, Shield, Send, Eye, 
  CheckCircle2, Loader2, Building2, Upload, Palette, AtSign, CreditCard,
  Users, GitMerge, MessageSquare, Layers, Copy
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
  const { theme, updateTheme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [immersionLoading, setImmersiveLoading] = useState(false);
  
  const [coach, setCoach] = useState(null);
  const [globalSettings, setGlobalSettings] = useState(null);
  
  // NUEVOS ESTADOS B2B
  const [athletes, setAthletes] = useState([]);
  const [referredCoaches, setReferredCoaches] = useState([]);
  
  const [activeTab, setActiveTab] = useState('BRANDING'); 
  const [activeTheme, setActiveTheme] = useState(COACH_THEMES[0]);

  // Estados Formulario
  const [fullName, setFullName] = useState('');
  const [themeId, setThemeId] = useState('dark');
  const [watermarkOpacity, setWatermarkOpacity] = useState(15);
  const [watermarkSize, setWatermarkSize] = useState(50);
  const [instagramHandle, setInstagramHandle] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [commMode, setCommMode] = useState('BOTH');

  // Estados Request Admin
  const [requestType, setRequestType] = useState('UPGRADE');
  const [requestedPlan, setRequestedPlan] = useState('ELITE');
  const [requestNote, setRequestNote] = useState('');
  const [sendingReq, setSendingReq] = useState(false);

  useEffect(() => {
    fetchCoachData();
  }, []);

  const fetchCoachData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      // 1. Datos del Coach
      const { data, error } = await supabase.from('coaches_profile').select('*').eq('user_id', session.user.id).single();
      if (error) throw error;
      
      setCoach(data);
      setFullName(data.full_name || '');
      setThemeId(data.theme_id || 'dark');
      setWatermarkOpacity(data.watermark_opacity || 15);
      setWatermarkSize(data.watermark_size || 50);
      setInstagramHandle(data.instagram_handle || '');
      setCommMode(data.communication_mode || 'BOTH');

      const t = COACH_THEMES.find(th => th.id === (data.theme_id || 'dark')) || COACH_THEMES[0];
      setActiveTheme(t);

      // 2. Settings Globales
      const { data: globals } = await supabase.from('super_admin_settings').select('*').eq('id', 1).maybeSingle();
      if (globals) setGlobalSettings(globals);

      // 3. Cargar Atletas (Roster)
      const { data: athletesList } = await supabase
        .from('athletes_profile')
        .select('id, full_name, b2c_plan, created_at')
        .eq('coach_id', data.id)
        .order('created_at', { ascending: true });
      setAthletes(athletesList || []);

      // 4. Cargar Referidos (Multinivel)
      const { data: referredList } = await supabase
        .from('coaches_profile')
        .select('id, full_name, b2b_plan, active_clients_count, created_at')
        .eq('referred_by_coach_id', data.id)
        .order('created_at', { ascending: true });
      setReferredCoaches(referredList || []);

    } catch (err) {
      console.error("Error cargando ajustes:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBrand = async (e) => {
    e.preventDefault();
    if (coach?.b2b_plan !== 'ELITE') return alert("❌ Necesitas el Plan Élite para personalizar tu propia marca.");

    try {
      setSaving(true);
      let logoUrl = coach.brand_logo_url;

      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const filePath = `logos/${coach.id}_${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('athlete_evidence').upload(filePath, logoFile);
        if (!uploadErr) {
          const { data } = supabase.storage.from('athlete_evidence').getPublicUrl(filePath);
          logoUrl = data.publicUrl;
        }
      }

      const { error } = await supabase.from('coaches_profile').update({
        full_name: fullName, 
        theme_id: themeId, 
        brand_logo_url: logoUrl, 
        watermark_opacity: watermarkOpacity, 
        watermark_size: watermarkSize, 
        instagram_handle: instagramHandle,
        communication_mode: commMode
      }).eq('id', coach.id);

      if (error) throw error;
      
      const t = COACH_THEMES.find(th => th.id === themeId) || COACH_THEMES[0];
      setActiveTheme(t);
      setCoach({...coach, brand_logo_url: logoUrl});
      
      alert("✅ Identidad Élite guardada. Tu app y la de tus atletas han sido actualizadas.");
    } catch (err) { alert("❌ Error al guardar: " + err.message); } finally { setSaving(false); }
  };

  const handleSendAdminRequest = async (e) => {
    e.preventDefault();
    try {
      setSendingReq(true);
      const { error } = await supabase.from('admin_requests').insert({
        coach_id: coach.id, request_type: requestType, requested_plan: requestedPlan, note: requestNote, status: 'PENDING'
      });
      if (error) throw error;
      alert("📩 Solicitud enviada al Súper Admin. Revisa tu estado pronto.");
      setRequestNote('');
    } catch (err) { alert("❌ Error enviando solicitud."); } finally { setSendingReq(false); }
  };

  const handleImmersiveMode = async () => {
    try {
      setImmersiveLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data: avatar } = await supabase.from('athletes_profile').select('id').eq('user_id', session.user.id).maybeSingle();
      
      if (!avatar) {
        await supabase.from('athletes_profile').insert({
          user_id: session.user.id,
          coach_id: coach.id,
          full_name: `${coach.full_name} (Modo Prueba)`,
          b2c_plan: 'ELITE',
          age: 30, weight: 75, height: 175, gender: 'Masculino', goal: 'Prueba de Sistema',
          is_onboarded: true,
          program_start_date: new Date().toISOString() 
        });
      }
      navigate('/client');
    } catch (err) {
      alert("Error al iniciar Modo Inmersivo.");
    } finally {
      setImmersiveLoading(false);
    }
  };

  const copyReferralLink = () => {
    const code = coach?.coach_code || coach?.id?.substring(0, 8);
    const link = `${window.location.origin}/register/coach?ref=${code}`;
    navigator.clipboard.writeText(link);
    alert("📋 ¡Enlace de referido B2B copiado al portapapeles!");
  };

  if (loading) return <div className={`min-h-screen ${activeTheme.bg} flex items-center justify-center`}><Loader2 className={`animate-spin ${activeTheme.accent}`} size={40}/></div>;
  const isElite = coach?.b2b_plan === 'ELITE';

  return (
    <div className={`min-h-screen ${activeTheme.bg} ${activeTheme.text} font-sans pb-24 relative overflow-hidden transition-colors duration-500`}>
      
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
            <button onClick={() => navigate('/coach')} className="text-neutral-500 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
            <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Building2 size={16} className={activeTheme.accent}/> Ajustes de Licencia
            </h1>
          </div>
          {isElite && (
            <button onClick={handleImmersiveMode} disabled={immersionLoading} className={`bg-neutral-900 border ${activeTheme.border} px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${activeTheme.accent} hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50`}>
              {immersionLoading ? <Loader2 size={12} className="animate-spin"/> : <Eye size={12}/>} Modo Inmersivo
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8 relative z-10">
        
        {/* TABS EXPANDIDOS */}
        <div className="flex gap-2 border-b border-neutral-800 pb-4 overflow-x-auto scrollbar-hide">
          {[
            { id: 'BRANDING', label: 'Identidad Visual' },
            { id: 'ROSTER', label: 'Mi Roster' },
            { id: 'MULTILEVEL', label: 'Red B2B' },
            { id: 'COMM', label: 'Comunicaciones' },
            { id: 'LICENSE', label: 'Gestión B2B' }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? `${activeTheme.card} border ${activeTheme.border} ${activeTheme.accent} shadow-lg` : 'text-neutral-500 hover:text-white'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 1. PESTAÑA: MARCA BLANCA (TU CÓDIGO INTACTO) */}
        {activeTab === 'BRANDING' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-8 rounded-3xl space-y-6 relative overflow-hidden ${!isElite ? 'grayscale opacity-70' : ''} shadow-xl`}>
            {!isElite && (
              <div className="absolute inset-0 bg-black/60 z-20 flex flex-col items-center justify-center backdrop-blur-[2px]">
                <Lock size={32} className="text-neutral-400 mb-3" />
                <h3 className="font-black uppercase tracking-widest text-sm text-white">Funcionalidad Élite Requerida</h3>
                <p className="text-[10px] text-neutral-400 font-mono mt-1 text-center max-w-xs">Sube de plan para quitar la marca de Genesis OS, elegir tus propios colores y establecer tu marca de agua.</p>
              </div>
            )}
            <div className="flex items-center gap-4 border-b border-neutral-800/50 pb-6">
              <div className={`w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center border ${activeTheme.border}`}><Palette className={activeTheme.accent} size={24}/></div>
              <div><h2 className="text-xl font-black uppercase tracking-tight">Personalización de Marca</h2><p className="text-[11px] font-mono opacity-60 mt-1">Estos ajustes se reflejarán en tu panel y en la app de todos tus atletas.</p></div>
            </div>
            
            <form onSubmit={handleSaveBrand} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">Nombre Comercial</label><input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={`w-full bg-black/50 border ${activeTheme.border} rounded-xl p-3 text-xs font-mono outline-none focus:border-white transition-colors`}/></div>
                <div>
                  <label className="text-[10px] font-black uppercase opacity-60 block mb-2">Tema y Paleta de Colores</label>
                  <select value={themeId} onChange={(e) => setThemeId(e.target.value)} className={`w-full bg-black/50 border ${activeTheme.border} rounded-xl p-3 text-xs font-mono font-bold uppercase outline-none focus:border-white transition-colors`}>
                    {COACH_THEMES.map(t => <option key={t.id} value={t.id} className="text-black">{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase opacity-60 block mb-3">Logo Empresarial (Marca de Agua)</label>
                <div className="flex items-center gap-6">
                  <div className={`w-32 h-32 border-2 border-dashed ${activeTheme.border} rounded-2xl flex items-center justify-center bg-black/30 overflow-hidden relative group hover:border-white transition-colors`}>
                    {coach?.brand_logo_url ? <img src={coach?.brand_logo_url} alt="Logo" className="w-full h-full object-contain p-2 opacity-50"/> : <Upload size={24} className="opacity-50"/>}
                    <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                  </div>
                  <p className="text-xs font-mono opacity-50 max-w-xs">Sube una imagen PNG con transparencia para inyectarla en el fondo del ecosistema.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/30 border border-neutral-800 rounded-2xl p-5"><label className="text-[10px] font-black uppercase opacity-60 flex justify-between mb-3"><span>Opacidad</span> <span className={activeTheme.accent}>{watermarkOpacity}%</span></label><input type="range" min="1" max="100" value={watermarkOpacity} onChange={(e) => setWatermarkOpacity(e.target.value)} className="w-full accent-white"/></div>
                <div className="bg-black/30 border border-neutral-800 rounded-2xl p-5"><label className="text-[10px] font-black uppercase opacity-60 flex justify-between mb-3"><span>Tamaño</span> <span className={activeTheme.accent}>{watermarkSize}%</span></label><input type="range" min="10" max="150" value={watermarkSize} onChange={(e) => setWatermarkSize(e.target.value)} className="w-full accent-white"/></div>
              </div>
              <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">Firma Digital (Usuario de Instagram)</label><div className="relative"><AtSign className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={18}/><input type="text" value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@TuUsuario" className={`w-full bg-black/50 border ${activeTheme.border} rounded-2xl pl-12 pr-4 py-4 text-sm font-mono outline-none focus:border-white transition-colors`}/></div></div>
              
              <div className="pt-4 border-t border-neutral-800/50">
                <button type="submit" disabled={saving || !isElite} className="bg-white hover:bg-neutral-200 text-black font-black uppercase text-[11px] tracking-widest px-8 py-4 rounded-xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={16} className="animate-spin"/> : <><CheckCircle2 size={16}/> Guardar e Inyectar Identidad</>}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. PESTAÑA: ORGANIZACIÓN ROSTER (NUEVO) */}
        {activeTab === 'ROSTER' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-8 rounded-3xl space-y-6 shadow-xl`}>
            <div className="flex justify-between items-center border-b border-neutral-800/50 pb-6">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                <Users size={20} className={activeTheme.accent} /> Pirámide de Atletas
              </h2>
              <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${activeTheme.border} ${activeTheme.accent}`}>
                Total: {athletes.length}
              </span>
            </div>

            <div className="space-y-3">
              {athletes.length === 0 ? (
                <p className="text-xs text-neutral-500 font-mono text-center py-8">No tienes atletas vinculados todavía.</p>
              ) : (
                athletes.map((ath, index) => (
                  <div key={ath.id} className={`p-4 rounded-2xl bg-black/40 border ${activeTheme.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border ${activeTheme.border} ${activeTheme.accent}`}>
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{ath.full_name || 'Sin Nombre'}</h4>
                        <p className="text-[10px] text-neutral-500 font-mono">Ingreso: {new Date(ath.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black uppercase px-3 py-1 rounded-full bg-neutral-900 border border-neutral-700">
                      Plan {ath.b2c_plan}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* 3. PESTAÑA: RED MULTINIVEL (NUEVO) */}
        {activeTab === 'MULTILEVEL' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-8 rounded-3xl space-y-6 shadow-xl`}>
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 mb-2">
              <GitMerge size={20} className={activeTheme.accent} /> Red de Entrenadores Referidos
            </h2>
            
            <div className={`p-6 border ${activeTheme.border} bg-black/40 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4`}>
              <div>
                <h3 className={`text-sm font-bold uppercase ${activeTheme.accent}`}>Tu Enlace B2B</h3>
                <p className="text-xs text-neutral-400 font-mono mt-1">Gana incentivos recomendando la plataforma a otros coaches.</p>
              </div>
              <button onClick={copyReferralLink} className={`px-4 py-3 rounded-xl font-bold text-[10px] uppercase flex items-center gap-2 border ${activeTheme.border} hover:bg-white/10 transition-colors`}>
                <Copy size={14} /> Copiar Enlace
              </button>
            </div>

            <div className="space-y-3 mt-6">
              {referredCoaches.length === 0 ? (
                <p className="text-xs text-neutral-500 font-mono text-center py-8">Tu red está vacía. Invita a colegas para construir tu tribu B2B.</p>
              ) : (
                referredCoaches.map((refCoach) => (
                  <div key={refCoach.id} className={`p-4 rounded-2xl bg-black/40 border ${activeTheme.border} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <Layers className={activeTheme.accent} size={18} />
                      <div>
                        <h4 className="text-sm font-bold text-white">{refCoach.full_name}</h4>
                        <p className="text-[10px] text-neutral-500 font-mono">Atletas Activos: {refCoach.active_clients_count || 0}</p>
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

        {/* 4. PESTAÑA: COMUNICACIONES (NUEVO) */}
        {activeTab === 'COMM' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-8 rounded-3xl space-y-6 shadow-xl`}>
            <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 mb-4">
              <MessageSquare size={20} className={activeTheme.accent} /> Ajustes de Comunicación
            </h2>
            
            <div className="grid grid-cols-1 gap-4">
              {[
                { id: 'BOTH', title: 'Chat Dual (Recomendado)', desc: 'Muro de Comunidad + Mensajes Privados 1-a-1 habilitados.' },
                { id: 'INDIVIDUAL', title: 'Solo Mensajería Privada', desc: 'Desactiva el muro comunitario. Los atletas solo hablan contigo.' },
                { id: 'GROUP', title: 'Solo Muro Grupal de Tribu', desc: 'Desactiva los mensajes directos para centralizar dudas en el muro.' },
              ].map((mode) => (
                <div 
                  key={mode.id}
                  onClick={() => { setCommMode(mode.id); handleSaveBrand(new Event('submit')); }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    commMode === mode.id ? `border-white bg-white/5` : `border-neutral-800 bg-black/30 hover:border-neutral-600`
                  }`}
                >
                  <div>
                    <h4 className="text-sm font-bold text-white">{mode.title}</h4>
                    <p className="text-[10px] text-neutral-500 font-mono mt-1">{mode.desc}</p>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${commMode === mode.id ? 'border-white bg-white' : 'border-neutral-700'}`}>
                    {commMode === mode.id && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. PESTAÑA: GESTIÓN DE LICENCIA (TU CÓDIGO INTACTO) */}
        {activeTab === 'LICENSE' && (
          <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-8 rounded-3xl space-y-6 shadow-xl`}>
            <div className="flex items-center justify-between border-b border-neutral-800/50 pb-6">
              <div className="flex items-center gap-4"><div className={`w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center border ${activeTheme.border}`}><CreditCard className={activeTheme.accent} size={24}/></div><div><h2 className="text-xl font-black uppercase tracking-tight">Licencia & Facturación</h2><p className="text-[11px] font-mono opacity-60 mt-1">Solicita modificaciones de tu plan B2B.</p></div></div>
              <span className={`text-[10px] bg-black/50 border ${activeTheme.border} px-4 py-2 rounded-full ${activeTheme.accent} font-black uppercase tracking-widest`}>Plan: {coach?.b2b_plan}</span>
            </div>
            <form onSubmit={handleSendAdminRequest} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">Acción Solicitada</label><select value={requestType} onChange={(e) => setRequestType(e.target.value)} className={`w-full bg-black/50 border ${activeTheme.border} rounded-xl p-4 text-xs font-mono outline-none`}><option value="UPGRADE" className="text-black">Solicitar Upgrade de Plan</option><option value="DOWNGRADE" className="text-black">Solicitar Downgrade</option><option value="PAUSE" className="text-black">Solicitar Pausa de Licencia</option></select></div>
                <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">Plan Objetivo</label><select value={requestedPlan} onChange={(e) => setRequestedPlan(e.target.value)} className={`w-full bg-black/50 border ${activeTheme.border} rounded-xl p-4 text-xs font-mono outline-none`}><option value="IGNICION" className="text-black">Plan Ignición (Base)</option><option value="EVOLUCION" className="text-black">Plan Evolución (Pro)</option><option value="ELITE" className="text-black">Plan Élite (VIP)</option></select></div>
              </div>
              <div><label className="text-[10px] font-black uppercase opacity-60 block mb-2">Nota para el Administrador</label><textarea placeholder="Explica tu caso..." value={requestNote} onChange={(e) => setRequestNote(e.target.value)} className={`w-full bg-black/50 border ${activeTheme.border} rounded-xl p-4 text-xs font-mono outline-none h-24 resize-none`}/></div>
              <button type="submit" disabled={sendingReq} className="bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-white font-black uppercase text-[11px] tracking-widest px-8 py-4 rounded-xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">{sendingReq ? <Loader2 size={16} className="animate-spin"/> : <><Send size={16}/> Enviar Petición Formal</>}</button>
            </form>
          </div>
        )}

      </main>
    </div>
  );
}