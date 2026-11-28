export interface Coordinates {
  lat: number;
  lng: number;
}

export function isValidCoordinates(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Computes great-circle Haversine distance in kilometers (1 decimal place).
 */
export function calculateDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Rounds coordinates to ~1.1 km precision (2 decimal places) so exact
 * private player coordinates are never exposed in public discovery APIs.
 */
export function approximateCoords(lat: number, lng: number): Coordinates {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  };
}

export function formatDistance(km: number | null | undefined): string {
  if (km === null || km === undefined || !Number.isFinite(km)) {
    return 'Distance unavailable';
  }
  if (km < 1) return '< 1 km';
  return `${km.toFixed(1)} km`;
}
