import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Safely calls Next.js revalidatePath without throwing when invoked
 * outside an active HTTP request context (e.g. in Playwright/Node test runners).
 */
export function safeRevalidatePath(path: string, type?: "layout" | "page") {
  try {
    revalidatePath(path, type);
  } catch {
    // Ignore invariant error when static generation store is not active
  }
}

/**
 * Safely calls Next.js revalidateTag without throwing.
 */
export function safeRevalidateTag(tag: string) {
  try {
    revalidateTag(tag, "max");
  } catch {
    // Ignore invariant error when static generation store is not active
  }
}
