import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import {
  summariseOrderCohort,
  summariseDriverAssignments,
} from "@/lib/dashboard-insights/workflow-summary";
import { DeliveryHealth } from "@/components/protected-v2/studio/DeliveryHealth";

describe("Workflow analytics", () => {
  it("accounts for every assignment lifecycle state without losing expired or revoked records", () => {
    const rows = [
      "COMPLETED",
      "ASSIGNED",
      "ACCEPTED",
      "EXPIRED",
      "REVOKED",
      "SUPERSEDED",
      "CANCELLED",
      "REJECTED",
    ].map((status) => ({ status, orderStatus: "CONFIRMED" }));
    const summary = summariseDriverAssignments(rows);
    expect(summary).toEqual({
      total: 8,
      completed: 1,
      offers: 1,
      active: 1,
      other: 5,
    });
    expect(
      summary.completed + summary.offers + summary.active + summary.other,
    ).toBe(summary.total);
  });
  it("does not count accepted assignments against terminal orders as active work", () => {
    expect(
      summariseDriverAssignments([
        { status: "ACCEPTED", orderStatus: "DELIVERED" },
      ]),
    ).toEqual({ total: 1, completed: 0, offers: 0, active: 0, other: 1 });
  });
  it("derives a cohort share from complete counts and retains unrecognized states", () => {
    const rows = [
      { status: "DELIVERED", _count: { _all: 3 } },
      { status: "PENDING", _count: { _all: 1 } },
      { status: "NEW_STATE", _count: { _all: 2 } },
    ];
    expect(summariseOrderCohort(rows)).toEqual({
      total: 6,
      delivered: 3,
      active: 0,
      attention: 1,
      other: 2,
      deliveredShare: 50,
    });
  });
  it("uses unavailable share for an empty cohort and labels the scope", () => {
    expect(summariseOrderCohort([]).deliveredShare).toBeNull();
    const html = renderToStaticMarkup(
      React.createElement(DeliveryHealth, { rows: [] }),
    );
    expect(html).toContain(
      "Current states of orders created in the selected period.",
    );
    expect(html).toContain("—");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("100%");
  });
});
