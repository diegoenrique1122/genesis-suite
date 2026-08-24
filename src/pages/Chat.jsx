import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import {
  ArrowLeft, Send, Globe, MessageSquare,
  ShieldCheck, Loader2, User, Users, Trash2, Ban, AlertTriangle
} from 'lucide-react';

const buildGenesisChatTopic = (channelType, userId, recipientId = null) => {
  if (channelType === 'GLOBAL_WALL') return 'genesis:global';
  if (channelType === 'COACHES_ROOM') return 'genesis:coaches';

  if (channelType === 'PRIVATE' && userId && recipientId && userId !== recipientId) {
    const [a, b] = [userId, recipientId].sort();
    return `genesis:private:${a}:${b}`;
  }

  return null;
};

export default function Chat() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  // Canales: 'GLOBAL_WALL' | 'COACHES_ROOM' | 'PRIVATE'
  // PRIVATE es el fallback seguro para cuentas sin acceso a comunidad.
  const [activeTab, setActiveTab] = useState('PRIVATE');
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  const [realtimeReady, setRealtimeReady] = useState(false);

  const [contactList, setContactList] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);

  const messagesEndRef = useRef(null);
  const chatSubscriptionRef = useRef(null);

  const appendMessage = (message) => {
    if (!message?.id) return;

    setMessages((curr) => {
      if (curr.some((item) => item.id === message.id)) return curr;
      return [...curr, message];
    });
  };

  useEffect(() => {
    initChat();

    return () => {
      if (chatSubscriptionRef.current) {
        supabase.removeChannel(chatSubscriptionRef.current);
        chatSubscriptionRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!profile) return undefined;

    if (activeTab === 'GLOBAL_WALL' && !profile.canUseGlobal) {
      setMessages([]);
      setRealtimeReady(false);
      return undefined;
    }

    if (activeTab === 'COACHES_ROOM' && !profile.canUseCoachesRoom) {
      setMessages([]);
      setRealtimeReady(false);
      return undefined;
    }

    if (activeTab === 'PRIVATE' && !selectedContactId) {
      setMessages([]);
      setRealtimeReady(false);
      return undefined;
    }

    const topic = buildGenesisChatTopic(
      activeTab,
      profile.userId,
      activeTab === 'PRIVATE' ? selectedContactId : null
    );

    if (!topic) {
      setRealtimeReady(false);
      return undefined;
    }

    let cancelled = false;

    setRealtimeReady(false);
    fetchMessages();

    if (chatSubscriptionRef.current) {
      supabase.removeChannel(chatSubscriptionRef.current);
      chatSubscriptionRef.current = null;
    }

    const connect = async () => {
      try {
        await supabase.realtime.setAuth();

        if (cancelled) return;

        const channel = supabase
          .channel(topic, {
            config: { private: true },
          })
          .on(
            'broadcast',
            { event: 'INSERT' },
            ({ payload }) => {
              const newMsg = payload?.record;
              appendMessage(newMsg);
            }
          )
          .on(
            'broadcast',
            { event: 'DELETE' },
            ({ payload }) => {
              const deletedMsg = payload?.old_record;

              if (!deletedMsg?.id) return;

              setMessages((curr) =>
                curr.filter((message) => message.id !== deletedMsg.id)
              );
            }
          )
          .subscribe((status, error) => {
            if (cancelled) return;

            if (status === 'SUBSCRIBED') {
              setRealtimeReady(true);

              // Cierra la pequeña ventana entre el SELECT inicial y el join del WebSocket.
              fetchMessages();
              return;
            }

            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setRealtimeReady(false);
              console.error('Genesis chat realtime:', status, error);
              return;
            }

            if (status === 'CLOSED') {
              setRealtimeReady(false);
            }
          });

        chatSubscriptionRef.current = channel;
      } catch (error) {
        if (!cancelled) {
          setRealtimeReady(false);
          console.error('Genesis chat realtime auth:', error);
        }
      }
    };

    connect();

    return () => {
      cancelled = true;
      setRealtimeReady(false);

      const channel = chatSubscriptionRef.current;

      if (channel) {
        supabase.removeChannel(channel);
        if (chatSubscriptionRef.current === channel) {
          chatSubscriptionRef.current = null;
        }
      }
    };
  }, [activeTab, selectedContactId, profile]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initChat = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return navigate('/');

      const userId = session.user.id;
      const { data: masterUser, error: masterError } = await supabase
        .from('users_master')
        .select('role, is_chat_banned')
        .eq('id', userId)
        .single();

      if (masterError || !masterUser) {
        throw masterError || new Error('No se encontró la identidad Genesis.');
      }

      setIsBanned(Boolean(masterUser.is_chat_banned));

      const pInfo = {
        userId,
        role: masterUser.role,
        plan: null,
        canUseGlobal: false,
        canUseCoachesRoom: false,
      };

      if (masterUser.role === 'SUPER_ADMIN') {
        pInfo.plan = 'ELITE';
        pInfo.canUseGlobal = true;
        pInfo.canUseCoachesRoom = true;

        const { data: allCoaches, error: coachesError } = await supabase
          .from('coaches_profile')
          .select('user_id, full_name, b2b_plan');

        if (coachesError) throw coachesError;

        const mapped = (allCoaches || [])
          .filter((c) => c.user_id)
          .map((c) => ({
            id: c.user_id,
            name: c.full_name || 'Coach',
            label: `Coach ${c.b2b_plan || ''}`.trim(),
          }));

        setContactList(mapped);
        setSelectedContactId(mapped[0]?.id || null);
      } else if (masterUser.role === 'ATHLETE') {
        const { data: ath, error: athleteError } = await supabase
          .from('athletes_profile')
          .select('id, full_name, coach_id, b2c_plan')
          .eq('user_id', userId)
          .single();

        if (athleteError || !ath) {
          throw athleteError || new Error('No se encontró el perfil del atleta.');
        }

        pInfo.plan = ath.b2c_plan;
        pInfo.canUseGlobal = ath.b2c_plan === 'ELITE';

        if (ath.coach_id) {
          const { data: coa, error: coachError } = await supabase
            .from('coaches_profile')
            .select('user_id, full_name')
            .eq('id', ath.coach_id)
            .maybeSingle();

          if (coachError) throw coachError;

          if (coa?.user_id) {
            setContactList([
              {
                id: coa.user_id,
                name: coa.full_name || 'Coach',
                label: 'Tu Coach',
              },
            ]);
            setSelectedContactId(coa.user_id);
          } else {
            setContactList([]);
            setSelectedContactId(null);
          }
        } else {
          setContactList([]);
          setSelectedContactId(null);
        }
      } else if (masterUser.role === 'COACH') {
        const { data: coa, error: coachError } = await supabase
          .from('coaches_profile')
          .select('id, full_name, b2b_plan')
          .eq('user_id', userId)
          .single();

        if (coachError || !coa) {
          throw coachError || new Error('No se encontró el perfil del Coach.');
        }

        pInfo.plan = coa.b2b_plan;
        pInfo.canUseGlobal = coa.b2b_plan === 'ELITE';
        pInfo.canUseCoachesRoom = coa.b2b_plan === 'ELITE';

        const { data: aths, error: athletesError } = await supabase
          .from('athletes_profile')
          .select('user_id, full_name, b2c_plan')
          .eq('coach_id', coa.id);

        if (athletesError) throw athletesError;

        const mapped = (aths || [])
          .filter((a) => a.user_id)
          .map((a) => ({
            id: a.user_id,
            name: a.full_name || 'Atleta',
            label: a.b2c_plan || 'Atleta',
          }));

        const { data: adminData, error: adminError } = await supabase
          .from('users_master')
          .select('id')
          .eq('role', 'SUPER_ADMIN')
          .limit(1);

        if (adminError) throw adminError;

        if (adminData?.[0]?.id) {
          mapped.unshift({
            id: adminData[0].id,
            name: 'Soporte (Súper Admin)',
            label: 'Administración Global',
          });
        }

        setContactList(mapped);
        setSelectedContactId(mapped[0]?.id || null);
      } else {
        throw new Error('Rol no autorizado para Genesis Network.');
      }

      setProfile(pInfo);
      setActiveTab(pInfo.canUseGlobal ? 'GLOBAL_WALL' : 'PRIVATE');
    } catch (err) {
      console.error('Error iniciando chat:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!profile) return;

    if (activeTab === 'GLOBAL_WALL' && !profile.canUseGlobal) {
      setMessages([]);
      return;
    }

    if (activeTab === 'COACHES_ROOM' && !profile.canUseCoachesRoom) {
      setMessages([]);
      return;
    }

    if (activeTab === 'PRIVATE' && !selectedContactId) {
      setMessages([]);
      return;
    }

    let query = supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (activeTab === 'GLOBAL_WALL') {
      query = query.eq('channel_type', 'GLOBAL_WALL');
    } else if (activeTab === 'COACHES_ROOM') {
      query = query.eq('channel_type', 'COACHES_ROOM');
    } else if (activeTab === 'PRIVATE') {
      query = query
        .eq('channel_type', 'PRIVATE')
        .or(
          `and(sender_id.eq.${profile.userId},recipient_id.eq.${selectedContactId}),and(sender_id.eq.${selectedContactId},recipient_id.eq.${profile.userId})`
        );
    }

    const { data, error } = await query;

    if (error) {
      console.error('Genesis chat read error:', error);
      setMessages([]);
      return;
    }

    setMessages(data || []);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();

    const message = newMessage.trim();
    if (!message || !profile || isBanned || !realtimeReady) return;

    if (activeTab === 'GLOBAL_WALL' && !profile.canUseGlobal) return;
    if (activeTab === 'COACHES_ROOM' && !profile.canUseCoachesRoom) return;

    const payload = {
      channel_type: activeTab,
      message,
    };

    if (activeTab === 'PRIVATE') {
      if (!selectedContactId) {
        alert('Selecciona un contacto.');
        return;
      }

      payload.recipient_id = selectedContactId;
    }

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      // El emisor no depende del viaje DB -> Broadcast -> Browser.
      // La fila devuelta ya contiene la identidad canónica impuesta por PostgreSQL.
      appendMessage(data);
      setNewMessage('');
    } catch (err) {
      console.error('Genesis chat send error:', err);
      alert('Error enviando mensaje: ' + err.message);
    }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('⚠️ ¿Eliminar este mensaje permanentemente de la red?')) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', msgId);

      if (error) throw error;

      // Respuesta inmediata para el moderador; Broadcast elimina en los demás clientes.
      setMessages((curr) => curr.filter((message) => message.id !== msgId));
    } catch (err) {
      alert('Error eliminando: ' + err.message);
    }
  };

  const handleBanUser = async (userId, userName) => {
    if (
      !window.confirm(
        `🚫 ¿Bloquear a ${userName} de la red de comunicaciones? No podrá enviar más mensajes.`
      )
    ) return;

    try {
      const { error } = await supabase
        .from('users_master')
        .update({ is_chat_banned: true })
        .eq('id', userId);

      if (error) throw error;
      alert(`✅ ${userName} ha sido silenciado/bloqueado del chat.`);
    } catch (err) {
      alert('Error bloqueando: ' + err.message);
    }
  };

  const handleBackNavigation = () => {
    if (profile?.role === 'SUPER_ADMIN') navigate('/super-admin');
    else if (profile?.role === 'COACH') navigate('/coach');
    else navigate('/client');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-amber-500" size={40} />
      </div>
    );
  }

  const brand = theme?.brandColor || '#f59e0b';
  const isGodMode = profile?.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-96 h-96 opacity-10 pointer-events-none rounded-full blur-3xl"
        style={{ backgroundColor: isGodMode ? '#3b82f6' : brand }}
      />

      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-30 shrink-0">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={handleBackNavigation}
            className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-[10px] font-black uppercase tracking-widest"
          >
            <ArrowLeft size={16} /> Volver
          </button>

          <div className="flex items-center gap-2">
            <ShieldCheck
              size={18}
              style={{ color: isGodMode ? '#3b82f6' : brand }}
            />
            <span className="text-xs font-black uppercase tracking-widest text-neutral-200">
              Genesis Network
              {isGodMode && (
                <span className="text-blue-500 ml-1">(GOD MODE)</span>
              )}
            </span>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto w-full px-4 mt-4 shrink-0 z-10">
        <div className="flex bg-neutral-900 border border-neutral-800 rounded-2xl p-1 max-w-lg mx-auto">
          {profile?.canUseGlobal && (
            <button
              onClick={() => setActiveTab('GLOBAL_WALL')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                activeTab === 'GLOBAL_WALL'
                  ? 'bg-white text-black shadow-lg'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              <Globe size={14} /> Muro Global
            </button>
          )}

          {profile?.canUseCoachesRoom && (
            <button
              onClick={() => setActiveTab('COACHES_ROOM')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                activeTab === 'COACHES_ROOM'
                  ? 'bg-amber-500 text-black shadow-lg'
                  : 'text-neutral-500 hover:text-amber-400'
              }`}
            >
              <Users size={14} /> Sala Coaches
            </button>
          )}

          <button
            onClick={() => setActiveTab('PRIVATE')}
            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
              activeTab === 'PRIVATE'
                ? 'bg-white text-black shadow-lg'
                : 'text-neutral-500 hover:text-white'
            }`}
          >
            <MessageSquare size={14} /> 1-a-1 Directo
          </button>
        </div>
      </div>

      <main className="flex-1 max-w-5xl mx-auto w-full flex flex-col md:flex-row gap-4 p-4 z-10 min-h-0">
        {activeTab === 'PRIVATE' && (
          <div className="w-full md:w-72 bg-[#111] border border-neutral-800 rounded-3xl p-4 shrink-0 overflow-y-auto max-h-48 md:max-h-full">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-3 pb-2 border-b border-neutral-800">
              Directorio
            </h3>

            <div className="space-y-1.5">
              {contactList.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContactId(contact.id)}
                  className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all ${
                    selectedContactId === contact.id
                      ? 'bg-neutral-800 border border-neutral-700 text-white'
                      : 'bg-neutral-900/50 text-neutral-400 hover:bg-neutral-900'
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center border border-neutral-800">
                    <User size={14} />
                  </div>

                  <div className="truncate">
                    <p className="text-xs font-black uppercase truncate">
                      {contact.name}
                    </p>
                    <p className="text-[9px] font-mono text-neutral-500">
                      {contact.label}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 bg-[#111] border border-neutral-800 rounded-3xl flex flex-col overflow-hidden min-h-[55vh]">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-neutral-600 opacity-60">
                <Globe size={44} className="mb-2" />
                <p className="text-xs font-mono uppercase tracking-widest">
                  Canal en silencio
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender_id === profile.userId;
                let roleColor = 'text-neutral-400';

                if (msg.sender_role === 'SUPER_ADMIN') {
                  roleColor = 'text-red-400';
                } else if (msg.sender_role === 'COACH') {
                  roleColor = 'text-amber-400';
                }

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      isMe ? 'items-end' : 'items-start'
                    } group relative`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[9px] font-black uppercase tracking-wider text-neutral-300">
                        {msg.sender_name}
                      </span>

                      <span className={`text-[8px] font-bold uppercase ${roleColor}`}>
                        [{msg.sender_role === 'SUPER_ADMIN' ? 'Admin' : msg.sender_role}]
                      </span>

                      {isGodMode && !isMe && (
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 ml-2">
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="text-neutral-500 hover:text-red-500"
                            title="Eliminar Mensaje"
                          >
                            <Trash2 size={12} />
                          </button>

                          <button
                            onClick={() =>
                              handleBanUser(msg.sender_id, msg.sender_name)
                            }
                            className="text-neutral-500 hover:text-red-500"
                            title="Bloquear Usuario"
                          >
                            <Ban size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div
                      className={`px-4 py-3 text-xs font-mono max-w-[85%] sm:max-w-[70%] leading-relaxed shadow-lg ${
                        isMe
                          ? 'text-black rounded-2xl rounded-tr-none font-bold'
                          : 'bg-neutral-900 text-neutral-100 rounded-2xl rounded-tl-none border border-neutral-800'
                      }`}
                      style={{
                        backgroundColor: isMe
                          ? isGodMode
                            ? '#3b82f6'
                            : brand
                          : undefined,
                      }}
                    >
                      {msg.message}
                    </div>
                  </div>
                );
              })
            )}

            <div ref={messagesEndRef} />
          </div>

          {isBanned ? (
            <div className="p-4 bg-red-900/20 border-t border-red-900/50 text-center flex items-center justify-center gap-2">
              <AlertTriangle className="text-red-500" size={16} />
              <p className="text-xs font-black uppercase tracking-widest text-red-500">
                Has sido bloqueado de la red de comunicaciones.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSendMessage}
              className="p-4 bg-black/60 border-t border-neutral-800 flex gap-2 shrink-0"
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder={
                  !realtimeReady
                    ? 'Conectando canal seguro...'
                    : activeTab === 'PRIVATE'
                      ? 'Enviar mensaje directo...'
                      : 'Publicar mensaje...'
                }
                maxLength={2000}
                className="flex-1 bg-[#161616] border border-neutral-800 rounded-2xl px-4 text-xs font-mono text-white outline-none focus:border-neutral-600 transition-colors"
                disabled={
                  !realtimeReady ||
                  (activeTab === 'PRIVATE' && !selectedContactId)
                }
              />

              <button
                type="submit"
                disabled={
                  !realtimeReady ||
                  !newMessage.trim() ||
                  (activeTab === 'PRIVATE' && !selectedContactId)
                }
                className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all disabled:opacity-40 text-black font-black"
                style={{ backgroundColor: isGodMode ? '#3b82f6' : brand }}
              >
                {realtimeReady ? <Send size={16} /> : <Loader2 size={16} className="animate-spin" />}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
