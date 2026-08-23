import {
  getEntitlements,
  canSwitchMode,
  GENESIS_MODES,
} from './index';


console.log(
  '===== GENESIS CORE TEST ====='
);


/**
 * SUPER ADMIN / ADMIN
 */

console.log(
  'SUPER ADMIN ADMIN MODE:',
  getEntitlements({
    role: 'SUPER_ADMIN',
    mode: GENESIS_MODES.ADMIN,
  })
);


/**
 * SUPER ADMIN / COACH
 */

console.log(
  'SUPER ADMIN COACH MODE:',
  getEntitlements({
    role: 'SUPER_ADMIN',
    mode: GENESIS_MODES.COACH,
  })
);


/**
 * SUPER ADMIN / ATHLETE MALE
 *
 * Debe tener 3 apps:
 *
 * TrainerPro
 * Arquitecto
 * Disciplina
 *
 * Hormonal = false
 */

console.log(
  'SUPER ADMIN ATHLETE MALE:',
  getEntitlements({
    role: 'SUPER_ADMIN',
    mode: GENESIS_MODES.ATHLETE,
    gender: 'MALE',
  })
);


/**
 * ATHLETE ELITE FEMALE
 *
 * Debe tener las 4 apps.
 */

console.log(
  'ATHLETE ELITE FEMALE:',
  getEntitlements({
    role: 'ATHLETE',
    mode: GENESIS_MODES.ATHLETE,
    plan: 'ELITE',
    gender: 'FEMALE',
  })
);


/**
 * ATHLETE ELITE MALE
 *
 * Debe tener 3 apps.
 */

console.log(
  'ATHLETE ELITE MALE:',
  getEntitlements({
    role: 'ATHLETE',
    mode: GENESIS_MODES.ATHLETE,
    plan: 'ELITE',
    gender: 'MALE',
  })
);


/**
 * SWITCH MODE
 */

console.log(
  'SUPER ADMIN → COACH:',
  canSwitchMode({
    role: 'SUPER_ADMIN',
    targetMode: GENESIS_MODES.COACH,
  })
);


console.log(
  'SUPER ADMIN → ATHLETE:',
  canSwitchMode({
    role: 'SUPER_ADMIN',
    targetMode: GENESIS_MODES.ATHLETE,
  })
);


console.log(
  'COACH IGNITION → ATHLETE:',
  canSwitchMode({
    role: 'COACH',
    targetMode: GENESIS_MODES.ATHLETE,
    coachPlan: 'IGNICION',
  })
);


console.log(
  'COACH ELITE → ATHLETE:',
  canSwitchMode({
    role: 'COACH',
    targetMode: GENESIS_MODES.ATHLETE,
    coachPlan: 'ELITE',
  })
);