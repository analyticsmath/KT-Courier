import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { AddressType, DeliveryType, DriverAvailability, DriverOnboardingStatus, DriverStatus, OrderSource, OrderStatus, PermissionEffect, StoreStatus, UserRole, UserStatus, VehicleType } from "@/types/db";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { reverseLedgerJournal } from "@/lib/services/ledger-reversal.service";

const prisma = new PrismaClient();

async function upsertStore(email: string, slug: string, name: string, passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { status: UserStatus.ACTIVE, role: UserRole.STORE },
    create: { email, name, role: UserRole.STORE, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), passwordHash },
  });
  const store = await prisma.store.upsert({
    where: { slug },
    update: { ownerUserId: user.id, status: StoreStatus.ACTIVE },
    create: { ownerUserId: user.id, name, slug, status: StoreStatus.ACTIVE, city: "Johannesburg", province: "Gauteng", country: "South Africa" },
  });
  const address = await prisma.address.upsert({
    where: { id: `${slug}-pickup-address` },
    update: {},
    create: { id: `${slug}-pickup-address`, storeId: store.id, type: AddressType.PICKUP, label: "E2E default pickup", line1: "10 E2E Pickup Road", city: "Johannesburg", province: "Gauteng", country: "South Africa", latitude: -26.2041, longitude: 28.0473, isDefault: true },
  });
  await prisma.store.update({ where: { id: store.id }, data: { defaultPickupAddressId: address.id } });
  return { user, store };
}

async function upsertDriver(email: string, code: string, regionId: string, passwordHash: string) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { status: UserStatus.ACTIVE, role: UserRole.DRIVER },
    create: { email, name: code, role: UserRole.DRIVER, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), passwordHash },
  });
  const profile = await prisma.driverProfile.upsert({
    where: { userId: user.id },
    update: { status: DriverStatus.ACTIVE, active: true, availability: DriverAvailability.AVAILABLE, maxConcurrentAssignments: 2 },
    create: { userId: user.id, driverCode: code, displayName: code, status: DriverStatus.ACTIVE, active: true, availability: DriverAvailability.AVAILABLE, onboardingStatus: DriverOnboardingStatus.APPROVED, vehicleType: VehicleType.CAR, maxConcurrentAssignments: 2 },
  });
  await prisma.driverServiceRegion.upsert({ where: { driverProfileId_deliveryRegionId: { driverProfileId: profile.id, deliveryRegionId: regionId } }, update: {}, create: { driverProfileId: profile.id, deliveryRegionId: regionId, isPrimary: true } });
  return { user, profile };
}

async function main() {
  const passwordHash = await bcrypt.hash("ChangeMe123!", 12);
  const [customer, region] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "customer@ktcouriers.local" } }),
    prisma.deliveryRegion.findUniqueOrThrow({ where: { slug: "johannesburg-metro" } }),
  ]);
  await upsertStore("e2e-store@ktcouriers.local", "e2e-store", "E2E Store", passwordHash);
  await upsertStore("e2e-other-store@ktcouriers.local", "e2e-other-store", "E2E Other Store", passwordHash);
  for (const orderNumber of ["E2E-DISPATCH-001", "E2E-DISPATCH-002"]) {
    const quote = await prisma.pricingQuote.create({
      data: {
        status: "ACTIVE", ownerType: "CUSTOMER", ownerId: customer.id, deliveryType: DeliveryType.SAME_DAY, currency: "ZAR", calculationVersion: "e2e", inputHash: "a".repeat(64), distanceMeters: 5000,
        rawDistanceKm: "5.0000", billableDistanceKm: "5.0000", subtotal: "75.00", taxRate: "0.0000", taxAmount: "0.00", total: "75.00",
        inputSnapshot: {}, ruleSnapshot: {}, regionSnapshot: {}, taxSnapshot: {}, expiresAt: new Date("2035-01-01"),
      },
    });

    await prisma.order.upsert({
      where: { orderNumber },
      update: { status: OrderStatus.CONFIRMED, currentDriverProfileId: null, pricingQuoteId: quote.id, priceEstimate: "75.00", pricingSubtotal: "75.00", pricingTaxAmount: "0.00", pricingTaxRate: "0.0000", pricingSnapshot: { quoteId: quote.id, calculationVersion: "e2e", fixture: "e2e" } },
      create: { orderNumber, source: OrderSource.CUSTOMER, status: OrderStatus.CONFIRMED, deliveryType: DeliveryType.SAME_DAY, currency: "ZAR", customerId: customer.id, deliveryRegionId: region.id, recipientName: "E2E Recipient", recipientPhone: "+27110000000", parcelCount: 1, pricingQuoteId: quote.id, priceEstimate: "75.00", pricingSubtotal: "75.00", pricingTaxAmount: "0.00", pricingTaxRate: "0.0000", pricingSnapshot: { quoteId: quote.id, calculationVersion: "e2e", fixture: "e2e" } },
    });
  }

  const deniedLedgerAdmin = await prisma.user.upsert({
    where: { email: "e2e-ledger-denied@ktcouriers.local" },
    update: { role: UserRole.ADMIN, status: UserStatus.ACTIVE, passwordHash },
    create: { email: "e2e-ledger-denied@ktcouriers.local", name: "E2E Ledger Denied", role: UserRole.ADMIN, status: UserStatus.ACTIVE, emailVerifiedAt: new Date(), passwordHash, adminProfile: { create: { displayName: "E2E Ledger Denied" } } },
  });
  const ledgerPermission = await prisma.permission.findUniqueOrThrow({ where: { key: "ledger.read" } });
  await prisma.userPermission.upsert({
    where: { userId_permissionId: { userId: deniedLedgerAdmin.id, permissionId: ledgerPermission.id } },
    update: { effect: PermissionEffect.DENY },
    create: { userId: deniedLedgerAdmin.id, permissionId: ledgerPermission.id, effect: PermissionEffect.DENY },
  });

  const cash = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: "PLATFORM-CASH-CLEARING-ZAR" } });
  const adjustment = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: "PLATFORM-ADJUSTMENT-ZAR" } });
  const ledgerFixture = await postLedgerJournal({
    idempotencyKey: "e2e-ledger-balanced-v1",
    type: "GENERAL",
    currency: "ZAR",
    sourceReference: "fixture:e2e-ledger-balanced-v1",
    correlationId: "e2e-ledger-audit",
    memo: "E2E balanced ledger inspection fixture",
    metadata: { fixture: "ledger-e2e" },
    actor: { kind: "SYSTEM" },
    entries: [
      { accountId: cash.id, direction: "DEBIT", amount: "5.00", lineCode: "E2E-CASH" },
      { accountId: adjustment.id, direction: "CREDIT", amount: "5.00", lineCode: "E2E-CONTROL" },
    ],
  });
  await reverseLedgerJournal({ originalJournalId: ledgerFixture.id, idempotencyKey: "e2e-ledger-reversal-v1", actor: { kind: "SYSTEM" }, memo: "E2E reversal relation fixture" });
  console.log("E2E fixtures are ready.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
