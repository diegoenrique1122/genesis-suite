import { supabase } from '../supabaseClient';

const HISTORY_TABLE = 'athlete_training_sessions';
const PROGRAM_TABLE = 'athlete_programs';

const HISTORY_FIELDS = [
  'id',
  'program_id',
  'athlete_id',
  'routine_day',
  'local_date',
  'time_zone',
  'workout_snapshot',
  'performance_data',
  'completed_at'
].join(',');

const DEFAULT_HISTORY_LIMIT = 20;
const MAX_HISTORY_LIMIT = 100;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Read historical training sessions permitted by Supabase RLS.
 *
 * This service never bypasses the authenticated user's permissions.
 * It does not change routines, sessions or performance records.
 */
export const listTrainingHistory = async ({
  athleteId,
  coachId,
  limit = DEFAULT_HISTORY_LIMIT
}) => {
  if (
    typeof athleteId !== 'string' ||
    !UUID_PATTERN.test(athleteId)
  ) {
    throw new Error(
      'GENESIS_TRAINING_HISTORY_INVALID_ATHLETE'
    );
  }

  if (
    typeof coachId !== 'string' ||
    !UUID_PATTERN.test(coachId)
  ) {
    throw new Error(
      'GENESIS_TRAINING_HISTORY_INVALID_COACH'
    );
  }

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_HISTORY_LIMIT
  ) {
    throw new Error(
      'GENESIS_TRAINING_HISTORY_INVALID_LIMIT'
    );
  }

  const now = new Date().toISOString();

  const { data: program, error: programError } =
    await supabase
      .from(PROGRAM_TABLE)
      .select('id')
      .eq('athlete_id', athleteId)
      .eq('coach_id', coachId)
      .in('status', ['ACTIVE', 'SCHEDULED'])
      .in('service_focus', ['TRAINING', 'BOTH'])
      .lte('starts_at', now)
      .gt('ends_at', now)
      .order('starts_at', { ascending: false })
      .limit(1)
      .maybeSingle();

  if (programError) {
    throw new Error(
      'GENESIS_TRAINING_HISTORY_PROGRAM_READ_FAILED'
    );
  }

  if (!program) {
    return [];
  }

  if (
    typeof program.id !== 'string' ||
    !UUID_PATTERN.test(program.id)
  ) {
    throw new Error(
      'GENESIS_TRAINING_HISTORY_PROGRAM_INVALID'
    );
  }

  const { data, error } = await supabase
    .from(HISTORY_TABLE)
    .select(HISTORY_FIELDS)
    .eq('athlete_id', athleteId)
    .eq('program_id', program.id)
    .order('completed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      'GENESIS_TRAINING_HISTORY_READ_FAILED'
    );
  }

  if (!Array.isArray(data)) {
    throw new Error(
      'GENESIS_TRAINING_HISTORY_INVALID_RESPONSE'
    );
  }

  return data;
};