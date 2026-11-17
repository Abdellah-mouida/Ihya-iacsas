import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

import { MOROCCAN_CITIES } from "@/data/morocco";
import { branchDistanceKm, createUniqueBranch, normalizeBranchNameKey } from "@/lib/branches/uniqueness";
import { prisma } from "@/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";

assertDevBranchDatabase("Branch create idempotency integration test");

test("two simultaneous identical create requests leave exactly one branch", async () => {
  const existing = await prisma.branch.findMany({ select: { id: true, kind: true, geoId: true, nameAr: true, nameEn: true, nameArKey: true, nameEnKey: true, latitude: true, longitude: true, createdById: true } });
  const creatorId = existing[0]?.createdById;
  expect(creatorId).toBeTruthy();

  const city = MOROCCAN_CITIES.find((candidate) =>
    !existing.some((branch) => branch.kind === "CITY" && branch.geoId === candidate.id)
      && existing.every((branch) => branchDistanceKm(candidate, branch) >= 3),
  );
  expect(city, "Dev database needs one unused city more than 3km from current branches").toBeTruthy();
  if (!city || !creatorId) throw new Error("No safe test city or branch creator was available");

  const idempotencyKey = randomUUID();
  const suffix = randomUUID();
  const input = {
    kind: "CITY" as const,
    geoId: city.id,
    nameAr: `فرع اختبار ${suffix}`,
    nameEn: `Idempotency Test ${suffix}`,
    regionId: city.regionId,
    provinceId: null,
    latitude: city.latitude,
    longitude: city.longitude,
    active: true,
    sortOrder: 99_999,
  };

  try {
    const results = await Promise.all([
      prisma.$transaction((tx) => createUniqueBranch(tx, input, creatorId, idempotencyKey)),
      prisma.$transaction((tx) => createUniqueBranch(tx, input, creatorId, idempotencyKey)),
    ]);
    expect(results.every((result) => Boolean(result.branch))).toBe(true);
    const ids = results.map((result) => result.branch?.id ?? "conflict");
    expect(new Set(ids).size).toBe(1);
    const created = await prisma.branch.findMany({ where: { idempotencyKey } });
    expect(created).toHaveLength(1);
    expect(created[0]?.nameArKey).toBe(normalizeBranchNameKey(input.nameAr));
    expect(created[0]?.nameEnKey).toBe(normalizeBranchNameKey(input.nameEn));
  } finally {
    await prisma.branch.deleteMany({ where: { idempotencyKey } });
    await prisma.$disconnect();
  }
});
