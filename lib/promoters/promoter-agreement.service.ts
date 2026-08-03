/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 delegates are validated during deferred runtime validation. */
import { randomUUID } from "node:crypto";
import { PromoterError } from "./errors";
import { assertPromotersProductionReady } from "./production-readiness";

type Db = any;
const reference = () => `PAG-${randomUUID().replaceAll("-", "").toUpperCase()}`;
const operation = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(value);
const requiredText = (value: unknown) => typeof value === "string" && value.trim().length >= 8;

function validateTerms(input: any) {
  if (![input.title, input.termsContent, input.disclosureRequirements, input.prohibitedConduct, input.privacyTerms, input.taxNotice, input.terminationPolicy].every(requiredText) || !(input.effectiveFrom instanceof Date) || (input.effectiveUntil && input.effectiveUntil <= input.effectiveFrom)) {
    throw new PromoterError("PROMOTER_INVALID_COMMAND", "Agreement terms, disclosure, prohibited conduct, privacy, tax notice, and an effective period are required.");
  }
}

/** Agreement versions are append-only commercial records; active and approved versions are never edited. */
export async function createPromoterAgreementVersion(db: Db, input: any) {
  assertPromotersProductionReady(); if (!operation(input.operationId)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required.");
  validateTerms(input);
  return db.$transaction(async (tx: Db) => {
    const receipt = await tx.promoterEventIntent.findUnique({ where: { operationId: `agreement:${input.operationId}` } });
    if (receipt) return tx.promoterAgreementVersion.findUnique({ where: { publicReference: receipt.aggregateReference } });
    const latest = await tx.promoterAgreementVersion.aggregate({ _max: { versionNumber: true } });
    const row = await tx.promoterAgreementVersion.create({ data: { publicReference: reference(), versionNumber: (latest._max.versionNumber ?? 0) + 1, title: input.title.trim(), termsContent: input.termsContent.trim(), disclosureRequirements: input.disclosureRequirements.trim(), prohibitedConduct: input.prohibitedConduct.trim(), privacyTerms: input.privacyTerms.trim(), taxNotice: input.taxNotice.trim(), terminationPolicy: input.terminationPolicy.trim(), effectiveFrom: input.effectiveFrom, effectiveUntil: input.effectiveUntil ?? null } });
    await tx.promoterEventIntent.create({ data: { eventType: "PROMOTER_APPLICATION_SUBMITTED", aggregateReference: row.publicReference, operationId: `agreement:${input.operationId}`, safePayload: { aggregate: "AGREEMENT_VERSION" } } });
    return row;
  });
}
export async function submitPromoterAgreementVersion(db: Db, input: any) { assertPromotersProductionReady(); if (!operation(input.operationId)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required."); const row = await db.promoterAgreementVersion.findUnique({ where: { publicReference: input.reference } }); if (!row || row.status !== "DRAFT") throw new PromoterError("PROMOTER_NOT_ELIGIBLE", "Only a draft agreement version may be submitted."); return row; }
export async function approvePromoterAgreementVersion(db: Db, input: any) { assertPromotersProductionReady(); if (!operation(input.operationId)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required."); return db.promoterAgreementVersion.updateMany({ where: { publicReference: input.reference, status: "DRAFT" }, data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId: input.approvedByUserId } }); }
export async function activatePromoterAgreementVersion(db: Db, input: any) { assertPromotersProductionReady(); if (!operation(input.operationId)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required."); return db.promoterAgreementVersion.updateMany({ where: { publicReference: input.reference, status: "APPROVED", effectiveFrom: { lte: new Date() }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: new Date() } }] }, data: { status: "ACTIVE", activatedAt: new Date() } }); }
export async function retirePromoterAgreementVersion(db: Db, input: any) { assertPromotersProductionReady(); if (!operation(input.operationId)) throw new PromoterError("PROMOTER_INVALID_COMMAND", "A stable operation ID is required."); return db.promoterAgreementVersion.updateMany({ where: { publicReference: input.reference, status: "ACTIVE" }, data: { status: "RETIRED", retiredAt: new Date() } }); }
