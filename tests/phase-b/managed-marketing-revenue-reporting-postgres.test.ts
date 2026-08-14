import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { ManagedMarketingService } from "@/lib/advertising/managed-marketing.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { syncSystemPermissions } from "@/lib/auth/permissions";
import { PrivateMediaOwnerType, PrivateMediaPurpose, PrivateMediaStatus, StoreStatus, UserRole, UserStatus } from "@/types/db";

const marker = `MMRR${randomUUID().replaceAll("-", "").toUpperCase()}`;
const service = new ManagedMarketingService();
let adminId = ""; let storeUserId = ""; let storeId = ""; let packageReference = ""; let channelReference = ""; let placementReference = ""; let creativeReference = "";
const admin = () => ({ actorUserId: adminId, actorRole: UserRole.ADMIN });
const storeActor = () => ({ actorUserId: storeUserId, actorRole: UserRole.STORE });

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await syncSystemPermissions({ actorUserId: `phase-b-${marker}` });
  const [operator, storeUser] = await Promise.all([
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-admin@example.test`, passwordHash: "phase-b-test-only", name: "Marketing reporting admin", role: UserRole.ADMIN, status: UserStatus.ACTIVE } }),
    prisma.user.create({ data: { email: `${marker.toLowerCase()}-store@example.test`, passwordHash: "phase-b-test-only", name: "Marketing reporting store", role: UserRole.STORE, status: UserStatus.ACTIVE } }),
  ]);
  adminId = operator.id; storeUserId = storeUser.id;
  const store = await prisma.store.create({ data: { ownerUserId: storeUserId, name: "Revenue proof store", slug: `${marker.toLowerCase()}-store`, status: StoreStatus.ACTIVE } }); storeId = store.id;
  const channel = await service.createChannel({ ...admin(), code: `${marker}_CHANNEL`, displayName: "Revenue proof channel" }); channelReference = channel.publicReference;
  const placement = await service.createPlacement({ ...admin(), code: `${marker}_PLACEMENT`, displayName: "Revenue proof placement", channelReference, kind: "MANUAL_EXTERNAL", externalPlacementReference: "operator:revenue-proof" }); placementReference = placement.publicReference;
  const packageVersion = await service.createPackage({ ...admin(), code: `${marker}_PACKAGE`, name: "Revenue proof package", channel: "FACEBOOK", channelReferences: [channelReference], packageTerms: { proof: "revenue" }, priceAmount: "100.00", taxRate: "0.1500", effectiveAt: new Date("2031-01-01T00:00:00.000Z") });
  await service.activatePackage(packageVersion.publicReference, admin()); packageReference = packageVersion.publicReference;
  const creative = await prisma.privateMediaObject.create({ data: { publicReference: `PMO-${marker}`, ownerType: PrivateMediaOwnerType.STORE, ownerId: storeId, purpose: PrivateMediaPurpose.OTHER, status: PrivateMediaStatus.READY, storageProvider: "test", storageKey: `revenue-proof/${marker}`, originalFileName: "creative.png", declaredMimeType: "image/png", detectedMimeType: "image/png", byteSize: 42, checksum: marker, createdByUserId: storeUserId } }); creativeReference = creative.publicReference;
});

async function approvedCampaign(operationId: string) {
  const request = await service.createDraft({ actor: storeActor(), packageReference, selections: [{ channelReference, placementReferences: [placementReference] }], objective: "Revenue proof campaign", audience: { segment: "proof" }, message: "Revenue reporting proof campaign.", destinationLink: "https://example.test/revenue", startsAt: new Date("2032-02-01T00:00:00.000Z"), endsAt: new Date("2032-02-20T00:00:00.000Z"), operationId: `${operationId}-DRAFT` });
  await service.attachCreative(storeActor(), request.publicReference, { source: "PRIVATE_MEDIA", mediaReference: creativeReference });
  await service.submitDraft(storeActor(), request.publicReference, `${operationId}-SUBMIT`);
  await service.beginReview(admin(), request.publicReference, `${operationId}-REVIEW`);
  await service.approveRequest(admin(), request.publicReference, `${operationId}-APPROVE`);
  return request;
}

describe("Phase B managed-marketing revenue/reporting PostgreSQL production-service proof", () => {
  it("uses committed package economics, recognizes verified payment exactly once, balances revenue evidence, and reports operator performance", async () => {
    const request = await approvedCampaign(`${marker}-CAMPAIGN`);
    const prepared = await service.preparePayment(storeActor(), request.publicReference, `${marker}-PAYMENT`);
    const payment = await prisma.payment.findUniqueOrThrow({ where: { publicReference: prepared.publicReference } });
    expect(payment.amount.toFixed(2)).toBe("115.00");
    const platform = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
    const [cash, held] = await Promise.all([
      ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" }),
      ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" }),
    ]);
    const receipt = await postLedgerJournal({ idempotencyKey: `${marker}-RECEIPT`, sourceReference: `${marker}-RECEIPT`, type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", actor: { kind: "SYSTEM" }, entries: [{ accountId: cash.id, direction: "DEBIT", amount: "115.00", lineCode: "MM_RECEIPT_CASH" }, { accountId: held.id, direction: "CREDIT", amount: "115.00", lineCode: "MM_RECEIPT_HELD" }] });
    const attempt = await prisma.paymentAttempt.create({ data: { paymentId: payment.id, publicReference: `pat_${marker}`.slice(0, 80), attemptNumber: 1, provider: "PAYFAST", idempotencyKey: `${marker}-ATTEMPT`, requestHash: "a".repeat(64), merchantReference: `kt:payment:${payment.publicReference}:attempt:1`, status: "SUCCEEDED", amount: payment.amount, currency: "ZAR", providerEnvironment: "SANDBOX", providerCredentialVersion: "proof-v1", providerReference: `${marker}-PROVIDER`, completedAt: new Date(), providerConfirmedAt: new Date() } });
    const webhook = await prisma.paymentWebhookEvent.create({ data: { publicReference: `pwe_${marker}`.slice(0, 80), provider: "PAYFAST", environment: "SANDBOX", eventFingerprint: "b".repeat(64), merchantReference: attempt.merchantReference, providerPaymentId: `${marker}-PROVIDER`, providerStatus: "COMPLETE", normalizedStatus: "COMPLETE", processingStatus: "APPLIED", paymentId: payment.id, attemptId: attempt.id, ledgerJournalId: receipt.id, sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true, verifiedAt: new Date(), appliedAt: new Date() } });
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", successfulAttemptId: attempt.id, successWebhookEventId: webhook.id, successLedgerJournalId: receipt.id, providerConfirmedAt: new Date(), succeededAt: new Date(), reconciliationStatus: "RESOLVED" } });
    const results = await Promise.all([service.recognizeVerifiedPayment(payment.id), service.recognizeVerifiedPayment(payment.id)]);
    expect(results[0].id).toBe(results[1].id);
    const evidence = await prisma.managedMarketingBillingEvidence.findUniqueOrThrow({ where: { paymentId: payment.id }, include: { revenueLedgerJournal: true } });
    expect(evidence.revenueAmount.toFixed(2)).toBe("100.00"); expect(evidence.taxAmount.toFixed(2)).toBe("15.00"); expect(evidence.revenueLedgerJournal.totalDebits.equals(evidence.revenueLedgerJournal.totalCredits)).toBe(true);
    await service.scheduleRequest(admin(), request.publicReference, `${marker}-SCHEDULE`);
    await service.runManually(admin(), request.publicReference, { operationId: `${marker}-RUN`, externalReference: "manual-revenue-proof", actualStartedAt: new Date("2032-02-02T00:00:00.000Z") });
    await service.recordPerformance(admin(), request.publicReference, { operationId: `${marker}-PERFORMANCE`, periodStartsAt: new Date("2032-02-02T00:00:00.000Z"), periodEndsAt: new Date("2032-02-03T00:00:00.000Z"), impressions: 1000, clicks: 50, conversions: 4, externalReference: "manual-revenue-proof" });
    const report = await service.getOwnReport(storeActor(), request.publicReference);
    expect(report.commercial.reconciliationStatus).toBe("RECONCILED"); expect(report.performance).toEqual({ impressions: 1000, clicks: 50, conversions: 4 });
  });
});
