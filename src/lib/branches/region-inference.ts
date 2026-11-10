import { MOROCCAN_CITIES, type MoroccanCity } from "@/data/morocco";

export const MOROCCO_BOUNDS = {
  minLatitude: 20,
  maxLatitude: 36.5,
  minLongitude: -17.5,
  maxLongitude: -0.5,
} as const;

const NEIGHBOR_COUNT = 5;
const DISTANCE_FLOOR_KM = 5;

export type RegionInference = {
  regionId: string;
  confidence: number;
  nearestCityIds: string[];
};

export function isWithinMoroccoBounds(latitude: number, longitude: number) {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= MOROCCO_BOUNDS.minLatitude
    && latitude <= MOROCCO_BOUNDS.maxLatitude
    && longitude >= MOROCCO_BOUNDS.minLongitude
    && longitude <= MOROCCO_BOUNDS.maxLongitude;
}

function distanceKm(latitude: number, longitude: number, city: MoroccanCity) {
  const radians = Math.PI / 180;
  const latitudeDelta = (city.latitude - latitude) * radians;
  const longitudeDelta = (city.longitude - longitude) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitude * radians) * Math.cos(city.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

/** Infers a region from five nearest city records using inverse-square distance votes. */
export function inferRegionFromCoordinate(
  latitude: number,
  longitude: number,
  cities: readonly MoroccanCity[] = MOROCCAN_CITIES,
): RegionInference | null {
  if (!isWithinMoroccoBounds(latitude, longitude) || cities.length === 0) return null;

  const nearest = cities
    .map((city) => ({ city, distance: distanceKm(latitude, longitude, city) }))
    .sort((left, right) => left.distance - right.distance)
    .slice(0, NEIGHBOR_COUNT);
  const weights = new Map<string, number>();
  let total = 0;
  for (const { city, distance } of nearest) {
    const weight = 1 / Math.max(distance, DISTANCE_FLOOR_KM) ** 2;
    weights.set(city.regionId, (weights.get(city.regionId) ?? 0) + weight);
    total += weight;
  }

  const [regionId, winningWeight] = [...weights.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  if (!regionId || !winningWeight || total <= 0) return null;
  return {
    regionId,
    confidence: winningWeight / total,
    nearestCityIds: nearest.map(({ city }) => city.id),
  };
}

export function confidenceLevel(confidence: number) {
  if (confidence >= 0.7) return "high" as const;
  if (confidence >= 0.4) return "medium" as const;
  return "low" as const;
}
