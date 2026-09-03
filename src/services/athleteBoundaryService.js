import { supabase } from '../supabaseClient';

const ATHLETE_BOUNDARY_FUNCTION = 'genesis-athlete-boundary';

const ACTIONS = new Set([
  'RESOLVE_COACH_INVITE',
  'COMPLETE_ONBOARDING',
  'EVALUATE_BADGES'
]);

const CODE_MESSAGES = {
  INVALID_INVITE_CODE: 'El código de invitación no es válido.',
  INVITE_NOT_FOUND: 'El código de invitación no existe o ya no está disponible.',
  INVALID_OR_UNAUTHORIZED_INVITE_CODE:
    'Código de invitación inválido o no autorizado para ese plan.',
  ATHLETE_ACCOUNT_NOT_ACTIVE:
    'Tu cuenta de atleta todavía no está activa.',
  ATHLETE_PROFILE_NOT_FOUND:
    'No se encontró tu perfil base en Genesis.',
  ACTOR_FORBIDDEN:
    'Tu cuenta no está autorizada para realizar esta operación.',
  ACTOR_SESSION_INVALID:
    'Tu sesión ya no es válida. Inicia sesión nuevamente.',
  AUTH_REQUIRED:
    'Tu sesión no pudo ser validada. Inicia sesión nuevamente.',
  AUTH_CLAIMS_INVALID:
    'Tu sesión no pudo ser validada. Inicia sesión nuevamente.',
  INVALID_ONBOARDING_INPUT:
    'Revisa los datos del formulario antes de continuar.',
  LEGAL_ACCEPTANCE_REQUIRED:
    'Debes aceptar los Términos de Servicio para continuar.',
  ONBOARDING_ALREADY_COMPLETED:
    'Tu perfil de Genesis ya completó el proceso de activación.',
  ONBOARDING_STATE_CHANGED:
    'El estado de tu perfil cambió. Actualiza la página antes de continuar.',
  ONBOARDING_EVIDENCE_OBJECT_MISSING:
    'Genesis no pudo confirmar una o más fotografías cargadas.',
  BADGE_ACCESS_DENIED:
    'Tu cuenta no está autorizada para evaluar las insignias de este atleta.',
  BADGE_ATHLETE_PROFILE_NOT_FOUND:
    'No se encontró el perfil del atleta para evaluar sus insignias.',
  INVALID_ATHLETE_ID:
    'No se pudo identificar el atleta para evaluar sus insignias.',
  BOUNDARY_RESPONSE_INVALID:
    'Genesis recibió una respuesta inválida. Intenta nuevamente.',
  BOUNDARY_EXECUTION_FAILED:
    'Genesis no pudo completar la operación. Intenta nuevamente.'
};

const asRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
};

const safeCode = (value) =>
  typeof value === 'string' && value.trim()
    ? value.trim().toUpperCase()
    : 'ATHLETE_BOUNDARY_REQUEST_FAILED';

const messageForCode = (code, retryable) => {
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  if (retryable) {
    return 'Genesis está temporalmente ocupado. Intenta nuevamente en unos segundos.';
  }

  return 'No fue posible completar la operación solicitada.';
};

const readFunctionErrorPayload = async (error) => {
  try {
    const response = error?.context?.clone?.();
    if (!response) return null;

    return asRecord(await response.json());
  } catch {
    return null;
  }
};

export class AthleteBoundaryError extends Error {
  constructor(code, options = {}) {
    const normalizedCode = safeCode(code);
    const retryable = options.retryable === true;

    super(messageForCode(normalizedCode, retryable));

    this.name = 'AthleteBoundaryError';
    this.code = normalizedCode;
    this.retryable = retryable;
    this.status = Number.isInteger(options.status)
      ? options.status
      : null;
  }
}

export const invokeAthleteBoundary = async (action, input = {}) => {
  if (!ACTIONS.has(action)) {
    throw new AthleteBoundaryError('INVALID_ACTION');
  }

  const { data, error } = await supabase.functions.invoke(
    ATHLETE_BOUNDARY_FUNCTION,
    {
      body: {
        action,
        ...input
      }
    }
  );

  if (error) {
    const payload = await readFunctionErrorPayload(error);
    const status = Number.isInteger(error?.context?.status)
      ? error.context.status
      : null;
    const payloadCode =
      typeof payload?.code === 'string'
        ? payload.code
        : null;
    const code = safeCode(
      payloadCode ||
      (status === 401 ? 'AUTH_REQUIRED' : null)
    );
    const retryable =
      payload?.retryable === true ||
      status === null ||
      status >= 500;

    console.error('Genesis athlete boundary request:', {
      action,
      code,
      status,
      retryable
    });

    throw new AthleteBoundaryError(code, {
      retryable,
      status
    });
  }

  const payload = asRecord(data);

  if (
    payload?.ok !== true ||
    payload?.allowed !== true ||
    safeCode(payload?.code) !== 'OK' ||
    payload?.action !== action
  ) {
    throw new AthleteBoundaryError(
      safeCode(payload?.code || 'BOUNDARY_RESPONSE_INVALID'),
      { retryable: payload?.retryable === true }
    );
  }

  return payload;
};
