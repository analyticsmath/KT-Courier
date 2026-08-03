import { describe, expect, it } from "vitest";
import { OrderAssignmentEventType, OrderAssignmentStatus, OrderStatus, UserRole } from "@/types/db";
import { acceptDispatchAssignment, offerAssignment, reassignDispatchOrder, unassignDispatchOrder } from "@/lib/services/dispatch-assignment.service";
import { createDispatchOrder, createDriver, createRegion, createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

describe("Phase 7.5 live dispatch lifecycle", () => {
  it("keeps the accepted-driver pointer and pricing snapshot consistent through accept, reassign, and unassign", async () => {
    const tag = uniqueTag("dispatch-lifecycle");
    const admin = await createUser(`${tag}-admin`, UserRole.ADMIN);
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const region = await createRegion(tag);
    const firstDriver = await createDriver(`${tag}-first`, region.id);
    const secondDriver = await createDriver(`${tag}-second`, region.id);
    const order = await createDispatchOrder(tag, customer.id, region.id);
    const pricingBefore = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { priceEstimate: true, pricingSubtotal: true, pricingTaxAmount: true, pricingSnapshot: true } });

    const offer = await offerAssignment(admin.id, order.id, { driverProfileId: firstDriver.profile.id, reasonCode: "INITIAL" });
    await expect(acceptDispatchAssignment(secondDriver.profile.id, offer.id, { expectedVersion: offer.version })).rejects.toMatchObject({ code: "DISPATCH_ASSIGNMENT_NOT_FOUND" });
    const accepted = await acceptDispatchAssignment(firstDriver.profile.id, offer.id, { expectedVersion: offer.version });
    await acceptDispatchAssignment(firstDriver.profile.id, offer.id, { expectedVersion: offer.version });
    const acceptedOrder = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(acceptedOrder.currentDriverProfileId).toBe(firstDriver.profile.id);
    expect(acceptedOrder.status).toBe(OrderStatus.PICKUP_SCHEDULED);
    expect(await integrationPrisma.orderAssignmentEvent.count({ where: { assignmentId: offer.id, eventType: OrderAssignmentEventType.ASSIGNMENT_ACCEPTED } })).toBe(1);

    const replacement = await reassignDispatchOrder(admin.id, order.id, {
      currentAssignmentId: accepted.id,
      expectedVersion: accepted.version,
      newDriverProfileId: secondDriver.profile.id,
      reasonCode: "REBALANCE",
    });
    const old = await integrationPrisma.orderAssignment.findUniqueOrThrow({ where: { id: offer.id } });
    const reassignedOrder = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(old.status).toBe(OrderAssignmentStatus.SUPERSEDED);
    expect(replacement.status).toBe(OrderAssignmentStatus.ASSIGNED);
    expect(reassignedOrder.currentDriverProfileId).toBeNull();

    await unassignDispatchOrder(admin.id, order.id, { assignmentId: replacement.id, expectedVersion: replacement.version, reasonCode: "CUSTOMER_REQUEST" });
    const finalAssignment = await integrationPrisma.orderAssignment.findUniqueOrThrow({ where: { id: replacement.id } });
    const finalOrder = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const pricingAfter = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { priceEstimate: true, pricingSubtotal: true, pricingTaxAmount: true, pricingSnapshot: true } });

    expect(finalAssignment.status).toBe(OrderAssignmentStatus.REVOKED);
    expect(finalAssignment.activeOrderGuard).toBeNull();
    expect(finalOrder.currentDriverProfileId).toBeNull();
    expect(pricingAfter).toEqual(pricingBefore);
  });

  it("blocks reassignment and unassignment after custody begins without mutating the current offer", async () => {
    const tag = uniqueTag("dispatch-custody");
    const admin = await createUser(`${tag}-admin`, UserRole.ADMIN);
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const region = await createRegion(tag);
    const driver = await createDriver(`${tag}-driver`, region.id);
    const replacement = await createDriver(`${tag}-replacement`, region.id);
    const order = await createDispatchOrder(tag, customer.id, region.id);
    const offer = await offerAssignment(admin.id, order.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" });
    await integrationPrisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.PICKED_UP } });

    await expect(reassignDispatchOrder(admin.id, order.id, { currentAssignmentId: offer.id, expectedVersion: offer.version, newDriverProfileId: replacement.profile.id, reasonCode: "REBALANCE" })).rejects.toMatchObject({ code: "DISPATCH_UNASSIGNMENT_BLOCKED" });
    await expect(unassignDispatchOrder(admin.id, order.id, { assignmentId: offer.id, expectedVersion: offer.version, reasonCode: "CUSTOMER_REQUEST" })).rejects.toMatchObject({ code: "DISPATCH_UNASSIGNMENT_BLOCKED" });
    expect((await integrationPrisma.orderAssignment.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe(OrderAssignmentStatus.ASSIGNED);
  });
});
