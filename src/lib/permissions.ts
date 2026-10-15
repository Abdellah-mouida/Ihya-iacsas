import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

export type Permission =
  | "events:view"
  | "events:create"
  | "events:update"
  | "events:delete"
  | "bookings:view"
  | "bookings:manage"
  | "bookings:export"
  | "gallery:manage"
  | "carousel:manage"
  | "contacts:view"
  | "contacts:manage"
  | "users:view"
  | "users:manage_roles"
  | "users:delete"
  | "audit:view"
  | "settings:manage";

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  USER: ["events:view"],
  MODERATOR: [
    "events:view",
    "events:create",
    "events:update",
    "bookings:view",
    "bookings:manage",
    "gallery:manage",
    "carousel:manage",
    "contacts:view",
    "contacts:manage",
  ],
  ADMIN: [
    "events:view",
    "events:create",
    "events:update",
    "events:delete",
    "bookings:view",
    "bookings:manage",
    "bookings:export",
    "gallery:manage",
    "carousel:manage",
    "contacts:view",
    "contacts:manage",
    "users:view",
    "users:manage_roles",
    "users:delete",
    "audit:view",
    "settings:manage",
  ],
} as const;

export function can(
  role: Role | string | null | undefined,
  permission: Permission,
): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role as Role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function hasAnyPermission(
  role: Role | string | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((perm) => can(role, perm));
}

export function hasAllPermissions(
  role: Role | string | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.every((perm) => can(role, perm));
}

export function getPermissionsForRole(
  role: Role | string | null | undefined,
): readonly Permission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role as Role] || [];
}

export class ForbiddenError extends Error {
  code = "FORBIDDEN";
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class UnauthorizedError extends Error {
  code = "UNAUTHORIZED";
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/**
 * Server helper to verify permission from the current NextAuth session.
 * In server actions or routes, calling this ensures the actor has the required permission.
 * If redirectOnFail is true (default false), redirects to /403 or /login.
 */
export async function requirePermission(
  permission: Permission,
  options: { redirectOnFail?: boolean } = {},
) {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) {
    if (options.redirectOnFail) {
      redirect("/login");
    }
    throw new UnauthorizedError();
  }

  const role = session.user.role as Role;
  if (!can(role, permission)) {
    if (options.redirectOnFail) {
      redirect("/403");
    }
    throw new ForbiddenError();
  }

  return session.user;
}
