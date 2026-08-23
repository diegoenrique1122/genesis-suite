import {
  COACH_PLANS,
  ATHLETE_PLANS,
} from '../plans/planDefinitions';

import {
  canUseHormonal,
} from './appEligibility';


/**
 * =====================================================
 * NORMALIZACIÓN DE APP ÚNICA
 * =====================================================
 */

function normalizeSelectedApp(
  selectedAppSingle
) {

  const value = String(
    selectedAppSingle || 'TRAINING'
  )
    .trim()
    .toUpperCase();


  if (
    [
      'TRAINING',
      'TRAINER',
      'TRAINER_PRO',
      'APPTRAINERPRO',
      'ENTRENAMIENTO',
    ].includes(value)
  ) {
    return 'TRAINING';
  }


  if (
    [
      'ARCHITECT',
      'ARQUITECTO',
      'NUTRITION',
      'NUTRICION',
    ].includes(value)
  ) {
    return 'ARCHITECT';
  }


  /**
   * Compatibilidad con la DB actual.
   *
   * selected_app_single actualmente
   * utiliza TRAINING como default.
   */

  return 'TRAINING';
}


/**
 * =====================================================
 * MAIN ENTITLEMENT ENGINE
 * =====================================================
 */

export function getEntitlements({

  role,

  mode = null,

  /**
   * plan se mantiene por compatibilidad
   * con el código creado anteriormente.
   */

  plan = null,

  coachPlan = null,

  athletePlan = null,

  gender = null,

  selectedAppSingle = null,

}) {

  /**
   * =====================================================
   * SUPER ADMIN
   * =====================================================
   */

  if (role === 'SUPER_ADMIN') {

    if (mode === 'ADMIN') {

      return {

        role: 'SUPER_ADMIN',

        mode: 'ADMIN',

        plan: null,

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
     * SUPER ADMIN
     * COACH MODE
     *
     * Siempre opera con capacidades Elite.
     */

    if (mode === 'COACH') {

      return getCoachEntitlements({

        role,

        plan: 'ELITE',
      });
    }


    /**
     * SUPER ADMIN
     * ATHLETE MODE
     *
     * Siempre opera como Athlete Elite.
     *
     * El género continúa siendo obligatorio
     * para Regulación Hormonal.
     */

    if (mode === 'ATHLETE') {

      return getAthleteEntitlements({

        role,

        mode: 'ATHLETE',

        plan: 'ELITE',

        gender,

        selectedAppSingle,
      });
    }
  }


  /**
   * =====================================================
   * COACH
   * =====================================================
   */

  if (role === 'COACH') {

    const effectiveCoachPlan =
      coachPlan ||
      plan ||
      'IGNICION';


    /**
     * COACH ELITE
     * ATHLETE MODE
     */

    if (mode === 'ATHLETE') {

      if (
        effectiveCoachPlan !== 'ELITE'
      ) {

        return {

          role,

          mode: 'ATHLETE',

          plan: null,

          apps: {
            trainerPro: false,
            architect: false,
            discipline: false,
            hormonal: false,
          },

          features: {},
        };
      }


      return getAthleteEntitlements({

        role,

        mode: 'ATHLETE',

        plan: 'ELITE',

        gender,

        selectedAppSingle,
      });
    }


    /**
     * COACH MODE NORMAL
     */

    return getCoachEntitlements({

      role,

      plan: effectiveCoachPlan,
    });
  }


  /**
   * =====================================================
   * ATHLETE
   * =====================================================
   */

  if (role === 'ATHLETE') {

    const effectiveAthletePlan =
      athletePlan ||
      plan ||
      'IGNICION';


    return getAthleteEntitlements({

      role,

      mode: 'ATHLETE',

      plan: effectiveAthletePlan,

      gender,

      selectedAppSingle,
    });
  }


  /**
   * =====================================================
   * FAIL CLOSED
   * =====================================================
   */

  return {

    role: null,

    mode: null,

    plan: null,

    apps: {
      trainerPro: false,
      architect: false,
      discipline: false,
      hormonal: false,
    },

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

    athleteLimit:
      definition.athleteLimit,

    apps: {
      ...definition.apps,

      /**
       * Las apps aquí representan
       * disponibilidad funcional del Coach,
       * no Athlete Mode.
       *
       * Athlete Mode se calcula arriba.
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

  selectedAppSingle,

}) {

  const normalizedPlan =
    plan || 'IGNICION';


  const definition =
    ATHLETE_PLANS[normalizedPlan] ||
    ATHLETE_PLANS.IGNICION;


  let apps = {
    ...definition.apps,
  };


  /**
   * =====================================================
   * IGNITION SINGLE APP
   * =====================================================
   */

  if (
    definition.id === 'IGNICION'
  ) {

    const selectedApp =
      normalizeSelectedApp(
        selectedAppSingle
      );


    apps = {

      trainerPro:
        selectedApp === 'TRAINING',

      architect:
        selectedApp === 'ARCHITECT',

      discipline: false,

      hormonal: false,
    };
  }


  /**
   * =====================================================
   * HORMONAL ELIGIBILITY
   * =====================================================
   */

  apps.hormonal =
    canUseHormonal({

      role,

      mode,

      plan: definition.id,

      gender,
    });


  return {

    role,

    mode: 'ATHLETE',

    plan: definition.id,

    apps,

    features: {
      ...definition.features,
    },
  };
}