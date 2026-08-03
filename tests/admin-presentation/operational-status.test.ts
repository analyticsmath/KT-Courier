import { describe, expect, it } from "vitest";
import { presentAssignmentStatus, presentOrderStatus } from "@/lib/admin-presentation/operational-status";

describe("administrative operational status presentation", () => {
  it("keeps action-required courier states distinct", () => {
    expect(presentOrderStatus("PENDING")).toMatchObject({ label: "Awaiting confirmation", tone: "warning", actionRequired: true });
    expect(presentOrderStatus("DELIVERY_ATTEMPTED")).toMatchObject({ label: "Delivery attempted", tone: "warning", actionRequired: true });
    expect(presentOrderStatus("DELIVERED")).toMatchObject({ label: "Delivered", terminal: true, actionRequired: false });
  });

  it("does not treat an unknown source state as successful or actionable", () => {
    expect(presentOrderStatus("NOT_A_REAL_STATUS")).toMatchObject({ label: "Status unavailable", tone: "neutral", actionRequired: false });
    expect(presentAssignmentStatus("NOT_A_REAL_ASSIGNMENT")).toMatchObject({ label: "Status unavailable", tone: "neutral", actionRequired: false });
  });
});
