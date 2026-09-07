import assert from 'node:assert/strict';
import {
  centimetersToFeetInches,
  feetInchesToCentimeters,
  formatMeasurementInput,
  kilogramsToPounds,
  poundsToKilograms,
} from '../src/core/measurementUnits.js';

assert.equal(
  Number(kilogramsToPounds(70).toFixed(2)),
  154.32
);

assert.equal(
  Number(poundsToKilograms(154.323583526).toFixed(2)),
  70
);

assert.deepEqual(
  centimetersToFeetInches(175),
  { feet: 5, inches: 9 }
);

assert.equal(
  Math.round(feetInchesToCentimeters(5, 9)),
  175
);

assert.equal(feetInchesToCentimeters(5, 12), null);
assert.equal(kilogramsToPounds(''), null);
assert.equal(formatMeasurementInput(70.0001), '70');

console.log('GENESIS_C3B14_MEASUREMENT_CORE_TEST_PASS');