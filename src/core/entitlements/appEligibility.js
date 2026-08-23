/**
 * GENESIS OS
 * APP ELIGIBILITY
 */


function normalizeGender(gender) {

  if (!gender) {
    return null;
  }

  const normalized = String(gender)
    .trim()
    .toUpperCase();


  if (
    normalized === 'FEMALE' ||
    normalized === 'FEMENINO' ||
    normalized === 'MUJER'
  ) {
    return 'FEMALE';
  }


  if (
    normalized === 'MALE' ||
    normalized === 'MASCULINO' ||
    normalized === 'HOMBRE'
  ) {
    return 'MALE';
  }


  return normalized;
}


/**
 * Regulación Hormonal
 *
 * Requisitos:
 *
 * - estar operando en ATHLETE MODE
 * - entitlement ELITE
 * - perfil femenino
 *
 * Puede aplicar a:
 * - ATHLETE
 * - COACH ELITE inmersivo
 * - SUPER_ADMIN inmersivo
 */

export function canUseHormonal({
  role,
  mode,
  plan,
  gender,
}) {

  const normalizedGender =
    normalizeGender(gender);


  const allowedRole = [
    'ATHLETE',
    'COACH',
    'SUPER_ADMIN',
  ].includes(role);


  return (
    allowedRole &&
    mode === 'ATHLETE' &&
    plan === 'ELITE' &&
    normalizedGender === 'FEMALE'
  );
}


export {
  normalizeGender,
};