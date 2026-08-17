import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { Send, ArrowLeft, Loader2, User, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Chat() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [role, setRole] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [activeContact, setActiveContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initChat();
  }, []);

  // Escuchar mensajes en tiempo real
  useEffect(() => {
    if (!activeContact || !currentUser) return;
    
    // Cargar historial inicial
    fetchMessages(currentUser.id, activeContact.user_id);

    // Suscripción a nuevos mensajes (Supabase Realtime)
    const channel = supabase.channel('chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, payload => {
        const msg = payload.new;
        if (
          (msg.sender_id === activeContact.user_id && msg.receiver_id === currentUser.id) ||
          (msg.sender_id === currentUser.id && msg.receiver_id === activeContact.user_id)
        ) {
          setMessages(prev => [...prev, msg]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeContact, currentUser]);

  // Hacer scroll hacia abajo al recibir mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initChat = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return navigate('/');
    setCurrentUser(session.user);

    const { data: master } = await supabase.from('users_master').select('role').eq('id', session.user.id).single();
    setRole(master.role);

    // Cargar Contactos según el Rol
    if (master.role === 'COACH' || master.role === 'SUPER_ADMIN') {
      const { data: coach } = await supabase.from('coaches_profile').select('id').eq('user_id', session.user.id).single();
      if (coach) {
        const { data: athletes } = await supabase.from('athletes_profile').select('user_id, full_name').eq('coach_id', coach.id);
        setContacts(athletes || []);
      }
    } else {
      // Es atleta, buscamos a su coach
      const { data: athlete } = await supabase.from('athletes_profile').select('coach_id').eq('user_id', session.user.id).single();
      if (athlete?.coach_id) {
        const { data: coach } = await supabase.from('coaches_profile').select('user_id, coach_code').eq('id', athlete.coach_id).single();
        if (coach) setContacts([{ user_id: coach.user_id, full_name: `Coach Principal` }]);
      }
    }
    setLoading(false);
  };

  const fetchMessages = async (myId, otherId) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${myId})`)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeContact) return;

    const msgData = {
      sender_id: currentUser.id,
      receiver_id: activeContact.user_id,
      content: newMessage.trim()
    };

    setNewMessage(''); 
    
    const { error } = await supabase.from('chat_messages').insert(msgData);
    if (error) console.error("Error enviando mensaje:", error);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-[var(--primary-color)]" size={40}/></div>;

  return (
    <div className="min-h-screen text-white p-4 sm:p-8 font-sans flex flex-col items-center">
      <div className="w-full max-w-5xl h-[85vh] flex flex-col md:flex-row card-container rounded-3xl overflow-hidden shadow-2xl">
        
        {/* PANEL LATERAL: CONTACTOS */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col bg-black/20">
          <div className="p-6 border-b border-neutral-800 flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="text-neutral-500 hover:text-white transition-colors"><ArrowLeft size={20}/></button>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Mensajería Segura</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {contacts.length === 0 && <p className="text-xs text-neutral-600 font-mono text-center mt-4">Sin contactos asignados.</p>}
            {contacts.map(contact => (
              <button 
                type="button"
                key={contact.user_id}
                onClick={() => setActiveContact(contact)}
                className={`w-full text-left p-4 rounded-2xl flex items-center gap-3 transition-all ${activeContact?.user_id === contact.user_id ? 'bg-[var(--primary-color-glow)] border border-[var(--primary-color)]' : 'bg-neutral-900 border border-neutral-800 hover:bg-neutral-800'}`}
              >
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center border border-neutral-700">
                  {role === 'ATHLETE' ? <ShieldCheck size={18} className="text-[var(--primary-color)]"/> : <User size={18} className="text-neutral-400"/>}
                </div>
                <div>
                  <p className="text-sm font-bold uppercase truncate text-white">{contact.full_name}</p>
                  <p className="text-[10px] text-neutral-500 font-mono">Toque para abrir chat</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* PANEL PRINCIPAL: CHAT */}
        <div className="w-full md:w-2/3 flex flex-col h-full bg-black/10">
          {activeContact ? (
            <>
              {/* Header del Chat Activo */}
              <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-black/40">
                <h3 className="font-black uppercase tracking-widest text-[var(--primary-color)]">{activeContact.full_name}</h3>
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </span>
              </div>

              {/* Área de Mensajes */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.length === 0 && <p className="text-center text-xs text-neutral-600 font-mono mt-10">Inicio de conversación encriptada. Escribe el primer mensaje.</p>}
                
                {messages.map(msg => {
                  const isMine = msg.sender_id === currentUser.id;
                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] p-4 rounded-2xl ${isMine ? 'bg-[var(--primary-color)] text-black rounded-tr-sm' : 'bg-neutral-900 border border-neutral-800 text-white rounded-tl-sm'}`}>
                        <p className={`text-sm ${isMine ? 'font-bold' : ''}`}>{msg.content}</p>
                        <p className={`text-[8px] mt-2 font-mono ${isMine ? 'text-black/70' : 'text-neutral-500'}`}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input de Envío */}
              <form onSubmit={sendMessage} className="p-4 bg-black/40 border-t border-neutral-800 flex gap-3">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={e => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..." 
                  className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 text-sm text-white outline-none focus:border-[var(--primary-color)]"
                />
                <button type="submit" disabled={!newMessage.trim()} className="bg-[var(--primary-color)] text-black p-4 rounded-xl hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send size={18} />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-neutral-600">
              <ShieldCheck size={48} className="mb-4 opacity-50"/>
              <p className="text-sm font-black uppercase tracking-widest">Chat Encriptado B2B2C</p>
              <p className="text-xs font-mono mt-2 text-center max-w-xs">Selecciona un contacto en el panel lateral para iniciar la comunicación.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}