import {
  COACH_PLANS,
  ATHLETE_PLANS,
} from '../plans/planDefinitions';

import {
  canUseHormonal,
} from './appEligibility';


export function getEntitlements({
  role,
  mode = null,
  plan = null,
  gender = null,
}) {

  /**
   * =====================================================
   * SUPER ADMIN
   * =====================================================
   */

  if (role === 'SUPER_ADMIN') {

    /**
     * ADMIN MODE
     */

    if (mode === 'ADMIN') {

      return {
        role: 'SUPER_ADMIN',
        mode: 'ADMIN',

        apps: {
          trainerPro: false,
          architect: false,
          discipline: false,
          hormonal: false,
        },

        features: {
          adminConsole: true,
          manageCoaches: true,
          manageAthletes: true,
          managePlans: true,
          manageThemes: true,
          manageSystem: true,
          auditSystem: true,
        },
      };
    }


    /**
     * COACH MODE
     *
     * Super Admin siempre entra
     * como Coach Elite.
     */

    if (mode === 'COACH') {

      return getCoachEntitlements({
        role,
        plan: 'ELITE',
      });
    }


    /**
     * ATHLETE MODE
     *
     * Super Admin siempre entra
     * como Atleta Elite.
     */

    if (mode === 'ATHLETE') {

      return getAthleteEntitlements({
        role,
        mode,
        plan: 'ELITE',
        gender,
      });
    }
  }


  /**
   * =====================================================
   * COACH
   * =====================================================
   */

  if (role === 'COACH') {

    return getCoachEntitlements({
      role,
      plan,
    });
  }


  /**
   * =====================================================
   * ATHLETE
   * =====================================================
   */

  if (role === 'ATHLETE') {

    return getAthleteEntitlements({
      role,
      mode: 'ATHLETE',
      plan,
      gender,
    });
  }


  /**
   * =====================================================
   * FALLBACK
   * =====================================================
   */

  return {
    role: null,
    mode: null,
    plan: null,

    apps: {},
    features: {},
  };
}


/**
 * =====================================================
 * COACH ENTITLEMENTS
 * =====================================================
 */

function getCoachEntitlements({
  role,
  plan,
}) {

  const normalizedPlan =
    plan || 'IGNICION';

  const definition =
    COACH_PLANS[normalizedPlan] ||
    COACH_PLANS.IGNICION;


  return {
    role,
    mode: 'COACH',
    plan: definition.id,

    athleteLimit: definition.athleteLimit,

    apps: {
      ...definition.apps,

      /**
       * El hormonal no forma parte
       * del ecosistema personal del Coach.
       */
      hormonal: false,
    },

    features: {
      ...definition.features,
    },
  };
}


/**
 * =====================================================
 * ATHLETE ENTITLEMENTS
 * =====================================================
 */

function getAthleteEntitlements({
  role,
  mode,
  plan,
  gender,
}) {

  const normalizedPlan =
    plan || 'IGNICION';

  const definition =
    ATHLETE_PLANS[normalizedPlan] ||
    ATHLETE_PLANS.IGNICION;


  return {
    role,
    mode: 'ATHLETE',
    plan: definition.id,

    apps: {
      ...definition.apps,

      hormonal: canUseHormonal({
        role,
        mode,
        plan: definition.id,
        gender,
      }),
    },

    features: {
      ...definition.features,
    },
  };
}