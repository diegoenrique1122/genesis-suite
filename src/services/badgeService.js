import { supabase } from '../supabaseClient';

export const evaluateBadges = async (athleteId) => {
  try {
    // 1. Traer datos del atleta y sus reportes de disciplina (>80% score)
    const { data: athlete } = await supabase.from('athletes_profile').select('program_start_date').eq('id', athleteId).single();
    const { data: logs } = await supabase.from('daily_logs').select('id').eq('athlete_id', athleteId).gte('compliance_score', 80);

    // 2. Traer insignias que ya tiene para no dárselas doble
    const { data: earned } = await supabase.from('athlete_earned_badges').select('badge_id').eq('athlete_id', athleteId);
    const earnedIds = earned?.map(e => e.badge_id) || [];

    // 3. Traer el diccionario de insignias maestras del sistema
    const { data: dict } = await supabase.from('badges_dictionary').select('*').is('coach_id', null);

    const newAwards = [];
    const now = new Date();
    const start = new Date(athlete?.program_start_date || now);
    const weeks = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 7));
    const compliantDays = logs ? logs.length : 0;

    // Función evaluadora
    const checkAndAward = (badgeName, condition) => {
       const badge = dict?.find(b => b.name === badgeName);
       if (badge && condition && !earnedIds.includes(badge.id)) {
           newAwards.push({ athlete_id: athleteId, badge_id: badge.id, awarded_by: 'SYSTEM' });
       }
    };

    // APLICACIÓN DE LAS REGLAS DEL CEO:
    checkAndAward('Guerrero I', compliantDays >= 14);
    checkAndAward('Fénix I', weeks >= 12);
    checkAndAward('Fénix Élite', weeks >= 24);

    // Si ganó algo, lo insertamos en la BD
    if (newAwards.length > 0) {
        await supabase.from('athlete_earned_badges').insert(newAwards);
        return { newBadges: true, count: newAwards.length };
    }
    
    return { newBadges: false, count: 0 };
  } catch (err) {
    console.error("Error en el Motor de Gamificación:", err);
  }
};