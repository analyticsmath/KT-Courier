import { PrismaClient } from "@prisma/client";
import {
  DeliveryType,
  DriverAvailability,
  DriverStatus,
  OrderSource,
  OrderStatus,
  PricingLineItemCode,
  PricingQuoteOwnerType,
  PricingQuoteStatus,
  PricingRuleType,
  UserRole,
  UserStatus,
} from "@/types/db";
import type { AuthenticatedUser } from "@/types/domain";
import type { CreateOrderInput } from "@/lib/validation/order";
import { hashPricingInput, pricingInputSnapshot } from "@/lib/pricing/input-hash";

export const integrationPrisma = new PrismaClient();

export function uniqueTag(prefix = "p75") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function createUser(tag: string, role: UserRole, status = UserStatus.ACTIVE): Promise<AuthenticatedUser> {
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
  return { user, profile };
}

export async function createDispatchOrder(tag: string, customerId: string, regionId: string) {
  return integrationPrisma.order.create({
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
