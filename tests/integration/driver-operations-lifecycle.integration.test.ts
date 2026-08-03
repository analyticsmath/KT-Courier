import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { OrderAssignmentStatus, OrderStatus, UserRole } from "@/types/db";
import { acceptDispatchAssignment, offerAssignment } from "@/lib/services/dispatch-assignment.service";
import { completePickup } from "@/lib/services/pickup-custody.service";
import { resumeDelivery, startDelivery, recordDeliveryAttempted } from "@/lib/services/delivery-execution.service";
import { createDispatchOrder, createDriver, createRegion, createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

describe("Phase 8 live driver operations lifecycle", () => {
  it("establishes custody, starts transit, records a retryable attempt, and preserves pricing", async () => {
    const tag = uniqueTag("driver-ops-life");
    const admin = await createUser(`${tag}-admin`, UserRole.ADMIN);
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const region = await createRegion(tag);
    const driver = await createDriver(`${tag}-driver`, region.id);
    const order = await createDispatchOrder(tag, customer.id, region.id);
    const prices = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { priceEstimate: true, pricingSubtotal: true, pricingTaxAmount: true, pricingSnapshot: true } });
    const offered = await offerAssignment(admin.id, order.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" });
    const accepted = await acceptDispatchAssignment(driver.profile.id, offered.id, { expectedVersion: offered.version });

    expect((await completePickup(accepted.id, driver.profile.id, driver.user.id, { operationId: randomUUID(), assignmentVersion: accepted.version, parcelCount: 1, parcelCondition: "GOOD", confirmPickup: true })).ok).toBe(true);
    const pickedUp = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(pickedUp.status).toBe(OrderStatus.PICKED_UP);
    expect(pickedUp.custodyEstablishedAt).not.toBeNull();

    const assignment = await integrationPrisma.orderAssignment.findUniqueOrThrow({ where: { id: accepted.id } });
    expect((await startDelivery(accepted.id, driver.profile.id, driver.user.id, { operationId: randomUUID(), assignmentVersion: assignment.version })).ok).toBe(true);
    const afterTransit = await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(afterTransit.status).toBe(OrderStatus.IN_TRANSIT);
    expect(afterTransit.transitStartedAt).not.toBeNull();

    const current = await integrationPrisma.orderAssignment.findUniqueOrThrow({ where: { id: accepted.id } });
    expect((await recordDeliveryAttempted(accepted.id, driver.profile.id, driver.user.id, { operationId: randomUUID(), assignmentVersion: current.version, reason: "RECIPIENT_UNAVAILABLE", driverNote: "No response" })).ok).toBe(true);
    expect(await integrationPrisma.deliveryAttempt.count({ where: { orderId: order.id } })).toBe(1);
    expect(await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } })).toMatchObject({ status: OrderStatus.DELIVERY_ATTEMPTED });
    expect(await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { priceEstimate: true, pricingSubtotal: true, pricingTaxAmount: true, pricingSnapshot: true } })).toEqual(prices);
    expect((await integrationPrisma.orderAssignment.findUniqueOrThrow({ where: { id: accepted.id } })).status).toBe(OrderAssignmentStatus.ACCEPTED);

    const retryAssignment = await integrationPrisma.orderAssignment.findUniqueOrThrow({ where: { id: accepted.id } });
    expect((await resumeDelivery(accepted.id, driver.profile.id, driver.user.id, { operationId: randomUUID(), assignmentVersion: retryAssignment.version })).ok).toBe(true);
    expect((await integrationPrisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(OrderStatus.IN_TRANSIT);
  });
});
