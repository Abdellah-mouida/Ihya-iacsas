import { expect, test } from "@playwright/test";
import { sanitizeAuditDetails } from "@/lib/audit";

test("audit details safely omit null values and preserve other metadata", () => {
  expect(sanitizeAuditDetails({ kind: "CUSTOM", geoId: null, provinceId: undefined, regionId: "souss-massa" })).toEqual({
    kind: "CUSTOM",
    regionId: "souss-massa",
  });
  expect(sanitizeAuditDetails(null)).toBeUndefined();
});
