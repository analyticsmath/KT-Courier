import { createHash } from "node:crypto";

/**
 * Do not expose private media references in URL query params.
 * A short irreversible revision forces the shell to refresh an uploaded
 * profile photo when it is replaced; /api/platform/avatar remains private.
 */
export function getProfileAvatarUrl(reference?: string | null): string | undefined {
  if (!reference) return undefined;
  const revision = createHash("sha256").update(reference).digest("hex").slice(0, 12);
  return `/api/platform/avatar?v=${revision}`;
}
