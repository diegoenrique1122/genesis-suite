// src/services/storageService.js
import { supabase } from '../supabaseClient';

/**
 * Sube una foto de evidencia al bucket de Supabase y guarda la URL en la base de datos.
 * @param {File} file - El archivo de imagen desde el input.
 * @param {string} athleteId - UUID del atleta.
 * @param {string} photoType - 'front', 'side', o 'back'.
 * @param {number} weekNumber - Número de la semana (Ej. 0, 1, 12).
 */
export const uploadAthletePhoto = async (file, athleteId, photoType, weekNumber) => {
  try {
    if (!file) throw new Error("No se detectó ningún archivo.");

    // 1. Estructurar la ruta exacta solicitada por el Arquitecto
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

    // 4. Guardar dinámicamente en la base de datos (Upsert para no duplicar semanas)
    // Determinamos qué columna actualizar ('front_url', 'side_url', o 'back_url')
    const updatePayload = {
      athlete_id: athleteId,
      week_number: weekNumber,
      [`${photoType}_url`]: publicUrl
    };

    const { error: dbError } = await supabase
      .from('athlete_photos')
      .upsert(updatePayload, { onConflict: 'athlete_id,week_number' });

    if (dbError) throw dbError;

    // Alerta visual de éxito (opcional, se puede comentar si lo manejas en el UI)
    console.log(`✅ Foto ${photoType} subida exitosamente.`);
    
    return { success: true, url: publicUrl };

  } catch (error) {
    console.error("Bug en subida de Storage:", error);
    alert(`❌ Error subiendo foto: ${error.message}`);
    return { success: false, error: error.message };
  }
};