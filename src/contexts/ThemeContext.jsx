import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const ThemeContext = createContext();

export default function ThemeProviderComponent({ children }) {
  const defaultTheme = { brandColor: '#f59e0b', logoUrl: null }; // Identidad Génesis Original
  const [theme, setTheme] = useState(defaultTheme);

  const loadTheme = async (session) => {
    try {
      // Si no hay sesión (se cerró sesión), reseteamos a Génesis por defecto
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
          .select('brand_color, brand_logo_url')
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
            .select('brand_color, brand_logo_url')
            .eq('id', athlete.coach_id)
            .single();
          coachData = data;
        }
      }

      if (coachData) {
        setTheme({
          brandColor: coachData.brand_color || '#f59e0b',
          logoUrl: coachData.brand_logo_url
        });
      }
    } catch (err) {
      console.error("Error cargando ThemeContext:", err);
    }
  };

  useEffect(() => {
    // Carga inicial
    supabase.auth.getSession().then(({ data: { session } }) => loadTheme(session));

    // ESCUDO B2B: Escuchamos el cierre de sesión para limpiar el color del DOM
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
      {children}
    </ThemeContext.Provider>
  );
}

export const ThemeProvider = ThemeProviderComponent;
export const useTheme = () => useContext(ThemeContext);