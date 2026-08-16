import { haversineKm, roadKm, type LatLng } from "./geo";

/**
 * Deterministic return-load matching engine.
 * AI is NOT used for scoring — only for voice/intent/explanation layers.
 * All impact figures are ESTIMATES from the configurable assumptions below.
 */
export const IMPACT_ASSUMPTIONS = {
  /** Litres of diesel per km for a loaded medium/heavy truck (estimate). */
  fuelPerKm: 0.15,
  /** kg CO2 per litre of diesel (estimate). */
  co2PerLitre: 2.35,
  /** Platform fair-rate anchor: INR per km per tonne at a 300 km leg (estimate). */
  ratePerKmPerTonne: 10,
  /** Long-haul taper exponent applied to the rate anchor (estimate). */
  rateTaper: 0.8,
  /** Weight used for the matching engine components. */
  weights: {
    route: 0.3,
    distance: 0.25,
    capacity: 0.2,
    timing: 0.1,
    price: 0.1,
    trust: 0.05,
  },
};

export type TruckInput = {
  id: string;
  capacity: number;
  truck_type: string;
  /** Where the truck becomes empty (current trip destination). */
  destination: LatLng;
  /** Where the truck ideally returns to (current trip origin / home base). */
  homeBase?: LatLng | null;
  available_from?: string | null;
};

export type LoadInput = {
  id: string;
  pickup: LatLng;
  delivery: LatLng;
  weight: number;
  truck_type: string;
  budget: number;
  pickup_time: string;
  shipper_trust?: number | null;
  pickup_location: string;
  delivery_location: string;
};

export type MatchResult = {
  loadId: string;
  matchScore: number;
  breakdown: {
    route: number;
    distance: number;
    capacity: number;
    timing: number;
    price: number;
    trust: number;
  };
  reasons: string[];
  deadheadKm: number;
  estimatedEarning: number;
  emptyKmAvoided: number;
  estimatedFuelSaved: number;
  estimatedCo2Avoided: number;
  fairRate: { low: number; high: number; suggested: number };
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function fairRate(distanceKm: number, weightTonnes: number) {
  const effectiveRate =
    IMPACT_ASSUMPTIONS.ratePerKmPerTonne *
    Math.pow(300 / Math.max(distanceKm, 100), IMPACT_ASSUMPTIONS.rateTaper);
  const base = distanceKm * Math.max(weightTonnes, 3) * effectiveRate;
  return {
    low: Math.round((base * 0.9) / 500) * 500,
    high: Math.round((base * 1.12) / 500) * 500,
    suggested: Math.round(base / 500) * 500,
  };
}

export function scoreMatch(truck: TruckInput, load: LoadInput): MatchResult {
  const w = IMPACT_ASSUMPTIONS.weights;
  const deadheadKm = roadKm(truck.destination, load.pickup);

  // Distance: how far the truck must run empty to reach the pickup point.
  const distance = clamp01(1 - deadheadKm / 150);

  // Route: does the load carry the truck back towards its home base?
  const home = truck.homeBase ?? null;
  // Route: directional alignment between "empty point -> home base" and
  // "empty point -> load delivery". A load pointing home scores highest.
  let route = 0.55;
  if (home) {
    const toHome = { x: home.lng - truck.destination.lng, y: home.lat - truck.destination.lat };
    const toLoad = {
      x: load.delivery.lng - truck.destination.lng,
      y: load.delivery.lat - truck.destination.lat,
    };
    const magA = Math.hypot(toHome.x, toHome.y);
    const magB = Math.hypot(toLoad.x, toLoad.y);
    const cos = magA && magB ? (toHome.x * toLoad.x + toHome.y * toLoad.y) / (magA * magB) : 0;
    route = clamp01((cos + 1) / 2);
  }

  // Capacity: reward good utilisation, penalise overload.
  const ratio = load.weight / Math.max(truck.capacity, 1);
  const capacity = ratio > 1 ? 0 : clamp01(1 - Math.abs(0.85 - ratio) / 0.85);

  // Timing: pickup should follow availability within ~24 hours.
  const availableAt = truck.available_from ? new Date(truck.available_from).getTime() : Date.now();
  const gapHours = (new Date(load.pickup_time).getTime() - availableAt) / 3_600_000;
  const timing = gapHours < -3 ? 0 : clamp01(1 - Math.abs(gapHours - 4) / 36);

  // Price: budget compared to the estimated platform fair rate.
  const legKm = roadKm(load.pickup, load.delivery);
  const fr = fairRate(legKm, load.weight);
  const price = clamp01(0.5 + (load.budget - fr.suggested) / Math.max(fr.suggested, 1));

  const trust = clamp01((load.shipper_trust ?? 4) / 5);

  const typeMatch = truck.truck_type === load.truck_type ? 1 : 0.75;

  const matchScore = Math.round(
    (route * w.route +
      distance * w.distance +
      capacity * w.capacity +
      timing * w.timing +
      price * w.price +
      trust * w.trust) *
      typeMatch *
      100,
  );

  // Impact: without a return load the truck would run home empty.
  const baselineEmptyKm = home ? roadKm(truck.destination, home) : legKm;
  const emptyKmAvoided = Math.max(0, baselineEmptyKm - deadheadKm);
  const estimatedFuelSaved = Math.round(emptyKmAvoided * IMPACT_ASSUMPTIONS.fuelPerKm);
  const estimatedCo2Avoided = Math.round(estimatedFuelSaved * IMPACT_ASSUMPTIONS.co2PerLitre);

  const reasons: string[] = [];
  if (route > 0.6) reasons.push("Load moves the truck back along its home route");
  if (deadheadKm <= 25) reasons.push(`Pickup only ${deadheadKm} km from delivery point`);
  else if (distance > 0.5) reasons.push(`Pickup ${deadheadKm} km away — short empty run`);
  if (capacity > 0.7) reasons.push(`${load.weight} T fits a ${truck.capacity} T truck well`);
  if (load.weight > truck.capacity) reasons.push("Load exceeds truck capacity");
  if (timing > 0.6) reasons.push("Pickup time matches expected availability");
  if (price >= 0.5) reasons.push("Rate is at or above the estimated platform range");
  else reasons.push("Rate is below the estimated platform range");
  if (truck.truck_type !== load.truck_type) reasons.push("Different truck type requested");

  return {
    loadId: load.id,
    matchScore: Math.max(0, Math.min(99, matchScore)),
    breakdown: { route, distance, capacity, timing, price, trust },
    reasons,
    deadheadKm,
    estimatedEarning: load.budget,
    emptyKmAvoided,
    estimatedFuelSaved,
    estimatedCo2Avoided,
    fairRate: fr,
  };
}

export function rankReturnLoads(truck: TruckInput, loads: LoadInput[], radiusKm = 50) {
  return loads
    .map((load) => ({ load, match: scoreMatch(truck, load) }))
    .filter((r) => r.match.deadheadKm <= radiusKm)
    .sort((a, b) => b.match.matchScore - a.match.matchScore);
}
