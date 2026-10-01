import { beforeEach, describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({
  order: { findFirst: vi.fn() },
  deliveryReview: { create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  adminActivityLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: access }));
import {
  submitDeliveryReview,
  replyDeliveryReview,
  listDeliveryReviews,
  DeliveryReviewSchema,
} from "@/lib/client-platform/reviews.service";
const input = {
  orderId: "corder12345678901234567890",
  rating: 5,
  body: "Delivered with care.",
};
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) =>
    fn(db),
  );
  access.mockResolvedValue({ store: { id: "business-1" } });
  db.order.findFirst.mockResolvedValue({
    id: input.orderId,
    storeId: "business-1",
  });
  db.deliveryReview.create.mockResolvedValue({ id: "review-1" });
  db.deliveryReview.findMany.mockResolvedValue([]);
  db.deliveryReview.updateMany.mockResolvedValue({ count: 1 });
});
describe("delivery reviews", () => {
  it("requires the actual customer and completed delivery", async () => {
    await submitDeliveryReview("customer", input);
    expect(db.order.findFirst.mock.calls[0][0].where).toEqual({
      id: input.orderId,
      customerId: "customer",
      status: { in: ["DELIVERED", "COMPLETED"] },
    });
    expect(db.deliveryReview.create.mock.calls[0][0].data.authorUserId).toBe(
      "customer",
    );
  });
  it("rejects foreign or incomplete deliveries before creating a review", async () => {
    db.order.findFirst.mockResolvedValue(null);
    await expect(
      submitDeliveryReview("other-customer", input),
    ).rejects.toMatchObject({ status: 403 });
    expect(db.deliveryReview.create).not.toHaveBeenCalled();
  });
  it("scopes review lists to the business and review module", async () => {
    await listDeliveryReviews("employee", true);
    expect(access).toHaveBeenCalledWith("employee", "reviews");
    expect(db.deliveryReview.findMany.mock.calls[0][0].where).toEqual({
      storeId: "business-1",
    });
  });
  it("does not reply to another business's review", async () => {
    db.deliveryReview.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      replyDeliveryReview("employee", "foreign", "Thank you."),
    ).rejects.toMatchObject({ status: 404 });
    expect(db.deliveryReview.updateMany.mock.calls[0][0].where).toEqual({
      id: "foreign",
      storeId: "business-1",
    });
  });
  it("audits the actual replying employee", async () => {
    await replyDeliveryReview("employee", "review-1", "Thank you.");
    expect(db.adminActivityLog.create.mock.calls[0][0].data.actorUserId).toBe(
      "employee",
    );
    expect(
      db.deliveryReview.updateMany.mock.calls[0][0].data.respondedByUserId,
    ).toBe("employee");
  });
  it.each([0, 6, 2.5])("rejects invalid rating %s", (rating) => {
    expect(DeliveryReviewSchema.safeParse({ ...input, rating }).success).toBe(
      false,
    );
  });
});
