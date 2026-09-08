import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Loader2, Mail, Lock } from 'lucide-react';
import LocaleToggle from '../components/LocaleToggle';
import { useLocale } from '../contexts/LocaleContext';

export default function Login() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('LOGIN');

  useEffect(() => {
    let authSubscription;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('UPDATE_PASSWORD');
      } else if (event === 'SIGNED_IN' && view === 'LOGIN' && session) {
        redirectUser(session.user.id);
      } else if (event === 'SIGNED_OUT') {
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

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(t('errorPrefix') + error.message);
    setLoading(false);
  };

  const handleRecoveryRequest = async (event) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) alert(t('errorPrefix') + error.message);
    else {
      alert(t('recoverySent'));
      setView('LOGIN');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async (event) => {
    event.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) alert(t('errorPrefix') + error.message);
    else {
      alert(t('passwordUpdated'));
      setView('LOGIN');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 selection:bg-amber-500 selection:text-black">
      <div className="w-full max-w-md bg-[#111] border border-neutral-800 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 opacity-5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        <div className="absolute right-6 top-6 z-20"><LocaleToggle /></div>

        <div className="flex flex-col items-center mb-8 relative z-10">
          <Shield size={48} className="text-amber-500 mb-4" />
          <h1 className="text-2xl font-black text-white uppercase tracking-widest text-center">Genesis OS</h1>
          <p className="text-xs text-neutral-500 font-mono mt-2">
            {view === 'LOGIN' && t('accessPortal')}
            {view === 'RECOVERY_REQUEST' && t('credentialRecovery')}
            {view === 'UPDATE_PASSWORD' && t('newPassword')}
          </p>
        </div>

        {view === 'LOGIN' && (
          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">{t('email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="athlete@genesis.com" />
              </div>
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] uppercase font-bold text-neutral-500 block">{t('password')}</label>
                <button type="button" onClick={() => setView('RECOVERY_REQUEST')} className="text-[10px] font-bold text-amber-500 hover:underline">{t('forgotPassword')}</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="........" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-amber-500 text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:opacity-90 transition-opacity flex justify-center mt-6">
              {loading ? <Loader2 size={16} className="animate-spin" /> : t('signIn')}
            </button>
            <div className="mt-6 text-center border-t border-neutral-800 pt-6">
              <p className="text-[10px] text-neutral-500 font-mono uppercase">{t('athleteCodeQuestion')}</p>
              <Link to="/register/athlete" className="text-xs font-black text-amber-500 hover:text-white transition-colors mt-2 mb-4 inline-block tracking-widest">{t('createAthleteAccount')} &rarr;</Link>
              <p className="text-[10px] text-neutral-600 font-mono uppercase mt-4">{t('newCoachQuestion')}</p>
              <Link to="/register/coach" className="text-[10px] font-bold text-neutral-400 hover:text-white transition-colors mt-1 inline-block">{t('requestSaasLicense')}</Link>
            </div>
          </form>
        )}

        {view === 'RECOVERY_REQUEST' && (
          <form onSubmit={handleRecoveryRequest} className="space-y-4 relative z-10 animate-fade-in">
            <p className="text-sm text-neutral-400 font-mono mb-6 text-center">{t('recoveryHelp')}</p>
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">{t('accountEmail')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="you@example.com" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={() => setView('LOGIN')} className="flex-1 bg-neutral-900 text-white font-bold uppercase text-xs py-4 rounded-xl hover:bg-neutral-800 transition-colors">{t('back')}</button>
              <button type="submit" disabled={loading} className="flex-1 bg-amber-500 text-black font-black uppercase text-xs py-4 rounded-xl hover:opacity-90 flex justify-center">{loading ? <Loader2 size={16} className="animate-spin" /> : t('sendLink')}</button>
            </div>
          </form>
        )}

        {view === 'UPDATE_PASSWORD' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4 relative z-10 animate-fade-in">
            <p className="text-sm text-amber-500 font-bold mb-6 text-center border border-amber-500/50 bg-amber-500/10 p-3 rounded-xl">{t('resetSecurity')}</p>
            <div>
              <label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">{t('newPasswordLabel')}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength="6" className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-colors" placeholder="........" />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-amber-500 text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:opacity-90 transition-opacity flex justify-center mt-6">{loading ? <Loader2 size={16} className="animate-spin" /> : t('saveAndAccess')}</button>
          </form>
        )}
      </div>
    </div>
  );
}
