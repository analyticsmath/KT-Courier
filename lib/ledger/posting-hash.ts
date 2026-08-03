import { createHash } from "node:crypto";
import type { LedgerJsonValue, NormalizedLedgerPosting } from "./types";

function stableJson(value: LedgerJsonValue): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

export function canonicalPostingHashPayload(posting: NormalizedLedgerPosting): LedgerJsonValue {
  return {
    type: posting.type,
    currency: posting.currency,
    sourceReference: posting.sourceReference ?? null,
    correlationId: posting.correlationId ?? null,
    memo: posting.memo ?? null,
    metadata: posting.metadata ?? null,
    policyVersion: posting.policyVersion,
    reversalOfJournalId: posting.reversalOfJournalId ?? null,
    entries: posting.entries.map((entry) => ({
      accountId: entry.accountId,
      direction: entry.direction,
      amount: entry.amount.toString(),
      lineCode: entry.lineCode,
      memo: entry.memo ?? null,
    })),
  };
}

export function hashLedgerPosting(posting: NormalizedLedgerPosting): string {
  return createHash("sha256").update(stableJson(canonicalPostingHashPayload(posting))).digest("hex");
}

