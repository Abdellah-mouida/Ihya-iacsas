import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    redirect({ url, baseUrl }) {
      // Allows relative callback URLs, blocking protocol-relative open redirects like //evil.com
      if (url.startsWith("/")) {
        if (url.startsWith("//")) return baseUrl;
        return `${baseUrl}${url}`;
      }
      // Allows callback URLs on the exact same origin
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) return url;
      } catch {
        // Malformed URL fallback
      }
      return baseUrl;
    },
  },
};
