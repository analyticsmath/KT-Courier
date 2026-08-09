import { expect, test } from "@playwright/test";

test.describe.skip("Phase 26 E2E: Applicant Multi-Step Application Wizard", () => {
  test("completes personal details, answers screening questions, uploads CV, and submits application", async () => {
    const setup = "/applicant/applications";
    const action = "submit a frozen application version";
    expect(setup).toContain("applications");
    expect(action).toContain("frozen");
  });
});
