import cityData from "./cities.json";
import provinceData from "./provinces.json";
import regionData from "./regions.json";

export type GeoName = {
  en: string;
  fr: string;
  ar: string;
};

export type MoroccanRegion = {
  id: string;
  type: "region";
  name: GeoName;
  country: "MA";
  isoCode: string;
};

export type MoroccanProvince = {
  id: string;
  type: "province" | "prefecture";
  name: GeoName;
  country: "MA";
  region: string;
  hcpCode: string;
};

export type MoroccanGeoCity = {
  id: string;
  type: "city";
  name: GeoName;
  country: "MA";
  region: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
};

function loadData<T>(records: unknown, name: string): T[] {
  if (!Array.isArray(records)) {
    throw new Error(`Morocco geography data "${name}" must be an array`);
  }
  return records as T[];
}

export const MOROCCAN_REGIONS = loadData<MoroccanRegion>(regionData, "regions");
export const MOROCCAN_PROVINCES = loadData<MoroccanProvince>(provinceData, "provinces");
export const MOROCCAN_GEO_CITIES = loadData<MoroccanGeoCity>(cityData, "cities");

export type MoroccanCity = {
  id: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  regionId: string;
  latitude: number;
  longitude: number;
};

export const MOROCCAN_CITIES: MoroccanCity[] = MOROCCAN_GEO_CITIES.map((city) => ({
  id: city.id,
  nameAr: city.name.ar,
  nameEn: city.name.en,
  nameFr: city.name.fr,
  regionId: city.region,
  latitude: city.coordinates.latitude,
  longitude: city.coordinates.longitude,
}));

export function normalizeMoroccanCityValue(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

export function findMoroccanCity(cityIdOrName: string): MoroccanCity | undefined {
  const normalized = normalizeMoroccanCityValue(cityIdOrName);
  return MOROCCAN_CITIES.find(
    (city) =>
      [city.id, city.nameAr, city.nameEn, city.nameFr].some(
        (name) => normalizeMoroccanCityValue(name) === normalized,
      ),
  );
}

export function getCityDisplayName(cityIdOrName: string, locale = "ar"): string {
  const found = findMoroccanCity(cityIdOrName);

  if (!found) return cityIdOrName;
  if (locale === "ar") return found.nameAr;
  if (locale === "fr") return found.nameFr;
  return found.nameEn;
}
