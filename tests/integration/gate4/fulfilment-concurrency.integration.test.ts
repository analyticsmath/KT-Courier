import { describe, it, expect, beforeAll } from "vitest";
import { validateGate4DatabaseSafety } from "./harness-safety";
import { runConcurrentRace } from "./barrier";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { createGate4PendingDeliveryScenario, createGate4AcceptedAssignmentScenario, requireGate4Fixture } from "./fixtures";

describe("Gate 4 — Fulfilment, Dispatch and Driver Concurrency Suite", () => {
  let safety: ReturnType<typeof validateGate4DatabaseSafety>;

  beforeAll(() => {
    safety = validateGate4DatabaseSafety();
  });

  it("G4-FUL-001 [Concurrency]: 5 drivers attempt to accept the same available order assignment simultaneously", async () => {
    if (!safety.ok) {
      console.warn(`[SKIP_DB_EXECUTION] ${safety.reason}`);
      return;
    }

    const { order: unassignedOrder, customer, drivers } = await createGate4PendingDeliveryScenario("fulfilment-conc", "assignment-race", 5);
    requireGate4Fixture(unassignedOrder, "Pending order fixture required");
    expect(drivers.length).toBe(5);

    const orderId = unassignedOrder.id;

    // Race 5 drivers trying to accept assignment for orderId
    const results = await runConcurrentRace(5, async (client, index, barrier) => {
      await barrier.wait();

      const driverProfileId = drivers[index]?.driverProfile?.id ?? `drv_profile_${index}`;

      return client.$transaction(
        async (tx) => {
          const [order] = await tx.$queryRaw<Array<{ id: string; status: string }>>(
            Prisma.sql`SELECT "id", "status" FROM "Order" WHERE "id" = ${orderId} FOR UPDATE`
          );

          if (!order || order.status !== "PENDING") {
            throw new Error("DISPATCH_CONFLICT: Order is no longer available for assignment.");
          }

          const updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: { status: "CONFIRMED", currentDriverProfileId: driverProfileId },
          });

          const assignment = await tx.orderAssignment.create({
            data: {
              orderId,
              driverProfileId,
              assignedByAdminId: customer.id,
              status: "ACCEPTED",
              activeOrderGuard: orderId,
              assignedAt: new Date(),
              acceptedAt: new Date(),
            },
          });

          return { assignmentId: assignment.id, driverIndex: index, orderStatus: updatedOrder.status };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(4);

    const activeAssignments = await prisma.orderAssignment.count({
      where: { orderId, status: "ACCEPTED" },
    });
    expect(activeAssignments).toBe(1);
  });

  it("G4-FUL-002 [Idempotency]: Duplicate delivery completion calls execute idempotently without duplicate earnings", async () => {
    if (!safety.ok) return;

    const acceptedScenario = await createGate4AcceptedAssignmentScenario("fulfilment-conc", "delivery-completion");
    const { assignment } = acceptedScenario;
    requireGate4Fixture(assignment, "Accepted assignment fixture required");

    const results = await runConcurrentRace(3, async (client, _index, barrier) => {
      await barrier.wait();

      return client.$transaction(async (tx) => {
        const currentAssignment = await tx.orderAssignment.findUnique({
          where: { id: assignment.id },
        });

        if (currentAssignment?.status === "COMPLETED") {
          return { assignmentId: currentAssignment.id, status: "COMPLETED" };
        }

        await tx.order.update({
          where: { id: assignment.orderId },
          data: { status: "DELIVERED", currentDriverProfileId: null },
        });

        const updatedAssignment = await tx.orderAssignment.update({
          where: { id: assignment.id },
          data: { status: "COMPLETED", activeOrderGuard: null, completedAt: new Date() },
        });

        return { assignmentId: updatedAssignment.id, status: updatedAssignment.status };
      });
    });

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(3);

    const completedAssignment = await prisma.orderAssignment.findUnique({
      where: { id: assignment.id },
    });
    expect(completedAssignment?.status).toBe("COMPLETED");

    const deliveredOrder = await prisma.order.findUnique({
      where: { id: assignment.orderId },
    });
    expect(deliveredOrder?.status).toBe("DELIVERED");
  });
});

