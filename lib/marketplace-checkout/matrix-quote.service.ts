import { Prisma, type PricingQuoteOwnerType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { checkDeliveryZone } from "@/lib/maps/delivery-zone.service";
import { calculateRoute } from "@/lib/maps/routes.service";
import { deliveryCatalog } from "@/lib/client-platform/delivery.service";
import { getPricingConfiguration } from "@/lib/pricing/config";
import { hashPricingInput, pricingInputSnapshot } from "@/lib/pricing/input-hash";
import type { PricingQuoteRequestInput } from "@/lib/validation/pricing";
import { listDeliveryMatrices } from "./delivery-policy-configuration";
import { selectMarketplaceDeliveryPolicy } from "./delivery-policy";
import { MarketplaceCheckoutError } from "./errors";

export async function createMarketplaceMatrixQuote(owner: { ownerType: PricingQuoteOwnerType; ownerId: string; storeId: string }, input: PricingQuoteRequestInput, serviceAreaReference: string) {
  const fail = (message: string): never => { throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", message); };
  const points = [input.pickupAddress, input.dropoffAddress];
  if (points.some((p) => p.latitude == null || p.longitude == null)) fail("Verified pickup and destination coordinates are required.");
  const zones = await Promise.all(points.map((p) => checkDeliveryZone(p.latitude!, p.longitude!)));
  if (zones.some((z) => !z.matched || !z.regionId || z.withinMaxDistance !== true) || zones[1].regionId !== serviceAreaReference) fail("Both addresses must be inside enabled operational coverage.");
  const regions = await prisma.deliveryRegion.findMany({ where: { id: { in: zones.map((z) => z.regionId!) }, active: true, pricingEnabled: true } });
  const byId = new Map(regions.map((r) => [r.id, r]));
  if (zones.some((z, i) => !byId.get(z.regionId!) || byId.get(z.regionId!)?.province !== points[i].province)) fail("Mapped region provinces must match the verified addresses.");
  const services = await deliveryCatalog();
  if (!services.some((s) => zones.every((z, i) => s.provinces.some((p) => p === points[i].province) && (!s.regionIds.length || s.regionIds.includes(z.regionId!))))) fail("No enabled courier service supports both addresses.");
  const route = await calculateRoute(points[0].latitude!, points[0].longitude!, points[1].latitude!, points[1].longitude!);
  if (!route.ok || route.route.distanceMeters <= 0) fail("A verified road route is required.");
  if (!route.ok) return fail("Route unavailable.");
  const distanceKm = route.route.distanceMeters / 1000;
  if (regions.some((r) => distanceKm > Number(r.maxDistanceKm))) fail("Road distance exceeds the operational region limit.");
  // The checkout has no approved parcel classification. Only an explicitly
  // authored ANY-size matrix row may apply; never infer size from line count.
  const tariff = selectMarketplaceDeliveryPolicy(await listDeliveryMatrices(), { sizeClass: null, distanceKm, province: input.dropoffAddress.province!, regionId: serviceAreaReference, storeId: owner.storeId, highRisk: regions.some((r) => Number(r.highRiskSurcharge) > 0) });
  const configuration = await getPricingConfiguration();
  const snapshot = pricingInputSnapshot(input);
  const subtotal = new Prisma.Decimal(tariff.fee);
  const taxRate = configuration.tax.enabled ? configuration.tax.rate : new Prisma.Decimal(0);
  const taxAmount = subtotal.mul(taxRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const total = subtotal.add(taxAmount);
  const expiresAt = new Date(Date.now() + configuration.quoteTtlMinutes * 60000);
  const quote = await prisma.pricingQuote.create({ data: {
    ...owner, deliveryType: input.deliveryType, currency: "ZAR", calculationVersion: "marketplace-matrix-v1", inputHash: hashPricingInput(snapshot),
    distanceMeters: route.route.distanceMeters, durationSeconds: route.route.durationSeconds, routeProvider: route.route.provider,
    originRegionId: zones[0].regionId, destinationRegionId: zones[1].regionId,
    rawDistanceKm: new Prisma.Decimal(distanceKm), billableDistanceKm: new Prisma.Decimal(distanceKm), subtotal, taxRate, taxAmount, total,
    inputSnapshot: snapshot as Prisma.InputJsonValue, ruleSnapshot: { ...tariff, policyAuthority: "marketplace_delivery_matrix", priceBasis: "DELIVERY_SUBTOTAL" }, regionSnapshot: { originRegionId: zones[0].regionId, destinationRegionId: zones[1].regionId }, taxSnapshot: { enabled: configuration.tax.enabled, rate: taxRate.toString(), amount: taxAmount.toFixed(2), source: configuration.tax.source }, expiresAt,
    lineItems: { create: [{ code: "BASE_FEE", label: "Approved marketplace delivery fee", amount: subtotal, currency: "ZAR", metadata: { policyVersion: tariff.policyVersion, ruleKey: tariff.ruleKey, highRiskApplied: tariff.highRiskApplied } }, ...(configuration.tax.enabled ? [{ code: "VAT" as const, label: "VAT", amount: taxAmount, currency: "ZAR" }] : [])] },
  } });
  return { id: quote.id, total: quote.total.toFixed(2), expiresAt: quote.expiresAt, policyVersion: tariff.policyVersion };
}
