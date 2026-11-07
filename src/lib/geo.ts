export type LatLng = { lat: number; lng: number };

const R = 6371; // km

export function haversineKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Accepts a new GPS fix only if it is plausible: reasonable accuracy, moved far enough to
 * not be jitter, and not faster than a person can run (filters GPS jumps).
 */
export function acceptFix(prev: LatLng | null, next: LatLng, accuracyM: number | null | undefined, dtSec: number): { accept: boolean; km: number } {
  if (accuracyM != null && accuracyM > 35) return { accept: false, km: 0 };
  if (!prev) return { accept: true, km: 0 };
  const km = haversineKm(prev, next);
  if (km < 0.003) return { accept: false, km: 0 }; // < 3 m: jitter
  if (dtSec > 0 && km / (dtSec / 3600) > 36) return { accept: false, km: 0 }; // > 36 km/h: jump
  return { accept: true, km };
}

export function paceSecPerKm(distanceKm: number, durationSec: number): number {
  if (distanceKm <= 0) return 0;
  return durationSec / distanceKm;
}

/** Downsample a route to at most n points to keep Firestore documents small. */
export function thinRoute<T>(pts: T[], n = 300): T[] {
  if (pts.length <= n) return pts;
  const step = pts.length / n;
  return Array.from({ length: n }, (_, i) => pts[Math.floor(i * step)]);
}
