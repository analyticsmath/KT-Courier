import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { ensureDriverEarningPayableAccount } from "@/lib/services/driver-earning-account.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { assignmentPublicReference } from "@/lib/driver-earnings/driver-earning-subject";
import type { DriverSettlementSnapshot } from "@/lib/driver-earnings/driver-settlement-snapshot";
import { requireDisposableDriverSettlementDatabase } from "./disposable-driver-settlement-guard";

/** Synthetic source facts only. Included in the disposable migration image; no provider request or production approval. */
export async function createDisposableDriverSettlement(options: { email?: string; passwordHash?: string; amount?: string } = {}) {
  requireDisposableDriverSettlementDatabase();
  const tag = `driver-evidence-${randomUUID()}`;
  const amount = options.amount ?? "100.25";
  const hash = createHash("sha256").update(tag).digest("hex");
  const email = options.email ?? `${tag}@example.test`;
  const existing = await prisma.user.findUnique({ where: { email }, include: { driverProfile: true } });
  const driverUser = existing ?? await prisma.user.create({ data: { email, name: "Disposable earning driver", passwordHash: options.passwordHash, role: "DRIVER", status: "ACTIVE", emailVerifiedAt: new Date() } });
  if (driverUser.role !== "DRIVER" || driverUser.status !== "ACTIVE") throw new Error("Disposable earning owner must be an active driver.");
  const driver = existing?.driverProfile ?? await prisma.driverProfile.create({ data: { userId: driverUser.id, driverCode: `DRV-${hash.slice(0, 20).toUpperCase()}`, displayName: driverUser.name, active: true, status: "ACTIVE", onboardingStatus: "APPROVED" } });
  if (!driver.active || driver.status !== "ACTIVE" || driver.onboardingStatus !== "APPROVED") throw new Error("Disposable earning owner requires its own synthetic approved profile.");
  const customer = await prisma.user.create({ data: { email: `${tag}-customer@example.test`, name: "PRIVATE_CUSTOMER_EARNING_FIXTURE", role: "CUSTOMER", status: "ACTIVE" } });
  const admin = await prisma.user.create({ data: { email: `${tag}-admin@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
  const completedAt = new Date("2026-10-01T12:00:00.000Z");
  const eligibleAt = new Date("2026-10-02T12:00:00.000Z");
  const order = await prisma.order.create({ data: { orderNumber: `KT-${hash.slice(0, 24).toUpperCase()}`, source: "CUSTOMER", customerId: customer.id, status: "DELIVERED", deliveryType: "SAME_DAY", currency: "ZAR", priceEstimate: amount, recipientName: "PRIVATE_RECIPIENT_EARNING_FIXTURE", recipientPhone: "+27821111111" } });
  const assignment = await prisma.orderAssignment.create({ data: { orderId: order.id, driverProfileId: driver.id, assignedByAdminId: admin.id, status: "COMPLETED", assignedAt: completedAt, acceptedAt: completedAt, completedAt, version: 3 } });
  const pod = await prisma.proofOfDelivery.create({ data: { orderId: order.id, assignmentId: assignment.id, driverProfileId: driver.id, method: "OTP", recipientName: "PRIVATE_RECIPIENT_EARNING_FIXTURE", otpVerifiedAt: completedAt, deliveredAt: completedAt, latitude: -26.2041, longitude: 28.0473, internalNote: "PRIVATE_POD_EARNING_FIXTURE", createdByUserId: driverUser.id, createdByRole: "DRIVER" } });
  await prisma.orderOperationalEvent.create({ data: { orderId: order.id, assignmentId: assignment.id, driverProfileId: driver.id, actorUserId: driverUser.id, actorRole: "DRIVER", eventType: "DELIVERY_COMPLETED", statusBefore: "IN_TRANSIT", statusAfter: "DELIVERED", occurredAt: completedAt } });
  await prisma.orderAssignmentEvent.create({ data: { assignmentId: assignment.id, orderId: order.id, driverProfileId: driver.id, actorUserId: driverUser.id, actorRole: "DRIVER", eventType: "ASSIGNMENT_COMPLETED", previousStatus: "ACCEPTED", newStatus: "COMPLETED" } });
  const platform = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  const cash = await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" });
  const canonicalHeld = await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" });
  // Match the account selection used by the existing accrual service.
  const held = await prisma.ledgerAccount.findFirstOrThrow({ where: { purpose: "HELD", category: "LIABILITY", currency: "ZAR", status: "ACTIVE", allowNegative: false, wallet: { ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR", status: "ACTIVE" } } });
  if (canonicalHeld.walletId !== held.walletId) throw new Error("Disposable held account owner mismatch.");
  const receipt = await postLedgerJournal({ idempotencyKey: `${tag}:receipt`, sourceReference: `fixture:${tag}:receipt`, correlationId: `PAY-${hash.toUpperCase().slice(0, 32)}`, type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", actor: { kind: "SYSTEM" }, memo: "Synthetic isolated driver earning source receipt", metadata: { fixture: "disposable-driver-settlement" }, entries: [{ accountId: cash.id, direction: "DEBIT", amount, lineCode: "CASH_CLEARING" }, { accountId: held.id, direction: "CREDIT", amount, lineCode: "CUSTOMER_FUNDS_HELD" }] });
  const payment = await prisma.payment.create({ data: { publicReference: `PAY-${hash.toUpperCase().slice(0, 32)}`, orderId: order.id, userId: customer.id, provider: "PAYSTACK", status: "PROCESSING", amount, currency: "ZAR", creationIdempotencyKey: `${tag}:payment`, creationRequestHash: hash, metadata: { fixture: "disposable-driver-settlement" } } });
  const attempt = await prisma.paymentAttempt.create({ data: { paymentId: payment.id, publicReference: `pat_${hash.toUpperCase().slice(0, 32)}`, attemptNumber: 1, provider: "PAYSTACK", providerEnvironment: "SANDBOX", idempotencyKey: `${tag}:attempt`, requestHash: hash, merchantReference: `${tag}:merchant`, status: "SUCCEEDED", amount, currency: "ZAR" } });
  const webhook = await prisma.paymentWebhookEvent.create({ data: { publicReference: `pwe_${hash.toUpperCase().slice(0, 32)}`, provider: "PAYSTACK", environment: "SANDBOX", eventFingerprint: hash, merchantReference: attempt.merchantReference, providerStatus: "success", normalizedStatus: "COMPLETE", processingStatus: "APPLIED", paymentId: payment.id, attemptId: attempt.id, ledgerJournalId: receipt.id, sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true, verifiedAt: completedAt, appliedAt: completedAt, safePayloadSnapshot: { fixture: "synthetic source facts; provider verification is not exercised" } } });
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", successfulAttemptId: attempt.id, successWebhookEventId: webhook.id, successLedgerJournalId: receipt.id, succeededAt: completedAt, providerConfirmedAt: completedAt, version: { increment: 1 } } });
  const accounts = await ensureDriverEarningPayableAccount(driver.id);
  const snapshot: DriverSettlementSnapshot = { subjectType: "COURIER_DELIVERY", subjectId: assignment.id, subjectPublicReference: assignmentPublicReference(assignment.id), assignmentId: assignment.id, assignmentPublicReference: assignmentPublicReference(assignment.id), assignmentVersion: String(assignment.version), driverId: driver.id, driverPublicReference: driver.driverCode, walletId: accounts.wallet.id, orderId: order.id, orderPublicReference: order.orderNumber, paymentId: payment.id, paymentPublicReference: payment.publicReference, settlementReference: `DSET-${hash.slice(0, 24).toUpperCase()}`, settlementVersion: "disposable-v1", calculationVersion: "disposable-v1", completionEvidenceReference: `POD-${pod.id}`, serviceCompletedAt: completedAt.toISOString(), authoritativeAt: completedAt.toISOString(), releaseEligibleAt: eligibleAt.toISOString(), driverSettlementBasisAmount: amount, attributedCommissionAmount: "0.00", netDriverEarningAmount: amount, currency: "ZAR", commissionCharges: [] };
  return { tag, driverUser, driver, customer, order, assignment, pod, payment, receipt, accounts, snapshot };
}
