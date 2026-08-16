export type LatLng = { lat: number; lng: number };

export const CITIES = {
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Jabalpur: { lat: 23.1815, lng: 79.9864 },
  Indore: { lat: 22.7196, lng: 75.8577 },
  Bhopal: { lat: 23.2599, lng: 77.4126 },
  Nagpur: { lat: 21.1458, lng: 79.0882 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Delhi: { lat: 28.6139, lng: 77.209 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Hyderabad: { lat: 17.3850, lng: 78.4867 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Surat: { lat: 21.1702, lng: 72.8311 },
  Lucknow: { lat: 26.8467, lng: 80.9462 },
  Kanpur: { lat: 26.4499, lng: 80.3319 },
  Raipur: { lat: 21.2514, lng: 81.6296 },
  Gwalior: { lat: 26.2183, lng: 78.1828 },
  Varanasi: { lat: 25.3176, lng: 82.9739 },
  Patna: { lat: 25.5941, lng: 85.1376 },
  Agra: { lat: 27.1767, lng: 78.0081 },
  Kota: { lat: 25.2138, lng: 75.8648 },
  Ludhiana: { lat: 30.9010, lng: 75.8573 },
  Chandigarh: { lat: 30.7333, lng: 76.7794 },
  Katni: { lat: 23.8343, lng: 80.3986 },
  Satna: { lat: 24.5800, lng: 80.8300 },
  Rewa: { lat: 24.5362, lng: 81.3037 },
  Sagar: { lat: 23.8388, lng: 78.7378 },
  Ujjain: { lat: 23.1765, lng: 75.7885 },
} satisfies Record<string, LatLng>;

export const CITY_NAMES = Object.keys(CITIES);

export function findNearestCity(coord: LatLng): string {
  let nearest = "Jabalpur";
  let minDistance = Infinity;
  for (const [cityName, cityCoord] of Object.entries(CITIES)) {
    const dist = haversineKm(coord, cityCoord);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = cityName;
    }
  }
  return nearest;
}

export function resolveLocation(query: string): { name: string; lat: number; lng: number } {
  const clean = query.trim().toLowerCase();
  const match = Object.keys(CITIES).find((c) => c.toLowerCase() === clean);
  if (match) {
    return { name: match, ...CITIES[match as keyof typeof CITIES] };
  }
  const partial = Object.keys(CITIES).find((c) => c.toLowerCase().includes(clean) || clean.includes(c.toLowerCase()));
  if (partial) {
    return { name: partial, ...CITIES[partial as keyof typeof CITIES] };
  }
  // Default to Jabalpur center for unrecognized location
  return { name: query.trim() || "Jabalpur", lat: 23.1815, lng: 79.9864 };
}

/** Great-circle distance in km. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Road distance approximation for Indian highways. */
export function roadKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * 1.25);
}

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.round(n));

export const formatKm = (n: number) => `${Math.round(n).toLocaleString("en-IN")} km`;
