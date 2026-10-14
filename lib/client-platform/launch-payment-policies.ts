import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { paymentPolicyScope } from "@/lib/payments/payment-policy.service";

/**
 * Initial operating recommendation, NOT a statutory limit or a permanently
 * hard-coded checkout rule. After initialization the versioned database policy
 * is the only authority, editable by the COD admin and independently reviewed.
 *
 * SAPS recommends holding as little cash as possible. A maximum R1,000 CASH
 * balance (roughly R2,000 order total at 50/50) is a conservative pilot
 * proposal, rather than the illustrative R100,000 dashboard figure.
 * https://www.saps.gov.za/alert/carrycash_safely.php
 */
export const INITIAL_RESEARCHED_COD_CASH_CEILING_ZAR = "1000.00";
export const INITIAL_COD_DIGITAL_SHARE = "0.5";
const INITIAL_REGION = ["Gauteng"];
const SUPPORTED_INITIAL_SERVICES = ["CLIENT_ECONOMY", "CLIENT_STANDARD", "CLIENT_EXPRESS"];
const BOOTSTRAP_ID = "OWNER_LAUNCH_PAYMENT_METHODS_2026_10_14";

function hasUnscopedRegion(scope: unknown) {
  return scope === null || scope === undefined;
}

/**
 * Do not convert a researched recommendation into a chargeable cash policy.
 * This creates a global DIGITAL rule and INACTIVE, separately reviewable COD
 * proposals only. Cash stays blocked until genuine independent review and
 * protected remittance setup succeed through the normal admin workflow.
 */
export async function initializeLaunchPaymentPolicies(actorUserId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"kt-launch-payment-policies-v1"}))`;
    const now = new Date();
    const globalPolicies = await tx.paymentMethodPolicy.findMany({
      where: {
        businessModuleId: null, storeId: null, deliveryServiceId: null,
        orderType: null, regionId: null, orderId: null,
      },
    });
    // Any previous global payment rule belongs to the operator. Never replace
    // or reactivate it automatically, including an inactive/superseded version.
    let digitalCreated = false;
    if (!globalPolicies.some((p) => hasUnscopedRegion(p.provinceScope))) {
      const row = await tx.paymentMethodPolicy.create({
        data: {
          versionNumber: 1, status: "ACTIVE", mode: "DIGITAL",
          provinceScope: Prisma.DbNull, effectiveFrom: now,
          createdByUserId: actorUserId,
          policyEvidence: {
            source: BOOTSTRAP_ID, reason: "Owner-selected digital payment for approved deliveries and stores.",
            cashEnabled: false, baseline: true,
          },
        },
      });
      await tx.adminActivityLog.create({
        data: {
          actorUserId, action: "CREATE", entityType: "PaymentMethodPolicy",
          entityId: row.id,
          message: "Initial global digital payment policy created; no COD cash approved.",
          metadata: { source: BOOTSTRAP_ID, mode: "DIGITAL", authority: "CLIENT_DOCUMENTS" },
        },
      });
      digitalCreated = true;
    }

    const [stores, services, policies] = await Promise.all([
      // Draft preparation is non-financial. Include active stores whose
      // legacy owners still require identity/email verification: the canonical
      // activation service refuses them until verification is complete.
      tx.store.findMany({
        where: { status: "ACTIVE" },
        select: { id: true },
        take: 1000,
      }),
      tx.deliveryServiceDefinition.findMany({
        where: {
          stableKey: { in: SUPPORTED_INITIAL_SERVICES },
          status: "ACTIVE", effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
        },
        select: { stableKey: true },
        distinct: ["stableKey"],
      }),
      tx.paymentMethodPolicy.findMany({ where: { storeId: { not: null } } }),
    ]);
    const existingScopes = new Set(policies.map(paymentPolicyScope));
    let codDraftsCreated = 0;
    for (const store of stores) {
      for (const service of services) {
        const scope = {
          businessModuleId: null, storeId: store.id, deliveryServiceId: service.stableKey,
          orderType: null, provinceScope: INITIAL_REGION, regionId: null, orderId: null,
        };
        const key = paymentPolicyScope(scope);
        // Preserve every existing store-specific policy, regardless of whether
        // it is ACTIVE, INACTIVE, SUPERSEDED, DIGITAL or has negotiated cash terms.
        if (existingScopes.has(key)) continue;
        const row = await tx.paymentMethodPolicy.create({
          data: {
            ...scope, versionNumber: 1, status: "INACTIVE",
            mode: "DEPOSIT_PLUS_COD",
            depositPercent: new Prisma.Decimal(INITIAL_COD_DIGITAL_SHARE),
            maximumCodAmount: new Prisma.Decimal(INITIAL_RESEARCHED_COD_CASH_CEILING_ZAR),
            effectiveFrom: now, createdByUserId: actorUserId,
            policyEvidence: {
              source: BOOTSTRAP_ID, approvalRequired: true, approvedByUserId: null,
              proposal: "RESEARCHED_CONSERVATIVE_STARTING_CEILING",
              reason: "SAPS recommends minimizing cash held; owner supplied no numerical cap.",
              sourceUrl: "https://www.saps.gov.za/alert/carrycash_safely.php",
              amountMeaning: "MAXIMUM_OUTSTANDING_DRIVER_CASH_NOT_TOTAL_ORDER",
            },
          },
        });
        await tx.adminActivityLog.create({
          data: {
            actorUserId, action: "CREATE", entityType: "PaymentMethodPolicy",
            entityId: row.id,
            message: "Prepared inactive 50/50 Gauteng COD proposal; separate finance/remittance review required.",
            metadata: {
              source: BOOTSTRAP_ID, storeId: store.id, deliveryServiceKey: service.stableKey,
              cashCeilingZar: INITIAL_RESEARCHED_COD_CASH_CEILING_ZAR, activated: false,
            },
          },
        });
        existingScopes.add(key);
        codDraftsCreated += 1;
      }
    }
    return {
      digitalCreated, codDraftsCreated, activeCashPoliciesCreated: 0,
      activeStoresConsidered: stores.length,
      activeServicesConsidered: services.length,
    };
  }, { timeout: 90_000 });
}
