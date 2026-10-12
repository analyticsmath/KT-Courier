import { randomUUID } from "node:crypto";
import { catalogRequestHash } from "@/lib/catalog/catalog-normalization";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { submitStoreSellerIdentity, reviewStoreSellerIdentity, getStoreSellerIdentityState } from "@/lib/services/store-seller-identity.service";
import type { SellerIdentityProposalInput, SellerIdentityReviewInput } from "@/lib/validation/store-seller-identity";
async function fixture() {
  const tag = randomUUID(); const owner = await prisma.user.create({ data: { email: `seller-owner-${tag}@example.test`, role: "STORE", status: "ACTIVE" } });
  const checker = await prisma.user.create({ data: { email: `seller-checker-${tag}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { name: "Synthetic seller; not a legal entity", slug: `seller-${tag}`, ownerUserId: owner.id, status: "ACTIVE" } });
  const input: SellerIdentityProposalInput = { operationId: randomUUID(), expectedIdentityReference: null, identityVersion: "synthetic-v1", legalName: "Synthetic test seller; not production legal identity", vatRegistrationStatus: "NOT_REGISTERED", countryCode: "ZA", invoiceClassification: "RECEIPT", effectiveFrom: new Date(Date.now() - 60_000).toISOString(), effectiveUntil: null, sourceEvidenceReference: "SYNTHETIC_OWNER_INPUT_ONLY", confirmSuppliedDetails: true };
  return { owner, checker, store, input };
}
const review = (proposal: { reference: string; updatedAt: string }, action: "APPROVE" | "REJECT" = "APPROVE"): SellerIdentityReviewInput => ({ proposalReference: proposal.reference, expectedUpdatedAt: proposal.updatedAt, operationId: randomUUID(), action, reason: "Synthetic independent review only", evidenceReference: "SYNTHETIC_REVIEW_NOT_REAL_APPROVAL", confirmIndependentReview: true });
describe("seller identity owner submission and independent approval on real PostgreSQL", () => {
  beforeAll(() => requireDisposableStoreSettlementDatabase());
  it("serializes owner submission and review replays with one canonical identity and no financial writes", async () => {
    const f = await fixture(), journals = await prisma.ledgerJournal.count(), payments = await prisma.payment.count();
    const pending = await Promise.all([submitStoreSellerIdentity(f.store.id, f.owner.id, f.input), submitStoreSellerIdentity(f.store.id, f.owner.id, f.input)]);
    expect(new Set(pending.map(p => p.reference)).size).toBe(1); expect(pending.filter(p => p.replayed)).toHaveLength(1);
    expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: f.store.id } })).toBe(0);
    const command = review(pending[0]); const results = await Promise.all([reviewStoreSellerIdentity(f.store.id, f.checker.id, command), reviewStoreSellerIdentity(f.store.id, f.checker.id, command)]);
    expect(results.filter(p => p.replayed)).toHaveLength(1); expect(new Set(results.map(p => p.identityReference)).size).toBe(1);
    expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: f.store.id } })).toBe(1);
    expect(await prisma.adminActivityLog.count({ where: { entityId: pending[0].reference } })).toBe(2);
    expect(await prisma.ledgerJournal.count()).toBe(journals); expect(await prisma.payment.count()).toBe(payments);
    await expect(reviewStoreSellerIdentity(f.store.id, f.checker.id, { ...command, reason: "Changed operation meaning" })).rejects.toMatchObject({ code: "SELLER_REVIEW_CONFLICT" });
  }, 15_000);
  it("denies foreign ownership, own review, changed submission and stale review facts", async () => {
    const f = await fixture(), foreign = await fixture();
    await expect(submitStoreSellerIdentity(f.store.id, foreign.owner.id, f.input)).rejects.toMatchObject({ status: 403 });
    const pending = await submitStoreSellerIdentity(f.store.id, f.owner.id, f.input);
    await expect(submitStoreSellerIdentity(f.store.id, f.owner.id, { ...f.input, legalName: "Changed legal identity" })).rejects.toMatchObject({ code: "SELLER_OPERATION_CONFLICT" });
    await prisma.user.update({ where: { id: f.owner.id }, data: { role: "SUPER_ADMIN" } });
    await expect(reviewStoreSellerIdentity(f.store.id, f.owner.id, review(pending))).rejects.toMatchObject({ code: "SELLER_INDEPENDENT_REVIEW_REQUIRED" });
    await expect(reviewStoreSellerIdentity(foreign.store.id, f.checker.id, review(pending))).rejects.toMatchObject({ status: 404 });
    await expect(reviewStoreSellerIdentity(f.store.id, f.checker.id, { ...review(pending), expectedUpdatedAt: new Date(0).toISOString() })).rejects.toMatchObject({ code: "SELLER_REVIEW_STALE" });
    expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: f.store.id } })).toBe(0);
  }, 15_000);
  it("preserves historic legal facts and rejects a parallel stale successor", async () => {
    const f = await fixture(); const first = await submitStoreSellerIdentity(f.store.id, f.owner.id, f.input);
    const competing = await submitStoreSellerIdentity(f.store.id, f.owner.id, { ...f.input, identityVersion: "competing-v1", operationId: randomUUID() });
    const approved = await reviewStoreSellerIdentity(f.store.id, f.checker.id, review(first));
    await expect(submitStoreSellerIdentity(f.store.id, f.owner.id, { ...f.input, expectedIdentityReference: approved.identityReference!, operationId: randomUUID() })).rejects.toMatchObject({ code: "SELLER_VERSION_ALREADY_USED" });
    await expect(reviewStoreSellerIdentity(f.store.id, f.checker.id, review(competing))).rejects.toMatchObject({ code: "SELLER_IDENTITY_STALE" });
    const next = await submitStoreSellerIdentity(f.store.id, f.owner.id, { ...f.input, identityVersion: "synthetic-v2", legalName: "Synthetic successor seller", expectedIdentityReference: approved.identityReference!, effectiveFrom: new Date().toISOString(), operationId: randomUUID() });
    await reviewStoreSellerIdentity(f.store.id, f.checker.id, review(next));
    const original = await prisma.storeSellerLegalIdentity.findUniqueOrThrow({ where: { publicReference: approved.identityReference } });
    expect(original.legalName).toBe(f.input.legalName); expect(original.effectiveUntil).toEqual(new Date(next.input.effectiveFrom));
    const current = (await getStoreSellerIdentityState(f.store.id)).currentIdentity!;
    expect(current.identityVersion).toBe("synthetic-v2");
    await prisma.storeSellerLegalIdentity.update({ where: { id: original.id }, data: { effectiveUntil: null } });
    const blocked = await submitStoreSellerIdentity(f.store.id, f.owner.id, { ...f.input, identityVersion: "synthetic-v3", expectedIdentityReference: current.publicReference, effectiveFrom: new Date(Date.now() + 60_000).toISOString(), operationId: randomUUID() });
    await expect(reviewStoreSellerIdentity(f.store.id, f.checker.id, review(blocked))).rejects.toMatchObject({ code: "SELLER_IDENTITY_WINDOW_OVERLAP" });
    expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: f.store.id } })).toBe(2);
  }, 15_000);
  it("rejects a forged settings proposal without a matching owner submission audit", async () => {
    const f = await fixture(); const pending = await submitStoreSellerIdentity(f.store.id, f.owner.id, f.input);
    const row = await prisma.systemSetting.findFirstOrThrow({ where: { key: { startsWith: `store_seller_identity_proposal:${f.store.id}:` } } });
    const forgedInput = { ...f.input, legalName: "Forged unsupplied seller" };
    const forged = { ...(row.value as object), input: forgedInput, requestHash: catalogRequestHash(forgedInput) };
    const updated = await prisma.systemSetting.update({ where: { id: row.id }, data: { value: forged } });
    await expect(reviewStoreSellerIdentity(f.store.id, f.checker.id, review({ ...pending, updatedAt: updated.updatedAt.toISOString() }))).rejects.toMatchObject({ code: "SELLER_SUBMISSION_EVIDENCE_INVALID" });
    expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: f.store.id } })).toBe(0);
  }, 15_000);
  it("rolls back approval and effective-window changes when durable review audit fails", async () => {
    const f = await fixture(); const pending = await submitStoreSellerIdentity(f.store.id, f.owner.id, f.input);
    await prisma.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_seller_audit_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."entityType"='StoreSellerIdentityProposal' AND NEW.action='STATUS_CHANGE' THEN RAISE EXCEPTION 'Synthetic seller audit failure'; END IF; RETURN NEW; END; $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER test_seller_audit_reject BEFORE INSERT ON "AdminActivityLog" FOR EACH ROW EXECUTE FUNCTION test_seller_audit_reject()`);
    try { await expect(reviewStoreSellerIdentity(f.store.id, f.checker.id, review(pending))).rejects.toThrow(); }
    finally { await prisma.$executeRawUnsafe(`DROP TRIGGER test_seller_audit_reject ON "AdminActivityLog"`); await prisma.$executeRawUnsafe(`DROP FUNCTION test_seller_audit_reject()`); }
    expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: f.store.id } })).toBe(0);
    expect((await getStoreSellerIdentityState(f.store.id)).proposals[0].status).toBe("PENDING_REVIEW");
  }, 15_000);
  it("records rejection without approving seller authority", async () => {
    const f = await fixture(); const pending = await submitStoreSellerIdentity(f.store.id, f.owner.id, f.input), command = review(pending, "REJECT");
    expect((await reviewStoreSellerIdentity(f.store.id, f.checker.id, command)).status).toBe("REJECTED");
    expect((await reviewStoreSellerIdentity(f.store.id, f.checker.id, command)).replayed).toBe(true);
    expect(await prisma.storeSellerLegalIdentity.count({ where: { storeId: f.store.id } })).toBe(0);
  }, 15_000);
});
