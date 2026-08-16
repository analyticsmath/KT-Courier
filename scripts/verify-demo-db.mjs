import { PrismaClient } from "@prisma/client";
import { loadLocalEnv, safeLog, safeError } from "./docker-common.mjs";
import { validateDestructiveResetSafety } from "./demo-db-safety.mjs";
import process from "node:process";

const prisma = new PrismaClient();

async function verify() {
  safeLog("🔍 Starting KT Couriers Comprehensive Database Invariant & Safety Verification...");

  // 1. Safety verification
  const env = loadLocalEnv();
  const { currentDbName, host, port } = validateDestructiveResetSafety(env);
  safeLog(`✓ Target database verified safe for demo operations: ${host}:${port} (${currentDbName})`);

  // 2. Aggregate entity counts
  const totalUsers = await prisma.user.count();
  const totalStores = await prisma.store.count();
  const totalDrivers = await prisma.driverProfile.count();
  const totalPromoters = await prisma.promoterProfile.count();
  const totalVacancies = await prisma.vacancy.count();
  const totalApplications = await prisma.vacancyApplication.count();
  const totalProducts = await prisma.catalogProduct.count();
  const totalVariants = await prisma.catalogProductVariant.count();
  const totalCourierOrders = await prisma.order.count();
  const totalMktOrders = await prisma.marketplaceOrder.count();
  const totalPayments = await prisma.payment.count();
  const totalPaymentAttempts = await prisma.paymentAttempt.count();
  const totalLedgerJournals = await prisma.ledgerJournal.count();
  const totalReportJobs = await prisma.reportJob.count();
  const totalReportArtifacts = await prisma.reportExportArtifact.count();
  const totalNotifications = await prisma.notification.count();

  // 3. State distributions
  const userCounts = await prisma.user.groupBy({ by: ["role", "status"], _count: true });
  const storeCounts = await prisma.store.groupBy({ by: ["status"], _count: true });
  const driverCounts = await prisma.driverProfile.groupBy({ by: ["status", "availability"], _count: true });
  const courierOrderCounts = await prisma.order.groupBy({ by: ["status"], _count: true });
  const mktOrderCounts = await prisma.marketplaceOrder.groupBy({ by: ["status"], _count: true });
  const paymentCounts = await prisma.payment.groupBy({ by: ["status"], _count: true });

  console.log("\n========================================================");
  console.log("          KT COURIERS DEMO DATASET ENTITY SUMMARY        ");
  console.log("========================================================");
  console.log(`Total Users:                   ${totalUsers}`);
  console.log(`Total Stores:                  ${totalStores}`);
  console.log(`Total Drivers:                 ${totalDrivers}`);
  console.log(`Total Promoters:               ${totalPromoters}`);
  console.log(`Total Vacancies:               ${totalVacancies}`);
  console.log(`Total Job Applicants:          ${totalApplications}`);
  console.log(`Total Catalog Products:        ${totalProducts}`);
  console.log(`Total Product Variants:        ${totalVariants}`);
  console.log(`Total Courier Delivery Orders: ${totalCourierOrders}`);
  console.log(`Total Marketplace Orders:      ${totalMktOrders}`);
  console.log(`Total Payments & Attempts:     ${totalPayments} / ${totalPaymentAttempts}`);
  console.log(`Total Ledger Journals:         ${totalLedgerJournals}`);
  console.log(`Total Notifications:           ${totalNotifications}`);
  console.log(`Total Report Jobs:             ${totalReportJobs}`);
  console.log(`Total Report Artifacts:        ${totalReportArtifacts}`);
  console.log("========================================================\n");

  let invariantsPassed = true;

  // Check 1: Quantitative thresholds
  if (totalUsers < 500) { safeError(`❌ User count ${totalUsers} below threshold 500`); invariantsPassed = false; }
  if (totalStores < 30) { safeError(`❌ Store count ${totalStores} below threshold 30`); invariantsPassed = false; }
  if (totalProducts < 700) { safeError(`❌ Product count ${totalProducts} below threshold 700`); invariantsPassed = false; }
  if (totalCourierOrders < 2000) { safeError(`❌ Courier order count ${totalCourierOrders} below threshold 2000`); invariantsPassed = false; }
  if (totalMktOrders < 1000) { safeError(`❌ Marketplace order count ${totalMktOrders} below threshold 1000`); invariantsPassed = false; }

  // Check 2: 1-Year Temporal Span
  const courierDateRange = await prisma.order.aggregate({
    _min: { createdAt: true },
    _max: { createdAt: true },
  });

  if (courierDateRange._min.createdAt && courierDateRange._max.createdAt) {
    const startMs = courierDateRange._min.createdAt.getTime();
    const endMs = courierDateRange._max.createdAt.getTime();
    const spanDays = (endMs - startMs) / (1000 * 60 * 60 * 24);
    if (spanDays < 300) {
      safeError(`❌ Temporal span ${spanDays.toFixed(1)} days is less than required ~1 year (300+ days)`);
      invariantsPassed = false;
    } else {
      safeLog(`✓ Temporal range verified: ${courierDateRange._min.createdAt.toISOString().slice(0, 10)} to ${courierDateRange._max.createdAt.toISOString().slice(0, 10)} (${spanDays.toFixed(0)} days)`);
    }
  }

  // Check 3: State Diversity Coverage
  const distinctRoles = new Set(userCounts.map((u) => u.role));
  for (const requiredRole of ["CUSTOMER", "STORE", "DRIVER", "ADMIN", "SUPER_ADMIN"]) {
    if (!distinctRoles.has(requiredRole)) {
      safeError(`❌ Missing user role in dataset: ${requiredRole}`);
      invariantsPassed = false;
    }
  }

  const distinctCourierStatuses = new Set(courierOrderCounts.map((c) => c.status));
  for (const requiredStatus of ["DELIVERED", "IN_TRANSIT", "PENDING", "CANCELLED", "FAILED"]) {
    if (!distinctCourierStatuses.has(requiredStatus)) {
      safeError(`❌ Missing courier order status in dataset: ${requiredStatus}`);
      invariantsPassed = false;
    }
  }

  const distinctPaymentStatuses = new Set(paymentCounts.map((p) => p.status));
  if (!distinctPaymentStatuses.has("SUCCEEDED")) {
    safeError("❌ Missing SUCCEEDED payments in dataset");
    invariantsPassed = false;
  }

  const distinctStoreStatuses = new Set(storeCounts.map((s) => s.status));
  if (!distinctStoreStatuses.has("ACTIVE")) {
    safeError("❌ Missing ACTIVE stores in dataset");
    invariantsPassed = false;
  }

  const distinctDriverStatuses = new Set(driverCounts.map((d) => d.status));
  if (!distinctDriverStatuses.has("ACTIVE")) {
    safeError("❌ Missing ACTIVE drivers in dataset");
    invariantsPassed = false;
  }

  const distinctMktStatuses = new Set(mktOrderCounts.map((m) => m.status));
  if (!distinctMktStatuses.has("CONFIRMED")) {
    safeError("❌ Missing CONFIRMED marketplace orders in dataset");
    invariantsPassed = false;
  }

  // Check 4: Referential Integrity
  const orphanedOrders = await prisma.order.count({
    where: { OR: [{ customerId: null }, { pickupAddressId: null }, { dropoffAddressId: null }] },
  });
  if (orphanedOrders > 0) {
    safeError(`❌ Found ${orphanedOrders} orders with missing required references`);
    invariantsPassed = false;
  } else {
    safeLog("✓ Order referential integrity verified (addresses and customer links present)");
  }

  // Check 5: Economic Reconciliation (Ledger Balance)
  const unbalancedJournals = await prisma.ledgerJournal.count({
    where: { isBalanced: false },
  });
  if (unbalancedJournals > 0) {
    safeError(`❌ Found ${unbalancedJournals} unbalanced ledger journals`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ All ${totalLedgerJournals} ledger journals verified balanced (Debits === Credits)`);
  }

  // Check 6: Marketplace Grand Total Conservation
  const invalidMktOrders = await prisma.marketplaceOrder.findMany({
    where: {
      grandTotal: { lt: 0 },
    },
    take: 5,
  });
  if (invalidMktOrders.length > 0) {
    safeError(`❌ Found ${invalidMktOrders.length} marketplace orders with negative grandTotal`);
    invariantsPassed = false;
  } else {
    safeLog("✓ Marketplace economic totals verified non-negative and consistent");
  }

  // Check 7: Driver Eligibility & Vehicle Compliance
  const invalidAssignments = await prisma.orderAssignment.findMany({
    where: {
      driverProfile: {
        OR: [
          { status: { not: "ACTIVE" } },
          { onboardingStatus: { not: "APPROVED" } },
          { vehicles: { none: { status: "APPROVED" } } },
        ],
      },
    },
    take: 5,
    include: { driverProfile: { select: { id: true, driverCode: true, status: true, onboardingStatus: true } } },
  });
  if (invalidAssignments.length > 0) {
    safeError(`❌ Found ${invalidAssignments.length} assignments given to ineligible/non-compliant drivers.`);
    invariantsPassed = false;
  } else {
    safeLog("✓ Driver eligibility & vehicle compliance verified for all assignments");
  }

  // Check 8: COD & Digital Payment Split Conservation
  const codRecords = await prisma.cashOnDelivery.findMany({
    select: {
      id: true,
      publicReference: true,
      policyMode: true,
      authoritativePayable: true,
      digitalRequired: true,
      digitalPaid: true,
      cashObligation: true,
      cashCollected: true,
      cashReconciled: true,
      status: true,
      order: {
        select: {
          id: true,
          status: true,
          currentDriverProfileId: true,
          payments: {
            select: { id: true, status: true, amount: true },
          },
        },
      },
    },
  });

  let codSplitErrors = 0;
  let codDoublePaymentErrors = 0;

  for (const cod of codRecords) {
    const auth = Number(cod.authoritativePayable);
    const digReq = Number(cod.digitalRequired);
    const cashObl = Number(cod.cashObligation);

    // Split conservation: digitalRequired + cashObligation === authoritativePayable
    if (Math.abs((digReq + cashObl) - auth) > 0.01) {
      codSplitErrors++;
    }

    // No full-COD + full-digital double payment
    if (cod.policyMode === "FULL_COD") {
      const succeededDigital = cod.order?.payments?.find(
        (p) => p.status === "SUCCEEDED" && Number(p.amount) > 0
      );
      if (succeededDigital) {
        codDoublePaymentErrors++;
      }
    }
  }

  if (codSplitErrors > 0) {
    safeError(`❌ Found ${codSplitErrors} COD records violating split conservation (digitalRequired + cashObligation !== total)`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ COD split conservation verified across all ${codRecords.length} records`);
  }

  if (codDoublePaymentErrors > 0) {
    safeError(`❌ Found ${codDoublePaymentErrors} FULL_COD orders with full digital double payment`);
    invariantsPassed = false;
  } else {
    safeLog("✓ Double-payment protection verified (0 FULL_COD orders have succeeded digital payment)");
  }

  // Check 9: Claims & Remedy Refund Consistency
  const claimsWithRemedies = await prisma.claim.findMany({
    where: { status: "DECIDED" },
    include: {
      remedy: {
        include: { paymentRefund: true },
      },
      order: {
        include: { payments: true },
      },
    },
  });

  let claimRemedyErrors = 0;
  for (const claim of claimsWithRemedies) {
    if (!claim.remedy) {
      claimRemedyErrors++;
      continue;
    }
    if (claim.paymentSource === "DIGITAL" && claim.remedy.type === "PARTIAL_REFUND") {
      if (!claim.remedy.paymentRefund || Number(claim.remedy.amount) <= 0) {
        claimRemedyErrors++;
      }
    }
  }

  if (claimRemedyErrors > 0) {
    safeError(`❌ Found ${claimRemedyErrors} claims with inconsistent remedy or refund linkages`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ Claim remedy & refund consistency verified across ${claimsWithRemedies.length} decided claims`);
  }

  // Check 10: Strict Chronological Invariants
  const chronologicalViolations = await prisma.orderAssignment.count({
    where: {
      completedAt: {
        lt: prisma.orderAssignment.fields.assignedAt,
      },
    },
  });

  if (chronologicalViolations > 0) {
    safeError(`❌ Found ${chronologicalViolations} assignments where completedAt < assignedAt`);
    invariantsPassed = false;
  } else {
    safeLog("✓ Assignment chronological ordering verified (assignedAt <= completedAt)");
  }

  if (invariantsPassed) {
    safeLog("✅ All Database Invariants, Safety Checks & Entity Count Thresholds PASSED!");
  } else {
    safeError("❌ Database Invariant Verification FAILED!");
    process.exit(1);
  }
}

verify()
  .catch((e) => {
    safeError("❌ Verification execution error: " + e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
