import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import {
  bindOrdinaryReferralAtSignup,
  createOrdinaryReferralCode,
  OrdinaryReferralError,
} from "@/lib/rewards/ordinary-referral.service";
import { awardVerifiedOrdinaryReferral } from "@/lib/rewards/ordinary-referral-award.service";
import { reverseRefundedOrdinaryReferral } from "@/lib/rewards/ordinary-referral-reversal.service";
import { checkFirstStoreWelcomeEligibility } from "@/lib/promotions/first-store-welcome.service";
import { reconcileCompletedParcelLoyalty } from "@/lib/rewards/customer-parcel-loyalty.service";
import { redeemCustomerLoyaltyPoints } from "@/lib/rewards/customer-loyalty-redemption.service";
import { createWithdrawalRequest } from "@/lib/services/withdrawal-request.service";
import { createDisposableOwnerWithdrawalSource } from "@/scripts/e2e-owner-withdrawal-fixture";
import { createRefundRequest } from "@/lib/services/refund-request.service";
import {
  approveRefund,
  beginRefundReview,
} from "@/lib/services/refund-finance-review.service";
import { completeRefundToCustomerWallet } from "@/lib/services/refund-wallet-completion.service";
import {
  assertRefundApprovalControl,
  assertRefundCompletionControl,
} from "@/lib/refunds/refund-dual-control";
import {
  ADMIN_ALERT_EVENT_TYPES,
  getAdminAlertAdminPath,
  parseAdminAlertRecipients,
} from "@/lib/settings/admin-alert-recipient-policy";
import {
  buildAdminAlertEventOperationId,
  dispatchAdminAlertsForEvent,
  retryPendingAdminAlertDeliveries,
} from "@/lib/notifications/admin-alert-dispatch.service";
import type { NotificationProvider } from "@/lib/notifications/providers";
import { installSystemPermissionDefaults } from "@/lib/auth/permission-bootstrap";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  getAdminCustomerDirectoryStats,
  getAdminCustomerSummariesForUserIds,
} from "@/lib/services/admin-customer-directory.service";
import { getAdminDriverReviewOverview } from "@/lib/client-platform/driver-reviews.service";
import { formatCsvReport, sanitizeCsvCell } from "@/lib/reporting/csv-sanitizer";
import { validateWebhookEndpoint } from "@/lib/developer-api/services";
import { evaluateRetentionHolds } from "@/lib/retention/hold-evaluator";
import { ensureWalletForOwnerInTx, ensureLedgerAccountInTx } from "@/lib/services/wallet-account.service";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { ensureCustomerWalletAccountsInTx } from "@/lib/services/customer-wallet.service";
import { buildPaystackReceiptPosting } from "@/lib/payments/providers/paystack/paystack-ledger-posting-policy";
import { DeliveryType, OrderSource, OrderStatus, UserRole } from "@/types/db";

let dbVerified = false;
let priorReferralIssuing: unknown = null;
let priorAlertRecipients: unknown = null;

async function ensurePlatformReceiptAccountsTx(tx: Prisma.TransactionClient) {
  const wallet = await ensureWalletForOwnerInTx(tx, {
    ownerType: "PLATFORM",
    ownerId: "platform",
    currency: "ZAR",
  });
  const cashClearing = await ensureLedgerAccountInTx(tx, {
    walletId: wallet.id,
    code: "PLATFORM-CASH-CLEARING-ZAR",
    purpose: "CASH_CLEARING",
    category: "ASSET",
    currency: "ZAR",
  });
  const held = await ensureLedgerAccountInTx(tx, {
    walletId: wallet.id,
    code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR",
    purpose: "HELD",
    category: "LIABILITY",
    currency: "ZAR",
  });
  return { cashClearing, held };
}

async function seedVerifiedProductionCourierPayment(input: {
  customerId: string;
  amountZar: string;
  taxZar?: string;
  marker: string;
  delivered?: boolean;
}) {
  const refToken = `${input.marker.replace(/[^A-Za-z0-9_-]/g, "")}_${randomUUID().replaceAll("-", "").slice(0, 10)}`;
  const totalNum = Number(input.amountZar);
  const taxNum = Number(input.taxZar ?? "0.00");
  const subtotalStr = (totalNum - taxNum).toFixed(2);
  const taxStr = taxNum.toFixed(2);
  const totalStr = totalNum.toFixed(2);

  const quote = await prisma.pricingQuote.create({
    data: {
      status: "USED",
      ownerType: "CUSTOMER",
      ownerId: input.customerId,
      deliveryType: DeliveryType.SAME_DAY,
      currency: "ZAR",
      calculationVersion: "phase-c-pg",
      inputHash: createHash("sha256").update(`quote:${refToken}`).digest("hex"),
      distanceMeters: 5000,
      rawDistanceKm: "5.0000",
      billableDistanceKm: "5.0000",
      subtotal: subtotalStr,
      taxRate: "0.0000",
      taxAmount: taxStr,
      total: totalStr,
      inputSnapshot: {},
      ruleSnapshot: {},
      regionSnapshot: {},
      taxSnapshot: {},
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: `KTC-PHC-${refToken.slice(-18).toUpperCase()}`,
      customerId: input.customerId,
      pricingQuoteId: quote.id,
      deliveryType: DeliveryType.SAME_DAY,
      source: OrderSource.CUSTOMER,
      status: input.delivered === false ? OrderStatus.PENDING : OrderStatus.DELIVERED,
      priceEstimate: totalStr,
      pricingSubtotal: subtotalStr,
      pricingTaxAmount: taxStr,
      pricingTaxRate: "0.0000",
      recipientName: "Receiver",
      recipientPhone: "+27820000002",
    },
  });

  const payment = await prisma.$transaction(async (tx) => {
    const { cashClearing, held } = await ensurePlatformReceiptAccountsTx(tx);
    const createdPayment = await tx.payment.create({
      data: {
        publicReference: `pay_phc_${refToken}`.slice(0, 80),
        userId: input.customerId,
        orderId: order.id,
        subjectType: "COURIER_ORDER",
        purpose: "ORDER",
        provider: "PAYSTACK",
        status: "PENDING",
        amount: input.amountZar,
        currency: "ZAR",
        creationIdempotencyKey: `pay-create:${refToken}`.slice(0, 100),
        creationRequestHash: createHash("sha256").update(`pay:${refToken}`).digest("hex"),
      },
    });

    const attempt = await tx.paymentAttempt.create({
      data: {
        publicReference: `pat_phc_${refToken}`.slice(0, 80),
        paymentId: createdPayment.id,
        attemptNumber: 1,
        provider: "PAYSTACK",
        providerEnvironment: "PRODUCTION",
        merchantReference: `mr_phc_${refToken}`.slice(0, 80),
        providerReference: `ps_ref_${refToken}`.slice(0, 80),
        idempotencyKey: `att:${refToken}`.slice(0, 100),
        requestHash: createHash("sha256").update(`att:${refToken}`).digest("hex"),
        status: "SUCCEEDED",
        amount: input.amountZar,
        currency: "ZAR",
        providerConfirmedAt: new Date(),
      },
    });

    const webhookPublicReference = `pwe_phc_${refToken}`.slice(0, 80);
    const providerPaymentId = `ps_${refToken}`.slice(0, 80);
    const journal = await postLedgerJournalWithinTransaction(
      tx,
      buildPaystackReceiptPosting({
        paymentPublicReference: createdPayment.publicReference,
        attemptPublicReference: attempt.publicReference ?? attempt.id,
        eventPublicReference: webhookPublicReference,
        providerPaymentId,
        amount: input.amountZar,
        cashClearingAccountId: cashClearing.id,
        customerFundsHeldAccountId: held.id,
      }),
    );

    const webhook = await tx.paymentWebhookEvent.create({
      data: {
        publicReference: webhookPublicReference,
        provider: "PAYSTACK",
        environment: "PRODUCTION",
        eventFingerprint: createHash("sha256").update(`ev:${refToken}`).digest("hex"),
        merchantReference: attempt.merchantReference,
        providerPaymentId,
        providerStatus: "success",
        normalizedStatus: "COMPLETE",
        processingStatus: "APPLIED",
        paymentId: createdPayment.id,
        attemptId: attempt.id,
        ledgerJournalId: journal.id,
        sourceAddressVerified: true,
        signatureVerified: true,
        merchantVerified: true,
        amountVerified: true,
        providerDataVerified: true,
        verifiedAt: new Date(),
        appliedAt: new Date(),
      },
    });

    return tx.payment.update({
      where: { id: createdPayment.id },
      data: {
        status: "SUCCEEDED",
        succeededAt: new Date(),
        providerConfirmedAt: new Date(),
        reconciliationStatus: "CLEAR",
        successfulAttemptId: attempt.id,
        successWebhookEventId: webhook.id,
        successLedgerJournalId: journal.id,
        version: { increment: 1 },
      },
    });
  });

  return { quote, order, payment };
}

describe("Phase C domain closure on isolated PostgreSQL (CR-129..155)", { timeout: 30000 }, () => {
  beforeAll(async () => {
    requireDisposableStoreSettlementDatabase();
    dbVerified = true;
    await installSystemPermissionDefaults(prisma);
    const refSetting = await prisma.systemSetting.findUnique({
      where: { key: "referral.reward_issuing_enabled" },
    });
    priorReferralIssuing = refSetting?.value ?? false;
    const alertSetting = await prisma.systemSetting.findUnique({
      where: { key: "notifications.admin_alert_recipients" },
    });
    priorAlertRecipients = alertSetting?.value ?? [];
  });

  afterAll(async () => {
    if (!dbVerified) return;
    await prisma.systemSetting.updateMany({
      where: { key: "referral.reward_issuing_enabled" },
      data: { value: priorReferralIssuing as Prisma.InputJsonValue },
    });
    await prisma.systemSetting.updateMany({
      where: { key: "notifications.admin_alert_recipients" },
      data: { value: (priorAlertRecipients ?? []) as Prisma.InputJsonValue },
    });
    await prisma.$disconnect();
  });

  it("CR-129..131: awards R5 ordinary referral once for qualifying paid order, blocks self-referrals, and reverses safely on refund without negative wallet", async () => {
    const tag = randomUUID().slice(0, 8);
    await prisma.systemSetting.upsert({
      where: { key: "referral.reward_issuing_enabled" },
      update: { value: true },
      create: {
        key: "referral.reward_issuing_enabled",
        label: "Referral reward issuing",
        type: "BOOLEAN",
        value: true,
      },
    });

    const superAdmin = await prisma.user.create({
      data: {
        email: `phc-super-${tag}@example.test`,
        role: UserRole.SUPER_ADMIN,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const referrer = await prisma.user.create({
      data: {
        email: `phc-referrer-${tag}@example.test`,
        phone: "+27821112222",
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const referee = await prisma.user.create({
      data: {
        email: `phc-referee-${tag}@example.test`,
        phone: "+27823334444",
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const samePhoneFake = await prisma.user.create({
      data: {
        email: `phc-dupe-phone-${tag}@example.test`,
        phone: "082 111 2222",
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    const codeResult = await createOrdinaryReferralCode({
      ownerType: "CUSTOMER",
      userId: referrer.id,
    });

    await expect(
      prisma.$transaction((tx) =>
        bindOrdinaryReferralAtSignup(tx, {
          code: codeResult.code,
          targetUserId: samePhoneFake.id,
          targetType: "CUSTOMER",
        }),
      ),
    ).rejects.toBeInstanceOf(OrdinaryReferralError);

    await prisma.$transaction((tx) =>
      bindOrdinaryReferralAtSignup(tx, {
        code: codeResult.code,
        targetUserId: referee.id,
        targetType: "CUSTOMER",
      }),
    );
    const bound = await prisma.referralEvent.findFirstOrThrow({
      where: { targetUserId: referee.id, source: "ORDINARY_SIGNUP" },
    });

    const { payment } = await seedVerifiedProductionCourierPayment({
      customerId: referee.id,
      amountZar: "129.00",
      marker: `ref-${tag}`,
      delivered: true,
    });

    const awarded = await awardVerifiedOrdinaryReferral({
      referralEventId: bound.id,
      actorUserId: superAdmin.id,
      operationId: `award-${tag}`,
    });
    expect(awarded.amountZar).toBe("5.00");

    const walletAfterAward = await prisma.ledgerAccount.findFirstOrThrow({
      where: {
        purpose: "CUSTOMER_WALLET_AVAILABLE",
        wallet: { ownerType: "CUSTOMER", ownerId: referrer.id },
      },
    });
    expect(walletAfterAward.currentBalance.toFixed(2)).toBe("5.00");

    // Execute real dual-control customer-wallet refund pipeline so PG financial evidence triggers pass
    const opTag = randomUUID().slice(0, 8);
    const [revA, revB, revC] = await Promise.all(
      ["a", "b", "c"].map((suffix) =>
        prisma.user.create({
          data: {
            email: `phc-refrev-${suffix}-${opTag}@example.test`,
            role: UserRole.ADMIN,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        }),
      ),
    );
    const refund = await createRefundRequest(
      {
        actorUserId: referee.id,
        paymentPublicReference: payment.publicReference,
        amount: "129.00",
        method: "CUSTOMER_WALLET",
        reasonCode: "CUSTOMER_SERVICE_RESOLUTION",
        customerNote: "Refund referral-triggering order",
        operationId: `ref-req-${opTag}`,
      },
      { assertProductionReady: () => {} },
    );
    await beginRefundReview({
      actorUserId: revA.id,
      publicReference: refund.publicReference,
      operationId: `ref-beg-${opTag}`,
    });
    await approveRefund({
      actorUserId: revB.id,
      publicReference: refund.publicReference,
      operationId: `ref-app-${opTag}`,
      financeNote: "Independent dual-control approval",
    });
    await completeRefundToCustomerWallet(
      {
        actorUserId: revC.id,
        publicReference: refund.publicReference,
        operationId: `ref-cmp-${opTag}`,
      },
      { assertProductionReady: () => {} },
    );

    await reverseRefundedOrdinaryReferral({
      referralEventId: bound.id,
      actorUserId: superAdmin.id,
      operationId: `reverse-ref-${tag}`,
    });

    const walletAfterReverse = await prisma.ledgerAccount.findUniqueOrThrow({
      where: { id: walletAfterAward.id },
    });
    expect(walletAfterReverse.currentBalance.toFixed(2)).toBe("0.00");
    expect(walletAfterReverse.currentBalance.gte(0)).toBe(true);
  });

  it("CR-132..133: enforces R50 welcome 7-day window and blocks a second claim even after initial welcome redemption is FULLY_REVERSED", async () => {
    const tag = randomUUID().slice(0, 8);
    const freshCustomer = await prisma.user.create({
      data: {
        email: `phc-welcome-fresh-${tag}@example.test`,
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const staleCustomer = await prisma.user.create({
      data: {
        email: `phc-welcome-old-${tag}@example.test`,
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        createdAt: new Date(Date.now() - 9 * 86_400_000),
      },
    });

    let welcomeCampaign = await prisma.promotionCampaign.findUnique({
      where: { internalCode: "FIRST_STORE_WELCOME" },
    });
    if (!welcomeCampaign) {
      welcomeCampaign = await prisma.promotionCampaign.create({
        data: {
          publicReference: `cmp_welcome_${tag}`,
          internalCode: "FIRST_STORE_WELCOME",
          ownerType: "PLATFORM",
          status: "ACTIVE",
          name: "First Store Order R50 Welcome",
        },
      });
    }
    const version = await prisma.promotionCampaignVersion.create({
      data: {
        campaignId: welcomeCampaign.id,
        publicReference: `cmpv_welcome_${tag}`,
        versionNumber: Math.floor(Math.random() * 100000) + 100,
        status: "ACTIVE",
        applicationMethod: "AUTOMATIC",
        discountScope: "ORDER",
        discountMechanism: "FIXED_AMOUNT",
        fixedAmount: "50.00",
        fundingType: "PLATFORM_FUNDED",
        minimumEligibleSubtotal: "150.00",
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000),
      },
    });

    const freshEligibility = await checkFirstStoreWelcomeEligibility(
      freshCustomer.id,
      "200.00",
    );
    expect(freshEligibility.eligible).toBe(true);
    expect(freshEligibility.discountAmountZar).toBe("50.00");

    const staleEligibility = await checkFirstStoreWelcomeEligibility(
      staleCustomer.id,
      "200.00",
    );
    expect(staleEligibility.eligible).toBe(false);

    const cart = await prisma.marketplaceCart.create({
      data: {
        publicReference: `cart_wel_${tag}`,
        ownerType: "CUSTOMER",
        customerUserId: freshCustomer.id,
        status: "CONVERTED",
      },
    });
    const checkout = await prisma.marketplaceCheckout.create({
      data: {
        publicReference: `chk_wel_${tag}`,
        cartId: cart.id,
        customerUserId: freshCustomer.id,
        status: "CANCELLED",
        reviewVersion: 1,
        merchandiseSubtotal: "200.00",
        promotionDiscount: "50.00",
        grandTotal: "150.00",
        commercialFingerprint: `fp_wel_${tag}`,
      },
    });
    const reservation = await prisma.promotionReservation.create({
      data: {
        publicReference: `pres_wel_${tag}`,
        campaignVersionId: version.id,
        checkoutId: checkout.id,
        checkoutReviewVersion: 1,
        customerUserId: freshCustomer.id,
        status: "COMMITTED",
        reservedDiscountAmount: "50.00",
        reservedPlatformFunding: "50.00",
        reservedStoreFunding: "0.00",
        operationId: `res-wel-${tag}`,
        requestHash: createHash("sha256").update(`res-wel:${tag}`).digest("hex"),
        expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    await prisma.promotionRedemption.create({
      data: {
        publicReference: `pred_wel_${tag}`,
        campaignVersionId: version.id,
        reservationId: reservation.id,
        checkoutId: checkout.id,
        customerUserId: freshCustomer.id,
        status: "FULLY_REVERSED",
        discountAmount: "50.00",
        platformFunding: "50.00",
        storeFunding: "0.00",
        operationId: `red-wel-${tag}`,
        requestHash: createHash("sha256").update(`red-wel:${tag}`).digest("hex"),
      },
    });

    const replayEligibility = await checkFirstStoreWelcomeEligibility(
      freshCustomer.id,
      "200.00",
    );
    expect(replayEligibility.eligible).toBe(false);
    expect(replayEligibility.discountAmountZar).toBe("0.00");
  });

  it("CR-134..135: earns 1 point per R1 external VAT-excluded spend, redeems 100->R2, and converts post-redemption refund clawback into debtPoints cleanly", async () => {
    const tag = randomUUID().slice(0, 8);
    const customer = await prisma.user.create({
      data: {
        email: `phc-loy-${tag}@example.test`,
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    // R115 total with R15 VAT -> R100 eligible net basis -> 100 points
    const { payment } = await seedVerifiedProductionCourierPayment({
      customerId: customer.id,
      amountZar: "115.00",
      taxZar: "15.00",
      marker: `loy-${tag}`,
      delivered: true,
    });

    const awarded = await reconcileCompletedParcelLoyalty(customer.id, payment.id);
    expect(awarded.status).toBe("AWARDED");
    expect(awarded.recognizedPoints).toBe("100");

    const priorConv = await prisma.systemSetting.findUnique({
      where: { key: "loyalty.conversion_enabled" },
    });
    await prisma.systemSetting.upsert({
      where: { key: "loyalty.conversion_enabled" },
      create: {
        key: "loyalty.conversion_enabled",
        label: "Loyalty wallet conversion enabled",
        type: "BOOLEAN",
        value: true,
      },
      update: { type: "BOOLEAN", value: true },
    });
    try {
      const redeemed = await redeemCustomerLoyaltyPoints({
        userId: customer.id,
        points: "100",
        operationId: `redeem-${tag}`,
      });
      expect(redeemed.walletCreditZar).toBe("2.00");
    } finally {
      if (priorConv) {
        await prisma.systemSetting.update({
          where: { key: "loyalty.conversion_enabled" },
          data: { type: priorConv.type, value: priorConv.value as Prisma.InputJsonValue },
        });
      }
    }

    // Partial refund R57.50 -> net points shrink while available=0, recording debtPoints > 0 and never negative availablePoints
    const opTag = randomUUID().slice(0, 8);
    const [revA, revB, revC] = await Promise.all(
      ["a", "b", "c"].map((suffix) =>
        prisma.user.create({
          data: {
            email: `phc-loyrev-${suffix}-${opTag}@example.test`,
            role: UserRole.ADMIN,
            status: "ACTIVE",
            emailVerifiedAt: new Date(),
          },
        }),
      ),
    );
    const refund = await createRefundRequest(
      {
        actorUserId: customer.id,
        paymentPublicReference: payment.publicReference,
        amount: "57.50",
        method: "CUSTOMER_WALLET",
        reasonCode: "CUSTOMER_SERVICE_RESOLUTION",
        customerNote: "Partial order adjustment refund",
        operationId: `loy-req-${opTag}`,
      },
      { assertProductionReady: () => {} },
    );
    await beginRefundReview({
      actorUserId: revA.id,
      publicReference: refund.publicReference,
      operationId: `loy-beg-${opTag}`,
    });
    await approveRefund({
      actorUserId: revB.id,
      publicReference: refund.publicReference,
      operationId: `loy-app-${opTag}`,
      financeNote: "Partial refund approved",
    });
    await completeRefundToCustomerWallet(
      {
        actorUserId: revC.id,
        publicReference: refund.publicReference,
        operationId: `loy-cmp-${opTag}`,
      },
      { assertProductionReady: () => {} },
    );

    const reversed = await reconcileCompletedParcelLoyalty(customer.id, payment.id);
    expect(reversed.status).toBe("REVERSED");

    const loyaltyAcct = await prisma.customerLoyaltyAccount.findUniqueOrThrow({
      where: { userId: customer.id },
    });
    expect(loyaltyAcct.availablePoints).toBe(0n);
    expect(loyaltyAcct.debtPoints).toBeGreaterThan(0n);
  });

  it("CR-136..137: blocks customer self-withdrawal, allows store withdrawal, and enforces dual-control on external refunds", async () => {
    const tag = randomUUID().slice(0, 8);
    const customer = await prisma.user.create({
      data: {
        email: `phc-cust-wd-${tag}@example.test`,
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    await expect(
      createWithdrawalRequest({
        actorUserId: customer.id,
        amount: "10.00",
        payoutDestinationPublicReference: "pdest_missing",
        operationId: `cust-wd-${tag}`,
      }),
    ).rejects.toMatchObject({ code: "WITHDRAWAL_OWNER_INELIGIBLE" });

    // Dual-control policy check + DB finance review transition
    expect(() =>
      assertRefundApprovalControl({
        customerUserId: customer.id,
        approverUserId: customer.id,
      }),
    ).toThrow(/cannot approve/i);
    expect(() =>
      assertRefundCompletionControl({
        customerUserId: customer.id,
        approvedByUserId: "admin-a",
        completedByUserId: "admin-a",
      }),
    ).toThrow(/separate/i);

    const reviewerA = await prisma.user.create({
      data: {
        email: `phc-fin-a-${tag}@example.test`,
        role: UserRole.ADMIN,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const reviewerB = await prisma.user.create({
      data: {
        email: `phc-fin-b-${tag}@example.test`,
        role: UserRole.ADMIN,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const reviewerC = await prisma.user.create({
      data: {
        email: `phc-fin-c-${tag}@example.test`,
        role: UserRole.ADMIN,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const { order, payment } = await seedVerifiedProductionCourierPayment({
      customerId: customer.id,
      amountZar: "100.00",
      marker: `refdc-${tag}`,
      delivered: false,
    });
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED },
    });
    // Honest activation gate remains closed by default until production validation is approved
    await expect(
      createRefundRequest({
        actorUserId: customer.id,
        paymentPublicReference: payment.publicReference,
        amount: "50.00",
        method: "CUSTOMER_WALLET",
        reasonCode: "CUSTOMER_SERVICE_RESOLUTION",
        customerNote: "Customer cancelled before collection",
        operationId: `refdc-gated-${tag}`,
      }),
    ).rejects.toMatchObject({ code: "REFUND_PRODUCTION_NOT_READY" });

    const refund = await createRefundRequest(
      {
        actorUserId: customer.id,
        paymentPublicReference: payment.publicReference,
        amount: "50.00",
        method: "CUSTOMER_WALLET",
        reasonCode: "CUSTOMER_SERVICE_RESOLUTION",
        customerNote: "Customer cancelled before collection",
        operationId: `refdc-req-${tag}`,
      },
      { assertProductionReady: () => {} },
    );
    await beginRefundReview({
      actorUserId: reviewerA.id,
      publicReference: refund.publicReference,
      operationId: `refdc-begin-${tag}`,
    });
    await expect(
      approveRefund({
        actorUserId: customer.id,
        publicReference: refund.publicReference,
        operationId: `refdc-self-${tag}`,
        financeNote: "Requester self-approval must fail",
      }),
    ).rejects.toMatchObject({ code: "REFUND_DUAL_CONTROL_REQUIRED" });
    const approved = await approveRefund({
      actorUserId: reviewerB.id,
      publicReference: refund.publicReference,
      operationId: `refdc-app-${tag}`,
      financeNote: "Independent dual-control approval verified",
    });
    expect(approved.status).toBe("APPROVED");
    await expect(
      completeRefundToCustomerWallet(
        {
          actorUserId: reviewerB.id,
          publicReference: refund.publicReference,
          operationId: `refdc-samecomp-${tag}`,
        },
        { assertProductionReady: () => {} },
      ),
    ).rejects.toMatchObject({ code: "REFUND_DUAL_CONTROL_REQUIRED" });
    const completed = await completeRefundToCustomerWallet(
      {
        actorUserId: reviewerC.id,
        publicReference: refund.publicReference,
        operationId: `refdc-comp-${tag}`,
      },
      { assertProductionReady: () => {} },
    );
    expect(completed.status).toBe("SUCCEEDED");

    const source = await createDisposableOwnerWithdrawalSource();
    const withdrawal = await createWithdrawalRequest({
      actorUserId: source.ownerUserId,
      amount: "5.00",
      payoutDestinationPublicReference: source.destination.publicReference,
      operationId: `store-wd-${tag}`,
    });
    const wdIntent = await prisma.notificationEventIntent.findUnique({
      where: {
        operationId: buildAdminAlertEventOperationId(
          "WITHDRAWAL_REQUESTED",
          `withdrawal:${withdrawal.publicReference}`,
        ),
      },
    });
    expect(wdIntent).not.toBeNull();
    expect(wdIntent!.sourceAuthority).toBe("ADMIN_ALERT");
  });

  it("CR-138..140: dispatches deduplicated multi-recipient owner alerts with safe links, persists intents across all event types, and keeps provider failures retryable", async () => {
    const tag = randomUUID().slice(0, 8);
    expect(
      parseAdminAlertRecipients([
        { email: "[add owner email]", label: "Owner", active: true, events: ["PARCEL_ORDER_PAID"] },
      ]),
    ).toBeNull();

    await prisma.systemSetting.upsert({
      where: { key: "notifications.admin_alert_recipients" },
      update: {
        value: [
          {
            email: `ops-${tag}@ktcouriers.co.za`,
            label: "Operations Desk",
            active: true,
            events: [...ADMIN_ALERT_EVENT_TYPES],
          },
          {
            email: `finance-${tag}@ktcouriers.co.za`,
            label: "Finance Desk",
            active: true,
            events: [...ADMIN_ALERT_EVENT_TYPES],
          },
          {
            email: `paused-${tag}@ktcouriers.co.za`,
            label: "Inactive Desk",
            active: false,
            events: [...ADMIN_ALERT_EVENT_TYPES],
          },
        ],
      },
      create: {
        key: "notifications.admin_alert_recipients",
        label: "Admin alert recipients",
        type: "JSON",
        value: [
          {
            email: `ops-${tag}@ktcouriers.co.za`,
            label: "Operations Desk",
            active: true,
            events: [...ADMIN_ALERT_EVENT_TYPES],
          },
          {
            email: `finance-${tag}@ktcouriers.co.za`,
            label: "Finance Desk",
            active: true,
            events: [...ADMIN_ALERT_EVENT_TYPES],
          },
        ],
      },
    });

    const sentDestinations: string[] = [];
    const sentBodies: string[] = [];
    const okProvider: NotificationProvider = {
      channel: "EMAIL",
      name: "stub-ok",
      async send(message) {
        sentDestinations.push(message.destination);
        sentBodies.push(message.body);
        return {
          accepted: true,
          providerMessageReference: `msg_${randomUUID().slice(0, 8)}`,
        };
      },
    };

    const ref = `cash-deposit:phc-${tag}`;
    const firstDispatch = await dispatchAdminAlertsForEvent(
      {
        eventType: "DRIVER_CASH_DEPOSIT_SUBMITTED",
        aggregateReference: ref,
        title: "Driver cash deposit R500.00",
        summary: "Driver submitted slip for driver@secret.test without leaking PII.",
      },
      { providerOverride: okProvider },
    );
    expect(firstDispatch).toMatchObject({
      activeRecipientCount: 2,
      sentCount: 2,
      failedCount: 0,
      deduplicatedCount: 0,
      adminPath: "/admin/cash-deposits",
    });
    expect(sentDestinations.sort()).toEqual([
      `finance-${tag}@ktcouriers.co.za`,
      `ops-${tag}@ktcouriers.co.za`,
    ]);
    expect(sentBodies[0]).toContain("/admin/cash-deposits");
    expect(sentBodies[0]).not.toContain("driver@secret.test");

    // Replay deduplicates without sending twice
    const replayDispatch = await dispatchAdminAlertsForEvent(
      {
        eventType: "DRIVER_CASH_DEPOSIT_SUBMITTED",
        aggregateReference: ref,
        title: "Driver cash deposit R500.00",
        summary: "Replay check",
      },
      { providerOverride: okProvider },
    );
    expect(replayDispatch).toMatchObject({
      sentCount: 0,
      deduplicatedCount: 2,
    });
    expect(sentDestinations).toHaveLength(2);

    // Every required domain event persists intent with canonical adminPath and no raw secrets
    for (const eventType of ADMIN_ALERT_EVENT_TYPES) {
      const evRef = `${eventType.toLowerCase()}-${tag}`;
      const res = await dispatchAdminAlertsForEvent(
        {
          eventType,
          aggregateReference: evRef,
          title: `Alert ${eventType}`,
          summary: `Verify domain route for ${eventType} owner@private.test sk_live_secret`,
        },
        { providerOverride: okProvider },
      );
      expect(res.adminPath).toBe(getAdminAlertAdminPath(eventType));
      const storedIntent = await prisma.notificationEventIntent.findUniqueOrThrow({
        where: { operationId: res.eventOperationId },
      });
      const payloadJson = JSON.stringify(storedIntent.safePayload);
      expect(payloadJson).toContain(getAdminAlertAdminPath(eventType));
      expect(payloadJson).not.toContain("owner@private.test");
    }

    // CR-140: provider failure does NOT mark SENT and recovers on retry
    const failingProvider: NotificationProvider = {
      channel: "EMAIL",
      name: "stub-down",
      async send() {
        return {
          accepted: false,
          failureClass: "PROVIDER_UNAVAILABLE",
          safeCode: "SMTP_UNAVAILABLE",
          retryAfterSeconds: 0,
        };
      },
    };
    const failRef = `low-review-fail-${tag}`;
    const failedResult = await dispatchAdminAlertsForEvent(
      {
        eventType: "LOW_RATED_REVIEW",
        aggregateReference: failRef,
        title: "1-star delivery review",
        summary: "Low-rated delivery flagged for admin review.",
      },
      { providerOverride: failingProvider },
    );
    expect(failedResult.sentCount).toBe(0);
    expect(failedResult.failedCount).toBe(2);

    const failedLogs = await prisma.emailLog.findMany({
      where: {
        recipient: { in: [`ops-${tag}@ktcouriers.co.za`, `finance-${tag}@ktcouriers.co.za`] },
        status: "FAILED",
      },
    });
    expect(failedLogs.length).toBeGreaterThanOrEqual(2);
    expect(failedLogs.every((l) => l.sentAt === null)).toBe(true);

    const retried = await retryPendingAdminAlertDeliveries({
      now: new Date(Date.now() + 600_000),
      providerOverride: okProvider,
    });
    expect(retried.sent).toBeGreaterThanOrEqual(2);
  });

  it("CR-141: live permission revocation takes effect immediately mid-session without re-login", async () => {
    const tag = randomUUID().slice(0, 8);
    const adminStaff = await prisma.user.create({
      data: {
        email: `phc-perm-${tag}@example.test`,
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const perm = await prisma.permission.findUniqueOrThrow({
      where: { key: PERMISSIONS.USERS_READ },
    });

    expect(
      await hasPermission({
        userId: adminStaff.id,
        role: UserRole.CUSTOMER,
        permissionKey: PERMISSIONS.USERS_READ,
      }),
    ).toBe(false);

    await prisma.userPermission.create({
      data: {
        userId: adminStaff.id,
        permissionId: perm.id,
        effect: "ALLOW",
        reason: "Temporary support audit",
      },
    });
    expect(
      await hasPermission({
        userId: adminStaff.id,
        role: UserRole.CUSTOMER,
        permissionKey: PERMISSIONS.USERS_READ,
      }),
    ).toBe(true);

    await prisma.userPermission.update({
      where: {
        userId_permissionId: { userId: adminStaff.id, permissionId: perm.id },
      },
      data: { effect: "DENY", reason: "Revoked mid-session" },
    });
    expect(
      await hasPermission({
        userId: adminStaff.id,
        role: UserRole.CUSTOMER,
        permissionKey: PERMISSIONS.USERS_READ,
      }),
    ).toBe(false);
  });

  it("CR-142: aggregates bounded admin customer directory summary across parcel, store, wallet, points, and referrals", async () => {
    const tag = randomUUID().slice(0, 8);
    const customer = await prisma.user.create({
      data: {
        email: `phc-dir-${tag}@example.test`,
        name: `Directory Customer ${tag}`,
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });

    await seedVerifiedProductionCourierPayment({
      customerId: customer.id,
      amountZar: "129.00",
      marker: `dir-parcel-${tag}`,
      delivered: true,
    });

    // Seed wallet credit + loyalty account + referral code
    await prisma.$transaction(async (tx) => {
      const { available } = await ensureCustomerWalletAccountsInTx(tx, customer.id);
      await tx.ledgerAccount.update({
        where: { id: available.id },
        data: { currentBalance: "42.50" },
      });
      await tx.customerLoyaltyAccount.create({
        data: {
          userId: customer.id,
          availablePoints: 250n,
          debtPoints: 0n,
          lifetimeEarnedPoints: 250n,
        },
      });
    });

    const refCode = await createOrdinaryReferralCode({
      ownerType: "CUSTOMER",
      userId: customer.id,
    });
    const savedCode = await prisma.referralCode.findUniqueOrThrow({
      where: { code: refCode.code },
    });
    await prisma.referralEvent.create({
      data: {
        referralCodeId: savedCode.id,
        targetType: "CUSTOMER",
        source: "ORDINARY_SIGNUP",
        status: "REWARDED",
        rewardedAt: new Date(),
      },
    });

    const stats = await getAdminCustomerDirectoryStats();
    expect(stats.totalCustomers).toBeGreaterThanOrEqual(1);
    expect(stats.activeCustomers).toBeGreaterThanOrEqual(1);
    expect(stats.verifiedCustomers).toBeGreaterThanOrEqual(1);

    const summaries = await getAdminCustomerSummariesForUserIds([customer.id]);
    const summary = summaries.get(customer.id);
    expect(summary).toMatchObject({
      userId: customer.id,
      parcelOrderCount: 1,
      parcelPaidSpendZar: "129.00",
      marketplaceOrderCount: 0,
      marketplacePaidSpendZar: "0.00",
      totalOrderCount: 1,
      totalPaidSpendZar: "129.00",
      walletAvailableZar: "42.50",
      loyaltyAvailablePoints: 250,
      loyaltyDebtPoints: 0,
      referralCode: refCode.code,
      referralsRewarded: 1,
      referralsPending: 0,
    });
  });

  it("CR-143, CR-150, CR-152, CR-153, CR-154: verifies driver review filtering, CSV injection sanitization, webhook SSRF rejection, and POPIA legal holds", async () => {
    const tag = randomUUID().slice(0, 8);
    const admin = await prisma.user.create({
      data: {
        email: `phc-revadmin-${tag}@example.test`,
        role: UserRole.ADMIN,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    const overview = await getAdminDriverReviewOverview(
      { id: admin.id, email: admin.email, name: "Admin", role: UserRole.ADMIN, status: "ACTIVE" },
      { rating: 5 },
    );
    expect(overview).toMatchObject({
      currentPage: 1,
      appliedFilters: { rating: 5, page: 1 },
    });
    expect(typeof overview.filteredTotal).toBe("number");

    // CSV formula injection sanitization
    expect(sanitizeCsvCell("=CMD|' /C calc'!A0")).toBe("'=CMD|' /C calc'!A0");
    expect(sanitizeCsvCell("+1+1")).toBe("'+1+1");
    expect(sanitizeCsvCell("-1+1")).toBe("'-1+1");
    expect(sanitizeCsvCell("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    const csv = formatCsvReport(["Name", "Formula"], [{ Name: "Safe", Formula: "=HYPERLINK(\"http://evil\")" }]);
    expect(csv).toContain("'=HYPERLINK");

    // Webhook SSRF validation
    await expect(validateWebhookEndpoint("http://127.0.0.1/hook")).rejects.toMatchObject({
      code: "WEBHOOK_ENDPOINT_UNSAFE",
    });
    await expect(
      validateWebhookEndpoint("https://metadata.internal.example/hook", {
        resolver: async () => [{ address: "169.254.169.254" }],
      }),
    ).rejects.toMatchObject({ code: "WEBHOOK_ENDPOINT_UNSAFE" });
    await expect(
      validateWebhookEndpoint("https://10.0.0.5/hook"),
    ).rejects.toMatchObject({ code: "WEBHOOK_ENDPOINT_UNSAFE" });

    // POPIA financial/legal hold evaluation prevents purging active held user evidence
    const customer = await prisma.user.create({
      data: {
        email: `phc-hold-${tag}@example.test`,
        role: UserRole.CUSTOMER,
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
      },
    });
    await seedVerifiedProductionCourierPayment({
      customerId: customer.id,
      amountZar: "89.00",
      marker: `hold-${tag}`,
      delivered: true,
    });
    const createdHold = await prisma.retentionHold.create({
      data: {
        subjectType: "User",
        subjectReference: customer.id,
        reasonCode: "ACTIVE_FINANCIAL_AND_ORDER_EVIDENCE",
        createdByUserId: admin.id,
      },
    });
    const hold = await evaluateRetentionHolds({
      subjectType: "User",
      subjectReference: customer.id,
    });
    expect(hold.hasHold).toBe(true);
    expect(hold.activeHoldReason).toBe("ACTIVE_FINANCIAL_AND_ORDER_EVIDENCE");
    await prisma.retentionHold.update({
      where: { id: createdHold.id },
      data: { releasedAt: new Date(), releasedByUserId: admin.id },
    });
    const releasedHold = await evaluateRetentionHolds({
      subjectType: "User",
      subjectReference: customer.id,
    });
    expect(releasedHold.hasHold).toBe(false);
  });
});
