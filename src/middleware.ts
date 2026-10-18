/**
 * Next.js Edge Middleware for Role-Based Access Control and Auth Routing
 * Enforces NextAuth role-based access on /admin, handles redirects for signed-in users on auth pages,
 * and redirects /admin/login to /login.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

async function getAuthToken(request: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  // NextAuth v5/Auth.js uses __Secure-authjs.session-token over HTTPS or authjs.session-token over HTTP.
  // We attempt with secureCookie: true first if on HTTPS or if secure cookie header is present,
  // falling back to secureCookie: false (and vice versa).
  const isHttps =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto") === "https:" ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("__Secure-next-auth.session-token");

  let token = await getToken({
    req: request,
    secret,
    secureCookie: isHttps,
  });

  if (!token && !isHttps) {
    // Attempt with secureCookie: true in case reverse proxy or test environment didn't set proto
    token = await getToken({
      req: request,
      secret,
      secureCookie: true,
    });
  } else if (!token && isHttps) {
    // Attempt with secureCookie: false in case of mixed dev environment
    token = await getToken({
      req: request,
      secret,
      secureCookie: false,
    });
  }

  return token;
}

const PUBLIC_AUTH_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const PROTECTED_USER_ROUTES = [
  "/settings",
  "/profile",
  "/change-password",
  "/onboarding",
];

function isSafeRelativeUrl(url: string | null): boolean {
  if (!url) return false;
  // Must start with a single slash and not double slashes (protocol-relative)
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  // Must not redirect to another auth route
  if (PUBLIC_AUTH_ROUTES.some((route) => url === route || url.startsWith(`${route}?`))) {
    return false;
  }
  return true;
}

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

  // 1. Check if user is already signed in on public auth routes
  const isPublicAuthRoute = PUBLIC_AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isPublicAuthRoute) {
    const token = await getAuthToken(request);
    if (token) {
      const callbackUrl = request.nextUrl.searchParams.get("callbackUrl");
      const target = isSafeRelativeUrl(callbackUrl) ? callbackUrl! : "/";
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.next();
  }

  // 2. Protected user routes (/settings, /profile, /change-password, /onboarding)
  const isProtectedUserRoute = PROTECTED_USER_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isProtectedUserRoute) {
    const token = await getAuthToken(request);
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      const callbackUrl = pathname + (request.nextUrl.search || "");
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. Protected /admin routes
  if (pathname.startsWith("/admin")) {
    const token = await getAuthToken(request);

    if (!token) {
      const loginUrl = new URL("/login", request.url);
      const callbackUrl = pathname + (request.nextUrl.search || "");
      loginUrl.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(loginUrl);
    }

    const role = token.role as string | undefined;

    // Regular users or unauthenticated roles cannot access admin -> real 403
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
