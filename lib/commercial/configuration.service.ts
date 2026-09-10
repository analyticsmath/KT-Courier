import { CommercialSurchargeCalculationType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type AppliedCommercialSurcharge = Readonly<{
  id: string;
  stableKey: string;
  versionNumber: number;
  calculationType: CommercialSurchargeCalculationType;
  value: Prisma.Decimal;
  reason: string;
  customerMessage: string | null;
  priority: number;
}>;

function hasScope(scope: unknown, value: string | null | undefined) {
  if (!Array.isArray(scope) || scope.length === 0) return true;
  return !!value && scope.some((entry) => entry === value);
}

/** Returns only effective, enabled surcharges; it never modifies their base pricing rule. */
export async function activeCommercialSurcharges(input: {
  serviceKey?: string | null;
  moduleId?: string | null;
  regionId?: string | null;
  now?: Date;
}): Promise<AppliedCommercialSurcharge[]> {
  const now = input.now ?? new Date();
  const candidates = await prisma.commercialSurcharge.findMany({
    where: {
      enabled: true,
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
    orderBy: [{ priority: "asc" }, { stableKey: "asc" }, { versionNumber: "desc" }],
  });
  return candidates
    .filter((surcharge) => hasScope(surcharge.serviceScope, input.serviceKey))
    .filter((surcharge) => hasScope(surcharge.moduleScope, input.moduleId))
    .filter((surcharge) => hasScope(surcharge.regionScope, input.regionId))
    .map((surcharge) => ({
      id: surcharge.id,
      stableKey: surcharge.stableKey,
      versionNumber: surcharge.versionNumber,
      calculationType: surcharge.calculationType,
      value: surcharge.value,
      reason: surcharge.reason,
      customerMessage: surcharge.customerMessage,
      priority: surcharge.priority,
    }));
}

/** JSON-safe evidence to persist with an accepted quote/order. */
export function commercialSurchargeSnapshot(surcharges: readonly AppliedCommercialSurcharge[]) {
  return surcharges.map((surcharge) => ({
    id: surcharge.id,
    stableKey: surcharge.stableKey,
    versionNumber: surcharge.versionNumber,
    calculationType: surcharge.calculationType,
    value: surcharge.value.toString(),
    reason: surcharge.reason,
    customerMessage: surcharge.customerMessage,
    priority: surcharge.priority,
  }));
}

// ─── 1. Company Profile Authority ──────────────────────────────────────────

export interface PhysicalAddress {
  line1: string;
  line2?: string | null;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface ActiveCompanyProfile {
  id: string;
  publicReference: string;
  versionNumber: number;
  legalName: string;
  tradingName: string | null;
  registrationNumber: string | null;
  vatNumber: string | null;
  physicalAddress: PhysicalAddress | null;
  supportEmail: string | null;
  businessEmail: string | null;
  telephoneNumbers: readonly string[];
  website: string | null;
  effectiveAt: Date | null;
}

/**
 * Returns the single authoritative active CompanyProfileVersion.
 * Note: Physical address is kept distinct from communication emails (POPIA / commercial isolation).
 */
export async function getActiveCompanyProfile(now?: Date): Promise<ActiveCompanyProfile | null> {
  const at = now ?? new Date();
  const profile = await prisma.companyProfileVersion.findFirst({
    where: {
      status: "ACTIVE",
      effectiveAt: { lte: at },
    },
    orderBy: { versionNumber: "desc" },
  });
  if (!profile) return null;

  const rawAddress = profile.physicalAddress as Record<string, unknown> | null;
  const physicalAddress: PhysicalAddress | null = rawAddress ? {
    line1: String(rawAddress.line1 ?? ""),
    line2: rawAddress.line2 ? String(rawAddress.line2) : null,
    city: String(rawAddress.city ?? ""),
    province: String(rawAddress.province ?? ""),
    postalCode: String(rawAddress.postalCode ?? ""),
    country: String(rawAddress.country ?? "South Africa"),
  } : null;

  const rawTelephones = Array.isArray(profile.telephoneNumbers)
    ? (profile.telephoneNumbers as unknown[]).map(String)
    : [];

  return Object.freeze({
    id: profile.id,
    publicReference: profile.publicReference,
    versionNumber: profile.versionNumber,
    legalName: profile.legalName,
    tradingName: profile.tradingName,
    registrationNumber: profile.registrationNumber,
    vatNumber: profile.vatNumber,
    physicalAddress: physicalAddress ? Object.freeze(physicalAddress) : null,
    supportEmail: profile.supportEmail,
    businessEmail: profile.businessEmail,
    telephoneNumbers: Object.freeze(rawTelephones),
    website: profile.website,
    effectiveAt: profile.effectiveAt,
  });
}

// ─── 2. Parcel Profile Authority ────────────────────────────────────────────

export interface ActiveParcelProfile {
  id: string;
  stableKey: string;
  versionNumber: number;
  displayName: string;
  lengthCm: Prisma.Decimal | null;
  widthCm: Prisma.Decimal | null;
  heightCm: Prisma.Decimal | null;
  maximumWeightKg: Prisma.Decimal | null;
  sortOrder: number;
}

const INACTIVE_EXPRESS_PROFILE_KEYS = new Set([
  "express_s", "express_m", "express_l",
  "EXPRESS_S", "EXPRESS_M", "EXPRESS_L",
  "express-s", "express-m", "express-l",
]);

/**
 * Returns active parcel profiles.
 * Explicit Directive: Express S/M/L profiles remain inactive.
 */
export async function getActiveParcelProfiles(now?: Date): Promise<ActiveParcelProfile[]> {
  const at = now ?? new Date();
  const candidates = await prisma.parcelProfileVersion.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: [{ sortOrder: "asc" }, { stableKey: "asc" }, { versionNumber: "desc" }],
  });

  return candidates
    .filter((p) => !INACTIVE_EXPRESS_PROFILE_KEYS.has(p.stableKey))
    .map((p) => Object.freeze({
      id: p.id,
      stableKey: p.stableKey,
      versionNumber: p.versionNumber,
      displayName: p.displayName,
      lengthCm: p.lengthCm,
      widthCm: p.widthCm,
      heightCm: p.heightCm,
      maximumWeightKg: p.maximumWeightKg,
      sortOrder: p.sortOrder,
    }));
}

// ─── 3. Delivery Service Definition Authority ───────────────────────────────

export interface ActiveDeliveryService {
  id: string;
  stableKey: string;
  versionNumber: number;
  displayName: string;
  operationalMode: string;
  launchScope: string;
  slaMetadata: unknown;
  coveragePolicy: unknown;
  sortOrder: number;
}

export async function getActiveDeliveryServices(now?: Date): Promise<ActiveDeliveryService[]> {
  const at = now ?? new Date();
  const services = await prisma.deliveryServiceDefinition.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: [{ sortOrder: "asc" }, { stableKey: "asc" }, { versionNumber: "desc" }],
  });

  return services.map((s) => Object.freeze({
    id: s.id,
    stableKey: s.stableKey,
    versionNumber: s.versionNumber,
    displayName: s.displayName,
    operationalMode: s.operationalMode,
    launchScope: s.launchScope,
    slaMetadata: s.slaMetadata,
    coveragePolicy: s.coveragePolicy,
    sortOrder: s.sortOrder,
  }));
}

export async function resolveDeliveryService(stableKey: string, now?: Date): Promise<ActiveDeliveryService | null> {
  const at = now ?? new Date();
  const service = await prisma.deliveryServiceDefinition.findFirst({
    where: {
      stableKey,
      status: "ACTIVE",
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    orderBy: { versionNumber: "desc" },
  });
  if (!service) return null;

  return Object.freeze({
    id: service.id,
    stableKey: service.stableKey,
    versionNumber: service.versionNumber,
    displayName: service.displayName,
    operationalMode: service.operationalMode,
    launchScope: service.launchScope,
    slaMetadata: service.slaMetadata,
    coveragePolicy: service.coveragePolicy,
    sortOrder: service.sortOrder,
  });
}

// ─── 4. Business Module Authority ──────────────────────────────────────────

export interface ActiveBusinessModule {
  id: string;
  code: string;
  displayName: string;
  kind: string;
  sortOrder: number;
  storeOnboardingEnabled: boolean;
  commercialPolicy: unknown;
}

export async function getActiveBusinessModules(): Promise<ActiveBusinessModule[]> {
  const modules = await prisma.businessModule.findMany({
    where: {
      enabled: true,
      publicEnabled: true,
      archivedAt: null,
    },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
  });

  return modules.map((m) => Object.freeze({
    id: m.id,
    code: m.code,
    displayName: m.displayName,
    kind: m.kind,
    sortOrder: m.sortOrder,
    storeOnboardingEnabled: m.storeOnboardingEnabled,
    commercialPolicy: m.commercialPolicy,
  }));
}

// ─── 5. Payment Method Policy Authority ────────────────────────────────────

export interface ActivePaymentMethodPolicy {
  id: string;
  versionNumber: number;
  mode: string;
  depositAmount: Prisma.Decimal | null;
  depositPercent: Prisma.Decimal | null;
  maximumCodAmount: Prisma.Decimal | null;
  policyEvidence: unknown;
}

export async function getActivePaymentMethodPolicy(input: {
  businessModuleId?: string | null;
  storeId?: string | null;
  deliveryServiceId?: string | null;
  orderType?: string | null;
  now?: Date;
} = {}): Promise<ActivePaymentMethodPolicy | null> {
  const at = input.now ?? new Date();
  const policy = await prisma.paymentMethodPolicy.findFirst({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      ...(input.businessModuleId ? { OR: [{ businessModuleId: null }, { businessModuleId: input.businessModuleId }] } : {}),
      ...(input.storeId ? { OR: [{ storeId: null }, { storeId: input.storeId }] } : {}),
      ...(input.deliveryServiceId ? { OR: [{ deliveryServiceId: null }, { deliveryServiceId: input.deliveryServiceId }] } : {}),
      ...(input.orderType ? { OR: [{ orderType: null }, { orderType: input.orderType }] } : {}),
    },
    orderBy: [{ versionNumber: "desc" }],
  });
  if (!policy) return null;

  return Object.freeze({
    id: policy.id,
    versionNumber: policy.versionNumber,
    mode: policy.mode,
    depositAmount: policy.depositAmount,
    depositPercent: policy.depositPercent,
    maximumCodAmount: policy.maximumCodAmount,
    policyEvidence: policy.policyEvidence,
  });
}
