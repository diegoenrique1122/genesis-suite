import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Users, ShieldAlert, TrendingUp, Radio, CheckCircle2, XCircle, 
  Trash2, PauseCircle, PlayCircle, Loader2, LogOut, ShieldCheck, 
  Eye, Palette, Clock, UserCheck, Activity, RefreshCcw, Settings, 
  Upload, AtSign, MessageCircle, X, Send, LayoutDashboard, Globe, Copy, Check, Edit3, Save, Dumbbell, Utensils, Droplets
} from 'lucide-react';

const ADMIN_THEMES = [
  { id: 'dark', name: 'Dark Genesis', bg: 'bg-[#0a0a0a]', card: 'bg-[#111111]', border: 'border-neutral-800', text: 'text-white', accent: 'text-amber-500' },
  { id: 'midnight', name: 'Midnight Blue', bg: 'bg-[#050B14]', card: 'bg-[#0A192F]', border: 'border-blue-900/50', text: 'text-blue-50', accent: 'text-blue-400' },
  { id: 'crimson', name: 'Crimson Force', bg: 'bg-[#1a0505]', card: 'bg-[#2a0808]', border: 'border-red-900/50', text: 'text-red-50', accent: 'text-red-500' },
  { id: 'cyberpunk', name: 'Cyberpunk Neon', bg: 'bg-[#0d0221]', card: 'bg-[#1a053a]', border: 'border-purple-500/30', text: 'text-pink-50', accent: 'text-cyan-400' },
  { id: 'emerald', name: 'Emerald Eco', bg: 'bg-[#021810]', card: 'bg-[#042f1f]', border: 'border-emerald-900/50', text: 'text-emerald-50', accent: 'text-emerald-400' },
  { id: 'light', name: 'Clean Light', bg: 'bg-neutral-50', card: 'bg-white', border: 'border-neutral-200', text: 'text-neutral-900', accent: 'text-blue-600' }
];

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  
  // PESTAÑAS MAESTRAS
  const [activeTab, setActiveTab] = useState('DASHBOARD');

  const [activeTheme, setActiveTheme] = useState(() => {
    const saved = localStorage.getItem('genesis_admin_theme');
    return ADMIN_THEMES.find(t => t.id === saved) || ADMIN_THEMES[0];
  });
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  const [stats, setStats] = useState({ totalCoaches: 0, totalAthletes: 0, pendingCoaches: 0, pendingRequests: 0 });
  const [pendingCoaches, setPendingCoaches] = useState([]);
  const [activeCoaches, setActiveCoaches] = useState([]);
  const [requests, setRequests] = useState([]);
  
  const [globalSettings, setGlobalSettings] = useState({ watermark_url: '', instagram_handle: '@GenesisTech', watermark_opacity: 10, watermark_size: 50 });
  const [watermarkFile, setWatermarkFile] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // Estados Edición Códigos
  const [copiedCode, setCopiedCode] = useState(null);
  const [editingCoachId, setEditingCoachId] = useState(null);
  const [editCodes, setEditCodes] = useState({ ign: '', evo: '', pro: '' });

  // --- ESTADOS CHAT FLOTANTE 1-a-1 ---
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedCoachChat, setSelectedCoachChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newChatMessage, setNewChatMessage] = useState('');
  const chatEndRef = useRef(null);
  const [chatSubscription, setChatSubscription] = useState(null);

  useEffect(() => {
    loadSuperAdminData();
    return () => {
      if (chatSubscription) supabase.removeChannel(chatSubscription);
    }
  }, []);

  const changeTheme = (themeConfig) => {
    setActiveTheme(themeConfig);
    localStorage.setItem('genesis_admin_theme', themeConfig.id);
  };

  const loadSuperAdminData = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');
      setCurrentUser(session.user);

      const { data: setts } = await supabase.from('super_admin_settings').select('*').eq('id', 1).maybeSingle();
      if (setts) setGlobalSettings(setts);

      const { data: coachesData } = await supabase.from('coaches_profile').select('*').order('created_at', { ascending: false });
      const { data: masterUsers } = await supabase.from('users_master').select('*');
      const { data: allAthletes } = await supabase.from('athletes_profile').select('*');
      
      const masterMap = {};
      masterUsers?.forEach(u => { masterMap[u.id] = u; });

      const fullCoaches = (coachesData || []).map(c => {
        const masterObj = masterMap[c.user_id] || masterMap[c.id];
        const myAthletes = (allAthletes || []).filter(a => a.coach_id === c.id);
        const ignicionCount = myAthletes.filter(a => a.b2c_plan === 'IGNICION').length;
        const evolucionCount = myAthletes.filter(a => a.b2c_plan === 'EVOLUCION').length;
        const eliteCount = myAthletes.filter(a => a.b2c_plan === 'ELITE').length;

        return {
          ...c,
          full_name: c.full_name || 'Coach Sin Nombre',
          account_status: masterObj?.account_status || 'PENDING',
          email: masterObj?.email || c.email || 'N/A',
          total_athletes: myAthletes.length,
          stats_ignicion: ignicionCount,
          stats_evolucion: evolucionCount,
          stats_elite: eliteCount
        };
      });

      const pendingList = fullCoaches.filter(c => c.account_status === 'PENDING');
      const activeList = fullCoaches.filter(c => c.account_status !== 'PENDING');

      setPendingCoaches(pendingList);
      setActiveCoaches(activeList);

      const { count: athletesCount } = await supabase.from('athletes_profile').select('*', { count: 'exact', head: true });
      const { data: rawRequests } = await supabase.from('admin_requests').select('*').eq('status', 'PENDING').order('created_at', { ascending: false });
      const mappedRequests = (rawRequests || []).map(req => {
        const coach = fullCoaches.find(c => c.id === req.coach_id || c.user_id === req.coach_id);
        return { ...req, coach_data: coach }; 
      });
      setRequests(mappedRequests);

      setStats({ totalCoaches: activeList.length, totalAthletes: athletesCount || 0, pendingCoaches: pendingList.length, pendingRequests: mappedRequests.length });
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  };

  const handleApproveCoach = async (coach) => {
    try {
      const targetUserId = coach.user_id || coach.id;
      const baseNum = Math.floor(100000 + Math.random() * 900000);
      await supabase.from('users_master').update({ account_status: 'ACTIVE' }).eq('id', targetUserId);
      await supabase.from('coaches_profile').upsert({ user_id: targetUserId, full_name: coach.full_name, invite_code_ignicion: `IGN-${baseNum}`, invite_code_evolucion: `EVO-${baseNum}`, invite_code_elite: `PRO-${baseNum}` }, { onConflict: 'user_id' });
      alert(`✅ Licencia Aprobada. Códigos generados exitosamente.`);
      loadSuperAdminData();
    } catch (err) { alert("❌ Error al aprobar."); }
  };

  const handleToggleCoachStatus = async (coachId, currentStatus) => {
    try {
      await supabase.from('users_master').update({ account_status: currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }).eq('id', coachId);
      loadSuperAdminData();
    } catch (err) { alert("Error."); }
  };

  const handleChangeCoachPlan = async (coachId, newPlan) => {
    try { await supabase.from('coaches_profile').update({ b2b_plan: newPlan }).eq('id', coachId); loadSuperAdminData(); } catch (err) { alert("Error."); }
  };

  const handleDeleteCoach = async (userId) => {
    if (!window.confirm(`⚠️ ¿Eliminar permanentemente la cuenta de este entrenador?`)) return;
    try { await supabase.from('users_master').delete().eq('id', userId); loadSuperAdminData(); } catch (err) { alert("Error."); }
  };

  const handleResolveRequest = async (requestId, coachId, requestedPlan, newStatus) => {
    try {
      await supabase.from('admin_requests').update({ status: newStatus }).eq('id', requestId);
      if (newStatus === 'APPROVED' && requestedPlan) {
        await supabase.from('coaches_profile').update({ b2b_plan: requestedPlan }).or(`id.eq.${coachId},user_id.eq.${coachId}`);
      }
      loadSuperAdminData();
    } catch (err) { alert("Error procesando solicitud."); }
  };

  const handleSaveCustomCodes = async (userId) => {
    try {
      await supabase.from('coaches_profile').upsert({ user_id: userId, invite_code_ignicion: editCodes.ign.toUpperCase(), invite_code_evolucion: editCodes.evo.toUpperCase(), invite_code_elite: editCodes.pro.toUpperCase() }, { onConflict: 'user_id' });
      alert("✅ Códigos actualizados correctamente."); setEditingCoachId(null); loadSuperAdminData();
    } catch (err) { alert("❌ Error guardando códigos."); }
  };

  const handleCopyCode = (code) => {
    if (!code) return; navigator.clipboard.writeText(code); setCopiedCode(code); setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSaveGlobalSettings = async (e) => {
    e.preventDefault();

    try {
      setSavingSettings(true);

      let finalUrl = globalSettings.watermark_url;

      if (watermarkFile) {
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/webp'
        ];

        if (!allowedMimeTypes.includes(watermarkFile.type)) {
          throw new Error(
            'La marca de agua debe ser JPG, PNG o WEBP.'
          );
        }

        if (watermarkFile.size > 5 * 1024 * 1024) {
          throw new Error(
            'La marca de agua no puede superar 5 MB.'
          );
        }

        const fileExt = (
          watermarkFile.name.split('.').pop() || 'png'
        )
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '');

        const filePath =
          `global/watermark_${Date.now()}.${fileExt}`;

        const { error: uploadErr } =
          await supabase.storage
            .from('genesis_brand_assets')
            .upload(
              filePath,
              watermarkFile,
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
            'Genesis no pudo generar la URL pública de la marca de agua.'
          );
        }

        finalUrl = data.publicUrl;
      }

      const { error: settingsError } =
        await supabase
          .from('super_admin_settings')
          .upsert({
            id: 1,
            watermark_url: finalUrl,
            instagram_handle:
              globalSettings.instagram_handle,
            watermark_opacity:
              globalSettings.watermark_opacity,
            watermark_size:
              globalSettings.watermark_size,
            updated_at: new Date().toISOString()
          });

      if (settingsError) {
        throw settingsError;
      }

      setWatermarkFile(null);

      alert(
        '✅ Configuración Global Guardada.'
      );

      await loadSuperAdminData();

    } catch (err) {
      console.error(
        'Genesis global branding error:',
        err
      );

      alert(
        `❌ Error guardando ajustes: ${err.message}`
      );

    } finally {
      setSavingSettings(false);
    }
  };
  // 🔥 LÓGICA DEL CHAT FLOTANTE RECONSTRUIDA PARA 1-A-1 🔥
  const openChatWithCoach = async (coach) => {
    setSelectedCoachChat(coach);
    setIsChatOpen(true);
    const targetUserId = coach.user_id || coach.id;
    
    const { data } = await supabase.from('chat_messages').select('*').eq('channel_type', 'PRIVATE')
      .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},recipient_id.eq.${currentUser.id})`)
      .order('created_at', { ascending: true });
    
    setChatMessages(data || []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    
    if (chatSubscription) supabase.removeChannel(chatSubscription);
    
    const sub = supabase.channel(`admin-private-${targetUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new;
        if (newMsg.channel_type === 'PRIVATE') {
          const isRelevant = (newMsg.sender_id === currentUser.id && newMsg.recipient_id === targetUserId) || 
                             (newMsg.sender_id === targetUserId && newMsg.recipient_id === currentUser.id);
          if (isRelevant) {
            setChatMessages((prev) => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        }
      }).subscribe();
    setChatSubscription(sub);
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!newChatMessage.trim() || !selectedCoachChat) return;
    try {
      const targetUserId = selectedCoachChat.user_id || selectedCoachChat.id;
      await supabase.from('chat_messages').insert({
        sender_id: currentUser.id,
        sender_name: 'Súper Admin (Soporte)',
        sender_role: 'SUPER_ADMIN',
        channel_type: 'PRIVATE',
        message: newChatMessage.trim(),
        recipient_id: targetUserId
      });
      setNewChatMessage('');
    } catch (err) { console.error("Error enviando mensaje:", err); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate('/'); };

  if (loading) return <div className={`min-h-screen ${activeTheme.bg} flex items-center justify-center`}><Loader2 className={`animate-spin ${activeTheme.accent}`} size={50} /></div>;

  return (
    <div className={`min-h-screen ${activeTheme.bg} ${activeTheme.text} font-sans pb-24 transition-colors duration-500 relative overflow-hidden`}>
      
      {/* MARCA DE AGUA */}
      {globalSettings.watermark_url && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-0" style={{ opacity: globalSettings.watermark_opacity / 100 }}>
          <img src={globalSettings.watermark_url} alt="Watermark" style={{ width: `${globalSettings.watermark_size}%`, objectFit: 'contain' }} className="blur-[1px] drop-shadow-2xl"/>
          {globalSettings.instagram_handle && (
            <div className="flex items-center gap-3 mt-6 text-4xl sm:text-6xl font-black tracking-widest text-white/40 drop-shadow-lg"><AtSign size={48} /> {globalSettings.instagram_handle.replace('@', '')}</div>
          )}
        </div>
      )}

      {/* NAVBAR */}
      <nav className={`${activeTheme.card} ${activeTheme.border} border-b sticky top-0 z-40 shadow-lg bg-opacity-80 backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-black/30 border ${activeTheme.border}`}><ShieldCheck size={28} className={activeTheme.accent} /></div>
            <div><h1 className="text-xl sm:text-2xl font-black uppercase tracking-widest leading-none">Genesis OS</h1><span className={`text-[10px] font-mono uppercase tracking-widest ${activeTheme.accent}`}>Súper Administrador</span></div>
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 sm:pb-0">
            {/* LAS 4 PESTAÑAS DEL SÚPER ADMIN */}
            <button onClick={() => setActiveTab('DASHBOARD')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${activeTab === 'DASHBOARD' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white bg-black/30 border border-transparent hover:border-neutral-700'}`}>
              <LayoutDashboard size={14}/> SaaS Global
            </button>
            <button onClick={() => setActiveTab('MY_ROSTER')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${activeTab === 'MY_ROSTER' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'text-neutral-500 hover:text-amber-500 bg-black/30 border border-transparent hover:border-amber-500/30'}`}>
              <Users size={14}/> Mi Roster VIP
            </button>
            <button onClick={() => setActiveTab('MY_APPS')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${activeTab === 'MY_APPS' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-neutral-500 hover:text-blue-400 bg-black/30 border border-transparent hover:border-blue-500/30'}`}>
              <Dumbbell size={14}/> Mis Apps
            </button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all flex items-center gap-2 ${activeTab === 'SETTINGS' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white bg-black/30 border border-transparent hover:border-neutral-700'}`}>
              <Settings size={14}/> Ajustes
            </button>
            
            <div className="w-px h-6 bg-neutral-800 mx-2 hidden sm:block"></div>
            
            {/* BOTÓN GOD MODE CHAT */}
            <button onClick={() => navigate('/chat')} className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border ${activeTheme.border} hover:bg-blue-500/20 text-blue-500 transition-colors`}>
              <Globe size={16}/> Red Global
            </button>
            
            <button onClick={() => setShowThemeSelector(!showThemeSelector)} className={`p-2 rounded-xl border ${activeTheme.border} hover:bg-black/10 transition-colors`}><Palette size={18}/></button>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-400 transition-colors p-2"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      {/* SELECTOR DE TEMAS OCULTO */}
      {showThemeSelector && (
        <div className={`${activeTheme.card} border-b ${activeTheme.border} px-6 py-4 shadow-xl flex gap-3 overflow-x-auto scrollbar-hide relative z-30`}>
          {ADMIN_THEMES.map(t => (
            <button key={t.id} onClick={() => changeTheme(t)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${activeTheme.id === t.id ? `${t.bg} ${t.text} border-transparent shadow-lg scale-105` : `${activeTheme.card} ${activeTheme.border}`}`}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10 relative z-10">

        {/* ======================================================== */}
        {/* =================== TAB: DASHBOARD ===================== */}
        {/* ======================================================== */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI GLOBALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 rounded-3xl shadow-xl`}><p className="text-[11px] font-black uppercase tracking-widest opacity-60">Coaches Activos</p><h2 className="text-4xl font-black font-mono mt-2">{stats.totalCoaches}</h2></div>
              <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 rounded-3xl shadow-xl`}><p className="text-[11px] font-black uppercase tracking-widest opacity-60">Total Atletas</p><h2 className="text-4xl font-black font-mono text-blue-400 mt-2">{stats.totalAthletes}</h2></div>
              <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 rounded-3xl shadow-xl`}><p className="text-[11px] font-black uppercase tracking-widest opacity-60">Coaches Pendientes</p><h2 className="text-4xl font-black font-mono text-amber-500 mt-2">{stats.pendingCoaches}</h2></div>
              <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 rounded-3xl shadow-xl`}><p className="text-[11px] font-black uppercase tracking-widest opacity-60">Peticiones Licencia</p><h2 className="text-4xl font-black font-mono text-purple-400 mt-2">{stats.pendingRequests}</h2></div>
            </div>

            {/* PETICIONES DE CAMBIO DE PLAN */}
            {requests.length > 0 && (
              <div className={`bg-gradient-to-r from-amber-500/10 to-transparent border border-amber-500/30 p-8 rounded-3xl shadow-2xl backdrop-blur-lg`}>
                <h2 className="text-sm font-black uppercase tracking-widest text-amber-500 flex items-center gap-2 mb-6"><ShieldAlert size={20}/> Peticiones de Modificación B2B</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {requests.map((r) => (
                    <div key={r.id} className={`${activeTheme.card} bg-opacity-80 border ${activeTheme.border} p-5 rounded-2xl`}>
                      <h3 className="font-bold text-base">{r.coach_data?.full_name || 'Desconocido'}</h3>
                      <p className="text-[10px] opacity-60 font-mono mb-3">ID: {r.coach_data?.coach_code || '---'}</p>
                      <p className="text-xs font-mono mb-4">Solicita: <strong className="text-amber-500 uppercase bg-amber-500/10 px-2 py-1 rounded">{r.request_type} {r.requested_plan}</strong></p>
                      <div className="flex gap-2 w-full">
                        <button onClick={() => handleResolveRequest(r.id, r.coach_id, r.requested_plan, 'REJECTED')} className="flex-1 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider">Rechazar</button>
                        <button onClick={() => handleResolveRequest(r.id, r.coach_id, r.requested_plan, 'APPROVED')} className="flex-1 py-2 rounded-xl bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors text-[10px] font-bold uppercase tracking-wider">Aprobar</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COACHES PENDIENTES */}
            {pendingCoaches.length > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/50 p-8 rounded-3xl shadow-[0_0_40px_rgba(245,158,11,0.15)] backdrop-blur-lg">
                <h2 className="text-sm font-black uppercase tracking-widest text-amber-500 flex items-center gap-2 mb-6"><UserCheck size={20}/> Licencias Pendientes de Aprobación</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingCoaches.map((c) => (
                    <div key={c.id} className={`${activeTheme.card} bg-opacity-80 border border-amber-500/30 p-5 rounded-2xl flex justify-between items-center`}>
                      <div><h3 className="font-bold text-base">{c.full_name}</h3><p className="text-[10px] opacity-60 font-mono">{c.email}</p></div>
                      <button onClick={() => handleApproveCoach(c)} className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[10px] tracking-wider transition-all shadow-lg">Aprobar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COACHES ACTIVOS (ROSTER GLOBAL) */}
            <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-8 rounded-3xl shadow-xl`}>
              <h2 className="text-sm font-black uppercase tracking-widest opacity-80 flex items-center gap-2 mb-6"><Users size={20}/> Ecosistema de Entrenadores Activos</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className={`border-b ${activeTheme.border} opacity-50 uppercase text-[10px] font-black tracking-widest`}>
                      <th className="pb-4 pl-2">Entrenador</th><th className="pb-4">Matriz Códigos B2C</th><th className="pb-4">Nivel B2B</th><th className="pb-4">Roster</th><th className="pb-4 text-center">Estado</th><th className="pb-4 text-right pr-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${activeTheme.border} divide-opacity-30`}>
                    {activeCoaches.map((c) => {
                      const codeIGN = c.invite_code_ignicion || (c.coach_code ? `IGN-${c.coach_code}` : 'N/A');
                      const codeEVO = c.invite_code_evolucion || (c.coach_code ? `EVO-${c.coach_code}` : 'N/A');
                      const codePRO = c.invite_code_elite || (c.coach_code ? `PRO-${c.coach_code}` : 'N/A');

                      return (
                        <tr key={c.id} className="hover:bg-white/5 transition-colors">
                          <td className="py-4 pl-2"><p className="font-bold uppercase text-sm">{c.full_name}</p><p className="text-[10px] opacity-50">{c.email}</p></td>
                          <td className="py-4 pr-4">
                            {editingCoachId === c.user_id ? (
                              <div className="flex flex-col gap-2 bg-black/50 p-3 rounded-xl border border-neutral-700">
                                <input value={editCodes.ign} onChange={e => setEditCodes({...editCodes, ign: e.target.value})} className="bg-black text-xs text-white p-2 border border-neutral-700 rounded" placeholder="IGN" />
                                <input value={editCodes.evo} onChange={e => setEditCodes({...editCodes, evo: e.target.value})} className="bg-black text-xs text-white p-2 border border-neutral-700 rounded" placeholder="EVO" />
                                <input value={editCodes.pro} onChange={e => setEditCodes({...editCodes, pro: e.target.value})} className="bg-black text-xs text-white p-2 border border-neutral-700 rounded" placeholder="PRO" />
                                <div className="flex gap-2 mt-1">
                                  <button onClick={() => handleSaveCustomCodes(c.user_id)} className="flex-1 bg-green-600 text-white font-black py-2 rounded">Guardar</button>
                                  <button onClick={() => setEditingCoachId(null)} className="flex-1 bg-neutral-800 text-white font-black py-2 rounded">Cerrar</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 text-[10px] font-mono">
                                <span className="text-neutral-300">IGN: {codeIGN}</span>
                                <span className="text-blue-300">EVO: {codeEVO}</span>
                                <span className="text-amber-400">PRO: {codePRO}</span>
                                <button onClick={() => { setEditingCoachId(c.user_id); setEditCodes({ ign: codeIGN, evo: codeEVO, pro: codePRO }); }} className="text-[9px] text-blue-500 mt-1 flex items-center gap-1"><Edit3 size={10}/> Editar</button>
                              </div>
                            )}
                          </td>
                          <td className="py-4"><span className={`font-bold ${activeTheme.accent}`}>{c.b2b_plan}</span></td>
                          <td className="py-4"><span className="font-bold">Total: {c.total_athletes}</span></td>
                          <td className="py-4 text-center"><span className={`px-2 py-1 rounded-full ${c.account_status === 'ACTIVE' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>{c.account_status}</span></td>
                          <td className="py-4 text-right pr-2 space-x-2">
                            <button onClick={() => openChatWithCoach(c)} className={`p-2.5 rounded-xl border ${activeTheme.border} hover:bg-blue-500/20 text-blue-500 transition-colors bg-black/30`} title="Chat Privado 1-a-1"><MessageCircle size={16}/></button>
                            <button onClick={() => handleToggleCoachStatus(c.user_id, c.account_status)} className={`p-2.5 rounded-xl border ${activeTheme.border} hover:bg-black/50 bg-black/30`}><PauseCircle size={16}/></button>
                            <button onClick={() => handleDeleteCoach(c.user_id)} className={`p-2.5 rounded-xl border ${activeTheme.border} hover:bg-red-500/20 hover:border-red-500/50 text-red-500 bg-black/30 transition-colors`}><Trash2 size={16}/></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* =================== TAB: MY ROSTER ===================== */}
        {/* ======================================================== */}
        {activeTab === 'MY_ROSTER' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#111] border border-amber-500/30 rounded-3xl p-8 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2 flex items-center gap-2">
                <ShieldCheck className="text-amber-500" /> Mi Despacho de Coach Élite
              </h2>
              <p className="text-xs text-neutral-400 font-mono mb-6 max-w-2xl">
                Como Súper Admin, posees el código <strong className="text-amber-500">CEO-PRO</strong>. Los atletas que se registren con este código aparecerán aquí para que los gestiones como un Coach Élite.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-black border border-neutral-800 p-5 rounded-2xl flex items-center justify-between z-10 relative">
                  <div>
                    <p className="text-[10px] font-black uppercase text-neutral-500">Mi Código Élite</p>
                    <p className="text-lg font-mono text-amber-500 font-bold">CEO-PRO</p>
                  </div>
                  <button onClick={() => handleCopyCode('CEO-PRO')} className="p-3 bg-neutral-900 rounded-xl hover:text-white transition-colors">{copiedCode === 'CEO-PRO' ? <Check size={18} className="text-green-500"/> : <Copy size={18}/>}</button>
                </div>
              </div>
            </div>

            <div className="bg-[#111] border border-neutral-800 rounded-3xl p-8 shadow-xl text-center py-20">
              <Users size={48} className="text-neutral-700 mx-auto mb-4" />
              <h3 className="text-lg font-black uppercase text-white mb-2">Tu Roster VIP está vacío</h3>
              <p className="text-xs font-mono text-neutral-500">Comparte tu código CEO-PRO. Tus atletas directos aparecerán aquí para que audites sus dietas y rutinas.</p>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* =================== TAB: MY APPS ======================= */}
        {/* ======================================================== */}
        {activeTab === 'MY_APPS' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-[#111] border border-blue-500/30 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_30px_rgba(37,99,235,0.1)]">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-2 flex items-center gap-2">
                <Dumbbell className="text-blue-500" /> Mi Ecosistema de Atleta
              </h2>
              <p className="text-xs text-neutral-400 font-mono mb-8 max-w-2xl relative z-10">
                Modo Inmersivo activado. Entrena, registra tu nutrición y evalúa la experiencia B2C del usuario final sin tener que crear una cuenta adicional.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
                <button onClick={() => navigate('/client/arquitecto')} className="bg-black border border-neutral-800 hover:border-blue-500/50 rounded-2xl p-6 text-left group transition-all">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors"><Utensils size={24}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">El Arquitecto</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-2">Laboratorio de macros, dieta y suplementación personal.</p>
                </button>
                <button onClick={() => navigate('/client/entrenamiento')} className="bg-black border border-neutral-800 hover:border-blue-500/50 rounded-2xl p-6 text-left group transition-all">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors"><Dumbbell size={24}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Trainer Pro</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-2">Tu rutina biomecánica adaptativa y registros de peso.</p>
                </button>
                <button onClick={() => navigate('/client/disciplina')} className="bg-black border border-neutral-800 hover:border-blue-500/50 rounded-2xl p-6 text-left group transition-all">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 group-hover:bg-blue-500/10 group-hover:text-blue-500 transition-colors"><Activity size={24}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Monitoreo de Disciplina</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-2">Subida de check-ins diarios, fotos y métricas de sueño.</p>
                </button>
                <button onClick={() => navigate('/client/hormonal')} className="bg-black border border-neutral-800 hover:border-pink-500/50 rounded-2xl p-6 text-left group transition-all">
                  <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-4 group-hover:bg-pink-500/10 group-hover:text-pink-500 transition-colors"><Droplets size={24}/></div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Sync Hormonal</h3>
                  <p className="text-[10px] text-neutral-500 font-mono mt-2">Acceso a la modulación de ciclo (Atletas femeninas).</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* =================== TAB: SETTINGS ====================== */}
        {/* ======================================================== */}
        {activeTab === 'SETTINGS' && (
           <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl mx-auto space-y-8">
            <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-8 rounded-3xl shadow-xl`}>
              <div className="flex items-center gap-4 mb-8 border-b border-neutral-800/50 pb-6">
                <div className={`w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center border ${activeTheme.border}`}><Palette className={activeTheme.accent} size={24}/></div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Apariencia del Sistema</h2>
                  <p className="text-[11px] font-mono opacity-60 mt-1">Personaliza el ecosistema visual de tu panel de Súper Administrador.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {ADMIN_THEMES.map(t => (
                  <button 
                    key={t.id} 
                    onClick={() => changeTheme(t)} 
                    className={`p-5 rounded-2xl text-left transition-all duration-300 border ${activeTheme.id === t.id ? `${t.bg} border-white shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-[1.02]` : `${activeTheme.card} ${activeTheme.border} hover:border-white/50 opacity-70 hover:opacity-100`}`}
                  >
                    <p className={`text-xs font-black uppercase tracking-widest ${activeTheme.id === t.id ? t.accent : ''}`}>{t.name}</p>
                    <div className="flex gap-2 mt-4">
                      <div className={`w-6 h-6 rounded-full ${t.bg} border border-neutral-600 shadow-inner`}></div>
                      <div className={`w-6 h-6 rounded-full ${t.card} border border-neutral-600 shadow-inner`}></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-8 rounded-3xl shadow-xl`}>
              <div className="flex items-center gap-4 mb-8 border-b border-neutral-800/50 pb-6">
                <div className={`w-12 h-12 rounded-xl bg-black/30 flex items-center justify-center border ${activeTheme.border}`}><Globe className={activeTheme.accent} size={24}/></div>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight">Autoridad y Marca Global</h2>
                  <p className="text-[11px] font-mono opacity-60 mt-1">Lo que subas aquí dominará el fondo del ecosistema de los Coaches Ignición y Evolución.</p>
                </div>
              </div>

              <form onSubmit={handleSaveGlobalSettings} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase opacity-60 block mb-3">Logotipo Maestro (Súper Admin)</label>
                  <div className="flex items-center gap-6">
                    <div className={`w-32 h-32 border-2 border-dashed ${activeTheme.border} rounded-2xl flex items-center justify-center bg-black/30 overflow-hidden relative group hover:border-white transition-colors`}>
                      {globalSettings.watermark_url ? <img src={globalSettings.watermark_url} alt="Marca de Agua" className="w-full h-full object-contain p-2 opacity-50"/> : <Upload size={24} className="opacity-50"/>}
                      <input type="file" accept="image/*" onChange={(e) => setWatermarkFile(e.target.files[0])} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                    </div>
                    <p className="text-xs font-mono opacity-50 max-w-xs">Haz clic en el recuadro para subir una imagen PNG transparente de alta resolución.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="bg-black/30 border border-neutral-800/50 rounded-2xl p-5">
                    <label className="text-[10px] font-black uppercase opacity-60 flex justify-between mb-3"><span>Opacidad Visual</span> <span className={activeTheme.accent}>{globalSettings.watermark_opacity}%</span></label>
                    <input type="range" min="1" max="100" value={globalSettings.watermark_opacity} onChange={(e) => setGlobalSettings({...globalSettings, watermark_opacity: e.target.value})} className="w-full accent-white"/>
                  </div>
                  <div className="bg-black/30 border border-neutral-800/50 rounded-2xl p-5">
                    <label className="text-[10px] font-black uppercase opacity-60 flex justify-between mb-3"><span>Tamaño en Pantalla</span> <span className={activeTheme.accent}>{globalSettings.watermark_size}%</span></label>
                    <input type="range" min="10" max="150" value={globalSettings.watermark_size} onChange={(e) => setGlobalSettings({...globalSettings, watermark_size: e.target.value})} className="w-full accent-white"/>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="text-[10px] font-black uppercase opacity-60 block mb-2">Firma Digital (Redes Sociales)</label>
                  <div className="relative">
                    <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 opacity-50" size={18}/>
                    <input type="text" value={globalSettings.instagram_handle} onChange={(e) => setGlobalSettings({...globalSettings, instagram_handle: e.target.value})} placeholder="@TuUsuario" className={`w-full bg-black/50 border ${activeTheme.border} rounded-2xl pl-12 pr-4 py-4 text-sm font-mono outline-none focus:border-white transition-colors`}/>
                  </div>
                </div>

                <div className="pt-6 border-t border-neutral-800/50">
                  <button type="submit" disabled={savingSettings} className="bg-white hover:bg-neutral-200 text-black font-black uppercase tracking-widest text-[11px] py-4 px-8 rounded-xl transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingSettings ? <Loader2 size={16} className="animate-spin"/> : <><CheckCircle2 size={16}/> Guardar e Inyectar en el Sistema</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* --- WIDGET CHAT FLOTANTE (ESTILO FACEBOOK) --- */}
      {isChatOpen && selectedCoachChat && (
        <div className={`fixed bottom-0 right-4 w-80 md:w-96 ${activeTheme.card} border border-b-0 ${activeTheme.border} rounded-t-2xl shadow-2xl flex flex-col z-50 animate-in slide-in-from-bottom-10 duration-300`} style={{ height: '450px' }}>
          <div className="flex justify-between items-center p-4 border-b border-neutral-800 bg-black/20">
            <div>
              <h3 className="font-bold text-sm leading-tight flex items-center gap-2">
                <MessageCircle size={14} className={activeTheme.accent}/> Chat Privado
              </h3>
              <p className="text-[10px] font-mono opacity-60 uppercase">{selectedCoachChat.full_name}</p>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-neutral-500 hover:text-red-500 transition-colors"><X size={18}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/40">
            {chatMessages.map(msg => {
              const isMe = msg.sender_role === 'SUPER_ADMIN';
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[8px] font-black uppercase text-neutral-600 mb-0.5">{msg.sender_name}</span>
                  <div className={`px-3 py-2 rounded-xl text-xs font-mono max-w-[85%] ${isMe ? `bg-blue-600 text-white rounded-br-sm` : 'bg-neutral-800 text-neutral-300 rounded-bl-sm'}`}>
                    {msg.message}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef}/>
          </div>
          
          <form onSubmit={sendChatMessage} className="p-3 border-t border-neutral-800 bg-black/20 flex gap-2">
            <input type="text" value={newChatMessage} onChange={(e) => setNewChatMessage(e.target.value)} placeholder="Escribir mensaje..." className={`flex-1 bg-black border ${activeTheme.border} rounded-xl px-3 text-xs font-mono outline-none focus:border-blue-500`}/>
            <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-xl transition-colors"><Send size={16}/></button>
          </form>
        </div>
      )}

    </div>
  );
}