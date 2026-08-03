import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
const source = readFileSync(join(process.cwd(), "app/(admin)/admin/driver-earnings/page.tsx"), "utf8") + readFileSync(join(process.cwd(), "app/(admin)/admin/driver-earnings/[id]/page.tsx"), "utf8") + readFileSync(join(process.cwd(), "app/(admin)/admin/driver-earning-reconciliation/page.tsx"), "utf8");
it("uses exact finance headings", () => { expect(source).toContain('title="Driver Earnings"'); expect(source).toContain('title="Driver Earning Reconciliation"'); });
it("has no amount editor, create or mark-release control", () => expect(source).not.toMatch(/amountEditor|accountSelector|CreateDriverEarning|MarkReleased/));
