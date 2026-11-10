"use server";

import { z } from "zod";
import { safeRevalidatePath, safeRevalidateTag } from "@/lib/cache";
import { logActivity } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { branchInputSchema } from "@/lib/branches/validation";
import { warnForDuplicateBranchGeoId } from "@/lib/branches/duplicate";
import { MOROCCAN_REGIONS } from "@/data/morocco";

const BRANCHES_TAG = "public-home-branches";
const PAGE_SIZE = 12;

const filterSchema = z.object({
  search: z.string().trim().max(120).optional().default(""),
  regionId: z.string().trim().optional().default("all"),
  page: z.number().int().positive().optional().default(1),
});

export async function getAdminBranches(input: unknown = {}) {
  try {
    await requirePermission("branches:manage");
    const filters = filterSchema.safeParse(input);
    if (!filters.success) return { success: false, error: "Invalid branch filters" };
    const { search, regionId, page } = filters.data;
    if (regionId !== "all" && !MOROCCAN_REGIONS.some((region) => region.id === regionId)) {
      return { success: false, error: "Unknown region" };
    }

    const where = {
      ...(regionId !== "all" ? { regionId } : {}),
      ...(search
        ? {
            OR: [
              { nameAr: { contains: search, mode: "insensitive" as const } },
              { nameEn: { contains: search, mode: "insensitive" as const } },
              { regionId: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [total, branches] = await prisma.$transaction([
      prisma.branch.count({ where }),
      prisma.branch.findMany({
        where,
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    return { success: true, branches, total, page, pageSize: PAGE_SIZE, pageCount: Math.ceil(total / PAGE_SIZE) };
  } catch (error) {
    console.error("[branches] Failed to load admin branches:", error);
    return { success: false, error: "Failed to load branches" };
  }
}

function refreshBranchViews() {
  safeRevalidateTag(BRANCHES_TAG);
  safeRevalidatePath("/", "page");
  safeRevalidatePath("/admin/branches", "page");
}

export async function createBranch(input: unknown) {
  try {
    const actor = await requirePermission("branches:manage");
    const parsed = branchInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Please correct the branch details", issues: parsed.error.issues };
    const branch = parsed.data;
    await warnForDuplicateBranchGeoId(branch.geoId);

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.branch.create({ data: { ...branch, createdById: actor.id } });
      await logActivity({
        client: tx,
        required: true,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "BRANCH_CREATE",
        targetType: "Branch",
        targetId: row.id,
        targetName: row.nameEn ?? row.nameAr,
        details: { kind: row.kind, geoId: row.geoId, regionId: row.regionId },
      });
      return row;
    });
    refreshBranchViews();
    return { success: true, branch: created };
  } catch (error) {
    console.error("[branches] Failed to create branch:", error);
    return { success: false, error: "Failed to create branch" };
  }
}

export async function updateBranch(id: string, input: unknown) {
  try {
    const actor = await requirePermission("branches:manage");
    if (!id || typeof id !== "string") return { success: false, error: "Invalid branch id" };
    const parsed = branchInputSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: "Please correct the branch details", issues: parsed.error.issues };
    const branch = parsed.data;
    await warnForDuplicateBranchGeoId(branch.geoId, id);

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.branch.update({ where: { id }, data: branch });
      await logActivity({
        client: tx,
        required: true,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "BRANCH_UPDATE",
        targetType: "Branch",
        targetId: row.id,
        targetName: row.nameEn ?? row.nameAr,
        details: { kind: row.kind, geoId: row.geoId, regionId: row.regionId },
      });
      return row;
    });
    refreshBranchViews();
    return { success: true, branch: updated };
  } catch (error) {
    console.error("[branches] Failed to update branch:", error);
    return { success: false, error: "Failed to update branch" };
  }
}

export async function setBranchActive(id: string, active: boolean) {
  try {
    const actor = await requirePermission("branches:manage");
    if (!id || typeof id !== "string" || typeof active !== "boolean") return { success: false, error: "Invalid branch state" };
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.branch.update({ where: { id }, data: { active } });
      await logActivity({
        client: tx,
        required: true,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "BRANCH_TOGGLE",
        targetType: "Branch",
        targetId: row.id,
        targetName: row.nameEn ?? row.nameAr,
        details: { active },
      });
      return row;
    });
    refreshBranchViews();
    return { success: true, branch: updated };
  } catch (error) {
    console.error("[branches] Failed to toggle branch:", error);
    return { success: false, error: "Failed to update branch status" };
  }
}

export async function deleteBranch(id: string) {
  try {
    const actor = await requirePermission("branches:manage");
    if (!id || typeof id !== "string") return { success: false, error: "Invalid branch id" };
    await prisma.$transaction(async (tx) => {
      const row = await tx.branch.findUniqueOrThrow({ where: { id } });
      await tx.branch.delete({ where: { id } });
      await logActivity({
        client: tx,
        required: true,
        actorId: actor.id,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "BRANCH_DELETE",
        targetType: "Branch",
        targetId: row.id,
        targetName: row.nameEn ?? row.nameAr,
        details: { kind: row.kind, geoId: row.geoId, regionId: row.regionId },
      });
    });
    refreshBranchViews();
    return { success: true };
  } catch (error) {
    console.error("[branches] Failed to delete branch:", error);
    return { success: false, error: "Failed to delete branch" };
  }
}
