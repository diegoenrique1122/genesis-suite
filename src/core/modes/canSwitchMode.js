import { GENESIS_MODES } from './modeDefinitions';


/**
 * Determina si un usuario puede cambiar
 * al modo solicitado.
 *
 * IMPORTANTE:
 * Cambiar de modo NO cambia el role real
 * almacenado en users_master.
 */

export function canSwitchMode({
  role,
  targetMode,
  coachPlan = null,
}) {

  /**
   * SUPER ADMIN
   *
   * Puede utilizar:
   *
   * ADMIN
   * COACH ELITE
   * ATHLETE ELITE
   */

  if (role === 'SUPER_ADMIN') {

    return [
      GENESIS_MODES.ADMIN,
      GENESIS_MODES.COACH,
      GENESIS_MODES.ATHLETE,
    ].includes(targetMode);
  }


  /**
   * COACH
   *
   * Todo Coach puede utilizar su modo Coach.
   *
   * Solo Elite puede utilizar
   * el modo Athlete.
   */

  if (role === 'COACH') {

    if (targetMode === GENESIS_MODES.COACH) {
      return true;
    }

    if (
      targetMode === GENESIS_MODES.ATHLETE &&
      coachPlan === 'ELITE'
    ) {
      return true;
    }

    return false;
  }


  /**
   * ATHLETE
   *
   * Un atleta no necesita hacer switch
   * a otros roles.
   */

  return false;
}