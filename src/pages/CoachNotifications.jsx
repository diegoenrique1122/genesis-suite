import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Bell, AlertTriangle, Info, CheckCircle, Clock, 
  CheckCheck, Loader2, ArrowLeft, Trash2, Filter
} from 'lucide-react';

export default function CoachNotifications() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('ALL'); // ALL, HIGH, MEDIUM, LOW

  useEffect(() => {
    fetchNotifications();

    // Suscripción en Tiempo Real (Realtime) a nuevas alertas
    const subscription = supabase
      .channel('system_notifications_changes')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'system_notifications' 
      }, payload => {
        setNotifications(prev => [payload.new, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  const fetchNotifications = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate('/');

      const { data, error } = await supabase
        .from('system_notifications')
        .select('*')
        .eq('recipient_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Error cargando notificaciones:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await supabase.from('system_notifications').update({ read: true }).eq('id', id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error("Error marcando como leída:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await supabase.from('system_notifications').update({ read: true }).eq('recipient_id', session.user.id);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Error marcando todas como leídas:", err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await supabase.from('system_notifications').delete().eq('id', id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (err) {
      console.error("Error eliminando notificación:", err);
    }
  };

  // Configuración visual según la prioridad
  const getTypeConfig = (type) => {
    switch(type) {
      case 'HIGH': return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30', label: 'Requiere Acción' };
      case 'MEDIUM': return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', label: 'Operativa' };
      case 'LOW': return { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', label: 'Seguimiento' };
      default: return { icon: Bell, color: 'text-neutral-400', bg: 'bg-neutral-800', border: 'border-neutral-700', label: 'General' };
    }
  };

  const filteredNotifs = filter === 'ALL' ? notifications : notifications.filter(n => n.type === filter);
  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={40} /></div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans pb-24 selection:bg-amber-500 selection:text-black">
      {/* HEADER */}
      <nav className="border-b border-neutral-800 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-40 shadow-lg">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/coach')} className="text-neutral-500 hover:text-white transition-colors">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Bell size={16} style={{ color: theme.brandColor }}/> Centro de Alertas
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 px-3 py-1 rounded-full border border-amber-500/20">
              {unreadCount} Sin Leer
            </span>
            <button onClick={markAllAsRead} className="text-[10px] font-bold text-neutral-400 hover:text-white flex items-center gap-1 transition-colors">
              <CheckCheck size={14} /> Marcar Todo
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* FILTROS INTELIGENTES */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-6 border-b border-neutral-800 pb-4">
          <button onClick={() => setFilter('ALL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${filter === 'ALL' ? 'bg-white text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}>
            <Filter size={14} /> Todas
          </button>
          <button onClick={() => setFilter('HIGH')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${filter === 'HIGH' ? 'bg-red-500/20 text-red-500 border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}>
            <AlertTriangle size={14} /> 🔴 Alta Prioridad
          </button>
          <button onClick={() => setFilter('MEDIUM')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${filter === 'MEDIUM' ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/50' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}>
            <Clock size={14} /> 🟠 Operativas
          </button>
          <button onClick={() => setFilter('LOW')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${filter === 'LOW' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-neutral-900 text-neutral-500 hover:text-white border border-neutral-800'}`}>
            <Info size={14} /> 🟢 Silentes
          </button>
        </div>

        {/* LISTA DE NOTIFICACIONES */}
        <div className="space-y-3">
          {filteredNotifs.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-neutral-800 rounded-3xl">
              <Bell size={32} className="text-neutral-700 mx-auto mb-3" />
              <p className="text-xs font-mono text-neutral-500">Bandeja limpia. No hay alertas en esta categoría.</p>
            </div>
          ) : (
            filteredNotifs.map((notif) => {
              const config = getTypeConfig(notif.type);
              const Icon = config.icon;
              return (
                <div 
                  key={notif.id} 
                  className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row gap-4 md:items-center justify-between ${
                    notif.read ? 'bg-black/50 border-neutral-800 opacity-60' : `bg-[#111] ${config.border} shadow-lg`
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${notif.read ? 'bg-neutral-900 border-neutral-800 text-neutral-500' : `${config.bg} ${config.border} ${config.color}`}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`text-sm font-bold ${notif.read ? 'text-neutral-400' : 'text-white'}`}>{notif.title}</h3>
                        {!notif.read && <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>{config.label}</span>}
                      </div>
                      <p className="text-[11px] font-mono text-neutral-400 leading-relaxed mb-2">{notif.message}</p>
                      <span className="text-[9px] text-neutral-600 font-bold uppercase">{new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 md:flex-col lg:flex-row">
                    {!notif.read && (
                      <button onClick={() => markAsRead(notif.id)} className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2">
                        <CheckCircle size={14} /> Leído
                      </button>
                    )}
                    <button onClick={() => deleteNotification(notif.id)} className="p-2 text-neutral-600 hover:text-red-500 transition-colors bg-neutral-900 rounded-lg border border-neutral-800">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}