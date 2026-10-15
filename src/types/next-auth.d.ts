import { type DefaultSession } from "next-auth";
import { type JWT as DefaultJWT } from "next-auth/jwt";
import { type Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      emailVerified?: Date | null;
      onboardingComplete: boolean;
      mustChangePassword: boolean;
      city?: string | null;
      age?: number | null;
      locale?: string | null;
      role: Role;
      lastLoginAt?: Date | null;
      lastActiveAt?: Date | null;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    emailVerified?: Date | null;
    onboardingCompletedAt?: Date | null;
    mustChangePassword?: boolean;
    city?: string | null;
    age?: number | null;
    locale?: string | null;
    sessionVersion?: number;
    role?: Role;
    lastLoginAt?: Date | null;
    lastActiveAt?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    emailVerified?: Date | null;
    onboardingComplete?: boolean;
    mustChangePassword?: boolean;
    sessionVersion?: number;
    city?: string | null;
    age?: number | null;
    locale?: string | null;
    role?: Role;
    lastLoginAt?: Date | null;
    lastActiveAt?: Date | null;
  }
}
