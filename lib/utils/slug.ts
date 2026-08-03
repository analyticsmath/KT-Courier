/**
 * Generates a URL-safe slug from a text string.
 * Example: "KT Local Store" → "kt-local-store"
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")     // remove unsafe chars
    .replace(/\s+/g, "-")             // spaces → hyphens
    .replace(/-+/g, "-")              // collapse consecutive hyphens
    .trim()
    .replace(/^-|-$/g, "");           // trim leading/trailing hyphens
}

/**
 * Generates a unique slug by checking against existing slugs via the
 * provided `exists` callback. Tries numbered suffixes first, then a
 * short random suffix as a final fallback.
 */
export async function generateUniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
): Promise<string> {
  const baseSlug = generateSlug(base) || "store";

  if (!(await exists(baseSlug))) return baseSlug;

  for (let n = 2; n <= 99; n++) {
    const candidate = `${baseSlug}-${n}`;
    if (!(await exists(candidate))) return candidate;
  }

  // Fallback: short random 4-char hex suffix
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${baseSlug}-${suffix}`;
}
