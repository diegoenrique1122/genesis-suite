import { supabase } from '../supabaseClient';

export const sendNotificationToCoach = async (coachId, type, title, message) => {
  try {
    await supabase.from('system_notifications').insert({
      recipient_role: 'COACH',
      recipient_id: coachId,
      type: type, // 'HIGH', 'MEDIUM', 'LOW'
      title: title,
      message: message,
      read: false
    });
  } catch (err) {
    console.error("Error enviando notificación B2B:", err);
  }
};