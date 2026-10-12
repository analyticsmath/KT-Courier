import { createHash } from "node:crypto";

/** Preserve short existing identities; bound nested ledger operations without
 * losing any parent, authority or allocation component from their identity. */
export function storeAdjustmentChildOperation(parent: string, kind: "commission" | "store-earning" | "refund", source?: string): string {
  const legacy = `${parent}:${kind}${source === undefined ? "" : `:${source}`}`;
  return legacy.length <= 80 ? legacy : `soadj:${createHash("sha256").update(JSON.stringify([parent, kind, source ?? null])).digest("hex")}`;
}
