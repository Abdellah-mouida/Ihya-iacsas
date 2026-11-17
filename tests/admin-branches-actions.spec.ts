import { expect, test } from "@playwright/test";
import { MOROCCAN_CITIES } from "@/data/morocco";
import { prisma } from "@/lib/prisma";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { ensureTestUser, loginAs, TEST_ADMIN, TEST_MODERATOR } from "./helpers/admin-auth";

assertDevBranchDatabase("Admin branch mutation test");

async function chooseCity(dialog: import("@playwright/test").Locator, cityId: string) {
  const city = MOROCCAN_CITIES.find((candidate) => candidate.id === cityId);
  if (!city) throw new Error(`City ${cityId} is missing from the supplied dataset`);
  const search = dialog.getByLabel("City");
  await search.fill(city.nameEn);
  await dialog.getByRole("button", { name: city.nameEn, exact: true }).click();
}

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
      await chooseCity(dialog, "dakhla");
      await dialog.getByRole("button", { name: "Save branch" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });

      const created = await prisma.branch.findFirst({ where: { geoId: "dakhla" } });
      expect(created).not.toBeNull();
      branchId = created!.id;
      await expect(page.locator(`[data-branch-id="${branchId}"]`)).toBeVisible();
      expect(await prisma.auditLog.findFirst({ where: { targetId: branchId, action: "BRANCH_CREATE" } })).not.toBeNull();

      await page.getByRole("button", { name: "Add branch" }).click();
      const duplicateDialog = page.getByRole("dialog");
      await chooseCity(duplicateDialog, "dakhla");
      await duplicateDialog.getByRole("button", { name: "Save branch" }).click();
      await expect(duplicateDialog.getByRole("alert")).toContainText("Dakhla");
      const existingBranchLink = duplicateDialog.getByRole("link", { name: "Open the existing branch" });
      await expect(existingBranchLink).toHaveAttribute("href", new RegExp(`branch=${branchId}`));
      await existingBranchLink.click();
      await expect(page.locator(`#branch-${branchId}`)).toBeVisible({ timeout: 30_000 });
      await page.goto("/admin/branches");

      const row = page.locator(`[data-branch-id="${branchId}"]`);
      await expect(row).toBeVisible();
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
      await chooseCity(dialog, "oujda");
      await dialog.getByRole("button", { name: "Save branch" }).click();
      await expect(dialog).toBeHidden({ timeout: 30_000 });

      const created = await prisma.branch.findFirst({ where: { geoId: "oujda" } });
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
