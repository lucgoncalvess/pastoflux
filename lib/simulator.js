export function simulateGrazing({ animals, area, availability }) {
  if (![animals, area, availability].every(Number.isFinite) || animals <= 0 || area <= 0 || availability < 0 || availability > 100) {
    throw new Error("Informe animais, área e disponibilidade válidos.");
  }
  return Math.max(1, Math.round((area * 8 * (availability / 100)) / animals));
}
