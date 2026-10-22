import { describe, expect, it } from "vitest";
import { requiredDomainDefinition } from "@/lib/notifications/required-domain-definitions";

describe("email copy aligned with real courier milestones", () => {
  it("tells customers clearly what their order and pickup states actually mean", () => {
    const order = requiredDomainDefinition("MARKETPLACE", "MARKETPLACE_ORDER_CONFIRMED");
    const vendor = requiredDomainDefinition("STORE_ORDERS", "STORE_ORDER_RECEIVED");
    expect(order?.body).toContain("{{orderNumber}}");
    expect(order?.body).toContain("stores");
    expect(vendor?.body).toContain("{{orderNumber}}");
    expect(vendor?.body).toContain("review");
  });

  it("uses event-specific progress language without invented arrival promises", () => {
    const names = [
      "COURIER_DRIVER_ASSIGNED",
      "COURIER_PICKED_UP",
      "COURIER_IN_TRANSIT",
      "COURIER_DELIVERY_ATTEMPTED",
      "COURIER_DELIVERED",
      "COURIER_FAILED",
    ];
    const all = names.map((eventType) => requiredDomainDefinition("STORE_ORDERS", eventType));
    expect(all.every(Boolean)).toBe(true);
    expect(new Set(all.map((item) => item?.title)).size).toBe(names.length);
    for (const item of all) {
      expect(item?.body).toContain("{{orderNumber}}");
      expect(item?.body).not.toMatch(/guaranteed|tomorrow|arriving now|exact arrival/i);
      expect(item?.variables).toContain("orderNumber");
    }
    expect(all[4]?.body).toMatch(/delivered/i);
    expect(all[5]?.body).toMatch(/could not|failed/i);
  });
});
