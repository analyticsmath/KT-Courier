import { createHmac, randomInt, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/maps/geocode.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/maps/geocode.service")>();
  return {
    ...actual,
    geocodeSouthAfricanAddress: vi.fn(async () => ({
      latitude: -26.1076,
      longitude: 28.0567,
    })),
    reverseGeocodeSouthAfricanProvince: vi.fn(async () => "Gauteng" as const),
  };
});
import { prisma } from "@/lib/db/prisma";
import {
  evaluatePaystackCheckoutReadiness,
} from "@/lib/payments/providers/paystack/paystack-config";
import { PaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import type { PaymentProviderAdapter } from "@/lib/payments/providers/payment-provider-adapter";
import {
  PAYSTACK_ALLOWED_CUSTOMER_ACTION_HOSTS,
  PAYSTACK_CAPABILITIES,
} from "@/lib/payments/providers/paystack/paystack-adapter";
import type { PaystackClient } from "@/lib/payments/providers/paystack/paystack-client";
import {
  prepareStoreCheckoutCertification,
  prepareStoreCheckoutCertificationFromPreflight,
  approveStoreCheckoutCertification,
  evaluateStoreCheckoutCapabilityPreflight,
  revalidateStoreCheckoutCertification,
} from "@/lib/admin/store-checkout-certification.service";
import { isStorePubliclyCheckoutReady } from "@/lib/storefront/store-publication-readiness";
import { setStoreStatus } from "@/lib/services/admin-stores.service";
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";
import { createProviderCheckoutSession } from "@/lib/services/payment-provider-session.service";
import {
  applyPaystackWebhookEventsBatch,
  ingestPaystackWebhook,
} from "@/lib/services/paystack-webhook-application.service";
import { cancelOrder } from "@/lib/services/orders.service";
import {
  acceptDispatchAssignment,
  offerAssignment,
} from "@/lib/services/dispatch-assignment.service";
import {
  approveRefund,
  beginRefundReview,
} from "@/lib/services/refund-finance-review.service";
import { completeRefundToCustomerWallet } from "@/lib/services/refund-wallet-completion.service";
import {
  ensurePlatformCustomerFundsHeldAccountInTx,
  ensureWalletAvailableAccountInTx,
  getWalletSpendableBalance,
} from "@/lib/services/wallet-spending.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { createDriver, createRegion, createUser, uniqueTag } from "./phase7-5-fixtures";
import { OrderStatus, UserRole } from "@/types/db";

function redirectPaystackRegistry(calls: { count: number }): PaymentProviderRegistry {
  const adapter: PaymentProviderAdapter = {
    code: "PAYSTACK",
    capabilities: PAYSTACK_CAPABILITIES,
    customerActionHosts: PAYSTACK_ALLOWED_CUSTOMER_ACTION_HOSTS,
    checkoutAudit: Object.freeze({
      environment: "SANDBOX",
      protocolVersion: "paystack-v1",
      configurationFingerprint: "cfg_stub_phase_a_closure",
      credentialVersion: "test-v1",
    }),
    async createCheckoutSession(input) {
      calls.count += 1;
      return Object.freeze({
        status: "REQUIRES_ACTION" as const,
        providerReference: `ps_ref_${input.merchantReference}`,
        providerStatusCode: "pending",
        definitive: false,
        customerAction: Object.freeze({
          type: "REDIRECT_GET" as const,
          url: `https://checkout.paystack.com/${encodeURIComponent(input.merchantReference)}`,
          expiresAt: null,
        }),
      });
    },
    async getPaymentStatus() {
      throw new Error("Not implemented in test stub");
    },
  };
  return new PaymentProviderRegistry({ adapters: [adapter] });
}

function mockVerifiedPaystackClient(providerId: number, amountMinor: number): PaystackClient {
  return {
    verifyTransaction: async (ref: string) => ({
      status: true,
      message: "Verification successful",
      data: {
        id: providerId,
        reference: ref,
        status: "success",
        amount: amountMinor,
        currency: "ZAR",
      },
    }),
  } as unknown as PaystackClient;
}

async function seedWalletBalance(
  owner: { ownerType: "CUSTOMER" | "STORE"; ownerId: string },
  amountStr: string,
) {
  await prisma.$transaction(
    async (tx) => {
      const platformWallet = await tx.wallet.upsert({
        where: {
          ownerType_ownerId_currency: {
            ownerType: "PLATFORM",
            ownerId: "platform",
            currency: "ZAR",
          },
        },
        update: { status: "ACTIVE" },
        create: {
          ownerType: "PLATFORM",
          ownerId: "platform",
          currency: "ZAR",
          status: "ACTIVE",
        },
      });
      const cashClearing = await tx.ledgerAccount.upsert({
        where: { code: "PLATFORM-CASH-CLEARING-ZAR" },
        update: { status: "ACTIVE" },
        create: {
          walletId: platformWallet.id,
          code: "PLATFORM-CASH-CLEARING-ZAR",
          purpose: "CASH_CLEARING",
          category: "ASSET",
          currency: "ZAR",
          allowNegative: false,
          status: "ACTIVE",
        },
      });
      await ensurePlatformCustomerFundsHeldAccountInTx(tx);
      const targetAvailable = await ensureWalletAvailableAccountInTx(tx, owner);
      const key = `phase-a-seed:${owner.ownerType}:${owner.ownerId}:${randomUUID()}`;
      await postLedgerJournalWithinTransaction(tx, {
        idempotencyKey: key,
        type: "ACCOUNT_TRANSFER",
        currency: "ZAR",
        sourceReference: `PHASE_A_SEED:${key}`,
        correlationId: owner.ownerId,
        memo: `Seed disposable ${owner.ownerType} wallet balance`,
        actor: { kind: "SYSTEM" },
        entries: [
          {
            accountId: cashClearing.id,
            direction: "DEBIT",
            amount: amountStr,
            lineCode: "SEED_CASH_DEBIT",
          },
          {
            accountId: targetAvailable.id,
            direction: "CREDIT",
            amount: amountStr,
            lineCode: "SEED_TARGET_WALLET_CREDIT",
          },
        ],
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function createStoreParcelOrder(opts: {
  storeId: string;
  quoteOwnerId: string;
  total?: string;
  regionId?: string | null;
}) {
  const total = opts.total ?? "115.00";
  const quote = await prisma.pricingQuote.create({
    data: {
      status: "USED",
      ownerType: "STORE",
      ownerId: opts.quoteOwnerId,
      storeId: opts.storeId,
      deliveryType: "SAME_DAY",
      currency: "ZAR",
      calculationVersion: "phase-a-fixture",
      inputHash: randomUUID().replaceAll("-", "") + "0".repeat(32),
      distanceMeters: 5000,
      rawDistanceKm: "5.0000",
      billableDistanceKm: "5.0000",
      subtotal: total,
      taxRate: "0.0000",
      taxAmount: "0.00",
      total,
      inputSnapshot: {},
      ruleSnapshot: {},
      regionSnapshot: {},
      taxSnapshot: { enabled: false },
      expiresAt: new Date("2035-01-01"),
      usedAt: new Date(),
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `KT-PA-ST-${randomUUID().slice(0, 12).toUpperCase()}`,
      source: "STORE",
      status: "PENDING",
      deliveryType: "SAME_DAY",
      currency: "ZAR",
      storeId: opts.storeId,
      deliveryRegionId: opts.regionId ?? null,
      priceEstimate: total,
      pricingQuoteId: quote.id,
      pricingSubtotal: total,
      pricingTaxAmount: "0.00",
      pricingTaxRate: "0.0000",
      pricingSnapshot: { quoteId: quote.id, calculationVersion: "phase-a-fixture" },
    },
  });
  return { quote, order };
}

async function createCustomerParcelOrder(opts: {
  customerId: string;
  total?: string;
  regionId?: string | null;
}) {
  const total = opts.total ?? "115.00";
  const quote = await prisma.pricingQuote.create({
    data: {
      status: "USED",
      ownerType: "CUSTOMER",
      ownerId: opts.customerId,
      deliveryType: "SAME_DAY",
      currency: "ZAR",
      calculationVersion: "phase-a-fixture",
      inputHash: randomUUID().replaceAll("-", "") + "0".repeat(32),
      distanceMeters: 5000,
      rawDistanceKm: "5.0000",
      billableDistanceKm: "5.0000",
      subtotal: total,
      taxRate: "0.0000",
      taxAmount: "0.00",
      total,
      inputSnapshot: {},
      ruleSnapshot: {},
      regionSnapshot: {},
      taxSnapshot: { enabled: false },
      expiresAt: new Date("2035-01-01"),
      usedAt: new Date(),
    },
  });
  const order = await prisma.order.create({
    data: {
      orderNumber: `KT-PA-CU-${randomUUID().slice(0, 12).toUpperCase()}`,
      source: "CUSTOMER",
      status: "PENDING",
      deliveryType: "SAME_DAY",
      currency: "ZAR",
      customerId: opts.customerId,
      deliveryRegionId: opts.regionId ?? null,
      priceEstimate: total,
      pricingQuoteId: quote.id,
      pricingSubtotal: total,
      pricingTaxAmount: "0.00",
      pricingTaxRate: "0.0000",
      pricingSnapshot: { quoteId: quote.id, calculationVersion: "phase-a-fixture" },
    },
  });
  return { quote, order };
}

describe("Phase A P0 closure contracts (F01-F04 / CR-064..075, CR-082..095)", { timeout: 60_000 }, () => {
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    process.env.PAYMENT_APP_ORIGIN ??= "https://app.kt-courier.test";
    await prisma.$queryRaw`SELECT 1`;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("F01 (CR-064..072): Store finance authority, wallet owner isolation, concurrency, and store refund routing", () => {
    it("CR-064..069: lets store owners (CUSTOMER/STORE role) and active finance staff spend STORE wallet without touching employee personal wallet, enforces permissions/suspension/store context", async () => {
      const tag = uniqueTag("f01-auth");
      const ownerCustomerRole = await prisma.user.create({
        data: { email: `${tag}-own-cust@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() },
      });
      const ownerStoreRole = await prisma.user.create({
        data: { email: `${tag}-own-store@example.test`, role: "STORE", status: "ACTIVE", emailVerifiedAt: new Date() },
      });
      const financeStaff = await prisma.user.create({
        data: { email: `${tag}-fin@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() },
      });
      const ordersOnlyStaff = await prisma.user.create({
        data: { email: `${tag}-ord@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() },
      });

      const storeA = await prisma.store.create({
        data: { ownerUserId: ownerCustomerRole.id, name: `${tag} Store A`, slug: `${tag}-a`, status: "ACTIVE", contactEmail: ownerCustomerRole.email },
      });
      const storeB = await prisma.store.create({
        data: { ownerUserId: ownerStoreRole.id, name: `${tag} Store B`, slug: `${tag}-b`, status: "ACTIVE", contactEmail: ownerStoreRole.email },
      });
      // Multi-context store principal: financeStaff is an ACTIVE finance employee
      // of storeA AND also owns storeStaffOwned (so omitting explicit storeContextId
      // is ambiguous -> STORE_CONTEXT_AMBIGUOUS / denied).
      const storeStaffOwned = await prisma.store.create({
        data: { ownerUserId: financeStaff.id, name: `${tag} Staff Owned Store`, slug: `${tag}-staff-own`, status: "ACTIVE", contactEmail: financeStaff.email },
      });

      await prisma.storeEmployeeMembership.createMany({
        data: [
          { storeId: storeA.id, userId: financeStaff.id, invitedByUserId: ownerCustomerRole.id, email: financeStaff.email, roleLabel: "Finance", permissions: ["finance", "deliveries"], status: "ACTIVE", acceptedAt: new Date() },
          { storeId: storeA.id, userId: ordersOnlyStaff.id, invitedByUserId: ownerCustomerRole.id, email: ordersOnlyStaff.email, roleLabel: "Orders", permissions: ["orders"], status: "ACTIVE", acceptedAt: new Date() },
        ],
      });

      await seedWalletBalance({ ownerType: "CUSTOMER", ownerId: ownerCustomerRole.id }, "300.00");
      await seedWalletBalance({ ownerType: "CUSTOMER", ownerId: financeStaff.id }, "500.00");
      await seedWalletBalance({ ownerType: "STORE", ownerId: storeA.id }, "400.00");
      await seedWalletBalance({ ownerType: "STORE", ownerId: storeB.id }, "400.00");
      await seedWalletBalance({ ownerType: "STORE", ownerId: storeStaffOwned.id }, "400.00");

      // CR-064: Owner with CUSTOMER role spends storeA wallet; owner's CUSTOMER wallet untouched
      const { order: ownerCustOrder } = await createStoreParcelOrder({ storeId: storeA.id, quoteOwnerId: ownerCustomerRole.id, total: "100.00" });
      const ownerCustPay = await prepareOrderPayment(
        { id: ownerCustomerRole.id, email: ownerCustomerRole.email },
        { orderId: ownerCustOrder.id, idempotencyKey: `cr064:${tag}`, walletAmount: "100.00", storeContextId: storeA.id },
      );
      expect(ownerCustPay.status).toBe("SUCCEEDED");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "STORE", ownerId: storeA.id })).availableAmount).toBe("300.00");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: ownerCustomerRole.id })).availableAmount).toBe("300.00");

      // CR-065: Owner with STORE role spends storeB wallet; STORE user has no personal CUSTOMER wallet
      const { order: ownerStoreOrder } = await createStoreParcelOrder({ storeId: storeB.id, quoteOwnerId: ownerStoreRole.id, total: "100.00" });
      const ownerStorePay = await prepareOrderPayment(
        { id: ownerStoreRole.id, email: ownerStoreRole.email },
        { orderId: ownerStoreOrder.id, idempotencyKey: `cr065:${tag}`, walletAmount: "100.00", storeContextId: storeB.id },
      );
      expect(ownerStorePay.status).toBe("SUCCEEDED");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "STORE", ownerId: storeB.id })).availableAmount).toBe("300.00");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: ownerStoreRole.id })).availableAmount).toBe("0.00");

      // CR-069: Multi-store finance employee omitted storeContextId -> ambiguity error; wrong store -> denied
      const { order: staffOrder } = await createStoreParcelOrder({ storeId: storeA.id, quoteOwnerId: financeStaff.id, total: "120.00" });
      await expect(
        prepareOrderPayment(
          { id: financeStaff.id, email: financeStaff.email },
          { orderId: staffOrder.id, idempotencyKey: `cr069-ambig:${tag}`, walletAmount: "120.00" },
        ),
      ).rejects.toMatchObject({ code: "STORE_CONTEXT_AMBIGUOUS" });
      await expect(
        prepareOrderPayment(
          { id: financeStaff.id, email: financeStaff.email },
          { orderId: staffOrder.id, idempotencyKey: `cr069-wrong:${tag}`, walletAmount: "120.00", storeContextId: storeStaffOwned.id },
        ),
      ).rejects.toMatchObject({ code: "PAYMENT_PAYER_NOT_AUTHORIZED" });

      // CR-067: Orders-only staff without finance permission denied
      await expect(
        prepareOrderPayment(
          { id: ordersOnlyStaff.id, email: ordersOnlyStaff.email },
          { orderId: staffOrder.id, idempotencyKey: `cr067:${tag}`, walletAmount: "120.00", storeContextId: storeA.id },
        ),
      ).rejects.toMatchObject({ code: "PAYMENT_PAYER_NOT_AUTHORIZED" });

      // CR-066: Active finance staff with explicit storeContextId funds parcel from STORE wallet ONLY
      const staffPay = await prepareOrderPayment(
        { id: financeStaff.id, email: financeStaff.email },
        { orderId: staffOrder.id, idempotencyKey: `cr066:${tag}`, walletAmount: "120.00", storeContextId: storeA.id },
      );
      expect(staffPay.status).toBe("SUCCEEDED");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "STORE", ownerId: storeA.id })).availableAmount).toBe("180.00");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: financeStaff.id })).availableAmount).toBe("500.00");

      // CR-068: Disabling employee revokes finance access immediately on next parcel
      await prisma.storeEmployeeMembership.updateMany({
        where: { storeId: storeA.id, userId: financeStaff.id },
        data: { status: "DISABLED" },
      });
      const { order: suspendedStaffOrder } = await createStoreParcelOrder({ storeId: storeA.id, quoteOwnerId: ownerCustomerRole.id, total: "50.00" });
      await expect(
        prepareOrderPayment(
          { id: financeStaff.id, email: financeStaff.email },
          { orderId: suspendedStaffOrder.id, idempotencyKey: `cr068:${tag}`, walletAmount: "50.00", storeContextId: storeA.id },
        ),
      ).rejects.toMatchObject({ code: "PAYMENT_PAYER_NOT_AUTHORIZED" });
    });

    it("CR-070..072: serializes concurrent owner + finance employee spend and routes refund of employee-initiated parcel to STORE wallet with dual control", async () => {
      const tag = uniqueTag("f01-conc-refund");
      const owner = await prisma.user.create({
        data: { email: `${tag}-own@example.test`, role: "STORE", status: "ACTIVE", emailVerifiedAt: new Date() },
      });
      const employee = await prisma.user.create({
        data: { email: `${tag}-emp@example.test`, role: "CUSTOMER", status: "ACTIVE", emailVerifiedAt: new Date() },
      });
      const financeApprover = await prisma.user.create({
        data: { email: `${tag}-fin-appr@example.test`, role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
      });
      const financeCompleter = await prisma.user.create({
        data: { email: `${tag}-fin-comp@example.test`, role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
      });
      const store = await prisma.store.create({
        data: { ownerUserId: owner.id, name: `${tag} Store`, slug: tag, status: "ACTIVE", contactEmail: owner.email },
      });
      await prisma.storeEmployeeMembership.create({
        data: { storeId: store.id, userId: employee.id, invitedByUserId: owner.id, email: employee.email, roleLabel: "Finance", permissions: ["finance", "deliveries", "orders"], status: "ACTIVE", acceptedAt: new Date() },
      });

      await seedWalletBalance({ ownerType: "STORE", ownerId: store.id }, "200.00");
      await seedWalletBalance({ ownerType: "CUSTOMER", ownerId: employee.id }, "15.00");

      const { order } = await createStoreParcelOrder({ storeId: store.id, quoteOwnerId: employee.id, total: "120.00" });

      // CR-070 + CR-071: Concurrent owner vs employee partial wallet + Paystack preparation on same order
      const calls = { count: 0 };
      const sharedKey = `cr070-shared:${tag}`;
      const [r1, r2] = await Promise.allSettled([
        prepareOrderPayment(
          { id: owner.id, email: owner.email },
          { orderId: order.id, idempotencyKey: sharedKey, walletAmount: "40.00", storeContextId: store.id },
        ),
        prepareOrderPayment(
          { id: employee.id, email: employee.email },
          { orderId: order.id, idempotencyKey: `cr070-other:${tag}`, walletAmount: "40.00", storeContextId: store.id },
        ),
      ]);
      const fulfilled = [r1, r2].filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof prepareOrderPayment>>> => r.status === "fulfilled");
      const rejected = [r1, r2].filter((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(await prisma.payment.count({ where: { orderId: order.id } })).toBe(1);
      expect((await getWalletSpendableBalance(prisma, { ownerType: "STORE", ownerId: store.id })).availableAmount).toBe("160.00");

      // Complete external Paystack remainder (R80.00) by employee-initiated flow
      const paymentRow = fulfilled[0].value;
      const session = await createProviderCheckoutSession(
        { id: employee.id },
        { paymentId: paymentRow.id, provider: "PAYSTACK", idempotencyKey: `sess:${tag}`, storeContextId: store.id },
        { registry: redirectPaystackRegistry(calls) },
      );
      expect(calls.count).toBe(1);

      const attemptRow = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: session.attempt.id } });
      const secretKey = "sk_test_f01_webhook_disposable_only";
      const providerId = randomInt(100_000_000, 999_999_999);
      const rawBody = JSON.stringify({
        event: "charge.success",
        data: { id: providerId, reference: attemptRow.merchantReference, status: "success", amount: 8000, currency: "ZAR" },
      });
      const signature = createHmac("sha512", secretKey).update(rawBody).digest("hex");
      await ingestPaystackWebhook({ rawBody, signature, secretKey });
      await applyPaystackWebhookEventsBatch({ batchSize: 50, secretKey, clientOverride: mockVerifiedPaystackClient(providerId, 8000) });

      // CR-072 + CR-088 + CR-089: Employee cancels paid store parcel -> restores R40.00 + creates R80.00 refund to STORE wallet
      const cancelled = await cancelOrder(
        { id: employee.id, email: employee.email, name: "Employee", role: "CUSTOMER", status: "ACTIVE" },
        order.id,
        { reason: "Store shipment no longer needed", storeContextId: store.id },
        true,
        { explicitStoreId: store.id },
      );
      expect(cancelled).toMatchObject({
        order: { status: "CANCELLED" },
        resolution: { status: "COMPLETED_REFUND_INITIATED" },
      });
      expect((await getWalletSpendableBalance(prisma, { ownerType: "STORE", ownerId: store.id })).availableAmount).toBe("200.00");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: employee.id })).availableAmount).toBe("15.00");

      const refund = await prisma.paymentRefund.findFirstOrThrow({ where: { paymentId: paymentRow.id } });
      expect(refund.beneficiaryStoreId).toBe(store.id);
      expect(refund.customerUserId).toBeNull();
      expect(refund.amount.toFixed(2)).toBe("80.00");

      // CR-089: Replay cancellation returns identical outcome without duplicate refund/journal
      const replayedCancel = await cancelOrder(
        { id: employee.id, email: employee.email, name: "Employee", role: "CUSTOMER", status: "ACTIVE" },
        order.id,
        { reason: "Store shipment no longer needed", storeContextId: store.id },
        true,
        { explicitStoreId: store.id },
      );
      expect(replayedCancel).toMatchObject({
        order: { status: "CANCELLED" },
        resolution: { paymentRefundId: refund.id },
      });
      expect(await prisma.paymentRefund.count({ where: { paymentId: paymentRow.id } })).toBe(1);

      // Dual control: employee & store owner cannot review/approve; separate finance admins approve + complete to STORE wallet
      await expect(beginRefundReview({ actorUserId: employee.id, publicReference: refund.publicReference, operationId: `rev-emp:${tag}` })).rejects.toMatchObject({ code: "REFUND_DUAL_CONTROL_REQUIRED" });
      await expect(beginRefundReview({ actorUserId: owner.id, publicReference: refund.publicReference, operationId: `rev-own:${tag}` })).rejects.toMatchObject({ code: "REFUND_DUAL_CONTROL_REQUIRED" });

      await beginRefundReview({ actorUserId: financeApprover.id, publicReference: refund.publicReference, operationId: `rev-ok:${tag}` });
      await approveRefund({ actorUserId: financeApprover.id, publicReference: refund.publicReference, operationId: `appr-ok:${tag}` });
      await completeRefundToCustomerWallet(
        { actorUserId: financeCompleter.id, publicReference: refund.publicReference, operationId: `comp-ok:${tag}` },
        { assertProductionReady: () => {} },
      );

      // Employee personal wallet stays 15.00; Store wallet receives R80.00 external refund -> 280.00
      expect((await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: employee.id })).availableAmount).toBe("15.00");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "STORE", ownerId: store.id })).availableAmount).toBe("280.00");
    });
  });

  describe("F02 (CR-073..075): Authoritative Paystack checkout readiness", () => {
    it("fails closed when configured-but-inactive in production, expired, or misconfigured, and passes only when active and eligible", () => {
      // CR-073
      expect(
        evaluatePaystackCheckoutReadiness({
          configured: true,
          active: false,
          environment: "production",
          errorCategory: "NONE",
          productionValidationApproved: false,
        }),
      ).toMatchObject({ ready: false, reasonCode: "LIVE_CHECKOUT_NOT_AUTHORIZED" });

      // CR-074
      expect(
        evaluatePaystackCheckoutReadiness({
          configured: true,
          active: true,
          environment: "sandbox",
          errorCategory: "NONE",
          temporarySandboxExpired: true,
        }),
      ).toMatchObject({ ready: false, reasonCode: "TEMP_SANDBOX_EXPIRED" });

      expect(
        evaluatePaystackCheckoutReadiness({
          configured: true,
          active: false,
          environment: "sandbox",
          errorCategory: "CONFIGURATION",
        }),
      ).toMatchObject({ ready: false, reasonCode: "PROVIDER_CONFIG_INVALID" });

      expect(
        evaluatePaystackCheckoutReadiness({
          configured: false,
          active: false,
          environment: "not-configured",
          errorCategory: "NOT_CONFIGURED",
        }),
      ).toMatchObject({ ready: false, reasonCode: "PROVIDER_DISABLED" });

      // CR-075
      expect(
        evaluatePaystackCheckoutReadiness(
          {
            configured: true,
            active: true,
            environment: "sandbox",
            errorCategory: "NONE",
          },
          { adapterPresent: true, requireAdapterPresent: true },
        ),
      ).toMatchObject({ ready: true, reasonCode: "READY", environment: "sandbox" });
    });
  });

  describe("F03 (CR-091..095): Real disposable store checkout engine proof, provenance, two-reviewer approval, and drift invalidation", () => {
    it("rejects fabricated paid strings, executes isolated SAVEPOINT engine proof with zero leftover orders, enforces independent approver, and invalidates on drift", async () => {
      const label = randomUUID();
      const owner = await prisma.user.create({ data: { email: `f03-own-${label}@example.test`, role: "STORE", status: "ACTIVE" } });
      const admin1 = await prisma.user.create({ data: { email: `f03-adm1-${label}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
      const admin2 = await prisma.user.create({ data: { email: `f03-adm2-${label}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } });
      const store = await prisma.store.create({
        data: { ownerUserId: owner.id, name: `F03 Merchant ${label}`, slug: `f03-${label}`, status: "PENDING", contactEmail: owner.email },
      });
      const pickup = await prisma.address.create({
        data: {
          storeId: store.id,
          type: "PICKUP",
          isDefault: true,
          line1: "22 Sandton Drive",
          line2: "Sandton",
          city: "Johannesburg",
          province: "Gauteng",
          postalCode: "2196",
          country: "South Africa",
          latitude: "-26.1076000",
          longitude: "28.0567000",
          placeId: "place_f03_sandton",
        },
      });
      await prisma.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: pickup.id } });
      await prisma.storeSellerLegalIdentity.create({
        data: {
          storeId: store.id,
          publicReference: `SID-F03-${label}`,
          identityVersion: "PAMMY_BAKES_V1",
          legalName: "Pammy Sole Trader",
          tradingName: "Pammy Bakes",
          vatRegistrationStatus: "NOT_REGISTERED",
          invoiceClassification: "RECEIPT",
          status: "APPROVED",
          effectiveFrom: new Date(Date.now() - 60_000),
        },
      });

      const existingPolicy = await prisma.storeOrderOperationalPolicy.findFirst({ where: { status: "ACTIVE" } });
      if (!existingPolicy) {
        await prisma.storeOrderOperationalPolicy.create({
          data: {
            publicReference: `SOP-F03-${label}`,
            name: `f03-policy-${label}`,
            versionNumber: 1,
            status: "ACTIVE",
            acceptanceWindowSeconds: 900,
            customerDecisionWindowSeconds: 900,
            maximumPrepMinutes: 60,
            maximumPrepExtensionMinutes: 30,
            maximumIssueCount: 3,
            maximumSubstitutionProposalsPerLine: 2,
            effectiveFrom: new Date(Date.now() - 60_000),
            approvedByUserId: admin1.id,
            activatedAt: new Date(),
          },
        });
      }
      const existingParcel = await prisma.parcelProfileVersion.findFirst({ where: { status: "ACTIVE" } });
      if (!existingParcel) {
        await prisma.parcelProfileVersion.create({
          data: {
            stableKey: "SMALL",
            displayName: "Small",
            versionNumber: 1,
            status: "ACTIVE",
            lengthCm: 30,
            widthCm: 20,
            heightCm: 10,
            maximumWeightKg: 5,
            effectiveFrom: new Date(Date.now() - 60_000),
            createdByUserId: admin1.id,
          },
        });
      }

      const testRegion = await prisma.deliveryRegion.create({
        data: {
          name: `F03 Sandton ${label}`,
          slug: `f03-sandton-${label}`,
          city: "Johannesburg",
          province: "Gauteng",
          coverageMode: "RADIUS",
          centerLat: "-26.1076000",
          centerLng: "28.0567000",
          coverageRadiusKm: "40.00",
          maxDistanceKm: "50.00",
          displayOrder: -100,
          active: true,
          pricingEnabled: true,
        },
      });
      const latestClientStd = await prisma.deliveryServiceDefinition.findFirst({
        where: { stableKey: "CLIENT_STANDARD" },
        orderBy: { versionNumber: "desc" },
      });
      const testService = await prisma.deliveryServiceDefinition.create({
        data: {
          stableKey: "CLIENT_STANDARD",
          versionNumber: (latestClientStd?.versionNumber ?? 0) + 1,
          displayName: "Standard",
          status: "ACTIVE",
          effectiveFrom: new Date(Date.now() - 60_000),
          createdByUserId: admin1.id,
          pricingPolicy: {
            stableKey: "CLIENT_STANDARD",
            displayName: "Standard",
            active: true,
            turnaround: "1-2 business days",
            provinces: ["Gauteng"],
            regionIds: [testRegion.id],
            tariffs: {
              SMALL: { baseFee: "129.00", perKmRate: "0.00", maximumWeightKg: 5, minimumCharge: null },
              MEDIUM: { baseFee: "179.00", perKmRate: "0.00", maximumWeightKg: 15, minimumCharge: null },
              LARGE: { baseFee: "249.00", perKmRate: "0.00", maximumWeightKg: 30, minimumCharge: null },
            },
            expectedVersion: latestClientStd?.versionNumber ?? 0,
            reason: "F03 test fixture standard courier service",
          },
          coveragePolicy: {
            provinces: ["Gauteng"],
            regionIds: [testRegion.id],
          },
          slaMetadata: { turnaround: "1-2 business days" },
        },
      });

      try {
        const preflightOpts = {
          routeCalculator: async () => ({
            ok: true as const,
            route: {
              distanceMeters: 4200,
              durationSeconds: 780,
              routeSummary: "4.2 km · ~13 min",
              provider: "e2e_deterministic" as const,
            },
          }),
          commissionChecker: async () => ({
            ready: true,
            status: "READY" as const,
            planId: "cpl-f03",
            planReference: "CPL-F03",
          }),
          paymentProviderReadiness: [{ code: "PAYSTACK", configured: true, active: true, environment: "sandbox", errorCategory: "NONE" }],
        };

        // CR-092: Fabricated provider receipt strings are rejected cleanly
        await expect(
          prepareStoreCheckoutCertification(store.id, admin1.id, {
            routeEvidenceReference: "pay_fabricated_receipt_123",
            routeEvidenceDigest: "a".repeat(64),
            checkoutEvidenceReference: "trx_fake_paid_receipt",
            checkoutEvidenceDigest: "b".repeat(64),
            reviewNote: "Attempted fabricated receipt",
          }),
        ).rejects.toMatchObject({ code: "CERTIFICATION_REFERENCE_INVALID" });

        // CR-093: Disposable SAVEPOINT engine proof executes 6 stages with zero leaked production rows
        const orderCountBefore = await prisma.order.count({ where: { storeId: store.id } });
        const merchantOrderCountBefore = await prisma.marketplaceStoreOrder.count({ where: { storeId: store.id } });
        const preflight = await evaluateStoreCheckoutCapabilityPreflight(store.id, preflightOpts);
        expect(preflight?.preflightReady).toBe(true);

        const prepared = await prepareStoreCheckoutCertificationFromPreflight(store.id, admin1.id, "Engine proof run", preflightOpts);
        expect(prepared.evidenceType).toBe("DISPOSABLE_END_TO_END_CHECKOUT_PROOF");
        expect(prepared.engineProofSuiteSha).toMatch(/^[a-f0-9]{12,64}/);
        expect(prepared.policyFingerprint).toHaveLength(64);
        expect(Array.isArray(prepared.stageResults)).toBe(true);
        expect(prepared.stageResults.filter((s) => s.passed)).toHaveLength(6);
        expect(await prisma.order.count({ where: { storeId: store.id } })).toBe(orderCountBefore);
        expect(await prisma.marketplaceStoreOrder.count({ where: { storeId: store.id } })).toBe(merchantOrderCountBefore);

        // CR-094: Self-approval blocked; independent admin activates store
        await expect(approveStoreCheckoutCertification(store.id, admin1.id, prepared.revision)).rejects.toMatchObject({ code: "INDEPENDENT_REVIEWER_REQUIRED" });
        await approveStoreCheckoutCertification(store.id, admin2.id, prepared.revision);
        const liveStore = await setStoreStatus(store.id, "ACTIVE");
        expect(liveStore.status).toBe("ACTIVE");

        // CR-095: Drift invalidates certification and blocks public checkout readiness
        const changedPickup = await prisma.address.update({ where: { id: pickup.id }, data: { line1: "99 Changed Pickup Ave" } });
        const reval = await revalidateStoreCheckoutCertification(store.id, admin2.id, preflightOpts);
        expect(reval.valid).toBe(false);
        expect(reval.revoked).toBe(true);
        const staleStore = await prisma.store.findUniqueOrThrow({
          where: { id: store.id },
          include: { checkoutCertification: true, storefrontDocument: true },
        });
        expect(staleStore.checkoutCertification?.status).toBe("REVOKED");
        expect(staleStore.storefrontDocument?.publicStatus).toBe("INELIGIBLE");
        expect(
          isStorePubliclyCheckoutReady({
            status: staleStore.status,
            name: staleStore.name,
            documentsCount: 1,
            pickup: changedPickup,
            certification: staleStore.checkoutCertification,
            hasApprovedSellerIdentity: true,
            hasActiveOperationalPolicy: true,
          }),
        ).toBe(false);
      } finally {
        await prisma.deliveryServiceDefinition.delete({ where: { id: testService.id } }).catch(() => {});
        await prisma.deliveryRegion.delete({ where: { id: testRegion.id } }).catch(() => {});
      }
    });
  });

  describe("F04 (CR-082..090): Parcel cancellation × provider-in-flight × split-wallet × dispatch × webhook race coordinator", () => {
    it("CR-082: cancels prepared split-wallet order with no provider call, releases reservation without creating a phantom refund", async () => {
      const tag = uniqueTag("f04-cr082");
      const customer = await createUser(tag, UserRole.CUSTOMER);
      await seedWalletBalance({ ownerType: "CUSTOMER", ownerId: customer.id }, "100.00");
      const { order } = await createCustomerParcelOrder({ customerId: customer.id, total: "120.00" });

      const payment = await prepareOrderPayment(
        { id: customer.id, email: customer.email },
        { orderId: order.id, idempotencyKey: `prep:${tag}`, walletAmount: "40.00" },
      );
      expect(payment.status).toBe("CREATED");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: customer.id })).availableAmount).toBe("60.00");

      const res = await cancelOrder(customer, order.id, { reason: "Changed mind before card init" });
      expect(res).toMatchObject({
        order: { status: "CANCELLED" },
        resolution: { status: "COMPLETED_NO_PAYMENT" },
      });
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("CANCELLED");
      expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("CANCELLED");
      expect((await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: customer.id })).availableAmount).toBe("100.00");
      expect(await prisma.paymentRefund.count({ where: { paymentId: payment.id } })).toBe(0);
    });

    it("CR-083, CR-087 & CR-090: blocks premature terminal cancellation on in-flight attempt, settles late Paystack charge.success safely without reviving order or double consuming", async () => {
      const tag = uniqueTag("f04-cr083");
      const customer = await createUser(tag, UserRole.CUSTOMER);
      await seedWalletBalance({ ownerType: "CUSTOMER", ownerId: customer.id }, "100.00");
      const { order } = await createCustomerParcelOrder({ customerId: customer.id, total: "115.00" });

      const payment = await prepareOrderPayment(
        { id: customer.id, email: customer.email },
        { orderId: order.id, idempotencyKey: `prep:${tag}`, walletAmount: "40.00" },
      );
      const calls = { count: 0 };
      const session = await createProviderCheckoutSession(
        { id: customer.id },
        { paymentId: payment.id, provider: "PAYSTACK", idempotencyKey: `sess:${tag}` },
        { registry: redirectPaystackRegistry(calls) },
      );

      // CR-083: While REQUIRES_ACTION attempt is open, cancel returns pending conflict and opens UNKNOWN_OUTCOME recon case
      const cancelPending = await cancelOrder(customer, order.id, { reason: "Try cancel while gateway session live" });
      expect(cancelPending).toMatchObject({
        conflictCode: "CANCELLATION_PENDING_PAYMENT_RESOLUTION",
        resolution: { status: "PENDING_PAYMENT_RESOLUTION" },
      });
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe("PENDING");
      expect(await prisma.paymentReconciliationCase.count({ where: { paymentId: payment.id, reason: "UNKNOWN_OUTCOME" } })).toBe(1);

      // CR-087 + CR-090: Late charge.success webhook settles order as CANCELLED, never revives CONFIRMED, restores R40 wallet & creates R75 refund, replay is a no-op
      const attempt = await prisma.paymentAttempt.findUniqueOrThrow({ where: { id: session.attempt.id } });
      const secretKey = "sk_test_f04_late_webhook";
      const providerId = randomInt(100_000_000, 999_999_999);
      const rawBody = JSON.stringify({
        event: "charge.success",
        data: { id: providerId, reference: attempt.merchantReference, status: "success", amount: 7500, currency: "ZAR" },
      });
      const signature = createHmac("sha512", secretKey).update(rawBody).digest("hex");
      await ingestPaystackWebhook({ rawBody, signature, secretKey });
      await applyPaystackWebhookEventsBatch({ batchSize: 50, secretKey, clientOverride: mockVerifiedPaystackClient(providerId, 7500) });

      // Replay webhook ingestion & batch application (CR-090)
      await ingestPaystackWebhook({ rawBody, signature, secretKey });
      await applyPaystackWebhookEventsBatch({ batchSize: 50, secretKey, clientOverride: mockVerifiedPaystackClient(providerId, 7500) });

      const finalOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(finalOrder.status).toBe("CANCELLED");
      expect((await prisma.parcelCancellationResolution.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe("COMPLETED_LATE_PAYMENT_REFUND_INITIATED");
      expect(await prisma.paymentRefund.count({ where: { paymentId: payment.id } })).toBe(1);
      expect((await getWalletSpendableBalance(prisma, { ownerType: "CUSTOMER", ownerId: customer.id })).availableAmount).toBe("100.00");
      expect(await prisma.paymentReconciliationCase.count({ where: { paymentId: payment.id, reason: "OUT_OF_ORDER_EVENT" } })).toBe(1);
    });

    it("CR-086: serializes concurrent cancelOrder vs acceptDispatchAssignment without deadlock so at most one terminal/accepted outcome wins", async () => {
      const tag = uniqueTag("f04-cr086");
      const admin = await createUser(`${tag}-adm`, UserRole.ADMIN);
      const customer = await createUser(`${tag}-cust`, UserRole.CUSTOMER);
      const region = await createRegion(tag);
      const driver = await createDriver(`${tag}-drv`, region.id);
      await seedWalletBalance({ ownerType: "CUSTOMER", ownerId: customer.id }, "150.00");
      const { order } = await createCustomerParcelOrder({ customerId: customer.id, total: "120.00", regionId: region.id });

      const fullWalletPay = await prepareOrderPayment(
        { id: customer.id, email: customer.email },
        { orderId: order.id, idempotencyKey: `prep:${tag}`, walletAmount: "120.00" },
      );
      expect(fullWalletPay.status).toBe("SUCCEEDED");
      expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(OrderStatus.CONFIRMED);

      const offer = await offerAssignment(admin.id, order.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" });

      const [cancelRes, acceptRes] = await Promise.allSettled([
        cancelOrder(customer, order.id, { reason: "Concurrent cancel during offer accept" }),
        acceptDispatchAssignment(driver.profile.id, offer.id, { expectedVersion: offer.version }),
      ]);

      const orderAfter = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      const assignmentAfter = await prisma.orderAssignment.findUniqueOrThrow({ where: { id: offer.id } });

      // Strictly mutually exclusive invariant: either CANCELLED with revoked offer & refunded wallet OR PICKUP_SCHEDULED with ACCEPTED driver
      if (orderAfter.status === OrderStatus.CANCELLED) {
        expect(assignmentAfter.status).not.toBe("ACCEPTED");
        expect(assignmentAfter.activeOrderGuard).toBeNull();
        expect(await prisma.paymentRefund.count({ where: { paymentId: fullWalletPay.id } })).toBe(1);
        expect(acceptRes.status).toBe("rejected");
      } else {
        expect(orderAfter.status).toBe(OrderStatus.PICKUP_SCHEDULED);
        expect(assignmentAfter.status).toBe("ACCEPTED");
        expect(cancelRes.status === "fulfilled" && "error" in cancelRes.value).toBe(true);
        expect(await prisma.paymentRefund.count({ where: { paymentId: fullWalletPay.id } })).toBe(0);
      }
    });
  });
});
