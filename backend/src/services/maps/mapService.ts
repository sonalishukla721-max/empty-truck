import { config } from "../../config/index.js";
import { haversineKm, roadKm, resolveCity, type LatLng } from "../../utils/geo.js";

export type MapRoute = {
  distanceKm: number;
  durationMinutes: number;
  polyline: LatLng[];
};

export async function geocode(address: string): Promise<LatLng & { city?: string }> {
  if (config.demo.map) {
    const city = resolveCity(address);
    if (city) return { ...city, city: address };
    return { lat: 23.2599, lng: 77.4126, city: address };
  }
  // Google Maps geocoding would go here when API key is set
  const city = resolveCity(address);
  return city ? { ...city, city: address } : { lat: 23.2599, lng: 77.4126, city: address };
}

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  if (config.demo.map) {
    const nearest = Object.entries(
      (await import("../../utils/geo.js")).INDIAN_CITIES,
    ).sort(([, a], [, b]) => haversineKm({ lat, lng }, a) - haversineKm({ lat, lng }, b))[0];
    return nearest?.[0] ?? "Unknown";
  }
  return "Unknown";
}

export function calculateDistance(a: LatLng, b: LatLng): number {
  return roadKm(a, b);
}

export async function calculateRoute(start: LatLng, end: LatLng): Promise<MapRoute> {
  const distanceKm = roadKm(start, end);
  const durationMinutes = Math.round((distanceKm / 50) * 60); // ~50 km/h avg
  const steps = Math.max(10, Math.min(50, Math.floor(distanceKm / 20)));
  const polyline: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    polyline.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
    });
  }
  return { distanceKm, durationMinutes, polyline };
}

export async function estimateETA(start: LatLng, end: LatLng, speedKmh = 50): Promise<Date> {
  const distanceKm = roadKm(start, end);
  const hours = distanceKm / speedKmh;
  return new Date(Date.now() + hours * 3600 * 1000);
}
