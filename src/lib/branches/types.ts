import type { Branch } from "@prisma/client";

export type PublicBranch = Pick<
  Branch,
  | "id"
  | "kind"
  | "geoId"
  | "nameAr"
  | "nameEn"
  | "regionId"
  | "provinceId"
  | "latitude"
  | "longitude"
>;
