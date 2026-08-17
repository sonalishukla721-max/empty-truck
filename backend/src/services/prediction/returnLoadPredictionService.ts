import { roadKm, type LatLng } from "../../utils/geo.js";

export type TruckPredictionInput = {
  currentLat: number;
  currentLng: number;
  destinationLat: number;
  destinationLng: number;
  estimatedArrival?: Date | null;
  status: string;
  capacityKg: number;
  truckType: string;
};

export type EmptyTripPrediction = {
  emptySoon: boolean;
  predictedEmptyTime: Date;
  predictedEmptyLocation: LatLng & { city?: string };
  confidenceScore: number;
  hoursUntilEmpty: number;
};

export function predictEmptyTrip(truck: TruckPredictionInput): EmptyTripPrediction {
  const destination: LatLng = { lat: truck.destinationLat, lng: truck.destinationLng };
  const current: LatLng = { lat: truck.currentLat, lng: truck.currentLng };
  const remainingKm = roadKm(current, destination);
  const avgSpeedKmh = 45;
  const hoursRemaining = remainingKm / avgSpeedKmh;

  const emptySoon =
    truck.status === "EMPTY_SOON" ||
    truck.status === "IN_TRANSIT" ||
    truck.status === "LOADED" ||
    hoursRemaining <= 24;

  const predictedEmptyTime = truck.estimatedArrival
    ? new Date(truck.estimatedArrival)
    : new Date(Date.now() + hoursRemaining * 3600 * 1000);

  const confidenceScore = Math.min(
    95,
    Math.round(
      60 +
        (truck.status === "EMPTY_SOON" ? 25 : truck.status === "IN_TRANSIT" ? 15 : 5) +
        (truck.estimatedArrival ? 10 : 0),
    ),
  );

  return {
    emptySoon,
    predictedEmptyTime,
    predictedEmptyLocation: destination,
    confidenceScore,
    hoursUntilEmpty: Math.round(hoursRemaining * 10) / 10,
  };
}

export function generatePredictionMessage(
  prediction: EmptyTripPrediction,
  city?: string,
  matchCount = 0,
): string {
  const cityName = city ?? "your destination";
  const hours = prediction.hoursUntilEmpty;
  if (matchCount > 0) {
    return `Your truck is expected to become empty in approximately ${hours} hours near ${cityName}. We found ${matchCount} compatible return loads.`;
  }
  return `Your truck is expected to become empty in approximately ${hours} hours near ${cityName}.`;
}
