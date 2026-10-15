/**
 * Next.js Edge Middleware for Role-Based Access Control
 * Enforces NextAuth role-based access on /admin and redirects /admin/login to /login.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy admin login URL redirect -> /login
  if (pathname === "/admin/login") {
    const nextParam =
      request.nextUrl.searchParams.get("next") ||
      request.nextUrl.searchParams.get("callbackUrl") ||
      "/admin";
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", nextParam);
    return NextResponse.redirect(loginUrl);
  }

  // Protected /admin routes
  if (pathname.startsWith("/admin")) {
    const token = await getToken({
      req: request,
      secret: process.env.AUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      const callbackUrl = pathname + (request.nextUrl.search || "");
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    const role = token.role as string | undefined;

    // Regular users or unauthenticated roles cannot access admin
    if (role !== "ADMIN" && role !== "MODERATOR") {
      return NextResponse.redirect(new URL("/403", request.url));
    }

    // MODERATOR role has restricted access:
    // Disallowed: /admin/users, /admin/audit, /admin/settings
    if (role === "MODERATOR") {
      const restrictedForModerator = [
        "/admin/users",
        "/admin/audit",
        "/admin/settings",
      ];
      const isRestricted = restrictedForModerator.some(
        (r) => pathname === r || pathname.startsWith(r + "/"),
      );
      if (isRestricted) {
        return NextResponse.redirect(new URL("/403", request.url));
      }
    }

    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.png, apple-icon.png
     * - public static images / media files
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
