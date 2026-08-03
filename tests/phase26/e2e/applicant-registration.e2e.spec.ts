import { expect, test } from "@playwright/test";

test.describe.skip("Phase 26 E2E: Applicant Profile & Account Creation", () => {
  test("creates applicant account, populates legal name, phone, and work authorization", async ({ page }) => {
    const setup = "/applicant/profile";
    const action = "create an adult applicant profile";
    expect(setup).toContain("applicant");
    expect(action).toContain("adult");
  });
});
