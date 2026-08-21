import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Loader2, Mail, Lock } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('LOGIN'); 

  // EL FIX DEL LOGOUT APLICADO CORRECTAMENTE AQUÍ
  useEffect(() => {
    let authSubscription;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('UPDATE_PASSWORD'); 
      } else if (event === 'SIGNED_IN' && view === 'LOGIN' && session) {
        redirectUser(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // Redirige al login para evitar la pantalla blanca al cerrar sesión
        setView('LOGIN');
        navigate('/');
      }
    });

    if (data && data.subscription) authSubscription = data.subscription;
    return () => { if (authSubscription) authSubscription.unsubscribe(); };
  }, [view, navigate]);

  const redirectUser = async (userId) => {
    const { data } = await supabase.from('users_master').select('role').eq('id', userId).single();
    if (data?.role === 'SUPER_ADMIN') navigate('/super-admin');
    else if (data?.role === 'COACH') navigate('/coach');
    else if (data?.role === 'ATHLETE') navigate('/client');
    else navigate('/'); 
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert("❌ Error: " + error.message);
    setLoading(false);
  };

  const handleRecoveryRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) alert("❌ Error: " + error.message);
    else {
      alert("✅ Correo de recuperación enviado. Revisa tu bandeja.");
      setView('LOGIN');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) alert("❌ Error: " + error.message);
    else {
      alert("✅ Contraseña actualizada con éxito.");
      setView('LOGIN');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 selection:bg-amber-500 selection:text-black">
      <div className="w-full max-w-md bg-[#111] border border-neutral-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 opacity-5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <Shield size={48} className="text-amber-500 mb-4" />
          <h1 className="text-2xl font-black text-white uppercase tracking-widest text-center">Genesis OS</h1>
          <p className="text-xs text-neutral-500 font-mono mt-2">
            {view === 'LOGIN' && 'Portal de Acceso Restringido'}
            {view === 'RECOVERY_REQUEST' && 'Recuperación de Credenciales'}
            {view === 'UPDATE_PASSWORD' && 'Creación de Nueva Clave'}
          </p>
        </div>

        {view === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16}/>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="atleta@genesis.com" />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase font-bold text-neutral-500 block">Contraseña</label>
                <button type="button" onClick={() => setView('RECOVERY_REQUEST')} className="text-[10px] font-bold text-amber-500 hover:underline">¿Olvidaste tu clave?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16}/>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="••••••••" />
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="w-full bg-amber-500 text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:opacity-90 transition-opacity flex justify-center mt-6">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Iniciar Sesión'}
            </button>

            <div className="mt-6 text-center border-t border-neutral-800 pt-6">
              <p className="text-[10px] text-neutral-500 font-mono uppercase">¿Tu entrenador te envió un código?</p>
              <Link to="/register/athlete" className="text-xs font-black text-amber-500 hover:text-white transition-colors mt-2 mb-4 inline-block tracking-widest">
                Crear Cuenta de Atleta &rarr;
              </Link>
              
              <p className="text-[10px] text-neutral-600 font-mono uppercase mt-4">¿Eres un Entrenador B2B nuevo?</p>
              <Link to="/register/coach" className="text-[10px] font-bold text-neutral-400 hover:text-white transition-colors mt-1 inline-block">
                Solicitar Licencia SaaS
              </Link>
            </div>
          </form>
        )}

        {view === 'RECOVERY_REQUEST' && (
          <form onSubmit={handleRecoveryRequest} className="space-y-4 relative z-10 animate-fade-in">
            <p className="text-sm text-neutral-400 font-mono mb-6 text-center">Ingresa tu correo y te enviaremos un enlace seguro para restablecer tu contraseña.</p>
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">Correo de la Cuenta</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16}/>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="tu-correo@ejemplo.com" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setView('LOGIN')} className="flex-1 bg-neutral-900 text-white font-bold uppercase text-xs py-4 rounded-xl hover:bg-neutral-800 transition-colors">Volver</button>
              <button type="submit" disabled={loading} className="flex-1 bg-amber-500 text-black font-black uppercase text-xs py-4 rounded-xl hover:opacity-90 flex justify-center">
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Enviar Enlace'}
              </button>
            </div>
          </form>
        )}

        {view === 'UPDATE_PASSWORD' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4 relative z-10 animate-fade-in">
            <p className="text-sm text-amber-500 font-bold mb-6 text-center border border-amber-500/50 bg-amber-500/10 p-3 rounded-xl">Estás restableciendo tu contraseña de forma segura.</p>
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">Nueva Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16}/>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="Escribe tu nueva clave" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-amber-500 text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:opacity-90 transition-opacity flex justify-center mt-6">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Guardar y Acceder'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}