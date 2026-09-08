import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const ThemeContext = createContext();

const THEME_PRESETS = {
  dark: {
    brandColor: '#f59e0b',
    bgColor: '#0a0a0a',
    cardColor: '#111111',
    borderColor: '#262626',
    textColor: '#ffffff',
  },
  midnight: {
    brandColor: '#60a5fa',
    bgColor: '#050B14',
    cardColor: '#0A192F',
    borderColor: '#1e3a5f',
    textColor: '#eff6ff',
  },
  crimson: {
    brandColor: '#ef4444',
    bgColor: '#1a0505',
    cardColor: '#2a0808',
    borderColor: '#5f1d1d',
    textColor: '#fef2f2',
  },
  cyberpunk: {
    brandColor: '#22d3ee',
    bgColor: '#0d0221',
    cardColor: '#1a053a',
    borderColor: '#6b21a8',
    textColor: '#fdf2f8',
  },
  emerald: {
    brandColor: '#34d399',
    bgColor: '#021810',
    cardColor: '#042f1f',
    borderColor: '#14532d',
    textColor: '#ecfdf5',
  },
  light: {
    brandColor: '#2563eb',
    bgColor: '#f5f5f5',
    cardColor: '#ffffff',
    borderColor: '#d4d4d4',
    textColor: '#171717',
  },
};

const DEFAULT_THEME = {
  themeId: 'dark',
  ...THEME_PRESETS.dark,
  logoUrl: null,
  watermarkText: '',
  watermarkOpacity: 10,
  watermarkSize: 50,
};

const clamp = (value, minimum, maximum, fallback) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
};

export default function ThemeProviderComponent({ children }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  const loadTheme = async (session) => {
    try {
      if (!session) {
        setTheme(DEFAULT_THEME);
        return;
      }

      const { data: userMaster, error: roleError } = await supabase
        .from('users_master')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (roleError || !userMaster) {
        setTheme(DEFAULT_THEME);
        return;
      }

      let coachData = null;

      if (userMaster.role === 'COACH' || userMaster.role === 'SUPER_ADMIN') {
        const { data, error } = await supabase
          .from('coaches_profile')
          .select('theme_id, brand_logo_url, watermark_opacity, watermark_size, instagram_handle')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!error) coachData = data;
      } else if (userMaster.role === 'ATHLETE') {
        const { data: athlete, error: athleteError } = await supabase
          .from('athletes_profile')
          .select('coach_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!athleteError && athlete?.coach_id) {
          const { data, error } = await supabase
            .from('coaches_profile')
            .select('theme_id, brand_logo_url, watermark_opacity, watermark_size, instagram_handle')
            .eq('id', athlete.coach_id)
            .maybeSingle();

          if (!error) coachData = data;
        }
      }

      const themeId = coachData?.theme_id || 'dark';
      const preset = THEME_PRESETS[themeId] || THEME_PRESETS.dark;

      setTheme({
        themeId,
        ...preset,
        logoUrl: coachData?.brand_logo_url || null,
        watermarkText: coachData?.instagram_handle || '',
        watermarkOpacity: clamp(
          coachData?.watermark_opacity,
          0,
          100,
          DEFAULT_THEME.watermarkOpacity
        ),
        watermarkSize: clamp(
          coachData?.watermark_size,
          10,
          150,
          DEFAULT_THEME.watermarkSize
        ),
      });
    } catch (err) {
      console.error('Error cargando ThemeContext:', err);
      setTheme(DEFAULT_THEME);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => loadTheme(session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      loadTheme(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', theme.brandColor);
  }, [theme]);

  const themeVariables = {
    '--genesis-bg': theme.bgColor,
    '--genesis-surface': theme.cardColor,
    '--genesis-border': theme.borderColor,
    '--genesis-text': theme.textColor,
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        refreshTheme: () =>
          supabase.auth.getSession().then(({ data }) => loadTheme(data.session)),
      }}
    >
      <div
        className="genesis-theme-root relative z-10 w-full min-h-screen"
        data-theme-id={theme.themeId}
        style={{ ...themeVariables, backgroundColor: theme.bgColor, color: theme.textColor }}
      >
        <style>{`
          .genesis-theme-root .genesis-surface { background-color: var(--genesis-surface) !important; }
          .genesis-theme-root .genesis-bg { background-color: var(--genesis-bg) !important; }
          .genesis-theme-root .genesis-border { border-color: var(--genesis-border) !important; }
          .genesis-theme-root[data-theme-id="light"] .text-white { color: var(--genesis-text) !important; }
          .genesis-theme-root[data-theme-id="light"] .text-neutral-300 { color: #404040 !important; }
          .genesis-theme-root[data-theme-id="light"] .text-neutral-400,
          .genesis-theme-root[data-theme-id="light"] .text-neutral-500 { color: #525252 !important; }
        `}</style>
        {theme.logoUrl ? (
          <div
            className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
            style={{ opacity: theme.watermarkOpacity / 100 }}
          >
            <img
              src={theme.logoUrl}
              alt=""
              aria-hidden="true"
              className="max-h-[80vh] object-contain blur-[1px] drop-shadow-2xl"
              style={{ width: `${theme.watermarkSize}%` }}
            />
          </div>
        ) : theme.watermarkText ? (
          <div
            className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
            style={{ opacity: theme.watermarkOpacity / 100 }}
          >
            <div className="select-none whitespace-nowrap text-[15vw] font-black text-white/50 -rotate-45">
              {theme.watermarkText}
            </div>
          </div>
        ) : null}
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const ThemeProvider = ThemeProviderComponent;
export const useTheme = () => useContext(ThemeContext);
