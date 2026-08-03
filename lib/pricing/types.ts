import type { Prisma, DeliveryType, VehicleType, PricingLineItemCode } from "@/types/db";

export type PricingRuleSnapshot = {
  id: string;
  revision: number;
  currency: "ZAR";
  deliveryType: DeliveryType | null;
  regionId: string | null;
  baseFee: Prisma.Decimal;
  perKmRate: Prisma.Decimal;
  includedDistanceKm: Prisma.Decimal;
  distanceIncrementKm: Prisma.Decimal;
  minimumCharge: Prisma.Decimal | null;
  flatSurcharge: Prisma.Decimal | null;
  vehicleClass: VehicleType | null;
  vehicleSurcharge: Prisma.Decimal | null;
  includedWeightKg: Prisma.Decimal | null;
  perAdditionalKgRate: Prisma.Decimal | null;
  maximumWeightKg: Prisma.Decimal | null;
  weightIncrementKg: Prisma.Decimal | null;
  dimensionalPricingEnabled: boolean;
  volumetricDivisor: Prisma.Decimal | null;
  maxDistanceKm: Prisma.Decimal | null;
};

export type NormalizedPricingInput = {
  deliveryType: DeliveryType;
  distanceMeters: number;
  durationSeconds: number | null;
  vehicleClass: VehicleType | null;
  actualWeightKg: Prisma.Decimal | null;
  lengthCm: Prisma.Decimal | null;
  widthCm: Prisma.Decimal | null;
  heightCm: Prisma.Decimal | null;
};

export type PricingRegionContext = {
  origin: { id: string; highRiskSurcharge: Prisma.Decimal | null } | null;
  destination: { id: string; highRiskSurcharge: Prisma.Decimal | null } | null;
};

export type PricingTaxConfig = { enabled: boolean; rate: Prisma.Decimal; source: string };

export type PricingCalculationLineItem = {
  code: PricingLineItemCode;
  label: string;
  quantity: Prisma.Decimal | null;
  unitRate: Prisma.Decimal | null;
  amount: Prisma.Decimal;
  metadata?: Record<string, string | string[] | boolean>;
};

export type PricingCalculationResult = {
  calculationVersion: string;
  currency: "ZAR";
  rawDistanceKm: Prisma.Decimal;
  billableDistanceKm: Prisma.Decimal;
  actualWeightKg: Prisma.Decimal | null;
  volumetricWeightKg: Prisma.Decimal | null;
  chargeableWeightKg: Prisma.Decimal | null;
  lineItems: PricingCalculationLineItem[];
  subtotal: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  total: Prisma.Decimal;
};
