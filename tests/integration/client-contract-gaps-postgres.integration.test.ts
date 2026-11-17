import { createHash, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import {
  activateRetentionPolicy,
  createRetentionPolicyVersion,
  executeAccountAnonymisation,
  executeRetentionTarget,
} from "@/lib/retention/privacy-retention.service";
import { expenseCsv, storeExpenses } from "@/lib/client-platform/expenses.service";
import { getStoreOperationsSnapshot } from "@/lib/services/admin-store-operations.service";
import { setStoreFeatured } from "@/lib/services/admin-stores.service";
import { PromoterProgrammeConfigService } from "@/lib/promoters/programme-config.service";
import { AdvertisingProductionLockedError } from "@/lib/advertising/production-lock";

const tag = randomUUID().slice(0, 8);
const marker = `gaps-${tag}`;
const localRoot = path.join(os.tmpdir(), `kt-gaps-private-media-${tag}`);

describe("Section 4 functional gaps verified against isolated PostgreSQL", () => {
  beforeAll(() => {
    requireDisposableStoreSettlementDatabase();
    process.env.PRIVATE_MEDIA_STORAGE = "local";
    process.env.PRIVATE_MEDIA_LOCAL_DIR = localRoot;
  });

  afterAll(async () => {
    await rm(localRoot, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it("executes PRIVATE_MEDIA retention deletion while protecting deposit proof financial holds and active legal holds", async () => {
    const admin = await prisma.user.create({
      data: { email: `${marker}-ret-admin@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    const customer = await prisma.user.create({
      data: { email: `${marker}-ret-cust@example.test`, role: "CUSTOMER", status: "ACTIVE" },
    });
    const driverUser = await prisma.user.create({
      data: { email: `${marker}-ret-drv@example.test`, role: "DRIVER", status: "ACTIVE" },
    });
    const driver = await prisma.driverProfile.create({
      data: { userId: driverUser.id, driverCode: `DRV${tag}`, status: "ACTIVE", active: true },
    });
    const policyDraft = await createRetentionPolicyVersion({
      dataClass: "PRIVATE_MEDIA",
      action: "DELETE",
      retentionDays: 0,
      effectiveAt: new Date(Date.now() - 60_000),
      actorUserId: admin.id,
    });
    await activateRetentionPolicy({ publicReference: String(policyDraft.publicReference), actorUserId: admin.id });

    // Non-held object deletes cleanly and updates PrivateMediaObject.status -> DELETED
    const storageUuid = randomUUID();
    const deletableKey = `private-media/${storageUuid}`;
    await mkdir(path.join(localRoot, "private-media"), { recursive: true });
    await writeFile(path.join(localRoot, deletableKey), Buffer.from("89504e470d0a1a0a", "hex"));
    const cleanMedia = await prisma.privateMediaObject.create({
      data: {
        publicReference: `PMO-CLEAN-${tag}`,
        ownerType: "USER",
        ownerId: customer.id,
        purpose: "OTHER",
        status: "READY",
        storageProvider: "local",
        storageKey: deletableKey,
        originalFileName: "avatar.png",
        declaredMimeType: "image/png",
        detectedMimeType: "image/png",
        byteSize: 8,
        checksum: "a".repeat(64),
        createdByUserId: customer.id,
      },
    });
    const cleanOutcome = await executeRetentionTarget({
      dataClass: "PRIVATE_MEDIA",
      resourceType: "PrivateMediaObject",
      resourceReference: cleanMedia.publicReference,
      resourceCreatedAt: new Date(Date.now() - 86_400_000),
      subjectType: "USER",
      subjectReference: customer.id,
      operationId: `ret-clean-${tag}`,
      actorReference: admin.id,
    });
    expect(cleanOutcome).toMatchObject({ status: "COMPLETED", safeReasonCode: "PRIVATE_MEDIA_DELETED" });
    expect((await prisma.privateMediaObject.findUniqueOrThrow({ where: { id: cleanMedia.id } })).status).toBe("DELETED");

    // Linked DriverCashDeposit receipt stays HELD / immutable
    const order = await prisma.order.create({
      data: {
        orderNumber: `KT-RET-${tag}`,
        source: "CUSTOMER",
        status: "CONFIRMED",
        deliveryType: "SAME_DAY",
        currency: "ZAR",
        customerId: customer.id,
      },
    });
    const receiptKey = `retention-${tag}-receipt.pdf`;
    await writeFile(path.join(localRoot, receiptKey), Buffer.from("%PDF-1.4\n"));
    const receiptMedia = await prisma.privateMediaObject.create({
      data: {
        publicReference: `PMO-RCPT-${tag}`,
        ownerType: "DRIVER",
        ownerId: driver.id,
        purpose: "DRIVER_CASH_DEPOSIT_RECEIPT",
        status: "READY",
        storageProvider: "local",
        storageKey: receiptKey,
        originalFileName: "receipt.pdf",
        declaredMimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        byteSize: 9,
        checksum: "b".repeat(64),
        createdByUserId: driverUser.id,
      },
    });
    await prisma.driverCashDeposit.create({
      data: {
        orderId: order.id,
        bankReference: `REF-${tag}`,
        operationId: `dep-${tag}`,
        amount: new Prisma.Decimal("50.00"),
        remittanceMethod: "BANK_DEPOSIT",
        driverProfileId: driver.id,
        privateMediaObjectId: receiptMedia.id,
      },
    });
    const heldReceipt = await executeRetentionTarget({
      dataClass: "PRIVATE_MEDIA",
      resourceType: "PrivateMediaObject",
      resourceReference: receiptMedia.publicReference,
      resourceCreatedAt: new Date(Date.now() - 86_400_000),
      subjectType: "DRIVER",
      subjectReference: driver.id,
      operationId: `ret-rcpt-${tag}`,
      actorReference: admin.id,
    });
    expect(heldReceipt).toMatchObject({ status: "HELD", safeReasonCode: "DEPOSIT_PROOF_FINANCIAL_HOLD" });
    expect((await prisma.privateMediaObject.findUniqueOrThrow({ where: { id: receiptMedia.id } })).status).toBe("READY");

    // Account anonymisation also clears Address.suburb and formattedAddress
    const savedAddress = await prisma.address.create({
      data: {
        type: "CUSTOMER",
        userId: customer.id,
        line1: "12 Oxford Rd",
        line2: "Unit 4B",
        suburb: "Rosebank",
        city: "Johannesburg",
        province: "Gauteng",
        postalCode: "2196",
        formattedAddress: "12 Oxford Rd, Rosebank, Johannesburg",
      },
    });
    await executeAccountAnonymisation({
      userId: customer.id,
      operationId: `anon-${tag}`,
      actorReference: admin.id,
    });
    const anonymizedAddr = await prisma.address.findUniqueOrThrow({ where: { id: savedAddress.id } });
    expect(anonymizedAddr.suburb).toBeNull();
    expect(anonymizedAddr.formattedAddress).toBeNull();
    expect(anonymizedAddr.line1).toBe("Anonymized");
  });

  it("queries real PG store expenses, neutralizes CSV formula injection, and rejects foreign owners", async () => {
    const ownerA = await prisma.user.create({
      data: { email: `${marker}-exp-a@example.test`, role: "STORE", status: "ACTIVE" },
    });
    const ownerB = await prisma.user.create({
      data: { email: `${marker}-exp-b@example.test`, role: "STORE", status: "ACTIVE" },
    });
    const storeA = await prisma.store.create({
      data: { name: "Store A", slug: `store-a-${tag}`, ownerUserId: ownerA.id, status: "ACTIVE" },
    });
    await prisma.store.create({
      data: { name: "Store B", slug: `store-b-${tag}`, ownerUserId: ownerB.id, status: "ACTIVE" },
    });
    const order = await prisma.order.create({
      data: {
        orderNumber: `=CMD|'/C calc'!A0-${tag}`,
        source: "STORE",
        status: "DELIVERED",
        deliveryType: "SAME_DAY",
        currency: "ZAR",
        storeId: storeA.id,
        priceEstimate: new Prisma.Decimal("129.00"),
      },
    });
    const result = await storeExpenses(ownerA.id, {});
    expect(result.rows.some((row) => row.reference === order.orderNumber && row.amount === "129.00")).toBe(true);
    const csv = expenseCsv(result.rows);
    expect(csv).toContain(`"'=CMD|'/C calc'!A0-${tag}"`);
    expect(await storeExpenses(ownerB.id, {})).toMatchObject({ rows: [] });
  });

  it("derives paid store rankings strictly from SUCCEEDED payments and gates featured overrides", async () => {
    const admin = await prisma.user.create({
      data: { email: `${marker}-rank-admin@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" },
    });
    const buyer = await prisma.user.create({
      data: { email: `${marker}-rank-buyer@example.test`, role: "CUSTOMER", status: "ACTIVE" },
    });
    const sellerA = await prisma.user.create({
      data: { email: `${marker}-rank-sa@example.test`, role: "STORE", status: "ACTIVE" },
    });
    const sellerB = await prisma.user.create({
      data: { email: `${marker}-rank-sb@example.test`, role: "STORE", status: "ACTIVE" },
    });
    const storeA = await prisma.store.create({
      data: { name: `Paid Winner ${tag}`, slug: `paid-winner-${tag}`, ownerUserId: sellerA.id, status: "ACTIVE" },
    });
    const storeB = await prisma.store.create({
      data: { name: `Unpaid Store ${tag}`, slug: `unpaid-store-${tag}`, ownerUserId: sellerB.id, status: "ACTIVE" },
    });

    const cartA = await prisma.marketplaceCart.create({
      data: { publicReference: `rcart-a-${tag}`, ownerType: "CUSTOMER", customerUserId: buyer.id, status: "CONVERTED" },
    });
    const cartB = await prisma.marketplaceCart.create({
      data: { publicReference: `rcart-b-${tag}`, ownerType: "CUSTOMER", customerUserId: buyer.id, status: "CONVERTED" },
    });
    const chkA = await prisma.marketplaceCheckout.create({
      data: { publicReference: `rchk-a-${tag}`, cartId: cartA.id, customerUserId: buyer.id, status: "PAYMENT_CONFIRMED", merchandiseSubtotal: 450, grandTotal: 450 },
    });
    const chkB = await prisma.marketplaceCheckout.create({
      data: { publicReference: `rchk-b-${tag}`, cartId: cartB.id, customerUserId: buyer.id, status: "PAYMENT_PENDING", merchandiseSubtotal: 9999, grandTotal: 9999 },
    });
    const grpA = await prisma.marketplaceCheckoutStoreGroup.create({
      data: { checkoutId: chkA.id, storeId: storeA.id, fulfilmentMode: "COURIER_DELIVERY" },
    });
    const grpB = await prisma.marketplaceCheckoutStoreGroup.create({
      data: { checkoutId: chkB.id, storeId: storeB.id, fulfilmentMode: "COURIER_DELIVERY" },
    });
    const platform = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
    const cash = await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" });
    const held = await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" });
    const payA = await prisma.payment.create({
      data: { publicReference: `rpay-a-${tag}`, userId: buyer.id, subjectType: "MARKETPLACE_CHECKOUT", marketplaceCheckoutId: chkA.id, provider: "PAYSTACK", status: "PENDING", amount: "450.00", creationIdempotencyKey: `ra-${tag}`, creationRequestHash: "a".repeat(64) },
    });
    const receipt = await postLedgerJournal({
      idempotencyKey: `${marker}-receipt`,
      sourceReference: `RANKTEST:${tag.toUpperCase()}`,
      correlationId: payA.publicReference,
      type: "EXTERNAL_PAYMENT_RECEIPT",
      currency: "ZAR",
      actor: { kind: "SYSTEM" },
      entries: [
        { accountId: cash.id, direction: "DEBIT", amount: "450.00", lineCode: "CASH" },
        { accountId: held.id, direction: "CREDIT", amount: "450.00", lineCode: "HELD" },
      ],
    });
    const attempt = await prisma.paymentAttempt.create({
      data: { paymentId: payA.id, attemptNumber: 1, provider: "PAYSTACK", idempotencyKey: `ra-att-${tag}`, requestHash: "a".repeat(64), merchantReference: `merchant-ref-${tag}`, status: "SUCCEEDED", amount: "450.00", currency: "ZAR", providerEnvironment: "SANDBOX", providerConfirmedAt: new Date() },
    });
    const webhook = await prisma.paymentWebhookEvent.create({
      data: { publicReference: `pwe_rank_${tag}_${randomUUID().replaceAll("-", "").slice(0, 12)}`, provider: "PAYSTACK", environment: "SANDBOX", eventFingerprint: createHash("sha256").update(tag).digest("hex"), merchantReference: attempt.merchantReference, providerStatus: "success", normalizedStatus: "COMPLETE", processingStatus: "APPLIED", paymentId: payA.id, attemptId: attempt.id, sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true, verifiedAt: new Date(), appliedAt: new Date(), ledgerJournalId: receipt.id },
    });
    await prisma.payment.update({ where: { id: payA.id }, data: { status: "SUCCEEDED", successfulAttemptId: attempt.id, successWebhookEventId: webhook.id, successLedgerJournalId: receipt.id, providerConfirmedAt: new Date(), succeededAt: new Date(), version: { increment: 1 } } });
    const payB = await prisma.payment.create({
      data: { publicReference: `rpay-b-${tag}`, userId: buyer.id, subjectType: "MARKETPLACE_CHECKOUT", marketplaceCheckoutId: chkB.id, status: "FAILED", amount: 9999, creationIdempotencyKey: `rb-${tag}`, creationRequestHash: "b".repeat(64) },
    });
    const ordA = await prisma.marketplaceOrder.create({
      data: { publicReference: `rord-a-${tag}`, checkoutId: chkA.id, paymentId: payA.id, customerUserId: buyer.id, merchandiseSubtotal: 450, modifierSubtotal: 0, deliveryFeeTotal: 0, grandTotal: 450, commercialFingerprint: `fpa-${tag}`, status: "CONFIRMED" },
    });
    const ordB = await prisma.marketplaceOrder.create({
      data: { publicReference: `rord-b-${tag}`, checkoutId: chkB.id, paymentId: payB.id, customerUserId: buyer.id, merchandiseSubtotal: 9999, modifierSubtotal: 0, deliveryFeeTotal: 0, grandTotal: 9999, commercialFingerprint: `fpb-${tag}`, status: "CANCELLED" },
    });
    await prisma.marketplaceStoreOrder.create({
      data: { publicReference: `rso-a-${tag}`, marketplaceOrderId: ordA.id, checkoutStoreGroupId: grpA.id, storeId: storeA.id, status: "SETTLED", merchandiseSubtotal: 450, modifierSubtotal: 0, deliveryFee: 0, groupTotal: 450 },
    });
    await prisma.marketplaceStoreOrder.create({
      data: { publicReference: `rso-b-${tag}`, marketplaceOrderId: ordB.id, checkoutStoreGroupId: grpB.id, storeId: storeB.id, status: "CANCELLED", merchandiseSubtotal: 9999, modifierSubtotal: 0, deliveryFee: 0, groupTotal: 9999 },
    });

    const snapshot = await getStoreOperationsSnapshot(
      { id: admin.id, email: admin.email, name: "Super Admin", role: "SUPER_ADMIN", status: "ACTIVE" },
      "30_DAYS",
    );
    expect(snapshot.paidTopStores.some((s) => s.id === storeA.id && s.merchandise === "450.00")).toBe(true);
    expect(snapshot.paidTopStores.some((s) => s.id === storeB.id)).toBe(false);

    // Gated featured override must fail closed under default advertising lock
    await expect(setStoreFeatured(storeA.id, true)).rejects.toBeInstanceOf(AdvertisingProductionLockedError);
  });

  it("enforces promoter rank definitions, qualification rules, draft immutability triggers, and lock gating in PG", async () => {
    const configService = new PromoterProgrammeConfigService(prisma);
    await expect(
      configService.createVersion({ operationId: `op-lock-${tag}`, rankDefinitions: [{ code: "GOLD", displayName: "Gold", rankOrder: 1, qualificationRuleCodes: ["R1"] }], qualificationRules: [{ code: "R1", type: "DIRECT_REFERRAL_COUNT", configuration: { min: 1 } }] }),
    ).rejects.toMatchObject({ code: "PROMOTER_PRODUCTION_LOCKED" });

    // Real DB persistence of PromoterProgram -> PromoterProgramVersion -> RankDefinition & Rule + non-DRAFT immutability trigger
    const program = await prisma.promoterProgram.create({
      data: { publicReference: `PPR-${tag}`, code: `PPR_${tag}`, name: "Rank Test", targetType: "CUSTOMER" },
    });
    const version = await prisma.promoterProgramVersion.create({
      data: {
        publicReference: `PPV-${tag}`,
        programId: program.id,
        versionNumber: 1,
        status: "ACTIVE",
        attributionWindowDays: 30,
        qualifyingEventType: "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER",
        qualificationHoldDays: 7,
        commissionPlanVersionId: "default",
        geographicPolicyVersion: "za-v1",
        fraudPolicyVersion: "fraud-v1",
        disclosurePolicyVersion: "disc-v1",
        reversalPolicyVersion: "rev-v1",
        legalTermsVersion: "terms-v1",
        startsAt: new Date(),
      },
    });
    await expect(
      prisma.promoterRankDefinition.create({
        data: {
          publicReference: `PRD-${tag}`,
          programVersionId: version.id,
          code: "AMBASSADOR",
          displayName: "Ambassador",
          rankOrder: 1,
          qualificationRuleCodes: ["MIN_ORDERS"],
        },
      }),
    ).rejects.toThrow(/DRAFT|immutable/i);

    const draftVersion = await prisma.promoterProgramVersion.create({
      data: {
        publicReference: `PPV-D-${tag}`,
        programId: program.id,
        versionNumber: 2,
        status: "DRAFT",
        attributionWindowDays: 30,
        qualifyingEventType: "CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER",
        qualificationHoldDays: 7,
        commissionPlanVersionId: "default",
        geographicPolicyVersion: "za-v1",
        fraudPolicyVersion: "fraud-v1",
        disclosurePolicyVersion: "disc-v1",
        reversalPolicyVersion: "rev-v1",
        legalTermsVersion: "terms-v1",
        startsAt: new Date(),
      },
    });
    const rule = await prisma.promoterQualificationRule.create({
      data: {
        publicReference: `PQR-${tag}`,
        programVersionId: draftVersion.id,
        code: "MIN_ORDERS",
        type: "DIRECT_REFERRAL_COUNT",
        configuration: { minimum: 3 },
      },
    });
    const rank = await prisma.promoterRankDefinition.create({
      data: {
        publicReference: `PRD-D-${tag}`,
        programVersionId: draftVersion.id,
        code: "AMBASSADOR",
        displayName: "Ambassador",
        rankOrder: 1,
        qualificationRuleCodes: [rule.code],
      },
    });
    expect(rank).toMatchObject({ code: "AMBASSADOR", rankOrder: 1, qualificationRuleCodes: ["MIN_ORDERS"] });
  });
});
