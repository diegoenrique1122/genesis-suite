/**
 * GENESIS OS
 * APP ELIGIBILITY
 *
 * Reglas específicas para aplicaciones
 * cuya disponibilidad depende de condiciones
 * adicionales al plan.
 */


/**
 * Regulación Hormonal
 *
 * Disponible únicamente para atletas
 * Elite de género femenino.
 *
 * SUPER_ADMIN puede utilizarla solamente
 * si entra en ATHLETE MODE con un perfil
 * femenino.
 */

export function canUseHormonal({
  role,
  mode,
  plan,
  gender,
}) {

  if (role === 'SUPER_ADMIN') {

    return (
      mode === 'ATHLETE' &&
      plan === 'ELITE' &&
      gender === 'FEMALE'
    );
  }


  if (role !== 'ATHLETE') {
    return false;
  }


  return (
    mode === 'ATHLETE' &&
    plan === 'ELITE' &&
    gender === 'FEMALE'
  );
}