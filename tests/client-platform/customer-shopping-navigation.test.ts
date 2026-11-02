import { describe, expect, it } from "vitest";
import { projectProtectedNavigation } from "@/lib/protected-navigation/protected-navigation-registry";

describe("customer parcel and marketplace entry", () => {
  it("shows a working Shop destination in the customer workspace and mobile destinations", () => {
    const projection = projectProtectedNavigation("CUSTOMER", new Set());
    const items = projection.groups.flatMap((group) => group.items);
    expect(items).toContainEqual(expect.objectContaining({ id: "customer-shop", label: "Shop", href: "/shop" }));
    expect(projection.mobileNavigation.map((item) => item.id)).toContain("customer-shop");
    expect(projection.mobileNavigation.length).toBeLessThanOrEqual(5);
  });
  it("does not add the customer navigation item to driver, seller or platform admin contexts", () => {
    for (const context of ["DRIVER", "STORE", "ADMIN"] as const) {
      expect(projectProtectedNavigation(context, new Set()).groups.flatMap((group) => group.items).some((item) => item.id === "customer-shop")).toBe(false);
    }
  });
});
