import type { Branch, Prisma } from "@prisma/client";

import type { BranchInput } from "@/lib/branches/validation";

export const MIN_BRANCH_DISTANCE_KM = 2;

export function normalizeBranchNameKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

type BranchLocation = Pick<Branch, "id" | "kind" | "geoId" | "nameAr" | "nameEn" | "nameArKey" | "nameEnKey" | "latitude" | "longitude">;
type BranchCandidate = Pick<Branch, "kind" | "geoId" | "nameAr" | "nameEn" | "latitude" | "longitude">;

export function branchDistanceKm(
  left: Pick<Branch, "latitude" | "longitude">,
  right: Pick<Branch, "latitude" | "longitude">,
) {
  const radians = Math.PI / 180;
  const latitudeDelta = (right.latitude - left.latitude) * radians;
  const longitudeDelta = (right.longitude - left.longitude) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(left.latitude * radians) * Math.cos(right.latitude * radians) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export type BranchConflict = {
  type: "name" | "geoId" | "distance";
  branch: Pick<BranchLocation, "id" | "nameAr" | "nameEn">;
  distanceKm?: number;
};

export function findBranchConflict(candidate: BranchCandidate, existing: readonly BranchLocation[], excludeId?: string): BranchConflict | null {
  const nameArKey = normalizeBranchNameKey(candidate.nameAr);
  const nameEnKey = candidate.nameEn ? normalizeBranchNameKey(candidate.nameEn) : null;
  const candidateKeys = new Set([nameArKey, nameEnKey].filter((key): key is string => Boolean(key)));
  const rows = existing.filter((branch) => branch.id !== excludeId);

  const sameName = rows.find((branch) => candidateKeys.has(branch.nameArKey) || (branch.nameEnKey && candidateKeys.has(branch.nameEnKey)));
  if (sameName) return { type: "name", branch: sameName };

  if (candidate.kind === "CITY" && candidate.geoId) {
    const samePlace = rows.find((branch) => branch.kind === "CITY" && branch.geoId === candidate.geoId);
    if (samePlace) return { type: "geoId", branch: samePlace };
  }

  for (const branch of rows) {
    const distance = branchDistanceKm(candidate, branch);
    if (distance < MIN_BRANCH_DISTANCE_KM) {
      return { type: "distance", branch, distanceKm: distance };
    }
  }

  return null;
}

export async function lockBranchUniqueness(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(178219165535::bigint) IS NULL AS locked`;
}

export async function createUniqueBranch(
  tx: Prisma.TransactionClient,
  input: Omit<BranchInput, "id" | "idempotencyKey">,
  actorId: string,
  idempotencyKey: string,
) {
  await lockBranchUniqueness(tx);
  const replay = await tx.branch.findUnique({ where: { idempotencyKey } });
  if (replay) return { branch: replay, replayed: true as const };

  const existing = await tx.branch.findMany({
    select: {
      id: true,
      kind: true,
      geoId: true,
      nameAr: true,
      nameEn: true,
      nameArKey: true,
      nameEnKey: true,
      latitude: true,
      longitude: true,
    },
  });
  const conflict = findBranchConflict(input, existing);
  if (conflict) return { conflict };

  const branch = await tx.branch.create({
    data: {
      ...input,
      createdById: actorId,
      nameArKey: normalizeBranchNameKey(input.nameAr),
      nameEnKey: input.nameEn ? normalizeBranchNameKey(input.nameEn) : null,
      idempotencyKey,
    },
  });
  return { branch, replayed: false as const };
}

export async function findUniqueBranchConflict(
  tx: Prisma.TransactionClient,
  input: BranchCandidate,
  excludeId?: string,
) {
  await lockBranchUniqueness(tx);
  const existing = await tx.branch.findMany({
    select: {
      id: true,
      kind: true,
      geoId: true,
      nameAr: true,
      nameEn: true,
      nameArKey: true,
      nameEnKey: true,
      latitude: true,
      longitude: true,
    },
  });
  return findBranchConflict(input, existing, excludeId);
}
