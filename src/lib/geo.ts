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
} satisfies Record<string, LatLng>;

export const CITY_NAMES = Object.keys(CITIES);

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
