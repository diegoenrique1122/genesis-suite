import {
  getEntitlements,
  canSwitchMode,
  GENESIS_MODES,
} from './index';


console.log(
  '========================================'
);

console.log(
  '===== GENESIS OS CORE TEST SUITE ====='
);

console.log(
  '========================================'
);


/**
 * =====================================================
 * TEST 1
 * SUPER ADMIN / ADMIN MODE
 * =====================================================
 */

console.log(
  '\n[TEST 1] SUPER ADMIN → ADMIN MODE'
);

console.log(
  getEntitlements({
    role: 'SUPER_ADMIN',
    mode: GENESIS_MODES.ADMIN,
  })
);


/**
 * =====================================================
 * TEST 2
 * SUPER ADMIN / COACH MODE
 *
 * Debe comportarse como Coach ELITE.
 * =====================================================
 */

console.log(
  '\n[TEST 2] SUPER ADMIN → COACH ELITE MODE'
);

console.log(
  getEntitlements({
    role: 'SUPER_ADMIN',
    mode: GENESIS_MODES.COACH,
  })
);


/**
 * =====================================================
 * TEST 3
 * SUPER ADMIN / ATHLETE MODE / MALE
 *
 * Debe tener:
 *
 * TrainerPro   = true
 * Arquitecto   = true
 * Disciplina   = true
 * Hormonal     = false
 * =====================================================
 */

console.log(
  '\n[TEST 3] SUPER ADMIN → ATHLETE ELITE / MALE'
);

console.log(
  getEntitlements({
    role: 'SUPER_ADMIN',
    mode: GENESIS_MODES.ATHLETE,
    gender: 'MALE',
  })
);


/**
 * =====================================================
 * TEST 4
 * SUPER ADMIN / ATHLETE MODE
 * VALOR REAL DE SUPABASE: Masculino
 *
 * Debe producir exactamente el mismo resultado
 * que MALE.
 * =====================================================
 */

console.log(
  '\n[TEST 4] SUPER ADMIN → ATHLETE ELITE / Masculino DB'
);

console.log(
  getEntitlements({
    role: 'SUPER_ADMIN',
    mode: GENESIS_MODES.ATHLETE,
    gender: 'Masculino',
  })
);


/**
 * =====================================================
 * TEST 5
 * ATHLETE ELITE / FEMALE
 *
 * Debe tener las 4 aplicaciones.
 * =====================================================
 */

console.log(
  '\n[TEST 5] ATHLETE ELITE / FEMALE'
);

console.log(
  getEntitlements({
    role: 'ATHLETE',
    mode: GENESIS_MODES.ATHLETE,
    plan: 'ELITE',
    gender: 'FEMALE',
  })
);


/**
 * =====================================================
 * TEST 6
 * ATHLETE ELITE
 * VALOR REAL DE SUPABASE: Femenino
 *
 * Debe tener:
 *
 * TrainerPro   = true
 * Arquitecto   = true
 * Disciplina   = true
 * Hormonal     = true
 * =====================================================
 */

console.log(
  '\n[TEST 6] ATHLETE ELITE / Femenino DB'
);

console.log(
  getEntitlements({
    role: 'ATHLETE',
    mode: GENESIS_MODES.ATHLETE,
    plan: 'ELITE',
    gender: 'Femenino',
  })
);


/**
 * =====================================================
 * TEST 7
 * ATHLETE ELITE / MALE
 *
 * Debe tener 3 aplicaciones.
 * Hormonal debe ser false.
 * =====================================================
 */

console.log(
  '\n[TEST 7] ATHLETE ELITE / MALE'
);

console.log(
  getEntitlements({
    role: 'ATHLETE',
    mode: GENESIS_MODES.ATHLETE,
    plan: 'ELITE',
    gender: 'MALE',
  })
);


/**
 * =====================================================
 * TEST 8
 * ATHLETE ELITE
 * VALOR REAL DE SUPABASE: Masculino
 *
 * Hormonal debe ser false.
 * =====================================================
 */

console.log(
  '\n[TEST 8] ATHLETE ELITE / Masculino DB'
);

console.log(
  getEntitlements({
    role: 'ATHLETE',
    mode: GENESIS_MODES.ATHLETE,
    plan: 'ELITE',
    gender: 'Masculino',
  })
);


/**
 * =====================================================
 * TEST 9
 * ATHLETE EVOLUCION
 *
 * Hormonal debe permanecer bloqueado.
 * =====================================================
 */

console.log(
  '\n[TEST 9] ATHLETE EVOLUCION / Femenino'
);

console.log(
  getEntitlements({
    role: 'ATHLETE',
    mode: GENESIS_MODES.ATHLETE,
    plan: 'EVOLUCION',
    gender: 'Femenino',
  })
);


/**
 * =====================================================
 * TEST 10
 * ATHLETE IGNICION
 *
 * Hormonal debe permanecer bloqueado.
 * =====================================================
 */

console.log(
  '\n[TEST 10] ATHLETE IGNICION / Femenino'
);

console.log(
  getEntitlements({
    role: 'ATHLETE',
    mode: GENESIS_MODES.ATHLETE,
    plan: 'IGNICION',
    gender: 'Femenino',
  })
);


/**
 * =====================================================
 * SWITCH MODE TESTS
 * =====================================================
 */


/**
 * SUPER ADMIN → COACH
 *
 * Esperado: true
 */

console.log(
  '\n[TEST 11] SUPER ADMIN → COACH:',
  canSwitchMode({
    role: 'SUPER_ADMIN',
    targetMode: GENESIS_MODES.COACH,
  })
);


/**
 * SUPER ADMIN → ATHLETE
 *
 * Esperado: true
 */

console.log(
  '\n[TEST 12] SUPER ADMIN → ATHLETE:',
  canSwitchMode({
    role: 'SUPER_ADMIN',
    targetMode: GENESIS_MODES.ATHLETE,
  })
);


/**
 * SUPER ADMIN → ADMIN
 *
 * Esperado: true
 */

console.log(
  '\n[TEST 13] SUPER ADMIN → ADMIN:',
  canSwitchMode({
    role: 'SUPER_ADMIN',
    targetMode: GENESIS_MODES.ADMIN,
  })
);


/**
 * COACH IGNICION → ATHLETE
 *
 * Esperado: false
 */

console.log(
  '\n[TEST 14] COACH IGNICION → ATHLETE:',
  canSwitchMode({
    role: 'COACH',
    targetMode: GENESIS_MODES.ATHLETE,
    coachPlan: 'IGNICION',
  })
);


/**
 * COACH EVOLUCION → ATHLETE
 *
 * Esperado: false
 */

console.log(
  '\n[TEST 15] COACH EVOLUCION → ATHLETE:',
  canSwitchMode({
    role: 'COACH',
    targetMode: GENESIS_MODES.ATHLETE,
    coachPlan: 'EVOLUCION',
  })
);


/**
 * COACH ELITE → ATHLETE
 *
 * Esperado: true
 */

console.log(
  '\n[TEST 16] COACH ELITE → ATHLETE:',
  canSwitchMode({
    role: 'COACH',
    targetMode: GENESIS_MODES.ATHLETE,
    coachPlan: 'ELITE',
  })
);


/**
 * ATHLETE → COACH
 *
 * Esperado: false
 */

console.log(
  '\n[TEST 17] ATHLETE → COACH:',
  canSwitchMode({
    role: 'ATHLETE',
    targetMode: GENESIS_MODES.COACH,
  })
);


console.log(
  '\n========================================'
);

console.log(
  '===== END GENESIS CORE TEST SUITE ====='
);

console.log(
  '========================================'
);