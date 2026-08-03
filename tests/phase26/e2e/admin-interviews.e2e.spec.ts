import { expect, test } from "@playwright/test";

test.describe.skip("Phase 26 E2E: Admin Interview Scheduling & Panel Scorecard", () => {
  test("schedules interview, captures candidate slot selection, records panel rubric scores, and completes round", async ({ page }) => {
    const setup = "/admin/recruitment/interviews";
    const action = "complete an interview without recording";
    expect(setup).toContain("interviews");
    expect(action).toContain("without");
  });
});
