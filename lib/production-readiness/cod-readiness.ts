import type { Prisma } from "@prisma/client";
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
  }>;

export type CodBankSnapshot = Readonly<{
  valid: boolean;
  updatedAtIso: string | null;
  updatedByUserId?: string | null;
}>;

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

    const depositPercent = r.depositPercent?.toString();
    if ((depositPercent !== "0.5" && depositPercent !== "0.5000") || r.depositAmount != null || Number(r.maximumCodAmount ?? 0) <= 0) {
      rejectedReasons.push({ policyId: r.id, reason: "INVALID_FIFTY_FIFTY_SPLIT_OR_LIMIT" });
      continue;
    }

    if (!r.deliveryServiceId) {
      rejectedReasons.push({ policyId: r.id, reason: "MISSING_DELIVERY_SERVICE" });
      continue;
    }
    if (context.activeServicesByKey) {
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
    }

    const provinces = Array.isArray(r.provinceScope) ? r.provinceScope.filter((p): p is string => typeof p === "string" && p.trim().length > 0) : [];
    if (!r.regionId && provinces.length === 0) {
      rejectedReasons.push({ policyId: r.id, reason: "MISSING_REGION_OR_PROVINCE_SCOPE" });
      continue;
    }
    if (r.regionId && context.regionsById) {
      const region = context.regionsById.get(r.regionId);
      if (!region || !region.active || regionBoundaryIssues(region).length > 0) {
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

    if (
      !context.bank.valid ||
      !evidence?.approvedByUserId ||
      evidence.approvedByUserId === r.createdByUserId ||
      (context.bank.updatedByUserId && evidence.approvedByUserId === context.bank.updatedByUserId) ||
      !evidence.approvedAt ||
      evidence.remittanceApproved !== true ||
      !evidence.settlementTiming ||
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
