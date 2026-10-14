export const executionKey = (
  routineDay,
  exerciseIndex,
  setNumber
) =>
  `${routineDay}:${exerciseIndex}:${setNumber}`;

const normalizedFieldValue = (
  value
) =>
  typeof value === 'string'
    ? value.trim()
    : '';

export const buildWorkoutPerformanceData = ({
  routineDay,
  routine,
  executionData,
  weightUnit
}) => {
  if (
    !routine ||
    !Array.isArray(routine.exercises)
  ) {
    throw new Error(
      'La rutina activa no tiene una estructura válida.'
    );
  }

  if (
    !executionData ||
    typeof executionData !== 'object' ||
    Array.isArray(executionData)
  ) {
    throw new Error(
      'Los datos de ejecución del entrenamiento no son válidos.'
    );
  }

  if (
    weightUnit !== 'LB' &&
    weightUnit !== 'KG'
  ) {
    throw new Error(
      'La unidad de peso seleccionada no es válida.'
    );
  }

  const exercises = [];

  routine.exercises.forEach(
    (exercise, exerciseIndex) => {
      const completedSets = [];

      const prescribedSets =
        Number.parseInt(
          exercise?.sets,
          10
        );

      if (
        !Number.isInteger(prescribedSets) ||
        prescribedSets < 1 ||
        prescribedSets > 50
      ) {
        throw new Error(
          `La cantidad de series de ${exercise?.name || `ejercicio ${exerciseIndex + 1}`} no es válida.`
        );
      }

      for (
        let setNumber = 1;
        setNumber <= prescribedSets;
        setNumber += 1
      ) {
        const key =
          executionKey(
            routineDay,
            exerciseIndex,
            setNumber
          );

        const setData =
          executionData[key] || {};

        const rawWeight =
          normalizedFieldValue(
            setData.weight
          );

        const rawReps =
          normalizedFieldValue(
            setData.reps
          );

        const rawRir =
          normalizedFieldValue(
            setData.rir
          );

        const hasAnyValue =
          rawWeight !== '' ||
          rawReps !== '' ||
          rawRir !== '';

        if (!hasAnyValue) {
          continue;
        }

        if (rawReps === '') {
          throw new Error(
            `Completa las repeticiones de ${exercise.name}, serie ${setNumber}.`
          );
        }

        const reps =
          Number(rawReps);

        const weight =
          rawWeight === ''
            ? null
            : Number(rawWeight);

        const rir =
          rawRir === ''
            ? null
            : Number(rawRir);

        if (
          !Number.isInteger(reps) ||
          reps < 0 ||
          reps > 1000
        ) {
          throw new Error(
            `Las repeticiones de ${exercise.name}, serie ${setNumber}, no son válidas.`
          );
        }

        if (
          weight !== null &&
          (
            !Number.isFinite(weight) ||
            weight < 0 ||
            weight > 5000
          )
        ) {
          throw new Error(
            `El peso de ${exercise.name}, serie ${setNumber}, no es válido.`
          );
        }

        if (
          rir !== null &&
          (
            !Number.isFinite(rir) ||
            rir < 0 ||
            rir > 10
          )
        ) {
          throw new Error(
            `El RIR de ${exercise.name}, serie ${setNumber}, debe estar entre 0 y 10.`
          );
        }

        const completedSet = {
          set_number:
            setNumber,

          reps
        };

        if (weight !== null) {
          completedSet.weight =
            weight;
        }

        if (rir !== null) {
          completedSet.rir =
            rir;
        }

        completedSets.push(
          completedSet
        );
      }

      if (completedSets.length > 0) {
        exercises.push({
          exercise_index:
            exerciseIndex,

          sets:
            completedSets
        });
      }
    }
  );

  if (exercises.length === 0) {
    return {};
  }

  return {
    schema_version: 1,
    weight_unit: weightUnit,
    exercises
  };
};