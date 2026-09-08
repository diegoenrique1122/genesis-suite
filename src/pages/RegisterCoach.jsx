import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2, User, Mail, Lock, Building } from 'lucide-react';
import LocaleToggle from '../components/LocaleToggle';
import { useLocale } from '../contexts/LocaleContext';

export default function RegisterCoach() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleRegister = async (event) => {
    event.preventDefault();
    setLoading(true);

    try {
      const fullName = formData.name.trim();
      if (!fullName) throw new Error(t('missingName'));

      const { data, error: authError } = await supabase.auth.signUp({
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        options: { data: { genesis_registration_type: 'COACH', full_name: fullName } },
      });

      if (authError) throw authError;
      if (!data?.user) throw new Error(t('invalidIdentity'));

      if (data.session) {
        alert(t('coachRequestSent'));
        navigate('/coach');
        return;
      }

      alert(t('coachAccountCreated'));
      navigate('/');
    } catch (error) {
      console.error('Genesis Coach Registration:', error);
      alert(t('errorPrefix') + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#111] border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        <div className="absolute right-6 top-6"><LocaleToggle /></div>
        <div className="flex flex-col items-center mb-8 text-center"><Building size={48} className="text-white mb-4" /><h1 className="text-2xl font-black text-white uppercase tracking-widest">{t('coachPortal')}</h1><p className="text-xs text-neutral-500 font-mono mt-2">{t('coachRegistrationSubtitle')}</p></div>
        <form onSubmit={handleRegister} className="space-y-4">
          <div><label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">{t('fullName')}</label><div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} /><input type="text" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-white outline-none transition-colors" placeholder="Alex Coach" /></div></div>
          <div><label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">{t('businessEmail')}</label><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} /><input type="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} required className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-white outline-none transition-colors" placeholder="coach@example.com" /></div></div>
          <div><label className="text-[10px] uppercase font-bold text-neutral-500 mb-1 block">{t('masterPassword')}</label><div className="relative"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600" size={16} /><input type="password" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} required minLength="6" className="w-full bg-black border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:border-white outline-none transition-colors" placeholder="6+ characters" /></div></div>
          <button type="submit" disabled={loading} className="w-full bg-white text-black font-black uppercase tracking-widest text-xs py-4 rounded-xl hover:bg-neutral-200 transition-colors flex justify-center mt-6">{loading ? <Loader2 size={16} className="animate-spin" /> : t('requestB2BLicense')}</button>
        </form>
        <div className="mt-6 text-center border-t border-neutral-800 pt-6"><Link to="/" className="text-[10px] font-mono text-neutral-500 hover:text-white uppercase transition-colors">&larr; {t('backToLogin')}</Link></div>
      </div>
    </div>
  );
}
