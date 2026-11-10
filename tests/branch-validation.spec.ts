import { expect, test } from "@playwright/test";
import { MOROCCAN_CITIES, MOROCCAN_PROVINCES } from "@/data/morocco";
import { parseBranchInput } from "@/lib/branches/validation";
import { can } from "@/lib/permissions";

const marrakech = MOROCCAN_CITIES.find((item) => item.id === "marrakech")!;
const taroudantProvince = MOROCCAN_PROVINCES.find((item) => item.id === "taroudannt")!;

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

  test("requires province selections to match both dataset and region", () => {
    const valid = parseBranchInput({
      kind: "PROVINCE",
      geoId: taroudantProvince.id,
      nameAr: taroudantProvince.name.ar,
      nameEn: taroudantProvince.name.en,
      regionId: taroudantProvince.region,
      provinceId: taroudantProvince.id,
      latitude: 30.5,
      longitude: -8.8,
    });
    expect(valid.success).toBe(true);
    expect(
      parseBranchInput({
        kind: "PROVINCE",
        geoId: taroudantProvince.id,
        nameAr: taroudantProvince.name.ar,
        regionId: "marrakech-safi",
        provinceId: taroudantProvince.id,
        latitude: 30.5,
        longitude: -8.8,
      }).success,
    ).toBe(false);
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
