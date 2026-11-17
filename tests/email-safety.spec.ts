import { expect, test } from "@playwright/test";

import {
  sendAccountVerificationEmail,
  sendWaitlistPromotionEmail,
} from "../src/lib/email";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.BREVO_API_KEY;
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalVercelUrl = process.env.VERCEL_URL;
const originalNextAuthUrl = process.env.NEXTAUTH_URL;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalApiKey === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = originalApiKey;
  if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  if (originalVercelUrl === undefined) delete process.env.VERCEL_URL;
  else process.env.VERCEL_URL = originalVercelUrl;
  if (originalNextAuthUrl === undefined) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = originalNextAuthUrl;
});

test.describe("transactional email safety", () => {
  test("returns a clear failure without making a request when the API key is missing", async () => {
    process.env.BREVO_API_KEY = "";
    let requestCount = 0;
    globalThis.fetch = async () => {
      requestCount += 1;
      throw new Error("fetch must not run without credentials");
    };

    const result = await sendAccountVerificationEmail("member@example.test", "123456", "en");

    expect(result.success).toBe(false);
    expect(result.error).toContain("not configured");
    expect(requestCount).toBe(0);
  });

  test("escapes OTP and event data in HTML and builds the event URL from the app origin", async () => {
    process.env.BREVO_API_KEY = "test-api-key";
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
    process.env.NEXTAUTH_URL = "https://events.example.test/some-path";
    let payload: Record<string, unknown> | undefined;
    globalThis.fetch = async (_input, init) => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ messageId: "test-message" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    };

    const otpResult = await sendAccountVerificationEmail(
      "member@example.test",
      '<img src=x onerror="alert(1)">&',
      "en",
    );
    expect(otpResult.success).toBe(true);
    const otpHtml = String(payload?.htmlContent);
    expect(otpHtml).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&amp;");
    expect(otpHtml).not.toContain('<img src=x onerror="alert(1)">');

    const approvalResult = await sendWaitlistPromotionEmail(
      "member@example.test",
      {
        titleAr: "فعالية",
        titleEn: '<script>alert("event")</script>',
        date: "2026-12-01T18:00:00Z",
        location: '<svg onload="alert(2)">&',
        url: "/events/safe-slug?from=approval&x=1",
      },
      "en",
      { sendOnce: true },
    );
    expect(approvalResult.success).toBe(true);
    const approvalPayload = payload as Record<string, unknown>;
    const approvalHtml = String(approvalPayload.htmlContent);
    expect(approvalHtml).toContain("&lt;script&gt;alert(&quot;event&quot;)&lt;/script&gt;");
    expect(approvalHtml).toContain("&lt;svg onload=&quot;alert(2)&quot;&gt;&amp;");
    expect(approvalHtml).toContain(
      'href="https://events.example.test/events/safe-slug?from=approval&amp;x=1"',
    );
    expect(String(approvalPayload.textContent)).toContain(
      "https://events.example.test/events/safe-slug?from=approval&x=1",
    );
    expect(JSON.stringify(approvalPayload)).not.toContain("test-api-key");
  });
});
