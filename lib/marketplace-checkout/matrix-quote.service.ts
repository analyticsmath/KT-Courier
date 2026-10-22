import { Prisma, type PricingQuoteOwnerType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { checkDeliveryZone } from "@/lib/maps/delivery-zone.service";
import { regionRouteLimitKm } from "@/lib/maps/region-boundaries";
import { calculateRoute } from "@/lib/maps/routes.service";
import { deliveryCatalog } from "@/lib/client-platform/delivery.service";
import { getPricingConfiguration } from "@/lib/pricing/config";
import { hashPricingInput, pricingInputSnapshot } from "@/lib/pricing/input-hash";
import type { PricingQuoteRequestInput } from "@/lib/validation/pricing";
import { listDeliveryMatrices } from "./delivery-policy-configuration";
import { selectMarketplaceDeliveryPolicy } from "./delivery-policy";
import { MarketplaceCheckoutError } from "./errors";
import { marketplaceCourierTariffPolicy } from "./courier-tariff-policy";
import { calculateMarketplaceCourierTariff, MARKETPLACE_COURIER_CALCULATION_VERSION } from "./courier-tariff-calculation";
import { classifyPersistedCheckoutParcel } from "./parcel-configuration.service";
import { activePersonalizedDeliveryRate, personalizedDeliveryRateSnapshot } from "@/lib/pricing/personalized-delivery-rates";

export async function createMarketplaceMatrixQuote(owner: { ownerType: PricingQuoteOwnerType; ownerId: string; storeId: string }, input: PricingQuoteRequestInput, serviceAreaReference: string, checkoutReference?: string, courierServiceKey?: string) {
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
  if (regions.some((r) => { const limit = regionRouteLimitKm(r); return limit !== null && distanceKm > limit; })) fail("Road distance exceeds the operational region limit.");
  const parcelClassification = await classifyPersistedCheckoutParcel(checkoutReference, owner.storeId);
  if (parcelClassification.status === "UNSUPPORTED") fail("The trusted package measurements exceed approved acceptance limits or contain invalid source quantities.");
  // Unknown aggregate packing remains eligible only for an independently
  // approved explicit ANY tariff. Shopper size and product weight are ignored.
  const courierPolicy = await marketplaceCourierTariffPolicy();
  const selectedService = courierPolicy ? services.find(service => service.stableKey === (courierServiceKey ?? courierPolicy.defaultServiceKey) && service.active && zones.every((zone, index) => service.provinces.some(province => province === points[index].province) && (!service.regionIds.length || service.regionIds.includes(zone.regionId!)))) : null;
  if (courierPolicy && !selectedService) fail("The selected courier service is not active for both addresses.");
  if (!courierPolicy && courierServiceKey) fail("Service selection is unavailable under the marketplace fee-matrix model.");
  const tariff = courierPolicy ? null : selectMarketplaceDeliveryPolicy(await listDeliveryMatrices(), { sizeClass: parcelClassification.sizeClass, distanceKm, province: input.dropoffAddress.province!, regionId: serviceAreaReference, storeId: owner.storeId, highRisk: regions.some((region) => Number(region.highRiskSurcharge) > 0) });
  // Lookup is bound to the server-owned store ID, never to a shopper-submitted
  // identity. Ordinary stores and public guest quotes retain existing tariffs.
  const negotiatedRate = selectedService && parcelClassification.sizeClass
    ? await activePersonalizedDeliveryRate({ ownerType: "STORE", ownerId: owner.storeId }, selectedService.stableKey, parcelClassification.sizeClass)
    : null;
  const configuration = await getPricingConfiguration();
  const snapshot = pricingInputSnapshot(input);
  const courier = selectedService ? calculateMarketplaceCourierTariff({ service: selectedService, parcel: parcelClassification, distanceMeters: route.route.distanceMeters, durationSeconds: route.route.durationSeconds, regionContext: { origin: byId.get(zones[0].regionId!)!, destination: byId.get(zones[1].regionId!)! }, tax: configuration.tax, negotiatedRate }) : null;
  const subtotal = courier?.calculation.subtotal ?? new Prisma.Decimal(tariff!.fee);
  const taxRate = courier?.calculation.taxRate ?? (configuration.tax.enabled ? configuration.tax.rate : new Prisma.Decimal(0));
  const taxAmount = courier?.calculation.taxAmount ?? subtotal.mul(taxRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const total = courier?.calculation.total ?? subtotal.add(taxAmount);
  const calculationVersion = courier ? MARKETPLACE_COURIER_CALCULATION_VERSION : "marketplace-matrix-v1";
  const ruleSnapshot = courier && selectedService ? { serviceKey: selectedService.stableKey, serviceVersion: selectedService.version, serviceDefinitionId: selectedService.id, approvalReference: courierPolicy!.approvalReference, checkoutReference, parcelClassification, policyAuthority: "existing_courier_tariffs", priceBasis: "DELIVERY_SUBTOTAL", personalizedRate: negotiatedRate ? personalizedDeliveryRateSnapshot(negotiatedRate) : null } : { ...tariff, parcelClassification, policyAuthority: "marketplace_delivery_matrix", priceBasis: "DELIVERY_SUBTOTAL" };
  const expiresAt = new Date(Date.now() + configuration.quoteTtlMinutes * 60000);
  const quote = await prisma.pricingQuote.create({ data: {
    ...owner, deliveryType: input.deliveryType, currency: "ZAR", calculationVersion, inputHash: hashPricingInput(snapshot),
    distanceMeters: route.route.distanceMeters, durationSeconds: route.route.durationSeconds, routeProvider: route.route.provider,
    originRegionId: zones[0].regionId, destinationRegionId: zones[1].regionId,
    rawDistanceKm: new Prisma.Decimal(distanceKm), billableDistanceKm: courier?.calculation.billableDistanceKm ?? new Prisma.Decimal(distanceKm), subtotal, taxRate, taxAmount, total,
    inputSnapshot: snapshot as Prisma.InputJsonValue, ruleSnapshot: ruleSnapshot as Prisma.InputJsonValue, regionSnapshot: { originRegionId: zones[0].regionId, destinationRegionId: zones[1].regionId }, taxSnapshot: { enabled: configuration.tax.enabled, rate: taxRate.toString(), amount: taxAmount.toFixed(2), source: configuration.tax.source }, expiresAt,
    lineItems: { create: courier ? courier.calculation.lineItems.map(item => ({ ...item, currency: "ZAR", metadata: item.metadata ?? {} })) : [{ code: "BASE_FEE", label: "Approved marketplace delivery fee", amount: subtotal, currency: "ZAR", metadata: { policyVersion: tariff!.policyVersion, ruleKey: tariff!.ruleKey, highRiskApplied: tariff!.highRiskApplied } }, ...(configuration.tax.enabled ? [{ code: "VAT" as const, label: "VAT", amount: taxAmount, currency: "ZAR" }] : [])] },
  } });
  return { id: quote.id, total: quote.total.toFixed(2), expiresAt: quote.expiresAt, policyVersion: tariff?.policyVersion ?? selectedService!.version, quoteVersion: selectedService ? `marketplace-courier:${selectedService.stableKey}:${selectedService.version}:${quote.id}` : `marketplace-matrix:${tariff!.policyVersion}:${quote.id}`, serviceLevel: selectedService ? `${selectedService.displayName} · ${selectedService.turnaround}` : null };
}
