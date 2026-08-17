import { supabase } from '../supabaseClient';

/**
 * Servicio de Sincronización de Wearables (Beta / Mock Engine)
 * En producción B2B, este bloque se reemplazará por webhooks de Terra API / Apple HealthKit.
 */
export const syncWearableData = async (athleteId) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // GENERADOR DE MÉTRICAS MOCK REALISTAS
    // Simula escenarios aleatorios: días óptimos vs días de fatiga/sobreentrenamiento
    const isFatiguedDay = Math.random() < 0.3; // 30% de probabilidad de generar fatiga para probar alertas

    const mockMetrics = {
      athlete_id: athleteId,
      date: today,
      steps: Math.floor(Math.random() * (12000 - 4000 + 1)) + 4000,
      sleep_hours: isFatiguedDay ? parseFloat((Math.random() * (5.8 - 4.5) + 4.5).toFixed(1)) : parseFloat((Math.random() * (8.5 - 6.5) + 6.5).toFixed(1)),
      hrv: isFatiguedDay ? parseFloat((Math.random() * (42 - 30) + 30).toFixed(1)) : parseFloat((Math.random() * (85 - 55) + 55).toFixed(1)),
      rhr: isFatiguedDay ? Math.floor(Math.random() * (78 - 68 + 1)) + 68 : Math.floor(Math.random() * (62 - 50 + 1)) + 50
    };

    /* ==========================================================================
      [PLACEHOLDER PARA INTEGRACIÓN FUTURA DE APIs WEARABLES]
      --------------------------------------------------------------------------
      const terraResponse = await fetch(`https://api.tryterra.co/v2/daily?user_id=${terraUserId}`, {
        headers: { 'dev-id': TERRA_DEV_ID, 'x-api-key': TERRA_API_KEY }
      });
      const realData = await terraResponse.json();
      ==========================================================================
    */

    // Inserción o actualización en Supabase (UPSERT)
    const { data, error } = await supabase
      .from('athlete_daily_metrics')
      .upsert(mockMetrics, { onConflict: 'athlete_id,date' })
      .select();

    if (error) throw error;
    return { success: true, data: data[0] };

  } catch (error) {
    console.error("Error al sincronizar datos de wearable:", error.message);
    return { success: false, error: error.message };
  }
};