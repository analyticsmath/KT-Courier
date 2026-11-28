import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { diagnoseDriverSettlementReadiness } from "@/lib/services/driver-settlement-producer.service";
import { listAllQaSettlementRecoveries, type QaSettlementRecoveryRecord } from "./settlement-recovery";
import { QA_ACCEPTANCE_PLATFORM_ACCOUNTS } from "./config";
import { diagnoseStoreOffersSellability } from "@/lib/admin/store-offer-diagnostics.service";
import { listTrustedPackageVersionsSafely } from "@/lib/marketplace-checkout/parcel-configuration.service";

export type QaOrderReconciliationDetail = Readonly<{
  orderId: string;
  orderNumber: string;
  runReference: string | null;
  status: string;
  totalAmountZar: string;
  paymentReference: string | null;
  paymentAmountZar: string | null;
  paymentStatus: string | null;
  driverCode: string | null;
  completedAt: string | null;
  settled: boolean;
  driverEarningReference: string | null;
  driverNetZar: string | null;
  commissionAmountZar: string | null;
  settlementVersion: string | null;
  blockerCode: string | null;
  blockerMessage: string | null;
  recovery: QaSettlementRecoveryRecord | null;
}>;

export type QaLedgerJournalBreakdownItem = Readonly<{
  id: string;
  reference: string;
  type: string;
  postedAt: string;
  memo: string | null;
  classification: string;
  sourceRef: string | null;
  runReference: string | null;
  heldDeltaZar: string;
  clearingDeltaZar: string;
  commissionDeltaZar: string;
  totalDebitsZar: string;
}>;

export type QaRunReconciliationSummary = Readonly<{
  runId: string;
  runReference: string;
  title: string;
  status: string;
  courierOrdersCount: number;
  courierOrdersTotalZar: string;
  settledCourierCount: number;
  blockedCourierCount: number;
  marketplaceOrdersCount: number;
  marketplaceOrdersTotalZar: string;
}>;

export async function buildQaReconciliationDetails(input: Readonly<{
  isolatedWallets: ReadonlyArray<{
    ownerType: string;
    ownerId: string;
    accounts: ReadonlyArray<{
      id: string;
      code: string;
      purpose: string;
      currentBalance: Prisma.Decimal;
      debitTotal: Prisma.Decimal;
      creditTotal: Prisma.Decimal;
    }>;
  }>;
  runs: ReadonlyArray<{ id: string; publicReference: string; title: string; status: string }>;
  enrolledQaStoreIds: readonly string[];
}>) {
  const allAccountIds = input.isolatedWallets.flatMap((w) => w.accounts.map((a) => a.id));
  const sandboxPlatformWallet = input.isolatedWallets.find(
    (w) => w.ownerType === "PLATFORM" && w.ownerId === QA_ACCEPTANCE_PLATFORM_ACCOUNTS.walletOwnerId,
  );
  const heldAccount = sandboxPlatformWallet?.accounts.find(
    (a) => a.code === QA_ACCEPTANCE_PLATFORM_ACCOUNTS.fundsHeldCode,
  );
  const clearingAccount = sandboxPlatformWallet?.accounts.find(
    (a) => a.code === QA_ACCEPTANCE_PLATFORM_ACCOUNTS.cashClearingCode,
  );
  const commissionAccount = sandboxPlatformWallet?.accounts.find(
    (a) => a.code === QA_ACCEPTANCE_PLATFORM_ACCOUNTS.commissionRevenueCode,
  );

  const [qaOrders, qaMarketplaceOrders, sandboxProbes, recoveries, rawJournals, courierPlans, trustedPackageState] =
    await Promise.all([
      prisma.order.findMany({
        where: { isQaAcceptance: true },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
        include: {
          qaAcceptanceRun: { select: { id: true, publicReference: true } },
          pricingQuote: { select: { total: true } },
          payments: { where: { subjectType: "COURIER_ORDER" }, orderBy: [{ createdAt: "desc" }], take: 1 },
          assignments: {
            where: { status: "COMPLETED" },
            include: { driverProfile: { select: { driverCode: true } } },
            take: 1,
          },
          driverEarnings: {
            orderBy: [{ createdAt: "desc" }],
            take: 1,
          },
        },
      }),
      prisma.marketplaceOrder.findMany({
        where: { isQaAcceptance: true },
        orderBy: [{ createdAt: "desc" }],
        take: 100,
        include: {
          qaAcceptanceRun: { select: { id: true, publicReference: true } },
          payment: { select: { publicReference: true, status: true, amount: true } },
        },
      }),
      prisma.paystackSandboxVerification.findMany({
        where: { ledgerJournalId: { not: null } },
        orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
        take: 50,
      }),
      listAllQaSettlementRecoveries(),
      allAccountIds.length > 0
        ? prisma.ledgerJournal.findMany({
            where: { entries: { some: { accountId: { in: allAccountIds } } } },
            orderBy: [{ postedAt: "desc" }, { id: "desc" }],
            take: 80,
            include: {
              entries: {
                where: { accountId: { in: allAccountIds } },
                include: { account: { select: { code: true } } },
              },
              successfulForPayment: {
                select: {
                  publicReference: true,
                  subjectType: true,
                  order: { select: { orderNumber: true, qaAcceptanceRun: { select: { publicReference: true } } } },
                  marketplaceOrder: {
                    select: { publicReference: true, qaAcceptanceRun: { select: { publicReference: true } } },
                  },
                },
              },
              sandboxVerification: { select: { reference: true, amountCents: true } },
              driverEarningAccrual: {
                select: { publicReference: true, orderPublicReference: true, settlementVersion: true },
              },
              commissionAccrual: {
                select: { publicReference: true, subjectPublicReference: true },
              },
            },
          })
        : Promise.resolve([]),
      prisma.commissionPlan.findMany({
        where: {
          subjectType: "COURIER_ORDER",
          scopeKey: { in: ["GLOBAL:COURIER_ORDER", "QA:COURIER_ORDER"] },
        },
        orderBy: [{ status: "asc" }, { versionNumber: "desc" }],
        include: { rules: { orderBy: { priority: "asc" }, take: 5 } },
        take: 20,
      }),
      listTrustedPackageVersionsSafely(),
    ]);

  const recoveryByOrderId = new Map(recoveries.map((r) => [r.orderId, r]));

  const orderDetails: QaOrderReconciliationDetail[] = await Promise.all(
    qaOrders.map(async (order) => {
      const payment = order.payments[0] ?? null;
      const earning = order.driverEarnings[0] ?? null;
      const completedAssignment = order.assignments[0] ?? null;
      const diag =
        !earning && (order.status === "DELIVERED" || order.status === "COMPLETED")
          ? await diagnoseDriverSettlementReadiness(order.id).catch(() => null)
          : null;

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        runReference: order.qaAcceptanceRun?.publicReference ?? null,
        status: order.status,
        totalAmountZar: (order.pricingQuote?.total ?? order.priceEstimate ?? new Prisma.Decimal(0)).toFixed(2),
        paymentReference: payment?.publicReference ?? null,
        paymentAmountZar: payment ? payment.amount.toFixed(2) : null,
        paymentStatus: payment?.status ?? null,
        driverCode: completedAssignment?.driverProfile?.driverCode ?? null,
        completedAt: completedAssignment?.completedAt?.toISOString() ?? null,
        settled: Boolean(earning),
        driverEarningReference: earning?.publicReference ?? null,
        driverNetZar: earning ? earning.amount.toFixed(2) : null,
        commissionAmountZar: earning ? earning.attributedCommissionAmount.toFixed(2) : null,
        settlementVersion: earning?.settlementVersion ?? null,
        blockerCode: diag?.blockerCode ?? null,
        blockerMessage: diag?.blockerMessage ?? null,
        recovery: recoveryByOrderId.get(order.id) ?? null,
      };
    }),
  );

  let settledCourierGross = new Prisma.Decimal(0);
  let unsettledPaidCourierHeld = new Prisma.Decimal(0);
  for (const ord of orderDetails) {
    if (ord.paymentStatus !== "SUCCEEDED" || !ord.paymentAmountZar) continue;
    const paid = new Prisma.Decimal(ord.paymentAmountZar);
    if (ord.settled) {
      settledCourierGross = settledCourierGross.add(paid);
    } else {
      unsettledPaidCourierHeld = unsettledPaidCourierHeld.add(paid);
    }
  }

  let marketplaceReceiptsTotal = new Prisma.Decimal(0);
  for (const mkt of qaMarketplaceOrders) {
    if (mkt.payment?.status === "SUCCEEDED") {
      marketplaceReceiptsTotal = marketplaceReceiptsTotal.add(mkt.payment.amount);
    }
  }

  let sandboxProbesTotal = new Prisma.Decimal(0);
  const probeSummaries = sandboxProbes.map((p) => {
    const amount = new Prisma.Decimal((p.amountCents / 100).toFixed(2));
    if (p.status === "SUCCEEDED" && heldAccount) {
      sandboxProbesTotal = sandboxProbesTotal.add(amount);
    }
    return {
      reference: p.reference,
      amountZar: amount.toFixed(2),
      status: p.status,
      providerDomain: p.providerDomain,
      releaseSha: p.releaseSha,
      ledgerJournalId: p.ledgerJournalId,
      verifiedAt: p.verifiedAt?.toISOString() ?? p.createdAt.toISOString(),
    };
  });

  const signedDeltaForCode = (entries: typeof rawJournals[number]["entries"], code: string | undefined) => {
    if (!code) return new Prisma.Decimal(0);
    return entries
      .filter((e) => e.account.code === code)
      .reduce(
        (sum, e) => (e.direction === "CREDIT" ? sum.add(e.amount) : sum.sub(e.amount)),
        new Prisma.Decimal(0),
      );
  };

  const ledgerJournals: QaLedgerJournalBreakdownItem[] = rawJournals.map((j) => {
    let classification: string = j.type;
    let sourceRef: string | null = j.sourceReference ?? null;
    let runReference: string | null = null;
    if (j.sandboxVerification) {
      classification = "SANDBOX_ACCEPTANCE_PROBE";
      sourceRef = j.sandboxVerification.reference;
    } else if (j.successfulForPayment?.order) {
      classification = "QA_COURIER_ORDER_RECEIPT";
      sourceRef = `${j.successfulForPayment.order.orderNumber} (${j.successfulForPayment.publicReference})`;
      runReference = j.successfulForPayment.order.qaAcceptanceRun?.publicReference ?? null;
    } else if (j.successfulForPayment?.marketplaceOrder) {
      classification = "QA_MARKETPLACE_ORDER_RECEIPT";
      sourceRef = `${j.successfulForPayment.marketplaceOrder.publicReference} (${j.successfulForPayment.publicReference})`;
      runReference = j.successfulForPayment.marketplaceOrder.qaAcceptanceRun?.publicReference ?? null;
    } else if (j.driverEarningAccrual) {
      classification = "QA_DRIVER_EARNING_ACCRUAL";
      sourceRef = `${j.driverEarningAccrual.orderPublicReference} -> ${j.driverEarningAccrual.publicReference}`;
    } else if (j.commissionAccrual) {
      classification = "QA_COMMISSION_ACCRUAL";
      sourceRef = `${j.commissionAccrual.subjectPublicReference} -> ${j.commissionAccrual.publicReference}`;
    }

    return {
      id: j.id,
      reference: j.reference,
      type: j.type,
      postedAt: j.postedAt.toISOString(),
      memo: j.memo,
      classification,
      sourceRef,
      runReference,
      heldDeltaZar: signedDeltaForCode(j.entries, heldAccount?.code).toFixed(2),
      clearingDeltaZar: signedDeltaForCode(j.entries, clearingAccount?.code).toFixed(2),
      commissionDeltaZar: signedDeltaForCode(j.entries, commissionAccount?.code).toFixed(2),
      totalDebitsZar: j.totalDebits.toFixed(2),
    };
  });

  const runBreakdowns: QaRunReconciliationSummary[] = input.runs.map((run) => {
    const runOrders = orderDetails.filter((o) => o.runReference === run.publicReference);
    const runMkt = qaMarketplaceOrders.filter((m) => m.qaAcceptanceRun?.publicReference === run.publicReference);
    const courierSum = runOrders.reduce(
      (sum, o) => sum.add(o.totalAmountZar),
      new Prisma.Decimal(0),
    );
    const mktSum = runMkt.reduce((sum, m) => sum.add(m.grandTotal), new Prisma.Decimal(0));
    return {
      runId: run.id,
      runReference: run.publicReference,
      title: run.title,
      status: run.status,
      courierOrdersCount: runOrders.length,
      courierOrdersTotalZar: courierSum.toFixed(2),
      settledCourierCount: runOrders.filter((o) => o.settled).length,
      blockedCourierCount: runOrders.filter((o) => !o.settled && Boolean(o.blockerCode)).length,
      marketplaceOrdersCount: runMkt.length,
      marketplaceOrdersTotalZar: mktSum.toFixed(2),
    };
  });

  const storeDiagResults = await Promise.all(
    [...new Set(input.enrolledQaStoreIds)].slice(0, 10).map((sid) =>
      diagnoseStoreOffersSellability(sid).catch(() => null),
    ),
  );
  const latestPackageVersion = [...trustedPackageState.versions].sort((a, b) => b.version - a.version)[0] ?? null;

  const qaOffers = storeDiagResults
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .flatMap((storeDiag) =>
      storeDiag.offers.map((offer) => ({
        storeId: storeDiag.storeId,
        storeName: storeDiag.storeName,
        offerReference: offer.offerReference,
        offerVersion: offer.offerVersion,
        storeSku: offer.storeSku,
        title: offer.title,
        variantReference: offer.variantReference,
        variantTitle: offer.variantTitle,
        offerStatus: offer.offerStatus,
        publicationStatus: offer.publicationStatus,
        sellableForCheckout: offer.sellableForCheckout,
        failedReasonCodes: offer.failedReasonCodes,
        trustedPackageMatched: offer.packaging.trustedPackageMatched,
        trustedPackageReason: offer.packaging.trustedPackageReason,
        trustedPackageVersion: offer.packaging.trustedPackageVersion,
        isQaSyntheticAuthority: offer.packaging.isQaSyntheticAuthority,
        latestVersionNumber: latestPackageVersion?.version ?? null,
        latestVersionStatus: latestPackageVersion?.status ?? null,
        latestVersionUpdatedAt: latestPackageVersion?.updatedAt ?? null,
        latestVersionCreatedByUserId: latestPackageVersion?.createdByUserId ?? null,
      })),
    );

  const heldBalance = heldAccount?.currentBalance ?? new Prisma.Decimal(0);
  const clearingBalance = clearingAccount?.currentBalance ?? new Prisma.Decimal(0);
  const explainedHeld = unsettledPaidCourierHeld.add(marketplaceReceiptsTotal).add(sandboxProbesTotal);

  return {
    runBreakdowns,
    qaOrders: orderDetails,
    qaMarketplaceOrders: qaMarketplaceOrders.map((m) => ({
      id: m.id,
      publicReference: m.publicReference,
      runReference: m.qaAcceptanceRun?.publicReference ?? null,
      grandTotalZar: m.grandTotal.toFixed(2),
      status: m.status,
      paymentReference: m.payment?.publicReference ?? null,
      paymentStatus: m.payment?.status ?? null,
    })),
    sandboxProbes: probeSummaries,
    balanceBreakdown: {
      heldBalanceZar: heldBalance.toFixed(2),
      clearingBalanceZar: clearingBalance.toFixed(2),
      unsettledPaidCourierHeldZar: unsettledPaidCourierHeld.toFixed(2),
      settledCourierGrossZar: settledCourierGross.toFixed(2),
      marketplaceReceiptsZar: marketplaceReceiptsTotal.toFixed(2),
      sandboxProbesTotalZar: sandboxProbesTotal.toFixed(2),
      expectedActiveHeldFromOrdersAndProbesZar: explainedHeld.toFixed(2),
    },
    ledgerJournals,
    courierCommissionPlans: courierPlans.map((p) => ({
      id: p.id,
      publicReference: p.publicReference,
      scopeKey: p.scopeKey,
      status: p.status,
      versionNumber: p.versionNumber,
      basisType: p.basisType,
      effectiveFrom: p.effectiveFrom.toISOString(),
      approvedAt: p.approvedAt?.toISOString() ?? null,
      createdByUserId: p.createdByUserId,
      approvedByUserId: p.approvedByUserId,
      bpsRate: p.rules[0]?.rateBasisPoints ?? null,
    })),
    qaOffers,
  };
}
