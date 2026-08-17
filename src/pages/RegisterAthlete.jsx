import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Dumbbell, Loader2, Mail, Lock } from 'lucide-react';

export default function RegisterAthlete() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) throw authError;

      if (user) {
        const { error: masterErr } = await supabase.from('users_master').insert({
          id: user.id, email: user.email, role: 'ATHLETE', account_status: 'ACTIVE'
        });
        if (masterErr) throw masterErr;

        const { error: profileErr } = await supabase.from('athletes_profile').insert({
          user_id: user.id, is_onboarded: false
        });
        if (profileErr) throw profileErr;

        navigate('/client/onboarding');
      }
    } catch (error) {
      alert("❌ Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111] border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 opacity-5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <Dumbbell size={48} className="text-amber-500 mb-4" />
          <h1 className="text-2xl font-black text-white uppercase tracking-widest text-center">Portal del Atleta</h1>
          <p className="text-xs text-neutral-500 font-mono mt-2 text-center">Crea tu cuenta para activar tu plan de 12 semanas.</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          <div>
            <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">Tu Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16}/>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="atleta@correo.com" />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16}/>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength="6" className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="••••••••" />
            </div>
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-amber-500 text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:opacity-90 transition-opacity flex justify-center mt-6">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Crear Cuenta y Continuar'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-neutral-800 pt-6 relative z-10">
          <Link to="/" className="text-[10px] font-mono text-neutral-500 hover:text-white uppercase transition-colors">
            &larr; Ya tengo cuenta, Iniciar Sesión
          </Link>
        </div>
      </div>
    </div>
  );
}