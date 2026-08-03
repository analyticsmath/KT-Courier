import { PrismaClient } from "@prisma/client";
import { safeLog, safeError } from "./docker-common.mjs";

const prisma = new PrismaClient();

async function verify() {
  safeLog("🔍 Starting KT Couriers Comprehensive Database Invariant Verification...");

  const userCounts = await prisma.user.groupBy({
    by: ["role", "status"],
    _count: true,
  });

  const storeCounts = await prisma.store.groupBy({
    by: ["status"],
    _count: true,
  });

  const driverCounts = await prisma.driverProfile.groupBy({
    by: ["status", "availability"],
    _count: true,
  });

  const promoterCounts = await prisma.promoterProfile.groupBy({
    by: ["status"],
    _count: true,
  });

  const appCounts = await prisma.vacancyApplication.groupBy({
    by: ["status"],
    _count: true,
  });

  const courierOrderCounts = await prisma.order.groupBy({
    by: ["status"],
    _count: true,
  });

  const mktOrderCounts = await prisma.marketplaceOrder.groupBy({
    by: ["status"],
    _count: true,
  });

  const notifCounts = await prisma.notification.groupBy({
    by: ["channel", "status"],
    _count: true,
  });

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
  const totalReportJobs = await prisma.reportJob.count();
  const totalReportArtifacts = await prisma.reportExportArtifact.count();
  const totalNotifications = await prisma.notification.count();

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
  console.log(`Total Notifications:           ${totalNotifications}`);
  console.log(`Total Report Jobs:             ${totalReportJobs}`);
  console.log(`Total Report Artifacts:        ${totalReportArtifacts}`);
  console.log("========================================================\n");

  console.log("📌 User Roles & Status Breakdown:", JSON.stringify(userCounts, null, 2));
  console.log("📌 Stores Status Breakdown:", JSON.stringify(storeCounts, null, 2));
  console.log("📌 Drivers Breakdown:", JSON.stringify(driverCounts, null, 2));
  console.log("📌 Job Applications Breakdown:", JSON.stringify(appCounts, null, 2));
  console.log("📌 Courier Orders Breakdown:", JSON.stringify(courierOrderCounts, null, 2));
  console.log("📌 Marketplace Orders Breakdown:", JSON.stringify(mktOrderCounts, null, 2));
  console.log("📌 Notifications Breakdown:", JSON.stringify(notifCounts, null, 2));

  // Check key invariants
  let invariantsPassed = true;
  if (totalUsers < 500) { safeError("❌ User count below target threshold 500"); invariantsPassed = false; }
  if (totalStores < 30) { safeError("❌ Store count below target threshold 30"); invariantsPassed = false; }
  if (totalProducts < 700) { safeError("❌ Product count below target threshold 700"); invariantsPassed = false; }
  if (totalCourierOrders < 2000) { safeError("❌ Courier order count below target threshold 2000"); invariantsPassed = false; }
  if (totalMktOrders < 1000) { safeError("❌ Marketplace order count below target threshold 1000"); invariantsPassed = false; }

  if (invariantsPassed) {
    safeLog("✅ All Database Invariants & Entity Count Thresholds PASSED!");
  } else {
    safeError("❌ Database Verification FAILED!");
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
