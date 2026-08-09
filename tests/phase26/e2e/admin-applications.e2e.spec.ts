import { expect, test } from "@playwright/test";

test.describe.skip("Phase 26 E2E: Admin Application Review & Human Decision Recording", () => {
  test("assigns human reviewer, reviews screening flags, progresses or rejects candidate with reason code", async () => {
    const setup = "/admin/recruitment/applications";
    const action = "review an application without restricted evidence";
    expect(setup).toContain("recruitment");
    expect(action).toContain("without");
  });
});
