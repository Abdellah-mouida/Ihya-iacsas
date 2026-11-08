const AUTH_ROUTE_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/change-password",
  "/signout",
  "/sign-out",
];

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function isOnboardingExemptPath(pathname: string) {
  if (
    matchesRoute(pathname, "/onboarding") ||
    matchesRoute(pathname, "/api") ||
    matchesRoute(pathname, "/terms") ||
    matchesRoute(pathname, "/privacy") ||
    matchesRoute(pathname, "/_next") ||
    AUTH_ROUTE_PREFIXES.some((route) => matchesRoute(pathname, route))
  ) {
    return true;
  }

  return /\.[a-z0-9]{1,8}$/i.test(pathname);
}

export function decideOnboardingRedirect({
  pathname,
  search = "",
  authenticated,
  onboardingComplete,
}: {
  pathname: string;
  search?: string;
  authenticated: boolean;
  onboardingComplete: boolean;
}) {
  if (
    !authenticated ||
    onboardingComplete ||
    isOnboardingExemptPath(pathname)
  ) {
    return null;
  }

  const callbackUrl = `${pathname}${search}` || "/";
  return `/onboarding?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function safeOnboardingCallbackUrl(candidate: string | null | undefined) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.startsWith("/\\")) {
    return "/";
  }

  const path = candidate.split(/[?#]/, 1)[0] || "/";
  if (
    matchesRoute(path, "/onboarding") ||
    AUTH_ROUTE_PREFIXES.some((route) => matchesRoute(path, route))
  ) {
    return "/";
  }

  return candidate;
}
