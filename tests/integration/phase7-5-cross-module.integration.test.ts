import { beforeAll, describe, expect, it } from "vitest";
import { PermissionEffect, UserRole } from "@/types/db";
import { hasPermission, syncSystemPermissions } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { createOrder } from "@/lib/services/orders.service";
import { acceptDispatchAssignment, offerAssignment } from "@/lib/services/dispatch-assignment.service";
import { createDriver, createPersistedQuote, createRegion, createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

beforeAll(async () => {
  await syncSystemPermissions({ actorUserId: "system" });
});

describe("Phase 7.5 live cross-module invariants", () => {
  it("preserves price across dispatch and enforces ownership and permission boundaries", async () => {
    const tag = uniqueTag("cross-module");
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const otherCustomer = await createUser(`${tag}-other`, UserRole.CUSTOMER);
    const admin = await createUser(`${tag}-admin`, UserRole.ADMIN);
    const promoter = await createUser(`${tag}-promoter`, UserRole.PROMOTER);
    const region = await createRegion(tag);
    const driver = await createDriver(`${tag}-driver`, region.id);
    const { input } = await createPersistedQuote(customer, `${tag}-quote`);
    await expect(createOrder(otherCustomer, input)).rejects.toMatchObject({ code: "QUOTE_OWNER_MISMATCH" });
    const order = await createOrder(customer, input);
    await integrationPrisma.order.update({ where: { id: order.id }, data: { status: "CONFIRMED", deliveryRegionId: region.id } });
    const before = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { pricingQuoteId: true, priceEstimate: true, pricingSubtotal: true, pricingTaxAmount: true, pricingSnapshot: true } });

    const pricingPermission = await integrationPrisma.permission.findUniqueOrThrow({ where: { key: PERMISSIONS.PRICING_MANAGE } });
    await integrationPrisma.userPermission.create({ data: { userId: admin.id, permissionId: pricingPermission.id, effect: PermissionEffect.DENY, reason: "Phase 7.5 explicit deny" } });
    expect(await hasPermission({ userId: admin.id, role: admin.role, permissionKey: PERMISSIONS.PRICING_MANAGE })).toBe(false);
    expect(await hasPermission({ userId: promoter.id, role: promoter.role, permissionKey: PERMISSIONS.DISPATCH_ASSIGN })).toBe(false);

    const offer = await offerAssignment(admin.id, order.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" });
    await acceptDispatchAssignment(driver.profile.id, offer.id, { expectedVersion: offer.version });
    const after = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { pricingQuoteId: true, priceEstimate: true, pricingSubtotal: true, pricingTaxAmount: true, pricingSnapshot: true, currentDriverProfileId: true } });

    expect(after.pricingQuoteId).toBe(before.pricingQuoteId);
    expect(after.priceEstimate?.toFixed(2)).toBe(before.priceEstimate?.toFixed(2));
    expect(after.pricingSubtotal?.toFixed(2)).toBe(before.pricingSubtotal?.toFixed(2));
    expect(after.pricingTaxAmount?.toFixed(2)).toBe(before.pricingTaxAmount?.toFixed(2));
    expect(after.pricingSnapshot).toEqual(before.pricingSnapshot);
    expect(after.currentDriverProfileId).toBe(driver.profile.id);
  });
});
