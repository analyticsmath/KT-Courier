import { describe, expect, it } from "vitest";
import {
  isCinematicDestination,
  routeMotionLabel,
} from "@/components/public-v3/redesign/route-motion-policy";

describe("public navigation choreography boundaries", () => {
  it.each([
    "/",
    "/about",
    "/services",
    "/services/parcel",
    "/services/freight",
    "/track",
    "/quote",
    "/contact",
  ])("animates the public destination %s", (path) => {
    expect(isCinematicDestination(path)).toBe(true);
    expect(routeMotionLabel(path).length).toBeGreaterThan(0);
  });
  it.each([
    "/shop",
    "/shop/products/box",
    "/cart",
    "/checkout",
    "/checkout/reference",
    "/login",
    "/account/orders",
    "/admin",
    "/store",
    "/services-not-a-route",
  ])("does not intercept the task route %s", (path) => {
    expect(isCinematicDestination(path)).toBe(false);
  });
});
