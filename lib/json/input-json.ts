import type { Prisma } from "@prisma/client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map((item) => item === null ? null : toInputJsonValue(item));
  if (isRecord(value)) return toInputJsonObject(value);
  throw new TypeError("Expected a JSON-compatible value.");
}

export function toInputJsonObject(value: Record<string, unknown>): Prisma.InputJsonObject {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, item === null ? null : toInputJsonValue(item)]),
  );
}
