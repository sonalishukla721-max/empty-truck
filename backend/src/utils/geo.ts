export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Road distance estimate: straight-line × 1.25 */
export function roadKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * 1.25);
}

export const INDIAN_CITIES: Record<string, LatLng> = {
  Delhi: { lat: 28.6139, lng: 77.209 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Indore: { lat: 22.7196, lng: 75.8577 },
  Bhopal: { lat: 23.2599, lng: 77.4126 },
  Nagpur: { lat: 21.1458, lng: 79.0882 },
  Jabalpur: { lat: 23.1815, lng: 79.9864 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Bangalore: { lat: 12.9716, lng: 77.5946 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Surat: { lat: 21.1702, lng: 72.8311 },
};

export function resolveCity(name: string): LatLng | null {
  const key = Object.keys(INDIAN_CITIES).find(
    (c) => c.toLowerCase() === name.trim().toLowerCase(),
  );
  return key ? INDIAN_CITIES[key] : null;
}

export function interpolateRoute(start: LatLng, end: LatLng, steps: number): LatLng[] {
  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    });
  }
  return points;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
