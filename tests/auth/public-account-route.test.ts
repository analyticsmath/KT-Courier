import { describe, expect, it } from "vitest";
import { publicAccountRoute } from "@/components/public-v3/navigation/use-public-account-route";

describe("public marketplace links use the SAME account role", () => {
  it.each([
    ["CUSTOMER", "/account"],
    ["STORE", "/store"],
    ["DRIVER", "/driver"],
    ["ADMIN", "/admin"],
    ["SUPER_ADMIN", "/admin"],
    ["PROMOTER", "/promoter"],
    [null, "/login"],
    ["unknown", "/login"],
    ["../admin", "/login"],
  ])("routes only a known authenticated role %s to %s", (role, expected) => {
    expect(publicAccountRoute(role)).toBe(expected);
  });
});
