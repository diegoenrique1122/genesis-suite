import { supabase } from '../supabaseClient';

/**
 * Sube una foto de evidencia al bucket de Supabase y guarda/actualiza la URL en la base de datos.
 * @param {File} file - El archivo de imagen desde el input.
 * @param {string} athleteId - UUID del atleta.
 * @param {string} coachId - UUID del coach (Vital para el filtro B2B).
 * @param {string} photoType - 'front', 'side', o 'back'.
 * @param {number} weekNumber - Número de la semana (Ej. 0, 3, 6, 9, 12).
 * @param {number} weight - (Opcional) Peso registrado esa semana.
 */
export const uploadAthletePhoto = async (file, athleteId, coachId, photoType, weekNumber, weight = null) => {
  try {
    if (!file) throw new Error("No se detectó ningún archivo.");

    // 1. Estructurar la ruta exacta
    const fileExt = file.name.split('.').pop();
    const filePath = `${athleteId}/week_${weekNumber}/${photoType}_${Date.now()}.${fileExt}`;

    // 2. Subir al bucket 'athlete_evidence'
    const { error: uploadError } = await supabase.storage
      .from('athlete_evidence')
      .upload(filePath, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    // 3. Extraer la URL pública
    const { data: publicUrlData } = supabase.storage
      .from('athlete_evidence')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData.publicUrl;

    // 4. Preparar la carga de datos para el Upsert
    const updatePayload = {
      athlete_id: athleteId,
      coach_id: coachId,
      week_number: weekNumber,
      [`${photoType}_url`]: publicUrl,
      updated_at: new Date().toISOString()
    };

    // Solo inyectar el peso si se envía en esta toma
    if (weight) {
      updatePayload.weight_recorded = parseFloat(weight);
    }

    // 5. Insertar o Actualizar en la base de datos
    const { error: dbError } = await supabase
      .from('athlete_photos')
      .upsert(updatePayload, { onConflict: 'athlete_id,week_number' });

    if (dbError) throw dbError;

    console.log(`✅ Foto ${photoType} (Semana ${weekNumber}) subida exitosamente.`);
    return { success: true, url: publicUrl };

  } catch (error) {
    console.error("Bug en subida de Storage:", error);
    return { success: false, error: error.message };
  }
};