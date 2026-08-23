import { GENESIS_MODES } from './modeDefinitions';


/**
 * GENESIS OS
 * MODE ACCESS ENGINE
 *
 * IMPORTANTE:
 * El modo operacional NO modifica users_master.role.
 */

export function canSwitchMode({
  role,
  targetMode,
  coachPlan = null,
}) {

  /**
   * SUPER ADMIN
   *
   * Puede operar como:
   * - ADMIN
   * - COACH ELITE
   * - ATHLETE ELITE
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
   * Puede permanecer únicamente
   * en su modo ATHLETE.
   */

  if (role === 'ATHLETE') {
    return targetMode === GENESIS_MODES.ATHLETE;
  }


  return false;
}