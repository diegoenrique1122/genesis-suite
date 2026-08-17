import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { 
  Users, ShieldAlert, TrendingUp, Radio, CheckCircle2, XCircle, 
  Trash2, PauseCircle, PlayCircle, Loader2, LogOut, ShieldCheck, 
  Eye, Palette, Clock, UserCheck, Activity, RefreshCcw, Settings, 
  Upload, AtSign, MessageCircle, X, Send, LayoutDashboard, Globe
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
  
  const [activeTab, setActiveTab] = useState('DASHBOARD');

  const [activeTheme, setActiveTheme] = useState(() => {
    const saved = localStorage.getItem('genesis_admin_theme');
    return ADMIN_THEMES.find(t => t.id === saved) || ADMIN_THEMES[0];
  });

  const [stats, setStats] = useState({ totalCoaches: 0, totalAthletes: 0, pendingCoaches: 0, pendingRequests: 0 });
  const [pendingCoaches, setPendingCoaches] = useState([]);
  const [activeCoaches, setActiveCoaches] = useState([]);
  const [requests, setRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  const [globalSettings, setGlobalSettings] = useState({ watermark_url: '', instagram_handle: '@GenesisTech', watermark_opacity: 10, watermark_size: 50 });
  const [watermarkFile, setWatermarkFile] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  // --- CHAT FLOTANTE ---
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
      
      // 🚀 NUEVA CONSULTA: Traer a todos los atletas para contar el Roster de cada Coach
      const { data: allAthletes } = await supabase.from('athletes_profile').select('*');
      
      const masterMap = {};
      masterUsers?.forEach(u => { masterMap[u.id] = u; });

      const fullCoaches = (coachesData || []).map(c => {
        const masterObj = masterMap[c.user_id] || masterMap[c.id];
        
        // Filtrar los atletas que pertenecen a este coach
        const myAthletes = (allAthletes || []).filter(a => a.coach_id === c.id);
        
        // Desglosar por planes
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

      const { data: logsData } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(15);
      setAuditLogs(logsData || []);

      setStats({
        totalCoaches: activeList.length,
        totalAthletes: athletesCount || 0,
        pendingCoaches: pendingList.length,
        pendingRequests: mappedRequests.length
      });

    } catch (err) {
      console.error("Error cargando SuperAdmin:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveCoach = async (coach) => {
    try {
      const targetUserId = coach.user_id || coach.id;
      const prefix = coach.b2b_plan === 'ELITE' ? 'PRO-' : coach.b2b_plan === 'EVOLUCION' ? 'EVO-' : 'IGN-';
      const generatedCode = coach.coach_code || (prefix + Math.floor(100000 + Math.random() * 900000));

      await supabase.from('users_master').update({ account_status: 'ACTIVE' }).eq('id', targetUserId);
      await supabase.from('coaches_profile').update({ coach_code: generatedCode, full_name: coach.full_name }).or(`id.eq.${coach.id},user_id.eq.${targetUserId}`);
      
      await supabase.from('audit_logs').insert({ user_id: targetUserId, user_email: coach.email, event_type: 'STATUS_CHANGE', details: `Licencia Aprobada. Código: ${generatedCode}` });
      alert(`✅ Licencia Aprobada. Código B2C asignado: ${generatedCode}`);
      loadSuperAdminData();
    } catch (err) { alert("❌ Error al aprobar: " + err.message); }
  };

  const handleToggleCoachStatus = async (coach, currentStatus) => {
    const targetUserId = coach.user_id || coach.id;
    const newStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    try {
      await supabase.from('users_master').update({ account_status: newStatus }).eq('id', targetUserId);
      loadSuperAdminData();
    } catch (err) { alert("Error cambiando estado."); }
  };

  const handleChangeCoachPlan = async (coachId, newPlan) => {
    try {
      await supabase.from('coaches_profile').update({ b2b_plan: newPlan }).eq('id', coachId);
      loadSuperAdminData();
    } catch (err) { alert("Error cambiando plan."); }
  };

  const handleDeleteCoach = async (coach) => {
    const targetUserId = coach.user_id || coach.id;
    if (!window.confirm(`⚠️ ¿Eliminar permanentemente la cuenta de ${coach.full_name}?`)) return;
    try {
      await supabase.from('users_master').delete().eq('id', targetUserId);
      loadSuperAdminData();
    } catch (err) { alert("Error eliminando cuenta."); }
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

  const handleSaveGlobalSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      let finalUrl = globalSettings.watermark_url;
      if (watermarkFile) {
        const fileExt = watermarkFile.name.split('.').pop();
        const filePath = `assets/watermark_${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage.from('athlete_evidence').upload(filePath, watermarkFile);
        if (!uploadErr) {
          const { data } = supabase.storage.from('athlete_evidence').getPublicUrl(filePath);
          finalUrl = data.publicUrl;
        }
      }
      await supabase.from('super_admin_settings').upsert({ id: 1, watermark_url: finalUrl, instagram_handle: globalSettings.instagram_handle, watermark_opacity: globalSettings.watermark_opacity, watermark_size: globalSettings.watermark_size, updated_at: new Date().toISOString() });
      alert("✅ Configuración Global Guardada.");
      loadSuperAdminData();
    } catch (err) { alert("❌ Error guardando ajustes: " + err.message); } finally { setSavingSettings(false); }
  };

  const openChatWithCoach = (coach) => {
    setSelectedCoachChat(coach);
    setIsChatOpen(true);
    fetchChatMessages(coach.user_id || coach.id);
    
    if (chatSubscription) supabase.removeChannel(chatSubscription);
    const sub = supabase.channel(`public:chat_messages:coach_id=eq.${coach.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        setChatMessages((prev) => [...prev, payload.new]);
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }).subscribe();
    setChatSubscription(sub);
  };

  const fetchChatMessages = async (cId) => {
    const { data } = await supabase.from('chat_messages').select('*').eq('recipient_id', cId).or(`sender_id.eq.${cId},sender_role.eq.SUPER_ADMIN`).eq('is_community', false).order('created_at', { ascending: true });
    setChatMessages(data || []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const sendChatMessage = async (e) => {
    e.preventDefault();
    if (!newChatMessage.trim() || !selectedCoachChat) return;
    try {
      const cId = selectedCoachChat.user_id || selectedCoachChat.id;
      await supabase.from('chat_messages').insert({
        coach_id: selectedCoachChat.id,
        sender_id: currentUser.id,
        sender_name: 'Súper Admin',
        sender_role: 'SUPER_ADMIN',
        message: newChatMessage.trim(),
        is_community: false,
        recipient_id: cId
      });
      setNewChatMessage('');
    } catch (err) { console.error("Error enviando mensaje:", err); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) return <div className={`min-h-screen ${activeTheme.bg} flex items-center justify-center`}><Loader2 className={`animate-spin ${activeTheme.accent}`} size={50} /></div>;

  return (
    <div className={`min-h-screen ${activeTheme.bg} ${activeTheme.text} font-sans pb-24 transition-colors duration-500 relative overflow-hidden`}>
      
      {/* MARCA DE AGUA (FONDO GLOBAL) */}
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
          <div className="flex items-center gap-4">
            <button onClick={() => setActiveTab('DASHBOARD')} className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'DASHBOARD' ? activeTheme.accent : 'text-neutral-500 hover:text-white'}`}>
              <LayoutDashboard size={14}/> Métricas
            </button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 ${activeTab === 'SETTINGS' ? activeTheme.accent : 'text-neutral-500 hover:text-white'}`}>
              <Settings size={14}/> Ajustes
            </button>
            <div className="w-px h-6 bg-neutral-800 mx-2"></div>
            <button onClick={() => navigate('/coach')} className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border ${activeTheme.border} hover:bg-black/20 transition-colors`}><Eye size={16}/> Inmersión</button>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-400 transition-colors p-2"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10 space-y-10 relative z-10">

        {/* ======================================================== */}
        {/* =================== TAB: DASHBOARD ===================== */}
        {/* ======================================================== */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* KPI GLOBALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 rounded-3xl shadow-xl`}>
                <p className="text-[11px] font-black uppercase tracking-widest opacity-60">Coaches Activos</p>
                <h2 className="text-4xl font-black font-mono mt-2">{stats.totalCoaches}</h2>
              </div>
              <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 rounded-3xl shadow-xl`}>
                <p className="text-[11px] font-black uppercase tracking-widest opacity-60">Total Atletas</p>
                <h2 className="text-4xl font-black font-mono text-blue-400 mt-2">{stats.totalAthletes}</h2>
              </div>
              <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 rounded-3xl shadow-xl`}>
                <p className="text-[11px] font-black uppercase tracking-widest opacity-60">Coaches Pendientes</p>
                <h2 className="text-4xl font-black font-mono text-amber-500 mt-2">{stats.pendingCoaches}</h2>
              </div>
              <div className={`${activeTheme.card} bg-opacity-70 backdrop-blur-xl border ${activeTheme.border} p-6 rounded-3xl shadow-xl`}>
                <p className="text-[11px] font-black uppercase tracking-widest opacity-60">Peticiones Licencia</p>
                <h2 className="text-4xl font-black font-mono text-purple-400 mt-2">{stats.pendingRequests}</h2>
              </div>
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
                      <th className="pb-4 pl-2">Entrenador</th>
                      <th className="pb-4">Nivel B2B</th>
                      <th className="pb-4">Roster (Desglose)</th>
                      <th className="pb-4">Estado</th>
                      <th className="pb-4 text-right pr-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${activeTheme.border} divide-opacity-30`}>
                    {activeCoaches.map((c) => (
                      <tr key={c.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 pl-2">
                          <p className="font-bold uppercase text-sm">{c.full_name}</p>
                          <p className="text-[10px] opacity-50">{c.email}</p>
                          <p className={`text-[10px] font-bold ${activeTheme.accent} mt-1`}>ID: {c.coach_code || '---'}</p>
                        </td>
                        
                        <td className="py-4">
                          <select value={c.b2b_plan || 'IGNICION'} onChange={(e) => handleChangeCoachPlan(c.id, e.target.value)} className={`bg-black/30 border ${activeTheme.border} rounded-lg p-2 text-[10px] font-bold uppercase outline-none focus:border-white transition-colors`}>
                            <option value="IGNICION" className="text-black">IGNICION</option>
                            <option value="EVOLUCION" className="text-black">EVOLUCION</option>
                            <option value="ELITE" className="text-black">ELITE</option>
                          </select>
                        </td>

                        {/* 🚀 NUEVA COLUMNA: EL DESGLOSE DE ATLETAS POR COACH */}
                        <td className="py-4">
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-sm text-white mb-1">Total: {c.total_athletes}</span>
                            <div className="flex gap-2">
                              {c.stats_ignicion > 0 && <span className="text-[9px] font-bold text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">IGN: {c.stats_ignicion}</span>}
                              {c.stats_evolucion > 0 && <span className="text-[9px] font-bold text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded border border-blue-900/30">EVO: {c.stats_evolucion}</span>}
                              {c.stats_elite > 0 && <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">PRO: {c.stats_elite}</span>}
                            </div>
                          </div>
                        </td>

                        <td className="py-4"><span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-full ${c.account_status === 'ACTIVE' ? 'bg-green-500/20 text-green-500 border border-green-500/30' : 'bg-red-500/20 text-red-500 border border-red-500/30'}`}>{c.account_status}</span></td>
                        <td className="py-4 text-right pr-2 space-x-2 flex justify-end">
                          <button onClick={() => openChatWithCoach(c)} className={`p-2.5 rounded-xl border ${activeTheme.border} hover:bg-blue-500/20 text-blue-500 transition-colors bg-black/30`} title="Chat Directo"><MessageCircle size={16}/></button>
                          <button onClick={() => handleToggleCoachStatus(c, c.account_status)} className={`p-2.5 rounded-xl border ${activeTheme.border} hover:bg-black/50 bg-black/30`} title="Pausar/Activar">{c.account_status === 'ACTIVE' ? <PauseCircle size={16} className="text-amber-500"/> : <PlayCircle size={16} className="text-green-500"/>}</button>
                          <button onClick={() => handleDeleteCoach(c)} className={`p-2.5 rounded-xl border ${activeTheme.border} hover:bg-red-500/20 text-red-500 bg-black/30`} title="Eliminar"><Trash2 size={16}/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* =================== TAB: SETTINGS ====================== */}
        {/* ======================================================== */}
        {activeTab === 'SETTINGS' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500 max-w-5xl mx-auto space-y-8">
            
            {/* --- SECCIÓN 1: APARIENCIA DEL PANEL (TEMAS) --- */}
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

            {/* --- SECCIÓN 2: AUTORIDAD GLOBAL (MARCA DE AGUA) --- */}
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
            <button onClick={() => setIsChatOpen(false)} className="opacity-50 hover:opacity-100 hover:text-red-500 transition-colors"><X size={18}/></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/40">
            {chatMessages.map(msg => {
              const isMe = msg.sender_role === 'SUPER_ADMIN';
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <span className="text-[8px] font-black uppercase text-neutral-600 mb-0.5">{msg.sender_name}</span>
                  <div className={`px-3 py-2 rounded-xl text-xs font-mono max-w-[85%] ${isMe ? `bg-white text-black rounded-br-sm` : 'bg-neutral-800 text-neutral-300 rounded-bl-sm'}`}>
                    {msg.message}
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef}/>
          </div>
          
          <form onSubmit={sendChatMessage} className="p-3 border-t border-neutral-800 bg-black/20 flex gap-2">
            <input type="text" value={newChatMessage} onChange={(e) => setNewChatMessage(e.target.value)} placeholder="Escribir mensaje..." className={`flex-1 bg-black/50 border ${activeTheme.border} rounded-xl px-3 text-xs font-mono outline-none focus:border-white`}/>
            <button type="submit" className="bg-white text-black hover:bg-neutral-300 p-2 rounded-xl transition-colors"><Send size={16}/></button>
          </form>
        </div>
      )}

    </div>
  );
}