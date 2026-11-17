import { MOROCCO_MAP } from "@/lib/morocco-map";

export type MapPoint = { x: number; y: number };

/**
 * Equirectangular transform calibrated to the existing Natural Earth outline.
 * The project-owned SVG retains its original viewBox and public-domain source.
 */
export const MOROCCO_PROJECTION = {
  longitudeOrigin: -17.88,
  latitudeOrigin: 36.65,
  xScale: 56.8,
  yScale: 64.3,
} as const;

export function project(latitude: number, longitude: number): MapPoint {
  return {
    x: (longitude - MOROCCO_PROJECTION.longitudeOrigin) * MOROCCO_PROJECTION.xScale,
    y: (MOROCCO_PROJECTION.latitudeOrigin - latitude) * MOROCCO_PROJECTION.yScale,
  };
}

export function unproject(x: number, y: number): { latitude: number; longitude: number } {
  return {
    latitude: MOROCCO_PROJECTION.latitudeOrigin - y / MOROCCO_PROJECTION.yScale,
    longitude: MOROCCO_PROJECTION.longitudeOrigin + x / MOROCCO_PROJECTION.xScale,
  };
}

/** SVG coordinate extent used by the shared public and admin map canvases. */
export const MOROCCO_MAP_BOUNDS = {
  x: 0,
  y: 0,
  width: MOROCCO_MAP.width,
  height: MOROCCO_MAP.height,
} as const;
