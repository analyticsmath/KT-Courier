import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { priceForOrderQuantity, type VolumePriceTier } from "@/lib/catalog/volume-pricing";
import { calculateCommission } from "@/lib/commissions/commission-calculator";
import { deliveryCatalog } from "@/lib/client-platform/delivery.service";
import type { DeliveryConfiguration } from "@/lib/client-platform/contracts";
import { revalidateMarketplaceCheckout } from "@/lib/marketplace-checkout/checkout-review.service";
import { calculateMarketplaceCourierTariff } from "@/lib/marketplace-checkout/courier-tariff-calculation";
import { marketplaceCourierTariffPolicy } from "@/lib/marketplace-checkout/courier-tariff-policy";
import { selectMarketplaceDeliveryPolicy } from "@/lib/marketplace-checkout/delivery-policy";
import { listDeliveryMatrices } from "@/lib/marketplace-checkout/delivery-policy-configuration";
import type { ParcelLimits, TrustedPackageVersion } from "@/lib/marketplace-checkout/parcel-classification";
import {
  assertCheckoutTotals,
  assertSettlementArithmetic,
  centsToZar,
  parseZarToCents,
  sellerBasis,
} from "@/lib/marketplace-checkout/policy";
import { calculateDeliveryPrice } from "@/lib/pricing/calculator";
import { getPricingConfiguration } from "@/lib/pricing/config";
import { activePersonalizedDeliveryRate } from "@/lib/pricing/personalized-delivery-rates";
import { zarToSubunitCents } from "@/lib/payments/providers/paystack/paystack-client";
import { createProductionPaymentProviderRegistry } from "@/lib/payments/providers/payment-provider-registry";
import { evaluatePaystackCheckoutReadiness } from "@/lib/payments/providers/paystack/paystack-config";
import {
  computePaystackHmacSha512,
  verifyPaystackSignature,
} from "@/lib/payments/providers/paystack/paystack-signature";
import { PaystackChargeSuccessPayloadSchema } from "@/lib/services/paystack-webhook-application.service";
import { getGlobalCommercePolicyRevision } from "./commerce-readiness-revision";
import {
  selectEligibleSellableOffersForStore,
  type EligibleProofOffer,
} from "./store-sellable-offer-proof";

export const REAL_CHECKOUT_PROOF_EVIDENCE_TYPE =
  "REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF" as const;
export const OFFLINE_ENGINE_COMPONENT_TEST_EVIDENCE_TYPE =
  "OFFLINE_ENGINE_COMPONENT_TEST" as const;

export const STORE_CHECKOUT_ENGINE_PROOF_SUITE_SHA = createHash("sha256")
  .update(
    "kt-store-checkout-engine-proof:v2:real-offer+real-quote+hold+payment-plan+commission-calc+negative-guards",
  )
  .digest("hex");

export class StoreCheckoutProofError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly blockers: readonly string[] = [],
  ) {
    super(message);
    this.name = "StoreCheckoutProofError";
  }
}

export type StoreCheckoutEngineStageName =
  | "CONFIG_SNAPSHOT"
  | "CHECKOUT_REVIEW_AND_QUOTE"
  | "STOCK_HOLD_RESERVATION"
  | "OFFLINE_WEBHOOK_HMAC_VERIFICATION"
  | "ORDER_AND_COMMISSION_PROJECTION"
  | "NEGATIVE_REJECTION_GUARDS";

export interface StoreCheckoutEngineStageResult {
  readonly stage: StoreCheckoutEngineStageName;
  readonly passed: boolean;
  readonly summary: string;
  readonly durationMs: number;
}

export type ProofServiceCatalogEntry = Readonly<{
  readonly id: string;
  readonly key?: string;
  readonly stableKey?: string;
  readonly version: number;
  readonly active: boolean;
  readonly provinces: readonly string[];
  readonly regionIds: readonly string[];
  readonly baseFee?: number;
  readonly perKmRate?: number;
  readonly minFee?: number;
  readonly maxFee?: number | null;
  readonly tariffs?: DeliveryConfiguration["tariffs"];
}>;

export interface StoreCheckoutEngineProofInput {
  readonly storeId: string;
  readonly pickupAddressId: string;
  readonly pickupFingerprint?: string;
  readonly coverageRegionId: string;
  readonly coverageRegionName: string | null;
  readonly pickupProvince?: string | null;
  readonly matchingServiceVersions?: readonly string[];
  readonly serviceSignature?: string;
  readonly routeDistanceMeters: number;
  readonly routeDurationSeconds?: number;
  readonly routeSummary?: string;
  readonly serviceKey?: string;
  readonly serviceName?: string;
  readonly serviceVersion?: number;
  readonly sellerIdentityReference?: string | null;
  readonly sellerIdentityVersion?: string | null;
  readonly operationalPolicyReference?: string | null;
  readonly commissionPlanReference?: string | null;
  readonly serviceCatalog?: readonly ProofServiceCatalogEntry[];
  readonly paymentProviderReadiness?: ReadonlyArray<{
    code: string;
    configured: boolean;
    active: boolean;
    environment: string;
    errorCategory: string;
  }>;
  readonly trustedPackageVersions?: TrustedPackageVersion[];
  readonly activeParcelProfiles?: ParcelLimits[];
  readonly now?: Date;
}

export interface StoreCheckoutEngineProofMetadata {
  readonly offerReference: string;
  readonly productReference: string;
  readonly variantReference: string;
  readonly priceVersionReference: string;
  readonly quantity: number;
  readonly unitPriceZar: string;
  readonly deliveryFeeZar: string;
  readonly grandTotalZar: string;
  readonly parcelClass: string | null;
  readonly tariffSource: string;
  readonly commissionPlanReference: string;
  readonly commissionAmountZar: string;
  readonly storeEarningZar: string;
  readonly sellerVatStatus: string;
  readonly marketplaceVatEnabled: boolean;
}

export interface StoreCheckoutEngineProofResult {
  readonly passed: boolean;
  readonly evidenceType: typeof REAL_CHECKOUT_PROOF_EVIDENCE_TYPE;
  readonly suiteSha: string;
  readonly policyFingerprint: string;
  readonly engineProofReference: string;
  readonly engineProofDigest: string;
  readonly sourceCommerceReadinessRevision: number;
  readonly globalPolicyRevision: number;
  readonly proofOfferReference: string;
  readonly proofPriceVersionReference: string;
  readonly proofMetadata: StoreCheckoutEngineProofMetadata;
  readonly stageResults: readonly StoreCheckoutEngineStageResult[];
  readonly redactedSnapshot: {
    readonly storeId: string;
    readonly storeStatus: string;
    readonly coverageRegionId: string;
    readonly matchingServiceVersions: readonly string[];
    readonly catalogOfferCount: number;
    readonly catalogMode: "STORE_OFFER";
  };
  readonly failedStage: StoreCheckoutEngineStageName | null;
  readonly failureMessage: string | null;
  readonly syntheticRowsRemaining: number;
}

export function computeStorePolicyFingerprint(
  input: Readonly<{
    pickupAddressId: string | null;
    pickupFingerprint: string | null;
    coverageRegionId: string | null;
    serviceSignature: string | null;
    sellerIdentityReference: string | null;
    sellerIdentityVersion: string | null;
    operationalPolicyReference: string | null;
    commissionPlanReference: string | null;
    sourceCommerceReadinessRevision?: number | null;
    globalPolicyRevision?: number | null;
    proofOfferReference?: string | null;
    proofPriceVersionReference?: string | null;
  }>,
): string | null {
  if (
    !input.pickupAddressId ||
    !input.pickupFingerprint ||
    !input.coverageRegionId ||
    !input.serviceSignature
  ) {
    return null;
  }
  return createHash("sha256")
    .update(
      JSON.stringify({
        pickupAddressId: input.pickupAddressId,
        pickupFingerprint: input.pickupFingerprint,
        coverageRegionId: input.coverageRegionId,
        serviceSignature: input.serviceSignature,
        sellerIdentityReference: input.sellerIdentityReference,
        sellerIdentityVersion: input.sellerIdentityVersion,
        operationalPolicyReference: input.operationalPolicyReference,
        commissionPlanReference: input.commissionPlanReference,
        ...(input.sourceCommerceReadinessRevision !== undefined
          ? { sourceCommerceReadinessRevision: input.sourceCommerceReadinessRevision }
          : {}),
        ...(input.globalPolicyRevision !== undefined
          ? { globalPolicyRevision: input.globalPolicyRevision }
          : {}),
        ...(input.proofOfferReference !== undefined
          ? { proofOfferReference: input.proofOfferReference }
          : {}),
        ...(input.proofPriceVersionReference !== undefined
          ? { proofPriceVersionReference: input.proofPriceVersionReference }
          : {}),
      }),
    )
    .digest("hex");
}

async function resolveRealProofDeliveryQuote(
  tx: Prisma.TransactionClient,
  input: Readonly<{
    storeId: string;
    pickupProvince: string;
    coverageRegionId: string;
    routeDistanceMeters: number;
    routeDurationSeconds: number;
    offer: EligibleProofOffer;
    serviceCatalog?: readonly ProofServiceCatalogEntry[];
    now: Date;
  }>,
): Promise<{
  feeZar: string;
  quoteReference: string;
  quoteVersion: string;
  serviceLevel: string;
  tariffSource: string;
}> {
  if (input.offer.fulfilmentMode === "STORE_PICKUP") {
    return {
      feeZar: "0.00",
      quoteReference: `PROOF-PICKUP-${input.storeId.slice(0, 8)}`,
      quoteVersion: "store-pickup-v1",
      serviceLevel: "STORE_PICKUP",
      tariffSource: "STORE_PICKUP",
    };
  }

  const parcel = input.offer.parcelClassification;
  if (!parcel || parcel.status !== "CLASSIFIED" || !parcel.sizeClass || !parcel.weightKg) {
    throw new StoreCheckoutProofError(
      "NO_SELLABLE_OFFER",
      "Courier-delivered proof offer lacks approved trusted packaging classification.",
      ["NO_SELLABLE_OFFER"],
    );
  }

  const [pricingConfig, regionRow, courierPolicy] = await Promise.all([
    getPricingConfiguration("MARKETPLACE"),
    tx.deliveryRegion.findUnique({
      where: { id: input.coverageRegionId },
      select: { id: true, province: true, highRiskSurcharge: true },
    }),
    marketplaceCourierTariffPolicy(),
  ]);

  const effectiveProvince = regionRow?.province ?? input.pickupProvince;
  const regionContextItem = regionRow
    ? { id: regionRow.id, highRiskSurcharge: regionRow.highRiskSurcharge }
    : { id: input.coverageRegionId, highRiskSurcharge: new Prisma.Decimal(0) };
  const regionContext = { origin: regionContextItem, destination: regionContextItem };

  const liveServices = await deliveryCatalog();
  if (courierPolicy) {
    const selected = liveServices.find(
      (service) =>
        service.stableKey === courierPolicy.defaultServiceKey &&
        service.active &&
        (service.provinces as readonly string[]).includes(effectiveProvince) &&
        (!service.regionIds.length || service.regionIds.includes(input.coverageRegionId)),
    ) ?? liveServices.find(
      (service) =>
        service.active &&
        (service.provinces as readonly string[]).includes(effectiveProvince) &&
        (!service.regionIds.length || service.regionIds.includes(input.coverageRegionId)),
    );
    if (selected) {
      const negotiatedRate = await activePersonalizedDeliveryRate(
        { ownerType: "STORE", ownerId: input.storeId },
        selected.stableKey,
        parcel.sizeClass,
      );
      const { calculation } = calculateMarketplaceCourierTariff({
        service: selected,
        parcel,
        distanceMeters: Math.max(1, Math.round(input.routeDistanceMeters)),
        durationSeconds: Math.max(1, Math.round(input.routeDurationSeconds)),
        regionContext,
        tax: pricingConfig.tax,
        negotiatedRate,
      });
      return {
        feeZar: calculation.total.toFixed(2),
        quoteReference: `PROOF-COURIER-${selected.stableKey}-${selected.version}`,
        quoteVersion: String(selected.version),
        serviceLevel: `${selected.displayName} (${selected.stableKey})`,
        tariffSource: "MARKETPLACE_COURIER_TARIFF",
      };
    }
  }

  const matrices = await listDeliveryMatrices();
  const hasActiveMatrix = matrices.some(
    (v) =>
      v.status === "ACTIVE" &&
      v.approvedAt &&
      v.approvedByUserId &&
      v.approvedByUserId !== v.createdByUserId &&
      new Date(v.effectiveFrom) <= input.now &&
      (!v.effectiveTo || new Date(v.effectiveTo) > input.now),
  );
  if (hasActiveMatrix) {
    const tariff = selectMarketplaceDeliveryPolicy(matrices, {
      sizeClass: parcel.sizeClass,
      distanceKm: Math.max(0.1, input.routeDistanceMeters / 1000),
      province: effectiveProvince,
      regionId: input.coverageRegionId,
      storeId: input.storeId,
      highRisk: Number(regionRow?.highRiskSurcharge ?? 0) > 0,
      now: input.now,
    });
    const subtotal = new Prisma.Decimal(tariff.fee);
    const taxRate = pricingConfig.tax.enabled ? pricingConfig.tax.rate : new Prisma.Decimal(0);
    const taxAmount = subtotal
      .mul(taxRate)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    return {
      feeZar: subtotal.add(taxAmount).toFixed(2),
      quoteReference: `PROOF-MATRIX-${tariff.ruleKey}-${tariff.policyVersion}`,
      quoteVersion: String(tariff.policyVersion),
      serviceLevel: "STANDARD",
      tariffSource: "MARKETPLACE_DELIVERY_MATRIX",
    };
  }

  // Fallback ONLY to active DB services or explicit serviceCatalog passed from
  // EvaluatePreflight when testing isolated regions cleanly.
  const fullLiveService = liveServices.find(
    (service) =>
      service.active &&
      (service.provinces as readonly string[]).includes(effectiveProvince) &&
      (!service.regionIds.length || service.regionIds.includes(input.coverageRegionId)),
  );
  if (fullLiveService) {
    const { calculation } = calculateMarketplaceCourierTariff({
      service: fullLiveService,
      parcel,
      distanceMeters: Math.max(1, Math.round(input.routeDistanceMeters)),
      durationSeconds: Math.max(1, Math.round(input.routeDurationSeconds)),
      regionContext,
      tax: pricingConfig.tax,
      negotiatedRate: null,
    });
    return {
      feeZar: calculation.total.toFixed(2),
      quoteReference: `PROOF-SVC-${fullLiveService.stableKey}-${fullLiveService.version}`,
      quoteVersion: String(fullLiveService.version),
      serviceLevel: fullLiveService.stableKey,
      tariffSource: "ACTIVE_COURIER_SERVICE_CATALOG",
    };
  }

  const callerService = (input.serviceCatalog ?? []).find(
    (service) =>
      service.active &&
      service.provinces.includes(effectiveProvince) &&
      (!service.regionIds.length || service.regionIds.includes(input.coverageRegionId)) &&
      (service.tariffs?.[parcel.sizeClass!] != null ||
        typeof service.baseFee === "number"),
  );
  if (callerService) {
    if (callerService.tariffs?.[parcel.sizeClass!]) {
      const t = callerService.tariffs[parcel.sizeClass!];
      const calculation = calculateDeliveryPrice({
        input: {
          deliveryType: "PARCEL_DOCUMENT",
          distanceMeters: Math.max(1, Math.round(input.routeDistanceMeters)),
          durationSeconds: Math.max(1, Math.round(input.routeDurationSeconds)),
          vehicleClass: null,
          actualWeightKg: new Prisma.Decimal(parcel.weightKg),
          lengthCm: null,
          widthCm: null,
          heightCm: null,
        },
        rule: {
          id: callerService.id,
          revision: callerService.version,
          currency: "ZAR",
          deliveryType: "PARCEL_DOCUMENT",
          regionId: input.coverageRegionId,
          baseFee: new Prisma.Decimal(t.baseFee),
          perKmRate: new Prisma.Decimal(t.perKmRate),
          includedDistanceKm: new Prisma.Decimal(0),
          distanceIncrementKm: new Prisma.Decimal("0.001"),
          minimumCharge: t.minimumCharge === null ? null : new Prisma.Decimal(t.minimumCharge),
          flatSurcharge: null,
          vehicleClass: null,
          vehicleSurcharge: null,
          includedWeightKg: null,
          perAdditionalKgRate: null,
          maximumWeightKg: t.maximumWeightKg === null ? null : new Prisma.Decimal(t.maximumWeightKg),
          weightIncrementKg: null,
          dimensionalPricingEnabled: false,
          volumetricDivisor: null,
          maxDistanceKm: null,
        },
        regionContext,
        taxConfig: pricingConfig.tax,
        calculationVersion: "marketplace-proof-service-tariff-v1",
      });
      return {
        feeZar: calculation.total.toFixed(2),
        quoteReference: `PROOF-SVC-${callerService.id}-${callerService.version}`,
        quoteVersion: String(callerService.version),
        serviceLevel: callerService.stableKey ?? callerService.key ?? "STANDARD",
        tariffSource: "VERIFIED_SERVICE_TARIFF",
      };
    }

    const calculation = calculateDeliveryPrice({
      input: {
        deliveryType: "PARCEL_DOCUMENT",
        distanceMeters: Math.max(1, Math.round(input.routeDistanceMeters)),
        durationSeconds: Math.max(1, Math.round(input.routeDurationSeconds)),
        vehicleClass: null,
        actualWeightKg: new Prisma.Decimal(parcel.weightKg),
        lengthCm: null,
        widthCm: null,
        heightCm: null,
      },
      rule: {
        id: callerService.id,
        revision: callerService.version,
        currency: "ZAR",
        deliveryType: "PARCEL_DOCUMENT",
        regionId: input.coverageRegionId,
        baseFee: new Prisma.Decimal(callerService.baseFee ?? 0),
        perKmRate: new Prisma.Decimal(callerService.perKmRate ?? 0),
        includedDistanceKm: new Prisma.Decimal(0),
        distanceIncrementKm: new Prisma.Decimal("0.001"),
        minimumCharge:
          typeof callerService.minFee === "number"
            ? new Prisma.Decimal(callerService.minFee)
            : null,
        flatSurcharge: null,
        vehicleClass: null,
        vehicleSurcharge: null,
        includedWeightKg: null,
        perAdditionalKgRate: null,
        maximumWeightKg: null,
        weightIncrementKg: null,
        dimensionalPricingEnabled: false,
        volumetricDivisor: null,
        maxDistanceKm: null,
      },
      regionContext,
      taxConfig: pricingConfig.tax,
      calculationVersion: "marketplace-proof-service-tariff-v1",
    });
    return {
      feeZar: calculation.total.toFixed(2),
      quoteReference: `PROOF-SVC-${callerService.id}-${callerService.version}`,
      quoteVersion: String(callerService.version),
      serviceLevel: callerService.stableKey ?? callerService.key ?? "STANDARD",
      tariffSource: "VERIFIED_SERVICE_TARIFF",
    };
  }

  throw new StoreCheckoutProofError(
    "DELIVERY_TARIFF_UNAVAILABLE",
    "No active marketplace delivery tariff or courier service rate matches this pickup region.",
    ["SERVICE_INACTIVE"],
  );
}

/**
 * Strictly non-authorizing diagnostic component check for pure domain engines.
 * Never grants live selling authority or satisfies `REAL_STORE_CATALOG_CHECKOUT_CAPABILITY_PROOF`.
 */
export async function runOfflineEngineComponentTest(): Promise<{
  readonly evidenceType: typeof OFFLINE_ENGINE_COMPONENT_TEST_EVIDENCE_TYPE;
  readonly authorizingForLiveSale: false;
  readonly passed: boolean;
}> {
  const payload = JSON.stringify({
    event: "charge.success",
    data: { reference: "diag-component-only", amount: 1000, currency: "ZAR" },
  });
  const secret = `diag_ephemeral_${randomUUID().replaceAll("-", "")}`;
  const sig = computePaystackHmacSha512(payload, secret);
  const hmacOk =
    verifyPaystackSignature(payload, sig, secret) &&
    !verifyPaystackSignature(payload, "0".repeat(128), secret);
  return {
    evidenceType: OFFLINE_ENGINE_COMPONENT_TEST_EVIDENCE_TYPE,
    authorizingForLiveSale: false,
    passed: hmacOk,
  };
}

/**
 * Executes an isolated, single-transaction (SAVEPOINT -> ROLLBACK TO SAVEPOINT)
 * capability proof against the store's real published catalog offer, stock,
 * approved packaging, real commission plan, real delivery tariff, VAT config,
 * and canonical checkout review engine. Persists ZERO residual rows and fails
 * closed with `NO_SELLABLE_OFFER` when no eligible offer exists.
 */
export async function runDisposableStoreCheckoutEngineProof(
  input: StoreCheckoutEngineProofInput,
): Promise<StoreCheckoutEngineProofResult> {
  const now = input.now ?? new Date();
  const stageResults: StoreCheckoutEngineStageResult[] = [];
  const proofCartRef = `PROOF-CART-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const proofCheckoutRef = `PROOF-CHK-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;

  let storeStatus = "UNKNOWN";
  let sourceCommerceReadinessRevision = 1;
  let globalPolicyRevision = 1;
  let catalogOfferCount = 0;
  let proofOffer: EligibleProofOffer | null = null;
  let failedStage: StoreCheckoutEngineStageName | null = null;
  let failureMessage: string | null = null;
  let syntheticRowsRemaining = 0;
  let deliveryFeeZar = "0.00";
  let deliveryTariffSource = "UNKNOWN";
  let commissionPlanReference = input.commissionPlanReference ?? "";
  let commissionAmountZar = "0.00";
  let storeEarningZar = "0.00";
  let grandTotalZar = "0.00";
  let sellerVatStatus = "NOT_REGISTERED";
  let marketplaceVatEnabled = false;
  let thrownTerminalProofError: StoreCheckoutProofError | null = null;

  const runStage = async <T>(
    stage: StoreCheckoutEngineStageName,
    fn: () => Promise<{ summary: string; data: T }>,
  ): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      stageResults.push({
        stage,
        passed: true,
        summary: result.summary,
        durationMs: Math.max(0, Date.now() - start),
      });
      return result.data;
    } catch (err) {
      if (err instanceof StoreCheckoutProofError) {
        thrownTerminalProofError = err;
      }
      const msg = err instanceof Error ? err.message : "Engine proof stage failed.";
      stageResults.push({
        stage,
        passed: false,
        summary: msg,
        durationMs: Math.max(0, Date.now() - start),
      });
      failedStage = stage;
      failureMessage = msg;
      throw err;
    }
  };

  let pickupFingerprint = input.pickupFingerprint ?? null;
  let serviceSignature = input.serviceSignature ?? null;
  let matchingServiceVersions = [...(input.matchingServiceVersions ?? [])];

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${input.storeId} FOR SHARE`,
        );

        await tx.$executeRawUnsafe("SAVEPOINT kt_checkout_engine_proof");

        try {
          const snapshot = await runStage("CONFIG_SNAPSHOT", async () => {
            const store = await tx.store.findUnique({
              where: { id: input.storeId },
              select: {
                id: true,
                status: true,
                province: true,
                commerceReadinessRevision: true,
                defaultPickupAddress: { select: { id: true, province: true } },
              },
            });
            if (!store || !["PENDING", "ACTIVE"].includes(store.status)) {
              throw new StoreCheckoutProofError(
                "STORE_NOT_FOUND",
                "Store is unavailable for capability proof.",
              );
            }
            storeStatus = store.status;
            sourceCommerceReadinessRevision = store.commerceReadinessRevision;
            globalPolicyRevision = await getGlobalCommercePolicyRevision(tx);

            const eligibleOffers = await selectEligibleSellableOffersForStore(
              tx,
              input.storeId,
              now,
              {
                trustedPackageVersions: input.trustedPackageVersions,
                activeParcelProfiles: input.activeParcelProfiles,
              },
            );
            catalogOfferCount = eligibleOffers.length;
            const selectedOffer = eligibleOffers[0];
            if (!selectedOffer) {
              throw new StoreCheckoutProofError(
                "NO_SELLABLE_OFFER",
                "Store has no published, approved, priced, media-ready, in-stock, packaging-verified offer eligible for checkout capability proof.",
                ["NO_SELLABLE_OFFER"],
              );
            }
            proofOffer = selectedOffer;

            const activePlan = await tx.commissionPlan.findFirst({
              where: {
                subjectType: "MARKETPLACE_STORE_ORDER",
                scopeKey: `STORE:${input.storeId}`,
                currency: "ZAR",
                status: "ACTIVE",
                effectiveFrom: { lte: now },
                OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
              },
              orderBy: [{ effectiveFrom: "desc" }, { versionNumber: "desc" }],
              include: { rules: { orderBy: [{ priority: "asc" }, { id: "asc" }] } },
            });
            if (!activePlan || activePlan.rules.length === 0) {
              throw new StoreCheckoutProofError(
                "COMMISSION_PLAN_MISSING",
                "An active approved marketplace commission plan is required before checkout proof can pass.",
                ["POLICY_INACTIVE"],
              );
            }
            commissionPlanReference = activePlan.publicReference;

            const sellerIdentity = await tx.storeSellerLegalIdentity.findFirst({
              where: {
                storeId: input.storeId,
                status: "APPROVED",
                effectiveFrom: { lte: now },
                OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
              },
              orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }],
              select: { vatRegistrationStatus: true, publicReference: true },
            });
            if (!sellerIdentity) {
              throw new StoreCheckoutProofError(
                "UNAPPROVED_SELLER",
                "Approved legal seller identity is required before checkout proof can pass.",
                ["UNAPPROVED_SELLER"],
              );
            }
            sellerVatStatus = sellerIdentity.vatRegistrationStatus;

            const pricingConfig = await getPricingConfiguration("MARKETPLACE");
            marketplaceVatEnabled = pricingConfig.tax.enabled;

            const pickupProvince =
              input.pickupProvince ??
              store.defaultPickupAddress?.province ??
              store.province ??
              "Gauteng";

            if (!matchingServiceVersions.length && input.serviceKey) {
              matchingServiceVersions = [`${input.serviceKey}:${input.serviceVersion ?? 1}`];
            }
            if (!serviceSignature && matchingServiceVersions.length > 0) {
              serviceSignature = createHash("sha256")
                .update(JSON.stringify(matchingServiceVersions))
                .digest("hex");
            }
            if (!pickupFingerprint) {
              pickupFingerprint = createHash("sha256")
                .update(JSON.stringify({ storeId: input.storeId, pickupAddressId: input.pickupAddressId }))
                .digest("hex");
            }

            return {
              summary: `Real offer ${selectedOffer.offerReference} (price ${selectedOffer.priceVersionReference}, ZAR ${selectedOffer.unitPriceZar}, plan ${activePlan.publicReference}) snapshotted at storeRev=${sourceCommerceReadinessRevision}, globalRev=${globalPolicyRevision}.`,
              data: { selectedOffer, activePlan, pickupProvince },
            };
          });

          const selectedOffer = snapshot.selectedOffer;
          const unitDecimal = new Prisma.Decimal(selectedOffer.unitPriceZar);
          const modDecimal = new Prisma.Decimal(selectedOffer.modifierUnitTotalZar);
          const lineTotalZar = unitDecimal
            .add(modDecimal)
            .mul(selectedOffer.quantity)
            .toFixed(2);

          const baseLine = {
            lineReference: "proof-line-1",
            storeReference: input.storeId,
            offerReference: selectedOffer.offerReference,
            variantReference: selectedOffer.variantReference,
            quantity: selectedOffer.quantity,
            priceVersion: selectedOffer.priceVersionReference,
            publicationVersion: String(selectedOffer.offerVersion),
            baseUnitPrice: selectedOffer.unitPriceZar,
            modifierUnitTotal: selectedOffer.modifierUnitTotalZar,
            lineTotal: lineTotalZar,
          };

          const quoteOutcome = await resolveRealProofDeliveryQuote(tx, {
            storeId: input.storeId,
            pickupProvince: snapshot.pickupProvince,
            coverageRegionId: input.coverageRegionId,
            routeDistanceMeters: input.routeDistanceMeters,
            routeDurationSeconds: input.routeDurationSeconds ?? 600,
            offer: selectedOffer,
            serviceCatalog: input.serviceCatalog,
            now,
          });
          deliveryFeeZar = quoteOutcome.feeZar;
          deliveryTariffSource = quoteOutcome.tariffSource;

          const reviewResult = await runStage("CHECKOUT_REVIEW_AND_QUOTE", async () => {
            const res = await revalidateMarketplaceCheckout({
              checkoutId: "proof-chk-id",
              checkoutReference: proofCheckoutRef,
              serviceAreaReference: input.coverageRegionId,
              reviewVersion: 1,
              commissionPolicyVersion: snapshot.activePlan.publicReference,
              groups: [
                {
                  storeReference: input.storeId,
                  pickupLocationReference: input.pickupAddressId,
                  fulfilmentMode: selectedOffer.fulfilmentMode,
                  lines: [baseLine],
                },
              ],
              resolveLine: async (line) => {
                const dbOffer = await tx.storeCatalogOffer.findFirst({
                  where: {
                    storeId: input.storeId,
                    publicReference: line.offerReference,
                    status: "ACTIVE",
                    publicationStatus: "PUBLISHED",
                    variant: { publicReference: line.variantReference, status: "ACTIVE" },
                  },
                  select: { id: true, version: true, currentPriceVersionId: true },
                });
                const dbPrice = dbOffer
                  ? await tx.storeOfferPriceVersion.findFirst({
                      where: {
                        offerId: dbOffer.id,
                        publicReference: line.priceVersion,
                        status: "ACTIVE",
                        currency: "ZAR",
                        effectiveFrom: { lte: now },
                        OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }],
                      },
                    })
                  : null;
                const dbInv = dbOffer
                  ? await tx.catalogInventoryItem.findUnique({
                      where: { offerId: dbOffer.id },
                      include: {
                        levels: { include: { location: { select: { status: true } } } },
                      },
                    })
                  : null;
                const invAvailable = Boolean(
                  dbInv &&
                    (dbInv.trackingMode === "UNTRACKED" ||
                      dbInv.trackingMode === "MADE_TO_ORDER" ||
                      dbInv.allowBackorder ||
                      dbInv.levels.some(
                        (lvl) => lvl.location.status === "ACTIVE" && lvl.available >= line.quantity,
                      )),
                );
                const resolvedUnit = dbPrice
                  ? priceForOrderQuantity(
                      dbPrice.amount.toFixed(2),
                      (dbPrice.volumeTiers ?? []) as VolumePriceTier[],
                      line.quantity,
                    )
                  : line.baseUnitPrice;
                const resolvedTotal = new Prisma.Decimal(resolvedUnit)
                  .add(selectedOffer.modifierUnitTotalZar)
                  .mul(line.quantity)
                  .toFixed(2);
                return {
                  lineReference: line.lineReference,
                  available: Boolean(dbOffer && dbPrice && invAvailable),
                  quantity: line.quantity,
                  priceVersion: dbPrice?.publicReference ?? line.priceVersion,
                  publicationVersion: String(dbOffer?.version ?? line.publicationVersion),
                  baseUnitPrice: resolvedUnit,
                  modifierUnitTotal: selectedOffer.modifierUnitTotalZar,
                  lineTotal: resolvedTotal,
                  modifierValid: true,
                };
              },
              quoteAdapter: {
                async quoteStoreGroup() {
                  return {
                    publicReference: quoteOutcome.quoteReference,
                    version: quoteOutcome.quoteVersion,
                    expiresAt: new Date(now.getTime() + 15 * 60_000),
                    fee: quoteOutcome.feeZar,
                    currency: "ZAR" as const,
                    serviceabilityReference: input.coverageRegionId,
                    serviceLevel: quoteOutcome.serviceLevel,
                  };
                },
              },
            });

            if (res.status !== "READY_FOR_REVIEW") {
              throw new Error(
                `Checkout review returned unexpected status: ${res.status}`,
              );
            }
            assertCheckoutTotals({
              merchandiseSubtotal: res.merchandiseSubtotal,
              modifierSubtotal: res.modifierSubtotal,
              deliveryFeeTotal: res.deliveryFeeTotal,
              promotionDiscount: res.promotionDiscount,
              grandTotal: res.grandTotal,
            });
            grandTotalZar = res.grandTotal;
            return {
              summary: `Real offer review & ${quoteOutcome.tariffSource} quote verified (delivery=ZAR ${res.deliveryFeeTotal}, grandTotal=ZAR ${res.grandTotal}).`,
              data: res,
            };
          });

          await runStage("STOCK_HOLD_RESERVATION", async () => {
            const cart = await tx.marketplaceCart.create({
              data: {
                publicReference: proofCartRef,
                ownerType: "GUEST",
                guestTokenHash: createHash("sha256").update(proofCartRef).digest("hex"),
                serviceAreaReference: input.coverageRegionId,
                status: "ACTIVE",
                currency: "ZAR",
              },
              select: { id: true, version: true },
            });
            const group = await tx.marketplaceCartStoreGroup.create({
              data: {
                cartId: cart.id,
                storeId: input.storeId,
                fulfilmentMode: selectedOffer.fulfilmentMode,
              },
              select: { id: true },
            });
            await tx.marketplaceCartLine.create({
              data: {
                cartId: cart.id,
                storeGroupId: group.id,
                publicReference: `PROOF-LINE-${randomUUID().slice(0, 8)}`,
                productPublicReference: selectedOffer.productReference,
                variantPublicReference: selectedOffer.variantReference,
                offerPublicReference: selectedOffer.offerReference,
                quantity: selectedOffer.quantity,
                observedPublicationVersion: String(selectedOffer.offerVersion),
                observedPriceVersion: selectedOffer.priceVersionReference,
                observedSellingUnit: selectedOffer.sellingUnit,
                observedUnitPrice: selectedOffer.unitPriceZar,
                lineFingerprint: createHash("sha256")
                  .update(selectedOffer.offerReference)
                  .digest("hex"),
              },
            });
            await tx.marketplaceCart.update({
              where: { id: cart.id },
              data: { version: { increment: 1 } },
            });
            let holdDetail = `trackingMode=${selectedOffer.trackingMode}`;
            if (
              selectedOffer.trackingMode === "TRACKED" &&
              !selectedOffer.allowBackorder &&
              selectedOffer.availableLevelId
            ) {
              const held = await tx.catalogInventoryLevel.updateMany({
                where: {
                  id: selectedOffer.availableLevelId,
                  available: { gte: selectedOffer.quantity },
                },
                data: {
                  available: { decrement: selectedOffer.quantity },
                  reserved: { increment: selectedOffer.quantity },
                  version: { increment: 1 },
                },
              });
              if (held.count !== 1) {
                throw new StoreCheckoutProofError(
                  "NO_SELLABLE_OFFER",
                  "Real offer inventory level could not satisfy a savepoint stock reservation.",
                  ["NO_SELLABLE_OFFER"],
                );
              }
              holdDetail = `reserved ${selectedOffer.quantity} unit(s) on active stock level before rollback`;
            }
            return {
              summary: `Savepoint-scoped cart group, line, and inventory hold verified (${holdDetail}) prior to rollback.`,
              data: true,
            };
          });

          await runStage("OFFLINE_WEBHOOK_HMAC_VERIFICATION", async () => {
            const storeFlags = await prisma.store.findUnique({
              where: { id: input.storeId },
              select: { isQaAcceptance: true },
            });
            const providerList = input.paymentProviderReadiness
              ?? (storeFlags?.isQaAcceptance
                ? (await import("@/lib/qa-acceptance/config")).buildQaSandboxProviderReadiness()
                : createProductionPaymentProviderRegistry().readiness());
            const paystackState = providerList.find((item) => item.code === "PAYSTACK") ?? null;
            const readiness = evaluatePaystackCheckoutReadiness(paystackState);
            if (!readiness.ready) {
              throw new StoreCheckoutProofError(
                "PAYMENT_PROVIDER_NOT_READY",
                `Paystack checkout readiness is blocked (${readiness.reasonCode}).`,
                ["PAYMENT_PROVIDER_NOT_READY"],
              );
            }
            const expectedCents = zarToSubunitCents(reviewResult.grandTotal);
            const webhookPayload = {
              event: "charge.success" as const,
              data: {
                id: 999900001,
                domain: paystackState?.environment ?? "test",
                status: "success",
                reference: `PROOF-PAY-${proofCheckoutRef}`,
                amount: expectedCents,
                currency: "ZAR",
                channel: "card",
              },
            };
            const parsed = PaystackChargeSuccessPayloadSchema.safeParse(webhookPayload);
            if (!parsed.success || parsed.data.data.amount !== expectedCents) {
              throw new Error("Payment subunit/webhook schema parity mismatch.");
            }
            const diag = await runOfflineEngineComponentTest();
            if (!diag.passed) {
              throw new Error("HMAC helper verification failed.");
            }
            return {
              summary: `Paystack config ready (${paystackState?.environment ?? "configured"}), subunit parity=${expectedCents}c, VAT(${sellerVatStatus}, mktVat=${String(marketplaceVatEnabled)}) verified (non-live schema check).`,
              data: true,
            };
          });

          await runStage("ORDER_AND_COMMISSION_PROJECTION", async () => {
            const groupSellerBasis = sellerBasis({
              merchandiseSubtotal: reviewResult.merchandiseSubtotal,
              modifierSubtotal: reviewResult.modifierSubtotal,
            });
            const calc = calculateCommission({
              basis: {
                subjectType: "MARKETPLACE_STORE_ORDER",
                subjectId: input.storeId,
                subjectPublicReference: `${proofCheckoutRef}:${input.storeId}:review:1`,
                pricingReference: reviewResult.commercialFingerprint,
                pricingVersion: String(reviewResult.reviewVersion),
                subtotal: groupSellerBasis,
                tax: "0.00",
                total: groupSellerBasis,
                currency: "ZAR",
                authoritativeAt: now.toISOString(),
              },
              basisType: snapshot.activePlan.basisType,
              calculationVersion: snapshot.activePlan.calculationVersion,
              rules: snapshot.activePlan.rules,
            });
            const sellerBasisCents = BigInt(parseZarToCents(calc.basisAmount));
            const commissionCents = BigInt(parseZarToCents(calc.totalAmount));
            const storeEarningCents = sellerBasisCents - commissionCents;
            commissionAmountZar = calc.totalAmount;
            storeEarningZar = centsToZar(storeEarningCents.toString());

            assertSettlementArithmetic({
              sellerBasis: calc.basisAmount,
              commissionAmount: commissionAmountZar,
              storeEarningAmount: storeEarningZar,
              deliveryFeeResidual: reviewResult.deliveryFeeTotal,
            });
            return {
              summary: `Commission plan ${snapshot.activePlan.publicReference} (${snapshot.activePlan.basisType}) balanced (basis=ZAR ${calc.basisAmount}, commission=ZAR ${commissionAmountZar}, storeNet=ZAR ${storeEarningZar}).`,
              data: true,
            };
          });

          await runStage("NEGATIVE_REJECTION_GUARDS", async () => {
            const outOfStockReview = await revalidateMarketplaceCheckout({
              checkoutId: "proof-chk-neg-1",
              checkoutReference: `${proofCheckoutRef}-NEG`,
              serviceAreaReference: input.coverageRegionId,
              reviewVersion: 1,
              commissionPolicyVersion: snapshot.activePlan.publicReference,
              groups: [
                {
                  storeReference: input.storeId,
                  pickupLocationReference: input.pickupAddressId,
                  fulfilmentMode: selectedOffer.fulfilmentMode,
                  lines: [baseLine],
                },
              ],
              resolveLine: async (line) => ({
                lineReference: line.lineReference,
                available: false,
                quantity: 0,
                priceVersion: line.priceVersion,
                publicationVersion: line.publicationVersion,
                baseUnitPrice: line.baseUnitPrice,
                modifierUnitTotal: line.modifierUnitTotal,
                lineTotal: line.lineTotal,
                modifierValid: true,
              }),
              quoteAdapter: {
                async quoteStoreGroup() {
                  throw new Error("UNCOVERED_ROUTE");
                },
              },
            });
            if (
              outOfStockReview.status !== "CHANGES_REQUIRED" ||
              !outOfStockReview.changes.some((c) => c.type === "OUT_OF_STOCK")
            ) {
              throw new Error(
                "Out-of-stock negative assertion did not block checkout review.",
              );
            }

            const disabledProvider = evaluatePaystackCheckoutReadiness({
              configured: true,
              active: false,
              environment: "production",
              errorCategory: "NONE",
              productionValidationApproved: false,
            });
            if (
              disabledProvider.ready ||
              disabledProvider.reasonCode !== "LIVE_CHECKOUT_NOT_AUTHORIZED"
            ) {
              throw new Error(
                "Disabled Paystack provider check did not fail closed.",
              );
            }

            return {
              summary:
                "Negative guards verified (OUT_OF_STOCK + uncovered route + LIVE_CHECKOUT_NOT_AUTHORIZED fail closed).",
              data: true,
            };
          });
        } finally {
          await tx.$executeRawUnsafe(
            "ROLLBACK TO SAVEPOINT kt_checkout_engine_proof",
          );
        }

        syntheticRowsRemaining = await tx.marketplaceCart.count({
          where: { publicReference: proofCartRef },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (thrownTerminalProofError) {
      throw thrownTerminalProofError;
    }
    if (err instanceof StoreCheckoutProofError) {
      throw err;
    }
    if (!failureMessage) {
      failureMessage =
        err instanceof Error ? err.message : "Disposable checkout engine proof failed.";
    }
  }

  const finalOffer = proofOffer as EligibleProofOffer | null;
  if (!finalOffer) {
    throw new StoreCheckoutProofError(
      "NO_SELLABLE_OFFER",
      "Store has no eligible published sellable offer for checkout capability proof.",
      ["NO_SELLABLE_OFFER"],
    );
  }

  const policyFingerprint =
    computeStorePolicyFingerprint({
      pickupAddressId: input.pickupAddressId,
      pickupFingerprint: pickupFingerprint ?? "",
      coverageRegionId: input.coverageRegionId,
      serviceSignature: serviceSignature ?? "",
      sellerIdentityReference: input.sellerIdentityReference ?? null,
      sellerIdentityVersion: input.sellerIdentityVersion ?? null,
      operationalPolicyReference: input.operationalPolicyReference ?? null,
      commissionPlanReference: commissionPlanReference || null,
      sourceCommerceReadinessRevision,
      globalPolicyRevision,
      proofOfferReference: finalOffer.offerReference,
      proofPriceVersionReference: finalOffer.priceVersionReference,
    }) ?? "";

  const passed =
    failedStage === null &&
    stageResults.length === 6 &&
    stageResults.every((s) => s.passed) &&
    syntheticRowsRemaining === 0;

  const cleanStoreToken = input.storeId
    .replace(/[^A-Za-z0-9_-]/g, "")
    .slice(0, 16);
  const engineProofDigest = createHash("sha256")
    .update(
      JSON.stringify({
        storeId: input.storeId,
        evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
        suiteSha: STORE_CHECKOUT_ENGINE_PROOF_SUITE_SHA,
        policyFingerprint,
        sourceCommerceReadinessRevision,
        globalPolicyRevision,
        proofOfferReference: finalOffer.offerReference,
        proofPriceVersionReference: finalOffer.priceVersionReference,
        stages: stageResults.map((s) => ({
          stage: s.stage,
          passed: s.passed,
        })),
        passed,
      }),
    )
    .digest("hex");

  return {
    passed,
    evidenceType: REAL_CHECKOUT_PROOF_EVIDENCE_TYPE,
    suiteSha: STORE_CHECKOUT_ENGINE_PROOF_SUITE_SHA,
    policyFingerprint,
    engineProofReference: `engproof:${cleanStoreToken}:${engineProofDigest.slice(0, 24)}`,
    engineProofDigest,
    sourceCommerceReadinessRevision,
    globalPolicyRevision,
    proofOfferReference: finalOffer.offerReference,
    proofPriceVersionReference: finalOffer.priceVersionReference,
    proofMetadata: {
      offerReference: finalOffer.offerReference,
      productReference: finalOffer.productReference,
      variantReference: finalOffer.variantReference,
      priceVersionReference: finalOffer.priceVersionReference,
      quantity: finalOffer.quantity,
      unitPriceZar: finalOffer.unitPriceZar,
      deliveryFeeZar,
      grandTotalZar,
      parcelClass: finalOffer.parcelClassification?.sizeClass ?? null,
      tariffSource: deliveryTariffSource,
      commissionPlanReference,
      commissionAmountZar,
      storeEarningZar,
      sellerVatStatus,
      marketplaceVatEnabled,
    },
    stageResults,
    redactedSnapshot: {
      storeId: input.storeId,
      storeStatus,
      coverageRegionId: input.coverageRegionId,
      matchingServiceVersions,
      catalogOfferCount,
      catalogMode: "STORE_OFFER",
    },
    failedStage,
    failureMessage,
    syntheticRowsRemaining,
  };
}
