const POUNDS_PER_KILOGRAM = 2.2046226218;
const CENTIMETERS_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

const asFiniteNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const kilogramsToPounds = (kilograms) => {
  const value = asFiniteNumber(kilograms);
  return value === null ? null : value * POUNDS_PER_KILOGRAM;
};

export const poundsToKilograms = (pounds) => {
  const value = asFiniteNumber(pounds);
  return value === null ? null : value / POUNDS_PER_KILOGRAM;
};

export const centimetersToFeetInches = (centimeters) => {
  const value = asFiniteNumber(centimeters);
  if (value === null || value <= 0) return null;

  const totalInches = Math.round(value / CENTIMETERS_PER_INCH);
  const feet = Math.floor(totalInches / INCHES_PER_FOOT);
  const inches = totalInches % INCHES_PER_FOOT;

  return { feet, inches };
};

export const feetInchesToCentimeters = (feet, inches) => {
  const feetValue = asFiniteNumber(feet);
  const inchesValue = asFiniteNumber(inches);

  if (
    feetValue === null ||
    inchesValue === null ||
    feetValue < 0 ||
    inchesValue < 0 ||
    inchesValue >= INCHES_PER_FOOT
  ) {
    return null;
  }

  return (feetValue * INCHES_PER_FOOT + inchesValue) * CENTIMETERS_PER_INCH;
};

export const formatMeasurementInput = (value, decimals = 1) => {
  const numericValue = asFiniteNumber(value);
  if (numericValue === null) return '';

  return Number(numericValue.toFixed(decimals)).toString();
};