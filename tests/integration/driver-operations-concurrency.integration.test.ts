import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { UserRole } from "@/types/db";
import { acceptDispatchAssignment, offerAssignment } from "@/lib/services/dispatch-assignment.service";
import { completePickup } from "@/lib/services/pickup-custody.service";
import { createDispatchOrder, createDriver, createRegion, createUser, integrationPrisma, uniqueTag } from "./phase7-5-fixtures";

describe("Phase 8 live driver operation concurrency", () => {
  it("keeps a same-id pickup retry to one custody event", async () => {
    const tag = uniqueTag("driver-ops-race");
    const admin = await createUser(`${tag}-admin`, UserRole.ADMIN);
    const customer = await createUser(`${tag}-customer`, UserRole.CUSTOMER);
    const region = await createRegion(tag);
    const driver = await createDriver(`${tag}-driver`, region.id);
    const order = await createDispatchOrder(tag, customer.id, region.id);
    const offered = await offerAssignment(admin.id, order.id, { driverProfileId: driver.profile.id, reasonCode: "INITIAL" });
    const accepted = await acceptDispatchAssignment(driver.profile.id, offered.id, { expectedVersion: offered.version });
    const input = { operationId: randomUUID(), assignmentVersion: accepted.version, parcelCount: 1, parcelCondition: "GOOD" as const, confirmPickup: true as const };
    await Promise.all([completePickup(accepted.id, driver.profile.id, driver.user.id, input), completePickup(accepted.id, driver.profile.id, driver.user.id, input)]);
    expect(await integrationPrisma.driverOperationCommand.count({ where: { orderId: order.id, operationId: input.operationId, completedAt: { not: null } } })).toBe(1);
  });
});
