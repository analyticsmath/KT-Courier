import assert from "node:assert/strict";
import test from "node:test";
import { hasTestDeferrals, isInactiveRecruitmentTest } from "./release-test-deferrals.mjs";

test("detects direct, nested and parameterized test deferrals", () => {
  for (const source of ["describe.skip('blocked', () => {});", "test.describe.skip('blocked', () => {});", "test.describe.parallel.skip('blocked', () => {});", "describe.concurrent.skip('blocked', () => {});", "describe.each([1]).skip('blocked', () => {});", "it.todo('pending');", "test.fixme(true);", "describe.skipIf(!enabled)('guarded', () => {});"]) assert.equal(hasTestDeferrals(source), true, source);
});
test("does not confuse comments, strings or unrelated skip methods with test deferrals", () => {
  for (const source of ["// test.describe.skip('example')\ntest('actual', () => {});", "const description = 'it.todo';", "database.skip();", "test('executes', () => { expect(1).toBe(1); });"]) assert.equal(hasTestDeferrals(source), false, source);
});
test("retains safety-guard early-return detection", () => {
  assert.equal(hasTestDeferrals("test('database', () => { if (!safety.ok) { return; } expect(result).toBe(true); });"), true);
  assert.equal(hasTestDeferrals("test('database', () => { if (!safety.ok) throw new Error('unsafe'); expect(result).toBe(true); });"), false);
});
test("detects focused and computed test declarations that suppress full execution", () => {
  for (const source of ["test.only('focused', () => {});", "describe.only('focused', () => {});", "test['describe']['skip']('blocked', () => {});", "it['todo']('pending');"]) assert.equal(hasTestDeferrals(source), true, source);
});
test("recruitment exclusions require the exported false source lock", () => {
  const path = "tests/phase26/e2e/admin-handoffs.e2e.spec.ts";
  assert.equal(isInactiveRecruitmentTest(path, "export const RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false;"), true);
  for (const source of ["// export const RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false;\nexport const RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = true;", "export let RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false;", "const RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false;", "export const RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = process.env.SKIP === 'true';"]) assert.equal(isInactiveRecruitmentTest(path, source), false, source);
});
test("canonical driver, staff and financial tests cannot inherit the recruitment exclusion", () => {
  const lock = "export const RECRUITMENT_PRODUCTION_VALIDATION_APPROVED = false;";
  for (const path of ["tests/e2e/driver-operations.spec.ts", "tests/e2e/driver-earnings.spec.ts", "tests/integration/driver-profile-atomicity.integration.test.ts", "tests/integration/employee-permissions.integration.test.ts", "tests/phase26-other/e2e/test.ts"]) assert.equal(isInactiveRecruitmentTest(path, lock), false, path);
});
