export function safeOverpassRadiusMeters(radiusKm: number, maximumKm: number, fallbackKm: number) {
  const safeMaximum = Number.isFinite(maximumKm) && maximumKm > 0 ? maximumKm : fallbackKm;
  const safeFallback = Number.isFinite(fallbackKm) && fallbackKm > 0 ? fallbackKm : 1;
  const kilometers = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : safeFallback;
  return Math.round(Math.min(kilometers, safeMaximum) * 1000);
}
