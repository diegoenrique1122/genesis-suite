import { supabase } from '../supabaseClient';

const TRAINING_COMPLETION_RPC =
  'genesis_athlete_complete_training_session';

const CODE_MESSAGES = {
  GENESIS_TRAINING_SESSION_AUTH_REQUIRED:
    'Tu sesión no pudo ser validada. Inicia sesión nuevamente.',
  GENESIS_TRAINING_SESSION_INVALID_ROUTINE_DAY:
    'El día seleccionado no es válido.',
  GENESIS_TRAINING_SESSION_TIME_ZONE_REQUIRED:
    'Genesis no pudo identificar tu zona horaria.',
  GENESIS_TRAINING_SESSION_INVALID_TIME_ZONE:
    'La zona horaria del dispositivo no es válida.',
  GENESIS_TRAINING_SESSION_ATHLETE_NOT_FOUND:
    'No se encontró tu perfil activo de atleta.',
  GENESIS_TRAINING_SESSION_COACH_REQUIRED:
    'Tu perfil todavía no tiene un coach asignado.',
  GENESIS_TRAINING_SESSION_ROUTINE_NOT_APPROVED:
    'Tu rutina todavía no ha sido aprobada por tu coach.',
  GENESIS_TRAINING_SESSION_PLAN_INVALID:
    'Tu plan de entrenamiento no tiene una estructura válida.',
  GENESIS_TRAINING_SESSION_ACTIVE_PROGRAM_REQUIRED:
    'No existe un programa de entrenamiento activo para registrar esta sesión.',
  GENESIS_TRAINING_SESSION_DAY_NOT_FOUND:
    'El día seleccionado no existe dentro de tu rutina aprobada.',
  GENESIS_TRAINING_SESSION_PERSISTENCE_FAILED:
    'Genesis no pudo confirmar el registro del entrenamiento.',
  GENESIS_TRAINING_SESSION_RESPONSE_INVALID:
    'Genesis recibió una respuesta inválida al registrar el entrenamiento.',
  GENESIS_TRAINING_SESSION_REQUEST_FAILED:
    'No fue posible registrar el entrenamiento.'
};

const SERVER_CODES =
  Object.keys(CODE_MESSAGES)
    .filter((code) =>
      code.startsWith('GENESIS_TRAINING_SESSION_')
    );

const messageForCode = (code) =>
  CODE_MESSAGES[code] ||
  CODE_MESSAGES.GENESIS_TRAINING_SESSION_REQUEST_FAILED;

const extractServerCode = (error) => {
  const rawMessage = [
    error?.message,
    error?.details,
    error?.hint
  ]
    .filter(Boolean)
    .join(' ');

  return (
    SERVER_CODES.find((code) =>
      rawMessage.includes(code)
    ) ||
    'GENESIS_TRAINING_SESSION_REQUEST_FAILED'
  );
};

export class TrainingExecutionError extends Error {
  constructor(code) {
    super(messageForCode(code));

    this.name = 'TrainingExecutionError';
    this.code = code;
  }
}

export const completeTrainingSession = async ({
  routineDay,
  timeZone
}) => {
  if (
    !Number.isInteger(routineDay) ||
    routineDay < 1
  ) {
    throw new TrainingExecutionError(
      'GENESIS_TRAINING_SESSION_INVALID_ROUTINE_DAY'
    );
  }

  if (
    typeof timeZone !== 'string' ||
    !timeZone.trim()
  ) {
    throw new TrainingExecutionError(
      'GENESIS_TRAINING_SESSION_TIME_ZONE_REQUIRED'
    );
  }

  const { data, error } = await supabase.rpc(
    TRAINING_COMPLETION_RPC,
    {
      p_routine_day: routineDay,
      p_time_zone: timeZone.trim()
    }
  );

  if (error) {
    const code = extractServerCode(error);

    console.error(
      'Genesis training completion RPC:',
      {
        code,
        error
      }
    );

    throw new TrainingExecutionError(code);
  }

  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    data.ok !== true ||
    !data.session_id ||
    !data.program_id ||
    !data.athlete_id
  ) {
    throw new TrainingExecutionError(
      'GENESIS_TRAINING_SESSION_RESPONSE_INVALID'
    );
  }

  return data;
};