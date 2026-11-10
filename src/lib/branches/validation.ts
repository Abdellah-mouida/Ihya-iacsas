import { z } from "zod";
import { MOROCCAN_CITIES, MOROCCAN_REGIONS } from "@/data/morocco";
import { isWithinMoroccoBounds, MOROCCO_BOUNDS } from "@/lib/branches/region-inference";

export { MOROCCO_BOUNDS } from "@/lib/branches/region-inference";

const branchInputBaseSchema = z.object({
  id: z.string().min(1).optional(),
  kind: z.enum(["CITY", "CUSTOM"]),
  geoId: z.string().trim().min(1).nullable().optional().or(z.literal("")),
  nameAr: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().max(80).nullable().optional().refine((value) => value == null || value === "" || value.length >= 2, { message: "English name must contain at least 2 characters" }),
  regionId: z.string().trim().min(1),
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
    provinceId: null,
  }))
  .superRefine((input, ctx) => {
    const region = MOROCCAN_REGIONS.find((item) => item.id === input.regionId);
    if (!region) {
      ctx.addIssue({ code: "custom", path: ["regionId"], message: "Unknown Morocco region" });
    }

    if (input.kind === "CITY") {
      const city = input.geoId ? MOROCCAN_CITIES.find((item) => item.id === input.geoId) : null;
      if (!city) {
        ctx.addIssue({ code: "custom", path: ["geoId"], message: "Choose a city from the supplied dataset" });
      } else if (city.regionId !== input.regionId) {
        ctx.addIssue({ code: "custom", path: ["regionId"], message: "City must belong to the selected region" });
      } else if (Math.abs(city.latitude - input.latitude) > 0.0001 || Math.abs(city.longitude - input.longitude) > 0.0001) {
        ctx.addIssue({ code: "custom", path: ["geoId"], message: "City coordinates must match the supplied dataset" });
      }
    }

    if (!isWithinMoroccoBounds(input.latitude, input.longitude)) {
      ctx.addIssue({ code: "custom", path: ["latitude"], message: "Coordinates must be inside Morocco" });
    }

    if (input.kind === "CUSTOM" && input.geoId) {
      ctx.addIssue({ code: "custom", path: ["geoId"], message: "Custom branches cannot use a dataset id" });
    }
  });

export type BranchInput = z.output<typeof branchInputSchema>;

export function parseBranchInput(input: unknown) {
  return branchInputSchema.safeParse(input);
}
