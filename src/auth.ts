import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  providers: [
    ...authConfig.providers,
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        // Unverified accounts cannot log in directly
        if (!user.emailVerified) {
          throw new Error("UNVERIFIED_EMAIL");
        }

        // Check regular password first
        if (user.passwordHash) {
          const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
          if (isPasswordValid) {
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              emailVerified: user.emailVerified,
              onboardingCompletedAt: user.onboardingCompletedAt,
              mustChangePassword: user.mustChangePassword,
              city: user.city,
              age: user.age,
              locale: user.locale,
              sessionVersion: user.sessionVersion,
            };
          }
        }

        // Check temporary password (from forgot password flow)
        if (
          user.tempPasswordHash &&
          user.tempPasswordExpiresAt &&
          user.tempPasswordExpiresAt > new Date()
        ) {
          const isTempValid = await bcrypt.compare(password, user.tempPasswordHash);
          if (isTempValid) {
            // Flag user as mustChangePassword upon successful temp password login
            await prisma.user.update({
              where: { id: user.id },
              data: { mustChangePassword: true },
            });

            return {
              id: user.id,
              name: user.name,
              email: user.email,
              image: user.image,
              emailVerified: user.emailVerified,
              onboardingCompletedAt: user.onboardingCompletedAt,
              mustChangePassword: true,
              city: user.city,
              age: user.age,
              locale: user.locale,
              sessionVersion: user.sessionVersion,
            };
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) return false;
        const cleanEmail = user.email.trim().toLowerCase();

        const existingUser = await prisma.user.findUnique({
          where: { email: cleanEmail },
        });

        if (existingUser) {
          // Pre-hijacking mitigation:
          // If an attacker registered this email with an unverified credentials account,
          // the legitimate owner signing in via Google proves ownership.
          // Wipe the unverified credentials passwordHash and mark the account verified.
          if (!existingUser.emailVerified && existingUser.passwordHash) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                passwordHash: null,
                emailVerified: new Date(),
              },
            });
          }
        }
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      // 1. Initial sign-in: populate from User object
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.image = user.image;
        token.emailVerified = user.emailVerified;
        token.onboardingComplete = Boolean(user.onboardingCompletedAt);
        token.mustChangePassword = Boolean(user.mustChangePassword);
        token.city = user.city;
        token.age = user.age;
        token.locale = user.locale;
        token.sessionVersion = user.sessionVersion || 1;
        return token;
      }

      // 2. Token refresh / verification against database
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            emailVerified: true,
            onboardingCompletedAt: true,
            mustChangePassword: true,
            sessionVersion: true,
            city: true,
            age: true,
            locale: true,
          },
        });

        // User was deleted or sessionVersion mismatch (e.g. password was changed)
        if (!dbUser || dbUser.sessionVersion !== (token.sessionVersion ?? 1)) {
          return null;
        }

        token.name = dbUser.name;
        token.image = dbUser.image;
        token.emailVerified = dbUser.emailVerified;
        token.onboardingComplete = Boolean(dbUser.onboardingCompletedAt);
        token.mustChangePassword = Boolean(dbUser.mustChangePassword);
        token.city = dbUser.city;
        token.age = dbUser.age;
        token.locale = dbUser.locale;
        token.sessionVersion = dbUser.sessionVersion;
      }

      // 3. Client called useSession().update(...)
      if (trigger === "update" && session) {
        if (session.name !== undefined) token.name = session.name;
        if (session.image !== undefined) token.image = session.image;
        if (session.city !== undefined) token.city = session.city;
        if (session.age !== undefined) token.age = session.age;
        if (session.locale !== undefined) token.locale = session.locale;
        if (session.onboardingComplete !== undefined)
          token.onboardingComplete = Boolean(session.onboardingComplete);
        if (session.mustChangePassword !== undefined)
          token.mustChangePassword = Boolean(session.mustChangePassword);
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = (token.id as string) || "";
        session.user.name = token.name as string | null | undefined;
        session.user.email = (token.email as string) || "";
        session.user.image = token.image as string | null | undefined;
        session.user.emailVerified = (token.emailVerified as Date | null) ?? null;
        session.user.onboardingComplete = Boolean(token.onboardingComplete);
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.city = token.city as string | null | undefined;
        session.user.age = token.age as number | null | undefined;
        session.user.locale = token.locale as string | null | undefined;
      }
      return session;
    },
  },
});
