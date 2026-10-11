import { type DefaultSession } from "next-auth";
import { type JWT as DefaultJWT } from "next-auth/jwt";

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
  }
}
