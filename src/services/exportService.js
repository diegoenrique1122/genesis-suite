// src/services/exportService.js
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx'; // Librería SheetJS

/**
 * Genera un backup B2B en formato .xlsx real con múltiples hojas de datos.
 * @param {string} athleteId - El UUID del atleta a exportar.
 */
export const exportAthleteDataToExcel = async (athleteId) => {
  try {
    // 1. Fetch de Datos: Perfil del Atleta
    const { data: profile, error: profileErr } = await supabase
      .from('athletes_profile')
      .select('*')
      .eq('id', athleteId)
      .single();
    if (profileErr) throw profileErr;

    // 2. Fetch de Datos: Métricas Diarias (Wearables / Biometría)
    const { data: metrics, error: metricsErr } = await supabase
      .from('athlete_daily_metrics')
      .select('date, steps, sleep_hours, hrv, rhr')
      .eq('athlete_id', athleteId)
      .order('date', { ascending: true });
    if (metricsErr) throw metricsErr;

    // 3. Fetch de Datos: Historial de Fotos/Pesos Semanales
    const { data: photos, error: photosErr } = await supabase
      .from('athlete_photos')
      .select('week_number, weight, uploaded_at')
      .eq('athlete_id', athleteId)
      .order('week_number', { ascending: true });
    if (photosErr) throw photosErr;

    // --- CONSTRUCCIÓN DEL LIBRO EXCEL ---
    const workbook = XLSX.utils.book_new();

    // Hoja 1: Perfil
    // Mapeamos para que se vea limpio en Excel
    const profileClean = [{
      Nombre: profile.full_name,
      Telefono: profile.phone,
      Edad: profile.age,
      Peso_Inicial: profile.weight,
      Estatura: profile.height,
      Meta: profile.goal,
      Lesiones: profile.injuries,
      Plan: profile.b2c_plan,
      Inicio_Programa: profile.program_start_date ? new Date(profile.program_start_date).toLocaleDateString() : 'Pendiente'
    }];
    const wsProfile = XLSX.utils.json_to_sheet(profileClean);
    XLSX.utils.book_append_sheet(workbook, wsProfile, "Perfil");

    // Hoja 2: Métricas Wearables
    if (metrics && metrics.length > 0) {
      const wsMetrics = XLSX.utils.json_to_sheet(metrics);
      XLSX.utils.book_append_sheet(workbook, wsMetrics, "Telemetría Diaria");
    } else {
      const wsEmpty = XLSX.utils.json_to_sheet([{ Info: "No hay métricas registradas aún." }]);
      XLSX.utils.book_append_sheet(workbook, wsEmpty, "Telemetría Diaria");
    }

    // Hoja 3: Auditoría de Peso Semanal
    if (photos && photos.length > 0) {
      const wsPhotos = XLSX.utils.json_to_sheet(photos);
      XLSX.utils.book_append_sheet(workbook, wsPhotos, "Auditoría Semanal");
    }

    // --- FORZAR DESCARGA DEL ARCHIVO .xlsx ---
    const safeName = profile.full_name ? profile.full_name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'Atleta';
    const fileName = `Expediente_Genesis_${safeName}.xlsx`;
    
    XLSX.writeFile(workbook, fileName);
    
    // Alerta de éxito
    alert(`✅ Backup de Excel descargado: ${fileName}`);

  } catch (error) {
    console.error("Error al exportar Excel:", error);
    alert(`❌ Error fatal al generar Excel: ${error.message}`);
  }
};