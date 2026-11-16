import { test, expect } from "@playwright/test";

test.describe("Middleware open-redirect, protected routes & API CSRF (IHY-SEC-012)", () => {
  test("redirects anonymous users from /chat, /messages, /notifications, /u/* to /login", async ({
    request,
  }) => {
    for (const path of ["/chat", "/messages", "/notifications", "/u/some-id"]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      const location = res.headers()["location"] || "";
      expect(location).toContain("/login");
    }
  });

  test("sanitizes /admin/login open redirect payloads", async ({ request }) => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com"]) {
      const res = await request.get(
        `/admin/login?next=${encodeURIComponent(bad)}`,
        { maxRedirects: 0 },
      );
      expect(res.status()).toBe(307);
      const location = res.headers()["location"] || "";
      const parsed = new URL(location, "http://127.0.0.1:3001");
      expect(parsed.pathname).toBe("/login");
      expect(parsed.searchParams.get("callbackUrl")).toBe("/admin");
    }
  });

  test("blocks cross-origin mutations on /api/notifications, /api/upload, /api/user/*, /api/admin/*", async ({
    request,
  }) => {
    for (const path of [
      "/api/notifications",
      "/api/upload",
      "/api/user/preferences",
      "/api/user/privacy",
      "/api/admin/moderation/settings",
    ]) {
      const res = await request.patch(path, {
        headers: {
          Origin: "https://evil.example",
          "Sec-Fetch-Site": "cross-site",
        },
        data: {},
      });
      expect(res.status()).toBe(403);
    }
  });
});
