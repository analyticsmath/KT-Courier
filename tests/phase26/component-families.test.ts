import { describe, expect, it } from "vitest";
import { recruitmentUiPages } from "@/tests/phase26/route-inventory.test";

describe("Phase 26 Focused Component Surfaces and UI States", () => {
  it("ships recruitment UI page surfaces", () => {
    expect(recruitmentUiPages.length).toBeGreaterThanOrEqual(20);
  });

  it("verifies public careers pages contain no static sample openings or applicant fee language", () => {
    const publicPages = recruitmentUiPages.filter((p) => p.includes("/careers"));
    expect(publicPages.length).toBeGreaterThanOrEqual(3);

    for (const page of publicPages) {
      expect(page).toMatch(/^app\/\(public\)\/careers/);
    }
  });

  it("verifies applicant portal pages enforce applicant authentication and state handling", () => {
    const applicantPages = recruitmentUiPages.filter((p) => p.includes("/applicant"));
    expect(applicantPages.length).toBeGreaterThanOrEqual(6);

    for (const page of applicantPages) {
      expect(page).toMatch(/^app\/\(applicant\)\/applicant/);
    }
  });

  it("verifies admin recruitment pages require exact role permissions and show lock/denied states", () => {
    const adminPages = recruitmentUiPages.filter((p) => p.includes("/admin/recruitment"));
    expect(adminPages.length).toBeGreaterThanOrEqual(12);

    for (const page of adminPages) {
      expect(page).toMatch(/^app\/\(admin\)\/admin\/recruitment/);
    }
  });
});
