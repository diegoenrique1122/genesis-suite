import { supabase } from '../supabaseClient';

export const evaluateBadges = async (athleteId) => {
  try {
    if (!athleteId) return { newBadges: false, count: 0 };

    // 1. Obtener datos del atleta y sus registros de disciplina
    const { data: athlete } = await supabase
      .from('athletes_profile')
      .select('id, program_start_date')
      .eq('id', athleteId)
      .single();

    const { data: logs } = await supabase
      .from('daily_discipline_logs')
      .select('id')
      .eq('athlete_id', athleteId);

    // 2. Obtener insignias ya ganadas
    const { data: earned } = await supabase
      .from('athlete_earned_badges')
      .select('badge_id')
      .eq('athlete_id', athleteId);

    const earnedIds = earned?.map(e => e.badge_id) || [];

    // 3. Obtener catálogo maestro
    const { data: dictionary } = await supabase
      .from('badges_dictionary')
      .select('*');

    const newAwards = [];
    const now = new Date();
    const start = athlete?.program_start_date ? new Date(athlete.program_start_date) : now;
    const diffWeeks = Math.floor((now - start) / (1000 * 60 * 60 * 24 * 7));
    const totalLogs = logs?.length || 0;

    const checkAndAssign = (badgeName, conditionMet) => {
      const bObj = dictionary?.find(b => b.name === badgeName);
      if (bObj && conditionMet && !earnedIds.includes(bObj.id)) {
        newAwards.push({
          athlete_id: athleteId,
          badge_id: bObj.id,
          awarded_by: 'SYSTEM'
        });
      }
    };

    // Reglas fisiológicas y de retención
    checkAndAssign('Guerrero I', totalLogs >= 14);
    checkAndAssign('Fénix I', diffWeeks >= 12);
    checkAndAssign('Fénix Élite', diffWeeks >= 24);

    if (newAwards.length > 0) {
      await supabase.from('athlete_earned_badges').insert(newAwards);
      return { newBadges: true, count: newAwards.length };
    }

    return { newBadges: false, count: 0 };
  } catch (error) {
    console.error("Error evaluando gamificación:", error);
    return { newBadges: false, count: 0 };
  }
};