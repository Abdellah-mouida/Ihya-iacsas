import { test, expect } from "@playwright/test";
import { extractClientIpFromHeaders } from "../src/lib/request-ip";
import { signLocalRealtimeToken, verifyLocalRealtimeToken } from "../src/lib/chat/realtime/local-sse";

test.describe("Defense-in-depth hardening (IHY-SEC-014)", () => {
  test("extractClientIpFromHeaders resists spoofed leftmost x-forwarded-for", () => {
    const h1 = new Headers({
      "x-vercel-forwarded-for": "203.0.113.5, 10.0.0.1",
      "x-forwarded-for": "1.2.3.4, 203.0.113.5",
    });
    expect(extractClientIpFromHeaders(h1)).toBe("203.0.113.5");

    const h2 = new Headers({
      "x-real-ip": "198.51.100.7",
      "x-forwarded-for": "1.2.3.4, 198.51.100.7",
    });
    expect(extractClientIpFromHeaders(h2)).toBe("198.51.100.7");

    const h3 = new Headers({
      "x-forwarded-for": "9.9.9.9, 192.0.2.44",
    });
    expect(extractClientIpFromHeaders(h3)).toBe("192.0.2.44");

    expect(extractClientIpFromHeaders(new Headers())).toBe("127.0.0.1");
  });

  test("local realtime signing does not fall back to CHAT_ENCRYPTION_KEY", () => {
    const origAuth = process.env.AUTH_SECRET;
    const origNextAuth = process.env.NEXTAUTH_SECRET;
    const origApi = process.env.API_TOKEN_SECRET;
    const origChatKey = process.env.CHAT_ENCRYPTION_KEY;

    try {
      delete process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.API_TOKEN_SECRET;
      process.env.CHAT_ENCRYPTION_KEY = "0".repeat(64);

      expect(() =>
        signLocalRealtimeToken({
          sub: "user-1",
          ch: ["user:user-1"],
          exp: Date.now() + 60_000,
          onl: true,
        }),
      ).toThrow();
      expect(verifyLocalRealtimeToken("abc.def")).toBeNull();
    } finally {
      if (origAuth !== undefined) process.env.AUTH_SECRET = origAuth;
      if (origNextAuth !== undefined) process.env.NEXTAUTH_SECRET = origNextAuth;
      if (origApi !== undefined) process.env.API_TOKEN_SECRET = origApi;
      if (origChatKey !== undefined) process.env.CHAT_ENCRYPTION_KEY = origChatKey;
      else delete process.env.CHAT_ENCRYPTION_KEY;
    }
  });
});
