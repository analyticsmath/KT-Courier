import type { Prisma } from "@prisma/client";
import { PROVINCES } from "@/lib/client-platform/contracts";
import { regionBoundaryIssues, type RegionBoundary } from "@/lib/maps/region-boundaries";

export type CodPolicyRowCandidate = Readonly<{
  id: string;
  status: string;
  mode: string;
  storeId: string | null;
  orderType: string | null;
  depositPercent: Prisma.Decimal | null;
  depositAmount: Prisma.Decimal | null;
  deliveryServiceId: string | null;
  regionId: string | null;
  provinceScope: unknown;
  maximumCodAmount: Prisma.Decimal | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  createdByUserId: string | null;
  policyEvidence: unknown;
}>;

export type CodServiceSnapshot = Readonly<{
  stableKey: string;
  status: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
}>;

export type CodRegionSnapshot = RegionBoundary &
  Readonly<{
    id: string;
    active: boolean;
    pricingEnabled?: boolean;
  }>;

export type CodBankSnapshot = Readonly<{
  valid: boolean;
  updatedAtIso: string | null;
  updatedByUserId?: string | null;
}>;

function isUsableRegion(region: CodRegionSnapshot | undefined): region is CodRegionSnapshot {
  return Boolean(region && region.active && region.pricingEnabled !== false && regionBoundaryIssues(region).length === 0);
}

function isCanonicalDepositHalf(value: Prisma.Decimal | null): boolean {
  if (!value) return false;
  const text = value.toString().trim();
  const numeric = Number(text);
  return Number.isFinite(numeric) && numeric === 0.5 && /^0\.50*$/.test(text);
}

export function evaluateCodPolicyReadiness<T extends CodPolicyRowCandidate>(
  rows: readonly T[],
  context: {
    activeServicesByKey: ReadonlyMap<string, CodServiceSnapshot> | null;
    regionsById: ReadonlyMap<string, CodRegionSnapshot> | null;
    bank: CodBankSnapshot;
    now: Date;
  },
) {
  const eligible: T[] = [];
  const rejectedReasons: Array<{ policyId: string; reason: string }> = [];

  for (const r of rows) {
    if (
      (r.status != null && r.status !== "ACTIVE") ||
      r.mode !== "DEPOSIT_PLUS_COD" ||
      r.storeId != null ||
      r.orderType !== "PARCEL_DOCUMENT" ||
      (r.effectiveFrom != null && r.effectiveFrom > context.now) ||
      (r.effectiveTo != null && r.effectiveTo <= context.now)
    ) {
      rejectedReasons.push({ policyId: r.id, reason: "INACTIVE_OR_OUT_OF_SCOPE" });
      continue;
    }

    const maxCod = r.maximumCodAmount == null ? Number.NaN : Number(r.maximumCodAmount.toString());
    if (!isCanonicalDepositHalf(r.depositPercent) || r.depositAmount != null || !Number.isFinite(maxCod) || maxCod <= 0) {
      rejectedReasons.push({ policyId: r.id, reason: "INVALID_FIFTY_FIFTY_SPLIT_OR_LIMIT" });
      continue;
    }

    if (!r.deliveryServiceId) {
      rejectedReasons.push({ policyId: r.id, reason: "MISSING_DELIVERY_SERVICE" });
      continue;
    }
    if (!context.activeServicesByKey) {
      rejectedReasons.push({ policyId: r.id, reason: "DELIVERY_SERVICE_UNAVAILABLE" });
      continue;
    }
    const service = context.activeServicesByKey.get(r.deliveryServiceId);
    if (
      !service ||
      service.status !== "ACTIVE" ||
      service.effectiveFrom > context.now ||
      (service.effectiveTo !== null && service.effectiveTo <= context.now)
    ) {
      rejectedReasons.push({ policyId: r.id, reason: "DELIVERY_SERVICE_INACTIVE" });
      continue;
    }

    if (r.provinceScope != null && !Array.isArray(r.provinceScope)) {
      rejectedReasons.push({ policyId: r.id, reason: "INVALID_PROVINCE_SCOPE" });
      continue;
    }
    const rawProvinces = Array.isArray(r.provinceScope) ? r.provinceScope : [];
    const hasInvalidProvince = rawProvinces.some(
      (p) => typeof p !== "string" || !PROVINCES.some((canon) => canon === p),
    );
    if (hasInvalidProvince) {
      rejectedReasons.push({ policyId: r.id, reason: "INVALID_PROVINCE_SCOPE" });
      continue;
    }
    const provinces = rawProvinces as string[];
    if (!r.regionId && provinces.length === 0) {
      rejectedReasons.push({ policyId: r.id, reason: "MISSING_REGION_OR_PROVINCE_SCOPE" });
      continue;
    }
    if (!context.regionsById) {
      rejectedReasons.push({ policyId: r.id, reason: "DELIVERY_REGION_UNUSABLE" });
      continue;
    }
    if (r.regionId) {
      const region = context.regionsById.get(r.regionId);
      if (!isUsableRegion(region) || (provinces.length > 0 && (!region.province || !provinces.includes(region.province)))) {
        rejectedReasons.push({ policyId: r.id, reason: "DELIVERY_REGION_UNUSABLE" });
        continue;
      }
    }
    if (provinces.length > 0) {
      const usableRegions = [...context.regionsById.values()].filter((region) => isUsableRegion(region));
      const allProvincesCovered = provinces.every((province) =>
        usableRegions.some((region) => region.province === province),
      );
      if (!allProvincesCovered) {
        rejectedReasons.push({ policyId: r.id, reason: "DELIVERY_REGION_UNUSABLE" });
        continue;
      }
    }

    const evidence = r.policyEvidence as {
      approvedByUserId?: string;
      approvedAt?: string;
      remittanceApproved?: boolean;
      remittanceUpdatedAt?: string;
      settlementTiming?: string;
    } | null;

    const approvedAtMs = typeof evidence?.approvedAt === "string" ? Date.parse(evidence.approvedAt) : Number.NaN;
    const remittanceAtMs = typeof evidence?.remittanceUpdatedAt === "string" ? Date.parse(evidence.remittanceUpdatedAt) : Number.NaN;
    const nowMs = context.now.getTime();
    if (
      !context.bank.valid ||
      !evidence?.approvedByUserId ||
      evidence.approvedByUserId === r.createdByUserId ||
      (context.bank.updatedByUserId && evidence.approvedByUserId === context.bank.updatedByUserId) ||
      !Number.isFinite(approvedAtMs) ||
      approvedAtMs > nowMs ||
      !Number.isFinite(remittanceAtMs) ||
      remittanceAtMs > approvedAtMs ||
      evidence.remittanceApproved !== true ||
      typeof evidence.settlementTiming !== "string" ||
      evidence.settlementTiming.trim().length === 0 ||
      !context.bank.updatedAtIso ||
      context.bank.updatedAtIso !== evidence.remittanceUpdatedAt
    ) {
      rejectedReasons.push({ policyId: r.id, reason: "GOVERNANCE_OR_REMITTANCE_EVIDENCE_INCOMPLETE" });
      continue;
    }

    eligible.push(r);
  }

  return Object.freeze({
    eligible: Object.freeze(eligible),
    rejectedReasons: Object.freeze(rejectedReasons),
  });
}
