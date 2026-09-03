import { supabase } from '../supabaseClient';
import { invokeAthleteBoundary } from './athleteBoundaryService';

/**
 * Genesis OS badge service.
 *
 * SECURITY RULE:
 * The browser never inserts, updates, or deletes earned badges.
 * It may request server-side evaluation and then read the authorized result.
 */
export const evaluateBadges = async (athleteId) => {
  try {
    if (!athleteId) {
      return {
        newBadges: false,
        count: 0,
        totalBadges: 0,
        fenixUnlocked: false,
        badges: []
      };
    }

    const evaluationData = await invokeAthleteBoundary(
      'EVALUATE_BADGES',
      { athleteId }
    );

    const evaluation = Array.isArray(evaluationData)
      ? evaluationData[0]
      : evaluationData;

    const { data: earnedRows, error: earnedError } = await supabase
      .from('athlete_earned_badges')
      .select('badge_id, awarded_at, awarded_by')
      .eq('athlete_id', athleteId)
      .order('awarded_at', { ascending: true });

    if (earnedError) throw earnedError;

    const earned = earnedRows || [];
    const badgeIds = [...new Set(earned.map((row) => row.badge_id).filter(Boolean))];

    let dictionary = [];

    if (badgeIds.length > 0) {
      const { data: dictionaryRows, error: dictionaryError } = await supabase
        .from('badges_dictionary')
        .select('id, badge_code, badge_name, description, icon_url')
        .in('id', badgeIds);

      if (dictionaryError) throw dictionaryError;
      dictionary = dictionaryRows || [];
    }

    const dictionaryById = new Map(
      dictionary.map((badge) => [badge.id, badge])
    );

    const badges = earned
      .map((row) => {
        const definition = dictionaryById.get(row.badge_id);
        if (!definition) return null;

        return {
          ...definition,
          awarded_at: row.awarded_at,
          awarded_by: row.awarded_by
        };
      })
      .filter(Boolean);

    const newCount = Number(evaluation?.new_badges || 0);
    const fenixUnlocked = Boolean(
      evaluation?.fenix_12w ||
      badges.some((badge) => badge.badge_code === 'FENIX_12W')
    );

    return {
      newBadges: newCount > 0,
      count: newCount,
      totalBadges: Number(evaluation?.total_badges ?? badges.length),
      fenixUnlocked,
      badges
    };
  } catch (error) {
    console.error('Error evaluando gamificación:', error);

    return {
      newBadges: false,
      count: 0,
      totalBadges: 0,
      fenixUnlocked: false,
      badges: [],
      error: error?.message || 'No se pudo evaluar la gamificación.'
    };
  }
};
