import { z } from "zod";
import {
  MOROCCAN_CITIES,
  MOROCCAN_PROVINCES,
  MOROCCAN_REGIONS,
} from "@/data/morocco";

export const MOROCCO_BOUNDS = {
  minLatitude: 20,
  maxLatitude: 36.5,
  minLongitude: -17.5,
  maxLongitude: -0.5,
} as const;

const branchInputBaseSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(["CITY", "PROVINCE", "CUSTOM"]),
  geoId: z.string().trim().min(1).nullable().optional(),
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(80).nullable().optional(),
  regionId: z.string().trim().min(1),
  provinceId: z.string().trim().min(1).nullable().optional(),
  latitude: z.number().finite().min(MOROCCO_BOUNDS.minLatitude).max(MOROCCO_BOUNDS.maxLatitude),
  longitude: z.number().finite().min(MOROCCO_BOUNDS.minLongitude).max(MOROCCO_BOUNDS.maxLongitude),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});

export const branchInputSchema = branchInputBaseSchema
  .transform((input) => ({
    ...input,
    geoId: input.geoId || null,
    nameEn: input.nameEn || null,
    provinceId: input.provinceId || null,
  }))
  .superRefine((input, ctx) => {
    const region = MOROCCAN_REGIONS.find((item) => item.id === input.regionId);
    if (!region) {
      ctx.addIssue({ code: "custom", path: ["regionId"], message: "Unknown Morocco region" });
    }

    const province = input.provinceId
      ? MOROCCAN_PROVINCES.find((item) => item.id === input.provinceId)
      : null;
    if (input.provinceId && !province) {
      ctx.addIssue({ code: "custom", path: ["provinceId"], message: "Unknown province or prefecture" });
    } else if (province && province.region !== input.regionId) {
      ctx.addIssue({ code: "custom", path: ["provinceId"], message: "Province must belong to the selected region" });
    }

    if (input.kind === "CITY") {
      const city = input.geoId ? MOROCCAN_CITIES.find((item) => item.id === input.geoId) : null;
      if (!city) {
        ctx.addIssue({ code: "custom", path: ["geoId"], message: "Choose a city from the supplied dataset" });
      } else if (city.regionId !== input.regionId) {
        ctx.addIssue({ code: "custom", path: ["regionId"], message: "City must belong to the selected region" });
      }
    }

    if (input.kind === "PROVINCE") {
      const selectedProvince = input.geoId
        ? MOROCCAN_PROVINCES.find((item) => item.id === input.geoId)
        : null;
      if (!selectedProvince) {
        ctx.addIssue({ code: "custom", path: ["geoId"], message: "Choose a province or prefecture from the supplied dataset" });
      } else {
        if (selectedProvince.region !== input.regionId) {
          ctx.addIssue({ code: "custom", path: ["regionId"], message: "Province must belong to the selected region" });
        }
        if (input.provinceId !== selectedProvince.id) {
          ctx.addIssue({ code: "custom", path: ["provinceId"], message: "Province selection must match the chosen geography" });
        }
      }
    }

    if (input.kind === "CUSTOM" && input.geoId) {
      ctx.addIssue({ code: "custom", path: ["geoId"], message: "Custom branches cannot use a dataset id" });
    }
  });

export type BranchInput = z.output<typeof branchInputSchema>;

export function parseBranchInput(input: unknown) {
  return branchInputSchema.safeParse(input);
}
