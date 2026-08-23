/**
 * GENESIS OS - TRAINER PRO INTELLIGENCE ENGINE
 * Motor de Sobrecarga Progresiva Automatizada y Equivalencia Biomecánica
 */

// 1. MOTOR DE SOBRECARGA PROGRESIVA
export const calculateProgressiveOverload = (
  exerciseName, 
  actualWeight, 
  actualReps, 
  actualRIR, 
  targetRIR
) => {
  let nextWeekRecommendation = {
    exercise: exerciseName,
    action: 'MANTENER',
    newWeight: actualWeight,
    newReps: actualReps,
    message: 'Estímulo óptimo alcanzado. Mantener carga.'
  };

  const rirDifference = actualRIR - targetRIR;

  if (rirDifference >= 2) {
    nextWeekRecommendation.action = 'AUMENTAR_PESO';
    nextWeekRecommendation.newWeight = actualWeight * 1.05; 
    nextWeekRecommendation.message = 'Carga muy ligera. Aumentar peso un 5% la próxima semana.';
  } else if (rirDifference === 1) {
    nextWeekRecommendation.action = 'AUMENTAR_REPS';
    nextWeekRecommendation.newReps = parseInt(actualReps) + 2;
    nextWeekRecommendation.message = 'Buen control. Intentar 2 repeticiones extra con el mismo peso.';
  } else if (rirDifference < 0) {
    nextWeekRecommendation.action = 'DISMINUIR_PESO';
    nextWeekRecommendation.newWeight = actualWeight * 0.90; 
    nextWeekRecommendation.message = 'Fallo prematuro detectado. Reducir peso un 10% para garantizar técnica.';
  }

  return nextWeekRecommendation;
};

// 2. MOTOR DE EQUIVALENCIA FUNCIONAL (GYM vs HOME)
export const getFunctionalEquivalent = (gymExercise) => {
  const biomechanicalMatrix = {
    'Press de Banca Plano': { same_target: 'Pectoral Mayor', same_pattern: 'Empuje Horizontal', home_eq: 'Push-ups Clásicas' },
    'Press Militar Sentado': { same_target: 'Deltoides Anterior', same_pattern: 'Empuje Vertical', home_eq: 'Pike Push-ups' },
    'Jalón al Pecho': { same_target: 'Dorsal Ancho', same_pattern: 'Tracción Vertical', home_eq: 'Dominadas (Pull-ups)' },
    'Sentadilla Libre': { same_target: 'Cuádriceps', same_pattern: 'Dominante de Rodilla', home_eq: 'Sentadilla Búlgara' },
    'Peso Muerto Rumano': { same_target: 'Isquiosurales', same_pattern: 'Dominante de Cadera', home_eq: 'Peso Muerto a 1 Pierna c/ Mochila' },
    'Hip Thrust Pesado': { same_target: 'Glúteo Mayor', same_pattern: 'Extensión de Cadera', home_eq: 'Hip Thrust a 1 Pierna' }
  };

  const equivalent = biomechanicalMatrix[gymExercise];
  
  if (equivalent) {
    return {
      success: true,
      homeExercise: equivalent.home_eq,
      biomechanics: `Mantiene: ${equivalent.same_target} | Patrón: ${equivalent.same_pattern}`
    };
  }

  return { success: false, homeExercise: gymExercise, biomechanics: 'Mantener ejercicio original o usar peso corporal.' };
};