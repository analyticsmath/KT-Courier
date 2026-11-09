import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { submitDriverReview, getAdminDriverReviewOverview, listMyDriverReviewOpportunities } from "@/lib/client-platform/driver-reviews.service";

const runId = randomUUID();
const ids = { customer: "", other: "", driverUser: "", driver: "", order: "", assignment: "", admin: "" };
describe("real courier reviews are exclusively for customer-owned completed deliveries", () => {
  afterAll(async () => {
    if (!ids.order) return;
    await prisma.$transaction(async tx => {
      await tx.driverReview.deleteMany({ where: { orderId: ids.order } });
      await tx.orderAssignment.deleteMany({ where: { orderId: ids.order } });
      await tx.order.delete({ where: { id: ids.order } });
      await tx.driverProfile.delete({ where: { id: ids.driver } });
      await tx.user.deleteMany({ where: { id: { in: [ids.customer, ids.other, ids.driverUser, ids.admin] } } });
    });
    await prisma.$disconnect();
  });
  it("blocks false authors and pre-completion ratings; records one final-driver rating without double counting", async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" ||
        process.env.KT_NETWORK_DISABLED !== "true" || url.pathname !== "/kt_launch_test" ||
        !["localhost", "127.0.0.1"].includes(url.hostname)) throw Error("Exact disposable review database required.");
    const createUser = (role: "CUSTOMER"|"DRIVER"|"SUPER_ADMIN", tag: string) =>
      prisma.user.create({ data: { email: "driver-review-"+tag+"-"+runId+"@example.test", role, status: "ACTIVE" } });
    const [customer, other, driverUser, admin] = await Promise.all([
      createUser("CUSTOMER", "customer"),createUser("CUSTOMER", "other"),
      createUser("DRIVER", "driver"),createUser("SUPER_ADMIN", "admin"),
    ]);
    Object.assign(ids,{ customer: customer.id, other: other.id, driverUser: driverUser.id, admin: admin.id });
    const driver = await prisma.driverProfile.create({ data: {
      userId: driverUser.id, status: "ACTIVE", active: true,
      driverCode: "TEST-REVIEW-" + runId.replaceAll("-","").slice(0,12),
      displayName: "Disposable tested driver",
    } });
    ids.driver = driver.id;
    // The production pointer guard is deferred; create the order and its
    // matching active assignment in one transaction, never weaken the guard.
    const { order, assignment } = await prisma.$transaction(async tx => {
      const order = await tx.order.create({ data: {
        orderNumber: "KT-DRV-REV-" + runId, customerId: customer.id, source: "CUSTOMER",
        deliveryType: "SAME_DAY", status: "IN_TRANSIT", currentDriverProfileId: driver.id,
      } });
      const assignment = await tx.orderAssignment.create({ data: {
        orderId: order.id, driverProfileId: driver.id, status: "ACCEPTED",
        assignedAt: new Date(), assignedByAdminId: admin.id, activeOrderGuard: order.id,
      } });
      return { order, assignment };
    });
    ids.order = order.id;
    ids.assignment = assignment.id;
    const entry = { orderId: order.id, rating: 5, body: "Delivery driver was courteous and punctual." };
    await expect(submitDriverReview(other.id, entry))
      .rejects.toMatchObject({ code: "DRIVER_REVIEW_NOT_ELIGIBLE" });
    await expect(submitDriverReview(customer.id, entry))
      .rejects.toMatchObject({ code: "DRIVER_REVIEW_NOT_ELIGIBLE" });
    await prisma.order.update({ where: { id: order.id }, data: { status: "COMPLETED" } });
    await expect(submitDriverReview(customer.id, entry))
      .rejects.toMatchObject({ code: "DRIVER_REVIEW_DRIVER_UNVERIFIED" });
    await prisma.$transaction(async tx => {
      await tx.orderAssignment.update({ where: { id: assignment.id }, data: {
        status: "COMPLETED", activeOrderGuard: null, completedAt: new Date(),
      } });
      await tx.order.update({ where: { id: order.id }, data: {
        currentDriverProfileId: null,
      } });
    });
    const opportunities = await listMyDriverReviewOpportunities(customer.id);
    expect(opportunities).toEqual(expect.arrayContaining([
      expect.objectContaining({ orderId: order.id, driverName: "Disposable tested driver" }),
    ]));
    const result = await submitDriverReview(customer.id, entry);
    expect(result).toMatchObject({ rating: 5, body: entry.body });
    await expect(submitDriverReview(customer.id, entry))
      .rejects.toMatchObject({ code: "DRIVER_REVIEW_ALREADY_EXISTS" });
    expect(await prisma.driverReview.count({ where: { orderId: order.id } })).toBe(1);
    expect(await listMyDriverReviewOpportunities(customer.id)).toEqual([]);
    const report = await getAdminDriverReviewOverview({
      id: admin.id, role: "SUPER_ADMIN", status: "ACTIVE", email: admin.email, name: null,
    } as never);
    expect(report.recent).toEqual(expect.arrayContaining([
      expect.objectContaining({ driverId: driver.id, customerId: customer.id, orderNumber: order.orderNumber, rating: 5 }),
    ]));
    const specific = await getAdminDriverReviewOverview({
      id: admin.id, role: "SUPER_ADMIN", status: "ACTIVE", email: admin.email, name: null,
    } as never, { orderNumber: order.orderNumber, driverId: driver.id, customerId: customer.id, rating: 5, page: 1 });
    expect(specific.filteredTotal).toBe(1);
    expect(specific.recent).toHaveLength(1);
    expect(specific.recent[0]).toMatchObject({ customerId: customer.id, driverId: driver.id, orderNumber: order.orderNumber });
    const mismatch = await getAdminDriverReviewOverview({
      id: admin.id, role: "SUPER_ADMIN", status: "ACTIVE", email: admin.email, name: null,
    } as never, { orderNumber: order.orderNumber, rating: 1 });
    expect(mismatch.filteredTotal).toBe(0);
    expect(mismatch.recent).toHaveLength(0);
  });
});
