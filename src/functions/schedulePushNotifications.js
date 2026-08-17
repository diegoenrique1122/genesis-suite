import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../supabaseClient';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const schedulePushNotifications = async () => {
  try {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayStr = days[new Date().getDay()]; 

    const { data: schedules } = await supabase
      .from('athlete_schedules')
      .select(`athlete_id, ${todayStr}_time, athletes_profile(users_master!inner(account_status))`)
      .neq(`${todayStr}_time`, 'Descanso');

    if (!schedules) return;

    // Instanciamos el modelo de Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    for (const schedule of schedules) {
      if (schedule.athletes_profile.users_master.account_status !== 'ACTIVE') continue;

      const timeString = schedule[`${todayStr}_time`]; 
      
      const prompt = `
        Eres el sistema de notificaciones 'Big Brother' de Genesis OS. Eres estricto, motivador y directo.
        Genera una notificación push de 1 sola línea para un atleta que entrena hoy a las ${timeString}.
        
        Ejemplos de estilo: 
        - 'Tu coach te observa. Prepárate para el bloque de hipertrofia.'
        - 'Alerta: Es hora de tus suplementos peri-entrenamiento.'
        - 'El hierro te espera. Tienes 45 minutos para iniciar tu protocolo.'
        
        Genera una nueva sin usar comillas:
      `;

      const result = await model.generateContent(prompt);
      // Limpiamos la respuesta de comillas y espacios extras
      const pushMessage = result.response.text().replace(/['"]/g, '').trim(); 
      
      console.log(`[SIMULACIÓN PUSH - GEMINI] Para Atleta ${schedule.athlete_id}: ${pushMessage}`);
    }
  } catch (error) {
    console.error("Error en Push Notifications con Google:", error);
  }
};