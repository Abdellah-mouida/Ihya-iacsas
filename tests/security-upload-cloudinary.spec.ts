import { test, expect } from "@playwright/test";
import { assertDevBranchDatabase } from "./helpers/dev-guard";
import { createSyntheticUser, removeSyntheticUser } from "./helpers/synthetic-user";
import { loginAs } from "./helpers/admin-auth";
import { prisma } from "../src/lib/prisma";
import {
  hasValidImageMagicBytes,
  isSafeLocalAssetPath,
  signUploadProof,
  verifyUploadProof,
} from "../src/lib/upload-security";

assertDevBranchDatabase("Upload & Cloudinary security regression test");

test.describe("IHY-SEC-009: Upload proof, Cloudinary public_id protection, and cover URL validation", () => {
  test("unit checks for upload proof binding, folder prefix, and image magic bytes", async () => {
    const proof = signUploadProof({
      userId: "user-1",
      folder: "avatars",
      url: "https://res.cloudinary.com/demo/image/upload/v1/ihyaa-profiles/avatar.png",
      publicId: "ihyaa-profiles/avatar",
      imageWidth: 100,
      imageHeight: 100,
    });

    expect(verifyUploadProof(proof, "user-1", "avatars")?.publicId).toBe("ihyaa-profiles/avatar");
    expect(verifyUploadProof(proof, "user-2", "avatars")).toBeNull();
    expect(verifyUploadProof(proof, "user-1", "covers")).toBeNull();

    const wrongPrefixProof = signUploadProof({
      userId: "user-1",
      folder: "avatars",
      url: "https://res.cloudinary.com/demo/image/upload/v1/ihyaa-events/victim.png",
      publicId: "ihyaa-events/victim",
      imageWidth: 100,
      imageHeight: 100,
    });
    expect(verifyUploadProof(wrongPrefixProof, "user-1", "avatars")).toBeNull();

    expect(isSafeLocalAssetPath("/patterns/girih.svg")).toBe(true);
    expect(isSafeLocalAssetPath("/patterns/../etc/passwd")).toBe(false);
    expect(isSafeLocalAssetPath("javascript:alert(1)")).toBe(false);

    expect(hasValidImageMagicBytes(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]))).toBe(true);
    expect(hasValidImageMagicBytes(Buffer.from("<svg><script>alert(1)</script></svg>"))).toBe(false);
  });

  test("rejects arbitrary coverImage URLs, forged public_ids, and non-image uploads via HTTP", async ({
    page,
  }) => {
    const user = await createSyntheticUser("Upload sec user");
    await prisma.user.update({
      where: { id: user.id },
      data: { city: "الرباط", age: 22, onboardingCompletedAt: new Date() },
    });

    try {
      await loginAs(page, user, "/profile");

      const xssRes = await page.request.patch("/api/user/preferences", {
        data: {
          coverImage: "javascript:alert(1)",
          coverImagePublicId: "ihyaa-events/victim-poster",
        },
      });
      expect(xssRes.status()).toBe(400);

      const forgedRes = await page.request.patch("/api/user/preferences", {
        data: {
          coverImage: "https://evil.example/pixel.png",
          coverImagePublicId: "ihyaa-events/victim-poster",
        },
      });
      expect(forgedRes.status()).toBe(400);

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { coverImage: true, coverImagePublicId: true },
      });
      expect(dbUser?.coverImage).not.toBe("javascript:alert(1)");
      expect(dbUser?.coverImagePublicId).not.toBe("ihyaa-events/victim-poster");

      // Fake MIME PNG containing SVG/HTML bytes must be rejected by magic-byte check
      const fakePngRes = await page.request.post("/api/upload", {
        multipart: {
          folder: "avatars",
          file: {
            name: "evil.png",
            mimeType: "image/png",
            buffer: Buffer.from("<html><script>alert(1)</script></html>"),
          },
        },
      });
      expect(fakePngRes.status()).toBe(400);

      // Safe local pattern cover still works
      const safeRes = await page.request.patch("/api/user/preferences", {
        data: { coverImage: "/patterns/girih.svg" },
      });
      expect(safeRes.status()).toBe(200);
    } finally {
      await removeSyntheticUser(user.id);
    }
  });
});
