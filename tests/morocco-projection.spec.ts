import { expect, test } from "@playwright/test";
import { MOROCCAN_CITIES } from "@/data/morocco";
import { MOROCCO_MAP } from "@/lib/morocco-map";
import { project, unproject } from "@/lib/morocco-projection";

const CALIBRATION_POINTS = [
  { id: "tangier", expected: { x: 684, y: 57 } },
  { id: "oujda", expected: { x: 907, y: 127 } },
  { id: "casablanca", expected: { x: 585, y: 198 } },
  { id: "marrakech", expected: MOROCCO_MAP.pins.marrakech },
  { id: "agadir", expected: { x: 470, y: 400 } },
  { id: "laayoune", expected: { x: 266, y: 611 } },
  { id: "dakhla", expected: { x: 109, y: 834 } },
] as const;

const MAX_PIXEL_ERROR = 8;

test("Morocco projection puts seven supplied city coordinates on their outline landmarks", () => {
  for (const check of CALIBRATION_POINTS) {
    const city = MOROCCAN_CITIES.find((item) => item.id === check.id);
    expect(city, `source city ${check.id}`).toBeDefined();
    const actual = project(city!.latitude, city!.longitude);
    expect(Math.abs(actual.x - check.expected.x), `${check.id} x error`).toBeLessThanOrEqual(MAX_PIXEL_ERROR);
    expect(Math.abs(actual.y - check.expected.y), `${check.id} y error`).toBeLessThanOrEqual(MAX_PIXEL_ERROR);
  }
});

test("projection round-trips geographic coordinates", () => {
  for (const city of MOROCCAN_CITIES) {
    const point = project(city.latitude, city.longitude);
    const geographic = unproject(point.x, point.y);
    expect(Math.abs(geographic.latitude - city.latitude)).toBeLessThan(1e-10);
    expect(Math.abs(geographic.longitude - city.longitude)).toBeLessThan(1e-10);
  }
});
