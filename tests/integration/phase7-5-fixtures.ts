import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import {
  DeliveryType,
  DocumentStatus,
  DocumentType,
  DriverAvailability,
  DriverStatus,
  OrderSource,
  OrderStatus,
  PricingLineItemCode,
  PricingQuoteOwnerType,
  PricingQuoteStatus,
  PricingRuleType,
  PrivateMediaOwnerType,
  PrivateMediaPurpose,
  PrivateMediaStatus,
  UserRole,
  UserStatus,
  VehicleComplianceStatus,
  VehicleDocumentType,
  VehicleType,
} from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";
import type { CreateOrderInput } from "@/lib/validation/order";
import { hashPricingInput, pricingInputSnapshot } from "@/lib/pricing/input-hash";
import { buildPaystackReceiptPosting } from "@/lib/payments/providers/paystack/paystack-ledger-posting-policy";
import { postLedgerJournalWithinTransaction } from "@/lib/services/ledger-posting.service";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";

export const integrationPrisma = new PrismaClient();

export function uniqueTag(prefix = "p75") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function createUser(tag: string, role: UserRole, status: UserStatus = UserStatus.ACTIVE): Promise<AuthenticatedUser> {
  const user = await integrationPrisma.user.create({
    data: { email: `${tag}@phase75.test`, name: tag, role, status, passwordHash: "not-used-by-integration-tests" },
  });
  if (role === UserRole.CUSTOMER) {
    await integrationPrisma.customerProfile.create({ data: { userId: user.id, displayName: tag } });
  }
  return { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status };
}

export async function createRegion(tag: string) {
  return integrationPrisma.deliveryRegion.create({
    data: { name: tag, slug: tag.toLowerCase().replace(/[^a-z0-9]+/g, "-"), active: true, pricingEnabled: true, city: "Johannesburg", province: "Gauteng" },
  });
}

export async function createDriver(tag: string, regionId: string, capacity = 1) {
  const user = await createUser(`${tag}-driver`, UserRole.DRIVER);
  const profile = await integrationPrisma.driverProfile.create({
    data: {
      userId: user.id,
      driverCode: tag.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(-20),
      displayName: tag,
      active: true,
      status: DriverStatus.ACTIVE,
      availability: DriverAvailability.AVAILABLE,
      maxConcurrentAssignments: capacity,
    },
  });
  await integrationPrisma.driverServiceRegion.create({ data: { driverProfileId: profile.id, deliveryRegionId: regionId, isPrimary: true } });

  await createApprovedDriverEvidence(profile.id, user.id, tag);
  return { user, profile };
}

/** Approved evidence exists only in the caller's disposable test database. */
export async function createApprovedDriverEvidence(driverProfileId: string, userId: string, tag: string) {
  const profile = { id: driverProfileId };
  const user = { id: userId };

  await integrationPrisma.driverDocument.createMany({
    data: [
      { driverProfileId: profile.id, documentType: DocumentType.ID_DOCUMENT, status: DocumentStatus.APPROVED, expiresAt: null },
      { driverProfileId: profile.id, documentType: DocumentType.LICENSE, status: DocumentStatus.APPROVED, expiresAt: new Date("2035-01-01T00:00:00.000Z") },
    ],
  });

  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const vehicle = await integrationPrisma.vehicle.create({
    data: {
      publicReference: `VEH-${randomUUID().replaceAll("-", "").slice(0, 24)}`,
      driverProfileId: profile.id,
      make: "Toyota",
      model: "Corolla",
      registrationNumber: `GP-${rand}`,
      vehicleType: VehicleType.CAR,
      status: VehicleComplianceStatus.APPROVED,
      approvedAt: new Date(),
      approvedByUserId: user.id,
    },
  });

  const mediaReg = await integrationPrisma.privateMediaObject.create({
    data: {
      publicReference: `MED-REG-${randomUUID().replaceAll("-", "").slice(0, 20)}`,
      ownerType: PrivateMediaOwnerType.VEHICLE,
      ownerId: vehicle.id,
      purpose: PrivateMediaPurpose.VEHICLE_REGISTRATION,
      status: PrivateMediaStatus.READY,
      storageProvider: "local",
      storageKey: `key-reg-${tag}-${Date.now()}-${rand}`,
      originalFileName: "reg.pdf",
      declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      byteSize: 1024,
      checksum: "0".repeat(64),
      createdByUserId: user.id,
    },
  });
  const mediaDisc = await integrationPrisma.privateMediaObject.create({
    data: {
      publicReference: `MED-DISC-${randomUUID().replaceAll("-", "").slice(0, 20)}`,
      ownerType: PrivateMediaOwnerType.VEHICLE,
      ownerId: vehicle.id,
      purpose: PrivateMediaPurpose.VEHICLE_LICENCE_DISC,
      status: PrivateMediaStatus.READY,
      storageProvider: "local",
      storageKey: `key-disc-${tag}-${Date.now()}-${rand}`,
      originalFileName: "disc.pdf",
      declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      byteSize: 1024,
      checksum: "0".repeat(64),
      createdByUserId: user.id,
    },
  });
  const mediaIns = await integrationPrisma.privateMediaObject.create({
    data: {
      publicReference: `MED-INS-${randomUUID().replaceAll("-", "").slice(0, 20)}`,
      ownerType: PrivateMediaOwnerType.VEHICLE,
      ownerId: vehicle.id,
      purpose: PrivateMediaPurpose.VEHICLE_INSURANCE,
      status: PrivateMediaStatus.READY,
      storageProvider: "local",
      storageKey: `key-ins-${tag}-${Date.now()}-${rand}`,
      originalFileName: "ins.pdf",
      declaredMimeType: "application/pdf",
      detectedMimeType: "application/pdf",
      byteSize: 1024,
      checksum: "0".repeat(64),
      createdByUserId: user.id,
    },
  });

  await integrationPrisma.vehicleDocument.createMany({
    data: [
      { vehicleId: vehicle.id, documentType: VehicleDocumentType.REGISTRATION, status: DocumentStatus.APPROVED, privateMediaObjectId: mediaReg.id, expiresAt: null, reviewedAt: new Date(), reviewedByUserId: user.id },
      { vehicleId: vehicle.id, documentType: VehicleDocumentType.LICENCE_DISC, status: DocumentStatus.APPROVED, privateMediaObjectId: mediaDisc.id, expiresAt: new Date("2035-01-01T00:00:00.000Z"), reviewedAt: new Date(), reviewedByUserId: user.id },
      { vehicleId: vehicle.id, documentType: VehicleDocumentType.INSURANCE, status: DocumentStatus.APPROVED, privateMediaObjectId: mediaIns.id, expiresAt: new Date("2035-01-01T00:00:00.000Z"), reviewedAt: new Date(), reviewedByUserId: user.id },
    ],
  });

  return vehicle;
}

export async function seedVerifiedPaidOrderEvidence(
  db: PrismaClient,
  input: { orderId: string; amount: string; customerId: string | null; tag: string },
) {
  const suffix = randomUUID().replaceAll("-", "");
  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('p75-platform-zar-seed'))`;
    const pw = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" }, tx);
    const cash = await ensureLedgerAccount(
      { walletId: pw.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" },
      tx,
    );
    const held = await ensureLedgerAccount(
      { walletId: pw.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" },
      tx,
    );

    const paymentNumber = `KT-PAY-${suffix.slice(0, 16).toUpperCase()}`;
    const payment = await tx.payment.create({
      data: {
        publicReference: paymentNumber,
        userId: input.customerId,
        orderId: input.orderId,
        subjectType: "COURIER_ORDER",
        provider: "PAYSTACK",
        purpose: "ORDER",
        status: "CREATED",
        amount: input.amount,
        currency: "ZAR",
        creationIdempotencyKey: `idem-${suffix.slice(0, 20)}`,
        creationRequestHash: hashPricingInput({ orderId: input.orderId, tag: input.tag, suffix }),
      },
    });

    const attemptPublicRef = `pat_${suffix.slice(0, 24)}`;
    const attemptRef = `kt_p75_${suffix.slice(0, 20)}`;
    const providerRef = `ps_${suffix.slice(0, 20)}`;
    const attempt = await tx.paymentAttempt.create({
      data: {
        paymentId: payment.id,
        attemptNumber: 1,
        publicReference: attemptPublicRef,
        idempotencyKey: `idem-att-${suffix.slice(0, 20)}`,
        requestHash: hashPricingInput({ orderId: input.orderId, attempt: 1, tag: input.tag, suffix }),
        provider: "PAYSTACK",
        merchantReference: attemptRef,
        providerReference: providerRef,
        status: "SUCCEEDED",
        amount: input.amount,
        currency: "ZAR",
        startedAt: now,
        providerConfirmedAt: now,
        completedAt: now,
      },
    });

    const journal = await postLedgerJournalWithinTransaction(
      tx,
      buildPaystackReceiptPosting({
        paymentPublicReference: paymentNumber,
        attemptPublicReference: attemptPublicRef,
        eventPublicReference: `verify:${attemptRef}`,
        providerPaymentId: providerRef,
        amount: input.amount,
        cashClearingAccountId: cash.id,
        customerFundsHeldAccountId: held.id,
      }),
    );

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "SUCCEEDED",
        latestAttemptNumber: 1,
        successfulAttemptId: attempt.id,
        successLedgerJournalId: journal.id,
        providerConfirmedAt: now,
        succeededAt: now,
        reconciliationStatus: "RESOLVED",
        metadata: { verifiedVia: "PAYSTACK_VERIFY_API", fixture: input.tag },
        version: 1,
      },
    });
  });
}

export async function createDispatchOrder(tag: string, customerId: string, regionId: string) {
  const order = await integrationPrisma.order.create({
    data: {
      orderNumber: `P75-${tag}`.slice(0, 100),
      source: OrderSource.CUSTOMER,
      status: OrderStatus.CONFIRMED,
      deliveryType: DeliveryType.SAME_DAY,
      currency: "ZAR",
      customerId,
      deliveryRegionId: regionId,
      recipientName: "Phase Seven",
      recipientPhone: "+27110000000",
      parcelCount: 1,
      priceEstimate: "125.00",
      pricingSubtotal: "100.00",
      pricingTaxAmount: "25.00",
      pricingTaxRate: "0.2500",
      pricingSnapshot: { suite: "phase7-5", tag, total: "125.00" },
    },
  });
  await seedVerifiedPaidOrderEvidence(integrationPrisma, {
    orderId: order.id,
    amount: "125.00",
    customerId,
    tag,
  });
  return order;
}

export function baseOrderInput(): CreateOrderInput {
  return {
    pricingQuoteId: "placeholder",
    deliveryType: DeliveryType.SAME_DAY,
    pickupAddress: {
      contactName: "Sender",
      contactPhone: "+27110000000",
      line1: "101 Integration Pickup Road",
      city: "Johannesburg",
      province: "Gauteng",
      country: "South Africa",
      latitude: -26.2041,
      longitude: 28.0473,
    },
    dropoffAddress: {
      contactName: "Recipient",
      contactPhone: "+27110000001",
      line1: "202 Integration Dropoff Road",
      city: "Johannesburg",
      province: "Gauteng",
      country: "South Africa",
      latitude: -26.1,
      longitude: 28.1,
    },
    recipientName: "Recipient",
    recipientPhone: "+27110000001",
    parcelCount: 1,
  };
}

export async function createPersistedQuote(owner: AuthenticatedUser, tag: string, options: { expiresAt?: Date; total?: string } = {}) {
  const rule = await integrationPrisma.pricingRule.create({
    data: {
      name: `${tag} rule`,
      type: PricingRuleType.FLAT,
      deliveryType: DeliveryType.SAME_DAY,
      amount: "100.00",
      baseFee: "100.00",
      perKmRate: "0.0000",
      includedDistanceKm: "0.0000",
      distanceIncrementKm: "0.1000",
      priority: 1000 + Math.floor(Math.random() * 1_000_000),
      active: true,
      currency: "ZAR",
    },
  });
  const input = baseOrderInput();
  const total = options.total ?? "115.00";
  const quote = await integrationPrisma.pricingQuote.create({
    data: {
      status: PricingQuoteStatus.ACTIVE,
      ownerType: owner.role === UserRole.STORE ? PricingQuoteOwnerType.STORE : PricingQuoteOwnerType.CUSTOMER,
      ownerId: owner.id,
      deliveryType: input.deliveryType,
      currency: "ZAR",
      calculationVersion: "pricing-v1",
      inputHash: hashPricingInput(pricingInputSnapshot(input)),
      distanceMeters: 5000,
      durationSeconds: 900,
      routeProvider: "integration",
      ruleId: rule.id,
      rawDistanceKm: "5.0000",
      billableDistanceKm: "5.0000",
      subtotal: "100.00",
      taxRate: "0.1500",
      taxAmount: "15.00",
      total,
      inputSnapshot: pricingInputSnapshot(input),
      ruleSnapshot: { id: rule.id, revision: 1, baseFee: "100.00" },
      regionSnapshot: { originRegionId: null, destinationRegionId: null },
      taxSnapshot: { enabled: true, rate: "0.1500" },
      expiresAt: options.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      lineItems: {
        create: [
          { code: PricingLineItemCode.BASE_FEE, label: "Base fee", amount: "100.00", currency: "ZAR" },
          { code: PricingLineItemCode.VAT, label: "VAT", amount: "15.00", currency: "ZAR" },
        ],
      },
    },
    include: { lineItems: true },
  });
  return { quote, rule, input: { ...input, pricingQuoteId: quote.id } };
}

export async function disconnectIntegrationPrisma() {
  await integrationPrisma.$disconnect();
}
