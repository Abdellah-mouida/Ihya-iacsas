import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { prisma } from "@/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { ensureTestUser, loginAs, TEST_ADMIN, TEST_MODERATOR } from "./helpers/admin-auth";

assertDevBranchDatabase("Admin branch mutation test");

test.describe("Admin branch mutations", () => {
  test.beforeAll(async () => {
    await ensureTestUser(TEST_ADMIN);
    await ensureTestUser(TEST_MODERATOR);
  });

  test.afterAll(async () => {
    const admins = await prisma.user.findMany({ where: { email: { in: [TEST_ADMIN.email, TEST_MODERATOR.email] } }, select: { id: true } });
    await prisma.auditLog.deleteMany({ where: { actorId: { in: admins.map((user) => user.id) } } });
    await prisma.user.deleteMany({ where: { id: { in: admins.map((user) => user.id) } } });
  });

  test("ADMIN creates and deletes a branch with matching audit entries", async ({ page }) => {
    test.setTimeout(120_000);
    const suffix = randomUUID().slice(0, 8);
    const nameAr = `فرع اختبار ${suffix}`;
    const nameEn = `Test branch ${suffix}`;

    await page.addInitScript(() => {
      localStorage.setItem("ihyaa-locale", "en");
      localStorage.setItem("ihyaa-theme", "light");
      document.cookie = "ihyaa-theme=light; path=/";
    });
    await loginAs(page, TEST_ADMIN, "/admin/branches");

    let branchId: string | null = null;
    try {
      await page.getByRole("button", { name: "Add branch" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("button", { name: "Custom place" }).click();
      await dialog.getByLabel("Branch name in Arabic").fill(nameAr);
      await dialog.getByLabel("Branch name in English").fill(nameEn);
      await dialog.locator("[data-editor-pin]").click();
      await dialog.getByRole("button", { name: "Save branch" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });

      const created = await prisma.branch.findFirst({ where: { nameEn } });
      expect(created).not.toBeNull();
      branchId = created!.id;
      await expect(page.locator(`[data-branch-id="${branchId}"]`)).toBeVisible();
      expect(await prisma.auditLog.findFirst({ where: { targetId: branchId, action: "BRANCH_CREATE" } })).not.toBeNull();

      const row = page.locator(`[data-branch-id="${branchId}"]`);
      await row.getByRole("button", { name: "Delete" }).click();
      await page.getByTestId("confirm-dialog-confirm").click();
      await expect.poll(() => prisma.branch.findUnique({ where: { id: branchId! } })).toBeNull();
      expect(await prisma.auditLog.findFirst({ where: { targetId: branchId, action: "BRANCH_DELETE" } })).not.toBeNull();
      await prisma.auditLog.deleteMany({ where: { targetId: branchId } });
      branchId = null;
    } finally {
      if (branchId) {
        await prisma.auditLog.deleteMany({ where: { targetId: branchId } });
        await prisma.branch.deleteMany({ where: { id: branchId } });
      }
    }
  });

  test("MODERATOR can create a custom branch and records the actor", async ({ page }) => {
    test.setTimeout(90_000);
    const suffix = randomUUID().slice(0, 8);
    const nameAr = `فرع مشرف ${suffix}`;
    const nameEn = `Moderator branch ${suffix}`;
    await page.addInitScript(() => {
      localStorage.setItem("ihyaa-locale", "en");
      localStorage.setItem("ihyaa-theme", "light");
      document.cookie = "ihyaa-theme=light; path=/";
    });
    await loginAs(page, TEST_MODERATOR, "/admin/branches");

    let branchId: string | null = null;
    try {
      await expect(page).toHaveURL(/\/admin\/branches/);
      await page.getByRole("button", { name: "Add branch" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Province or prefecture" })).toHaveCount(0);
      await dialog.getByRole("button", { name: "Custom place" }).click();
      await expect(dialog.getByRole("status")).toContainText("Nearest-city suggestion");
      await dialog.getByLabel("Branch name in Arabic").fill(nameAr);
      await dialog.getByLabel("Branch name in English").fill(nameEn);
      await dialog.locator("[data-editor-pin]").click();
      await dialog.getByRole("button", { name: "Save branch" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });

      const created = await prisma.branch.findFirst({ where: { nameEn } });
      expect(created).not.toBeNull();
      branchId = created!.id;
      expect(created!.createdById).toBe((await prisma.user.findUniqueOrThrow({ where: { email: TEST_MODERATOR.email }, select: { id: true } })).id);
      expect(await prisma.auditLog.findFirst({ where: { targetId: branchId, action: "BRANCH_CREATE", actorEmail: TEST_MODERATOR.email } })).not.toBeNull();
    } finally {
      if (branchId) {
        await prisma.auditLog.deleteMany({ where: { targetId: branchId } });
        await prisma.branch.deleteMany({ where: { id: branchId } });
      }
    }
  });
});
