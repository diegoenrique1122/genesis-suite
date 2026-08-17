import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  ArrowLeft, Send, Users, MessageSquare, 
  ShieldCheck, Loader2, User 
} from 'lucide-react';

export default function Chat() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  
  const [activeTab, setActiveTab] = useState('PRIVATE'); // 'PRIVATE' o 'TRIBE'
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  
  // Exclusivo para el Coach: Lista de sus atletas para el chat privado
  const [athletesList, setAthletesList] = useState([]);
  const [selectedAthleteUserId, setSelectedAthleteUserId] = useState(null);

  const messagesEndRef = useRef(null);
  const chatSubscriptionRef = useRef(null);

  useEffect(() => {
    initChat();
    return () => {
      // Limpiar la conexión realtime al salir
      if (chatSubscriptionRef.current) {
        supabase.removeChannel(chatSubscriptionRef.current);
      }
    };
  }, []);

  // Volver a cargar los mensajes si cambias de pestaña o de atleta seleccionado
  useEffect(() => {
    if (profile) fetchMessages();
  }, [activeTab, selectedAthleteUserId]);

  // Auto-scroll hacia abajo cada vez que llega un mensaje nuevo
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initChat = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');
      
      const userId = session.user.id;
      const { data: masterUser } = await supabase.from('users_master').select('role').eq('id', userId).single();
      
      let pInfo = { userId, role: masterUser.role };

      if (masterUser.role === 'ATHLETE') {
        const { data: ath } = await supabase.from('athletes_profile').select('*').eq('user_id', userId).single();
        const { data: coa } = await supabase.from('coaches_profile').select('user_id').eq('id', ath.coach_id).single();
        
        pInfo.name = ath.full_name;
        pInfo.coachId = ath.coach_id; // ID interno de la tribu
        pInfo.targetCoachUserId = coa.user_id; // Para mensajes directos
        
      } else if (masterUser.role === 'COACH') {
        const { data: coa } = await supabase.from('coaches_profile').select('*').eq('user_id', userId).single();
        pInfo.name = coa.full_name;
        pInfo.coachId = coa.id; // Su propia tribu
        
        // Cargar su Roster de atletas para el chat privado
        const { data: aths } = await supabase.from('athletes_profile').select('*').eq('coach_id', coa.id);
        setAthletesList(aths || []);
        if (aths && aths.length > 0) setSelectedAthleteUserId(aths[0].user_id);
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
    let query = supabase.from('chat_messages').select('*').eq('coach_id', profile.coachId).order('created_at', { ascending: true });

    if (activeTab === 'TRIBE') {
      query = query.eq('is_community', true);
    } else {
      query = query.eq('is_community', false);
      
      if (profile.role === 'ATHLETE') {
        query = query.or(`sender_id.eq.${profile.userId},recipient_id.eq.${profile.userId}`);
      } else if (profile.role === 'COACH' && selectedAthleteUserId) {
        query = query.or(`sender_id.eq.${selectedAthleteUserId},recipient_id.eq.${selectedAthleteUserId}`);
      }
    }

    const { data } = await query;
    setMessages(data || []);
  };

  const setupRealtimeSubscription = (pInfo) => {
    const channel = supabase.channel('live-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const newMsg = payload.new;
        
        // Evitar mensajes de otras tribus
        if (newMsg.coach_id !== pInfo.coachId) return;

        setMessages((current) => {
          // Evitar duplicados si re-renderiza
          if (current.find(m => m.id === newMsg.id)) return current;
          
          // Lógica de filtrado en vivo para la pantalla actual
          if (activeTab === 'TRIBE' && newMsg.is_community) {
            return [...current, newMsg];
          } 
          if (activeTab === 'PRIVATE' && !newMsg.is_community) {
            const isRelevantForAthlete = pInfo.role === 'ATHLETE' && (newMsg.sender_id === pInfo.userId || newMsg.recipient_id === pInfo.userId);
            const isRelevantForCoach = pInfo.role === 'COACH' && (newMsg.sender_id === selectedAthleteUserId || newMsg.recipient_id === selectedAthleteUserId);
            
            if (isRelevantForAthlete || isRelevantForCoach || newMsg.sender_id === pInfo.userId) {
              return [...current, newMsg];
            }
          }
          return current;
        });
      })
      .subscribe();
      
    chatSubscriptionRef.current = channel;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !profile) return;

    let targetRecipient = null;
    if (activeTab === 'PRIVATE') {
      targetRecipient = profile.role === 'ATHLETE' ? profile.targetCoachUserId : selectedAthleteUserId;
    }

    const payload = {
      coach_id: profile.coachId,
      sender_id: profile.userId,
      sender_name: profile.name,
      sender_role: profile.role,
      is_community: activeTab === 'TRIBE',
      recipient_id: targetRecipient,
      message: newMessage.trim()
    };

    setNewMessage(''); // Limpiamos el input instantáneamente para dar fluidez

    try {
      const { error } = await supabase.from('chat_messages').insert(payload);
      if (error) throw error;
    } catch (err) {
      alert("Error enviando mensaje: " + err.message);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={40}/></div>;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col relative overflow-hidden">
      
      {/* Fondo Neón */}
      <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none z-0" style={{ background: `radial-gradient(circle at top right, ${theme?.brandColor || '#f59e0b'}, transparent 50%)` }}></div>

      {/* NAVBAR */}
      <nav className="relative z-10 border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 shrink-0">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate(profile?.role === 'COACH' ? '/coach' : '/client')} className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest">
            <ArrowLeft size={16} /> Volver
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} style={{ color: theme?.brandColor || '#f59e0b' }}/>
            <span className="text-xs font-black uppercase tracking-widest text-neutral-300">Red de Comunicaciones</span>
          </div>
        </div>
      </nav>

      {/* SELECTOR DE PESTAÑAS */}
      <div className="relative z-10 max-w-4xl mx-auto w-full px-4 mt-4 shrink-0">
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-xl p-1">
          <button onClick={() => setActiveTab('PRIVATE')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'PRIVATE' ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}>
            <MessageSquare size={14}/> 1-a-1 Privado
          </button>
          <button onClick={() => setActiveTab('TRIBE')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'TRIBE' ? 'bg-black text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}>
            <Users size={14}/> Muro de la Tribu
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-4xl mx-auto w-full flex flex-col lg:flex-row gap-4 p-4 relative z-10 min-h-0">
        
        {/* PANEL LATERAL PARA EL COACH (LISTA DE ATLETAS) */}
        {profile?.role === 'COACH' && activeTab === 'PRIVATE' && (
          <div className="w-full lg:w-64 bg-[#111] border border-neutral-800 rounded-3xl p-4 shrink-0 overflow-y-auto hidden lg:block">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4 border-b border-neutral-800 pb-2">Tu Roster</h3>
            <div className="space-y-2">
              {athletesList.map(ath => (
                <button 
                  key={ath.id} 
                  onClick={() => setSelectedAthleteUserId(ath.user_id)}
                  className={`w-full text-left p-3 rounded-xl flex items-center gap-3 transition-colors ${selectedAthleteUserId === ath.user_id ? 'bg-neutral-800 text-white' : 'bg-transparent text-neutral-400 hover:bg-neutral-900'}`}
                >
                  <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center border border-neutral-700"><User size={14}/></div>
                  <div className="truncate">
                    <p className="text-xs font-bold uppercase truncate">{ath.full_name}</p>
                    <p className="text-[9px] font-mono opacity-50">{ath.b2c_plan}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SELECTOR MÓVIL PARA EL COACH */}
        {profile?.role === 'COACH' && activeTab === 'PRIVATE' && (
          <div className="w-full lg:hidden bg-[#111] border border-neutral-800 rounded-xl p-2 shrink-0">
            <select 
              value={selectedAthleteUserId || ''} 
              onChange={(e) => setSelectedAthleteUserId(e.target.value)}
              className="w-full bg-black border border-neutral-700 rounded-lg p-2 text-xs font-bold uppercase text-white outline-none"
            >
              {athletesList.map(ath => (
                <option key={ath.id} value={ath.user_id}>{ath.full_name} ({ath.b2c_plan})</option>
              ))}
            </select>
          </div>
        )}

        {/* ÁREA DE CHAT (MENSAJES) */}
        <div className="flex-1 bg-[#111] border border-neutral-800 rounded-3xl flex flex-col overflow-hidden min-h-[60vh]">
          
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-600 opacity-50">
                {activeTab === 'TRIBE' ? <Users size={48} className="mb-4"/> : <MessageSquare size={48} className="mb-4"/>}
                <p className="text-xs font-mono uppercase tracking-widest">No hay mensajes aún.</p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === profile.userId;
                const isCoach = msg.sender_role === 'COACH';
                return (
                  <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                    <span className="text-[9px] font-black uppercase text-neutral-500 mb-1 flex items-center gap-1">
                      {msg.sender_name} {isCoach && <ShieldCheck size={10} style={{ color: theme?.brandColor || '#f59e0b' }}/>}
                    </span>
                    <div className={`px-4 py-3 text-sm font-mono max-w-[85%] sm:max-w-[70%] shadow-lg ${isMe ? 'text-black rounded-2xl rounded-tr-sm' : 'bg-neutral-800 text-white rounded-2xl rounded-tl-sm border border-neutral-700'}`} style={{ backgroundColor: isMe ? (theme?.brandColor || '#f59e0b') : '' }}>
                      {msg.message}
                    </div>
                    <span className="text-[8px] text-neutral-600 mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT DE ESCRITURA */}
          <form onSubmit={handleSendMessage} className="p-4 bg-black/40 border-t border-neutral-800 flex gap-2 shrink-0">
            <input 
              type="text" 
              value={newMessage} 
              onChange={(e) => setNewMessage(e.target.value)} 
              placeholder={activeTab === 'TRIBE' ? "Escribe a toda la tribu..." : "Escribe un mensaje privado..."}
              className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 text-sm font-mono text-white outline-none focus:border-neutral-500 transition-colors"
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim()}
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: theme?.brandColor || '#f59e0b', color: 'black' }}
            >
              <Send size={18} />
            </button>
          </form>

        </div>
      </main>
    </div>
  );
}