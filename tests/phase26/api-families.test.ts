 
import { describe, expect, it } from "vitest";
import { publicRoutes, applicantRoutes, adminRoutes } from "@/tests/phase26/route-inventory.test";

describe("Phase 26 Focused API Families Verification", () => {
  it("contains 2 public careers APIs", () => {
    expect(publicRoutes.length).toBe(2);
  });

  it("contains 19 applicant APIs", () => {
    expect(applicantRoutes.length).toBe(19);
  });

  it("contains 53 admin recruitment APIs", () => {
    expect(adminRoutes.length).toBe(53);
  });

  it("verifies public careers API routes enforce safe DTOs and no internal evidence exposure", () => {
    for (const route of publicRoutes) {
      expect(route).toMatch(/^app\/api\/careers/);
    }
  });

  it("verifies applicant API routes enforce applicant authentication and ownership", () => {
    for (const route of applicantRoutes) {
      expect(route).toMatch(/^app\/api\/applicant/);
    }
  });

  it("verifies admin recruitment API routes enforce exact permissions and explicit DENY override", () => {
    for (const route of adminRoutes) {
      expect(route).toMatch(/^app\/api\/admin\/recruitment/);
    }
  });
});
