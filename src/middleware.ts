/**
 * Next.js Edge Middleware for Admin Access Gate
 *
 * NOTE: STOPGAP SECURITY MEASURE
 * This middleware enforces single-password access control on all /admin routes
 * and automatically clears the session cookie when navigating away to the public site.
 * This should be replaced with a robust authentication solution (e.g. NextAuth)
 * prior to a full public release.
 */

import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  // Case 1: Route under /admin
  if (pathname.startsWith("/admin")) {
    const isLoginPage = pathname === "/admin/login";
    const isAuthenticated = await verifyAdminSessionToken(sessionCookie);

    if (isLoginPage) {
      // If already logged in, redirect away from /admin/login to /admin dashboard
      if (isAuthenticated) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
      return NextResponse.next();
    }

    // Protected /admin sub-routes
    if (!isAuthenticated) {
      const loginUrl = new URL("/admin/login", request.url);
      if (pathname !== "/admin") {
        loginUrl.searchParams.set("next", pathname);
      }
      const response = NextResponse.redirect(loginUrl);
      if (sessionCookie) {
        response.cookies.delete(ADMIN_COOKIE_NAME);
      }
      return response;
    }

    return NextResponse.next();
  }

  // Case 2: Public route outside /admin
  // If the admin navigates away to the public site, explicitly clear the session cookie
  // so leaving the dashboard immediately ends the session per security requirements.
  // Note: Only clear on actual document navigations, NOT on background prefetches or asset loads.
  if (sessionCookie) {
    const isPrefetch =
      request.headers.get("next-router-prefetch") === "1" ||
      request.headers.get("purpose") === "prefetch" ||
      request.headers.get("sec-purpose") === "prefetch";

    const isDocumentNavigation =
      request.headers.get("sec-fetch-dest") === "document" ||
      request.headers.get("accept")?.includes("text/html");

    if (!isPrefetch && isDocumentNavigation) {
      const response = NextResponse.next();
      response.cookies.delete(ADMIN_COOKIE_NAME);
      return response;
    }
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
