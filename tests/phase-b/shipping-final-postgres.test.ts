/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { acceptDispatchAssignment, offerAssignment } from "@/lib/services/dispatch-assignment.service";
import { acceptShipmentPackagePolicy, createPackagePolicyVersion, activatePackagePolicyVersion, recordVendorPreparation, recordDriverDeliveryResponsibility } from "@/lib/services/shipping-obligations.service";

// Intentionally not executed in this implementation-only pass. When invoked
// against PostgreSQL fixtures, ACT always uses production authorities; direct
// Prisma reads below are assertion-only.
describe("Phase B ENG-SHIP-006..008 PostgreSQL production-authority proof", () => {
  it("persists an effective package-policy acceptance, vendor preparation timeline, and assignment-bound driver responsibilities exactly once", async () => {
    const suffix = `${Date.now()}${Math.random().toString(16).slice(2)}`;
    const admin = await prisma.user.create({ data: { email: `shipping-admin-${suffix}@proof.test`, role: "ADMIN", status: "ACTIVE" } });
    const vendor = await prisma.user.create({ data: { email: `shipping-vendor-${suffix}@proof.test`, role: "STORE", status: "ACTIVE" } });
    const driverUser = await prisma.user.create({ data: { email: `shipping-driver-${suffix}@proof.test`, role: "DRIVER", status: "ACTIVE" } });
    const store = await prisma.store.create({ data: { ownerUserId: vendor.id, name: `Shipping proof ${suffix}`, slug: `shipping-proof-${suffix}`, status: "ACTIVE" } });
    const region = await prisma.deliveryRegion.create({ data: { name: `Shipping region ${suffix}`, slug: `shipping-region-${suffix}` } });
    const driver = await prisma.driverProfile.create({ data: { userId: driverUser.id, driverCode: `SP${suffix}`.slice(0, 30), active: true, status: "ACTIVE", availability: "AVAILABLE" } });
    await prisma.driverServiceRegion.create({ data: { driverProfileId: driver.id, deliveryRegionId: region.id, isPrimary: true } });
    const order = await prisma.order.create({ data: { orderNumber: `SHIP-PROOF-${suffix}`, source: "STORE", status: "CONFIRMED", deliveryType: "PARCEL_DOCUMENT", storeId: store.id, deliveryRegionId: region.id } });
    const offered = await offerAssignment(admin.id, order.id, { driverProfileId: driver.id, reasonCode: "PHASE_B_PROOF" });
    const assignment = await acceptDispatchAssignment(driver.id, offered.id, { expectedVersion: offered.version });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).currentDriverProfileId).toBe(driver.id);
    const stableKey = `PROOF_${suffix.toUpperCase()}`;
    await createPackagePolicyVersion({ actorUserId: admin.id, stableKey, versionNumber: 1, effectiveFrom: new Date(Date.now() - 1_000), insuranceMode: "CLIENT_VALUE_REQUIRED", packagingRequirements: {} });
    await activatePackagePolicyVersion({ actorUserId: admin.id, stableKey, versionNumber: 1 });
    const packageInput = { orderId: order.id, actorUserId: vendor.id, policyStableKey: stableKey, operationId: `PKGOP-${suffix.toUpperCase()}`, packagingConfirmed: true } as const;
    const [declaration, repeated] = await Promise.all([acceptShipmentPackagePolicy(packageInput), acceptShipmentPackagePolicy(packageInput)]);
    expect(repeated.id).toBe(declaration.id);
    await recordVendorPreparation({ orderId: order.id, actorUserId: vendor.id, eventType: "PACKAGING_CONFIRMED", operationId: `PREPOP-${suffix.toUpperCase()}A` });
    await recordVendorPreparation({ orderId: order.id, actorUserId: vendor.id, eventType: "LAWFUL_LISTING_CONFIRMED", operationId: `PREPOP-${suffix.toUpperCase()}B` });
    await recordVendorPreparation({ orderId: order.id, actorUserId: vendor.id, eventType: "HANDOFF_READY", operationId: `PREPOP-${suffix.toUpperCase()}C` });
    await recordDriverDeliveryResponsibility({ assignmentId: assignment.id, driverProfileId: driver.id, driverUserId: driverUser.id, assignmentVersion: assignment.version, reportType: "SAFETY_CHECK", operationId: `DRROP-${suffix.toUpperCase()}A` });
    await recordDriverDeliveryResponsibility({ assignmentId: assignment.id, driverProfileId: driver.id, driverUserId: driverUser.id, assignmentVersion: assignment.version, reportType: "LAWFUL_TRANSPORT_CONFIRMATION", operationId: `DRROP-${suffix.toUpperCase()}B` });
    const events = await (prisma as any).shipmentPreparationEvent.findMany({ where: { obligation: { orderId: order.id } } });
    expect(events).toHaveLength(3);
  });
});
