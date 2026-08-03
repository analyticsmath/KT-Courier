import type { StaticImageData } from "next/image";

/** A statically imported asset or a root-relative local public asset path. */
export type LocalPublicImageSource = StaticImageData | `/${string}`;

export type ImageLoading = "lazy" | "eager";
export type ImageFetchPriority = "high" | "low" | "auto";

export function assertPublicImageAccessibility({
  alt,
  decorative = false,
  componentName,
}: {
  alt?: string;
  decorative?: boolean;
  componentName: string;
}): string {
  const normalizedAlt = alt?.trim() ?? "";

  if (process.env.NODE_ENV !== "production") {
    if (decorative && normalizedAlt) {
      throw new Error(`${componentName}: decorative images must use an empty alt value.`);
    }

    if (!decorative && !normalizedAlt) {
      throw new Error(`${componentName}: meaningful images require a non-empty alt value.`);
    }
  }

  return decorative ? "" : normalizedAlt;
}
