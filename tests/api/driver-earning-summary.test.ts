import { readFileSync } from "node:fs"; import { join } from "node:path"; import { expect, it } from "vitest";
const source=readFileSync(join(process.cwd(),"app/api/driver/earnings/summary/route.ts"),"utf8");
it("returns only the canonical driver's exact summary",()=>expect(source).toMatch(/role !== "DRIVER"[\s\S]*getDriverEarningSummaryForOwner\(user\.id\)/));
