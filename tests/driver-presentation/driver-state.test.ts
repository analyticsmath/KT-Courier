import { describe, expect, it } from "vitest";
import { prioritiseDriverAssignments } from "@/lib/driver-presentation/assignment-priority";
import { getDriverNextAction, getDriverOperationalPresentation } from "@/lib/driver-presentation/driver-state";

const assignment = (overrides: Partial<{ id: string; status: string; orderStatus: string; assignedAt: string; acceptedAt: string | null; expiresAt: string | null }> = {}) => ({ id: "assignment-1", status: "ACCEPTED", orderStatus: "CONFIRMED", assignedAt: "2026-07-01T09:00:00.000Z", acceptedAt: "2026-07-01T09:05:00.000Z", expiresAt: null, ...overrides });

describe("driver operational presentation", () => {
  it("puts a suspended account ahead of any assignment", () => {
    expect(getDriverOperationalPresentation({ status: "SUSPENDED", availability: "AVAILABLE", assignments: [assignment({ orderStatus: "IN_TRANSIT" })] }).state).toBe("ACCOUNT_SUSPENDED");
  });

  it("puts active delivery ahead of pickup and offers", () => {
    const state = getDriverOperationalPresentation({ status: "ACTIVE", availability: "AVAILABLE", assignments: [assignment({ id: "offer", status: "ASSIGNED", orderStatus: "CONFIRMED", expiresAt: "2026-07-01T10:00:00.000Z" }), assignment({ id: "pickup", orderStatus: "PICKUP_SCHEDULED" }), assignment({ id: "delivery", orderStatus: "IN_TRANSIT" })] });
    expect(state).toMatchObject({ state: "ACTIVE_DELIVERY", assignmentId: "delivery" });
  });

  it("keeps unknown availability visible instead of treating it as available", () => {
    expect(getDriverOperationalPresentation({ status: "ACTIVE", availability: "UNKNOWN_SOURCE_VALUE", assignments: [] }).state).toBe("SOURCE_UNAVAILABLE");
  });
});

describe("driver assignment ordering", () => {
  it("orders delivery work, then pickup, then earliest expiring offers", () => {
    const ordered = prioritiseDriverAssignments([
      assignment({ id: "offer-late", status: "ASSIGNED", expiresAt: "2026-07-01T12:00:00.000Z" }),
      assignment({ id: "pickup", orderStatus: "PICKUP_SCHEDULED" }),
      assignment({ id: "delivery", orderStatus: "IN_TRANSIT" }),
      assignment({ id: "offer-early", status: "ASSIGNED", expiresAt: "2026-07-01T10:00:00.000Z" }),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["delivery", "pickup", "offer-early", "offer-late"]);
  });

  it("uses only a canonical display label for each known next action", () => {
    expect(getDriverNextAction(assignment({ status: "ASSIGNED" }))).toBe("Review assignment");
    expect(getDriverNextAction(assignment({ orderStatus: "DELIVERY_ATTEMPTED" }))).toBe("Review delivery attempt");
  });
});
