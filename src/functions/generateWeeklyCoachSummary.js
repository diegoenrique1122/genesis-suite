import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from '../supabaseClient';

// Conectamos con el cerebro de Google Gemini usando tu llave gratuita
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export const generateWeeklyCoachSummary = async (athleteId) => {
  try {
    const { data: metrics } = await supabase
      .from('athlete_daily_metrics')
      .select('hrv, sleep_hours, steps')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: false })
      .limit(7);

    const { data: logs } = await supabase
      .from('daily_logs')
      .select('compliance_score')
      .eq('athlete_id', athleteId)
      .order('log_date', { ascending: false })
      .limit(7);

    const athleteData = {
      avg_hrv: metrics?.reduce((acc, m) => acc + m.hrv, 0) / (metrics?.length || 1),
      avg_sleep: metrics?.reduce((acc, m) => acc + m.sleep_hours, 0) / (metrics?.length || 1),
      avg_compliance: logs?.reduce((acc, l) => acc + l.compliance_score, 0) / (logs?.length || 1),
    };

    // Usamos Gemini 1.5 Flash (Súper rápido y gratuito)
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" } // Forzamos JSON estricto
    });

    const prompt = `
      Actúa como un científico deportivo de élite. Analiza los datos de cumplimiento, sueño y HRV de este atleta. 
      Redacta un resumen directo y profesional de máximo 3 líneas para su entrenador. 
      ADVERTENCIA: Debes devolver la respuesta estrictamente en formato JSON con la siguiente estructura:
      {
        "resumen_corto": "texto del resumen aquí",
        "alerta_sobreentrenamiento": true o false
      }
      
      Datos de la semana del atleta: ${JSON.stringify(athleteData)}
    `;

    const result = await model.generateContent(prompt);
    const aiSummary = JSON.parse(result.response.text());
    
    return { success: true, summary: aiSummary };

  } catch (error) {
    console.error("Error generando resumen de IA con Google:", error);
    return { success: false, error: error.message };
  }
};