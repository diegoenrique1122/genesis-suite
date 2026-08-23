/**
 * GENESIS OS
 * APP ELIGIBILITY
 *
 * Reglas adicionales de elegibilidad
 * independientes del plan comercial.
 */

function normalizeGender(gender) {
  if (!gender) return null;

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


export function canUseHormonal({
  role,
  mode,
  plan,
  gender,
}) {
  const normalizedGender =
    normalizeGender(gender);

  if (role === 'SUPER_ADMIN') {
    return (
      mode === 'ATHLETE' &&
      plan === 'ELITE' &&
      normalizedGender === 'FEMALE'
    );
  }

  if (role !== 'ATHLETE') {
    return false;
  }

  return (
    mode === 'ATHLETE' &&
    plan === 'ELITE' &&
    normalizedGender === 'FEMALE'
  );
}


export {
  normalizeGender,
};