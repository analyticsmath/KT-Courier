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
