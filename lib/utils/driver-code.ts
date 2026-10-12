import { randomUUID } from "node:crypto";

/** Stable unique identity independent of row count, deletions and concurrent signups. */
export function newDriverCode(): string {
  return `DRV-${randomUUID().replaceAll("-", "").toUpperCase()}`;
}
