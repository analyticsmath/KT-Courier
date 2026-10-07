import assert from "node:assert/strict";
import test from "node:test";
import { hasTestDeferrals } from "./release-test-deferrals.mjs";

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
