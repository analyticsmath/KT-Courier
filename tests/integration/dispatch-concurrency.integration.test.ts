import { describe, expect, it } from "vitest";
import { OrderAssignmentStatus, OrderAssignmentEventType, OrderOperationalEventType, UserRole } from "@/types/db";
import { offerAssignment, acceptDispatchAssignment, reconcileExpiredDispatchOffers } from "@/lib/services/dispatch-assignment.service";
import { createDispatchOrder, createDriver, createRegion, createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

describe("Phase 7.5 live dispatch races", () => {
  it("permits only one current assignment when two administrators offer the same order", async () => {
    const tag = uniqueTag("dispatch-same-order");
    const adminA = await createUser(`${tag}-admin-a`, UserRole.ADMIN);
    const adminB = await createUser(`${tag}-admin-b`, UserRole.ADMIN);
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const region = await createRegion(tag);
    const first = await createDriver(`${tag}-first`, region.id);
    const second = await createDriver(`${tag}-second`, region.id);
    const order = await createDispatchOrder(tag, customer.id, region.id);

    const outcomes = await Promise.allSettled([
      offerAssignment(adminA.id, order.id, { driverProfileId: first.profile.id, reasonCode: "INITIAL" }),
      offerAssignment(adminB.id, order.id, { driverProfileId: second.profile.id, reasonCode: "INITIAL" }),
    ]);
    const current = await integrationPrisma.orderAssignment.findMany({ where: { orderId: order.id, status: { in: [OrderAssignmentStatus.ASSIGNED, OrderAssignmentStatus.ACCEPTED] } } });

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(current).toHaveLength(1);
    expect(current[0]?.activeOrderGuard).toBe(order.id);
    expect(await integrationPrisma.orderAssignmentEvent.count({ where: { orderId: order.id, eventType: OrderAssignmentEventType.ASSIGNMENT_CREATED } })).toBe(1);
    expect(await integrationPrisma.orderOperationalEvent.count({ where: { orderId: order.id, eventType: OrderOperationalEventType.ASSIGNMENT_OFFERED } })).toBe(1);
  });

  it("serializes a same-driver capacity race across two orders", async () => {
    const tag = uniqueTag("dispatch-capacity");
    const admin = await createUser(`${tag}-admin`, UserRole.ADMIN);
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const region = await createRegion(tag);
    const driver = await createDriver(`${tag}-driver`, region.id, 1);
    const firstOrder = await createDispatchOrder(`${tag}-one`, customer.id, region.id);
    const secondOrder = await createDispatchOrder(`${tag}-two`, customer.id, region.id);

    const outcomes = await Promise.allSettled([
      offerAssignment(admin.id, firstOrder.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" }),
      offerAssignment(admin.id, secondOrder.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" }),
    ]);
    const active = await integrationPrisma.orderAssignment.count({ where: { driverProfileId: driver.profile.id, status: { in: [OrderAssignmentStatus.ASSIGNED, OrderAssignmentStatus.ACCEPTED] } } });

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect(active).toBe(1);
  });

  it("resolves accept-versus-expiry exactly once", async () => {
    const tag = uniqueTag("dispatch-expiry");
    const admin = await createUser(`${tag}-admin`, UserRole.ADMIN);
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const region = await createRegion(tag);
    const driver = await createDriver(`${tag}-driver`, region.id);
    const order = await createDispatchOrder(tag, customer.id, region.id);
    const offer = await offerAssignment(admin.id, order.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" });
    await integrationPrisma.orderAssignment.update({ where: { id: offer.id }, data: { expiresAt: new Date(Date.now() - 1) } });

    await Promise.allSettled([
      acceptDispatchAssignment(driver.profile.id, offer.id, { expectedVersion: offer.version }),
      reconcileExpiredDispatchOffers(),
    ]);
    const resolved = await integrationPrisma.orderAssignment.findUniqueOrThrow({ where: { id: offer.id } });
    const orderAfter = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id } });

    expect(resolved.status).toBe(OrderAssignmentStatus.EXPIRED);
    expect(resolved.activeOrderGuard).toBeNull();
    expect(orderAfter.currentDriverProfileId).toBeNull();
    expect(await integrationPrisma.orderAssignmentEvent.count({ where: { assignmentId: offer.id, eventType: OrderAssignmentEventType.ASSIGNMENT_EXPIRED } })).toBe(1);
  });
});
