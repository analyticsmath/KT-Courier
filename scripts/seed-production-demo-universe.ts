import { PrismaClient } from "@prisma/client";
import { disconnectFullDemoSeeder, seedFullDemo } from "./seed-full-demo";

const prisma = new PrismaClient();

function requireProductionAuthorization(): void {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Production demo-universe bootstrap requires NODE_ENV=production.");
  }
  if (process.env.KT_DATABASE_CLASSIFICATION?.trim().toLowerCase() !== "production") {
    throw new Error("Production demo-universe bootstrap requires KT_DATABASE_CLASSIFICATION=production.");
  }
  if (process.env.KT_PRODUCTION_DEMO_UNIVERSE_SEED !== "true") {
    throw new Error("Production demo-universe bootstrap requires KT_PRODUCTION_DEMO_UNIVERSE_SEED=true.");
  }
  if (process.env.CATALOG_MEDIA_STORAGE?.trim().toLowerCase() !== "s3") {
    throw new Error("Production demo-universe bootstrap requires durable CATALOG_MEDIA_STORAGE=s3.");
  }
  const password = process.env.KT_DEMO_ACCOUNT_PASSWORD?.trim() ?? "";
  if (password.length < 40) {
    throw new Error("KT_DEMO_ACCOUNT_PASSWORD must be a deployment-only secret of at least 40 characters.");
  }
}

async function getDemoCounts() {
  const [
    courierOrders,
    marketplaceOrders,
    customers,
    drivers,
    promoters,
    activeStores,
    publishedOffers,
    activeProductDocuments,
    activeStoreDocuments,
  ] = await Promise.all([
    prisma.order.count({ where: { orderNumber: { startsWith: "KT-2026-" } } }),
    prisma.marketplaceOrder.count({ where: { publicReference: { startsWith: "MKT-2026-" } } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.driverProfile.count(),
    prisma.promoterProfile.count(),
    prisma.store.count({ where: { status: "ACTIVE" } }),
    prisma.storeCatalogOffer.count({ where: { status: "ACTIVE", publicationStatus: "PUBLISHED" } }),
    prisma.storefrontProductDocument.count({ where: { status: "ACTIVE", searchable: true } }),
    prisma.storefrontStoreDocument.count({ where: { publicStatus: "ACTIVE" } }),
  ]);

  return {
    courierOrders,
    marketplaceOrders,
    customers,
    drivers,
    promoters,
    activeStores,
    publishedOffers,
    activeProductDocuments,
    activeStoreDocuments,
  };
}

function assertComplete(counts: Awaited<ReturnType<typeof getDemoCounts>>): void {
  const failures: string[] = [];
  if (counts.courierOrders < 180) failures.push(`courierOrders=${counts.courierOrders}`);
  if (counts.marketplaceOrders < 420) failures.push(`marketplaceOrders=${counts.marketplaceOrders}`);
  if (counts.customers < 60) failures.push(`customers=${counts.customers}`);
  if (counts.drivers < 24) failures.push(`drivers=${counts.drivers}`);
  if (counts.promoters < 10) failures.push(`promoters=${counts.promoters}`);
  if (counts.activeStores < 16) failures.push(`activeStores=${counts.activeStores}`);
  if (counts.publishedOffers < 1) failures.push(`publishedOffers=${counts.publishedOffers}`);
  if (counts.activeProductDocuments < 1) failures.push(`activeProductDocuments=${counts.activeProductDocuments}`);
  if (counts.activeStoreDocuments < 1) failures.push(`activeStoreDocuments=${counts.activeStoreDocuments}`);

  if (failures.length > 0) {
    throw new Error(`Production demo universe verification failed: ${failures.join(", ")}`);
  }
}

async function main(): Promise<void> {
  requireProductionAuthorization();

  const before = await getDemoCounts();
  console.log(JSON.stringify({ event: "production_demo_universe_preflight", ...before }));

  if (before.courierOrders === 0 && before.marketplaceOrders === 0) {
    await seedFullDemo({
      catalogOnly: false,
      includeDevAuthAccounts: false,
      skipSafetyCheck: true,
      catalogStorageProvider: "S3_COMPATIBLE",
    });
  } else if (before.courierOrders < 180 || before.marketplaceOrders < 420) {
    throw new Error(
      `Refusing partial production demo replay: courierOrders=${before.courierOrders}, marketplaceOrders=${before.marketplaceOrders}. Manual reconciliation is required before replay.`,
    );
  }

  const after = await getDemoCounts();
  assertComplete(after);

  const [
    assignments,
    completedAssignments,
    payments,
    paymentAttempts,
    ledgerJournals,
    marketplaceStoreOrders,
  ] = await Promise.all([
    prisma.orderAssignment.count(),
    prisma.orderAssignment.count({ where: { status: "COMPLETED" } }),
    prisma.payment.count(),
    prisma.paymentAttempt.count(),
    prisma.ledgerJournal.count(),
    prisma.marketplaceStoreOrder.count(),
  ]);

  const [sizweUser, tanyaUser, leratoUser, ubuntuOwner] = await Promise.all([
    prisma.user.findUnique({ where: { email: "sizwe.zulu1@example.co.za" }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: "tanya.chetty2@example.co.za" }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: "driver.lerato.adams1@ktcouriers.local" }, select: { id: true } }),
    prisma.user.findUnique({ where: { email: "store.ubuntu-fresh-market@ktcouriers.local" }, select: { id: true } }),
  ]);

  const leratoProfile = leratoUser
    ? await prisma.driverProfile.findUnique({ where: { userId: leratoUser.id }, select: { id: true } })
    : null;
  const ubuntuStore = ubuntuOwner
    ? await prisma.store.findFirst({ where: { ownerUserId: ubuntuOwner.id }, select: { id: true, slug: true } })
    : null;

  const [
    sizweCourierOrders,
    tanyaCourierOrders,
    leratoAssignments,
    leratoCompletedAssignments,
    ubuntuCourierOrders,
    ubuntuMarketplaceOrders,
  ] = await Promise.all([
    sizweUser ? prisma.order.count({ where: { customerId: sizweUser.id } }) : Promise.resolve(0),
    tanyaUser ? prisma.order.count({ where: { customerId: tanyaUser.id } }) : Promise.resolve(0),
    leratoProfile ? prisma.orderAssignment.count({ where: { driverProfileId: leratoProfile.id } }) : Promise.resolve(0),
    leratoProfile ? prisma.orderAssignment.count({ where: { driverProfileId: leratoProfile.id, status: "COMPLETED" } }) : Promise.resolve(0),
    ubuntuStore ? prisma.order.count({ where: { storeId: ubuntuStore.id } }) : Promise.resolve(0),
    ubuntuStore ? prisma.marketplaceStoreOrder.count({ where: { storeId: ubuntuStore.id } }) : Promise.resolve(0),
  ]);

  console.log(JSON.stringify({
    event: "production_demo_account_coverage",
    sizweCourierOrders,
    tanyaCourierOrders,
    leratoAssignments,
    leratoCompletedAssignments,
    ubuntuStoreSlug: ubuntuStore?.slug ?? null,
    ubuntuCourierOrders,
    ubuntuMarketplaceOrders,
  }));

  console.log(JSON.stringify({
    event: "production_demo_universe_ready",
    ...after,
    assignments,
    completedAssignments,
    payments,
    paymentAttempts,
    ledgerJournals,
    marketplaceStoreOrders,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Production demo-universe bootstrap failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([prisma.$disconnect(), disconnectFullDemoSeeder()]);
  });
