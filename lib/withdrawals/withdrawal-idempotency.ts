import { createHash } from "node:crypto";

function canonical(value: Readonly<Record<string, string | number>>): string {
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${key}:${item}`).join("\n");
}

export function withdrawalCreationHash(input: Readonly<{
  ownerType: string;
  ownerId: string;
  walletId: string;
  amount: string;
  currency: "ZAR";
  payoutDestinationId: string;
  policyVersion: number;
}>): string {
  return createHash("sha256").update(canonical(input)).digest("hex");
}

export function payoutAttemptHash(input: Readonly<{ withdrawalId: string; operationId: string; actorUserId: string }>): string {
  return createHash("sha256").update(canonical(input)).digest("hex");
}

export function payoutCompletionHash(input: Readonly<{
  withdrawalId: string;
  attemptId: string;
  externalReference: string;
  evidenceReference?: string;
}>): string {
  return createHash("sha256").update(canonical({ ...input, evidenceReference: input.evidenceReference ?? "" })).digest("hex");
}
