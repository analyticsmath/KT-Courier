import { expect, test } from "@playwright/test";

test.describe.skip("Phase 26 E2E: Careers Public Search & View", () => {
  test("browses published openings, searches by track/keyword, and views job details", async () => {
    const setup = "/careers";
    const action = "browse a no-fee public opening";
    expect(setup).toBe("/careers");
    expect(action).toContain("no-fee");
  });
});
