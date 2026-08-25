// src/services/exportService.js
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx';

/**
 * Genera un backup B2B en formato .xlsx con el expediente autorizado del atleta.
 * Mantiene separados los auto-reportes manuales y la telemetría wearable.
 * @param {string} athleteId - UUID de athletes_profile.id.
 */
export const exportAthleteDataToExcel = async (athleteId) => {
  try {
    // 1. Perfil del atleta
    const { data: profile, error: profileErr } = await supabase
      .from('athletes_profile')
      .select('*')
      .eq('id', athleteId)
      .single();

    if (profileErr) throw profileErr;

    // 2. Telemetría diaria (wearables / biometría)
    const { data: metrics, error: metricsErr } = await supabase
      .from('athlete_daily_metrics')
      .select('date, steps, sleep_hours, hrv, rhr')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: true });

    if (metricsErr) throw metricsErr;

    // 3. Disciplina diaria manual histórica
    const { data: disciplineLogs, error: disciplineErr } = profile.user_id
      ? await supabase
        .from('daily_logs')
        .select('log_date, compliance_score, habits_data')
        .eq('user_id', profile.user_id)
        .order('log_date', { ascending: true })
      : { data: [], error: null };

    if (disciplineErr) throw disciplineErr;

    // 4. Historial de fotos/pesos semanales
    const { data: photos, error: photosErr } = await supabase
      .from('athlete_photos')
      .select('week_number, weight, uploaded_at')
      .eq('athlete_id', athleteId)
      .order('week_number', { ascending: true });

    if (photosErr) throw photosErr;

    const workbook = XLSX.utils.book_new();

    // Hoja 1: Perfil
    const profileClean = [{
      Nombre: profile.full_name,
      Telefono: profile.phone,
      Edad: profile.age,
      Peso_Inicial: profile.weight,
      Estatura: profile.height,
      Meta: profile.goal,
      Lesiones: profile.injuries,
      Plan: profile.b2c_plan,
      Inicio_Programa: profile.program_start_date
        ? new Date(profile.program_start_date).toLocaleDateString()
        : 'Pendiente'
    }];

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(profileClean),
      'Perfil'
    );

    // Hoja 2: Disciplina manual histórica
    if (disciplineLogs?.length) {
      const disciplineRows = disciplineLogs.map((log) => {
        const payload = log.habits_data || {};
        const manualMetrics = payload.metrics || {};
        const training = payload.training || {};
        const meals = Array.isArray(payload.meals) ? payload.meals : [];

        return {
          Fecha: log.log_date,
          Fuente: payload.source || 'MANUAL_DISCIPLINE',
          Agua_Litros_Reportada: manualMetrics.water ?? '',
          Sueno_Horas_Reportado: manualMetrics.sleep ?? '',
          Pasos_Reportados: manualMetrics.steps ?? '',
          Entrenamiento: training.completed ?? '',
          Nota_Entrenamiento: training.difficulty_note ?? '',
          Comidas_Cumplidas: meals.filter((meal) => meal.status === 'YES').length,
          Comidas_Parciales: meals.filter((meal) => meal.status === 'PARTIAL').length,
          Comidas_No_Cumplidas: meals.filter((meal) => meal.status === 'NO').length,
          Comidas_Pendientes: meals.filter((meal) => meal.status === 'PENDING').length,
          Cumplimiento_Genesis: log.compliance_score ?? 'No evaluado'
        };
      });

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(disciplineRows),
        'Disciplina Diaria'
      );
    } else {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet([{ Info: 'No hay auditorías de disciplina registradas aún.' }]),
        'Disciplina Diaria'
      );
    }

    // Hoja 3: Métricas wearable
    if (metrics?.length) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(metrics),
        'Telemetría Diaria'
      );
    } else {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet([{ Info: 'No hay métricas wearable registradas aún.' }]),
        'Telemetría Diaria'
      );
    }

    // Hoja 4: Auditoría semanal
    if (photos?.length) {
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(photos),
        'Auditoría Semanal'
      );
    }

    const safeName = profile.full_name
      ? profile.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      : 'Atleta';

    const fileName = `Expediente_Genesis_${safeName}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    alert(`✅ Backup de Excel descargado: ${fileName}`);
  } catch (error) {
    console.error('Error al exportar Excel:', error);
    alert(`❌ Error fatal al generar Excel: ${error.message}`);
  }
};
