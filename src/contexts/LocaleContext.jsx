import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';

const STORAGE_KEY = 'genesis.preferred-locale';
const SUPPORTED_LOCALES = new Set(['es', 'en']);

const COPY = {
  es: {
    language: 'Idioma',
    accessPortal: 'Portal de Acceso Restringido',
    credentialRecovery: 'Recuperacion de credenciales',
    newPassword: 'Creacion de nueva clave',
    email: 'Correo electronico',
    accountEmail: 'Correo de la cuenta',
    password: 'Contrasena',
    newPasswordLabel: 'Nueva contrasena',
    forgotPassword: 'Olvidaste tu clave?',
    signIn: 'Iniciar sesion',
    recoveryHelp: 'Ingresa tu correo y te enviaremos un enlace seguro para restablecer tu contrasena.',
    back: 'Volver',
    sendLink: 'Enviar enlace',
    resetSecurity: 'Estas restableciendo tu contrasena de forma segura.',
    saveAndAccess: 'Guardar y acceder',
    athleteCodeQuestion: 'Tu entrenador te envio un codigo?',
    createAthleteAccount: 'Crear cuenta de atleta',
    newCoachQuestion: 'Eres un entrenador B2B nuevo?',
    requestSaasLicense: 'Solicitar licencia SaaS',
    recoverySent: 'Correo de recuperacion enviado. Revisa tu bandeja.',
    passwordUpdated: 'Contrasena actualizada con exito.',
    errorPrefix: 'Error: ',
    athletePortal: 'Portal del atleta',
    athleteRegistrationSubtitle: 'Crea tu cuenta para iniciar tu programa.',
    createAndContinue: 'Crear cuenta y continuar',
    existingAccount: 'Ya tengo cuenta, iniciar sesion',
    accountCreatedVerify: 'Cuenta creada. Revisa tu correo electronico para confirmar tu cuenta antes de continuar.',
    coachPortal: 'Solicitud para Genesis',
    coachRegistrationSubtitle: 'SaaS profesional para entrenadores B2B.',
    fullName: 'Nombre completo',
    businessEmail: 'Correo de negocio',
    masterPassword: 'Contrasena maestra',
    requestB2BLicense: 'Solicitar licencia B2B',
    backToLogin: 'Volver al inicio de sesion',
    missingName: 'Debes ingresar tu nombre completo.',
    invalidIdentity: 'Supabase no devolvio una identidad valida.',
    coachRequestSent: 'Solicitud enviada. Tu cuenta permanecera bloqueada hasta que el Super Admin apruebe tu licencia.',
    coachAccountCreated: 'Solicitud creada. Revisa tu correo electronico para confirmar tu cuenta. Despues de confirmar, tu licencia seguira pendiente de aprobacion administrativa.',
  },
  en: {
    language: 'Language',
    accessPortal: 'Restricted access portal',
    credentialRecovery: 'Credential recovery',
    newPassword: 'Create a new password',
    email: 'Email address',
    accountEmail: 'Account email',
    password: 'Password',
    newPasswordLabel: 'New password',
    forgotPassword: 'Forgot your password?',
    signIn: 'Sign in',
    recoveryHelp: 'Enter your email and we will send you a secure password reset link.',
    back: 'Back',
    sendLink: 'Send link',
    resetSecurity: 'You are securely resetting your password.',
    saveAndAccess: 'Save and sign in',
    athleteCodeQuestion: 'Did your coach send you a code?',
    createAthleteAccount: 'Create athlete account',
    newCoachQuestion: 'Are you a new B2B coach?',
    requestSaasLicense: 'Request SaaS license',
    recoverySent: 'Recovery email sent. Check your inbox.',
    passwordUpdated: 'Password updated successfully.',
    errorPrefix: 'Error: ',
    athletePortal: 'Athlete portal',
    athleteRegistrationSubtitle: 'Create your account to begin your program.',
    createAndContinue: 'Create account and continue',
    existingAccount: 'I already have an account, sign in',
    accountCreatedVerify: 'Account created. Check your email to confirm your account before continuing.',
    coachPortal: 'Apply to Genesis',
    coachRegistrationSubtitle: 'Professional SaaS for B2B coaches.',
    fullName: 'Full name',
    businessEmail: 'Business email',
    masterPassword: 'Master password',
    requestB2BLicense: 'Request B2B license',
    backToLogin: 'Back to sign in',
    missingName: 'Enter your full name.',
    invalidIdentity: 'Supabase did not return a valid identity.',
    coachRequestSent: 'Request sent. Your account will remain blocked until the Super Admin approves your license.',
    coachAccountCreated: 'Request created. Check your email to confirm your account. After confirmation, your license will remain pending administrative approval.',
  },
};

const LocaleContext = createContext(null);

function getInitialLocale() {
  if (typeof window === 'undefined') return 'es';

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED_LOCALES.has(stored)) return stored;

  return window.navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es';
}

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  const saveLocale = useCallback(async (nextLocale) => {
    if (!SUPPORTED_LOCALES.has(nextLocale)) return;

    setLocaleState(nextLocale);
    window.localStorage.setItem(STORAGE_KEY, nextLocale);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const { error } = await supabase
      .from('user_preferences')
      .upsert(
        {
          user_id: session.user.id,
          preferred_locale: nextLocale,
        },
        { onConflict: 'user_id' }
      );

    if (error) console.error('Genesis locale preference:', error);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadStoredPreference = async (session) => {
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferred_locale')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Genesis locale preference:', error);
        return;
      }

      if (mounted && SUPPORTED_LOCALES.has(data?.preferred_locale)) {
        setLocaleState(data.preferred_locale);
        window.localStorage.setItem(STORAGE_KEY, data.preferred_locale);
      }
    };

    supabase.auth.getSession().then(({ data }) => loadStoredPreference(data.session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadStoredPreference(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    locale,
    setLocale: saveLocale,
    t: (key) => COPY[locale]?.[key] || COPY.es[key] || key,
  }), [locale, saveLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used inside LocaleProvider');
  return context;
}
