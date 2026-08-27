import { supabase } from '../supabaseClient';

/**
 * Upload canónico de evidencia corporal.
 *
 * Storage conserva solamente el path interno.
 * La lectura posterior usa signed URLs temporales.
 */
export const uploadAthletePhoto = async (
  file,
  athleteId,
  coachId,
  photoType,
  weekNumber,
  weight = null
) => {
  try {
    if (!file) {
      throw new Error('No se detectó ningún archivo.');
    }

    const allowedPhotoTypes = new Set([
      'front',
      'side',
      'back'
    ]);

    if (!allowedPhotoTypes.has(photoType)) {
      throw new Error('Tipo de fotografía no permitido.');
    }

    const fileExt = (
      file.name.split('.').pop() || 'jpg'
    )
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const filePath =
      `${athleteId}/week_${weekNumber}/${photoType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('athlete_evidence')
      .upload(
        filePath,
        file,
        {
          cacheControl: '3600',
          upsert: false
        }
      );

    if (uploadError) {
      throw uploadError;
    }

    const updatePayload = {
      athlete_id: athleteId,
      coach_id: coachId,
      week_number: weekNumber,
      [`${photoType}_path`]: filePath,

      // La columna legacy queda vacía para nuevas cargas.
      [`${photoType}_url`]: null

    };

    if (
      weight !== null &&
      weight !== undefined &&
      weight !== ''
    ) {
      updatePayload.weight_recorded =
        parseFloat(weight);
    }

    const { error: dbError } = await supabase
      .from('athlete_photos')
      .upsert(
        updatePayload,
        {
          onConflict: 'athlete_id,week_number'
        }
      );

    if (dbError) {
      throw dbError;
    }

    console.log(
      `Genesis Evidence: ${photoType} semana ${weekNumber} guardada por path.`,
      filePath
    );

    return {
      success: true,
      path: filePath
    };

  } catch (error) {
    console.error(
      'Genesis evidence upload:',
      error
    );

    throw error;
  }
};
