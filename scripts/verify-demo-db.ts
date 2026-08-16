import { PrismaClient, UserRole, OrderStatus } from "@prisma/client";
import { loadLocalEnv, safeLog, safeError } from "./docker-common.mjs";
import { validateDestructiveResetSafety } from "./demo-db-safety";
import {
  validateCodEconomics,
  validateDriverAssignmentEligibility,
  validateClaimRemedyConsistency,
  validateChronologicalSequence,
} from "../lib/invariants/demo-invariants";
import process from "node:process";

const prisma = new PrismaClient();

async function verify() {
  safeLog("🔍 Starting KT Couriers Comprehensive Database Invariant & Safety Verification...");

  // 1. Safety verification
  const env = loadLocalEnv() as Record<string, string | undefined>;
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
  const totalLedgerEntries = await prisma.ledgerEntry.count();
  const totalMarketingPackages = await prisma.managedMarketingPackageVersion.count();
  const totalMarketingRequests = await prisma.managedMarketingRequest.count();
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
  console.log(`Total Ledger Journals/Entries: ${totalLedgerJournals} / ${totalLedgerEntries}`);
  console.log(`Total Marketing Packages/Reqs: ${totalMarketingPackages} / ${totalMarketingRequests}`);
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
  if (totalMarketingPackages < 2) { safeError(`❌ Marketing packages count ${totalMarketingPackages} below threshold 2`); invariantsPassed = false; }

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
  for (const requiredRole of [UserRole.CUSTOMER, UserRole.STORE, UserRole.DRIVER, UserRole.ADMIN, UserRole.SUPER_ADMIN]) {
    if (!distinctRoles.has(requiredRole)) {
      safeError(`❌ Missing user role in dataset: ${requiredRole}`);
      invariantsPassed = false;
    }
  }

  const distinctCourierStatuses = new Set(courierOrderCounts.map((c) => c.status));
  for (const requiredStatus of [OrderStatus.DELIVERED, OrderStatus.IN_TRANSIT, OrderStatus.PENDING, OrderStatus.CANCELLED, OrderStatus.FAILED]) {
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

  // Check 5: Pure Invariant Function Verification for Driver Assignment Eligibility
  const assignments = await prisma.orderAssignment.findMany({
    include: {
      driverProfile: {
        include: {
          vehicles: {
            select: { id: true, status: true },
          },
        },
      },
    },
  });

  let driverEligibilityErrors = 0;
  for (const assignment of assignments) {
    const approvedVehicle = assignment.driverProfile.vehicles.find((v) => v.status === "APPROVED");
    const vehicleStatus = approvedVehicle ? "APPROVED" : (assignment.driverProfile.vehicles[0]?.status || "NO_VEHICLE");
    const res = validateDriverAssignmentEligibility({
      driverProfileId: assignment.driverProfile.id,
      driverCode: assignment.driverProfile.driverCode,
      status: assignment.driverProfile.status,
      onboardingStatus: assignment.driverProfile.onboardingStatus,
      vehicleStatus,
      assignedAt: assignment.assignedAt,
      completedAt: assignment.completedAt,
    });
    if (!res.valid) {
      driverEligibilityErrors++;
    }
  }

  if (driverEligibilityErrors > 0) {
    safeError(`❌ Found ${driverEligibilityErrors} assignments violating driver eligibility invariant`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ Driver eligibility verified across all ${assignments.length} assignments via pure invariant validator`);
  }

  // Check 6: Pure Invariant Function Verification for COD Economics
  const codRecords = await prisma.cashOnDelivery.findMany({
    include: {
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
      reconciliations: true,
    },
  });

  let codInvariantErrors = 0;
  for (const cod of codRecords) {
    const res = validateCodEconomics({
      publicReference: cod.publicReference,
      policyMode: cod.policyMode as "FULL_COD" | "DEPOSIT_PLUS_COD" | "DIGITAL",
      authoritativePayable: Number(cod.authoritativePayable),
      digitalRequired: Number(cod.digitalRequired),
      digitalPaid: Number(cod.digitalPaid),
      cashObligation: Number(cod.cashObligation),
      cashCollected: Number(cod.cashCollected),
      cashReconciled: Number(cod.cashReconciled),
      status: (cod.status === "COLLECTED" || cod.status === "RECONCILED") ? cod.status : "PENDING",
      collectorDriverId: cod.collectorDriverId,
      collectionJournalId: cod.collectionJournalId,
      reconciliationJournalId: cod.reconciliationJournalId,
      reconciliationStatus: cod.reconciliationStatus,
      reconciledAt: cod.reconciledAt,
      reconciliationActorId: cod.reconciliationActorId,
      payments: cod.order?.payments ? cod.order.payments.map((p) => ({ id: p.id, status: p.status, amount: Number(p.amount) })) : [],
    });

    if (!res.valid) {
      codInvariantErrors++;
    }
  }

  if (codInvariantErrors > 0) {
    safeError(`❌ Found ${codInvariantErrors} COD records failing pure invariant validation`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ COD economics verified across all ${codRecords.length} records via pure invariant validator`);
  }

  // Check 7: Pure Invariant Function Verification for Claims & Remedies
  const claimsWithRemedies = await prisma.claim.findMany({
    include: {
      remedy: {
        include: { paymentRefund: true },
      },
      order: {
        include: {
          payments: true,
          cashOnDelivery: true,
        },
      },
    },
  });

  let claimInvariantErrors = 0;
  for (const claim of claimsWithRemedies) {
    const codPolicy = claim.order?.cashOnDelivery?.policyMode || "DIGITAL";
    const succeededPayment = claim.order?.payments?.find((p) => p.status === "SUCCEEDED");
    const digitalPaidAmount = claim.order?.cashOnDelivery
      ? Number(claim.order.cashOnDelivery.digitalPaid)
      : (succeededPayment ? Number(succeededPayment.amount) : 0);

    const res = validateClaimRemedyConsistency({
      claimReference: claim.publicReference,
      orderPolicyMode: codPolicy as "FULL_COD" | "DEPOSIT_PLUS_COD" | "DIGITAL",
      paymentSource: claim.paymentSource as "DIGITAL" | "CASH" | "MIXED",
      claimStatus: claim.status,
      remedyType: claim.remedy?.type,
      remedyAmount: claim.remedy ? Number(claim.remedy.amount) : 0,
      paymentRefundId: claim.remedy?.paymentRefundId,
      refundAmount: claim.remedy?.paymentRefund ? Number(claim.remedy.paymentRefund.amount) : 0,
      refundStatus: claim.remedy?.paymentRefund?.status,
      digitalPaidAmount,
    });

    if (!res.valid) {
      claimInvariantErrors++;
    }
  }

  if (claimInvariantErrors > 0) {
    safeError(`❌ Found ${claimInvariantErrors} claims failing pure invariant consistency validation`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ Claim remedy & refund consistency verified across ${claimsWithRemedies.length} claims via pure validator`);
  }

  // Check 8: Comprehensive Double-Entry Ledger Invariants & Conservation
  const journalsWithEntries = await prisma.ledgerJournal.findMany({
    include: {
      entries: {
        select: {
          id: true,
          direction: true,
          amount: true,
        },
      },
    },
  });

  let journalSumErrors = 0;
  let missingEntryErrors = 0;
  let totalAllDebits = 0;
  let totalAllCredits = 0;

  for (const jnl of journalsWithEntries) {
    if (jnl.entries.length === 0) {
      missingEntryErrors++;
      continue;
    }

    let jnlDebits = 0;
    let jnlCredits = 0;

    for (const ent of jnl.entries) {
      const amt = Number(ent.amount);
      if (ent.direction === "DEBIT") {
        jnlDebits += amt;
        totalAllDebits += amt;
      } else if (ent.direction === "CREDIT") {
        jnlCredits += amt;
        totalAllCredits += amt;
      }
    }

    const diffDebits = Math.abs(jnlDebits - Number(jnl.totalDebits));
    const diffCredits = Math.abs(jnlCredits - Number(jnl.totalCredits));
    const diffBalance = Math.abs(jnlDebits - jnlCredits);

    if (diffDebits > 0.01 || diffCredits > 0.01 || diffBalance > 0.01) {
      journalSumErrors++;
    }
  }

  if (missingEntryErrors > 0) {
    safeError(`❌ Found ${missingEntryErrors} ledger journals with 0 LedgerEntry rows`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ All ${journalsWithEntries.length} ledger journals contain explicit LedgerEntry rows`);
  }

  if (journalSumErrors > 0) {
    safeError(`❌ Found ${journalSumErrors} journals with mismatched entry sums or unbalanced debits/credits`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ All ${journalsWithEntries.length} journals verified: Sum(Entry.DEBIT) === TotalDebits === Sum(Entry.CREDIT) === TotalCredits`);
  }

  const globalDiff = Math.abs(totalAllDebits - totalAllCredits);
  if (globalDiff > 0.01) {
    safeError(`❌ Universal double-entry imbalance: Total Debits (R ${totalAllDebits.toFixed(2)}) !== Total Credits (R ${totalAllCredits.toFixed(2)})`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ Universal accounting conservation proved: Total Debits (R ${totalAllDebits.toFixed(2)}) === Total Credits (R ${totalAllCredits.toFixed(2)})`);
  }

  // Check 9: Full Chronological Invariant Chain Across Actual Database Records
  const ordersWithTimelines = await prisma.order.findMany({
    where: { status: "DELIVERED" },
    include: {
      customer: { select: { createdAt: true } },
      assignments: { select: { assignedAt: true, completedAt: true } },
      claims: {
        select: {
          createdAt: true,
          decidedAt: true,
          remedy: { select: { createdAt: true } },
        },
      },
    },
  });

  let chronologicalChainErrors = 0;
  for (const ord of ordersWithTimelines) {
    if (!ord.customer) continue;
    const userCreated = ord.customer.createdAt;
    const orderCreated = ord.createdAt;
    const assignment = ord.assignments[0];
    const assignedAt = assignment?.assignedAt;
    const completedAt = assignment?.completedAt;
    const claim = ord.claims[0];

    const res = validateChronologicalSequence({
      userCreatedAt: userCreated,
      orderCreatedAt: orderCreated,
      assignmentAssignedAt: assignedAt,
      assignmentCompletedAt: completedAt,
      claimCreatedAt: claim?.createdAt,
      remedyCreatedAt: claim?.remedy?.createdAt,
    });
    if (!res.valid) {
      chronologicalChainErrors++;
    }
  }

  if (chronologicalChainErrors > 0) {
    safeError(`❌ Found ${chronologicalChainErrors} orders violating end-to-end chronological timeline`);
    invariantsPassed = false;
  } else {
    safeLog(`✓ Full end-to-end chronological chain verified across delivered orders, assignments, and claims`);
  }

  if (invariantsPassed) {
    safeLog("✅ All Database Invariants, Accounting Conservation, Safety Checks & Entity Thresholds PASSED!");
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
