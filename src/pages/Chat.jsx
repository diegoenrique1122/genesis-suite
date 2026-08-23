import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Send, Globe, MessageSquare, 
  ShieldCheck, Loader2, User, Users, Trash2, Ban, AlertTriangle
} from 'lucide-react';

export default function Chat() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  
  // Canales: 'GLOBAL_WALL' | 'COACHES_ROOM' | 'PRIVATE'
  const [activeTab, setActiveTab] = useState('GLOBAL_WALL'); 
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  
  const [contactList, setContactList] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);

  const messagesEndRef = useRef(null);
  const chatSubscriptionRef = useRef(null);

  useEffect(() => {
    initChat();
    return () => {
      if (chatSubscriptionRef.current) supabase.removeChannel(chatSubscriptionRef.current);
    };
  }, []);

  useEffect(() => {
    if (profile) fetchMessages();
  }, [activeTab, selectedContactId, profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initChat = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');
      
      const userId = session.user.id;
      const { data: masterUser } = await supabase.from('users_master').select('role, is_chat_banned').eq('id', userId).single();
      
      if (masterUser?.is_chat_banned) setIsBanned(true);
      
      let pInfo = { userId, role: masterUser?.role || 'ATHLETE' };

      if (masterUser?.role === 'SUPER_ADMIN') {
        pInfo.name = 'Súper Admin';
        pInfo.userCoachId = null;
        
        // El Super Admin puede ver a TODOS los coaches para chat 1-a-1
        const { data: allCoaches } = await supabase.from('coaches_profile').select('user_id, full_name, b2b_plan');
        const mapped = (allCoaches || []).map(c => ({ id: c.user_id, name: c.full_name, label: `Coach ${c.b2b_plan}` }));
        setContactList(mapped);
        if (mapped.length > 0) setSelectedContactId(mapped[0].id);

      } else if (masterUser?.role === 'ATHLETE') {
        const { data: ath } = await supabase.from('athletes_profile').select('id, full_name, coach_id, b2c_plan').eq('user_id', userId).single();
        const { data: coa } = await supabase.from('coaches_profile').select('user_id, full_name').eq('id', ath.coach_id).single();
        
        pInfo.name = ath?.full_name || 'Atleta';
        pInfo.userCoachId = ath?.coach_id;
        setContactList([{ id: coa?.user_id, name: coa?.full_name, label: 'Tu Coach' }]);
        setSelectedContactId(coa?.user_id);

      } else if (masterUser?.role === 'COACH') {
        const { data: coa } = await supabase.from('coaches_profile').select('id, full_name, b2b_plan').eq('user_id', userId).single();
        pInfo.name = coa?.full_name || 'Coach';
        pInfo.userCoachId = coa?.id;
        
        // Cargar a sus atletas
        const { data: aths } = await supabase.from('athletes_profile').select('user_id, full_name, b2c_plan').eq('coach_id', coa?.id);
        const mapped = (aths || []).map(a => ({ id: a.user_id, name: a.full_name, label: a.b2c_plan }));
        
        // 🚀 AÑADIR AL SÚPER ADMIN AL DIRECTORIO DEL COACH
        const { data: adminData } = await supabase.from('users_master').select('id').eq('role', 'SUPER_ADMIN').limit(1);
        if (adminData && adminData.length > 0) {
          mapped.unshift({ id: adminData[0].id, name: 'Soporte (Súper Admin)', label: 'Administración Global' });
        }

        setContactList(mapped);
        if (mapped.length > 0) setSelectedContactId(mapped[0].id);
      }
      
      setProfile(pInfo);
      setupRealtimeSubscription(pInfo);
    } catch (err) {
      // ESTE FUE EL BLOQUE CATCH QUE SE HABÍA BORRADO
      console.error("Error iniciando chat:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!profile) return;
    let query = supabase.from('chat_messages').select('*').order('created_at', { ascending: true });

    if (activeTab === 'GLOBAL_WALL') query = query.eq('channel_type', 'GLOBAL_WALL');
    else if (activeTab === 'COACHES_ROOM') query = query.eq('channel_type', 'COACHES_ROOM');
    else if (activeTab === 'PRIVATE') {
      query = query.eq('channel_type', 'PRIVATE');
      if (selectedContactId) {
        query = query.or(`and(sender_id.eq.${profile.userId},recipient_id.eq.${selectedContactId}),and(sender_id.eq.${selectedContactId},recipient_id.eq.${profile.userId})`);
      }
    }

    const { data } = await query;
    setMessages(data || []);
  };

  const setupRealtimeSubscription = (pInfo) => {
    const channel = supabase.channel('genesis-network')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new;
        setMessages((curr) => {
          if (curr.some(m => m.id === newMsg.id)) return curr;
          if (activeTab === 'GLOBAL_WALL' && newMsg.channel_type === 'GLOBAL_WALL') return [...curr, newMsg];
          if (activeTab === 'COACHES_ROOM' && newMsg.channel_type === 'COACHES_ROOM') return [...curr, newMsg];
          if (activeTab === 'PRIVATE' && newMsg.channel_type === 'PRIVATE') {
            const isRelevant = (newMsg.sender_id === pInfo.userId && newMsg.recipient_id === selectedContactId) || 
                               (newMsg.sender_id === selectedContactId && newMsg.recipient_id === pInfo.userId);
            if (isRelevant) return [...curr, newMsg];
          }
          return curr;
        });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages(curr => curr.filter(msg => msg.id !== payload.old.id));
      })
      .subscribe();
      
    chatSubscriptionRef.current = channel;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile || isBanned) return;

    const payload = {
      sender_id: profile.userId,
      sender_name: profile.name,
      sender_role: profile.role,
      channel_type: activeTab,
      user_coach_id: profile.userCoachId, 
      message: newMessage.trim()
    };

    if (activeTab === 'PRIVATE') {
      if (!selectedContactId) return alert("Selecciona un contacto.");
      payload.recipient_id = selectedContactId;
    }

    setNewMessage('');
    try {
      const { error } = await supabase.from('chat_messages').insert(payload);
      if (error) throw error;
    } catch (err) { alert("Error enviando mensaje: " + err.message); }
  };

  // 🔥 FUNCIONES DE MODERACIÓN (GOD MODE)
  const handleDeleteMessage = async (msgId) => {
    if(!window.confirm('⚠️ ¿Eliminar este mensaje permanentemente de la red?')) return;
    try {
      await supabase.from('chat_messages').delete().eq('id', msgId);
    } catch(err) { alert("Error eliminando: " + err.message); }
  };

  const handleBanUser = async (userId, userName) => {
    if(!window.confirm(`🚫 ¿Bloquear a ${userName} de la red de comunicaciones? No podrá enviar más mensajes.`)) return;
    try {
      await supabase.from('users_master').update({ is_chat_banned: true }).eq('id', userId);
      alert(`✅ ${userName} ha sido silenciado/bloqueado del chat.`);
    } catch(err) { alert("Error bloqueando: " + err.message); }
  };

  const handleBackNavigation = () => {
    if (profile?.role === 'SUPER_ADMIN') navigate('/super-admin');
    else if (profile?.role === 'COACH') navigate('/coach');
    else navigate('/client');
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={40} /></div>;

  const brand = theme?.brandColor || '#f59e0b';
  const isGodMode = profile?.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 opacity-10 pointer-events-none rounded-full blur-3xl" style={{ backgroundColor: isGodMode ? '#3b82f6' : brand }}></div>

      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={handleBackNavigation} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={16} /> Volver
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: isGodMode ? '#3b82f6' : brand }} />
            <span className="text-xs font-black uppercase tracking-widest text-neutral-200">Genesis Network {isGodMode && <span className="text-blue-500 ml-1">(GOD MODE)</span>}</span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto w-full px-4 mt-4 shrink-0 z-10">
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-2xl p-1 max-w-lg mx-auto">
          <button onClick={() => setActiveTab('GLOBAL_WALL')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'GLOBAL_WALL' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}>
            <Globe size={14} /> Muro Global
          </button>
          {(profile?.role === 'COACH' || profile?.role === 'SUPER_ADMIN') && (
            <button onClick={() => setActiveTab('COACHES_ROOM')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'COACHES_ROOM' ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-amber-400'}`}>
              <Users size={14} /> Sala Coaches
            </button>
          )}
          <button onClick={() => setActiveTab('PRIVATE')} className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'PRIVATE' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}>
            <MessageSquare size={14} /> 1-a-1 Directo
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full flex flex-col md:flex-row gap-4 p-4 z-10 min-h-0">
        
        {/* PANEL LATERAL DE CONTACTOS */}
        {activeTab === 'PRIVATE' && (
          <div className="w-full md:w-72 bg-[#111] border border-neutral-800 rounded-3xl p-4 shrink-0 overflow-y-auto max-h-48 md:max-h-full">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 pb-2 border-b border-neutral-800">Directorio</h3>
            <div className="space-y-1.5">
              {contactList.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${selectedContactId === contact.id ? 'bg-neutral-800 border border-neutral-700 text-white' : 'bg-neutral-900/50 text-neutral-400 hover:bg-neutral-900'}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center border border-neutral-800"><User size={14} /></div>
                  <div className="truncate">
                    <p className="text-xs font-black uppercase truncate">{contact.name}</p>
                    <p className="text-[9px] font-mono text-neutral-500">{contact.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* CONTENEDOR DE MENSAJES */}
        <div className="flex-1 bg-[#111] border border-neutral-800 rounded-3xl flex flex-col overflow-hidden min-h-[55vh]">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-600 opacity-60">
                <Globe size={44} className="mb-2" />
                <p className="text-xs font-mono uppercase tracking-widest">Canal en silencio</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === profile.userId;
                let roleColor = 'text-neutral-400';
                if (msg.sender_role === 'SUPER_ADMIN') roleColor = 'text-red-400';
                else if (msg.sender_role === 'COACH') roleColor = 'text-amber-400';

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}>
                    
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-neutral-300">{msg.sender_name}</span>
                      <span className={`text-[8px] font-bold uppercase ${roleColor}`}>[{msg.sender_role === 'SUPER_ADMIN' ? 'Admin' : msg.sender_role}]</span>
                      
                      {/* 🔥 HERRAMIENTAS DE MODERACIÓN (GOD MODE) 🔥 */}
                      {isGodMode && !isMe && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-2">
                          <button onClick={() => handleDeleteMessage(msg.id)} className="text-neutral-500 hover:text-red-500" title="Eliminar Mensaje"><Trash2 size={12}/></button>
                          <button onClick={() => handleBanUser(msg.sender_id, msg.sender_name)} className="text-neutral-500 hover:text-red-500" title="Bloquear Usuario"><Ban size={12}/></button>
                        </div>
                      )}
                    </div>

                    <div className={`px-4 py-3 text-xs font-mono max-w-[85%] sm:max-w-[70%] leading-relaxed shadow-lg ${isMe ? 'text-black rounded-2xl rounded-tr-none font-bold' : 'bg-neutral-900 text-neutral-100 rounded-2xl rounded-tl-none border border-neutral-800'}`} style={{ backgroundColor: isMe ? (isGodMode ? '#3b82f6' : brand) : undefined }}>
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM */}
          {isBanned ? (
            <div className="p-4 bg-red-900/20 border-t border-red-900/50 text-center flex items-center justify-center gap-2">
              <AlertTriangle className="text-red-500" size={16} />
              <p className="text-xs font-black uppercase tracking-widest text-red-500">Has sido bloqueado de la red de comunicaciones.</p>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="p-4 bg-black/60 border-t border-neutral-800 flex gap-2 shrink-0">
              <input 
                type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                placeholder={activeTab === 'PRIVATE' ? "Enviar mensaje directo..." : "Publicar mensaje..."}
                className="flex-1 bg-[#161616] border border-neutral-800 rounded-2xl px-4 text-xs font-mono text-white outline-none focus:border-neutral-600 transition-colors"
                disabled={activeTab === 'PRIVATE' && !selectedContactId}
              />
              <button 
                type="submit" disabled={!newMessage.trim() || (activeTab === 'PRIVATE' && !selectedContactId)}
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 text-black font-black"
                style={{ backgroundColor: isGodMode ? '#3b82f6' : brand }}
              >
                <Send size={16} />
              </button>
            </form>
          )}

        </div>
      </main>
    </div>
  );
}