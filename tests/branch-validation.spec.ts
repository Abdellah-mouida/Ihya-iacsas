import { expect, test } from "@playwright/test";
import { MOROCCAN_CITIES } from "@/data/morocco";
import { parseBranchInput } from "@/lib/branches/validation";
import { can } from "@/lib/permissions";
import { inferRegionFromCoordinate, isWithinMoroccoBounds } from "@/lib/branches/region-inference";

const marrakech = MOROCCAN_CITIES.find((item) => item.id === "marrakech")!;

function cityBranch(overrides: Record<string, unknown> = {}) {
  return {
    kind: "CITY",
    geoId: marrakech.id,
    nameAr: "  فرع مراكش  ",
    nameEn: "  Marrakech  ",
    regionId: marrakech.regionId,
    provinceId: "marrakech",
    latitude: marrakech.latitude,
    longitude: marrakech.longitude,
    ...overrides,
  };
}

test.describe("branch input validation", () => {
  test("trims names, accepts source cities and coordinates in the south", () => {
    const city = parseBranchInput(cityBranch());
    expect(city.success).toBe(true);
    if (city.success) {
      expect(city.data.nameAr).toBe("فرع مراكش");
      expect(city.data.nameEn).toBe("Marrakech");
      expect(city.data.active).toBe(true);
    }
    const noEnglishName = parseBranchInput(cityBranch({ nameEn: "   " }));
    expect(noEnglishName.success).toBe(true);
    if (noEnglishName.success) expect(noEnglishName.data.nameEn).toBeNull();

    const custom = parseBranchInput({
      kind: "CUSTOM",
      geoId: "",
      provinceId: "",
      nameAr: "فرع تجريبي",
      nameEn: "Test branch",
      regionId: marrakech.regionId,
      latitude: marrakech.latitude,
      longitude: marrakech.longitude,
    });
    expect(custom.success).toBe(true);
    if (custom.success) {
      expect(custom.data.geoId).toBeNull();
      expect(custom.data.provinceId).toBeNull();
    }

    const southernCustom = parseBranchInput({
      kind: "CUSTOM",
      nameAr: "فرع الداخلة",
      nameEn: "Dakhla branch",
      regionId: "dakhla-oued-ed-dahab",
      latitude: 23.7,
      longitude: -15.95,
    });
    expect(southernCustom.success).toBe(true);
  });

  test("rejects bad names, unknown geography, invalid coordinates and region mismatch", () => {
    expect(parseBranchInput(cityBranch({ nameAr: " x " })).success).toBe(false);
    expect(parseBranchInput(cityBranch({ geoId: "not-a-city" })).success).toBe(false);
    expect(parseBranchInput(cityBranch({ regionId: "unknown" })).success).toBe(false);
    expect(parseBranchInput(cityBranch({ regionId: "souss-massa" })).success).toBe(false);
    expect(parseBranchInput(cityBranch({ latitude: 19.9 })).success).toBe(false);
    expect(parseBranchInput(cityBranch({ longitude: 1 })).success).toBe(false);
  });

  test("rejects province kind and edited city coordinates", () => {
    expect(parseBranchInput(cityBranch({ kind: "PROVINCE" })).success).toBe(false);
    expect(parseBranchInput(cityBranch({ latitude: marrakech.latitude + 0.01 })).success).toBe(false);
    const normalizedCity = parseBranchInput(cityBranch({ provinceId: "taroudannt" }));
    expect(normalizedCity.success).toBe(true);
    if (normalizedCity.success) expect(normalizedCity.data.provinceId).toBeNull();
  });

  test("custom branch cannot claim a dataset id; ADMIN and MODERATOR have permission", () => {
    expect(
      parseBranchInput({
        kind: "CUSTOM",
        geoId: "marrakech",
        nameAr: "فرع تجريبي",
        regionId: "marrakech-safi",
        latitude: 31.6,
        longitude: -8,
      }).success,
    ).toBe(false);
    expect(can("ADMIN", "branches:manage")).toBe(true);
    expect(can("MODERATOR", "branches:manage")).toBe(true);
    expect(can("USER", "branches:manage")).toBe(false);
  });
});

test.describe("custom branch region inference", () => {
  test("uses the five nearest city records for Marrakech, Dakhla and Oujda", () => {
    for (const cityId of ["marrakech", "dakhla", "oujda"]) {
      const city = MOROCCAN_CITIES.find((item) => item.id === cityId)!;
      const inferred = inferRegionFromCoordinate(city.latitude, city.longitude);
      expect(inferred?.regionId, cityId).toBe(city.regionId);
      expect(inferred?.nearestCityIds).toHaveLength(5);
      expect(inferred?.confidence).toBeGreaterThan(0);
      expect(inferred?.confidence).toBeLessThanOrEqual(1);
    }
  });

  test("accepts the southern map boundary and rejects coordinates outside Morocco bounds", () => {
    expect(isWithinMoroccoBounds(20, -17.5)).toBe(true);
    expect(inferRegionFromCoordinate(20, -17.5)).not.toBeNull();
    expect(isWithinMoroccoBounds(19.99, -17.5)).toBe(false);
    expect(inferRegionFromCoordinate(19.99, -17.5)).toBeNull();
    expect(parseBranchInput({
      kind: "CUSTOM",
      nameAr: "فرع خارج النطاق",
      regionId: "guelmim-oued-noun",
      latitude: 19.99,
      longitude: -17.5,
    }).success).toBe(false);
  });
});
