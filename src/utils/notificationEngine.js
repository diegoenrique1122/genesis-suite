import { supabase } from '../supabaseClient';

/**
 * Motor Universal de Notificaciones Genesis OS
 * Dispara alertas en tiempo real a cualquier rol dentro de la plataforma.
 */

// 1. Notificar al Coach (Ej: "Atleta X subió su check-in dominical")
export const notifyCoach = async (coachId, priority, type, title, message, actionUrl = null) => {
  try {
    await supabase.from('system_notifications').insert({
      recipient_role: 'COACH',
      recipient_id: coachId,
      priority: priority, // 'HIGH', 'MEDIUM', 'LOW'
      type: type,
      title: title,
      message: message,
      action_url: actionUrl
    });
  } catch (err) {
    console.error("Error en Engine (notifyCoach):", err);
  }
};

// 2. Notificar al Atleta (Ej: "Tu dieta ha sido aprobada")
export const notifyAthlete = async (athleteUserId, priority, type, title, message, actionUrl = null) => {
  try {
    await supabase.from('system_notifications').insert({
      recipient_role: 'ATHLETE',
      recipient_id: athleteUserId,
      priority: priority,
      type: type,
      title: title,
      message: message,
      action_url: actionUrl
    });
  } catch (err) {
    console.error("Error en Engine (notifyAthlete):", err);
  }
};

// 3. Notificar al Súper Admin (Ej: "Nuevo Coach se ha registrado")
export const notifySuperAdmin = async (title, message, type = 'INFO', actionUrl = null) => {
  try {
    // Buscamos el ID del Súper Admin (asumiendo que solo hay uno principal)
    const { data: adminData } = await supabase.from('users_master').select('id').eq('role', 'SUPER_ADMIN').limit(1).single();
    
    if (adminData) {
      await supabase.from('system_notifications').insert({
        recipient_role: 'SUPER_ADMIN',
        recipient_id: adminData.id,
        priority: 'HIGH',
        type: type,
        title: title,
        message: message,
        action_url: actionUrl
      });
    }
  } catch (err) {
    console.error("Error en Engine (notifySuperAdmin):", err);
  }
};

// 4. Emitir un Anuncio de Megáfono (Retos de la Semana / Avisos Globales)
export const broadcastAnnouncement = async (authorId, authorRole, targetAudience, title, content, daysToExpire = 7) => {
  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + daysToExpire);

    await supabase.from('global_announcements').insert({
      author_id: authorId,
      author_role: authorRole,
      target_audience: targetAudience, // 'MY_ATHLETES', 'ALL', etc.
      title: title,
      content: content,
      expires_at: expirationDate.toISOString()
    });
  } catch (err) {
    console.error("Error en Engine (broadcastAnnouncement):", err);
  }
};