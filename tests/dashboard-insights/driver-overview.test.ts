import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import {
  DriverHomePage,
  type DriverHomePageProps,
} from "@/components/protected-v2/driver/DriverHomePage";
const base = {
  driver: {
    displayName: "Test driver",
    status: "ACTIVE",
    availability: "AVAILABLE",
    vehicleType: "CAR",
    serviceRegions: [],
  },
  assignments: [],
} as unknown as DriverHomePageProps;
function assignment(status: string, orderStatus: string) {
  return {
    id: "assignment-1",
    orderNumber: "KT-001",
    status,
    statusLabel: status,
    orderStatus,
    pickupCity: "Cape Town",
    dropoffCity: "Bellville",
    assignedAt: new Date("2026-10-20T08:00:00Z"),
  } as DriverHomePageProps["assignments"][number];
}
describe("Driver overview actions", () => {
  it("presents an assigned offer as a decision rather than an active run", () => {
    const html = renderToStaticMarkup(
      React.createElement(DriverHomePage, {
        ...base,
        assignments: [assignment("ASSIGNED", "CONFIRMED")],
      }),
    );
    expect(html).toContain("Offer awaiting your decision");
    expect(html).toContain("Review assignment ↗");
    expect(html).not.toContain('aria-label="Assignment stop sequence"');
  });
  it("preserves the existing next-action component for an accepted delivery", () => {
    const html = renderToStaticMarkup(
      React.createElement(DriverHomePage, {
        ...base,
        assignments: [assignment("ACCEPTED", "IN_TRANSIT")],
      }),
    );
    expect(html).toContain('aria-label="Assignment stop sequence"');
    expect(html).toContain('href="/driver/assignments/assignment-1"');
    expect(html).toContain("Open assignment");
  });
  it("does not imply readiness when its source is unavailable", () => {
    const html = renderToStaticMarkup(
      React.createElement(DriverHomePage, base),
    );
    expect(html).toContain("Readiness information is unavailable");
    expect(html).not.toContain("Ready to receive dispatch assignments.");
    expect(html).toContain("No assignments yet.");
  });
});
