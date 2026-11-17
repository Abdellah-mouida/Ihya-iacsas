import { test, expect } from "@playwright/test";

test.describe("HTTP security headers (IHY-SEC-010)", () => {
  test("responses include CSP, framing, MIME, referrer, permissions headers and hide X-Powered-By without CSP violations", async ({
    request,
    page,
  }) => {
    const res = await request.get("/");
    expect(res.status()).toBe(200);
    const headers = res.headers();

    expect(headers["x-powered-by"]).toBeUndefined();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["content-security-policy"]).toContain("object-src 'none'");

    await page.addInitScript(() => {
      (window as unknown as { __cspViolations?: string[] }).__cspViolations = [];
      document.addEventListener("securitypolicyviolation", (e) => {
        (window as unknown as { __cspViolations?: string[] }).__cspViolations?.push(
          `${e.violatedDirective}:${e.blockedURI}`,
        );
      });
    });

    await page.goto("/", { waitUntil: "load" });
    const violations = await page.evaluate(
      () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
    );
    expect(violations).toEqual([]);
  });
});
