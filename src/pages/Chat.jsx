import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Send, Globe, MessageSquare, 
  ShieldCheck, Loader2, User, Users 
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
  
  // Gestión de contactos para chat privado
  const [contactList, setContactList] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);

  const messagesEndRef = useRef(null);
  const chatSubscriptionRef = useRef(null);

  useEffect(() => {
    initChat();
    return () => {
      if (chatSubscriptionRef.current) {
        supabase.removeChannel(chatSubscriptionRef.current);
      }
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
      const { data: masterUser } = await supabase
        .from('users_master')
        .select('role')
        .eq('id', userId)
        .single();
      
      let pInfo = { userId, role: masterUser?.role || 'ATHLETE' };

      if (masterUser?.role === 'ATHLETE') {
        const { data: ath } = await supabase
          .from('athletes_profile')
          .select('id, full_name, coach_id, b2c_plan')
          .eq('user_id', userId)
          .single();

        const { data: coa } = await supabase
          .from('coaches_profile')
          .select('user_id, full_name')
          .eq('id', ath.coach_id)
          .single();
        
        pInfo.name = ath?.full_name || 'Atleta';
        pInfo.userCoachId = ath?.coach_id;
        
        // Atleta solo puede chatear en privado con su coach
        setContactList([{ id: coa?.user_id, name: coa?.full_name, label: 'Tu Coach' }]);
        setSelectedContactId(coa?.user_id);

      } else if (masterUser?.role === 'COACH') {
        const { data: coa } = await supabase
          .from('coaches_profile')
          .select('id, full_name, b2b_plan')
          .eq('user_id', userId)
          .single();

        pInfo.name = coa?.full_name || 'Coach';
        pInfo.userCoachId = coa?.id;
        
        // Coach puede chatear con todos sus atletas
        const { data: aths } = await supabase
          .from('athletes_profile')
          .select('user_id, full_name, b2c_plan')
          .eq('coach_id', coa?.id);

        const mappedContacts = (aths || []).map(a => ({
          id: a.user_id,
          name: a.full_name,
          label: a.b2c_plan
        }));
        setContactList(mappedContacts);
        if (mappedContacts.length > 0) setSelectedContactId(mappedContacts[0].id);
      }
      
      setProfile(pInfo);
      setupRealtimeSubscription(pInfo);
    } catch (err) {
      console.error("Error iniciando chat:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!profile) return;

    let query = supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (activeTab === 'GLOBAL_WALL') {
      query = query.eq('channel_type', 'GLOBAL_WALL');
    } else if (activeTab === 'COACHES_ROOM') {
      query = query.eq('channel_type', 'COACHES_ROOM');
    } else if (activeTab === 'PRIVATE') {
      query = query.eq('channel_type', 'PRIVATE');
      if (selectedContactId) {
        // Filtrar conversación exacta entre el usuario logueado y el contacto seleccionado
        query = query.or(`and(sender_id.eq.${profile.userId},recipient_id.eq.${selectedContactId}),and(sender_id.eq.${selectedContactId},recipient_id.eq.${profile.userId})`);
      }
    }

    const { data } = await query;
    setMessages(data || []);
  };

  const setupRealtimeSubscription = (pInfo) => {
    const channel = supabase
      .channel('genesis-network')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new;

        setMessages((curr) => {
          if (curr.some(m => m.id === newMsg.id)) return curr;

          // Enrutamiento en vivo según la pestaña activa
          if (activeTab === 'GLOBAL_WALL' && newMsg.channel_type === 'GLOBAL_WALL') {
            return [...curr, newMsg];
          }
          if (activeTab === 'COACHES_ROOM' && newMsg.channel_type === 'COACHES_ROOM') {
            return [...curr, newMsg];
          }
          if (activeTab === 'PRIVATE' && newMsg.channel_type === 'PRIVATE') {
            const isRelevant = (newMsg.sender_id === pInfo.userId && newMsg.recipient_id === selectedContactId) || 
                               (newMsg.sender_id === selectedContactId && newMsg.recipient_id === pInfo.userId);
            if (isRelevant) return [...curr, newMsg];
          }
          
          return curr;
        });
      })
      .subscribe();

    chatSubscriptionRef.current = channel;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    const payload = {
      sender_id: profile.userId,
      sender_name: profile.name,
      sender_role: profile.role,
      channel_type: activeTab,
      user_coach_id: profile.userCoachId, // Sirve para que en el futuro rendericemos el escudo/logo de su tribu en el mensaje
      message: newMessage.trim()
    };

    if (activeTab === 'PRIVATE') {
      if (!selectedContactId) return alert("Selecciona un contacto primero.");
      payload.recipient_id = selectedContactId;
    }

    setNewMessage('');

    try {
      const { error } = await supabase.from('chat_messages').insert(payload);
      if (error) throw error;
    } catch (err) {
      alert("Error enviando mensaje: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    );
  }

  const brand = theme?.brandColor || '#f59e0b';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col relative overflow-hidden">
      
      {/* Glow */}
      <div 
        className="absolute top-0 right-0 w-96 h-96 opacity-10 pointer-events-none rounded-full blur-3xl"
        style={{ backgroundColor: brand }}
      ></div>

      {/* NAVBAR */}
      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate(profile?.role === 'COACH' ? '/coach' : '/client')} 
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft size={16} /> Volver
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: brand }} />
            <span className="text-xs font-black uppercase tracking-widest text-neutral-200">
              Genesis Network
            </span>
          </div>
        </div>
      </nav>

      {/* SELECTOR DE MODO (MULTI-CANAL) */}
      <div className="max-w-5xl mx-auto w-full px-4 mt-4 shrink-0 z-10">
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-2xl p-1 max-w-lg mx-auto">
          
          <button 
            onClick={() => setActiveTab('GLOBAL_WALL')} 
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'GLOBAL_WALL' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}
          >
            <Globe size={14} /> Muro Global
          </button>

          {/* Solo Coaches y Super Admin ven esta sala */}
          {(profile?.role === 'COACH' || profile?.role === 'SUPER_ADMIN') && (
            <button 
              onClick={() => setActiveTab('COACHES_ROOM')} 
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'COACHES_ROOM' ? 'bg-amber-500 text-black shadow-lg' : 'text-neutral-500 hover:text-amber-400'}`}
            >
              <Users size={14} /> Sala Coaches
            </button>
          )}

          <button 
            onClick={() => setActiveTab('PRIVATE')} 
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'PRIVATE' ? 'bg-white text-black shadow-lg' : 'text-neutral-500 hover:text-white'}`}
          >
            <MessageSquare size={14} /> 1-a-1 Directo
          </button>

        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full flex flex-col md:flex-row gap-4 p-4 z-10 min-h-0">
        
        {/* PANEL LATERAL DE CONTACTOS (SOLO VISIBLE EN MODO PRIVADO) */}
        {activeTab === 'PRIVATE' && (
          <div className="w-full md:w-72 bg-[#111] border border-neutral-800 rounded-3xl p-4 shrink-0 overflow-y-auto max-h-48 md:max-h-full">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 pb-2 border-b border-neutral-800">
              Directorio de Contactos
            </h3>
            <div className="space-y-1.5">
              {contactList.map(contact => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${selectedContactId === contact.id ? 'bg-neutral-800 border border-neutral-700 text-white' : 'bg-neutral-900/50 text-neutral-400 hover:bg-neutral-900'}`}
                >
                  <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center border border-neutral-800">
                    <User size={14} />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-black uppercase truncate">{contact.name}</p>
                    <p className="text-[9px] font-mono text-neutral-500">{contact.label}</p>
                  </div>
                </button>
              ))}
              {contactList.length === 0 && (
                <p className="text-[10px] text-neutral-600 font-mono text-center py-4">Sin contactos asignados.</p>
              )}
            </div>
          </div>
        )}

        {/* CONTENEDOR PRINCIPAL DE MENSAJES */}
        <div className="flex-1 bg-[#111] border border-neutral-800 rounded-3xl flex flex-col overflow-hidden min-h-[55vh]">
          
          <div className="bg-neutral-900/50 border-b border-neutral-800 p-3 text-center shrink-0">
            <p className="text-[9px] font-mono uppercase text-neutral-500 tracking-widest">
              {activeTab === 'GLOBAL_WALL' && 'Muro Global: Visibilidad para toda la plataforma'}
              {activeTab === 'COACHES_ROOM' && 'Sala Privada: Solo Entrenadores y Administración'}
              {activeTab === 'PRIVATE' && 'Canal Encriptado de Comunicación Directa'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-600 opacity-60">
                <Globe size={44} className="mb-2" />
                <p className="text-xs font-mono uppercase tracking-widest">Canal en silencio</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === profile.userId;
                
                // Color badges según rol
                let roleBadgeColor = 'bg-neutral-800 text-neutral-400';
                if (msg.sender_role === 'SUPER_ADMIN') roleBadgeColor = 'bg-red-500/20 text-red-400';
                else if (msg.sender_role === 'COACH') roleBadgeColor = 'bg-amber-500/20 text-amber-400';

                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-neutral-300">
                        {msg.sender_name}
                      </span>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${roleBadgeColor}`}>
                        {msg.sender_role === 'SUPER_ADMIN' ? 'Admin' : msg.sender_role}
                      </span>
                    </div>

                    <div 
                      className={`px-4 py-3 text-xs font-mono max-w-[85%] sm:max-w-[70%] leading-relaxed shadow-lg ${
                        isMe 
                          ? 'text-black rounded-2xl rounded-tr-none font-bold' 
                          : 'bg-neutral-900 text-neutral-100 rounded-2xl rounded-tl-none border border-neutral-800'
                      }`}
                      style={{ backgroundColor: isMe ? brand : undefined }}
                    >
                      {msg.message}
                    </div>

                    <span className="text-[8px] text-neutral-600 font-mono mt-1 px-1">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>

                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT FORM */}
          <form onSubmit={handleSendMessage} className="p-4 bg-black/60 border-t border-neutral-800 flex gap-2 shrink-0">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={activeTab === 'PRIVATE' ? "Enviar mensaje directo..." : "Publicar mensaje..."}
              className="flex-1 bg-[#161616] border border-neutral-800 rounded-2xl px-4 text-xs font-mono text-white outline-none focus:border-neutral-600 transition-colors"
              disabled={activeTab === 'PRIVATE' && !selectedContactId}
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim() || (activeTab === 'PRIVATE' && !selectedContactId)}
              className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed text-black font-black"
              style={{ backgroundColor: brand }}
            >
              <Send size={16} />
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}