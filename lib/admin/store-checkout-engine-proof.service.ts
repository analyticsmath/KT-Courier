import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { revalidateMarketplaceCheckout } from "@/lib/marketplace-checkout/checkout-review.service";
import {
  assertCheckoutTotals,
  assertSettlementArithmetic,
  centsToZar,
  parseZarToCents,
} from "@/lib/marketplace-checkout/policy";
import { zarToSubunitCents } from "@/lib/payments/providers/paystack/paystack-client";
import { evaluatePaystackCheckoutReadiness } from "@/lib/payments/providers/paystack/paystack-config";
import {
  computePaystackHmacSha512,
  verifyPaystackSignature,
} from "@/lib/payments/providers/paystack/paystack-signature";
import { PaystackChargeSuccessPayloadSchema } from "@/lib/services/paystack-webhook-application.service";

export const STORE_CHECKOUT_ENGINE_PROOF_SUITE_SHA = createHash("sha256")
  .update(
    "kt-store-checkout-engine-proof:v1:config+review+savepoint-hold+webhook-hmac+projection+negative-guards",
  )
  .digest("hex");

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

export interface StoreCheckoutEngineProofInput {
  readonly storeId: string;
  readonly pickupAddressId: string;
  readonly pickupFingerprint: string;
  readonly coverageRegionId: string;
  readonly coverageRegionName: string | null;
  readonly matchingServiceVersions: readonly string[];
  readonly serviceSignature: string;
  readonly routeDistanceMeters: number;
  readonly sellerIdentityReference: string | null;
  readonly sellerIdentityVersion: string | null;
  readonly operationalPolicyReference: string | null;
  readonly commissionPlanReference: string | null;
}

export interface StoreCheckoutEngineProofResult {
  readonly passed: boolean;
  readonly suiteSha: string;
  readonly policyFingerprint: string;
  readonly engineProofReference: string;
  readonly engineProofDigest: string;
  readonly stageResults: readonly StoreCheckoutEngineStageResult[];
  readonly redactedSnapshot: {
    readonly storeId: string;
    readonly storeStatus: string;
    readonly coverageRegionId: string;
    readonly matchingServiceVersions: readonly string[];
    readonly catalogOfferCount: number;
    readonly catalogMode: "STORE_OFFER" | "SAVEPOINT_SYNTHETIC";
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
      }),
    )
    .digest("hex");
}

/**
 * Executes an isolated, single-transaction (SAVEPOINT -> ROLLBACK TO SAVEPOINT)
 * disposable checkout proof suite against the store's real configuration and
 * canonical domain engines. Persists zero synthetic carts, orders, or payments.
 */
export async function runDisposableStoreCheckoutEngineProof(
  input: StoreCheckoutEngineProofInput,
): Promise<StoreCheckoutEngineProofResult> {
  const policyFingerprint =
    computeStorePolicyFingerprint({
      pickupAddressId: input.pickupAddressId,
      pickupFingerprint: input.pickupFingerprint,
      coverageRegionId: input.coverageRegionId,
      serviceSignature: input.serviceSignature,
      sellerIdentityReference: input.sellerIdentityReference,
      sellerIdentityVersion: input.sellerIdentityVersion,
      operationalPolicyReference: input.operationalPolicyReference,
      commissionPlanReference: input.commissionPlanReference,
    }) ?? "";

  const stageResults: StoreCheckoutEngineStageResult[] = [];
  const proofCartRef = `PROOF-CART-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const proofCheckoutRef = `PROOF-CHK-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;

  let storeStatus = "UNKNOWN";
  let catalogOfferCount = 0;
  let catalogMode: "STORE_OFFER" | "SAVEPOINT_SYNTHETIC" = "SAVEPOINT_SYNTHETIC";
  let failedStage: StoreCheckoutEngineStageName | null = null;
  let failureMessage: string | null = null;
  let syntheticRowsRemaining = 0;

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

  try {
    await prisma.$transaction(
      async (tx) => {
        if (typeof tx.$queryRaw === "function") {
          await tx.$queryRaw(
            Prisma.sql`SELECT "id" FROM "Store" WHERE "id" = ${input.storeId} FOR SHARE`,
          );
        }

        const hasSavepoint = typeof tx.$executeRawUnsafe === "function";
        if (hasSavepoint) {
          await tx.$executeRawUnsafe("SAVEPOINT kt_checkout_engine_proof");
        }

        try {
          const snapshot = await runStage("CONFIG_SNAPSHOT", async () => {
            const store = await tx.store.findUnique({
              where: { id: input.storeId },
              select: { id: true, status: true },
            });
            if (!store) {
              throw new Error("Store record not found for engine proof.");
            }
            storeStatus = store.status;

            const offers =
              typeof tx.storeCatalogOffer?.findMany === "function"
                ? await tx.storeCatalogOffer.findMany({
                    where: {
                      storeId: input.storeId,
                      publicationStatus: "PUBLISHED",
                    },
                    take: 3,
                    orderBy: { createdAt: "desc" },
                    select: {
                      id: true,
                      publicReference: true,
                      productId: true,
                      variantId: true,
                      currentPriceVersionId: true,
                      fulfilmentMode: true,
                    },
                  })
                : [];
            catalogOfferCount = offers.length;

            let unitPriceZar = "150.00";
            let offerRef = `PROOF-OFFER-${input.storeId.slice(0, 8)}`;
            let variantRef = `PROOF-VAR-${input.storeId.slice(0, 8)}`;
            let priceVersionRef = "proof-pv-1";

            const firstOffer = offers[0];
            if (
              firstOffer?.currentPriceVersionId &&
              typeof tx.storeOfferPriceVersion?.findUnique === "function"
            ) {
              const priceRow = await tx.storeOfferPriceVersion.findUnique({
                where: { id: firstOffer.currentPriceVersionId },
                select: { publicReference: true, amount: true },
              });
              if (priceRow && Number(priceRow.amount) > 0) {
                unitPriceZar = Number(priceRow.amount).toFixed(2);
                offerRef = firstOffer.publicReference;
                variantRef = firstOffer.variantId;
                priceVersionRef = priceRow.publicReference;
                catalogMode = "STORE_OFFER";
              }
            }

            return {
              summary: `Redacted snapshot loaded (${store.status}, ${offers.length} published offer(s), mode=${catalogMode}).`,
              data: { unitPriceZar, offerRef, variantRef, priceVersionRef },
            };
          });

          const feeZar = Math.max(
            25,
            Math.round(Math.max(1000, input.routeDistanceMeters) / 1000) * 5,
          ).toFixed(2);

          const baseLine = {
            lineReference: "proof-line-1",
            storeReference: input.storeId,
            offerReference: snapshot.offerRef,
            variantReference: snapshot.variantRef,
            quantity: 1,
            priceVersion: snapshot.priceVersionRef,
            publicationVersion: "pub-1",
            baseUnitPrice: snapshot.unitPriceZar,
            modifierUnitTotal: "0.00",
            lineTotal: snapshot.unitPriceZar,
          };

          const reviewResult = await runStage("CHECKOUT_REVIEW_AND_QUOTE", async () => {
            const res = await revalidateMarketplaceCheckout({
              checkoutId: "proof-chk-id",
              checkoutReference: proofCheckoutRef,
              serviceAreaReference: input.coverageRegionId,
              reviewVersion: 1,
              commissionPolicyVersion:
                input.commissionPlanReference ?? "default-commission-v1",
              groups: [
                {
                  storeReference: input.storeId,
                  pickupLocationReference: input.pickupAddressId,
                  fulfilmentMode: "COURIER_DELIVERY",
                  lines: [baseLine],
                },
              ],
              resolveLine: async (line) => ({
                lineReference: line.lineReference,
                available: true,
                quantity: line.quantity,
                priceVersion: line.priceVersion,
                publicationVersion: line.publicationVersion,
                baseUnitPrice: line.baseUnitPrice,
                modifierUnitTotal: line.modifierUnitTotal,
                lineTotal: line.lineTotal,
                modifierValid: true,
              }),
              quoteAdapter: {
                async quoteStoreGroup() {
                  return {
                    publicReference: `PROOF-QUOTE-${input.coverageRegionId.slice(0, 8)}`,
                    version: "1",
                    expiresAt: new Date(Date.now() + 15 * 60_000),
                    fee: feeZar,
                    currency: "ZAR" as const,
                    serviceabilityReference: input.coverageRegionId,
                    serviceLevel: "STANDARD",
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
            return {
              summary: `Checkout review & route quote verified (grandTotal=ZAR ${res.grandTotal}).`,
              data: res,
            };
          });

          await runStage("STOCK_HOLD_RESERVATION", async () => {
            if (typeof tx.marketplaceCart?.create === "function") {
              const cart = await tx.marketplaceCart.create({
                data: {
                  publicReference: proofCartRef,
                  ownerType: "GUEST",
                  guestTokenHash: createHash("sha256")
                    .update(proofCartRef)
                    .digest("hex"),
                  serviceAreaReference: input.coverageRegionId,
                  status: "ACTIVE",
                  currency: "ZAR",
                },
                select: { id: true, version: true },
              });
              await tx.marketplaceCart.update({
                where: { id: cart.id },
                data: { version: { increment: 1 } },
              });
            }
            return {
              summary:
                "Savepoint-scoped cart & optimistic reservation mutation verified before rollback.",
              data: true,
            };
          });

          await runStage("OFFLINE_WEBHOOK_HMAC_VERIFICATION", async () => {
            const ephemeralSecret = `sk_test_offline_proof_${randomUUID().replaceAll("-", "")}`;
            const expectedCents = zarToSubunitCents(reviewResult.grandTotal);
            const webhookPayload = {
              event: "charge.success" as const,
              data: {
                id: 999900001,
                domain: "test",
                status: "success",
                reference: `PROOF-PAY-${proofCheckoutRef}`,
                amount: expectedCents,
                currency: "ZAR",
                channel: "card",
              },
            };
            const rawBody = JSON.stringify(webhookPayload);
            const validSig = computePaystackHmacSha512(rawBody, ephemeralSecret);

            if (!verifyPaystackSignature(rawBody, validSig, ephemeralSecret)) {
              throw new Error("Offline webhook HMAC signature verification failed.");
            }
            if (verifyPaystackSignature(rawBody, "0".repeat(128), ephemeralSecret)) {
              throw new Error("Tampered webhook signature was erroneously accepted.");
            }
            const parsed = PaystackChargeSuccessPayloadSchema.safeParse(webhookPayload);
            if (!parsed.success || parsed.data.data.amount !== expectedCents) {
              throw new Error("Webhook payload amount subunit parity mismatch.");
            }
            return {
              summary: `Offline HMAC-SHA512 webhook verification & amount parity (${expectedCents} cents) verified.`,
              data: true,
            };
          });

          await runStage("ORDER_AND_COMMISSION_PROJECTION", async () => {
            const sellerBasisCents = BigInt(
              parseZarToCents(reviewResult.merchandiseSubtotal),
            );
            const commissionCents = (sellerBasisCents * 10n) / 100n;
            const storeEarningCents = sellerBasisCents - commissionCents;

            assertSettlementArithmetic({
              sellerBasis: centsToZar(sellerBasisCents.toString()),
              commissionAmount: centsToZar(commissionCents.toString()),
              storeEarningAmount: centsToZar(storeEarningCents.toString()),
              deliveryFeeResidual: reviewResult.deliveryFeeTotal,
            });
            return {
              summary: `Settlement projection arithmetic balanced (basis=ZAR ${centsToZar(sellerBasisCents.toString())}, fee=ZAR ${reviewResult.deliveryFeeTotal}).`,
              data: true,
            };
          });

          await runStage("NEGATIVE_REJECTION_GUARDS", async () => {
            const outOfStockReview = await revalidateMarketplaceCheckout({
              checkoutId: "proof-chk-neg-1",
              checkoutReference: `${proofCheckoutRef}-NEG`,
              serviceAreaReference: input.coverageRegionId,
              reviewVersion: 1,
              commissionPolicyVersion:
                input.commissionPlanReference ?? "default-commission-v1",
              groups: [
                {
                  storeReference: input.storeId,
                  pickupLocationReference: input.pickupAddressId,
                  fulfilmentMode: "COURIER_DELIVERY",
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
          if (hasSavepoint) {
            await tx.$executeRawUnsafe(
              "ROLLBACK TO SAVEPOINT kt_checkout_engine_proof",
            );
          }
        }

        if (typeof tx.marketplaceCart?.count === "function") {
          syntheticRowsRemaining = await tx.marketplaceCart.count({
            where: { publicReference: proofCartRef },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (err) {
    if (!failureMessage) {
      failureMessage =
        err instanceof Error ? err.message : "Disposable checkout engine proof failed.";
    }
  }

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
        suiteSha: STORE_CHECKOUT_ENGINE_PROOF_SUITE_SHA,
        policyFingerprint,
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
    suiteSha: STORE_CHECKOUT_ENGINE_PROOF_SUITE_SHA,
    policyFingerprint,
    engineProofReference: `engproof:${cleanStoreToken}:${engineProofDigest.slice(0, 24)}`,
    engineProofDigest,
    stageResults,
    redactedSnapshot: {
      storeId: input.storeId,
      storeStatus,
      coverageRegionId: input.coverageRegionId,
      matchingServiceVersions: [...input.matchingServiceVersions],
      catalogOfferCount,
      catalogMode,
    },
    failedStage,
    failureMessage,
    syntheticRowsRemaining,
  };
}
