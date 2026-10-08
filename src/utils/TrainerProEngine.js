/**
 * GENESIS OS - TRAINER PRO CANONICAL ENGINE
 *
 * Pure domain engine for:
 * - canonical routine generation
 * - GYM / HOME exercise selection
 * - biomechanical equivalence
 * - progressive overload recommendations
 *
 * This module does not read React state or Supabase.
 */

export const TRAINING_ENVIRONMENTS = Object.freeze({
  GYM: 'GYM',
  HOME: 'HOME'
});

export const EXERCISE_LIBRARY = Object.freeze({
  Pecho: Object.freeze({
    gym: Object.freeze([
      'Press de Banca',
      'Press Inclinado',
      'Aperturas',
      'Crossover'
    ]),
    home: Object.freeze([
      'Push-ups Clásicas',
      'Push-ups Declinadas',
      'Aperturas Bandas',
      'Push-ups Diamante'
    ])
  }),

  Hombros: Object.freeze({
    gym: Object.freeze([
      'Press Militar',
      'Elevaciones Laterales',
      'Face Pull'
    ]),
    home: Object.freeze([
      'Pike Push-ups',
      'Elevaciones Laterales',
      'Band Pull-aparts'
    ])
  }),

  Espalda: Object.freeze({
    gym: Object.freeze([
      'Jalón al Pecho',
      'Remo c/ Barra',
      'Pullover',
      'Remo Mancuerna'
    ]),
    home: Object.freeze([
      'Dominadas',
      'Remo Banda',
      'Superman',
      'Remo Mochila'
    ])
  }),

  Bíceps: Object.freeze({
    gym: Object.freeze([
      'Curl c/ Barra Z',
      'Curl Martillo',
      'Curl Scott'
    ]),
    home: Object.freeze([
      'Curl Isométrico Toalla',
      'Curl Alternado Peso',
      'Curl Banda'
    ])
  }),

  Cuádriceps: Object.freeze({
    gym: Object.freeze([
      'Sentadilla Libre',
      'Prensa',
      'Sentadilla Hack',
      'Extensiones'
    ]),
    home: Object.freeze([
      'Sentadilla Búlgara',
      'Sentadilla Goblet',
      'Pistol Squats',
      'Sissy Squat'
    ])
  }),

  Pantorrillas: Object.freeze({
    gym: Object.freeze([
      'Elevación Pie',
      'Elevación Sentado',
      'Elevación Unilateral'
    ]),
    home: Object.freeze([
      'Elevación Escalón',
      'Elevación Isométrica',
      'Saltos'
    ])
  }),

  Isquiosurales: Object.freeze({
    gym: Object.freeze([
      'Peso Muerto Rumano',
      'Curl Acostado',
      'Curl Sentado',
      'Buenos Días'
    ]),
    home: Object.freeze([
      'Curl Deslizante',
      'Peso Muerto a 1 Pierna',
      'Puente de Glúteo',
      'Nordic Curl'
    ])
  }),

  Glúteos: Object.freeze({
    gym: Object.freeze([
      'Hip Thrust Pesado',
      'Abducción Máquina',
      'Patada Polea'
    ]),
    home: Object.freeze([
      'Hip Thrust a 1 Pierna',
      'Abducción Banda',
      'Frog Pumps'
    ])
  })
});

/**
 * Historical aliases are normalized here so older vocabulary
 * does not create multiple identities for the same movement.
 */
const EXERCISE_ALIASES = Object.freeze({
  'Press de Banca Plano': 'Press de Banca',
  'Press Militar Sentado': 'Press Militar',
  'Dominadas (Pull-ups)': 'Dominadas',
  'Peso Muerto a 1 Pierna c/ Mochila': 'Peso Muerto a 1 Pierna'
});

export const normalizeExerciseName = (exerciseName) => {
  const normalized =
    typeof exerciseName === 'string'
      ? exerciseName.trim()
      : '';

  return EXERCISE_ALIASES[normalized] || normalized;
};

const BIOMECHANICAL_EQUIVALENCE = Object.freeze({
  'Press de Banca': Object.freeze({
    sameTarget: 'Pectoral Mayor',
    samePattern: 'Empuje Horizontal',
    homeEquivalent: 'Push-ups Clásicas'
  }),

  'Press Militar': Object.freeze({
    sameTarget: 'Deltoides Anterior',
    samePattern: 'Empuje Vertical',
    homeEquivalent: 'Pike Push-ups'
  }),

  'Jalón al Pecho': Object.freeze({
    sameTarget: 'Dorsal Ancho',
    samePattern: 'Tracción Vertical',
    homeEquivalent: 'Dominadas'
  }),

  'Sentadilla Libre': Object.freeze({
    sameTarget: 'Cuádriceps',
    samePattern: 'Dominante de Rodilla',
    homeEquivalent: 'Sentadilla Búlgara'
  }),

  'Peso Muerto Rumano': Object.freeze({
    sameTarget: 'Isquiosurales',
    samePattern: 'Dominante de Cadera',
    homeEquivalent: 'Peso Muerto a 1 Pierna'
  }),

  'Hip Thrust Pesado': Object.freeze({
    sameTarget: 'Glúteo Mayor',
    samePattern: 'Extensión de Cadera',
    homeEquivalent: 'Hip Thrust a 1 Pierna'
  })
});

const buildExercise = ({
  name,
  muscle,
  isLarge,
  isElite
}) => ({
  name,
  muscle,
  type: isLarge
    ? 'Grupo Grande'
    : 'Grupo Pequeño',
  sets: isLarge ? 4 : 3,
  reps: isLarge ? '8-10' : '12-15',
  rir: isElite ? '1' : '2',
  restSets: isLarge ? '120s' : '90s',
  technique: 'Tensión Mecánica',
  execution: 'Ejecución controlada.'
});

const buildTrainingDay = ({
  day,
  title,
  largeMuscle,
  smallMuscle,
  environment,
  isElite
}) => {
  const environmentKey =
    environment === TRAINING_ENVIRONMENTS.HOME
      ? 'home'
      : 'gym';

  const largeExercises =
    EXERCISE_LIBRARY[largeMuscle][environmentKey]
      .map((name) =>
        buildExercise({
          name,
          muscle: largeMuscle,
          isLarge: true,
          isElite
        })
      );

  const smallExercises =
    EXERCISE_LIBRARY[smallMuscle][environmentKey]
      .map((name) =>
        buildExercise({
          name,
          muscle: smallMuscle,
          isLarge: false,
          isElite
        })
      );

  return {
    day,
    title,
    focus: `${largeMuscle} + ${smallMuscle}`,
    exercises: [
      ...largeExercises,
      ...smallExercises
    ]
  };
};

/**
 * Produces the exact routine contract consumed by Trainer Pro
 * and persisted in athletes_profile.training_plan.
 */
export const generateWeeklyRoutine = ({
  environment = TRAINING_ENVIRONMENTS.GYM,
  isElite = false
} = {}) => {
  const normalizedEnvironment =
    environment === TRAINING_ENVIRONMENTS.HOME
      ? TRAINING_ENVIRONMENTS.HOME
      : TRAINING_ENVIRONMENTS.GYM;

  return [
    buildTrainingDay({
      day: 1,
      title: 'Empuje Frontal (Push A)',
      largeMuscle: 'Pecho',
      smallMuscle: 'Hombros',
      environment: normalizedEnvironment,
      isElite
    }),

    buildTrainingDay({
      day: 2,
      title: 'Tracción Dorsal (Pull A)',
      largeMuscle: 'Espalda',
      smallMuscle: 'Bíceps',
      environment: normalizedEnvironment,
      isElite
    }),

    buildTrainingDay({
      day: 3,
      title: 'Cadena Anterior (Legs A)',
      largeMuscle: 'Cuádriceps',
      smallMuscle: 'Pantorrillas',
      environment: normalizedEnvironment,
      isElite
    }),

    buildTrainingDay({
      day: 4,
      title: 'Empuje Superior (Push B)',
      largeMuscle: 'Hombros',
      smallMuscle: 'Pecho',
      environment: normalizedEnvironment,
      isElite
    }),

    buildTrainingDay({
      day: 5,
      title: 'Cadena Posterior (Legs B)',
      largeMuscle: 'Isquiosurales',
      smallMuscle: 'Glúteos',
      environment: normalizedEnvironment,
      isElite
    }),

    buildTrainingDay({
      day: 6,
      title: 'Tracción + Core (Pull B)',
      largeMuscle: 'Espalda',
      smallMuscle: 'Bíceps',
      environment: normalizedEnvironment,
      isElite
    })
  ];
};

/**
 * Progressive overload recommendation.
 *
 * Existing behavior is intentionally retained while the engine
 * becomes the canonical owner of this domain logic.
 */
export const calculateProgressiveOverload = (
  exerciseName,
  actualWeight,
  actualReps,
  actualRIR,
  targetRIR
) => {
  const nextWeekRecommendation = {
    exercise: normalizeExerciseName(exerciseName),
    action: 'MANTENER',
    newWeight: actualWeight,
    newReps: actualReps,
    message:
      'Estímulo óptimo alcanzado. Mantener carga.'
  };

  const rirDifference =
    actualRIR - targetRIR;

  if (rirDifference >= 2) {
    nextWeekRecommendation.action =
      'AUMENTAR_PESO';

    nextWeekRecommendation.newWeight =
      actualWeight * 1.05;

    nextWeekRecommendation.message =
      'Carga muy ligera. Aumentar peso un 5% la próxima semana.';
  }
  else if (rirDifference === 1) {
    nextWeekRecommendation.action =
      'AUMENTAR_REPS';

    nextWeekRecommendation.newReps =
      Number.parseInt(actualReps, 10) + 2;

    nextWeekRecommendation.message =
      'Buen control. Intentar 2 repeticiones extra con el mismo peso.';
  }
  else if (rirDifference < 0) {
    nextWeekRecommendation.action =
      'DISMINUIR_PESO';

    nextWeekRecommendation.newWeight =
      actualWeight * 0.90;

    nextWeekRecommendation.message =
      'Fallo prematuro detectado. Reducir peso un 10% para garantizar técnica.';
  }

  return nextWeekRecommendation;
};

/**
 * Returns the canonical HOME equivalent for a GYM movement.
 * Historical aliases are accepted and normalized first.
 */
export const getFunctionalEquivalent = (
  gymExercise
) => {
  const canonicalName =
    normalizeExerciseName(gymExercise);

  const equivalent =
    BIOMECHANICAL_EQUIVALENCE[
      canonicalName
    ];

  if (equivalent) {
    return {
      success: true,
      homeExercise:
        equivalent.homeEquivalent,
      biomechanics:
        `Mantiene: ${equivalent.sameTarget} | Patrón: ${equivalent.samePattern}`
    };
  }

  return {
    success: false,
    homeExercise: canonicalName,
    biomechanics:
      'Mantener ejercicio original o usar peso corporal.'
  };
};