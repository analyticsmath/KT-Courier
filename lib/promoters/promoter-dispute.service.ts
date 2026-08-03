/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 Prisma delegates are intentionally deferred. */
import { createHash, randomUUID } from "node:crypto";
import { PromoterError } from "./errors";
import { assertPromotersProductionReady } from "./production-readiness";

type Db = any;
const ref = () => `PDP-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const CATEGORIES = new Set(["MISSING_ATTRIBUTION", "MISSING_QUALIFICATION", "MISSING_EARNING", "DISPUTED_REVERSAL"]);
const safeText = (value: unknown) => typeof value === "string" && value.trim().length >= 10 && value.length <= 2_000 && !/(?:@|\+\d{7,}|\b(?:card|iban|account number)\b)/i.test(value);

export async function createPromoterDispute(db: Db, input: any) {
  assertPromotersProductionReady();
  if (!CATEGORIES.has(input.category) || !safeText(input.promoterStatement) || !input.operationId) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Dispute category, safe statement, and operation ID are required.");
  return db.$transaction(async (tx: Db) => {
    const account = await tx.promoterAccount.findFirst({ where: { id: input.promoterAccountId, userId: input.actorUserId } });
    if (!account) throw new PromoterError("PROMOTER_FORBIDDEN", "Promoter ownership is required.");
    const row = await tx.promoterDispute.create({ data: { publicReference: ref(), promoterAccountId: account.id, attributionId: input.attributionId ?? null, earningId: input.earningId ?? null, category: input.category === "MISSING_QUALIFICATION" ? "QUALIFICATION_STATUS" : input.category === "DISPUTED_REVERSAL" ? "REVERSAL" : input.category, promoterStatement: input.promoterStatement.trim(), safeEvidenceReference: input.safeEvidenceReference ?? null, operationId: input.operationId, requestHash: input.requestHash ?? hash(input) } });
    await tx.promoterEventIntent.create({ data: { eventType: "PROMOTER_DISPUTE_UPDATED", promoterAccountId: account.id, aggregateReference: row.publicReference, operationId: `event:${input.operationId}`, safePayload: { category: input.category, status: "OPEN" } } });
    return row;
  });
}
export async function addPromoterDisputeEvidence(db: Db, input: any) { assertPromotersProductionReady(); if (!/^[A-Za-z0-9._:-]{6,160}$/.test(input.attachmentReference ?? "") || !["application/pdf", "image/jpeg", "image/png"].includes(input.contentType)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "Only approved attachment references are accepted."); const dispute = await db.promoterDispute.findFirst({ where: { publicReference: input.reference, promoterAccount: { userId: input.actorUserId } } }); if (!dispute) throw new PromoterError("PROMOTER_FORBIDDEN", "Promoter ownership is required."); return db.promoterDispute.update({ where: { id: dispute.id }, data: { safeEvidenceReference: input.attachmentReference } }); }
export async function reviewPromoterDispute(db: Db, input: any) { assertPromotersProductionReady(); return db.promoterDispute.update({ where: { publicReference: input.reference }, data: { status: "UNDER_REVIEW" } }); }
export async function respondToPromoterDispute(db: Db, input: any) { assertPromotersProductionReady(); if (!safeText(input.safeResponse)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A privacy-safe response is required."); return db.promoterDispute.update({ where: { publicReference: input.reference }, data: { safeResolution: input.safeResponse.trim() } }); }
export async function closePromoterDispute(db: Db, input: any) { assertPromotersProductionReady(); const row = await db.promoterDispute.update({ where: { publicReference: input.reference }, data: { status: "CLOSED", safeResolution: input.safeResponse ?? "Closed after canonical evidence review." } }); if (input.retry) await input.retry({ reference: input.reconciliationReference, operationId: `dispute:${input.operationId}` }); return row; }
