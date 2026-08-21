import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const ThemeContext = createContext();

export default function ThemeProviderComponent({ children }) {
  // Ajustado a las columnas reales de tu base de datos
  const defaultTheme = { 
    brandColor: '#f59e0b', // Color por defecto
    bgColor: 'black',
    logoUrl: null,
    watermarkText: '@genesis_os',
    watermarkOpacity: 10
  }; 
  
  const [theme, setTheme] = useState(defaultTheme);

  const loadTheme = async (session) => {
    try {
      if (!session) {
        setTheme(defaultTheme);
        return;
      }

      const { data: userMaster } = await supabase
        .from('users_master')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (!userMaster) return;

      let coachData = null;

      if (userMaster.role === 'COACH' || userMaster.role === 'SUPER_ADMIN') {
        const { data } = await supabase
          .from('coaches_profile')
          // CORRECCIÓN: Nombres de columnas que coinciden con tu BD
          .select('theme_color, bg_color, logo_url, watermark_text, watermark_opacity')
          .eq('user_id', session.user.id)
          .single();
        coachData = data;
      } else if (userMaster.role === 'ATHLETE') {
        const { data: athlete } = await supabase
          .from('athletes_profile')
          .select('coach_id')
          .eq('user_id', session.user.id)
          .single();
        
        if (athlete && athlete.coach_id) {
          const { data } = await supabase
            .from('coaches_profile')
            // CORRECCIÓN: Nombres de columnas que coinciden con tu BD
            .select('theme_color, bg_color, logo_url, watermark_text, watermark_opacity')
            .eq('id', athlete.coach_id)
            .single();
          coachData = data;
        }
      }

      if (coachData) {
        setTheme({
          brandColor: coachData.theme_color || '#f59e0b',
          bgColor: coachData.bg_color || 'black',
          logoUrl: coachData.logo_url,
          watermarkText: coachData.watermark_text || '',
          watermarkOpacity: coachData.watermark_opacity || 10
        });
      }
    } catch (err) {
      console.error("Error cargando ThemeContext:", err);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => loadTheme(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadTheme(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary-color', theme.brandColor);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      refreshTheme: () => supabase.auth.getSession().then(({ data }) => loadTheme(data.session)) 
    }}>
      {/* EL INYECTOR GLOBAL DE MARCA DE AGUA
        Si hay un texto de marca de agua, lo inyecta sutilmente de fondo en toda la app 
      */}
      {theme.watermarkText && (
        <div 
          className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center overflow-hidden"
          style={{ opacity: theme.watermarkOpacity / 100 }}
        >
          <div className="text-[15vw] font-black text-white/50 -rotate-45 whitespace-nowrap select-none">
            {theme.watermarkText}
          </div>
        </div>
      )}
      <div className="relative z-10 w-full min-h-screen" style={{ backgroundColor: theme.bgColor }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export const ThemeProvider = ThemeProviderComponent;
export const useTheme = () => useContext(ThemeContext);