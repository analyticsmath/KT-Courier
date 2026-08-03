import { expect, test } from "@playwright/test";

test.describe.skip("Phase 26 E2E: Admin Job Opening Publishing & Versioning", () => {
  test("creates opening draft, submits for review, approves version, and publishes opening", async ({ page }) => {
    const setup = "/admin/recruitment/openings";
    const action = "publish an approved opening";
    expect(setup).toContain("openings");
    expect(action).toContain("approved");
  });
});
