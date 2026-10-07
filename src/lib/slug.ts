import { prisma } from "@/lib/prisma";

/**
 * Normalizes input text into a URL-safe lowercase slug.
 * Supports Latin alphanumeric characters, numbers, and cleans all punctuation and spaces.
 */
export function slugify(text: string): string {
  if (!text) return `event-${Date.now()}`;

  const normalized = text
    .normalize("NFKD")
    .toLowerCase()
    .trim()
    // Replace punctuation, symbols, and spaces with hyphens
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    // Collapse consecutive hyphens
    .replace(/-+/g, "-")
    // Trim leading and trailing hyphens
    .replace(/^-+|-+$/g, "");

  return normalized || `event-${Date.now()}`;
}

/**
 * Generates a collision-free unique slug for an event.
 * If the candidate slug already exists on another event, appends a numeric suffix (-2, -3, etc.).
 */
export async function generateUniqueEventSlug(
  preferredSlugOrTitle: string,
  existingEventId?: string,
): Promise<string> {
  const baseSlug = slugify(preferredSlugOrTitle);
  let candidate = baseSlug;
  let counter = 2;

  while (true) {
    const conflict = await prisma.event.findFirst({
      where: {
        slug: candidate,
        ...(existingEventId ? { id: { not: existingEventId } } : {}),
      },
      select: { id: true },
    });

    if (!conflict) {
      return candidate;
    }

    candidate = `${baseSlug}-${counter}`;
    counter++;
  }
}
