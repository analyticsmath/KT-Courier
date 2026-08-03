import type { AdminActivityLog, User } from "@/types/db";
import type { AdminActionType } from "@/types/db";

// ─── DTO ──────────────────────────────────────────────────────────────────────

export interface AdminActivityDto {
  id: string;
  action: AdminActionType;
  entityType: string | null;
  entityId: string | null;
  message: string | null;
  actor: { id: string; name: string | null; email: string } | null;
  /** Sanitized metadata — keys beginning with underscore or containing
   *  "hash", "token", "secret", "password" are stripped. */
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

// ─── Sanitize metadata ────────────────────────────────────────────────────────

const SENSITIVE_PATTERNS = /hash|token|secret|password|otp|pin/i;

function sanitizeMetadata(
  raw: unknown
): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (k.startsWith("_") || SENSITIVE_PATTERNS.test(k)) continue;
    // Only include primitives or short arrays — no deep nesting
    if (
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean" ||
      v === null ||
      (Array.isArray(v) && v.every((i) => typeof i !== "object"))
    ) {
      result[k] = v;
    }
  }
  return Object.keys(result).length ? result : null;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

type ActivityWithActor = AdminActivityLog & { actorUser?: User | null };

export function toAdminActivityDto(log: ActivityWithActor): AdminActivityDto {
  return {
    id: log.id,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    message: log.message,
    actor: log.actorUser
      ? { id: log.actorUser.id, name: log.actorUser.name, email: log.actorUser.email }
      : null,
    metadata: sanitizeMetadata(log.metadata),
    createdAt: log.createdAt,
  };
}
